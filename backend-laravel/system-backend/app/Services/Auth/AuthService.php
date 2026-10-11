<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

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

        Auth::guard('web')->login($user);
        $this->request->session()->regenerate();

        return $user;
    }

    /**
     * @param array{email: string, password: string} $credentials
     */
    public function login(array $credentials): ?User
    {
        if (! Auth::guard('web')->attempt($credentials)) {
            return null;
        }

        $this->request->session()->regenerate();

        $user = Auth::guard('web')->user();

        return $user instanceof User ? $user : null;
    }

    public function logout(): void
    {
        Auth::guard('web')->logout();

        $this->request->session()->invalidate();
        $this->request->session()->regenerateToken();
    }

    public function currentUser(): User
    {
        $user = $this->request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException();
        }

        return $user;
    }
}
