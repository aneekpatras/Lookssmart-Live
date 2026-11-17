<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AdminLoginChallengeService;
use App\Support\SecurityLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** The email step of admin sign-in: enter the 6-digit code, resend it, or approve through the emailed link. */
class AdminVerifyController extends Controller
{
    public function __construct(private readonly AdminLoginChallengeService $challenges) {}

    public function show(Request $request): Response|RedirectResponse
    {
        $pending = $this->challenges->pending($request);

        if (! $pending) {
            return redirect('/login')->withErrors(['email' => 'Your sign-in expired. Please log in again.']);
        }

        $email = (string) $pending['user']->email;
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return Inertia::render('Auth/AdminVerify', [
            'email' => Str::substr($local, 0, 1) . str_repeat('*', max(2, strlen($local) - 1)) . '@' . $domain,
            'expiresInMinutes' => AdminLoginChallengeService::TTL_MINUTES,
            'cooldownSeconds' => AdminLoginChallengeService::RESEND_COOLDOWN_SECONDS,
            'status' => $request->session()->get('status'),
        ]);
    }

    public function verify(Request $request): SymfonyResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'regex:/^\s*\d{6}\s*$/']], [
            'code.regex' => 'Enter the 6-digit code from the email.',
        ]);

        $pending = $this->challenges->pending($request);

        if (! $pending) {
            return redirect('/login')->withErrors(['email' => 'Your sign-in expired. Please log in again.']);
        }

        return match ($this->challenges->verifyCode($pending['challenge'], $data['code'])) {
            'ok' => $this->challenges->complete($request, $pending),
            'wrong' => back()->withErrors(['code' => 'That code is not correct.']),
            default => $this->expired($request, 'This code is no longer valid. Please log in again to get a new one.'),
        };
    }

    public function resend(Request $request): RedirectResponse
    {
        return match ($this->challenges->resend($request)) {
            'sent' => back()->with('status', 'A new code has been sent.'),
            'cooldown' => back()->withErrors(['code' => 'Please wait a minute before asking for another code.']),
            'limit' => back()->withErrors(['code' => 'Too many codes requested. Try again in an hour.']),
            'failed' => $this->expired($request, 'We could not email your sign-in code. Please try again in a moment.'),
            default => redirect('/login')->withErrors(['email' => 'Your sign-in expired. Please log in again.']),
        };
    }

    /** Signed link from the email. Only works in the browser session that started the sign-in. */
    public function approve(Request $request, string $token): SymfonyResponse
    {
        $pending = $this->challenges->tokenMatchesSession($request, $token);

        if (! $pending) {
            return Inertia::render('Auth/AdminVerify', [
                'email' => null,
                'expiresInMinutes' => AdminLoginChallengeService::TTL_MINUTES,
                'cooldownSeconds' => AdminLoginChallengeService::RESEND_COOLDOWN_SECONDS,
                'status' => null,
                'wrongBrowser' => true,
            ])->toResponse($request);
        }

        SecurityLog::record('admin_code_approved', $request, $pending['user']->id);

        return $this->challenges->complete($request, $pending);
    }

    public function cancel(Request $request): RedirectResponse
    {
        $this->challenges->cancel($request);

        return redirect('/login');
    }

    private function expired(Request $request, string $message): RedirectResponse
    {
        $this->challenges->cancel($request);

        return redirect('/login')->withErrors(['email' => $message]);
    }
}
