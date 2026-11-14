<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\FaqRequest;
use App\Models\Faq;
use App\Models\FaqCategory;
use App\Support\FaqData;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Content > FAQs: questions and categories on one page (two tabs). The public site reads the
 * database through FaqData::current() (no cache), and falls back to the built-in defaults while the
 * tables are missing or empty. "Load default FAQs" seeds those defaults from the admin panel.
 */
class FaqController extends Controller
{
    private function guard(Request $request): void
    {
        abort_unless($request->user()?->can('cms.manage'), 403);
    }

    private function tablesReady(): bool
    {
        return Schema::hasTable('faqs') && Schema::hasTable('faq_categories');
    }

    public function index(Request $request): Response
    {
        $this->guard($request);

        if (! $this->tablesReady()) {
            return Inertia::render('Admin/CMS/Faqs/Index', [
                'ready' => false, 'faqs' => [], 'categories' => [], 'canLoadDefaults' => false,
            ]);
        }

        return Inertia::render('Admin/CMS/Faqs/Index', [
            'ready' => true,
            'faqs' => Faq::query()->with('category:id,name')->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (Faq $faq) => [
                    'id' => $faq->id,
                    'question' => $faq->question,
                    'category_id' => $faq->faq_category_id,
                    'category' => $faq->category?->name,
                    'sort_order' => $faq->sort_order,
                    'is_active' => $faq->is_active,
                    'show_in_preview' => $faq->show_in_preview,
                ])->values(),
            'categories' => FaqCategory::query()->withCount('faqs')->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (FaqCategory $c) => [
                    'id' => $c->id, 'name' => $c->name, 'sort_order' => $c->sort_order,
                    'is_active' => $c->is_active, 'faqs_count' => $c->faqs_count,
                ])->values(),
            'canLoadDefaults' => ! Faq::query()->exists() && ! FaqCategory::query()->exists(),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->guard($request);

        return Inertia::render('Admin/CMS/Faqs/Form', ['categories' => $this->categoryOptions()]);
    }

    public function store(FaqRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['sort_order'] = $data['sort_order'] ?? ((int) Faq::query()->max('sort_order') + 1);

        Faq::create($data);
        FaqData::flush();

        return redirect()->route('admin.faqs')->with('success', 'Question added.');
    }

    public function edit(Request $request, Faq $faq): Response
    {
        $this->guard($request);

        return Inertia::render('Admin/CMS/Faqs/Form', [
            'faq' => [
                'id' => $faq->id,
                'faq_category_id' => $faq->faq_category_id,
                'question' => $faq->question,
                'answer' => $faq->answer,
                'links' => $faq->links ?? [],
                'sort_order' => $faq->sort_order,
                'is_active' => $faq->is_active,
                'show_in_preview' => $faq->show_in_preview,
            ],
            'categories' => $this->categoryOptions(),
        ]);
    }

    public function update(FaqRequest $request, Faq $faq): RedirectResponse
    {
        $data = $request->validated();
        $data['sort_order'] = $data['sort_order'] ?? $faq->sort_order;

        $faq->update($data);
        FaqData::flush();

        return redirect()->route('admin.faqs')->with('success', 'Question updated.');
    }

    public function destroy(Request $request, Faq $faq): RedirectResponse
    {
        $this->guard($request);

        $faq->delete();
        FaqData::flush();

        return back()->with('success', 'Question deleted.');
    }

    public function toggle(Request $request, Faq $faq): RedirectResponse
    {
        $this->guard($request);

        $faq->update(['is_active' => ! $faq->is_active]);
        FaqData::flush();

        return back()->with('success', $faq->is_active ? 'Question is now shown.' : 'Question hidden.');
    }

    public function move(Request $request, Faq $faq): RedirectResponse
    {
        $this->guard($request);

        $this->swap(Faq::query(), $faq->id, $request->string('direction')->value() === 'up' ? -1 : 1);
        FaqData::flush();

        return back();
    }

    // --- Categories ---------------------------------------------------------------------------

    public function storeCategory(Request $request): RedirectResponse
    {
        $this->guard($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:faq_categories,name'],
        ]);

