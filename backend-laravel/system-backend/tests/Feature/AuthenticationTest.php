<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\TestingDatabaseSafety;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    private bool $testTransactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();

        TestingDatabaseSafety::assertSafe(app());
        $this->assertSafeTestDatabase();
        $this->assertSame('array', config('session.driver'), 'Feature tests must not persist sessions in MySQL.');
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

    public function test_registration_returns_created_and_a_safe_user_payload(): void
    {
        $response = $this->postJson('/api/register', $this->validRegistration());

        $response->assertCreated()
            ->assertJsonPath('message', 'Registration successful.')
            ->assertJsonPath('user.role', 'customer');

        $token = $response->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', trim($token));

        $this->assertUserPayloadKeys($response->json('user'));
        $this->assertDatabaseHas('users', ['email' => 'auth-register@example.test']);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.email', 'auth-register@example.test');
    }

    public function test_registration_stores_a_hashed_password(): void
    {
        $password = 'Correct-Horse-42!';
        $this->postJson('/api/register', $this->validRegistration(['password' => $password, 'password_confirmation' => $password]))
            ->assertCreated();

        $storedPassword = DB::table('users')->where('email', 'auth-register@example.test')->value('password');

        $this->assertIsString($storedPassword);
        $this->assertNotSame($password, $storedPassword);
        $this->assertTrue(Hash::check($password, $storedPassword));
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'duplicate@example.test']);

        $this->postJson('/api/register', $this->validRegistration(['email' => 'duplicate@example.test']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_registration_rejects_invalid_input(): void
    {
        $this->postJson('/api/register', [
            'name' => '',
            'email' => 'not-an-email',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_registration_requires_password_confirmation(): void
    {
        $payload = $this->validRegistration();
        unset($payload['password_confirmation']);

        $this->postJson('/api/register', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_registration_ignores_client_supplied_administrator_role(): void
    {
        $response = $this->postJson('/api/register', $this->validRegistration(['role' => 'admin']));

        $response->assertCreated()
            ->assertJsonPath('user.role', 'customer');

        $user = User::where('email', 'auth-register@example.test')->firstOrFail();
        $this->assertSame('customer', $user->role);
    }

    public function test_role_is_not_mass_assignable(): void
    {
        $user = User::create([
            'name' => 'Mass Assignment Check',
            'email' => 'mass-assignment@example.test',
            'password' => 'Correct-Horse-42!',
            'role' => 'admin',
        ]);

        $this->assertSame('customer', $user->role);
        $this->assertSame('customer', $user->fresh()->role);
    }

    public function test_valid_credentials_return_ok_and_only_safe_user_fields(): void
    {
        $user = $this->makeUser('login-success@example.test', 'Correct-Horse-42!');

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ]);

        $response->assertOk()->assertJsonPath('message', 'Login successful.');
        $this->assertUserPayloadKeys($response->json('user'));
        $this->assertSame('customer', $response->json('user.role'));

        $token = $response->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', trim($token));

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_administrator_login_returns_the_administrator_role(): void
    {
        $admin = $this->makeUser('admin-login@example.test', 'Correct-Horse-42!');
        $admin->role = 'admin';
        $admin->save();

        $this->assertSame('admin', User::query()->findOrFail($admin->id)->role);

        $response = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'Correct-Horse-42!',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Login successful.')
            ->assertJsonPath('user.role', 'admin');
        $this->assertUserPayloadKeys($response->json('user'));
    }

    public function test_invalid_credentials_return_unauthorized(): void
    {
        $user = $this->makeUser('login-failure@example.test', 'Correct-Horse-42!');

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'incorrect-password',
        ])->assertUnauthorized();
    }

    public function test_authenticated_user_endpoint_returns_the_current_user(): void
    {
        $user = $this->makeUser('current-user@example.test', 'Correct-Horse-42!');

        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();

        $token = $login->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', trim($token));

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/user');

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.role', 'customer');

        $this->assertUserPayloadKeys($response->json('user'));
    }

    public function test_bearer_token_expires_at_the_24_hour_boundary(): void
    {
        $createdAt = now()->startOfSecond();
        $this->travelTo($createdAt);

        $user = $this->makeUser('token-expiration@example.test', 'Correct-Horse-42!');
        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();

        $token = $login->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', trim($token));

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);

        $this->app['auth']->forgetGuards();

        $this->travelTo($createdAt->copy()->addMinutes(1440), function () use ($token): void {
            $this->withHeader('Authorization', 'Bearer ' . $token)
                ->getJson('/api/user')
                ->assertUnauthorized();
        });
    }

    public function test_unauthenticated_user_endpoint_returns_unauthorized(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_logout_revokes_only_the_current_bearer_token(): void
    {
        $user = $this->makeUser('logout@example.test', 'Correct-Horse-42!');
        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();

        $currentToken = $login->json('token');
        $this->assertIsString($currentToken);
        $this->assertNotSame('', trim($currentToken));

        $otherToken = $user->createToken('other-auth-token')->plainTextToken;

        $logout = $this->withHeader('Authorization', 'Bearer ' . $currentToken)
            ->postJson('/api/logout');

        $logout->assertOk()->assertJsonPath('message', 'Logout successful.');

        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer ' . $currentToken)
            ->getJson('/api/user')
            ->assertUnauthorized();

        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer ' . $otherToken)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    private function validRegistration(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Authentication Test User',
            'email' => 'auth-register@example.test',
            'password' => 'Correct-Horse-42!',
            'password_confirmation' => 'Correct-Horse-42!',
        ], $overrides);
    }

    private function makeUser(string $email, string $password): User
    {
        return User::factory()->create([
            'email' => $email,
            'password' => $password,
        ]);
    }

    private function assertUserPayloadKeys(?array $user): void
    {
        $this->assertIsArray($user);
        $this->assertSame(['id', 'name', 'email', 'role'], array_keys($user));
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
