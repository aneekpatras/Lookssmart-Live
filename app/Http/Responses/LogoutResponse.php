<?php

namespace App\Http\Responses;

use Inertia\Inertia;
use Laravel\Fortify\Contracts\LogoutResponse as LogoutResponseContract;

class LogoutResponse implements LogoutResponseContract
{
    public function toResponse($request)
    {
        // Inertia keeps (encrypted) page history in the browser; drop it when the user logs out.
        Inertia::clearHistory();

        return redirect('/');
    }
}
