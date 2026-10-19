<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CourtController;
use App\Http\Controllers\BookingController;
use Illuminate\Support\Facades\Route;


Route::prefix('/courts')->group(function () {
    Route::get('/', [CourtController::class, 'index'])->name('courts.index');
    Route::get('/{id}/availability', [CourtController::class, 'availability'])
        ->whereNumber('id')
        ->name('courts.availability');
    Route::get('/{id}', [CourtController::class, 'show'])->name('courts.show');
});

Route::middleware(['auth:sanctum', 'can:manage-courts'])->group(function () {
    Route::prefix('/courts')->group(function () {
        Route::post('/', [CourtController::class, 'store'])->name('courts.store');
        Route::put('/{court}', [CourtController::class, 'update'])->name('courts.update');
        Route::delete('/{id}', [CourtController::class, 'destroy'])->name('courts.destroy');
    });
});

Route::middleware('auth:sanctum')->prefix('/bookings')->group(function () {
    Route::get('/', [BookingController::class, 'index'])->name('bookings.index');
    Route::get('/{id}/availability', [BookingController::class, 'availability'])
        ->whereNumber('id')
        ->name('bookings.availability');
    Route::get('/{id}', [BookingController::class, 'show'])->name('bookings.show');
    Route::post('/', [BookingController::class, 'store'])->name('bookings.store');
    Route::delete('/{id}', [BookingController::class, 'destroy'])->name('bookings.destroy');
    Route::patch('/{id}/reschedule', [BookingController::class, 'reschedule'])->name('bookings.reschedule');
});


Route::middleware('throttle:6,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])
        ->name('auth.register');

    Route::post('/login', [AuthController::class, 'login'])
        ->name('auth.login');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('auth.logout');

    Route::get('/user', [AuthController::class, 'user'])
        ->name('auth.user');
});

Route::prefix('admin')->middleware(['auth:sanctum', 'can:access-admin-api'])->group(function () {
    Route::prefix('courts')->group(function () {
        Route::get('/', [CourtController::class, 'index'])
            ->name('admin.courts.index');

        Route::get('/{id}', [CourtController::class, 'show'])
            ->whereNumber('id')
            ->name('admin.courts.show');

        Route::post('/', [CourtController::class, 'store'])
            ->name('admin.courts.store');

        Route::put('/{court}', [CourtController::class, 'update'])
            ->name('admin.courts.update');

        Route::delete('/{id}', [CourtController::class, 'destroy'])
            ->name('admin.courts.destroy');
    });
});

