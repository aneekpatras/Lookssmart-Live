<?php

namespace App\Services;

use App\Models\AdminLoginChallenge;
use App\Models\User;
use App\Notifications\AdminSignInCode;
use App\Support\ClientIp;
use App\Support\SecurityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Email step for admin sign-in. After the password is accepted the user is NOT logged in: a challenge is
 * stored (hashes only), the code and an approve link are emailed, and the pending state lives in the session
 * for 10 minutes. Whoever enters the code in that browser (or opens the approve link in it) completes login.
 */
class AdminLoginChallengeService
{
    public const TTL_MINUTES = 10;

    public const RESEND_COOLDOWN_SECONDS = 60;

    public const MAX_SENDS_PER_HOUR = 5;

    public const ADMIN_ROLES = ['super-admin', 'admin', 'receptionist', 'staff'];

    private const SESSION_KEY = 'admin_login';

    public function isRequiredFor(User $user): bool
    {
        if (! config('auth.admin_email_2fa') || ! $user->email || ! $user->hasAnyRole(self::ADMIN_ROLES)) {
            return false;
        }

        try {
            return Schema::hasTable('admin_login_challenges');
        } catch (\Throwable) {
            return false;
        }
    }

    /** HMAC with the app key, so a database leak does not reveal codes, tokens or session secrets. */
    private function hash(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    /**
     * Create the challenge, remember it in the session and send the email. Returns false (and leaves nothing
     * behind) when the email could not be sent.
     */
    public function start(Request $request, User $user, bool $remember): bool
    {
        $request->session()->regenerate();

        $secret = Str::random(40);
        $request->session()->put(self::SESSION_KEY, [
            'user_id' => $user->id,
            'remember' => $remember,
            'secret' => $secret,
            'expires_at' => now()->addMinutes(self::TTL_MINUTES)->timestamp,
        ]);

        return $this->issue($request, $user, $secret, 1);
    }

    private function issue(Request $request, User $user, string $secret, int $sentCount): bool
    {
        // Any earlier open challenge for this user is replaced.
        AdminLoginChallenge::where('user_id', $user->id)->whereNull('used_at')->update(['used_at' => now()]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = Str::random(40);

        $challenge = AdminLoginChallenge::create([
            'user_id' => $user->id,
            'code_hash' => $this->hash($code),
            'token_hash' => $this->hash($token),
            'session_hash' => $this->hash($secret),
            'attempts' => 0,
            'sent_count' => $sentCount,
            'expires_at' => now()->addMinutes(self::TTL_MINUTES),
            'ip' => ClientIp::get($request),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
        ]);

        try {
            $approve = URL::temporarySignedRoute('admin-verify.approve', now()->addMinutes(self::TTL_MINUTES), ['token' => $token]);

            Notification::route('mail', $user->email)->notifyNow(new AdminSignInCode(
                $code,
                $approve,
                now()->timezone(config('app.timezone'))->format('j M Y, H:i') . ' (' . config('app.timezone') . ')',
                (string) ClientIp::get($request),
                Str::limit((string) $request->userAgent(), 120, '') ?: 'Unknown',
            ));
        } catch (\Throwable $e) {
            report($e);
            $challenge->delete();
            $request->session()->forget(self::SESSION_KEY);

            return false;
        }

        SecurityLog::record('admin_code_sent', $request, $user->id, (string) $user->email);

        return true;
    }

    /** @return array{user: User, challenge: AdminLoginChallenge, remember: bool}|null The pending sign-in for this browser session. */
    public function pending(Request $request): ?array
    {
        $state = $request->session()->get(self::SESSION_KEY);

        if (! is_array($state) || ($state['expires_at'] ?? 0) < now()->timestamp) {
            $request->session()->forget(self::SESSION_KEY);

            return null;
        }

        $user = User::find($state['user_id']);
        $challenge = $user ? AdminLoginChallenge::where('user_id', $user->id)
            ->where('session_hash', $this->hash((string) $state['secret']))
            ->whereNull('used_at')->latest('id')->first() : null;

        return $user && $challenge ? ['user' => $user, 'challenge' => $challenge, 'remember' => (bool) $state['remember']] : null;
    }

    /** @return 'ok'|'wrong'|'locked'|'expired' */
    public function verifyCode(AdminLoginChallenge $challenge, string $code): string
    {
        if ($challenge->used_at !== null || $challenge->expires_at->isPast()) {
            return 'expired';
        }
        if ($challenge->attempts >= AdminLoginChallenge::MAX_ATTEMPTS) {
            return 'locked';
        }

        if (hash_equals($challenge->code_hash, $this->hash(trim($code)))) {
            return 'ok';
        }

        $challenge->increment('attempts');

        if ($challenge->attempts >= AdminLoginChallenge::MAX_ATTEMPTS) {
            $challenge->update(['used_at' => now()]); // five wrong codes end the challenge
            SecurityLog::record('admin_code_failed', request(), $challenge->user_id);

            return 'locked';
        }

        return 'wrong';
    }

    /** The approve link only counts in the browser session that started the sign-in. */
    public function tokenMatchesSession(Request $request, string $token): ?array
    {
        $pending = $this->pending($request);

        if (! $pending || ! hash_equals($pending['challenge']->token_hash, $this->hash($token))) {
            return null;
        }

        return $pending;
    }

    /** @return 'sent'|'cooldown'|'limit'|'failed'|'none' */
    public function resend(Request $request): string
    {
        $pending = $this->pending($request);

        if (! $pending) {
            return 'none';
        }

        $user = $pending['user'];
        $last = AdminLoginChallenge::where('user_id', $user->id)->latest('id')->first();

        if ($last && $last->created_at->diffInSeconds(now(), true) < self::RESEND_COOLDOWN_SECONDS) {
            return 'cooldown';
        }
        if (AdminLoginChallenge::where('user_id', $user->id)->where('created_at', '>=', now()->subHour())->count() >= self::MAX_SENDS_PER_HOUR) {
            return 'limit';
        }

        $secret = (string) data_get($request->session()->get(self::SESSION_KEY), 'secret');

        return $this->issue($request, $user, $secret, ($last?->sent_count ?? 0) + 1) ? 'sent' : 'failed';
    }

    /** Finish the sign-in: single use, new session id, remember flag kept. Hands over to TOTP when the user has it. */
    public function complete(Request $request, array $pending): Response
    {
        $user = $pending['user'];
        $pending['challenge']->update(['used_at' => now()]);
        $request->session()->forget(self::SESSION_KEY);

        // An account that also uses an authenticator app still has to pass that challenge.
        if ($user->two_factor_secret && $user->two_factor_confirmed_at) {
            $request->session()->put(['login.id' => $user->getKey(), 'login.remember' => $pending['remember']]);

            return redirect()->route('two-factor.login');
        }

        Auth::guard(config('fortify.guard', 'web'))->login($user, $pending['remember']);
        $request->session()->regenerate();

        return app(\Laravel\Fortify\Contracts\LoginResponse::class)->toResponse($request);
    }

    public function cancel(Request $request): void
    {
        $pending = $this->pending($request);
        if ($pending) {
            $pending['challenge']->update(['used_at' => now()]);
        }
        $request->session()->forget(self::SESSION_KEY);
    }
}
