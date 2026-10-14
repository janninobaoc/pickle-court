<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BookingReschedulingTest extends TestCase
{
    private bool $testTransactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSafeTestDatabase();
        DB::beginTransaction();
        $this->testTransactionStarted = true;
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        if ($this->testTransactionStarted && DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    public function test_rescheduling_availability_requires_authentication(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->getJson('/api/bookings/'.$booking->id.'/availability?date='.$booking->booking_date)
            ->assertUnauthorized();
    }

    public function test_owner_availability_excludes_only_the_current_booking(): void
    {
        $owner = User::factory()->create(['name' => 'Private Availability Owner', 'email' => 'availability-owner@example.test']);
        $booking = $this->makeBooking($owner, 'pending');
        $otherUser = User::factory()->create();

        $this->createBlockingBooking($booking, $otherUser, 'pending', [
            'booking_date' => $booking->booking_date,
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
        ]);
        $this->createBlockingBooking($booking, $otherUser, 'confirmed', [
            'booking_date' => $booking->booking_date,
            'start_time' => '11:00:00',
            'end_time' => '12:00:00',
        ]);
        $this->createBlockingBooking($booking, $otherUser, 'cancelled', [
            'booking_date' => $booking->booking_date,
            'start_time' => '12:00:00',
            'end_time' => '13:00:00',
        ]);

        $response = $this->actingAs($owner)
            ->getJson('/api/bookings/'.$booking->id.'/availability?date='.$booking->booking_date)
            ->assertOk()
            ->assertJsonPath('status', 200)
            ->assertJsonPath('data.court_id', $booking->court_id)
            ->assertJsonPath('data.date', $booking->booking_date);

        $slots = $response->json('data.slots');
        $this->assertTrue($slots[1]['available'], 'The owner’s current 09:00–10:00 interval is excluded.');
        $this->assertFalse($slots[2]['available'], 'Other pending bookings still block slots.');
        $this->assertFalse($slots[3]['available'], 'Other confirmed bookings still block slots.');
        $this->assertTrue($slots[4]['available'], 'Cancelled bookings do not block slots.');
        $this->assertStringNotContainsString('Private Availability Owner', $response->getContent());
        $this->assertStringNotContainsString('availability-owner@example.test', $response->getContent());
        $this->assertArrayNotHasKey('user_id', $response->json('data'));
    }

    public function test_another_users_booking_is_not_found_on_rescheduling_availability(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $booking = $this->makeBooking($owner, 'pending');

        $this->actingAs($otherUser)
            ->getJson('/api/bookings/'.$booking->id.'/availability?date='.$booking->booking_date)
            ->assertNotFound()
            ->assertJsonPath('message', 'Booking not found.');
    }

    public function test_rescheduling_availability_validates_the_requested_date(): void
    {
        $owner = User::factory()->create();
        $booking = $this->makeBooking($owner, 'pending');
        $pastDate = Carbon::now(config('app.timezone'))->subDay()->toDateString();

        $this->actingAs($owner)
            ->getJson('/api/bookings/'.$booking->id.'/availability?date=2026-02-30')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);

        $this->actingAs($owner)
            ->getJson('/api/bookings/'.$booking->id.'/availability?date='.$pastDate)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_closed_day_is_reported_for_rescheduling_availability(): void
    {
        $owner = User::factory()->create();
        $booking = $this->makeBooking($owner, 'pending');
        $closedDate = Carbon::createFromFormat('!Y-m-d', $booking->booking_date, config('app.timezone'))
            ->addDay()
            ->toDateString();

        $this->actingAs($owner)
            ->getJson('/api/bookings/'.$booking->id.'/availability?date='.$closedDate)
            ->assertOk()
            ->assertJsonPath('data.reason', 'closed_day')
            ->assertJsonCount(0, 'data.slots');
    }

    public function test_cancelled_and_already_started_bookings_cannot_request_rescheduling_availability(): void
    {
        $owner = User::factory()->create();
        $cancelled = $this->makeBooking($owner, 'cancelled');

        $this->actingAs($owner)
            ->getJson('/api/bookings/'.$cancelled->id.'/availability?date='.$cancelled->booking_date)
            ->assertStatus(409)
            ->assertJsonPath('message', 'This booking cannot be rescheduled.');

        $started = $this->makeBooking($owner, 'pending');
        $today = Carbon::now(config('app.timezone'))->toDateString();
        Carbon::setTestNow(Carbon::createFromFormat('!Y-m-d H:i:s', $today.' 09:30:00', config('app.timezone')));
        $started->booking_date = $today;
        $started->start_time = '09:00:00';
        $started->end_time = '10:00:00';
        $started->save();

        $this->getJson('/api/bookings/'.$started->id.'/availability?date='.$today)
            ->assertStatus(409)
            ->assertJsonPath('message', 'A booking that has already started cannot be rescheduled.');
    }

    public function test_owner_can_reschedule_pending_booking(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $newSchedule = $this->futureSchedule(['start_time' => '11:00:00', 'end_time' => '12:00:00']);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $newSchedule)
            ->assertOk()
            ->assertJsonPath('message', 'Booking rescheduled successfully')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.booking_date', $newSchedule['booking_date'])
            ->assertJsonPath('data.start_time', $newSchedule['start_time']);
    }

    public function test_owner_can_reschedule_confirmed_booking(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'confirmed');

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');
    }

    public function test_guest_cannot_reschedule_booking(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertUnauthorized();
    }

    public function test_non_owner_receives_not_found(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $booking = $this->makeBooking($owner, 'pending');

        $this->actingAs($otherUser)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertNotFound();

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'user_id' => $owner->id,
            'status' => 'pending',
        ]);
    }

    public function test_missing_booking_receives_not_found(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/bookings/999999999/reschedule', $this->futureSchedule())
            ->assertNotFound();
    }

    public function test_cancelled_booking_cannot_be_rescheduled(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'cancelled');

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertConflict();

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'cancelled']);
    }

    public function test_already_started_booking_cannot_be_rescheduled(): void
    {
        $user = User::factory()->create();
        $startedAt = Carbon::now(config('app.timezone'))->subHour();
        $booking = $this->makeBooking($user, 'confirmed', [
            'booking_date' => $startedAt->toDateString(),
            'start_time' => $startedAt->format('H:i:s'),
            'end_time' => $startedAt->copy()->addHour()->format('H:i:s'),
        ]);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertConflict();

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'confirmed']);
    }

    public function test_new_booking_start_must_be_in_the_future(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $futureWeekday = Carbon::createFromFormat(
            '!Y-m-d',
            $booking->booking_date,
            config('app.timezone')
        )->format('l');
        $simulatedDate = Carbon::now(config('app.timezone'))->addDays(7);
        $todayWeekday = $simulatedDate->format('l');
        $booking->court()->update(['operating_days' => array_values(array_unique([$futureWeekday, $todayWeekday]))]);

        try {
            Carbon::setTestNow($simulatedDate->copy()->setTime(12, 0, 0));

            $this->actingAs($user)
                ->patchJson('/api/bookings/' . $booking->id . '/reschedule', [
                    'booking_date' => $simulatedDate->toDateString(),
                    'start_time' => '09:00:00',
                    'end_time' => '10:00:00',
                ])
                ->assertConflict();
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_invalid_time_ordering_is_rejected(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule([
                'start_time' => '10:00:00',
                'end_time' => '10:00:00',
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_time']);
    }

    public function test_unavailable_court_rejects_rescheduling(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $booking->court()->update(['status' => 'unavailable']);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertConflict();
    }

    public function test_closed_operating_day_rejects_rescheduling(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $targetDate = $this->futureSchedule()['booking_date'];
        $targetWeekday = Carbon::createFromFormat('!Y-m-d', $targetDate)->format('l');
        $closedWeekday = $this->nextWeekday($targetWeekday);
        $booking->court()->update(['operating_days' => [$closedWeekday]]);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule())
            ->assertConflict();
    }

    public function test_schedule_outside_court_hours_is_rejected(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule([
                'start_time' => '07:00:00',
                'end_time' => '08:00:00',
            ]))
            ->assertConflict();
    }

    public function test_overlapping_pending_booking_is_rejected(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $target = $this->futureSchedule(['start_time' => '11:00:00', 'end_time' => '12:00:00']);
        $this->createBlockingBooking($booking, $user, 'pending', $target);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $target)
            ->assertConflict();
    }

    public function test_overlapping_confirmed_booking_is_rejected(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $target = $this->futureSchedule(['start_time' => '11:00:00', 'end_time' => '12:00:00']);
        $this->createBlockingBooking($booking, $user, 'confirmed', $target);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $target)
            ->assertConflict();
    }

    public function test_cancelled_booking_does_not_block_the_new_slot(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $target = $this->futureSchedule(['start_time' => '11:00:00', 'end_time' => '12:00:00']);
        $this->createBlockingBooking($booking, $user, 'cancelled', $target);

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $target)
            ->assertOk();
    }

    public function test_adjacent_booking_is_allowed(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $this->createBlockingBooking($booking, $user, 'confirmed', $this->futureSchedule([
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
        ]));

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule([
                'start_time' => '09:00:00',
                'end_time' => '10:00:00',
            ]))
            ->assertOk();
    }

    public function test_booking_does_not_conflict_with_itself(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', [
                'booking_date' => $booking->booking_date,
                'start_time' => $booking->start_time,
                'end_time' => $booking->end_time,
            ])
            ->assertOk();
    }

    public function test_total_amount_is_recalculated_from_the_new_duration(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule([
                'start_time' => '10:00:00',
                'end_time' => '12:00:00',
            ]))
            ->assertOk()
            ->assertJsonPath('data.total_amount', 600);

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'total_amount' => '600.00',
        ]);
    }

    public function test_rescheduling_to_a_shorter_fractional_duration_recalculates_the_amount(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)
            ->patchJson('/api/bookings/'.$booking->id.'/reschedule', $this->futureSchedule([
                'start_time' => '10:00:00',
                'end_time' => '10:30:00',
            ]))
            ->assertOk()
            ->assertJsonPath('data.total_amount', 150);

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'start_time' => '10:00:00',
            'end_time' => '10:30:00',
            'total_amount' => '150.00',
        ]);
    }

    public function test_owner_court_and_status_remain_unchanged(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'confirmed');
        $original = [
            'user_id' => $booking->user_id,
            'court_id' => $booking->court_id,
            'status' => $booking->status,
        ];

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', $this->futureSchedule([
                'start_time' => '11:00:00',
                'end_time' => '12:00:00',
            ]))
            ->assertOk();

        $booking->refresh();
        $this->assertSame((int) $original['user_id'], (int) $booking->user_id);
        $this->assertSame((int) $original['court_id'], (int) $booking->court_id);
        $this->assertSame($original['status'], $booking->status);
    }

    public function test_unexpected_request_fields_are_rejected(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $originalDate = $booking->booking_date;
        $originalStart = $booking->start_time;

        $this->actingAs($user)
            ->patchJson('/api/bookings/' . $booking->id . '/reschedule', array_merge(
                $this->futureSchedule(),
                [
                    'user_id' => 999999,
                    'court_id' => 999999,
                    'status' => 'cancelled',
                    'total_amount' => 0,
                    'unexpected' => 'value',
                ]
            ))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'court_id', 'status', 'total_amount', 'unexpected']);

        $booking->refresh();
        $this->assertSame($originalDate, $booking->booking_date);
        $this->assertSame($originalStart, $booking->start_time);
        $this->assertSame('pending', $booking->status);
    }

    private function makeBooking(
        User $user,
        string $status,
        array $bookingOverrides = [],
        array $courtOverrides = []
    ): Booking {
        $schedule = $this->futureSchedule();
        $weekday = Carbon::createFromFormat('!Y-m-d', $schedule['booking_date'])->format('l');
        $court = Court::factory()->create(array_merge([
            'status' => 'available',
            'hourly_rate' => 300.00,
            'opening_time' => '08:00:00',
            'closing_time' => '22:00:00',
            'operating_days' => [$weekday],
        ], $courtOverrides));

        return Booking::factory()->create(array_merge([
            'user_id' => $user->id,
            'court_id' => $court->id,
            'booking_date' => $schedule['booking_date'],
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => $status,
            'total_amount' => 300.00,
        ], $bookingOverrides));
    }

    private function createBlockingBooking(
        Booking $booking,
        User $user,
        string $status,
        array $schedule
    ): Booking {
        return Booking::factory()->create(array_merge([
            'user_id' => $user->id,
            'court_id' => $booking->court_id,
            'booking_date' => $schedule['booking_date'],
            'start_time' => $schedule['start_time'],
            'end_time' => $schedule['end_time'],
            'status' => $status,
            'total_amount' => 300.00,
        ], $schedule));
    }

    private function futureSchedule(array $overrides = []): array
    {
        return array_merge([
            'booking_date' => Carbon::now(config('app.timezone'))->addDays(14)->toDateString(),
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ], $overrides);
    }

    private function nextWeekday(string $weekday): string
    {
        $weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return $weekdays[(array_search($weekday, $weekdays, true) + 1) % count($weekdays)];
    }

    private function assertSafeTestDatabase(): void
    {
        $this->assertSame('testing', app()->environment(), 'APP_ENV must be testing.');
        $this->assertSame('mysql', config('database.default'), 'The test connection must be mysql.');
        $this->assertSame(
            'system_backend_test',
            config('database.connections.mysql.database'),
            'The test connection must use system_backend_test.'
        );
        $this->assertSame(
            'picklecourt_test',
            config('database.connections.mysql.username'),
            'The test connection must use the restricted test account.'
        );

        $identity = DB::selectOne(
            'SELECT DATABASE() AS database_name, CURRENT_USER() AS account_name'
        );
        $this->assertSame('system_backend_test', $identity->database_name);
        $this->assertSame('picklecourt_test@localhost', $identity->account_name);

        $testDatabaseGrantFound = false;
        foreach (DB::select('SHOW GRANTS FOR CURRENT_USER()') as $grantRow) {
            $grantValues = array_values((array) $grantRow);
            $grant = strtoupper(str_replace(['`', "'"], '', (string) ($grantValues[0] ?? '')));

            if (!preg_match('/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/', $grant, $matches)) {
                $this->fail('The test account has an unrecognized grant; refusing database use.');
            }

            $privileges = trim($matches[1]);
            $scope = trim($matches[2]);

            if ($scope === '*.*') {
                $this->assertSame('USAGE', $privileges, 'Global database privileges are forbidden.');
            } elseif ($scope === 'SYSTEM_BACKEND_TEST.*') {
                $testDatabaseGrantFound = true;
                $this->assertStringNotContainsString('WITH GRANT OPTION', $grant);
            } else {
                $this->fail('The test account has a grant outside system_backend_test.');
            }

            $this->assertStringNotContainsString('SYSTEM_BACKEND.*', $grant);
        }

        $this->assertTrue($testDatabaseGrantFound, 'The test account lacks an explicit test database grant.');
    }
}
