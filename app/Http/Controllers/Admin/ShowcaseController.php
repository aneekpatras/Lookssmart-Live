<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShowcaseSlide;
use App\Services\SecureUploadService;
use App\Support\Showcase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Home showcase: the section's texts (settings group `showcase`, saved by SettingController) and its slides. */
class ShowcaseController extends Controller
{
    public function index(): Response
    {
        $this->authorizeCms();

        $ready = Schema::hasTable('showcase_slides');

        return Inertia::render('Admin/CMS/Showcase/Index', [
            'tableReady' => $ready,
            'options' => Showcase::options(),
            'defaults' => Showcase::DEFAULTS,
            'slides' => $ready
                ? ShowcaseSlide::orderBy('sort_order')->orderBy('id')->get()->map(fn (ShowcaseSlide $slide) => $this->data($slide))
                : [],
        ]);
    }

    public function store(Request $request, SecureUploadService $uploads): RedirectResponse
    {
        $this->authorizeCms();
        $data = $this->validated($request, true);

        $slide = ShowcaseSlide::create([
            ...$data,
            'image_path' => $uploads->storePublicImage($request->file('image'), 'showcase'),
            'sort_order' => ((int) ShowcaseSlide::max('sort_order')) + 1,
            'is_active' => true,
        ]);

        return back()->with('success', "Slide \"{$slide->title}\" added.");
    }

    public function update(Request $request, ShowcaseSlide $slide, SecureUploadService $uploads): RedirectResponse
    {
        $this->authorizeCms();

        // The list's switch sends only is_active.
        if ($request->has('is_active') && ! $request->has('title')) {
            $slide->update(['is_active' => $request->boolean('is_active')]);

            return back();
        }

        $data = $this->validated($request, false);

        if ($request->hasFile('image')) {
            $old = $slide->image_path;
            $data['image_path'] = $uploads->storePublicImage($request->file('image'), 'showcase');
            $uploads->deletePublic($old);
        }

        $slide->update($data);

        return back()->with('success', "Slide \"{$slide->title}\" updated.");
    }

    public function destroy(ShowcaseSlide $slide, SecureUploadService $uploads): RedirectResponse
    {
        $this->authorizeCms();
        $uploads->deletePublic($slide->image_path);
        $slide->delete();

        return back()->with('success', 'Slide deleted.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $this->authorizeCms();
        $data = $request->validate(['order' => ['required', 'array'], 'order.*' => ['integer', 'exists:showcase_slides,id']]);

        foreach ($data['order'] as $index => $id) {
            ShowcaseSlide::whereKey($id)->update(['sort_order' => $index]);
        }

        return back()->with('success', 'Order updated.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $imageRequired): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:160'],
            'link' => ['nullable', 'string', 'max:255'],
            'focus' => ['required', 'in:top,center'],
            'image' => [$imageRequired ? 'required' : 'nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
        ]);

        $link = trim((string) ($data['link'] ?? ''));

        if ($link !== '' && ! Showcase::validLink($link)) {
            throw ValidationException::withMessages(['link' => 'Use a path starting with "/" or an https:// address.']);
        }

        return [
            'title' => trim(strip_tags($data['title'])),
            'subtitle' => ($sub = trim(strip_tags((string) ($data['subtitle'] ?? '')))) !== '' ? $sub : null,
            'link' => $link !== '' ? $link : null,
            'focus' => $data['focus'],
        ];
    }

    /** @return array<string, mixed> */
    private function data(ShowcaseSlide $slide): array
    {
        return [
            'id' => $slide->id,
            'title' => $slide->title,
            'subtitle' => $slide->subtitle,
            'link' => $slide->link,
            'focus' => $slide->focus,
            'is_active' => $slide->is_active,
            'image_url' => asset('storage/' . $slide->image_path),
        ];
    }

    private function authorizeCms(): void
    {
        abort_unless(auth()->user()?->can('cms.manage'), 403);
    }
}
