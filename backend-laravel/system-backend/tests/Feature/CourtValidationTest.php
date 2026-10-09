<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourtValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_create_court_with_invalid_hourly_rate(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare a court with an invalid hourly rate.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.999,
            'status' => 'available',
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['hourly_rate']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }


    public function test_admin_cannot_create_court_with_invalid_amenities(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data with an invalid amenity.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'amenities' => [
                'Parking',
                123,
                'Lighting',
            ],
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amenities.1']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }


    public function test_admin_cannot_create_court_with_associative_amenities(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data with associative amenities.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'amenities' => [
                'parking' => 'Available',
                'lighting' => 'Available',
            ],
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amenities']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }


    public function test_admin_cannot_create_court_with_invalid_opening_time(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data with an invalid opening time.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'opening_time' => '25:00',
            'closing_time' => '22:00',
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['opening_time']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }


    public function test_admin_cannot_create_court_with_invalid_closing_time(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data with an invalid closing time.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'opening_time' => '06:00',
            'closing_time' => '24:30',
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['closing_time']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }

    public function test_admin_cannot_create_court_with_invalid_operating_day(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data with an invalid weekday.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'operating_days' => [
                'Monday',
                'Holiday',
                'Friday',
            ],
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['operating_days.1']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }


    public function test_admin_cannot_create_court_with_duplicate_operating_days(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data containing duplicate weekdays.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'operating_days' => [
                'Monday',
                'Wednesday',
                'Monday',
            ],
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['operating_days.2']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }


    public function test_admin_cannot_create_court_with_invalid_image(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare court data with an image path exceeding 255 characters.
        $courtData = [
            'name' => 'Test Pickleball Court',
            'type' => 'indoor',
            'description' => 'Test court description',
            'hourly_rate' => 250.00,
            'status' => 'available',
            'image' => '/courts/' . str_repeat('a', 250) . '.jpg',
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['image']);

        // Verify that no court was created.
        $this->assertDatabaseCount('courts', 0);
    }

    public function test_admin_can_create_court_with_valid_details(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Prepare valid court data.
        $courtData = [
            'name' => 'PickleCourt Indoor 1',
            'type' => 'indoor',
            'description' => 'Indoor pickleball court',
            'hourly_rate' => 250.50,
            'status' => 'available',
            'location' => 'Cebu City',
            'amenities' => [
                'Parking',
                'Restroom',
                'Lighting',
            ],
            'opening_time' => '06:00',
            'closing_time' => '22:00',
            'operating_days' => [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
            ],
            'image' => '/courts/indoor-court-1.jpg',
        ];

        // Send the request as an administrator.
        $this->actingAs($admin)
            ->postJson('/api/courts', $courtData)
            ->assertSuccessful();

        // Verify that the court was saved.
        $this->assertDatabaseHas('courts', [
            'name' => 'PickleCourt Indoor 1',
            'type' => 'indoor',
            'location' => 'Cebu City',
            'hourly_rate' => 250.50,
            'status' => 'available',
            'image' => '/courts/indoor-court-1.jpg',
        ]);

        // Verify that exactly one court was created.
        $this->assertDatabaseCount('courts', 1);


        $court = \App\Models\Court::firstOrFail();

        // Verify that JSON arrays are correctly stored and cast.
        $this->assertSame(
            ['Parking', 'Restroom', 'Lighting'],
            $court->amenities
        );

        $this->assertSame(
            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            $court->operating_days
        );

        // Verify the stored operating times.
        $this->assertSame('06:00:00', $court->opening_time);
        $this->assertSame('22:00:00', $court->closing_time);

    }


    public function test_admin_can_update_court_with_valid_details(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Create an existing court.
        $court = \App\Models\Court::create([
            'name' => 'Original Court',
            'type' => 'outdoor',
            'description' => 'Original description',
            'hourly_rate' => 200.00,
            'status' => 'available',
        ]);

        // Prepare updated court details.
        $updatedData = [
            'name' => 'Updated Indoor Court',
            'type' => 'indoor',
            'description' => 'Updated court description',
            'hourly_rate' => 350.00,
            'status' => 'available',
            'location' => 'Cebu City',
            'amenities' => [
                'Parking',
                'Lighting',
            ],
            'opening_time' => '07:00',
            'closing_time' => '21:00',
            'operating_days' => [
                'Monday',
                'Wednesday',
                'Friday',
            ],
            'image' => '/courts/updated-court.jpg',
        ];

        // Send the update request as an administrator.
        $this->actingAs($admin)
            ->putJson("/api/courts/{$court->id}", $updatedData)
            ->assertSuccessful();

        // Reload the court from the database.
        $court->refresh();

        // Verify updated values.
        $this->assertSame('Updated Indoor Court', $court->name);
        $this->assertSame('indoor', $court->type);
        $this->assertSame('Cebu City', $court->location);

        $this->assertSame(
            ['Parking', 'Lighting'],
            $court->amenities
        );

        $this->assertSame(
            ['Monday', 'Wednesday', 'Friday'],
            $court->operating_days
        );

        $this->assertSame('07:00:00', $court->opening_time);
        $this->assertSame('21:00:00', $court->closing_time);
        $this->assertSame('/courts/updated-court.jpg', $court->image);

        // Verify no additional court was created.
        $this->assertDatabaseCount('courts', 1);
    }


    public function test_admin_cannot_update_court_with_invalid_details(): void
    {
        // Create an administrator.
        $admin = User::factory()->make();
        $admin->role = 'admin';

        // Create an existing court.
        $court = \App\Models\Court::create([
            'name' => 'Original Court',
            'type' => 'outdoor',
            'description' => 'Original description',
            'hourly_rate' => 200.00,
            'status' => 'available',
            'location' => 'Cebu City',
            'amenities' => ['Parking'],
        ]);

        // Prepare an update containing invalid data.
        $updatedData = [
            'name' => 'Updated Court',
            'type' => 'indoor',
            'description' => 'Updated description',
            'hourly_rate' => 350.999,
            'status' => 'available',
            'location' => 'Mandaue City',
            'amenities' => ['Lighting', 'Restroom'],
        ];

        // Attempt to update the court.
        $this->actingAs($admin)
            ->putJson("/api/courts/{$court->id}", $updatedData)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['hourly_rate']);

        // Reload the original court from the database.
        $court->refresh();

        // Verify the original data remains unchanged.
        $this->assertSame('Original Court', $court->name);
        $this->assertSame('outdoor', $court->type);
        $this->assertEquals(200.00, $court->hourly_rate);
        $this->assertSame('Cebu City', $court->location);
        $this->assertSame(['Parking'], $court->amenities);

        // Verify that no additional court was created.
        $this->assertDatabaseCount('courts', 1);
    }

}
