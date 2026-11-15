<?php

namespace App\Support;

/**
 * One place for phone numbers. Everything is stored as digits with the country code and no plus sign
 * (92300 1234567 becomes 923001234567). Accepted: 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX,
 * 00923XXXXXXXXX (spaces, dashes, dots and brackets allowed) and other international numbers that start
 * with + (8 to 15 digits). The matching front-end helper is resources/js/lib/phone.ts, keep them in step.
 */
class Phone
{
    public const MESSAGE = 'Enter a valid WhatsApp number, for example 0300 1234567.';

    public static function normalize(?string $raw): ?string
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return null;
        }

        $hasPlus = str_starts_with($raw, '+');
        $digits = preg_replace('/\D/', '', $raw) ?? '';

        if (preg_replace('/[\d\s\-().+]/', '', $raw) !== '') {
            return null; // letters or other symbols
        }

        if (str_starts_with($digits, '0092')) {
            $digits = substr($digits, 2);
            $hasPlus = true;
        }

        // Pakistan: 03XXXXXXXXX
        if (! $hasPlus && preg_match('/^03\d{9}$/', $digits)) {
            return '92' . substr($digits, 1);
        }

        // Pakistan with country code (with or without plus): exactly 92 + 3XXXXXXXXX
        if (str_starts_with($digits, '92') && ($hasPlus || strlen($digits) === 12)) {
            return preg_match('/^923\d{9}$/', $digits) ? $digits : null;
        }

        // Other international numbers must be written with a leading +
        if ($hasPlus && preg_match('/^[1-9]\d{7,14}$/', $digits)) {
            return $digits;
        }

        return null;
    }

    /** For numbers that are already stored: re-normalise, or accept stored digits-only international numbers. */
    public static function fromStored(?string $value): ?string
    {
        $normalised = self::normalize($value);
        if ($normalised !== null) {
            return $normalised;
        }

        $digits = preg_replace('/\D/', '', (string) $value) ?? '';

        return preg_match('/^[1-9]\d{7,14}$/', $digits) ? $digits : null;
    }

    public static function isValid(?string $raw): bool
    {
        return self::normalize($raw) !== null;
    }

    /** "923001234567" becomes "+92 300 1234567"; other countries become "+" and the digits. */
    public static function display(?string $stored): string
    {
        $digits = preg_replace('/\D/', '', (string) $stored) ?? '';
        if ($digits === '') {
            return '';
        }

        if (preg_match('/^92(3\d{2})(\d{7})$/', $digits, $m)) {
            return "+92 {$m[1]} {$m[2]}";
        }

        return '+' . $digits;
    }

    /** Masked for logs: 92300***4567. */
    public static function mask(?string $stored): string
    {
        $digits = preg_replace('/\D/', '', (string) $stored) ?? '';

        return strlen($digits) > 7 ? substr($digits, 0, 5) . '***' . substr($digits, -4) : '***';
    }
}
