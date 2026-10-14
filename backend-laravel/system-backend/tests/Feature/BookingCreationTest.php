<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class BookingCreationTest extends TestCase
{
    use RefreshDatabase;

    private const BOOKING_DATE = '2099-01-01';

    public function test_authenticated_user_can_create_a_booking(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertCreated()
            ->assertJsonPath('message', 'Booking created successfully')
            ->assertJsonPath('data.user_id', $user->id)
            ->assertJsonPath('data.court_id', $court->id);

        $this->assertDatabaseHas('bookings', [
            'user_id' => $user->id,
            'court_id' => $court->id,
            'booking_date' => self::BOOKING_DATE,
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => 'pending',
            'total_amount' => '300.00',
        ]);
    }

    public function test_booking_accepts_longer_durations_and_calculates_price_from_the_full_interval(): void
    {
        $user = User::factory()->create();

        foreach ([
            ['08:00:00', '09:00:00', '300.00'],
            ['08:00:00', '08:30:00', '150.00'],
            ['08:00:00', '10:00:00', '600.00'],
            ['08:00:00', '12:00:00', '1200.00'],
            ['08:00:00', '22:00:00', '4200.00'],
        ] as [$start, $end, $amount]) {
            $court = $this->makeBookableCourt();

            $this->actingAs($user)
                ->postJson('/api/bookings', $this->bookingData($court, [
                    'start_time' => $start,
                    'end_time' => $end,
                ]))
                ->assertCreated()
                ->assertJsonPath('data.total_amount', (int) $amount);

            $this->assertDatabaseHas('bookings', [
                'court_id' => $court->id,
                'booking_date' => self::BOOKING_DATE,
                'start_time' => $start,
                'end_time' => $end,
                'total_amount' => $amount,
            ]);
        }
    }

    public function test_booking_conflict_in_the_middle_of_a_long_interval_is_rejected(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();
        $this->createExistingBooking($court, $user, 'confirmed', [
            'start_time' => '11:30:00',
            'end_time' => '12:30:00',
        ]);

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court, [
                'start_time' => '09:00:00',
                'end_time' => '14:00:00',
            ]))
            ->assertConflict();
    }

    public function test_guest_cannot_create_a_booking(): void
    {
        $court = $this->makeBookableCourt();

        $this->postJson('/api/bookings', $this->bookingData($court))
            ->assertUnauthorized();
    }

    public function test_unavailable_court_rejects_a_booking(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt(['status' => 'unavailable']);

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertConflict();
    }

    public function test_closed_operating_day_rejects_a_booking(): void
    {
        $user = User::factory()->create();
        $closedDay = $this->nextWeekday($this->bookingWeekday());
        $court = $this->makeBookableCourt(['operating_days' => [$closedDay]]);

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertConflict();
    }

    public function test_booking_outside_court_hours_is_rejected(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt([
            'opening_time' => '09:00:00',
            'closing_time' => '17:00:00',
        ]);

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court, [
                'start_time' => '08:00:00',
                'end_time' => '09:00:00',
            ]))
            ->assertConflict();
    }

    public function test_overlapping_pending_booking_is_rejected(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();
        $this->createExistingBooking($court, $user, 'pending');

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertConflict();
    }

    public function test_overlapping_confirmed_booking_is_rejected(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();
        $this->createExistingBooking($court, $user, 'confirmed');

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertConflict();
    }

    public function test_cancelled_booking_does_not_block_availability(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();
        $this->createExistingBooking($court, $user, 'cancelled');

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertCreated();

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_adjacent_booking_times_are_allowed(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();
        $this->createExistingBooking($court, $user, 'confirmed', [
            'start_time' => '08:00:00',
            'end_time' => '09:00:00',
        ]);

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court))
            ->assertCreated();

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_end_time_must_be_later_than_start_time(): void
    {
        $user = User::factory()->create();
        $court = $this->makeBookableCourt();

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court, [
                'start_time' => '10:00:00',
                'end_time' => '10:00:00',
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_time']);
    }

    public function test_nonexistent_court_fails_request_validation(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/bookings', [
                'court_id' => 999999,
                'booking_date' => self::BOOKING_DATE,
                'start_time' => '09:00:00',
                'end_time' => '10:00:00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['court_id']);
    }

    public function test_booking_uses_the_authenticated_user_id(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $court = $this->makeBookableCourt();

        $this->actingAs($user)
            ->postJson('/api/bookings', $this->bookingData($court, [
                'user_id' => $otherUser->id,
            ]))
            ->assertCreated();

        $this->assertDatabaseHas('bookings', [
            'court_id' => $court->id,
            'user_id' => $user->id,
            'booking_date' => self::BOOKING_DATE,
        ]);
        $this->assertDatabaseMissing('bookings', [
            'court_id' => $court->id,
            'user_id' => $otherUser->id,
            'booking_date' => self::BOOKING_DATE,
        ]);
    }

    private function makeBookableCourt(array $overrides = []): Court
    {
        return Court::factory()->create(array_merge([
            'status' => 'available',
            'hourly_rate' => 300.00,
            'opening_time' => '08:00:00',
            'closing_time' => '22:00:00',
            'operating_days' => [$this->bookingWeekday()],
        ], $overrides));
    }

    private function bookingData(Court $court, array $overrides = []): array
    {
        return array_merge([
            'court_id' => $court->id,
            'booking_date' => self::BOOKING_DATE,
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ], $overrides);
    }

    private function createExistingBooking(
        Court $court,
        User $user,
        string $status,
        array $overrides = []
    ): Booking {
        return Booking::factory()->create(array_merge([
            'court_id' => $court->id,
            'user_id' => $user->id,
            'booking_date' => self::BOOKING_DATE,
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => $status,
            'total_amount' => 300.00,
        ], $overrides));
    }

    private function bookingWeekday(): string
    {
        return Carbon::createFromFormat('!Y-m-d', self::BOOKING_DATE)->format('l');
    }

    private function nextWeekday(string $weekday): string
    {
        $weekdays = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
        ];

        return $weekdays[(array_search($weekday, $weekdays, true) + 1) % count($weekdays)];
    }
}
