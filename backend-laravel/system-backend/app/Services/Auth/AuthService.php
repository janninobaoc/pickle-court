<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\TransientToken;

class AuthService
{
    public function __construct(private readonly Request $request)
    {
    }

    /**
     * @param array{name: string, email: string, password: string} $attributes
     */
    public function register(array $attributes): User
    {
        $user = User::create([
            'name' => $attributes['name'],
            'email' => $attributes['email'],
            'password' => Hash::make($attributes['password']),
        ]);

        return $user;
    }

    /**
     * @param array{email: string, password: string} $credentials
     */
    public function login(array $credentials): ?User
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return null;
        }

        return $user;
    }

    public function logout(): void
    {
        $user = $this->request->user();

        if (!$user instanceof User) {
            return;
        }

        $currentAccessToken = $user->currentAccessToken();

        if ($currentAccessToken === null || $currentAccessToken instanceof TransientToken) {
            return;
        }

        $currentAccessToken->delete();
    }

    public function currentUser(): User
    {
        $user = $this->request->user();

        if (!$user instanceof User) {
            throw new AuthenticationException();
        }

        return $user;
    }
}
