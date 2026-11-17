<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The Home hero video and poster. Paths are same-origin only (the CSP keeps media-src 'self'): a file
 * under public/images or public/storage that really exists. Anything else falls back to the defaults.
 */
class HeroMedia
{
    public const DEFAULT_VIDEO = '/images/Brides_showcasing.mp4';

    public const DEFAULT_POSTER = '/images/hero-poster.jpg';

    public const VIDEO_EXT = ['mp4', 'webm'];

    public const POSTER_EXT = ['jpg', 'jpeg', 'webp'];

    public static function validPath(string $path, array $extensions): bool
    {
        if (! preg_match('#^/(images|storage)/[A-Za-z0-9._ \-/()]+$#', $path) || str_contains($path, '..')) {
            return false;
        }

        if (! in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), $extensions, true)) {
            return false;
        }

        return is_file(public_path(ltrim($path, '/')));
    }

    private static function setting(string $key): mixed
    {
        try {
            return Setting::get($key);
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array{video_url: string|null, poster_url: string|null, custom_poster: bool} */
    public static function resolve(): array
    {
        $enabled = self::setting('hero.video_enabled') !== false;
        $video = trim((string) self::setting('hero.video_path'));
        // Nothing saved: the default video. A saved path whose file is missing: no video at all (poster only, no error).
        $video = $video === '' ? self::DEFAULT_VIDEO : $video;
        $poster = trim((string) self::setting('hero.poster_path'));
        $customPoster = $poster !== '' && self::validPath($poster, self::POSTER_EXT);

        return [
            'video_url' => $enabled && self::validPath($video, self::VIDEO_EXT) ? self::encode($video) : null,
            'poster_url' => $customPoster ? self::encode($poster) : null,
            'custom_poster' => $customPoster,
        ];
    }

    private static function encode(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }

    /** @return list<string> Site paths of the files in public/images and public/images/hero with one of the extensions. */
    public static function files(array $extensions): array
    {
        $found = [];

        foreach (['images' => '/images/', 'images/hero' => '/images/hero/'] as $dir => $prefix) {
            foreach ((glob(public_path($dir) . '/*') ?: []) as $file) {
                if (is_file($file) && in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), $extensions, true)) {
                    $found[] = $prefix . basename($file);
                }
            }
        }

        sort($found);

        return $found;
    }

    /** PHP's real upload limits in bytes, so the admin can explain a too-large file. */
    public static function phpLimits(): array
    {
        return [
            'upload_max_filesize' => self::bytes((string) ini_get('upload_max_filesize')),
            'post_max_size' => self::bytes((string) ini_get('post_max_size')),
        ];
    }

    private static function bytes(string $value): int
    {
        $value = trim($value);
        $number = (int) $value;

        return match (strtolower(substr($value, -1))) {
            'g' => $number * 1024 ** 3,
            'm' => $number * 1024 ** 2,
            'k' => $number * 1024,
            default => $number,
        };
    }
}
