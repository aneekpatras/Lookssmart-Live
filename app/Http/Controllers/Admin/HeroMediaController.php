<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SecureUploadService;
use App\Services\SettingService;
use App\Support\HeroMedia;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        if ($file === null) {
            // PHP drops the whole upload when it is over upload_max_filesize / post_max_size.
            $limits = HeroMedia::phpLimits();
            throw ValidationException::withMessages(['file' => sprintf(
                'No file arrived. This server accepts files up to %s MB (post limit %s MB). Upload large files by FTP into public/images, then choose them in the list.',
                round($limits['upload_max_filesize'] / 1048576, 1),
                round($limits['post_max_size'] / 1048576, 1),
            )]);
        }

        // Same-origin and symlink-free: shared hosting cannot create public/storage, so files go straight into public/images/hero.
        if ($kind === 'video') {
            $request->validate(['file' => ['file', 'mimes:mp4,webm', 'max:25600']], ['file.max' => 'The video must be 25 MB or smaller.']);
            $key = 'hero.video_path';
        } else {
            $request->validate(['file' => ['file', 'mimes:jpg,jpeg,webp', 'max:3072']]);
            $key = 'hero.poster_path';
        }

        $extension = match (strtolower((string) ($file->guessExtension() ?: $file->getClientOriginalExtension()))) {
            'jpeg', 'jpg' => 'jpg',
            'webp' => 'webp',
            'webm' => 'webm',
            default => $kind === 'video' ? 'mp4' : 'jpg',
        };
        $name = Str::random(24) . '.' . $extension;
        $directory = public_path('images/hero');

        if (! is_dir($directory) && ! @mkdir($directory, 0755, true) && ! is_dir($directory)) {
            throw ValidationException::withMessages(['file' => 'The folder public/images/hero could not be created. Create it by FTP and try again.']);
        }

        try {
            $file->move($directory, $name);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['file' => 'The file could not be saved into public/images/hero. Check that the folder is writable.']);
        }

        $path = 'images/hero/' . $name;

        $settings->set($key, '/' . $path, 'hero');

        return back()->with('success', $kind === 'video' ? 'Hero video uploaded and selected.' : 'Hero poster uploaded and selected.');
    }
}
