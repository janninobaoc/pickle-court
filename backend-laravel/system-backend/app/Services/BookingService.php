<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Court;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BookingService
{
    public function getAllBookings(int $userId)
    {
        return Booking::with(['user', 'court'])->where('user_id', $userId)->get();
    }

    public function getBookingById(int $id, int $userId)
    {
        return Booking::with(['user', 'court'])->where('id', $id)->where('user_id', $userId)->firstOrFail();
    }

    public function createBooking(array $bookingData, int $userId)
    {
        return DB::transaction(function () use ($bookingData, $userId) {
            $court = Court::whereKey($bookingData['court_id'])
                ->lockForUpdate()
                ->firstOrFail();

            [$startTime, $endTime] = $this->validateCourtSchedule($court, $bookingData);
            $this->assertNoOverlappingBooking($bookingData, (int) $court->id);
            $totalAmount = $this->calculateTotalAmount($court, $startTime, $endTime);

            return Booking::create([
                'user_id' => $userId,
                'court_id' => $bookingData['court_id'],
                'booking_date' => $bookingData['booking_date'],
                'start_time' => $bookingData['start_time'],
                'end_time' => $bookingData['end_time'],
                'status' => 'pending',
                'total_amount' => $totalAmount,
            ]);
        });
    }

    public function rescheduleBooking(int $bookingId, int $userId, array $bookingData): Booking
    {
        return DB::transaction(function () use ($bookingId, $userId, $bookingData) {
            $booking = Booking::whereKey($bookingId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();

            if (!in_array($booking->status, ['pending', 'confirmed'], true)) {
                throw new \DomainException('This booking cannot be rescheduled.');
            }

            if (!$this->scheduledStartIsFuture($booking->booking_date, $booking->start_time)) {
                throw new \DomainException('A booking that has already started cannot be rescheduled.');
            }

            $court = Court::whereKey($booking->court_id)
                ->lockForUpdate()
                ->firstOrFail();

            [$startTime, $endTime] = $this->validateCourtSchedule($court, $bookingData);

            if (!$this->scheduledStartIsFuture($bookingData['booking_date'], $bookingData['start_time'])) {
                throw new \DomainException('A rescheduled booking must start in the future.');
            }

            $this->assertNoOverlappingBooking(
                $bookingData,
                (int) $court->id,
                (int) $booking->id
            );

            $booking->booking_date = $bookingData['booking_date'];
            $booking->start_time = $bookingData['start_time'];
            $booking->end_time = $bookingData['end_time'];
            $booking->total_amount = $this->calculateTotalAmount($court, $startTime, $endTime);
            $booking->save();

            return $booking;
        });
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function validateCourtSchedule(Court $court, array $bookingData): array
    {
        if ($court->status !== 'available') {
            throw new \DomainException('This court is currently unavailable for booking.');
        }

        $bookingDay = Carbon::createFromFormat('!Y-m-d', $bookingData['booking_date'])->format('l');
        $operatingDays = $court->operating_days;

        if (!is_array($operatingDays) || !in_array($bookingDay, $operatingDays, true)) {
            throw new \DomainException('This court is closed on the selected day.');
        }

        if (!$court->opening_time || !$court->closing_time) {
            throw new \DomainException('Court operating hours are not configured.');
        }

        $openingTime = $this->parseCourtTime($court->opening_time);
        $closingTime = $this->parseCourtTime($court->closing_time);
        $startTime = Carbon::createFromFormat('!H:i:s', $bookingData['start_time']);
        $endTime = Carbon::createFromFormat('!H:i:s', $bookingData['end_time']);

        if ($endTime->lessThanOrEqualTo($startTime)) {
            throw new \DomainException('Booking end time must be later than start time.');
        }

        if ($closingTime->lessThanOrEqualTo($openingTime)) {
            throw new \DomainException('Court operating hours are invalid.');
        }

        if ($startTime->lessThan($openingTime) || $endTime->greaterThan($closingTime)) {
            throw new \DomainException('The selected booking time is outside court operating hours.');
        }

        return [$startTime, $endTime];
    }

    private function parseCourtTime($value): Carbon
    {
        if (!is_string($value)) {
            throw new \DomainException('Court operating hours are invalid.');
        }

        if (preg_match('/^\d{2}:\d{2}$/', $value)) {
            $format = '!H:i';
        } elseif (preg_match('/^\d{2}:\d{2}:\d{2}$/', $value)) {
            $format = '!H:i:s';
        } else {
            throw new \DomainException('Court operating hours are invalid.');
        }

        try {
            $time = Carbon::createFromFormat($format, $value);

            if (!$time || $time->format(substr($format, 1)) !== $value) {
                throw new \DomainException('Court operating hours are invalid.');
            }

            return $time;
        } catch (\Carbon\Exceptions\InvalidFormatException $e) {
            throw new \DomainException('Court operating hours are invalid.', 0, $e);
        }
    }

    private function assertNoOverlappingBooking(
        array $bookingData,
        int $courtId,
        ?int $excludedBookingId = null
    ): void
    {
        $query = Booking::where('court_id', $courtId)
            ->where('booking_date', $bookingData['booking_date'])
            ->where('start_time', '<', $bookingData['end_time'])
            ->where('end_time', '>', $bookingData['start_time'])
            ->whereIn('status', ['pending', 'confirmed']);

        if ($excludedBookingId !== null) {
            $query->where('id', '!=', $excludedBookingId);
        }

        if ($query->exists()) {
            throw new \DomainException('The court is already booked for this time.');
        }
    }

    private function calculateTotalAmount(Court $court, Carbon $startTime, Carbon $endTime)
    {
        $duration = $startTime->diffInMinutes($endTime) / 60;

        return $court->hourly_rate * $duration;
    }

    private function scheduledStartIsFuture(string $bookingDate, string $startTime): bool
    {
        $scheduledStart = Carbon::createFromFormat(
            '!Y-m-d H:i:s',
            $bookingDate . ' ' . $startTime,
            config('app.timezone')
        );

        return $scheduledStart !== false && $scheduledStart->isFuture();
    }
    public function updateBooking(Booking $booking, array $bookingData)
    {
        $booking->update($bookingData);

        return $booking;
    }
    public function deleteBooking(Booking $booking)
    {
        $booking->delete();
    }

    public function cancelBooking(int $bookingId, int $userId): Booking
    {
        return DB::transaction(function () use ($bookingId, $userId) {
            $booking = Booking::whereKey($bookingId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($booking->status === 'cancelled') {
                throw new \DomainException('This booking has already been cancelled.');
            }

            if (!in_array($booking->status, ['pending', 'confirmed'], true)) {
                throw new \DomainException('This booking cannot be cancelled.');
            }

            $scheduledStart = Carbon::createFromFormat(
                '!Y-m-d H:i:s',
                $booking->booking_date . ' ' . $booking->start_time,
                config('app.timezone')
            );

            if (!$scheduledStart || !$scheduledStart->isFuture()) {
                throw new \DomainException('A booking that has already started cannot be cancelled.');
            }

            $booking->status = 'cancelled';
            $booking->save();

            return $booking;
        });
    }
}
