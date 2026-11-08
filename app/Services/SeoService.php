<?php

namespace App\Services;

use App\Models\BusinessHour;
use App\Models\Post;
use App\Models\Service;
use App\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Phase 13 sub-step 1: the single place JSON-LD structured data gets built, so `BeautySalon`/
 * `Service`/`BlogPosting` schemas all read the same real, admin-editable source (Phase 10 Settings /
 * `BusinessHour` / the models themselves) instead of each page hand-rolling its own — and so nothing
 * in this app's structured data ever hardcodes a placeholder value (a fallback image path, a fake
 * price) that isn't backed by real data. Replaces `PublicWebsiteController::generateArticleJsonLd()`,
 * which hardcoded `/images/default-article.png` and `/images/logo.png` — neither file has ever
 * existed on disk (confirmed: `public/images/` doesn't exist), so every blog post's JSON-LD image has
 * been a broken URL since Phase 9 sub-step 6. Fixed here by falling back to the real
 * `business.logo_path` upload, or omitting `image` entirely rather than pointing at nothing.
 */
class SeoService
{
    private const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    /**
     * The area the salon is known by. Only ever used inside render-time FALLBACK copy for records
     * whose own SEO fields are empty/too short — never written back to the database.
     */
    private const AREA = 'Central Park Housing Scheme, Lahore';

    private const LOCALE = 'en_PK';

    private const DESCRIPTION_MAX = 158;

    /** A description shorter than this (after stripping tags) is treated as "not really there". */
    private const DESCRIPTION_MIN = 50;

    /* ---------------------------------------------------------------------------------------------
     | Server-rendered page head (Phase 1 of the SEO work)
     |---------------------------------------------------------------------------------------------
     | Why this exists: the public site is a React SPA and live hosting (shared, no Node) cannot run
     | Inertia SSR, so the raw HTML a crawler first receives had no title/description/canonical/OG/H1
     | at all. Every public controller now builds one of these arrays here (from the real database
     | rows, on every request — so old AND newly-added services/posts are covered with no rebuild) and
     | hands it to `resources/views/app.blade.php` (raw HTML) and to `SeoHead.tsx` (so the browser
     | re-emits the identical tags and Inertia's head manager swaps them 1:1 instead of duplicating).
     */

    /**
     * @param array{image?: ?string, type?: string, robots?: ?string, intro?: ?string, links?: list<array{label: string, url: string}>} $options
     * @return array{title: string, fullTitle: string, description: string, canonical: string, h1: string, intro: ?string, robots: ?string, meta: list<array{attr: string, key: string, content: string}>, links: list<array{label: string, url: string}>, nav: list<array{label: string, url: string}>}
     */
    public function page(string $title, ?string $description, string $canonical, string $h1, array $options = []): array
    {
        $siteName = $this->businessName();
        $fullTitle = str_contains($title, $siteName) ? $title : "{$title} - {$siteName}";
        $description = $this->limit($this->plainText($description) ?: $this->defaultDescription());
        $image = $this->absoluteUrl($options['image'] ?? null) ?? $this->defaultImageUrl();
        $robots = $options['robots'] ?? null;

        $meta = [
            ['attr' => 'name', 'key' => 'description', 'content' => $description],
        ];

        if ($robots) {
            $meta[] = ['attr' => 'name', 'key' => 'robots', 'content' => $robots];
        }

        array_push(
            $meta,
            ['attr' => 'property', 'key' => 'og:site_name', 'content' => $siteName],
            ['attr' => 'property', 'key' => 'og:locale', 'content' => self::LOCALE],
            ['attr' => 'property', 'key' => 'og:type', 'content' => $options['type'] ?? 'website'],
            ['attr' => 'property', 'key' => 'og:title', 'content' => $fullTitle],
            ['attr' => 'property', 'key' => 'og:description', 'content' => $description],
            ['attr' => 'property', 'key' => 'og:url', 'content' => $canonical],
        );

        if ($image) {
            $meta[] = ['attr' => 'property', 'key' => 'og:image', 'content' => $image];
        }

        array_push(
            $meta,
            ['attr' => 'name', 'key' => 'twitter:card', 'content' => $image ? 'summary_large_image' : 'summary'],
            ['attr' => 'name', 'key' => 'twitter:title', 'content' => $fullTitle],
            ['attr' => 'name', 'key' => 'twitter:description', 'content' => $description],
        );

        if ($image) {
            $meta[] = ['attr' => 'name', 'key' => 'twitter:image', 'content' => $image];
        }

        return [
            'title' => $title,
            'fullTitle' => $fullTitle,
            'description' => $description,
            'canonical' => $canonical,
            'h1' => $h1,
            'intro' => $options['intro'] ?? null,
            'robots' => $robots,
            'meta' => $meta,
            'links' => $options['links'] ?? [],
            'nav' => $this->navLinks(),
        ];
    }

    /** @return array<string, mixed> */
    public function home(Collection $services): array
    {
        return $this->page(
            'Thoughtful beauty, beautifully done',
            'Hair, skin, and nail care in a calm, considered salon space.',
            route('home'),
            'Looks Smart Beauty Salon',
            [
                'intro' => 'A modern sanctuary for premium skin, hair, and bridal artistry in Lahore.',
                'links' => $this->serviceLinks($services->take(12)),
            ],
        );
    }

    /** @return array<string, mixed> */
    public function servicesIndex(Collection $services, ?string $search, ?int $category): array
    {
        return $this->page(
            'Services',
            'Explore hair, skin, and nail services at Looks Smart Beauty Salon.',
            route('services.index'),
            'Services for your next chapter.',
            [
                'intro' => 'Hair, skin, bridal makeup, waxing, threading and spa services at Looks Smart Beauty Salon, ' . self::AREA . '.',
                'links' => $this->serviceLinks($services),
                // A search box result or a category filter is a thin, duplicate view of /services:
                // keep it out of the index but let crawlers follow the links on it.
                'robots' => ($search || $category) ? 'noindex,follow' : null,
            ],
        );
    }

    /**
     * @param string|null $price the already-resolved DB price (PublicWebsiteController::serviceData)
     * @param string|null $image the already-resolved service image URL
     * @return array<string, mixed>
     */
    public function serviceDetail(Service $service, Collection $related, ?string $price, ?string $image): array
    {
        $description = $this->serviceDescription($service);
        $facts = array_filter([
            $service->category?->name ? "Category: {$service->category->name}" : null,
            $service->duration_min ? "Duration: {$service->duration_min} minutes" : null,
            $this->formatPrice($price) ? 'Price: ' . $this->formatPrice($price) : null,
        ]);

        return $this->page(
            $service->seo_title ?: $service->name,
            $description,
            route('services.show', $service->slug),
            $service->name,
            [
                'image' => $image,
                'intro' => trim($this->endSentence($description) . ' ' . implode(' · ', $facts)),
                'links' => [
                    ['label' => 'Book an Appointment', 'url' => route('book')],
                    ['label' => 'All services', 'url' => route('services.index')],
                    ...$this->serviceLinks($related),
                ],
            ],
        );
    }

    /** @return array<string, mixed> */
    public function booking(): array
    {
        return $this->page(
            'Book an Appointment',
            'Choose your service, time, and details at Looks Smart Beauty Salon.',
            route('book'),
            'Book an appointment',
            ['intro' => 'Pick your services and a time that suits you — online booking for Looks Smart Beauty Salon, ' . self::AREA . '.'],
        );
    }

    /** @param  list<string>  $dealTitles */
    public function deals(array $dealTitles): array
    {
        return $this->page(
            'Deals & Offers',
            'Limited-time special offers and curated beauty packages tailored for you.',
            route('deals.index'),
            'Exclusive Deals & Packages',
            [
                'intro' => $dealTitles ? 'Current offers: ' . implode(', ', array_slice($dealTitles, 0, 12)) . '.' : null,
                'links' => [['label' => 'Book an Appointment', 'url' => route('book')]],
            ],
        );
    }

    /** @return array<string, mixed> */
    public function gallery(): array
    {
        return $this->page(
            'Gallery',
            'Real results from our hair, skin, bridal, and beauty work at Looks Smart.',
            route('gallery.index'),
            'Our Salon Gallery',
            ['intro' => 'Real results from our hair, skin, bridal, and beauty work.'],
        );
    }

    /** @return array<string, mixed> */
    public function blogIndex(Collection $posts, ?string $search, ?int $category, int $page): array
    {
        return $this->page(
            'Beauty, Skin & Confidence',
            "Expert advice from Lahore's leading beauty salon and skin clinic.",
            $page > 1 && ! $search && ! $category ? route('blog.index', ['page' => $page]) : route('blog.index'),
            'Beauty, Skin & Confidence',
            [
                'intro' => 'Beauty, skin and hair advice from the team at Looks Smart Beauty Salon, Lahore.',
                'links' => $posts->map(fn (Post $post) => [
                    'label' => $post->title,
                    'url' => route('blog.show', $post->slug),
                ])->values()->all(),
                'robots' => ($search || $category) ? 'noindex,follow' : null,
            ],
        );
    }

    /**
     * @param Collection<int, array<string, mixed>> $related already-mapped related posts (title/slug)
     * @return array<string, mixed>
     */
    public function blogPost(Post $post, Collection $related, ?string $cover): array
    {
        return $this->page(
            $post->seo_title ?: $post->title,
            $this->postDescription($post),
            route('blog.show', $post->slug),
            $post->title,
            [
                'type' => 'article',
                'image' => $cover,
                'intro' => $this->postDescription($post),
                'links' => [
                    ['label' => 'All articles', 'url' => route('blog.index')],
                    ['label' => 'Book an Appointment', 'url' => route('book')],
                    ...$related->map(fn (array $item) => [
                        'label' => (string) $item['title'],
                        'url' => route('blog.show', $item['slug']),
                    ])->all(),
                ],
            ],
        );
    }

    /** @return array<string, mixed> */
    public function about(): array
    {
        return $this->page(
            'About Us',
            'Crafting premium beauty, hair, and skin experiences in Lahore — meet the team and philosophy behind Looks Smart Beauty Salon.',
            route('about'),
            'About Looks Smart Beauty Salon',
            ['intro' => 'Premium beauty, hair, and skin care in ' . self::AREA . '.'],
        );
    }

    /** @return array<string, mixed> */
    public function contact(): array
    {
        return $this->page(
            'Contact Us',
            'Talk to Looks Smart Beauty Salon — book an appointment, ask about a treatment, or plan a bridal visit.',
            route('contact'),
            'Talk to Looks Smart — anytime, any way you like',
            [
                'intro' => 'Book an appointment, ask about a treatment, or plan a bridal visit.',
                'links' => [['label' => 'Book an Appointment', 'url' => route('book')]],
            ],
        );
    }

    /** @return array<string, mixed> */
    public function privacy(): array
    {
        return $this->page(
            'Privacy Policy',
            "How {$this->businessName()} collects, uses, and protects your personal information.",
            route('privacy-policy'),
            'Privacy Policy',
        );
    }

    /**
     * Description for a service: the admin's own SEO description, then its regular description —
     * each only if it is actually usable — and otherwise a natural render-time sentence built from
     * the service's name and category. The database row is never touched.
     */
    public function serviceDescription(Service $service): string
    {
        foreach ([$service->seo_description, $service->description] as $candidate) {
            $text = $this->plainText($candidate);

            if ($this->isUsableDescription($text)) {
                return Str::limit($text, 600, '…', true);
            }
        }

        $tail = " at {$this->businessName()}, " . self::AREA . '. Book your appointment online.';
        $category = $service->category?->name;
        $withCategory = "{$service->name} ({$category}){$tail}";

        // Keep the whole sentence under the meta-description limit so it never gets cut mid-sentence:
        // drop the category first, and only truncate (inside page()) if the name alone is that long.
        return ($category && mb_strlen($withCategory) <= self::DESCRIPTION_MAX) ? $withCategory : "{$service->name}{$tail}";
    }

    /** Same idea for a blog post: seo_description, excerpt, opening of the body, then a sentence. */
    public function postDescription(Post $post): string
    {
        foreach ([$post->seo_description, $post->excerpt, $post->body] as $candidate) {
            $text = $this->plainText($candidate);

            if ($this->isUsableDescription($text)) {
                // (the body can be thousands of characters — only its opening is ever wanted)
                return Str::limit($text, 300, '…', true);
            }
        }

        return "{$post->title} — beauty advice from the team at {$this->businessName()}, " . self::AREA . '.';
    }

    /** @return list<array{label: string, url: string}> */
    public function navLinks(): array
    {
        return [
            ['label' => 'Home', 'url' => route('home')],
            ['label' => 'About', 'url' => route('about')],
            ['label' => 'Services', 'url' => route('services.index')],
            ['label' => 'Deals', 'url' => route('deals.index')],
            ['label' => 'Gallery', 'url' => route('gallery.index')],
            ['label' => 'Blog', 'url' => route('blog.index')],
            ['label' => 'Contact', 'url' => route('contact')],
            ['label' => 'Book an Appointment', 'url' => route('book')],
        ];
    }

    /**
     * @param Collection<int, Service> $services
     * @return list<array{label: string, url: string}>
     */
    private function serviceLinks(Collection $services): array
    {
        return $services
            ->map(fn (Service $service) => [
                'label' => $service->name,
                'url' => route('services.show', $service->slug),
            ])
            ->values()
            ->all();
    }

    private function defaultDescription(): string
    {
        return Setting::get('seo.default_description')
            ?: 'Hair, skin, bridal makeup and beauty services at ' . $this->businessName() . ', ' . self::AREA . '.';
    }

    private function isUsableDescription(string $text): bool
    {
        if (mb_strlen($text) < self::DESCRIPTION_MIN) {
            return false;
        }

        // The old client-side fallback ("Book X at Looks Smart Beauty Salon.") is exactly the kind of
        // generic line that adds nothing — treat it as empty so a better sentence is built instead.
        return ! preg_match('/^(book|read)\b.{0,80}\b(at|on) (the )?looks smart beauty salon( journal)?\.?$/iu', $text);
    }

    private function plainText(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $text = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5);

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    private function endSentence(string $text): string
    {
        return preg_match('/[.!?…]$/u', $text) ? $text : $text . '.';
    }

    private function limit(string $text): string
    {
        return Str::limit($text, self::DESCRIPTION_MAX, '…', true);
    }

    private function absoluteUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        return str_starts_with($url, 'http') ? $url : url($url);
    }

    private function formatPrice(?string $price): ?string
    {
        if ($price === null || ! is_numeric($price) || (float) $price <= 0) {
            return null;
        }

        return (Setting::get('business.currency') ?: 'PKR') . ' ' . number_format((float) $price, 0);
    }

    /** @return array<string, mixed> */
    public function localBusiness(): array
    {
        $latitude = Setting::get('business.latitude');
        $longitude = Setting::get('business.longitude');
        $hasGeo = $latitude !== null && $latitude !== '' && $longitude !== null && $longitude !== '';

        $sameAs = array_values(array_filter([
            Setting::get('business.social_facebook'),
            Setting::get('business.social_instagram'),
        ]));

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'BeautySalon',
            'name' => $this->businessName(),
            'image' => $this->defaultImageUrl(),
            'url' => config('app.url'),
            'telephone' => Setting::get('business.phone'),
            'email' => Setting::get('business.email'),
            'address' => Setting::get('business.address'),
            'geo' => $hasGeo ? [
                '@type' => 'GeoCoordinates',
                'latitude' => (float) $latitude,
                'longitude' => (float) $longitude,
            ] : null,
            'openingHoursSpecification' => $this->openingHours() ?: null,
            'sameAs' => $sameAs ?: null,
        ]);
    }

    /** @return array<string, mixed> */
    public function service(Service $service): array
    {
        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Service',
            'serviceType' => $service->category?->name,
            'name' => $service->name,
            'description' => $service->seo_description ?: $service->description,
            'provider' => $this->organizationRef(),
            'offers' => array_filter([
                '@type' => 'Offer',
                'price' => number_format((float) $service->base_price, 2, '.', ''),
                'priceCurrency' => Setting::get('business.currency') ?: 'PKR',
                'availability' => 'https://schema.org/InStock',
                'url' => route('services.show', $service->slug),
            ]),
            'additionalProperty' => [
                '@type' => 'PropertyValue',
                'name' => 'Duration',
                'value' => "{$service->duration_min} minutes",
            ],
        ]);
    }

    /** @return array<string, mixed> */
    public function blogPosting(Post $post, int $wordCount, int $readingTimeMinutes): array
    {
        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'BlogPosting',
            'headline' => $post->seo_title ?: $post->title,
            'description' => $post->seo_description ?: $post->excerpt,
            'image' => $post->cover_image_path ? asset("storage/{$post->cover_image_path}") : $this->defaultImageUrl(),
            'author' => [
                '@type' => 'Person',
                'name' => $post->author?->name ?? 'Admin',
            ],
            'datePublished' => $post->published_at?->toIso8601String(),
            'dateModified' => $post->updated_at->toIso8601String(),
            'publisher' => $this->organizationRef(),
            'mainEntityOfPage' => [
                '@type' => 'WebPage',
                '@id' => route('blog.show', $post->slug),
            ],
            'wordCount' => $wordCount,
            'timeRequired' => "PT{$readingTimeMinutes}M",
            'articleSection' => $post->category?->name ?? 'Blog',
        ], fn ($value) => $value !== null);
    }

    public function businessName(): string
    {
        return Setting::get('business.name') ?: config('app.name');
    }

    public function defaultImageUrl(): ?string
    {
        $path = Setting::get('business.logo_path');

        return is_string($path) && $path !== '' ? asset("storage/{$path}") : null;
    }

    /** @return array<int, array<string, string>> */
    private function openingHours(): array
    {
        return BusinessHour::where('is_closed', false)
            ->orderBy('weekday')
            ->get()
            ->map(fn (BusinessHour $hour) => [
                '@type' => 'OpeningHoursSpecification',
                'dayOfWeek' => 'https://schema.org/' . (self::DAY_NAMES[$hour->weekday] ?? 'Monday'),
                'opens' => substr((string) $hour->open_time, 0, 5),
                'closes' => substr((string) $hour->close_time, 0, 5),
            ])
            ->all();
    }

    /** @return array<string, mixed> */
    private function organizationRef(): array
    {
        return array_filter([
            '@type' => 'Organization',
            'name' => $this->businessName(),
            'url' => config('app.url'),
            'logo' => $this->defaultImageUrl(),
        ]);
    }
}
