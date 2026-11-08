<?php

namespace App\Http\Controllers;

use App\Http\Requests\Public\SubmitLeadRequest;
use App\Http\Requests\Public\SubmitReviewRequest;
use App\Http\Traits\ProtectsPublicForms;
use App\Models\BusinessHour;
use App\Models\Deal;
use App\Models\Gallery;
use App\Models\GalleryCategory;
use App\Models\GalleryImage;
use App\Models\Lead;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\Review;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\AdminNewLeadAlert;
use App\Notifications\LeadReceived;
use App\Services\SecureUploadService;
use App\Services\SeoService;
use App\Support\FeaturedGalleryImages;
use App\Support\QrCode;
use App\Support\ServiceGuide;
use DOMDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PublicWebsiteController extends Controller
{
    use ProtectsPublicForms;

    public function __construct(private readonly SeoService $seo) {}

    /**
     * Attaches a page's server-rendered head (built by `SeoService`) to its Inertia response, twice:
     * - as Blade view data, so `resources/views/app.blade.php` writes the title / description /
     *   canonical / Open Graph tags and a crawlable `<h1>` straight into the raw HTML — no JavaScript
     *   (and no Node/SSR server, which shared hosting cannot run) needed for crawlers or link-preview
     *   bots (WhatsApp, Facebook) to see them;
     * - as the `seoMeta` prop (only the parts the browser needs), so `SeoHead.tsx` re-emits the
     *   identical tags under the same keys and Inertia's head manager swaps them 1:1 — no duplicates.
     *
     * @param array<string, mixed> $seo
     */
    private function withSeo(Response $response, array $seo): Response
    {
        return $response
            ->with('seoMeta', Arr::only($seo, ['title', 'canonical', 'meta']))
            ->withViewData(['seoMeta' => $seo]);
    }

    /**
     * The homepage's "Our Specialized Services" section is filterable by category, so it needs
     * enough spread that every filter pill has cards behind it — a plain `where('is_featured')`
     * limit of 6 left most pills rendering an empty grid. Featured services still come first within
     * each category, and each category is capped at 8 (two rows of four) to keep the payload small.
     */
    public function home(): Response
    {
        $services = Service::query()
            ->active()
            ->with(['category:id,name,stock_image_url', 'prices', 'reviews' => fn ($query) => $query->approved()])
            ->orderByDesc('is_featured')
            ->orderBy('sort')
            ->get()
            ->groupBy('service_category_id')
            ->map(fn ($group) => $group->take(8))
            ->flatten();

        return $this->withSeo(Inertia::render('Public/Home', [
            'featuredServices' => $services->map(fn (Service $service) => $this->serviceData($service)),
            'categories' => ServiceCategory::active()->ordered()->get(['id', 'name']),
            // Admin-curated bridal slider images, falling back to `public/images/` when nothing has
            // been ticked yet — see App\Support\FeaturedGalleryImages.
            'featured_gallery_images' => FeaturedGalleryImages::resolve(),
            'legacyStats' => $this->legacyStats(),
            'whatsapp' => $this->whatsappSupport(),
            'offers' => $this->offers(),
            'testimonials' => $this->testimonials(),
            'jsonLdSchema' => $this->seo->localBusiness(),
        ]), $this->seo->home($services));
    }

    /**
     * "Why Trust Looks Smart?" headline figures.
     *
     * These are the salon's own marketing claims, supplied verbatim in the task brief, and are
     * editorial copy rather than computed values — which is why they live here beside the About
     * page's other static content instead of being derived from the database.
     *
     * WORTH KNOWING before changing either side: the About page's quick-stat row is editorial too,
     * and its figures were specified separately — it claims "10+" years where this claims "12+", and
     * "50+ Certified Professionals" against 5 real `staff` rows. Both sets are the salon's own
     * marketing claims, kept verbatim and flagged rather than silently reconciled, since which
     * number is "right" is their call, not ours (§10 #41).
     *
     * @return list<array{icon: string, value: string, label: string, detail: string}>
     */
    private function legacyStats(): array
    {
        return [
            ['icon' => 'award', 'value' => '12+', 'label' => 'Years of Excellence', 'detail' => 'Serving Lahore since 2014'],
            ['icon' => 'users', 'value' => '50+', 'label' => 'Expert Stylists', 'detail' => 'Trained & certified professionals'],
            ['icon' => 'star', 'value' => '15K+', 'label' => 'Happy Clients', 'detail' => 'And counting every day'],
            ['icon' => 'camera', 'value' => '500+', 'label' => 'Transformations', 'detail' => 'Bridal, party & editorial looks'],
            ['icon' => 'shield', 'value' => '100%', 'label' => 'Sterilized Tools', 'detail' => 'Single-use where it matters'],
            ['icon' => 'heart', 'value' => '4.9★', 'label' => 'Google Rating', 'detail' => 'Verified customer reviews'],
        ];
    }

    /**
     * The salon's phone number and WhatsApp chat link, both derived from the one admin-editable
     * `business.phone` setting so every page that shows either can never drift from the real
     * number. Split out from `whatsappSupport()` (which adds a QR code) because several pages —
     * the blog listing and article sidebars among them — only need the number and link; generating
     * an SVG QR code on every blog page view for a value nobody renders would be pure waste.
     *
     * @return array{display_phone: string, chat_url: string}
     */
    private function whatsappContact(): array
    {
        $phone = (string) (Setting::get('business.phone') ?: '+92 305 9833859');
        // wa.me wants digits only, no `+`, no spaces.
        $chatUrl = 'https://wa.me/' . preg_replace('/\D/', '', $phone);

        return ['display_phone' => $phone, 'chat_url' => $chatUrl];
    }

    /**
     * @return array{display_phone: string, chat_url: string, qr_data_uri: string}
     */
    private function whatsappSupport(): array
    {
        $contact = $this->whatsappContact();

        return [...$contact, 'qr_data_uri' => QrCode::svgDataUri($contact['chat_url'])];
    }

    public function services(Request $request): Response
    {
        $search = $request->string('search')->trim()->value();
        $category = $request->integer('category');

        $services = Service::query()
            ->active()
            ->with(['category:id,name,stock_image_url', 'prices', 'reviews' => fn ($query) => $query->approved()])
            ->when($search, fn ($query) => $query->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            }))
            ->when($category, fn ($query) => $query->where('service_category_id', $category))
            ->orderBy('sort')
            ->orderBy('name')
            ->get();

        return $this->withSeo(Inertia::render('Public/Services', [
            'services' => $services->map(fn (Service $service) => $this->serviceData($service)),
            'categories' => ServiceCategory::active()->ordered()->get(['id', 'name']),
            'filters' => ['search' => $search ?: null, 'category' => $category ?: null],
        ]), $this->seo->servicesIndex($services, $search ?: null, $category ?: null));
    }

    public function detail(string $slug): Response
    {
        $service = Service::query()
            ->active()
            ->where('slug', $slug)
            ->with(['category:id,name,stock_image_url', 'prices', 'reviews' => fn ($query) => $query->approved()])
            ->firstOrFail();

        $relatedModels = Service::query()
            ->active()
            // Eager-loaded because serviceData() reads the category's stock image for the card
            // fallback — without this the 3 related cards would each fire their own query.
            ->with('category:id,name,stock_image_url')
            ->where('service_category_id', $service->service_category_id)
            ->whereKeyNot($service->id)
            ->orderBy('sort')
            ->limit(3)
            ->get();

        $related = $relatedModels->map(fn (Service $item) => $this->serviceData($item));
        $serviceData = $this->serviceData($service, true);

        return $this->withSeo(Inertia::render('Public/ServiceDetail', [
            'service' => $serviceData,
            // Treatment procedure, benefits/suitability and aftercare, resolved by treatment family
            // rather than per service — see ServiceGuide for why that is deliberate.
            'guide' => ServiceGuide::for($service),
            'relatedServices' => $related,
            'testimonials' => $service->reviews->map(fn (Review $review) => $this->reviewData($review)),
            'jsonLdSchema' => $this->seo->service($service),
        ]), $this->seo->serviceDetail($service, $relatedModels, $serviceData['price'], $serviceData['image_url']));
    }

    /**
     * Staff is deliberately no longer a booking-page prop: the wizard's redesign removed the staff
     * -selection step entirely (auto-assign — `AvailabilityEngine` already resolves a real, working
     * staff member per slot when no `staff_id` is requested, and `chooseSlot()` on the frontend reads
     * that assignment straight off the chosen slot). `categories` mirrors `home()`/`services()`'s own
     * `ServiceCategory::active()->ordered()` fetch — never a client-derived list from whatever
     * category strings happen to already be present in `services`, which would silently omit a real
     * category that has zero active services today.
     */
    public function booking(): Response
    {
        return $this->withSeo(Inertia::render('Public/Book', [
            'services' => Service::active()->with(['category:id,name,stock_image_url', 'prices'])->orderBy('sort')->orderBy('name')->get()->map(fn (Service $service) => $this->serviceData($service)),
            'categories' => ServiceCategory::active()->ordered()->get(['id', 'name']),
            // Active deals that actually have bookable services attached: picking one on the "Deals"
            // tab selects those services and applies the deal's promo code (same as "Claim Offer").
            'deals' => Deal::active()
                ->with('services:id,name,base_price')
                ->orderByDesc('is_top_deal')
                ->orderBy('ends_at')
                ->get()
                ->filter(fn (Deal $deal) => $deal->services->isNotEmpty())
                ->map(fn (Deal $deal) => [...$this->dealShowcaseData($deal), 'code' => $deal->code])
                ->values(),
            'authUser' => auth()->user()?->only(['name', 'email']),
        ]), $this->seo->booking());
    }

    /**
     * Stacked category sections (ad hoc task 20): every active album's images, grouped by its
     * admin-assigned `GalleryCategory` and rendered in that category's admin-defined `sort` order —
     * not per-album tabs anymore. A category with zero active images is skipped rather than
     * rendering an empty section; an active album with NO category assigned still has its images
     * shown, under one trailing "More Highlights" section, since an admin forgetting to categorize
     * an album is not a reason to silently drop its real photos from the public page.
     */
    public function gallery(): Response
    {
        $categories = GalleryCategory::query()
            ->with(['galleries' => fn ($query) => $query->active()->with(['images' => fn ($imagesQuery) => $imagesQuery->orderBy('sort')])])
            ->ordered()
            ->get();

        $sections = $categories
            ->map(fn (GalleryCategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'subtitle' => $category->subtitle,
                'images' => $category->galleries
                    ->flatMap(fn (Gallery $gallery) => $gallery->images)
                    ->map(fn (GalleryImage $image) => $this->galleryImageData($image))
                    ->values()
                    ->all(),
            ])
            ->filter(fn (array $section) => count($section['images']) > 0)
            ->values();

        $uncategorizedImages = Gallery::active()
            ->whereNull('gallery_category_id')
            ->with(['images' => fn ($query) => $query->orderBy('sort')])
            ->get()
            ->flatMap(fn (Gallery $gallery) => $gallery->images);

        if ($uncategorizedImages->isNotEmpty()) {
            $sections->push([
                'id' => 'uncategorized',
                'name' => 'More Highlights',
                'subtitle' => 'Additional favorites from our portfolio.',
                'images' => $uncategorizedImages->map(fn (GalleryImage $image) => $this->galleryImageData($image))->values()->all(),
            ]);
        }

        return $this->withSeo(Inertia::render('Public/Gallery', [
            'sections' => $sections->values()->all(),
        ]), $this->seo->gallery());
    }

    /** @return array<string, mixed> */
    private function galleryImageData(GalleryImage $image): array
    {
        return [
            'id' => $image->id,
            'image_path' => asset("storage/{$image->image_path}"),
            'image_path_webp' => $this->publicWebpUrl($image->image_path),
            'caption' => $image->caption,
            'is_before_after' => $image->is_before_after,
            'pair_image_path' => $image->pair_image_path ? asset("storage/{$image->pair_image_path}") : null,
            'pair_image_path_webp' => $image->pair_image_path ? $this->publicWebpUrl($image->pair_image_path) : null,
        ];
    }

    /**
     * Only returns a URL once the real `.webp` sibling `SecureUploadService::storePublicImage()`
     * writes actually exists on disk — an upload made before Phase 13 sub-step 2 (or one that was
     * already webp) has none, and `<picture>` breaks the image outright if `<source>` points at a
     * file that 404s, so this is never guessed.
     */
    private function publicWebpUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $webpPath = SecureUploadService::webpSiblingPath($path);

        return Storage::disk('public')->exists($webpPath) ? asset("storage/{$webpPath}") : null;
    }

    /**
     * The About page, rebuilt to the 7-section structure the salon specified.
     *
     * TWO THINGS DELIBERATELY DROPPED, both improvements rather than losses:
     *
     * 1. **The team roster.** It mapped over real `Staff` rows, but the seeded staff are
     *    factory-generated, so the live page was publishing five obviously-fake names
     *    ("Prof. Isaac Kessler II", "Barney Dare") on a real salon's site. The new structure has no
     *    team section, so this is gone until there are genuine staff records to show.
     * 2. **The live-computed stat band** (`Staff::active()->count()` etc.). The specified quick-stat
     *    row is editorial — "50+ Certified Professionals" against 5 real staff rows — so computing
     *    it would have contradicted the copy. See §10 #41: these are the salon's marketing claims,
     *    and the years figure here (10+) also differs from the homepage band's (12+), which was
     *    specified separately. Flagged rather than silently unified, since which is right is theirs
     *    to decide.
     *
     * Location, phone and opening hours are read from Settings / `business_hours` rather than
     * hardcoded, so the contact card cannot drift from the footer and contact page.
     */
    public function about(): Response
    {
        return $this->withSeo(Inertia::render('Public/About', [
            'quickStats' => [
                ['value' => '10+', 'label' => 'Years of Excellence'],
                ['value' => '50+', 'label' => 'Certified Professionals'],
                ['value' => '15K+', 'label' => 'Happy Clients'],
                ['value' => 'Lahore', 'label' => 'Flagship Salon Location'],
            ],
            'pillars' => $this->brandPillars(),
            'founder' => $this->founder(),
            'contact' => [
                'address' => Setting::get('business.address'),
                'phone' => Setting::get('business.phone'),
                'email' => Setting::get('business.email'),
                'whatsapp_url' => $this->whatsappContact()['chat_url'],
                'hours' => BusinessHour::orderBy('weekday')->get(['weekday', 'open_time', 'close_time', 'is_closed']),
            ],
        ]), $this->seo->about());
    }

    /**
     * The four-pillar "Looks Smart Standard", supplied verbatim in the brief. Replaces the previous
     * `brandValues()` copy, which covered the same ground in different words.
     *
     * @return list<array{icon: string, title: string, description: string}>
     */
    private function brandPillars(): array
    {
        return [
            [
                'icon' => 'heart',
                'title' => 'Care',
                'description' => 'Beauty regimens built around your specific skin and hair type, never a fixed menu applied to everyone.',
            ],
            [
                'icon' => 'shield',
                'title' => 'Hygiene',
                'description' => '100% sterilized tools, single-use kits where it matters, and clinical sanitation standards throughout.',
            ],
            [
                'icon' => 'scissors',
                'title' => 'Detail',
                'description' => 'Uncompromising precision in every snip, polish and treatment — the difference is in the finish.',
            ],
            [
                'icon' => 'sparkles',
                'title' => 'Artistry',
                'description' => 'Certified senior stylists trained in international technique, refining their craft continuously.',
            ],
        ];
    }

    /**
     * The founder's own profile — fixed editorial copy about the salon's owner, deliberately not
     * derived from a `Staff` row, so she cannot vanish from the page if that record is ever
     * deactivated.
     *
     * `photo_url` is the founder's own portrait (`public/images/founder-dua.webp`, 786x1024). Never
     * swap in a stock or bridal client photo — captioning it with her name would misrepresent a
     * real person. The About page falls back to a monogram if this is ever set back to null.
     *
     * @return array<string, mixed>
     */
    private function founder(): array
    {
        return [
            'name' => 'Dua',
            // Title per the salon's own brief for this page.
            'role' => 'Founder & Creative Director',
            'photo_url' => '/images/founder-dua.webp',
            'quote' => 'No two clients should ever leave with the same look.',
            'bio' => 'Dua founded Looks Smart Beauty Salon on a simple conviction: that beauty work should begin with a conversation, not a price list. A decade at the chair has made her a specialist in precision hair styling and signature bridal transformations — and she still personally consults on every bridal booking the salon takes.',
            'narrative' => 'What began as a single chair on Main Ferozpur Road has grown into a full-service salon with a private bridal suite, without ever becoming a production line. Dua trains every stylist who joins, keeps the appointment book deliberately unhurried, and holds the room to the same standard whether it is a Rs. 150 threading or a Rs. 60,000 bridal booking.',
            'highlights' => [
                'Precision cutting, styling and smoothing treatments',
                'Signature bridal and party makeup transformations',
                'One-on-one consultation before every appointment',
            ],
        ];
    }

    public function contact(): Response
    {
        $latitude = Setting::get('business.latitude');
        $longitude = Setting::get('business.longitude');

        return $this->withSeo(Inertia::render('Public/Contact', [
            'business' => [
                'name' => Setting::get('business.name'),
                'phone' => Setting::get('business.phone'),
                'email' => Setting::get('business.email'),
                'address' => Setting::get('business.address'),
                'facebook' => Setting::get('business.social_facebook'),
                'instagram' => Setting::get('business.social_instagram'),
                // Passed through so the map can be pinned on real coordinates instead of a
                // geocoded address string, which resolves to the wrong side of a long road often
                // enough to matter for a shopfront. Null when unset — the page falls back to the
                // address rather than fabricating a location.
                'latitude' => $latitude !== null ? (float) $latitude : null,
                'longitude' => $longitude !== null ? (float) $longitude : null,
            ],
            'businessHours' => BusinessHour::orderBy('weekday')->get(['weekday', 'open_time', 'close_time', 'is_closed']),
            // Latest three published posts for the page's "beauty tips & guides" row, reusing the
            // same mapper the blog index uses so the cards cannot drift from it.
            'latestPosts' => Post::query()
                ->published()
                ->with(['category:id,name', 'author:id,name'])
                ->orderBy('published_at', 'desc')
                ->orderBy('id', 'desc')
                ->limit(3)
                ->get()
                ->map(fn (Post $post) => $this->postListData($post))
                ->all(),
        ]), $this->seo->contact());
    }

    public function privacyPolicy(): Response
    {
        return $this->withSeo(Inertia::render('Public/PrivacyPolicy', [
            'business' => [
                'name' => Setting::get('business.name') ?: config('app.name'),
                'phone' => Setting::get('business.phone'),
                'email' => Setting::get('business.email'),
                'address' => Setting::get('business.address'),
            ],
            'effectiveDate' => 'January 2026',
        ]), $this->seo->privacy());
    }

    public function submitContact(SubmitLeadRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if (! $this->passesHoneypotAndTimeTrap($request)) {
            // Deliberately no error surfaced to the caller — a bot that fails the honeypot/time-trap
            // check gets the same "success" response a real visitor would, so it has no signal to
            // adapt against. No Lead row is created.
            return back()->with('success', 'Thanks for reaching out — we will be in touch shortly.');
        }

        $lead = Lead::create([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'],
            'source' => 'contact_form',
            'status' => 'new',
            // `leads` has no subject column, so it is prefixed onto the notes body — same approach
            // the previous `service_interest` field used, and what keeps the admin inbox readable.
            'notes' => trim((! empty($data['subject']) ? "Subject: {$data['subject']}\n\n" : '') . $data['message']),
        ]);

        $this->sendLeadNotifications($lead);

        return back()->with('success', 'Thanks for reaching out — we will be in touch shortly.');
    }

    /**
     * Admin alert + customer auto-reply. Each dispatch is individually try/caught (same reasoning as
     * `CreateBookingAction::sendNotifications()`): a mail failure must never turn a saved lead into
     * a 500 for the visitor.
     */
    private function sendLeadNotifications(Lead $lead): void
    {
        $admins = User::role(['admin', 'super-admin'])->get();

        try {
            if ($admins->isNotEmpty()) {
                Notification::send($admins, new AdminNewLeadAlert($lead));
            }
        } catch (\Throwable $e) {
            Log::error("Failed to send AdminNewLeadAlert for lead {$lead->id}: {$e->getMessage()}", ['exception' => $e]);
        }

        try {
            $adminEmail = config('mail.admin_notification_email');
            if ($adminEmail && ! $admins->pluck('email')->contains($adminEmail)) {
                Notification::route('mail', $adminEmail)->notify(new AdminNewLeadAlert($lead));
            }
        } catch (\Throwable $e) {
            Log::error("Failed to send AdminNewLeadAlert to ADMIN_NOTIFICATION_EMAIL for lead {$lead->id}: {$e->getMessage()}", ['exception' => $e]);
        }

        if ($lead->email) {
            try {
                Notification::route('mail', $lead->email)->notify(new LeadReceived($lead));
            } catch (\Throwable $e) {
                Log::error("Failed to send LeadReceived for lead {$lead->id}: {$e->getMessage()}", ['exception' => $e]);
            }
        }
    }

    /**
     * The "Write a Review" modal's real save-to-site half. Called via a plain `axios.post()` from
     * inside the modal (not an Inertia visit — closing/resetting the modal and prepending the new
     * review into the on-page carousel are both handled client-side without a full page reload), so
     * this returns JSON rather than a redirect, unlike `submitContact()` above.
     *
     * Published immediately (`status = 'approved'`, `published_at = now()`) rather than routed
     * through `Admin\ReviewController`'s moderation queue — the task explicitly asks for it to
     * "appear in website testimonials instantly", and the same honeypot/time-trap/rate-limit gate
     * every other public form on this site already uses is the anti-abuse layer here too.
     */
    public function submitReview(SubmitReviewRequest $request): JsonResponse
    {
        if (! $this->passesHoneypotAndTimeTrap($request)) {
            // Same "fake success, no row created" anti-bot pattern as submitContact() — a bot that
            // fails the gate gets a 200 with no review data, so the client shows its normal success
            // toast and the bot has no signal that it was silently dropped.
            return response()->json(['ok' => true, 'review' => null]);
        }

        $data = $request->validated();
        $user = $request->user();

        // `name` is optional per the task spec — a blank guest name defaults to "Verified Guest"
        // rather than left null, which `Review::getDisplayNameAttribute()`'s own fallback ('Client')
        // would otherwise show; this is a self-submitted testimonial, not an anonymous one, so it
        // gets the more specific default the task literally asks for.
        $review = Review::create([
            'customer_id' => $user?->id,
            'reviewer_name' => $user ? null : ($data['name'] ?? 'Verified Guest'),
            'reviewer_category' => $data['category'] === Review::WRITE_REVIEW_OTHER
                ? trim(strip_tags((string) $data['custom_service']))
                : $data['category'],
            'rating' => $data['rating'],
            'body' => $data['body'],
            'source' => 'organic',
            'status' => 'approved',
            'published_at' => now(),
        ]);

        return response()->json(['ok' => true, 'review' => $this->reviewData($review)]);
    }

    public function blog(Request $request): Response
    {
        $search = $request->string('search')->trim()->value();
        $category = $request->integer('category');
        $perPage = 12;
        // The hero banner shows the newest post separately from the grid; only relevant on an
        // unfiltered first page, since "the featured post" stops meaning anything once the visitor
        // has searched or filtered.
        $showFeatured = ! $search && ! $category && $request->integer('page') <= 1;

        $query = Post::query()
            ->published()
            ->with(['category:id,name', 'author:id,name'])
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('excerpt', 'like', "%{$search}%")
                    ->orWhere('body', 'like', "%{$search}%");
            }))
            ->when($category, fn ($q) => $q->where('post_category_id', $category))
            ->orderBy('published_at', 'desc')
            ->orderBy('id', 'desc');

        $posts = $query->paginate($perPage);
        $listedPosts = $posts->map(fn (Post $post) => $this->postListData($post))->all();

        return $this->withSeo(Inertia::render('Public/Blog', [
            // The grid excludes the featured post so it is never shown twice on the same page.
            'featuredPost' => $showFeatured ? ($listedPosts[0] ?? null) : null,
            'posts' => $showFeatured ? array_slice($listedPosts, 1) : $listedPosts,
            'pagination' => [
                'total' => $posts->total(),
                'per_page' => $posts->perPage(),
                'current_page' => $posts->currentPage(),
                'last_page' => $posts->lastPage(),
                'path' => $posts->path(),
            ],
            'categories' => PostCategory::whereHas('posts', fn ($q) => $q->published())
                ->orderBy('name')
                ->get(['id', 'name', 'slug']),
            'filters' => ['search' => $search ?: null, 'category' => $category ?: null],
            // "Trending This Week" is an honest proxy, not real analytics — this app tracks no page
            // views or read counts anywhere, so labelling anything else "trending" would fabricate
            // a metric that does not exist. Most-recently-published is the closest genuine signal
            // available, explicitly documented as such rather than dressed up as real analytics.
            'trendingPosts' => Post::query()
                ->published()
                ->orderBy('published_at', 'desc')
                ->limit(5)
                ->get(['id', 'title', 'slug', 'published_at'])
                ->map(fn (Post $post) => [
                    'id' => $post->id,
                    'title' => $post->title,
                    'slug' => $post->slug,
                ]),
            'quickServiceLinks' => $this->quickServiceLinks(),
            'whatsapp' => $this->whatsappContact(),
        ]), $this->seo->blogIndex($posts->getCollection(), $search ?: null, $category ?: null, $posts->currentPage()));
    }

    /**
     * "Our Services" sidebar quick links — the real 5 catalog categories, in their real display
     * order, each linking to the already-filterable services index. Never hardcoded: a category
     * renamed or reordered in the admin catalog updates this list with no code change.
     *
     * @return list<array{name: string, href: string}>
     */
    private function quickServiceLinks(): array
    {
        return ServiceCategory::active()
            ->ordered()
            ->get(['id', 'name'])
            ->map(fn (ServiceCategory $category) => [
                'name' => $category->name,
                'href' => "/services?category={$category->id}",
            ])
            ->all();
    }

    public function blogShow(string $slug): Response
    {
        $post = Post::query()
            ->published()
            ->where('slug', $slug)
            ->with(['category:id,name', 'author:id,name', 'tags:id,name'])
            ->firstOrFail();

        // Generate Table of Contents from HTML headings
        $toc = $this->extractTableOfContents($post->body);

        // Calculate reading time (average 200 words per minute)
        $wordCount = str_word_count(strip_tags($post->body));
        $readingTimeMinutes = max(1, ceil($wordCount / 200));

        // Get related articles
        // Same-category first, then top up with the newest other posts if the category alone
        // does not reach 3 — a category with only one article (Laser, at launch) would otherwise
        // render an empty "Related articles" section rather than the spec's "2-3 recommended
        // posts". `whereNotIn` rather than a second `whereKeyNot` keeps the two queries from
        // ever returning the same post twice.
        $sameCategory = Post::query()
            ->published()
            ->where('post_category_id', $post->post_category_id)
            ->whereKeyNot($post->id)
            ->orderBy('published_at', 'desc')
            ->limit(3)
            ->get();

        $relatedPosts = $sameCategory->count() >= 3
            ? $sameCategory
            : $sameCategory->concat(
                Post::query()
                    ->published()
                    ->whereNotIn('id', [$post->id, ...$sameCategory->pluck('id')])
                    ->orderBy('published_at', 'desc')
                    ->limit(3 - $sameCategory->count())
                    ->get(),
            );

        $relatedPosts = $relatedPosts
            ->load(['category:id,name', 'author:id,name'])
            ->map(fn (Post $p) => $this->postListData($p));

        // Generate JSON-LD schema
        $jsonLd = $this->seo->blogPosting($post, $wordCount, $readingTimeMinutes);

        return $this->withSeo(Inertia::render('Public/BlogDetail', [
            'post' => [
                'id' => $post->id,
                'title' => $post->title,
                'slug' => $post->slug,
                'excerpt' => $post->excerpt,
                'body' => $post->body,
                'cover_image_path' => $this->postCoverUrl($post),
                'seo_title' => $post->seo_title,
                'seo_description' => $post->seo_description,
                'published_at' => $post->published_at->toIso8601String(),
                'author' => [
                    'id' => $post->author?->id,
                    'name' => $post->author?->name ?? 'Admin',
                ],
                'category' => $post->category ? [
                    'id' => $post->category->id,
                    'name' => $post->category->name,
                    'slug' => $post->category->slug,
                ] : null,
                'tags' => $post->tags->map(fn ($tag) => ['id' => $tag->id, 'name' => $tag->name])->all(),
            ],
            'readingTimeMinutes' => $readingTimeMinutes,
            'wordCount' => $wordCount,
            'tableOfContents' => $toc,
            'jsonLdSchema' => $jsonLd,
            'relatedPosts' => $relatedPosts->all(),
            'whatsapp' => $this->whatsappContact(),
            'location' => [
                'address' => Setting::get('business.address'),
            ],
        ]), $this->seo->blogPost($post, $relatedPosts, $this->postCoverUrl($post)));
    }

    /** @return array<array<string, mixed>> */
    private function extractTableOfContents(string $html): array
    {
        $toc = [];

        // Parse HTML to extract headings
        libxml_use_internal_errors(true);
        $dom = new DOMDocument;
        $dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        libxml_clear_errors();

        $xpath = new \DOMXPath($dom);
        $headings = $xpath->query('//h1|//h2|//h3|//h4|//h5|//h6');

        $current_id = 0;
        foreach ($headings as $heading) {
            $level = (int) substr($heading->nodeName, 1);
            $text = trim($heading->textContent ?? '');

            if (empty($text)) {
                continue;
            }

            $current_id++;
            $id = "heading-{$current_id}";

            $toc[] = [
                'id' => $id,
                'level' => $level,
                'text' => $text,
            ];
        }

        return $toc;
    }

    /** @return array<string, mixed> */
    /** @return array<string, mixed> */
    /**
     * A real admin-uploaded cover (`cover_image_path`, via `SecureUploadService` onto the `public`
     * disk) always wins over the seeded external `cover_image_url` — same precedence as
     * `ServiceCategory`'s `stock_image_url` fallback. Null only when neither exists, so a post
     * without a cover renders its own empty state rather than a broken `<img>`.
     */
    private function postCoverUrl(Post $post): ?string
    {
        if ($post->cover_image_path) {
            return asset("storage/{$post->cover_image_path}");
        }

        if (! $post->cover_image_url) {
            return null;
        }

        // `cover_image_url` can hold either a full external URL (the Unsplash stock photos) or a
        // root-relative `public/images/` path (the one real local asset seeded for the flagship
        // article). SeoHead renders this straight into `og:image`/`twitter:image`, and social
        // platforms generally require an ABSOLUTE URL there — a bare `/images/...` path would
        // silently fail to unfurl on share. `url()` is a no-op on an already-absolute URL.
        return str_starts_with($post->cover_image_url, 'http')
            ? $post->cover_image_url
            : url($post->cover_image_url);
    }

    private function postListData(Post $post): array
    {
        $wordCount = str_word_count(strip_tags($post->body));
        $readingTimeMinutes = max(1, ceil($wordCount / 200));

        return [
            'id' => $post->id,
            'title' => $post->title,
            'slug' => $post->slug,
            'excerpt' => $post->excerpt,
            'cover_image_path' => $this->postCoverUrl($post),
            'published_at' => $post->published_at->toIso8601String(),
            'author' => [
                'id' => $post->author?->id,
                'name' => $post->author?->name ?? 'Admin',
            ],
            'category' => $post->category ? [
                'id' => $post->category->id,
                'name' => $post->category->name,
                'slug' => $post->category->slug,
            ] : null,
            'readingTimeMinutes' => $readingTimeMinutes,
        ];
    }

    /** @return array<string, mixed> */
    /**
     * Original upload for the detail banner; the sharper 'card' conversion for cards, falling back
     * to 'thumb' for images uploaded before 'card' existed (until media-library:regenerate is run).
     */
    private function serviceImageUrl(Service $service, bool $detail): string
    {
        $media = $service->getFirstMedia('image');

        if (! $media) {
            return '';
        }

        if ($detail) {
            return $media->hasGeneratedConversion('banner') ? $media->getUrl('banner') : $media->getUrl();
        }

        return $media->hasGeneratedConversion('card') ? $media->getUrl('card') : $media->getUrl('thumb');
    }

    private function serviceData(Service $service, bool $detail = false): array
    {
        $price = $service->prices
            ->filter(fn ($override) => $override->price_list === 'standard')
            ->sortByDesc('effective_from')
            ->first()?->price ?? $service->base_price;

        return [
            'id' => $service->id,
            'name' => $service->name,
            'slug' => $service->slug,
            // Admin-entered descriptions sometimes carry wrapping HTML (<p>…</p>) from the import/editor;
            // the page renders it as plain text, so strip tags and decode entities here.
            'description' => $detail && $service->description !== null
                ? trim(html_entity_decode(strip_tags($service->description), ENT_QUOTES | ENT_HTML5))
                : null,
            'category' => $service->category?->name,
            'category_id' => $service->service_category_id,
            'duration_min' => $service->duration_min,
            'price' => (string) $price,
            // Real uploaded salon photography (medialibrary) always wins; the service's own pasted
            // `stock_image_url` (admin panel "paste a URL instead of uploading", see
            // ServiceController::applyImage()) is the next fallback, then the category's remote
            // stock photo. Null only if none of the three exist, in which case the UI shows its own
            // empty state rather than a broken image.
            // The detail page shows the image as a full-width banner, so it gets the original upload;
            // the 400px 'thumb' conversion (right for cards) looks blurry when stretched that wide.
            'image_url' => $this->serviceImageUrl($service, $detail)
                ?: ($service->stock_image_url ?: ($service->category?->stock_image_url ?: null)),
            'faq' => $detail ? $service->faq : null,
            'rating' => $service->relationLoaded('reviews') ? round((float) $service->reviews->avg('rating'), 1) : null,
            'review_count' => $service->relationLoaded('reviews') ? $service->reviews->count() : 0,
        ];
    }

    /**
     * Homepage "Current offers" compact grid — capped at 6 (a balanced 2-row, 3-column grid) and
     * ranked the same way `deals()`'s own Top Deals bucket is (pinned first, soonest-ending next),
     * so the homepage naturally surfaces the deals an admin cares most about rather than an arbitrary
     * slice. Each entry is `dealShowcaseData()` (what /deals uses, so the Details popup works from
     * here too) plus `type`/`value`/`code` for the compact card's own badge and code chip.
     */
    private function offers(): array
    {
        return Deal::active()
            ->with('services:id,name,base_price')
            ->orderByDesc('is_top_deal')
            ->orderBy('ends_at')
            ->limit(6)
            ->get()
            // The same payload the /deals page cards use (so the "Details" popup can open straight
            // from a homepage offer), plus the few extra fields the compact homepage card reads.
            ->map(fn (Deal $deal) => [
                ...$this->dealShowcaseData($deal),
                'type' => $deal->type,
                'value' => (string) $deal->value,
                'code' => $deal->code,
            ])->all();
    }

    /**
     * Shared by the homepage banner and the full `/deals` page so "Claim Offer"/"Add to Cart" always
     * means the same thing everywhere: land on `/book` with the deal's real, actually-bookable
     * services already pre-selected (`Book.tsx` reads every repeated `service=` param, the same
     * pattern a single "Book now" link already used) plus the promo code applied. A deal with no
     * linked services (marketing-copy-only) or no code degrades gracefully to whichever of the two
     * it does have, exactly like the single-service `?service=<id>` link this mirrors.
     */
    private function dealClaimUrl(Deal $deal): string
    {
        $params = $deal->services->map(fn (Service $service) => 'service=' . $service->id)->all();
        if ($deal->code) {
            $params[] = 'code=' . urlencode($deal->code);
        }

        return $params ? '/book?' . implode('&', $params) : '/book';
    }

    /**
     * Real, per-service data for a "Add to Cart" action to build genuine cart line items from (name,
     * a display price, a thumbnail) — rather than the client re-deriving this from `claim_url`'s bare
     * ids, which carries no name/price/image at all. `base_price` is a display estimate only; the
     * real charged amount is always re-quoted server-side at booking confirm time regardless of what
     * the cart displays.
     *
     * @return array<int, array<string, mixed>>
     */
    private function dealBundledServices(Deal $deal): array
    {
        return $deal->services
            ->map(fn (Service $service) => [
                'id' => $service->id,
                'name' => $service->name,
                'price' => (string) $service->base_price,
                'image_url' => $service->getFirstMediaUrl('image', 'thumb') ?: null,
            ])
            ->all();
    }

    /**
     * The Deals & Offers showcase page — distinct from the small `offers()` banner above, which
     * every active deal (tagged or not) feeds into. This page only shows deals an admin has
     * deliberately given a `category_tag`; an admin-only or homepage-banner-only discount with no
     * tag simply never appears here, which is the point of the field being nullable.
     *
     * Grouped by tag for the per-category carousels, PLUS a synthetic "Top Deals" bucket that is
     * NOT a 7th tag — it is `category_tag === 'Top Deals'` unioned with any OTHER deal an admin has
     * separately pinned via `is_top_deal`, deduplicated. That is a deliberate two-layer design: a
     * deal's tag says which single section it primarily belongs to, while the pin lets a genuinely
     * popular Hair/Skin/etc. deal also surface in Top Deals without being reclassified away from
     * its real category. Documented on the `is_top_deal` migration column too.
     */
    public function deals(): Response
    {
        $deals = Deal::active()
            ->whereNotNull('category_tag')
            ->with('services:id,name,base_price')
            ->orderByDesc('is_top_deal')
            ->orderBy('ends_at')
            ->get();

        $showcase = $deals->map(fn (Deal $deal) => $this->dealShowcaseData($deal));

        $topDeals = $showcase
            ->filter(fn (array $deal) => $deal['category_tag'] === 'Top Deals' || $deal['is_top_deal'])
            ->values();

        $sections = collect(Deal::CATEGORY_TAGS)
            ->reject(fn (string $tag) => $tag === 'Top Deals')
            ->map(fn (string $tag) => [
                'tag' => $tag,
                'deals' => $showcase->where('category_tag', $tag)->values(),
            ])
            // Sections with zero deals are dropped rather than rendered empty — mirrors the blog
            // index only listing categories that actually have a published post.
            ->reject(fn (array $section) => $section['deals']->isEmpty())
            ->values();

        if ($topDeals->isNotEmpty()) {
            $sections->prepend(['tag' => 'Top Deals', 'deals' => $topDeals]);
        }

        return $this->withSeo(Inertia::render('Public/Deals', [
            'sections' => $sections,
            // Only tabs with at least one deal behind them — a tab that filters to nothing is worse
            // than not offering the filter at all.
            'availableTags' => $sections->pluck('tag')->all(),
            'whatsapp' => $this->whatsappContact(),
        ]), $this->seo->deals($deals->pluck('title')->filter()->values()->all()));
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * `deals.image_path` normally holds a LOCAL storage-relative path from a real admin upload via
     * `SecureUploadService` (resolved through `asset("storage/{path}")`), but the seeded showcase
     * deals have no real uploaded photo and instead write a full external Unsplash URL into that
     * same column. Checking for an absolute URL first — rather than always prefixing `storage/` —
     * is what stops a seeded deal's image resolving to a broken `.../storage/https://...` path.
     * The moment a real admin upload replaces it, `image_path` holds a genuine local path again and
     * this still resolves correctly, so no migration or admin-side change is needed either way.
     *
     * Falls back to `stock_image_url` (the admin panel's "paste a URL instead of uploading" field,
     * see `DealController::applyImage()`) when there is no `image_path` at all — same precedence
     * used everywhere else a deal/service image is resolved: a real upload always wins, the remote
     * URL is only the fallback.
     */
    private function dealImageUrl(Deal $deal): ?string
    {
        if ($deal->image_path) {
            return str_starts_with($deal->image_path, 'http')
                ? $deal->image_path
                : asset("storage/{$deal->image_path}");
        }

        return $deal->stock_image_url ?: null;
    }

    private function dealShowcaseData(Deal $deal): array
    {
        // Free-text marketing checklist first; falls back to the real attached services' names so
        // a deal an admin wired up via the "Applicable services" picker but never wrote bullet
        // copy for still shows a genuine, non-empty checklist rather than nothing.
        $includedServices = $deal->included_services && count($deal->included_services) > 0
            ? $deal->included_services
            : $deal->services->pluck('name')->all();

        return [
            'id' => $deal->id,
            'slug' => $deal->slug,
            'title' => $deal->title,
            'subtitle' => $deal->subtitle,
            'category_tag' => $deal->category_tag,
            'is_top_deal' => $deal->is_top_deal,
            'original_price' => $deal->original_price !== null ? (string) $deal->original_price : null,
            'deal_price' => $deal->deal_price !== null ? (string) $deal->deal_price : null,
            'savings_percent' => $deal->savings_percent,
            'included_services' => $includedServices,
            'description' => $deal->description,
            'terms' => $deal->terms,
            'image_url' => $this->dealImageUrl($deal),
            'ends_at' => $deal->ends_at?->toIso8601String(),
            'claim_url' => $this->dealClaimUrl($deal),
            'bundled_services' => $this->dealBundledServices($deal),
        ];
    }

    /**
     * Feeds the homepage Reviews Carousel. Raised from the old static grid's `limit(6)` to 12 so a
     * 3-per-page carousel actually has more than one page to rotate through.
     *
     * Every `approved`+`published_at` review (Google ones the admin pasted in, and visitor-submitted
     * ones), in the admin's own order: Admin > Reviews > "Homepage order" sets `sort` (lowest first),
     * ties fall back to newest. Hiding a review there (status `rejected`) removes it from here.
     */
    private function testimonials(): array
    {
        return Review::approved()->whereNotNull('published_at')->with(['customer:id,name', 'service:id,service_category_id', 'service.category:id,name'])->orderBy('sort')->latest('published_at')->limit(12)->get()->map(fn (Review $review) => $this->reviewData($review))->all();
    }

    private function reviewData(Review $review): array
    {
        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'name' => $review->display_name,
            'category' => $review->display_category,
            'source' => $review->source,
        ];
    }
}
