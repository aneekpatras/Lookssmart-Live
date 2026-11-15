<?php

namespace App\Support;

/** Small User-Agent parser (no package): device type, browser, OS (no version numbers) and a bot flag. */
class DeviceParser
{
    /** @return array{device_type: string, browser: string, os: string, is_bot: bool} */
    public static function parse(?string $ua): array
    {
        $ua = trim((string) $ua);
        $lower = strtolower($ua);

        $isBot = $ua === '' || (bool) preg_match('/bot|crawl|spider|headless|curl|python-requests|lighthouse|preview|monitor/', $lower);

        if (str_contains($lower, 'ipad') || str_contains($lower, 'tablet') || (str_contains($lower, 'android') && ! str_contains($lower, 'mobile'))) {
            $device = 'tablet';
        } elseif (preg_match('/mobi|iphone|ipod|android|windows phone/', $lower)) {
            $device = 'mobile';
        } else {
            $device = 'desktop';
        }

        // Order matters: Edge/Opera/Samsung identify as Chrome too, Chrome on iOS says CriOS, and Chrome says Safari.
        $browser = match (true) {
            (bool) preg_match('/edg(e|a|ios)?\//', $lower) => 'Edge',
            str_contains($lower, 'samsungbrowser') => 'Samsung Internet',
            (bool) preg_match('/opr\/|opera/', $lower) => 'Opera',
            (bool) preg_match('/firefox|fxios/', $lower) => 'Firefox',
            (bool) preg_match('/chrome|crios/', $lower) => 'Chrome',
            str_contains($lower, 'safari') => 'Safari',
            default => 'other',
        };

        $os = match (true) {
            (bool) preg_match('/iphone|ipad|ipod|ios/', $lower) => 'iOS',
            str_contains($lower, 'android') => 'Android',
            str_contains($lower, 'windows') => 'Windows',
            (bool) preg_match('/macintosh|mac os x/', $lower) => 'macOS',
            (bool) preg_match('/linux|x11|cros/', $lower) => 'Linux',
            default => 'other',
        };

        return ['device_type' => $device, 'browser' => $browser, 'os' => $os, 'is_bot' => $isBot];
    }
}
