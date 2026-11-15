<?php

namespace App\Http\Responses;

use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;

/**
 * The same answer whether or not the email belongs to an account, so the reset form cannot be used to
 * find out who has an account.
 */
class GenericResetLinkResponse implements FailedPasswordResetLinkRequestResponse, SuccessfulPasswordResetLinkRequestResponse
{
    public const MESSAGE = 'If an account with that email exists, we have sent a reset link.';

    public function toResponse($request)
    {
        return $request->wantsJson()
            ? response()->json(['message' => self::MESSAGE])
            : back()->with('status', self::MESSAGE);
    }
}
