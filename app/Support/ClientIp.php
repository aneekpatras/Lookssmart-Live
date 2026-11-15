<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * The one place tracking code gets a visitor IP from. It is simply Request::ip(): X-Forwarded-For is only
 * honoured for proxies listed in TRUSTED_PROXIES (bootstrap/app.php trustProxies), so a visitor cannot spoof
 * their IP with a header. With TRUSTED_PROXIES empty the IP is REMOTE_ADDR.
 */
class ClientIp
{
    public static function get(?Request $request = null): ?string
    {
        return ($request ?? request())->ip();
    }

    /** Which header the IP came from, for the admin check line: REMOTE_ADDR or X-Forwarded-For (trusted proxy). */
    public static function source(?Request $request = null): string
    {
        $request ??= request();

        return $request->server('REMOTE_ADDR') === $request->ip() ? 'REMOTE_ADDR' : 'X-Forwarded-For (via a trusted proxy)';
    }

    /** True for private, loopback and reserved addresses (10.x, 172.16-31.x, 192.168.x, 127.x, ::1 ...). */
    public static function isPrivate(?string $ip): bool
    {
        return $ip === null || $ip === '' || filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }
}
