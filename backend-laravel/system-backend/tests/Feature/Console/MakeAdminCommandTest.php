<?php

namespace Tests\Feature\Console;

use App\Models\User;
use App\Support\TestingDatabaseSafety;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MakeAdminCommandTest extends TestCase
{
    private bool $testTransactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();

        TestingDatabaseSafety::assertSafe(app());
        $this->assertSame('array', config('session.driver'));
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

    public function test_existing_customer_can_be_promoted_and_role_is_persisted(): void
    {
        $customer = $this->makeUser('make-admin-customer@example.test');

        $this->artisan('user:make-admin', ['email' => $customer->email])
            ->assertSuccessful();

        $this->assertSame('admin', $customer->fresh()->role);
        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'email' => $customer->email,
            'role' => 'admin',
        ]);
    }

    public function test_nonexistent_user_returns_failure_and_does_not_create_a_user(): void
    {
        $usersBefore = User::count();

        $this->artisan('user:make-admin', ['email' => 'missing-user@example.test'])
            ->assertExitCode(1);

        $this->assertSame($usersBefore, User::count());
        $this->assertDatabaseMissing('users', ['email' => 'missing-user@example.test']);
    }

    public function test_already_administrator_returns_success_without_updating_user(): void
    {
        $admin = $this->makeUser('already-admin@example.test', 'admin');
        $updatedAt = $admin->fresh()->updated_at;
        $this->travel(1)->minutes();

        $this->artisan('user:make-admin', ['email' => $admin->email])
            ->assertSuccessful();

        $this->assertSame('admin', $admin->fresh()->role);
        $this->assertEquals($updatedAt, $admin->fresh()->updated_at);
    }

    public function test_missing_email_argument_is_rejected(): void
    {
        $this->expectException(\Symfony\Component\Console\Exception\RuntimeException::class);
        $this->expectExceptionMessage('Not enough arguments (missing: "email").');

        $this->artisan('user:make-admin');
    }

    public function test_registered_command_name_matches_signature(): void
    {
        $customer = $this->makeUser('user-command-name@example.test');

        $this->artisan('user:make-admin', ['email' => $customer->email])
            ->assertSuccessful();

        $this->assertSame('admin', $customer->fresh()->role);
    }

    public function test_unexpected_role_returns_failure_without_changing_the_user(): void
    {
        $user = $this->makeUser('unexpected-role@example.test', 'manager');

        $this->artisan('user:make-admin', ['email' => $user->email])
            ->assertExitCode(1);

        $this->assertSame('manager', $user->fresh()->role);
    }

    public function test_failed_save_returns_failure_and_does_not_persist_promotion(): void
    {
        $customer = $this->makeUser('failed-promotion@example.test');

        User::saving(function (User $user): ?bool {
            if ($user->isDirty('role') && $user->role === 'admin') {
                return false;
            }

            return null;
        });

        $this->artisan('user:make-admin', ['email' => $customer->email])
            ->assertExitCode(1);

        $this->assertSame('customer', $customer->fresh()->role);
    }

    public function test_role_is_not_mass_assignable(): void
    {
        $user = User::create([
            'name' => 'Mass Assignment Check',
            'email' => 'make-admin-mass-assignment@example.test',
            'password' => 'Correct-Horse-42!',
            'role' => 'admin',
        ]);

        $this->assertSame('customer', $user->role);
        $this->assertSame('customer', $user->fresh()->role);
    }

    public function test_registration_cannot_assign_administrator_role(): void
    {
        $response = $this->withHeader('Origin', 'http://localhost:3000')
            ->withCredentials()
            ->postJson('/api/register', [
            'name' => 'Registration Role Check',
            'email' => 'make-admin-registration@example.test',
            'password' => 'Correct-Horse-42!',
            'password_confirmation' => 'Correct-Horse-42!',
            'role' => 'admin',
            ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'customer');

        $this->assertDatabaseHas('users', [
            'email' => 'make-admin-registration@example.test',
            'role' => 'customer',
        ]);
    }

    private function makeUser(string $email, string $role = 'customer'): User
    {
        return User::factory()->create([
            'email' => $email,
            'role' => $role,
        ]);
    }
}
