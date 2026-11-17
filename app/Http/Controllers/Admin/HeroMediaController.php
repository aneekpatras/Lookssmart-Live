<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SecureUploadService;
use App\Services\SettingService;
use App\Support\HeroMedia;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Uploads for the Home hero video and poster (Settings > Home hero). The chosen path is saved as a setting. */
class HeroMediaController extends Controller
{
    public function upload(Request $request, SecureUploadService $uploads, SettingService $settings): RedirectResponse
    {
        abort_unless(auth()->user()?->can('cms.manage'), 403);

        $kind = $request->input('kind') === 'poster' ? 'poster' : 'video';
        $file = $request->file('file');

        // TEMP SAVE-DEBUG (remove with `git revert`)
        \Illuminate\Support\Facades\Log::info('SAVE-DEBUG hero upload: incoming', ['method' => $request->method(), 'kind' => $kind, 'hasFile' => $request->hasFile('file'), 'files_superglobal' => array_map(fn ($f) => ['size' => $f['size'] ?? null, 'error' => $f['error'] ?? null, 'name' => $f['name'] ?? null], $_FILES), 'content_length' => $request->server('CONTENT_LENGTH'), 'upload_max_filesize' => ini_get('upload_max_filesize'), 'post_max_size' => ini_get('post_max_size'), 'file_size' => $file?->getSize(), 'upload_err_code' => $file?->getError(), 'upload_err_msg' => $file?->getErrorMessage()]);
        // END TEMP SAVE-DEBUG

        if ($file === null) {
            // PHP drops the whole upload when it is over upload_max_filesize / post_max_size.
            $limits = HeroMedia::phpLimits();
            throw ValidationException::withMessages(['file' => sprintf(
                'No file arrived. This server accepts files up to %s MB (post limit %s MB). Upload large files by FTP into public/images, then choose them in the list.',
                round($limits['upload_max_filesize'] / 1048576, 1),
                round($limits['post_max_size'] / 1048576, 1),
            )]);
        }

        if ($kind === 'video') {
            $request->validate(['file' => ['file', 'mimes:mp4,webm', 'max:25600']], ['file.max' => 'The video must be 25 MB or smaller.']);
            $path = 'hero/' . Str::random(24) . '.' . strtolower($file->getClientOriginalExtension() ?: 'mp4');
            Storage::disk('public')->putFileAs('hero', $file, basename($path));
            $key = 'hero.video_path';
        } else {
            $request->validate(['file' => ['file', 'mimes:jpg,jpeg,webp', 'max:3072']]);
            $path = $uploads->storePublicImage($file, 'hero');
            $key = 'hero.poster_path';
        }

        $debugOld = \App\Models\Setting::get($key);
        $settings->set($key, '/storage/' . $path, 'hero');
        // TEMP SAVE-DEBUG
        \Illuminate\Support\Facades\Log::info('SAVE-DEBUG hero upload: stored', ['key' => $key, 'old' => $debugOld, 'new' => '/storage/' . $path, 'read_back' => \App\Models\Setting::get($key), 'file_on_disk' => is_file(public_path('storage/' . $path)), 'cache_key_cleared' => 'settings:all (Setting::saved event)']);
        // END TEMP SAVE-DEBUG

        return back()->with('success', $kind === 'video' ? 'Hero video uploaded and selected.' : 'Hero poster uploaded and selected.');
    }
}
