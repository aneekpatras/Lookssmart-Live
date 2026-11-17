<?php

namespace App\Actions\Fortify;

use App\Services\AdminLoginChallengeService;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;

/**
 * Login pipeline step (config/fortify.php), placed before the authenticator-app redirect and before
 * AttemptToAuthenticate. For an ADMIN account with a correct password it does NOT log in: it starts the
 * email challenge and redirects to /admin-verify. Everyone else (customers, wrong passwords, suspended
 * accounts, the feature switched off) just continues down the normal pipeline.
 */
class RequireAdminEmailChallenge
{
    public function __construct(private readonly AdminLoginChallengeService $challenges) {}

    public function handle($request, $next)
    {
        $callback = Fortify::$authenticateUsingCallback;
        $user = $callback ? $callback($request) : null;

        if (! $user || ! $this->challenges->isRequiredFor($user) || (method_exists($user, 'isSuspended') && $user->isSuspended())) {
            return $next($request);
        }

        if (! $this->challenges->start($request, $user, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                Fortify::username() => ['We could not email your sign-in code. Please try again in a moment, or contact the site owner.'],
            ]);
        }

        return redirect()->route('admin-verify.show');
    }
}