        FaqCategory::create([
            'name' => trim(strip_tags($data['name'])),
            'slug' => $this->uniqueSlug($data['name']),
            'sort_order' => (int) FaqCategory::query()->max('sort_order') + 1,
            'is_active' => true,
        ]);
        FaqData::flush();

        return back()->with('success', 'Category added.');
    }

    public function updateCategory(Request $request, FaqCategory $faqCategory): RedirectResponse
    {
        $this->guard($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('faq_categories', 'name')->ignore($faqCategory->id)],
        ]);

        $faqCategory->update(['name' => trim(strip_tags($data['name']))]);
        FaqData::flush();

        return back()->with('success', 'Category renamed.');
    }

    public function toggleCategory(Request $request, FaqCategory $faqCategory): RedirectResponse
    {
        $this->guard($request);

        $faqCategory->update(['is_active' => ! $faqCategory->is_active]);
        FaqData::flush();

        return back()->with('success', $faqCategory->is_active ? 'Category is now shown.' : 'Category hidden.');
    }

    public function moveCategory(Request $request, FaqCategory $faqCategory): RedirectResponse
    {
        $this->guard($request);

        $this->swap(FaqCategory::query(), $faqCategory->id, $request->string('direction')->value() === 'up' ? -1 : 1);
        FaqData::flush();

        return back();
    }

    /** Deleting a category that still has questions is blocked (the safe, simple option). */
    public function destroyCategory(Request $request, FaqCategory $faqCategory): RedirectResponse
    {
        $this->guard($request);

        $count = $faqCategory->faqs()->count();

        if ($count > 0) {
            return back()->with('error', "\"{$faqCategory->name}\" still has {$count} question(s). Move or delete them first.");
        }

        $faqCategory->delete();
        FaqData::flush();

        return back()->with('success', 'Category deleted.');
    }

    // --- Defaults -----------------------------------------------------------------------------

    /** Creates the built-in categories and questions. Idempotent: never duplicates what exists. */
    public function loadDefaults(Request $request): RedirectResponse
    {
        $this->guard($request);

        if (Faq::query()->exists() || FaqCategory::query()->exists()) {
            return back()->with('error', 'Defaults can only be loaded while there are no FAQs or categories.');
        }

        $ids = [];
        foreach (FaqData::defaultCategories() as $index => $category) {
            $ids[$category['id']] = FaqCategory::firstOrCreate(
                ['slug' => $category['id']],
                ['name' => $category['label'], 'sort_order' => $index + 1, 'is_active' => true],
            )->id;
        }

        foreach (FaqData::defaults() as $index => $item) {
            Faq::firstOrCreate(
                ['question' => $item['question']],
                [
                    'faq_category_id' => $ids[$item['category']] ?? null,
                    'answer' => $item['answer'],
                    'links' => $item['links'],
                    'sort_order' => $index + 1,
                    'is_active' => true,
                    'show_in_preview' => in_array($item['id'], FaqData::PREVIEW_IDS, true),
                ],
            );
        }
        FaqData::flush();

        return back()->with('success', 'Default FAQs loaded.');
    }

    // --- Helpers ------------------------------------------------------------------------------

    /** @return list<array{id: int, name: string}> */
    private function categoryOptions(): array
    {
        return FaqCategory::query()->orderBy('sort_order')->orderBy('id')->get(['id', 'name'])
            ->map(fn (FaqCategory $c) => ['id' => $c->id, 'name' => $c->name])->all();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $i = 2;

        while (FaqCategory::query()->where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    /** Renumbers the list 1..n (so ties can't stick), then swaps the row with its neighbour. */
    private function swap(\Illuminate\Database\Eloquent\Builder $query, int $id, int $step): void
    {
        $rows = $query->orderBy('sort_order')->orderBy('id')->get();

        foreach ($rows as $index => $row) {
            $row->sort_order = $index + 1;
        }

        $position = $rows->search(fn ($row) => $row->id === $id);
        $target = $position === false ? false : $position + $step;

        if ($position !== false && $target >= 0 && $target < $rows->count()) {
            [$rows[$position]->sort_order, $rows[$target]->sort_order] = [$rows[$target]->sort_order, $rows[$position]->sort_order];
        }

        foreach ($rows as $row) {
            $row->save();
        }
    }
}
