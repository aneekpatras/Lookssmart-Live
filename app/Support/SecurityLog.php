<?php

namespace App\Support;

use App\Models\SecurityEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Writes rows to security_events. Never throws (the site must keep working before the table exists) and
 * never stores a password or a full email: only a masked address such as a***@gmail.com.
 */
class SecurityLog
{
    public static function record(string $type, ?Request $request = null, ?int $userId = null, ?string $email = null): void
    {
        try {
            if (! Schema::hasTable('security_events')) {
                return;
            }

            $request ??= request();

            SecurityEvent::create([
                'type' => $type,
                'ip' => ClientIp::get($request),
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
                'user_id' => $userId,
                'subject' => $email ? self::mask($email) : null,
            ]);
        } catch (\Throwable) {
            // Logging must never break a request.
        }
    }

    public static function mask(string $email): string
    {
        $email = trim($email);

        if (! str_contains($email, '@') && preg_match('/\d{7}/', $email)) {
            return Phone::mask(Phone::normalize($email) ?? $email);
        }
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        if ($domain === '') {
            return Str::limit(mb_substr($local, 0, 1) . '***', 120, '');
        }

        return Str::limit(mb_substr($local, 0, 1) . '***@' . $domain, 120, '');
    }
}
