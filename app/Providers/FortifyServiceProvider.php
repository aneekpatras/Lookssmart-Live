<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Actions\Fortify\UpdateUserPassword;
use App\Actions\Fortify\UpdateUserProfileInformation;
use App\Http\Responses\GenericResetLinkResponse;
use App\Http\Responses\LoginResponse;
use App\Models\User;
use App\Support\Phone;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use App\Http\Responses\LogoutResponse;
use App\Http\Responses\TwoFactorLoginResponse;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Laravel\Fortify\Contracts\LogoutResponse as LogoutResponseContract;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse as TwoFactorLoginResponseContract;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(LoginResponseContract::class, LoginResponse::class);
        $this->app->singleton(FailedPasswordResetLinkRequestResponse::class, GenericResetLinkResponse::class);
        $this->app->singleton(SuccessfulPasswordResetLinkRequestResponse::class, GenericResetLinkResponse::class);
        $this->app->singleton(LogoutResponseContract::class, LogoutResponse::class);
        $this->app->singleton(TwoFactorLoginResponseContract::class, TwoFactorLoginResponse::class);
    }

    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);

        // One login field: an email (contains "@") or a phone number, normalised to digits with country code.
        // The input is still posted as "email" so the form, throttling and error keys stay the same.
        Fortify::authenticateUsing(function (Request $request) {
            $identifier = trim((string) $request->input(Fortify::username()));
            $password = (string) $request->input('password');

            $user = str_contains($identifier, '@')
                ? User::where('email', $identifier)->first()
                : ((Phone::accountsSupported() && ($phone = Phone::normalize($identifier))) ? User::where('phone', $phone)->first() : null);

            // The same generic failure whether or not the account exists.
            if ($user && Hash::check($password, $user->password)) {
                return $user;
            }

            return null;
        });

        Fortify::loginView(function (Request $request) {
            // The header's login link passes the page the visitor was on; send them back there after
            // signing in. Same-site paths only (no "//host", no auth pages).
            $from = (string) $request->query('from', '');
            if ($from !== '' && str_starts_with($from, '/') && ! str_starts_with($from, '//')
                && ! preg_match('#^/(login|register|forgot-password|reset-password|logout)#', $from)) {
                $request->session()->put('url.intended', url($from));
            }

            return Inertia::render('Auth/Login');
        });
        Fortify::registerView(fn () => Inertia::render('Auth/Register'));
        Fortify::requestPasswordResetLinkView(fn () => Inertia::render('Auth/ForgotPassword'));
        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('Auth/ResetPassword', [
            'email' => $request->email,
            'token' => $request->route('token'),
        ]));
        Fortify::verifyEmailView(fn () => Inertia::render('Auth/VerifyEmail'));
        Fortify::confirmPasswordView(fn () => Inertia::render('Auth/ConfirmPassword'));
        Fortify::twoFactorChallengeView(fn () => Inertia::render('Auth/TwoFactorChallenge'));

        // 5 login attempts per minute per email+IP.
        RateLimiter::for('login', function (Request $request) {
            $identifier = trim((string) $request->input(Fortify::username()));
            $key = str_contains($identifier, '@') ? mb_strtolower($identifier) : (Phone::normalize($identifier) ?? $identifier);

            return Limit::perMinute(5)->by($key . '|' . $request->ip());
        });

        // Admin email step: per pending user + IP, so one admin's typos never lock another out.
        RateLimiter::for('admin-verify', function (Request $request) {
            return Limit::perMinute(10)->by(($request->session()->get('admin_login.user_id') ?? 'none') . '|' . $request->ip());
        });
        RateLimiter::for('admin-verify-resend', function (Request $request) {
            return Limit::perMinute(3)->by(($request->session()->get('admin_login.user_id') ?? 'none') . '|' . $request->ip());
        });

        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });
    }
}
