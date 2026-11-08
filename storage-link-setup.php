<?php
/**
 * One-time storage symlink helper for shared hosting without easy SSH access.
 *
 * Upload this file into your `public_html` folder (same level as `public/`,
 * `storage/`, `artisan`), then open it once in your browser:
 *   https://yourdomain.com/storage-link-setup.php
 *
 * It creates `public/storage` -> `storage/app/public` if missing or broken,
 * and does NOT touch it if a correct link already exists.
 *
 * DELETE THIS FILE after you see the success message — it must not stay
 * reachable on a live site.
 */

$publicStorage = __DIR__ . '/public/storage';
$realStorage = __DIR__ . '/storage/app/public';

header('Content-Type: text/plain');

if (!is_dir($realStorage)) {
    http_response_code(500);
    echo "ERROR: Target folder does not exist: {$realStorage}\n";
    echo "Check that 'storage/app/public' is present before running this.\n";
    exit;
}

if (is_link($publicStorage)) {
    $target = readlink($publicStorage);
    $resolvedTarget = realpath($publicStorage);

    if ($resolvedTarget === realpath($realStorage)) {
        echo "OK: Symlink already exists and points to the correct place.\n";
        echo "public/storage -> {$target}\n";
        echo "Nothing to do. You can delete this file now.\n";
        exit;
    }

    echo "WARNING: 'public/storage' is a symlink but points to the WRONG place:\n";
    echo "  current target: {$target}\n";
    echo "  resolved: " . var_export($resolvedTarget, true) . "\n";
    echo "Not touching it automatically — fix manually or ask for help before re-running.\n";
    exit;
}

if (file_exists($publicStorage)) {
    if (is_dir($publicStorage)) {
        $isEmpty = count(scandir($publicStorage)) <= 2; // only . and ..
        if (!$isEmpty) {
            http_response_code(409);
            echo "ERROR: 'public/storage' exists as a REAL folder and is NOT empty.\n";
            echo "Refusing to delete it automatically — it may contain real uploaded files.\n";
            echo "Back it up, move its contents into 'storage/app/public' manually, then\n";
            echo "delete the empty 'public/storage' folder and re-run this script.\n";
            exit;
        }

        if (!rmdir($publicStorage)) {
            http_response_code(500);
            echo "ERROR: 'public/storage' is an empty folder but could not be removed\n";
            echo "(check file permissions), so the symlink could not be created.\n";
            exit;
        }
    } else {
        http_response_code(409);
        echo "ERROR: 'public/storage' exists as a regular file, not a folder or symlink.\n";
        echo "Refusing to delete it automatically — check it manually first.\n";
        exit;
    }
}

if (!function_exists('symlink')) {
    http_response_code(500);
    echo "ERROR: PHP's symlink() function is disabled on this server.\n";
    echo "Ask your host to enable it, or use a manual folder-copy approach instead.\n";
    exit;
}

if (@symlink($realStorage, $publicStorage)) {
    echo "SUCCESS: Created symlink.\n";
    echo "public/storage -> {$realStorage}\n";
    echo "\nDELETE THIS FILE NOW (storage-link-setup.php) — it should not stay on a live site.\n";
} else {
    $error = error_get_last();
    http_response_code(500);
    echo "ERROR: symlink() call failed.\n";
    echo "PHP error: " . ($error['message'] ?? 'unknown') . "\n";
    echo "Your hosting may block symlink() outside specific folders — ask RabHost support.\n";
}
