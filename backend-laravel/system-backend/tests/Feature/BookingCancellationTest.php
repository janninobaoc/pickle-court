<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BookingCancellationTest extends TestCase
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
        if ($this->testTransactionStarted && DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    public function test_owner_can_cancel_pending_booking(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)
            ->deleteJson('/api/bookings/' . $booking->id)
            ->assertOk()
            ->assertJsonPath('message', 'Booking cancelled successfully');

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_owner_can_cancel_confirmed_booking(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'confirmed');

        $this->actingAs($user)
            ->deleteJson('/api/bookings/' . $booking->id)
            ->assertOk();

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_cancellation_preserves_the_booking_record(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->actingAs($user)->deleteJson('/api/bookings/' . $booking->id)->assertOk();

        $this->assertDatabaseHas('bookings', ['id' => $booking->id]);
        $this->assertSame(1, Booking::whereKey($booking->id)->count());
    }

    public function test_cancelled_booking_does_not_block_the_slot(): void
    {
        $owner = User::factory()->create();
        $newBookingUser = User::factory()->create();
        $booking = $this->makeBooking($owner, 'cancelled');

        $this->actingAs($newBookingUser)
            ->postJson('/api/bookings', [
                'court_id' => $booking->court_id,
                'booking_date' => $booking->booking_date,
                'start_time' => $booking->start_time,
                'end_time' => $booking->end_time,
            ])
            ->assertCreated();

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_repeated_cancellation_returns_conflict(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'cancelled');

        $this->actingAs($user)
            ->deleteJson('/api/bookings/' . $booking->id)
            ->assertConflict();
    }

    public function test_non_owner_cannot_cancel_booking(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $booking = $this->makeBooking($owner, 'pending');

        $this->actingAs($otherUser)
            ->deleteJson('/api/bookings/' . $booking->id)
            ->assertNotFound();

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'user_id' => $owner->id,
            'status' => 'pending',
        ]);
    }

    public function test_guest_cannot_cancel_booking(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');

        $this->deleteJson('/api/bookings/' . $booking->id)->assertUnauthorized();
    }

    public function test_nonexistent_booking_returns_not_found(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->deleteJson('/api/bookings/999999999')
            ->assertNotFound();
    }

    public function test_booking_that_has_started_cannot_be_cancelled(): void
    {
        $user = User::factory()->create();
        $startedAt = Carbon::now(config('app.timezone'))->subHour();
        $booking = $this->makeBooking($user, 'confirmed', [
            'booking_date' => $startedAt->toDateString(),
            'start_time' => $startedAt->format('H:i:s'),
            'end_time' => $startedAt->copy()->addHour()->format('H:i:s'),
        ]);

        $this->actingAs($user)
            ->deleteJson('/api/bookings/' . $booking->id)
            ->assertConflict();

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'confirmed',
        ]);
    }

    public function test_cancellation_changes_only_status(): void
    {
        $user = User::factory()->create();
        $booking = $this->makeBooking($user, 'pending');
        $original = $booking->only([
            'user_id',
            'court_id',
            'booking_date',
            'start_time',
            'end_time',
            'total_amount',
        ]);

        $this->actingAs($user)->deleteJson('/api/bookings/' . $booking->id)->assertOk();

        $booking->refresh();
        $this->assertSame('cancelled', $booking->status);
        foreach ($original as $field => $value) {
            $this->assertEquals($value, $booking->getAttribute($field), $field . ' changed during cancellation.');
        }
    }

    private function makeBooking(User $user, string $status, array $overrides = []): Booking
    {
        $bookingDate = Carbon::now(config('app.timezone'))->addDays(14)->toDateString();
        $weekday = Carbon::createFromFormat('!Y-m-d', $bookingDate, config('app.timezone'))->format('l');

        $court = Court::factory()->create([
            'status' => 'available',
            'hourly_rate' => 300.00,
            'opening_time' => '08:00:00',
            'closing_time' => '22:00:00',
            'operating_days' => [$weekday],
        ]);

        return Booking::factory()->create(array_merge([
            'user_id' => $user->id,
            'court_id' => $court->id,
            'booking_date' => $bookingDate,
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => $status,
            'total_amount' => 300.00,
        ], $overrides));
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
