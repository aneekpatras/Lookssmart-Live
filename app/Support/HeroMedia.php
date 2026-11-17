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

    public const DEFAULT_YOUTUBE_URL = 'https://youtu.be/jRmza-n-0vU';

    /**
     * The 11-character YouTube ID from one of the accepted link forms, or null. Accepted:
     * https://www.youtube.com/watch?v=ID, https://youtube.com/watch?v=ID, https://youtu.be/ID,
     * https://www.youtube.com/embed/ID and https://www.youtube.com/shorts/ID (also without "www").
     */
    public static function youtubeId(?string $url): ?string
    {
        $url = trim((string) $url);

        if ($url === '' || strlen($url) > 300 || preg_match('/[\s<>"\']/', $url)) {
            return null;
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['port'])) {
            return null;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = (string) ($parts['path'] ?? '');
        $id = null;

        if ($host === 'youtu.be') {
            $id = preg_match('#^/([^/]+)/?$#', $path, $m) ? $m[1] : null;
        } elseif ($host === 'www.youtube.com' || $host === 'youtube.com') {
            if ($path === '/watch') {
                parse_str((string) ($parts['query'] ?? ''), $query);
                $id = isset($query['v']) && is_string($query['v']) ? $query['v'] : null;
            } elseif (preg_match('#^/(?:embed|shorts)/([^/]+)/?$#', $path, $m)) {
                $id = $m[1];
            }
        }

        return $id !== null && preg_match('/^[A-Za-z0-9_-]{11}$/', $id) ? $id : null;
    }

    /** @return array{source: string, url: string, id: string|null} What the site uses now (code defaults when nothing is stored). */
    public static function youtube(): array
    {
        $source = trim((string) self::setting('hero.source'));
        $source = in_array($source, ['youtube', 'local'], true) ? $source : 'youtube';
        $stored = trim((string) self::setting('hero.youtube_url'));
        $url = $stored === '' ? self::DEFAULT_YOUTUBE_URL : $stored;
        $id = self::youtubeId($url);

        // Local source, or a stored URL that is not valid: the local video chain takes over.
        return ['source' => $id === null ? 'local' : $source, 'url' => $url, 'id' => $id];
    }

    /** @return array{video_url: string|null, poster_url: string|null, custom_poster: bool, source: string, youtube_id: string|null} */
    public static function resolve(): array
    {
        $enabled = self::setting('hero.video_enabled') !== false;
        $youtube = self::youtube();
        $useYoutube = $enabled && $youtube['source'] === 'youtube';
        $video = trim((string) self::setting('hero.video_path'));
        // Nothing saved: the default video. A saved path whose file is missing: no video at all (poster only, no error).
        $video = $video === '' ? self::DEFAULT_VIDEO : $video;
        $poster = trim((string) self::setting('hero.poster_path'));
        $customPoster = $poster !== '' && self::validPath($poster, self::POSTER_EXT);

        return [
            'video_url' => $enabled && ! $useYoutube && self::validPath($video, self::VIDEO_EXT) ? self::encode($video) : null,
            'poster_url' => $customPoster ? self::encode($poster) : null,
            'custom_poster' => $customPoster,
            'source' => $youtube['source'],
            'youtube_id' => $useYoutube ? $youtube['id'] : null,
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
