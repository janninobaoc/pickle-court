<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\User;
use App\Support\TestingDatabaseSafety;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminCourtAuthorizationTest extends TestCase
{
    private bool $testTransactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();

        TestingDatabaseSafety::assertSafe(app());
        $this->assertSame('testing', app()->environment());
        $this->assertSame('mysql', config('database.default'));
        $this->assertSame('system_backend_test', config('database.connections.mysql.database'));
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

    public function test_guest_receives_unauthorized_for_all_admin_court_endpoints(): void
    {
        $court = Court::factory()->create();

        $this->getJson('/api/admin/courts')->assertUnauthorized();
        $this->getJson("/api/admin/courts/{$court->id}")->assertUnauthorized();
        $this->postJson('/api/admin/courts', $this->validCourtPayload())->assertUnauthorized();
        $this->putJson("/api/admin/courts/{$court->id}", $this->validCourtPayload())->assertUnauthorized();
        $this->deleteJson("/api/admin/courts/{$court->id}")->assertUnauthorized();
    }

    public function test_customer_receives_forbidden_for_all_admin_court_endpoints(): void
    {
        $court = Court::factory()->create();
        $customer = User::factory()->make();
        $customer->role = 'customer';

        $this->actingAs($customer)->getJson('/api/admin/courts')->assertForbidden();
        $this->getJson("/api/admin/courts/{$court->id}")->assertForbidden();
        $this->postJson('/api/admin/courts', $this->validCourtPayload())->assertForbidden();
        $this->putJson("/api/admin/courts/{$court->id}", $this->validCourtPayload())->assertForbidden();
        $this->deleteJson("/api/admin/courts/{$court->id}")->assertForbidden();
    }

    public function test_user_with_unexpected_role_is_denied_for_all_admin_court_endpoints(): void
    {
        $court = Court::factory()->create();
        $user = User::factory()->make();
        $user->role = 'manager';

        $this->actingAs($user)->getJson('/api/admin/courts')->assertForbidden();
        $this->getJson("/api/admin/courts/{$court->id}")->assertForbidden();
        $this->postJson('/api/admin/courts', $this->validCourtPayload())->assertForbidden();
        $this->putJson("/api/admin/courts/{$court->id}", $this->validCourtPayload())->assertForbidden();
        $this->deleteJson("/api/admin/courts/{$court->id}")->assertForbidden();
    }

    public function test_administrator_can_list_active_and_inactive_courts(): void
    {
        $activeCourt = Court::factory()->create([
            'name' => 'Admin API active court',
            'status' => 'available',
        ]);
        $inactiveCourt = Court::factory()->create([
            'name' => 'Admin API inactive court',
            'status' => 'unavailable',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/courts')
            ->assertOk()
            ->assertJsonFragment(['id' => $activeCourt->id, 'name' => $activeCourt->name])
            ->assertJsonFragment(['id' => $inactiveCourt->id, 'name' => $inactiveCourt->name]);
    }

    public function test_administrator_can_retrieve_court_details(): void
    {
        $court = Court::factory()->create([
            'name' => 'Admin API detail court',
            'status' => 'unavailable',
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/admin/courts/{$court->id}")
            ->assertOk()
            ->assertJsonPath('id', $court->id)
            ->assertJsonPath('name', $court->name)
            ->assertJsonPath('status', 'unavailable');
    }

    public function test_administrator_can_create_a_court(): void
    {
        $payload = $this->validCourtPayload(['name' => 'Admin API created court']);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/courts', $payload)
            ->assertCreated();

        $this->assertDatabaseHas('courts', [
            'name' => 'Admin API created court',
            'type' => 'Indoor',
            'hourly_rate' => '325.50',
            'status' => 'available',
        ]);
    }

    public function test_administrator_can_update_a_court(): void
    {
        $court = Court::factory()->create(['name' => 'Admin API before update']);
        $payload = $this->validCourtPayload([
            'name' => 'Admin API updated court',
            'status' => 'unavailable',
        ]);

        $this->actingAs($this->admin())
            ->putJson("/api/admin/courts/{$court->id}", $payload)
            ->assertOk()
            ->assertJsonPath('data.name', 'Admin API updated court');

        $this->assertDatabaseHas('courts', [
            'id' => $court->id,
            'name' => 'Admin API updated court',
            'status' => 'unavailable',
        ]);
    }

    public function test_administrator_can_delete_a_court(): void
    {
        $court = Court::factory()->create(['name' => 'Admin API deleted court']);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/courts/{$court->id}")
            ->assertOk();

        $this->assertDatabaseMissing('courts', ['id' => $court->id]);
    }

    private function admin(): User
    {
        $admin = User::factory()->make();
        $admin->role = 'admin';

        return $admin;
    }

    /** @return array<string, mixed> */
    private function validCourtPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Admin API valid court',
            'type' => 'Indoor',
            'description' => 'Court used by admin API authorization tests.',
            'hourly_rate' => 325.50,
            'status' => 'available',
            'location' => 'Test location',
            'amenities' => ['Lighting', 'Seating'],
            'opening_time' => '06:00',
            'closing_time' => '22:00',
            'operating_days' => ['Monday', 'Wednesday', 'Friday'],
            'image' => '/courts/admin-api-test.jpg',
        ], $overrides);
    }
}
