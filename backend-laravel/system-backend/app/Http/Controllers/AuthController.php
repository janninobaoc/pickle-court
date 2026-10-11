<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\Auth\UserResource;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, AuthService $authService): JsonResponse
    {
        $user = $authService->register($request->validated());

        return response()->json([
            'message' => 'Registration successful.',
            'user' => UserResource::make($user)->resolve($request),
        ], 201);
    }

    public function login(LoginRequest $request, AuthService $authService): JsonResponse
    {
        $user = $authService->login($request->validated());

        if ($user === null) {
            return response()->json([
                'message' => 'Invalid email or password.',
            ], 401);
        }

        return response()->json([
            'message' => 'Login successful.',
            'user' => UserResource::make($user)->resolve($request),
        ]);
    }

    public function logout(AuthService $authService): JsonResponse
    {
        $authService->logout();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }

    public function user(AuthService $authService): JsonResponse
    {
        return response()->json([
            'user' => UserResource::make($authService->currentUser())->resolve(),
        ]);
    }
}
