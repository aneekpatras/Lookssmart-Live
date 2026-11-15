<?php

namespace App\Support;

/** Turns a referrer host and utm parameters into a short label: Google, Instagram, WhatsApp, Direct ... */
class TrafficSource
{
    private const MAP = [
        'Google' => ['google'],
        'Bing' => ['bing'],
        'Instagram' => ['instagram', 'ig'],
        'Facebook' => ['facebook', 'fb'],
        'WhatsApp' => ['whatsapp', 'wa.me'],
        'TikTok' => ['tiktok'],
        'YouTube' => ['youtube', 'youtu.be'],
    ];

    public static function label(?string $referrerHost, ?string $utmSource = null, ?string $utmMedium = null, ?string $utmCampaign = null, ?string $ownHost = null): string
    {
        foreach ([$utmSource, $referrerHost] as $candidate) {
            $candidate = strtolower(trim((string) $candidate));
            if ($candidate === '') {
                continue;
            }

            foreach (self::MAP as $label => $needles) {
                foreach ($needles as $needle) {
                    if ($candidate === $needle || (strlen($needle) > 2 && str_contains($candidate, $needle))) {
                        return $label;
                    }
                }
            }
        }

        $host = preg_replace('/^www\./', '', strtolower(trim((string) $referrerHost))) ?? '';
        $own = preg_replace('/^www\./', '', strtolower((string) $ownHost)) ?? '';

        if ($host === '' || ($own !== '' && $host === $own)) {
            $utm = trim((string) $utmSource);

            return $utm !== '' ? mb_substr($utm, 0, 60) : 'Direct';
        }

        return mb_substr($host, 0, 60);
    }
}
