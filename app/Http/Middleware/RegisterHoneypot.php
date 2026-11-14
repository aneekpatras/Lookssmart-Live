<?php

namespace App\Http\Middleware;

use App\Support\SecurityLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Silently drops a registration whose hidden "website" field was filled in (a bot). The caller gets the
 * same redirect a real visitor would, nothing is created, and the attempt lands in the security log.
 * Only active for POST /register; every other request passes straight through.
 */
class RegisterHoneypot
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('post') && $request->is('register') && filled($request->input('website'))) {
            SecurityLog::record('form_spam', $request);

            return redirect('/');
        }

        return $next($request);
    }
}
