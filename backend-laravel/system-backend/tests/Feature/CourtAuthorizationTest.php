<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Court;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourtAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_courts(): void
    {
        $response = $this->getJson('/api/courts');

        $response->assertOk();
    }

    public function test_guest_cannot_create_courts(): void
    {
        $response = $this->postJson('/api/courts', []);

        $response->assertUnauthorized();
    }

    public function test_customer_cannot_create_courts(): void
    {
        $customer = User::factory()->make();
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/api/courts', [])
            ->assertForbidden();
    }

    public function test_admin_reaches_request_validation(): void
    {
        $admin = User::factory()->make();
        $admin->role = 'admin';

        $this->actingAs($admin)
            ->postJson('/api/courts', [])
            ->assertUnprocessable();
    }


    public function test_guest_cannot_update_courts(): void
    {
        $this->putJson('/api/courts/999999', [])
            ->assertUnauthorized();
    }

    public function test_guest_cannot_delete_courts(): void
    {
        $this->deleteJson('/api/courts/999999')
            ->assertUnauthorized();
    }


    public function test_customer_cannot_update_courts(): void
    {
        // Create a court fixture in the disposable practice database.
        $court = Court::factory()->create();

        // Simulate an authenticated customer.
        $customer = User::factory()->make();
        $customer->role = 'customer';

        // The customer must not be allowed to update the court.
        $this->actingAs($customer)
            ->putJson("/api/courts/{$court->id}", [])
            ->assertForbidden();
    }


    public function test_customer_cannot_delete_courts(): void
    {
        $customer = User::factory()->make();
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->deleteJson('/api/courts/999999')
            ->assertForbidden();
    }


    public function test_admin_reaches_update_validation(): void
    {
        // Create a court fixture.
        $court = Court::factory()->create();

        // Simulate an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Send an invalid update request.
        $this->actingAs($admin)
            ->putJson("/api/courts/{$court->id}", [])
            ->assertUnprocessable();
    }


    public function test_admin_can_access_delete_endpoint(): void
    {
        // Simulate an authenticated administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Use a nonexistent court ID to avoid deleting real data.
        $this->actingAs($admin)
            ->deleteJson('/api/courts/999999')
            ->assertNotFound();
    }

    public function test_admin_can_delete_existing_court(): void
    {
        // Simulate an authenticated administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Create the court to delete and an unrelated court to preserve.
        $courtToDelete = Court::factory()->create();
        $unrelatedCourt = Court::factory()->create();

        $this->assertDatabaseHas('courts', ['id' => $courtToDelete->id]);
        $this->assertDatabaseHas('courts', ['id' => $unrelatedCourt->id]);
        $this->assertDatabaseCount('courts', 2);

        // Delete only the selected court as an administrator.
        $this->actingAs($admin)
            ->deleteJson("/api/courts/{$courtToDelete->id}")
            ->assertOk();

        $this->assertDatabaseMissing('courts', ['id' => $courtToDelete->id]);
        $this->assertDatabaseHas('courts', ['id' => $unrelatedCourt->id]);
        $this->assertDatabaseCount('courts', 1);
    }

    public function test_guest_can_view_existing_court_details(): void
    {
        $court = Court::factory()->create([
            'name' => 'Guest View Test Court',
            'type' => 'Indoor',
            'hourly_rate' => 350.50,
            'status' => 'available',
            'location' => 'Demo Location',
            'amenities' => ['Parking', 'Lighting'],
            'opening_time' => '06:00:00',
            'closing_time' => '22:00:00',
            'operating_days' => ['Monday', 'Wednesday', 'Friday'],
            'image' => '/img/demo-court.jpg',
        ]);

        $this->getJson("/api/courts/{$court->id}")
            ->assertOk()
            ->assertJsonPath('id', $court->id)
            ->assertJsonPath('name', 'Guest View Test Court')
            ->assertJsonPath('type', 'Indoor')
            // DECIMAL(10, 2) values are commonly serialized as strings by MySQL.
            ->assertJsonPath('hourly_rate', '350.50')
            ->assertJsonPath('status', 'available')
            ->assertJsonPath('location', 'Demo Location')
            ->assertJsonPath('amenities', ['Parking', 'Lighting'])
            ->assertJsonPath('operating_days', ['Monday', 'Wednesday', 'Friday'])
            // MySQL TIME columns are serialized in HH:mm:ss format.
            ->assertJsonPath('opening_time', '06:00:00')
            ->assertJsonPath('closing_time', '22:00:00')
            ->assertJsonPath('image', '/img/demo-court.jpg');
    }

    public function test_guest_receives_not_found_for_nonexistent_court(): void
    {
        $this->getJson('/api/courts/999999')
            ->assertNotFound()
            ->assertJson(['message' => 'Court not found.']);
    }

    public function test_guest_can_view_multiple_courts(): void
    {
        $indoorCourt = Court::factory()->create([
            'name' => 'Indoor Listing Test Court',
            'type' => 'Indoor',
            'hourly_rate' => 350.50,
            'status' => 'available',
            'location' => 'North Hall',
            'amenities' => ['Parking', 'Restrooms'],
            'opening_time' => '06:00:00',
            'closing_time' => '22:00:00',
            'operating_days' => ['Monday', 'Wednesday'],
            'image' => '/img/indoor-test-court.jpg',
        ]);

        $outdoorCourt = Court::factory()->create([
            'name' => 'Outdoor Listing Test Court',
            'type' => 'Outdoor',
            'hourly_rate' => 275.25,
            'status' => 'unavailable',
            'location' => 'South Park',
            'amenities' => ['Lighting', 'Seating'],
            'opening_time' => '07:30:00',
            'closing_time' => '21:30:00',
            'operating_days' => ['Tuesday', 'Thursday', 'Saturday'],
            'image' => '/img/outdoor-test-court.jpg',
        ]);

        $this->getJson('/api/courts')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.id', $indoorCourt->id)
            ->assertJsonPath('0.name', 'Indoor Listing Test Court')
            ->assertJsonPath('0.type', 'Indoor')
            // MySQL DECIMAL(10, 2) values are serialized as strings.
            ->assertJsonPath('0.hourly_rate', '350.50')
            ->assertJsonPath('0.status', 'available')
            ->assertJsonPath('0.location', 'North Hall')
            ->assertJsonPath('0.amenities', ['Parking', 'Restrooms'])
            ->assertJsonPath('0.operating_days', ['Monday', 'Wednesday'])
            // MySQL TIME columns are serialized in HH:mm:ss format.
            ->assertJsonPath('0.opening_time', '06:00:00')
            ->assertJsonPath('0.closing_time', '22:00:00')
            ->assertJsonPath('0.image', '/img/indoor-test-court.jpg')
            ->assertJsonPath('1.id', $outdoorCourt->id)
            ->assertJsonPath('1.name', 'Outdoor Listing Test Court')
            ->assertJsonPath('1.type', 'Outdoor')
            ->assertJsonPath('1.hourly_rate', '275.25')
            ->assertJsonPath('1.status', 'unavailable')
            ->assertJsonPath('1.location', 'South Park')
            ->assertJsonPath('1.amenities', ['Lighting', 'Seating'])
            ->assertJsonPath('1.operating_days', ['Tuesday', 'Thursday', 'Saturday'])
            ->assertJsonPath('1.opening_time', '07:30:00')
            ->assertJsonPath('1.closing_time', '21:30:00')
            ->assertJsonPath('1.image', '/img/outdoor-test-court.jpg');
    }

    public function test_guest_can_view_empty_court_listing(): void
    {
        // RefreshDatabase isolates this test and leaves the courts table empty.
        $this->assertDatabaseCount('courts', 0);

        $this->getJson('/api/courts')
            ->assertOk()
            ->assertExactJson([]);
    }


}
