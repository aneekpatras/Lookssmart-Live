<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Public-site theme colours (Admin > Settings > Theme colours). Three base colours drive the whole site:
 * --gold (accent), --espresso (dark text and bands) and --ivory (page background). resources/css/app.css
 * keeps the exact default shades as static hex; when a custom base colour is saved, GET /theme.css
 * re-derives every shade with color-mix() (each preceded by a static fallback for old browsers).
 * With the defaults it returns an empty stylesheet, so the default site is pixel-for-pixel unchanged.
 */
class Theme
{
    public const DEFAULTS = ['gold' => '#c9a66b', 'espresso' => '#2a2420', 'ivory' => '#faf7f2'];

    /**
     * Derived shades: token => [base colour, percent of base, mix partner]. The percentages are the closest
     * fit to the original default shades (see the Part 3 report for the per-shade difference).
     */
    private const SHADES = [
        'accent-50' => ['gold', 18, 'white'],
        'accent-100' => ['gold', 29, 'white'],
        'accent-300' => ['gold', 74, 'white'],
        'accent-600' => ['gold', 85, 'black'],
        'accent-700' => ['gold', 68, 'black'],
        'ink-muted' => ['espresso', 72, 'white'],
        'border-soft' => ['ivory', 89, 'espresso'],
        'cream' => ['gold', 14, 'white'],
        'tint-a' => ['gold', 21, 'white'],
        'tint-b' => ['gold', 28, 'white'],
        'tint-c' => ['gold', 19, 'white'],
        'tint-d' => ['gold', 31, 'white'],
    ];

    /** @return array{gold: string, espresso: string, ivory: string} */
    public static function values(): array
    {
        $out = self::DEFAULTS;

        try {
            foreach (self::DEFAULTS as $name => $default) {
                $stored = Setting::get("theme.{$name}");

                if (is_string($stored) && preg_match('/^#[0-9A-Fa-f]{6}$/', $stored)) {
                    $out[$name] = strtolower($stored);
                }
            }
        } catch (\Throwable) {
            return self::DEFAULTS;
        }

        return $out;
    }

    /** Timestamp of the last theme change, used as the ?v= cache-buster on the stylesheet link. */
    public static function version(): int
    {
        try {
            $latest = Setting::query()->where('group', 'theme')->max('updated_at');

            return $latest ? (int) strtotime((string) $latest) : 0;
        } catch (\Throwable) {
            return 0;
        }
    }

    public static function css(): string
    {
        $values = self::values();

        if ($values === self::DEFAULTS) {
            return "/* Default theme: the colours in the main stylesheet apply. */\n";
        }

        $lines = [":root {"];

        foreach ($values as $name => $hex) {
            $lines[] = "  --{$name}: {$hex};";
        }

        foreach (self::SHADES as $token => [$base, $percent, $partner]) {
            $baseHex = $values[$base];
            $partnerHex = match ($partner) {
                'white' => '#ffffff',
                'black' => '#000000',
                default => $values[$partner],
            };
            $partnerVar = match ($partner) {
                'white', 'black' => $partner,
                default => "var(--{$partner})",
            };

            $lines[] = "  --color-{$token}: " . self::mixHex($baseHex, $partnerHex, $percent) . ';';
            $lines[] = "  --color-{$token}: color-mix(in srgb, var(--{$base}) {$percent}%, {$partnerVar});";
        }

        $lines[] = '}';

        return implode("\n", $lines) . "\n";
    }

    public static function mixHex(string $a, string $b, int $percentOfA): string
    {
        $rgb = fn (string $hex) => [hexdec(substr($hex, 1, 2)), hexdec(substr($hex, 3, 2)), hexdec(substr($hex, 5, 2))];
        [$x, $y] = [$rgb($a), $rgb($b)];
        $out = '#';

        for ($i = 0; $i < 3; $i++) {
            $out .= str_pad(dechex((int) round($x[$i] * $percentOfA / 100 + $y[$i] * (100 - $percentOfA) / 100)), 2, '0', STR_PAD_LEFT);
        }

        return $out;
    }
}
