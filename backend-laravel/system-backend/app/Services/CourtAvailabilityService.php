<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Court;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;

class CourtAvailabilityService
{
    private const SLOT_DURATION_MINUTES = 60;

    /**
     * Return a public snapshot of bookable slots without exposing booking or customer data.
     *
     * @return array<string, mixed>
     *
     * @throws ModelNotFoundException
     */
    public function forDate(int $courtId, string $date): array
    {
        $court = Court::query()->findOrFail($courtId);

        return $this->availabilityForCourt($court, $date);
    }

    /** Return availability for an owned, eligible booking while excluding that booking alone. */
    public function forReschedulingBooking(int $bookingId, int $userId, string $date): array
    {
        $booking = Booking::query()
            ->whereKey($bookingId)
            ->where('user_id', $userId)
            ->firstOrFail();

        if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
            throw new \DomainException('This booking cannot be rescheduled.');
        }

        $timezone = (string) config('app.timezone', 'Asia/Manila');
        try {
            $scheduledStart = Carbon::createFromFormat(
                '!Y-m-d H:i:s',
                $booking->booking_date.' '.$booking->start_time,
                $timezone
            );
        } catch (\Throwable) {
            $scheduledStart = false;
        }

        if (! $scheduledStart || ! $scheduledStart->isFuture()) {
            throw new \DomainException('A booking that has already started cannot be rescheduled.');
        }

        $court = Court::query()->findOrFail($booking->court_id);

        return $this->availabilityForCourt($court, $date, (int) $booking->id);
    }

    /** @return array<string, mixed> */
    private function availabilityForCourt(Court $court, string $date, ?int $excludedBookingId = null): array
    {
        $timezone = (string) config('app.timezone', 'Asia/Manila');

        $result = [
            'court_id' => (int) $court->id,
            'date' => $date,
            'court_status' => $court->status,
            'opening_time' => null,
            'closing_time' => null,
            'slot_duration_minutes' => self::SLOT_DURATION_MINUTES,
            'reason' => null,
            'slots' => [],
        ];

        $opening = $this->parseTime($court->opening_time, $timezone);
        $closing = $this->parseTime($court->closing_time, $timezone);
        $result['opening_time'] = $opening?->format('H:i:s');
        $result['closing_time'] = $closing?->format('H:i:s');

        if ($court->status !== 'available') {
            $result['reason'] = 'court_unavailable';

            return $result;
        }

        $operatingDays = $court->operating_days;
        if (! is_array($operatingDays)) {
            $result['reason'] = 'operating_days_unconfigured';

            return $result;
        }

        $bookingDate = Carbon::createFromFormat('!Y-m-d', $date, $timezone);
        if (! $bookingDate) {
            // The FormRequest validates this, but fail closed if this service is called elsewhere.
            $result['reason'] = 'invalid_date';

            return $result;
        }

        if (! in_array($bookingDate->format('l'), $operatingDays, true)) {
            $result['reason'] = $operatingDays === [] ? 'operating_days_unconfigured' : 'closed_day';

            return $result;
        }

        if ($opening === null || $closing === null) {
            $result['reason'] = $court->opening_time === null || $court->closing_time === null
                ? 'operating_hours_unconfigured'
                : 'operating_hours_invalid';

            return $result;
        }

        $openingAt = Carbon::createFromFormat(
            '!Y-m-d H:i:s',
            $date.' '.$opening->format('H:i:s'),
            $timezone
        );
        $closingAt = Carbon::createFromFormat(
            '!Y-m-d H:i:s',
            $date.' '.$closing->format('H:i:s'),
            $timezone
        );

        if (! $openingAt || ! $closingAt || $closingAt->lessThanOrEqualTo($openingAt)) {
            $result['reason'] = 'operating_hours_invalid';

            return $result;
        }

        $bookingQuery = Booking::query()
            ->where('court_id', $court->id)
            ->where('booking_date', $date)
            ->whereIn('status', ['pending', 'confirmed']);

        if ($excludedBookingId !== null) {
            $bookingQuery->where('id', '!=', $excludedBookingId);
        }

        $bookings = $bookingQuery->get(['start_time', 'end_time']);

        $bookingIntervals = [];
        foreach ($bookings as $booking) {
            $bookingStart = $this->timeToSeconds($booking->start_time);
            $bookingEnd = $this->timeToSeconds($booking->end_time);
            if ($bookingStart === null || $bookingEnd === null || $bookingEnd <= $bookingStart) {
                // Bad persisted schedule data must not create a falsely available snapshot.
                $result['reason'] = 'booking_schedule_invalid';

                return $result;
            }
            $bookingIntervals[] = [$bookingStart, $bookingEnd];
        }

        $now = Carbon::now($timezone);
        $slotStart = $openingAt->copy();
        while ($slotStart->lessThan($closingAt)) {
            // Keep booking boundaries aligned to opening time and hourly increments,
            // while making the actual closing time selectable as the final endpoint.
            $slotEnd = $slotStart->copy()->addMinutes(self::SLOT_DURATION_MINUTES);
            if ($slotEnd->greaterThan($closingAt)) {
                $slotEnd = $closingAt->copy();
            }
            $startSeconds = $this->timeToSeconds($slotStart->format('H:i:s'));
            $endSeconds = $this->timeToSeconds($slotEnd->format('H:i:s'));
            $overlapsBooking = false;

            foreach ($bookingIntervals as [$bookingStart, $bookingEnd]) {
                if ($bookingStart < $endSeconds && $bookingEnd > $startSeconds) {
                    $overlapsBooking = true;
                    break;
                }
            }

            $isPast = ! $slotStart->greaterThan($now);
            $slot = [
                'start_time' => $slotStart->format('H:i:s'),
                'end_time' => $slotEnd->format('H:i:s'),
                'available' => ! $isPast && ! $overlapsBooking,
            ];

            if ($isPast) {
                $slot['reason'] = 'past';
            } elseif ($overlapsBooking) {
                $slot['reason'] = 'booked';
            }

            $result['slots'][] = $slot;
            $slotStart = $slotEnd;
        }

        if ($result['slots'] === []) {
            $result['reason'] = 'no_complete_slots';
        }

        return $result;
    }

    private function parseTime(mixed $value, string $timezone): ?Carbon
    {
        if (! is_string($value)) {
            return null;
        }

        if (preg_match('/^\d{2}:\d{2}$/', $value) === 1) {
            $format = '!H:i';
        } elseif (preg_match('/^\d{2}:\d{2}:\d{2}$/', $value) === 1) {
            $format = '!H:i:s';
        } else {
            return null;
        }

        try {
            $parsed = Carbon::createFromFormat($format, $value, $timezone);

            return $parsed && $parsed->format(substr($format, 1)) === $value ? $parsed : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function timeToSeconds(mixed $value): ?int
    {
        if (! is_string($value) || preg_match('/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/', $value) !== 1) {
            return null;
        }

        [$hours, $minutes, $seconds] = array_pad(array_map('intval', explode(':', $value)), 3, 0);

        return ($hours * 3600) + ($minutes * 60) + $seconds;
    }
}
