<?php

namespace App\Support;

/**
 * Optional city lookup from storage/app/geoip/GeoLite2-City.mmdb using the vendored pure-PHP MaxMind DB
 * reader (app/Support/Geo/MaxMindDb, Apache-2.0). Anything missing or failing returns nulls and never
 * throws. Returns country (ISO code), region and city only, never coordinates. Private, loopback and
 * reserved IPs return "Local network" as the city.
 */
class GeoLocator
{
    public static function databasePath(): string
    {
        return storage_path('app/geoip/GeoLite2-City.mmdb');
    }

    public static function available(): bool
    {
        return is_file(self::databasePath());
    }

    /** @return array{country: ?string, region: ?string, city: ?string} */
    public static function lookup(?string $ip): array
    {
        $empty = ['country' => null, 'region' => null, 'city' => null];

        try {
            if ($ip === null || $ip === '') {
                return $empty;
            }

            if (ClientIp::isPrivate($ip)) {
                return ['country' => null, 'region' => null, 'city' => 'Local network'];
            }

            if (! self::available()) {
                return $empty;
            }

            self::registerAutoloader();

            $reader = new \MaxMind\Db\Reader(self::databasePath());
            $record = $reader->get($ip);
            $reader->close();

            if (! is_array($record)) {
                return $empty;
            }

            return [
                'country' => isset($record['country']['iso_code']) ? mb_substr((string) $record['country']['iso_code'], 0, 2) : null,
                'region' => isset($record['subdivisions'][0]['names']['en']) ? mb_substr((string) $record['subdivisions'][0]['names']['en'], 0, 80) : null,
                'city' => isset($record['city']['names']['en']) ? mb_substr((string) $record['city']['names']['en'], 0, 80) : null,
            ];
        } catch (\Throwable) {
            return $empty;
        }
    }

    private static function registerAutoloader(): void
    {
        static $registered = false;

        if ($registered) {
            return;
        }

        spl_autoload_register(static function (string $class): void {
            $prefix = 'MaxMind\\Db\\';
            if (! str_starts_with($class, $prefix)) {
                return;
            }

            $file = __DIR__ . '/Geo/MaxMindDb/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) {
                require_once $file;
            }
        });

        $registered = true;
    }
}
