<?php

use App\Http\Controllers\Auth\AdminVerifyController;
use App\Http\Controllers\Auth\InviteAcceptController;
use App\Http\Controllers\SessionsController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Auth-adjacent routes (Phase 3)
|--------------------------------------------------------------------------
|
| Fortify itself registers /login, /register, /logout, /forgot-password, /reset-password,
| /email/verify, /user/confirm-password, /user/two-factor-authentication, etc. — these are the
| pieces the Brief asks for that Fortify does not provide out of the box.
*/

// Phase 5 sub-step 4: signed admin-invite acceptance. `guest`-only (an already-authenticated user
// accepting someone else's invite would be a confusing account-mixing edge case, not a real use
// case) + `signed` (rejects a tampered/expired link before the controller ever runs). GET and POST
// share the exact same path/name-prefix so the signature — tied to path+query, not HTTP method —
// validates identically for both; the accept form POSTs back to the current (still-signed) URL.
Route::middleware(['guest', 'signed'])->group(function () {
    Route::get('/invite/accept', [InviteAcceptController::class, 'show'])->name('invite.accept.show');
    Route::post('/invite/accept', [InviteAcceptController::class, 'store'])->name('invite.accept.store');
});

// Admin sign-in, email step (code + approve link). Pending state lives in the session, so these routes are
// open to guests; the code/approve checks and the throttles are what protect them.
Route::get('/admin-verify', [AdminVerifyController::class, 'show'])->name('admin-verify.show');
Route::post('/admin-verify', [AdminVerifyController::class, 'verify'])->middleware('throttle:admin-verify')->name('admin-verify.verify');
Route::post('/admin-verify/resend', [AdminVerifyController::class, 'resend'])->middleware('throttle:admin-verify-resend')->name('admin-verify.resend');
Route::post('/admin-verify/cancel', [AdminVerifyController::class, 'cancel'])->name('admin-verify.cancel');
Route::get('/admin-verify/approve/{token}', [AdminVerifyController::class, 'approve'])->middleware(['signed', 'throttle:admin-verify'])->name('admin-verify.approve');

Route::middleware('auth')->group(function () {
    Route::get('/two-factor-setup', fn () => Inertia::render('Auth/TwoFactorSetup'))
        ->name('two-factor.setup');

    Route::get('/user/sessions', [SessionsController::class, 'index'])->name('sessions.index');
    Route::delete('/user/sessions/other', [SessionsController::class, 'destroyOthers'])
        ->name('sessions.destroy-others');
});
