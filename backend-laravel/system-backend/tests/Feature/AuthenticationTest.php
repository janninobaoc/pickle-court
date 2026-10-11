<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    private bool $testTransactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();

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
        $response = $this->postSpaJson('/api/register', $this->validRegistration());

        $response->assertCreated()
            ->assertJsonPath('message', 'Registration successful.');

        $this->assertUserPayloadKeys($response->json('user'));
        $this->assertDatabaseHas('users', ['email' => 'auth-register@example.test']);
    }

    public function test_registration_stores_a_hashed_password(): void
    {
        $password = 'Correct-Horse-42!';
        $this->postSpaJson('/api/register', $this->validRegistration(['password' => $password, 'password_confirmation' => $password]))
            ->assertCreated();

        $storedPassword = DB::table('users')->where('email', 'auth-register@example.test')->value('password');

        $this->assertIsString($storedPassword);
        $this->assertNotSame($password, $storedPassword);
        $this->assertTrue(Hash::check($password, $storedPassword));
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'duplicate@example.test']);

        $this->postSpaJson('/api/register', $this->validRegistration(['email' => 'duplicate@example.test']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_registration_rejects_invalid_input(): void
    {
        $this->postSpaJson('/api/register', [
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

        $this->postSpaJson('/api/register', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_registration_ignores_client_supplied_administrator_role(): void
    {
        $this->postSpaJson('/api/register', $this->validRegistration(['role' => 'admin']))
            ->assertCreated();

        $user = User::where('email', 'auth-register@example.test')->firstOrFail();
        $this->assertSame('customer', $user->role);
    }

    public function test_valid_credentials_return_ok_and_only_safe_user_fields(): void
    {
        $user = $this->makeUser('login-success@example.test', 'Correct-Horse-42!');

        $response = $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ]);

        $response->assertOk()->assertJsonPath('message', 'Login successful.');
        $this->assertUserPayloadKeys($response->json('user'));
    }

    public function test_invalid_credentials_return_unauthorized(): void
    {
        $user = $this->makeUser('login-failure@example.test', 'Correct-Horse-42!');

        $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'incorrect-password',
        ])->assertUnauthorized();
    }

    public function test_login_authenticates_the_web_session_guard(): void
    {
        $user = $this->makeUser('login-guard@example.test', 'Correct-Horse-42!');

        $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_login_rotates_an_existing_session_id(): void
    {
        $user = $this->makeUser('login-session@example.test', 'Correct-Horse-42!');
        $sessionCookieName = config('session.cookie');
        $oldSessionId = 'known-pre-auth-session-id';

        $response = $this->withCookie($sessionCookieName, $oldSessionId)
            ->postSpaJson('/api/login', [
                'email' => $user->email,
                'password' => 'Correct-Horse-42!',
            ]);

        $response->assertOk();
        $newSessionCookie = $response->getCookie($sessionCookieName);

        $this->assertNotNull($newSessionCookie, 'Login should return the rotated session cookie.');
        $this->assertNotSame($oldSessionId, $newSessionCookie->getValue());
    }

    public function test_authenticated_user_endpoint_returns_the_current_user(): void
    {
        $user = $this->makeUser('current-user@example.test', 'Correct-Horse-42!');
        $login = $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();

        $cookie = $login->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie, 'Login should return a session cookie.');

        $response = $this->withCookie($cookie->getName(), $cookie->getValue())
            ->getSpaJson('/api/user');

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email);
        $this->assertUserPayloadKeys($response->json('user'));
    }

    public function test_unauthenticated_user_endpoint_returns_unauthorized(): void
    {
        $this->getSpaJson('/api/user')->assertUnauthorized();
    }

    public function test_user_response_contains_exactly_the_allowed_fields(): void
    {
        $user = $this->makeUser('user-fields@example.test', 'Correct-Horse-42!');
        $login = $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();
        $cookie = $login->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);

        $response = $this->withCookie($cookie->getName(), $cookie->getValue())->getSpaJson('/api/user');

        $response->assertOk();
        $this->assertUserPayloadKeys($response->json('user'));
    }

    public function test_logout_succeeds_and_invalidates_authentication(): void
    {
        $user = $this->makeUser('logout@example.test', 'Correct-Horse-42!');
        $login = $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();
        $cookie = $login->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);

        $logout = $this->withCookie($cookie->getName(), $cookie->getValue())
            ->postSpaJson('/api/logout');

        $logout->assertOk()->assertJsonPath('message', 'Logout successful.');
        $rotatedCookie = $logout->getCookie(config('session.cookie'));
        $this->assertNotNull($rotatedCookie, 'Logout should return the post-invalidation session cookie.');

        $this->app['auth']->forgetGuards();

        $this->withCookie($rotatedCookie->getName(), $rotatedCookie->getValue())
            ->getSpaJson('/api/user')
            ->assertUnauthorized();
    }

    public function test_cookie_session_authentication_works_without_a_bearer_token(): void
    {
        $user = $this->makeUser('cookie-only@example.test', 'Correct-Horse-42!');
        $login = $this->postSpaJson('/api/login', [
            'email' => $user->email,
            'password' => 'Correct-Horse-42!',
        ])->assertOk();
        $cookie = $login->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);

        $response = $this->withCookie($cookie->getName(), $cookie->getValue())
            ->getSpaJson('/api/user');

        $response->assertOk()->assertJsonPath('user.id', $user->id);
        $this->assertUserPayloadKeys($response->json('user'));
    }

    public function test_registration_rotates_an_existing_session_id(): void
    {
        $sessionCookieName = config('session.cookie');
        $oldSessionId = 'known-pre-registration-session-id';

        $response = $this->withCookie($sessionCookieName, $oldSessionId)
            ->postSpaJson('/api/register', $this->validRegistration());

        $response->assertCreated();
        $newSessionCookie = $response->getCookie($sessionCookieName);

        $this->assertNotNull($newSessionCookie, 'Registration should return the rotated session cookie.');
        $this->assertNotSame($oldSessionId, $newSessionCookie->getValue());
    }

    private function postSpaJson(string $uri, array $data = [])
    {
        return $this->withHeader('Origin', 'http://localhost:3000')
            ->withCredentials()
            ->postJson($uri, $data);
    }

    private function getSpaJson(string $uri)
    {
        return $this->withHeader('Origin', 'http://localhost:3000')
            ->withCredentials()
            ->getJson($uri);
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
        $this->assertSame(['id', 'name', 'email'], array_keys($user));
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
