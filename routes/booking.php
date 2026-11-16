<?php

use App\Http\Controllers\BookingCalendarController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BookingManageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Booking API routes (Brief §4 — Phase 7 Booking Engine)
|--------------------------------------------------------------------------
|
| JSON endpoints only — Phase 9 (Public Website) builds the actual booking-page UI that calls these.
| `store` carries the `booking` rate limiter (10/hour/IP, Phase 4) since it's the sensitive,
| database-mutating action; `availability`/`quote` are read-only and share the general `api` limiter.
*/

Route::prefix('api/booking')
    ->name('booking.')
    ->group(function () {
        Route::middleware('throttle:api')->group(function () {
            Route::get('/availability', [BookingController::class, 'availability'])->name('availability');
            Route::post('/quote', [BookingController::class, 'quote'])->name('quote');
            Route::post('/hold', [BookingController::class, 'hold'])->name('hold');
            Route::delete('/hold', [BookingController::class, 'release'])->name('hold.release');
        });

        Route::post('/', [BookingController::class, 'store'])
            ->middleware('throttle:booking')
            ->name('store');

        // Authenticated owner (or bookings.manage) cancel/reschedule.
        Route::middleware(['auth', 'throttle:api'])->group(function () {
            Route::post('/{booking:code}/cancel', [BookingController::class, 'cancel'])->name('cancel');
            Route::post('/{booking:code}/reschedule', [BookingController::class, 'reschedule'])->name('reschedule');
        });
    });

/*
|--------------------------------------------------------------------------
| Guest magic-link booking management (Decision #21, Phase 3 → built here in Phase 7 sub-step 5)
|--------------------------------------------------------------------------
|
| Deliberately OUTSIDE the /api/booking prefix and its `auth` group above — this is the unauthenticated,
| signed-URL equivalent for guests, keyed on the booking's non-enumerable `code`. `signed` verifies the
| link hasn't been tampered with; `throttle:booking-manage` is defense in depth on top of that HMAC
| already making guessing infeasible.
*/
Route::prefix('booking/{booking:code}/manage')
    ->name('booking.manage.')
    ->middleware(['signed', 'throttle:booking-manage'])
    ->group(function () {
        Route::get('/', [BookingManageController::class, 'show'])->name('show');
        Route::post('/cancel', [BookingManageController::class, 'cancel'])->name('cancel');
        Route::post('/reschedule', [BookingManageController::class, 'reschedule'])->name('reschedule');
    });

/*
| Signed email page ("Confirm my booking" / "Reschedule"). Temporary signed URLs that expire when the
| appointment ends; GET never changes anything, the POSTs are throttled. See BookingLinkController.
*/
Route::prefix('b/{booking:code}')->name('booking.link.')->group(function () {
    Route::get('/', [\App\Http\Controllers\BookingLinkController::class, 'show'])->middleware('throttle:60,1')->name('show');
    Route::post('/slots', [\App\Http\Controllers\BookingLinkController::class, 'slots'])->middleware('throttle:60,1')->name('slots');
    Route::post('/confirm', [\App\Http\Controllers\BookingLinkController::class, 'confirm'])->middleware('throttle:10,1')->name('confirm');
    Route::post('/reschedule', [\App\Http\Controllers\BookingLinkController::class, 'reschedule'])->middleware('throttle:10,60')->name('reschedule');
});

Route::get('booking/{booking:code}/calendar.ics', [BookingCalendarController::class, 'ics'])
    ->middleware('signed')
    ->name('booking.calendar.ics');
