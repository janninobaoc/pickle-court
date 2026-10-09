<?php

use App\Http\Controllers\CourtController;
use App\Http\Controllers\BookingController;
use Illuminate\Support\Facades\Route;


Route::prefix('/courts')->group(function () {
    Route::get('/', [CourtController::class, 'index'])->name('courts.index');
    Route::get('/{id}', [CourtController::class, 'show'])->name('courts.show');
});

Route::middleware(['auth:sanctum', 'can:manage-courts'])->group(function () {
    Route::prefix('/courts')->group(function () {
        Route::post('/', [CourtController::class, 'store'])->name('courts.store');
        Route::put('/{court}', [CourtController::class, 'update'])->name('courts.update');
        Route::delete('/{id}', [CourtController::class, 'destroy'])->name('courts.destroy');
    });
});

Route::prefix('/bookings')->group(function () {
    Route::get('/', [BookingController::class, 'index'])
        ->name('bookings.index');
    Route::get('/{id}', [BookingController::class, 'show'])
        ->name('bookings.show');
    Route::post('/', [BookingController::class, 'store'])
        ->name('bookings.store');
});