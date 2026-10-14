<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CourtAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private string $futureDate;

    protected function setUp(): void
    {
        parent::setUp();
        $this->futureDate = Carbon::now('Asia/Manila')->addDays(14)->toDateString();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_public_endpoint_returns_availability_for_an_existing_court(): void
    {
        $court = $this->makeCourt();

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('status', 200)
            ->assertJsonPath('data.court_id', $court->id)
            ->assertJsonPath('data.date', $this->futureDate)
            ->assertJsonPath('data.court_status', 'available')
            ->assertJsonPath('data.slot_duration_minutes', 60)
            ->assertJsonPath('data.slots.0.start_time', '08:00:00')
            ->assertJsonPath('data.slots.0.end_time', '09:00:00')
            ->assertJsonPath('data.slots.0.available', true);
    }

    public function test_nonexistent_court_returns_404(): void
    {
        $this->getJson('/api/courts/999999/availability?date='.$this->futureDate)
            ->assertNotFound()
            ->assertJsonPath('message', 'Court not found.');
    }

    public function test_date_is_required_and_must_be_a_real_valid_non_past_date(): void
    {
        $court = $this->makeCourt();

        $this->getJson('/api/courts/'.$court->id.'/availability')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);

        $this->getJson('/api/courts/'.$court->id.'/availability?date=2026-02-30')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);

        $pastDate = Carbon::now('Asia/Manila')->subDay()->toDateString();
        $this->getJson('/api/courts/'.$court->id.'/availability?date='.$pastDate)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_available_court_generates_complete_hour_slots_ending_at_closing_time(): void
    {
        $court = $this->makeCourt(['opening_time' => '08:00:00', 'closing_time' => '11:00:00']);

        $response = $this->getJson($this->url($court, $this->futureDate))->assertOk();

        $this->assertSame([
            ['start_time' => '08:00:00', 'end_time' => '09:00:00', 'available' => true],
            ['start_time' => '09:00:00', 'end_time' => '10:00:00', 'available' => true],
            ['start_time' => '10:00:00', 'end_time' => '11:00:00', 'available' => true],
        ], $response->json('data.slots'));
    }

    public function test_non_hour_aligned_opening_time_keeps_alignment_and_includes_closing_boundary(): void
    {
        $court = $this->makeCourt(['opening_time' => '08:30:00', 'closing_time' => '11:00:00']);

        $response = $this->getJson($this->url($court, $this->futureDate))->assertOk();

        $this->assertSame([
            ['start_time' => '08:30:00', 'end_time' => '09:30:00', 'available' => true],
            ['start_time' => '09:30:00', 'end_time' => '10:30:00', 'available' => true],
            ['start_time' => '10:30:00', 'end_time' => '11:00:00', 'available' => true],
        ], $response->json('data.slots'));
        $this->assertSame('11:00:00', $response->json('data.closing_time'));
    }

    public function test_slot_alignment_preserves_opening_time_minutes(): void
    {
        $court = $this->makeCourt(['opening_time' => '08:30:00', 'closing_time' => '10:30:00']);

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.slots.0.start_time', '08:30:00')
            ->assertJsonPath('data.slots.0.end_time', '09:30:00')
            ->assertJsonPath('data.slots.1.start_time', '09:30:00')
            ->assertJsonPath('data.slots.1.end_time', '10:30:00');
    }

    public function test_final_segment_ends_at_closing_even_when_shorter_than_one_hour(): void
    {
        $court = $this->makeCourt(['opening_time' => '08:00:00', 'closing_time' => '09:30:00']);
        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonCount(2, 'data.slots')
            ->assertJsonPath('data.slots.0.end_time', '09:00:00')
            ->assertJsonPath('data.slots.1.start_time', '09:00:00')
            ->assertJsonPath('data.slots.1.end_time', '09:30:00');

        $shortCourt = $this->makeCourt(['opening_time' => '08:00:00', 'closing_time' => '08:59:00']);
        $this->getJson($this->url($shortCourt, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.reason', null)
            ->assertJsonPath('data.slots.0.start_time', '08:00:00')
            ->assertJsonPath('data.slots.0.end_time', '08:59:00');
    }

    public function test_unavailable_court_returns_no_slots_with_safe_reason(): void
    {
        $court = $this->makeCourt(['status' => 'unavailable']);

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.court_status', 'unavailable')
            ->assertJsonPath('data.reason', 'court_unavailable')
            ->assertJsonCount(0, 'data.slots');
    }

    public function test_closed_operating_day_returns_no_slots(): void
    {
        $court = $this->makeCourt(['operating_days' => [$this->differentWeekday($this->futureDate)]]);

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.reason', 'closed_day')
            ->assertJsonCount(0, 'data.slots');
    }

    public function test_missing_operating_days_return_no_slots(): void
    {
        $court = $this->makeCourt(['operating_days' => null]);

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.reason', 'operating_days_unconfigured')
            ->assertJsonCount(0, 'data.slots');
    }

    public function test_missing_or_malformed_operating_hours_return_no_slots(): void
    {
        $missing = $this->makeCourt(['opening_time' => null]);
        $this->getJson($this->url($missing, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.reason', 'operating_hours_unconfigured')
            ->assertJsonCount(0, 'data.slots');

        $malformed = $this->makeCourt(['opening_time' => '25:00:00']);
        $this->getJson($this->url($malformed, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.reason', 'operating_hours_invalid')
            ->assertJsonCount(0, 'data.slots');
    }

    public function test_equal_or_reversed_operating_hours_return_no_slots(): void
    {
        foreach (['08:00:00', '07:00:00'] as $closingTime) {
            $court = $this->makeCourt(['opening_time' => '08:00:00', 'closing_time' => $closingTime]);
            $this->getJson($this->url($court, $this->futureDate))
                ->assertOk()
                ->assertJsonPath('data.reason', 'operating_hours_invalid')
                ->assertJsonCount(0, 'data.slots');
        }
    }

    public function test_pending_and_confirmed_bookings_block_overlapping_slots(): void
    {
        foreach (['pending', 'confirmed'] as $status) {
            $court = $this->makeCourt();
            $this->makeBooking($court, $status, '09:00:00', '10:00:00');

            $this->getJson($this->url($court, $this->futureDate))
                ->assertOk()
                ->assertJsonPath('data.slots.1.available', false)
                ->assertJsonPath('data.slots.1.reason', 'booked');
        }
    }

    public function test_cancelled_booking_does_not_block_its_slot(): void
    {
        $court = $this->makeCourt();
        $this->makeBooking($court, 'cancelled', '09:00:00', '10:00:00');

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.slots.1.available', true);
    }

    public function test_partial_overlap_blocks_a_slot_and_adjacent_booking_does_not(): void
    {
        $court = $this->makeCourt();
        $this->makeBooking($court, 'confirmed', '08:59:00', '09:00:00');
        $this->makeBooking($court, 'confirmed', '10:00:00', '11:00:00');

        $this->getJson($this->url($court, $this->futureDate))
            ->assertOk()
            ->assertJsonPath('data.slots.0.available', false)
            ->assertJsonPath('data.slots.0.reason', 'booked')
            ->assertJsonPath('data.slots.1.available', true)
            ->assertJsonPath('data.slots.2.available', false);
    }

    public function test_slots_already_started_today_are_unavailable_in_asia_manila_time(): void
    {
        $today = Carbon::now('Asia/Manila')->toDateString();
        $court = $this->makeCourt([
            'operating_days' => [Carbon::createFromFormat('!Y-m-d', $today, 'Asia/Manila')->format('l')],
            'opening_time' => '08:00:00',
            'closing_time' => '12:00:00',
        ]);
        Carbon::setTestNow(Carbon::createFromFormat('!Y-m-d H:i:s', $today.' 09:30:00', 'Asia/Manila'));

        $this->getJson($this->url($court, $today))
            ->assertOk()
            ->assertJsonPath('data.slots.0.available', false)
            ->assertJsonPath('data.slots.0.reason', 'past')
            ->assertJsonPath('data.slots.1.available', false)
            ->assertJsonPath('data.slots.2.available', true);
    }

    public function test_response_does_not_expose_booking_or_customer_information(): void
    {
        $court = $this->makeCourt();
        $customer = User::factory()->create(['name' => 'Private Customer', 'email' => 'private@example.test']);
        Booking::factory()->create([
            'court_id' => $court->id,
            'user_id' => $customer->id,
            'booking_date' => $this->futureDate,
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => 'confirmed',
            'total_amount' => 300,
        ]);

        $response = $this->getJson($this->url($court, $this->futureDate))->assertOk();
        $responseBody = $response->getContent();
        $this->assertStringNotContainsString('Private Customer', $responseBody);
        $this->assertStringNotContainsString('private@example.test', $responseBody);
        $this->assertArrayNotHasKey('user_id', $response->json('data'));
        $this->assertArrayNotHasKey('booking_id', $response->json('data.slots.0'));
        $this->assertArrayNotHasKey('id', $response->json('data.slots.0'));
    }

    private function makeCourt(array $overrides = []): Court
    {
        return Court::factory()->create(array_merge([
            'status' => 'available',
            'hourly_rate' => 300,
            'opening_time' => '08:00:00',
            'closing_time' => '12:00:00',
            'operating_days' => [$this->weekday($this->futureDate)],
        ], $overrides));
    }

    private function makeBooking(Court $court, string $status, string $start, string $end): Booking
    {
        return Booking::factory()->create([
            'court_id' => $court->id,
            'booking_date' => $this->futureDate,
            'start_time' => $start,
            'end_time' => $end,
            'status' => $status,
            'total_amount' => 300,
        ]);
    }

    private function url(Court $court, string $date): string
    {
        return '/api/courts/'.$court->id.'/availability?date='.$date;
    }

    private function weekday(string $date): string
    {
        return Carbon::createFromFormat('!Y-m-d', $date, 'Asia/Manila')->format('l');
    }

    private function differentWeekday(string $date): string
    {
        $weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $index = array_search($this->weekday($date), $weekdays, true);

        return $weekdays[((int) $index + 1) % count($weekdays)];
    }
}
