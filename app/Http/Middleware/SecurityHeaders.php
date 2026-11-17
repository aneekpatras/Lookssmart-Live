<?php

namespace App\Http\Middleware;

use App\Support\Analytics;
use Closure;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Brief §5 — Transport & headers. Applied globally (see bootstrap/app.php).
 *
 * The nonce is shared with views as `$cspNonce` (used by Ziggy's `@routes(null, $cspNonce)` for its
 * inline route-list script) and registered with Vite::useCspNonce() so any inline script Vite itself
 * emits (e.g. the dev-server HMR client tag) carries it too. Our own bundled JS/CSS are all external
 * files loaded from 'self', so they don't need the nonce at all.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = Str::random(32);

        Vite::useCspNonce($nonce);
        view()->share('cspNonce', $nonce);

        // Phase 14 sub-step 1: an exception thrown anywhere deeper in the pipeline (auth's redirect
        // to /login, a 419 CSRF mismatch, a 404 for a route that DOES exist, an uncaught 500 —
        // route/route-group middleware like `auth` sits INSIDE this one) unwinds straight out of
        // $next() as a PHP exception, skipping every line below entirely; Laravel's kernel then
        // catches it OUTSIDE this whole middleware pipeline and renders a response that never passed
        // back through here. The practical result, confirmed live before this fix: literally every
        // error page in the app — including the very common "visit /admin while logged out" redirect
        // — shipped with zero security headers, CSP included. Catching here and rendering through the
        // app's own exception handler keeps that response inside this method so the headers below
        // still apply to it, the same as any other. (A path that matches NO route at all never
        // reaches this middleware in the first place — there's no route to attach it to — so that
        // last remaining case is covered separately, in bootstrap/app.php's exception renderer.)
        try {
            $response = $next($request);
        } catch (Throwable $e) {
            // Not re-thrown — this method fully resolves the response itself now — so report() must
            // be called explicitly here or exceptions handled this way would stop being logged
            // entirely (Laravel's kernel only calls it for exceptions THAT reach its own catch block).
            app(ExceptionHandler::class)->report($e);
            $response = app(ExceptionHandler::class)->render($request, $e);
        }

        return self::apply($response, $nonce, $request->secure());
    }

    /**
     * Applies the full header set to an already-built response, given a specific nonce. Used both by
     * `handle()` (the normal path, for any request that matched a route) and, with a fresh nonce, by
     * bootstrap/app.php's exception renderer (the fallback for a request that matched no route at
     * all, so never reached this middleware to begin with — Laravel's router raises that 404 before
     * any route middleware, this one included, ever runs).
     */
    public static function apply(Response $response, string $nonce, bool $secure): Response
    {
        $response->headers->set('Content-Security-Policy', self::buildCsp($nonce));
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        );

        if ($secure) {
            // Only meaningful over HTTPS — sending it over plain HTTP is a no-op at best, misleading
            // in local dev logs at worst.
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload',
            );
        }

        return $response;
    }

    /**
     * Google Tag Manager / GA4 are only ever allowed when Analytics::tag() says a tag is active for this
     * request (enabled, valid id, not local, not /admin*). A site without one keeps the original,
     * locked-down CSP. The tag is plain external script tags in the raw HTML, so script-src just gets
     * the Google Tag Manager host (no 'strict-dynamic', which would make browsers ignore 'self', and no
     * 'unsafe-inline' / 'unsafe-eval'). connect-src, img-src and frame-src get the hosts GTM and GA4
     * need for their beacons and the noscript iframe; CSP has no shortcut for those directives.
     */
    private static function buildCsp(string $nonce): string
    {
        // Only when a Google tag is really configured and active for this request (see Analytics::tag(),
        // which already excludes /admin* and fails closed). Its host list is added to script-src, with no
        // 'strict-dynamic' (that would make browsers ignore 'self') and no 'unsafe-inline'/'unsafe-eval'.
        $analyticsEnabled = Analytics::tag() !== null;

        $scriptSrc = "script-src 'self' 'nonce-{$nonce}'"
            . ($analyticsEnabled ? ' https://www.googletagmanager.com' : '');
        // `stock_image_url` (service categories, services, and deals) lets an admin paste ANY
        // remote image URL as a fallback/feature image instead of uploading a file — see
        // ServiceController::applyImage()/DealController::applyImage(). That started as a single
        // allowlisted host (`https://images.unsplash.com`, for seeded stock photography); once the
        // admin panel accepts an arbitrary admin-supplied URL, a fixed host allowlist can't keep up,
        // so this is widened to any HTTPS origin. This is server-rendered `<img src>` only — the
        // browser fetches it directly, nothing on our server ever requests the URL, so there is no
        // SSRF exposure — and CSP `img-src` cannot execute script from the loaded resource, only
        // display it, so the residual risk is limited to what any CMS that allows external image
        // embeds already accepts (e.g. IP/analytics leakage to the image host on page render).
        // `data:` stays for small inline assets already used elsewhere in the app.
        $imgSrc = "img-src 'self' data: https:"
            . ($analyticsEnabled ? ' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com' : '');
        $connectSrc = "connect-src 'self'" . ($analyticsEnabled ? ' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net' : '');
        // The Contact page embeds a Google Maps iframe (`https://www.google.com/maps?...&output=embed`,
        // keyless). `frame-src 'none'` silently blocked it outright — the map had never actually
        // rendered on any environment enforcing this policy, confirmed by curling the real header.
        // Scoped to that single host: enough for the embed, still no general iframe capability, and
        // `frame-ancestors 'none'` below continues to stop anyone framing US.
        // https://www.youtube-nocookie.com is the Home hero's client-mounted YouTube embed.
        $frameSrc = 'frame-src https://www.google.com'
            . ($analyticsEnabled ? ' https://www.googletagmanager.com' : '')
            . ' https://www.youtube-nocookie.com';

        $directives = [
            "default-src 'self'",
            $scriptSrc,
            "style-src 'self' 'nonce-{$nonce}' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            $imgSrc,
            $connectSrc,
            $frameSrc,
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            'report-uri ' . URL::to('/csp-report'),
        ];

        return implode('; ', $directives);
    }
}
