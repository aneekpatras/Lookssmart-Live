<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\Post;
use App\Models\Service;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Spatie\Sitemap\Sitemap;
use Spatie\Sitemap\Tags\Url;
use Symfony\Component\HttpFoundation\Response as ResponseContract;

/**
 * Phase 13 sub-step 1: `spatie/laravel-sitemap` (locked stack, CLAUDE.md's tech list — not
 * previously installed) rather than hand-rolled XML, so the output is spec-compliant by
 * construction. `/deals` is now a real, controller-backed page (built for the Deals & Offers task —
 * see `PublicWebsiteController::deals()`), so it is included below like any other real page. Service
 * categories aren't included either: `/services` only ever filters by a numeric `?category=` query
 * param, which is neither a distinct crawlable URL nor slug-based — sitemapping it would just be
 * indexing duplicate content under an unstable id-based URL.
 */
class SeoController extends Controller
{
    public function sitemap(Request $request): ResponseContract
    {
        // SEO Phase 1: the two hub pages get an honest <lastmod> derived from the newest row behind
        // them (a service/post added or edited in the admin panel bumps it automatically). Static
        // pages deliberately get none — there is no real modification date to report for them.
        $latestService = Service::active()->max('updated_at');
        $latestPost = Post::published()->max('updated_at');

        $servicesUrl = Url::create(route('services.index'))->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)->setPriority(0.9);
        $blogUrl = Url::create(route('blog.index'))->setChangeFrequency(Url::CHANGE_FREQUENCY_DAILY)->setPriority(0.7);

        if ($latestService) {
            $servicesUrl->setLastModificationDate(Carbon::parse($latestService));
        }

        if ($latestPost) {
            $blogUrl->setLastModificationDate(Carbon::parse($latestPost));
        }

        $sitemap = Sitemap::create()
            ->add(Url::create(route('home'))->setChangeFrequency(Url::CHANGE_FREQUENCY_DAILY)->setPriority(1.0))
            ->add($servicesUrl)
            ->add(Url::create(route('book'))->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)->setPriority(0.7))
            ->add(Url::create(route('deals.index'))->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)->setPriority(0.7))
            ->add($blogUrl)
            ->add(Url::create(route('gallery.index'))->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)->setPriority(0.6))
            ->add(Url::create(route('about'))->setChangeFrequency(Url::CHANGE_FREQUENCY_MONTHLY)->setPriority(0.5))
            ->add(Url::create(route('faqs.index'))->setChangeFrequency(Url::CHANGE_FREQUENCY_MONTHLY)->setPriority(0.5))
            ->add(Url::create(route('contact'))->setChangeFrequency(Url::CHANGE_FREQUENCY_MONTHLY)->setPriority(0.5))
            ->add(Url::create(route('privacy-policy'))->setChangeFrequency(Url::CHANGE_FREQUENCY_YEARLY)->setPriority(0.2));

        Service::active()->select(['slug', 'updated_at'])->orderBy('id')
            ->each(fn (Service $service) => $sitemap->add(
                Url::create(route('services.show', $service->slug))
                    ->setLastModificationDate($service->updated_at)
                    ->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)
                    ->setPriority(0.8),
            ));

        Post::published()->select(['slug', 'updated_at'])->orderBy('id')
            ->each(fn (Post $post) => $sitemap->add(
                Url::create(route('blog.show', $post->slug))
                    ->setLastModificationDate($post->updated_at)
                    ->setChangeFrequency(Url::CHANGE_FREQUENCY_MONTHLY)
                    ->setPriority(0.6),
            ));

        // Same visibility rule as the public detail page (`Deal::active()`): inactive, not-yet-started
        // and expired deals are left out so crawlers are never pointed at a 404.
        Deal::active()->select(['slug', 'updated_at'])->orderBy('id')
            ->each(fn (Deal $deal) => $sitemap->add(
                Url::create(route('deals.show', $deal->slug))
                    ->setLastModificationDate($deal->updated_at)
                    ->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)
                    ->setPriority(0.6),
            ));

        return $sitemap->toResponse($request);
    }

    public function robots(): Response
    {
        $lines = [
            'User-agent: *',
            'Disallow: /admin',
            'Disallow: /my-account',
            'Disallow: /customer',
            'Disallow: /api',
            // SEO Phase 1: sign-in / account / token-bearing screens have no search value and should
            // never be crawled (the stateful ones are also not linked from any public page).
            'Disallow: /login',
            'Disallow: /register',
            'Disallow: /forgot-password',
            'Disallow: /reset-password',
            'Disallow: /two-factor-challenge',
            'Disallow: /email/verify',
            'Disallow: /user/',
            'Disallow: /my-bookings',
            'Disallow: /notifications/',
            'Disallow: /csp-report',
            '',
            'Sitemap: ' . route('sitemap'),
        ];

        return response(implode("\n", $lines) . "\n", 200, ['Content-Type' => 'text/plain']);
    }

    /**
     * Phase 13 sub-step 2: PWA-lite manifest — `favicon.ico` plus the real 192x192 and 512x512 PNGs
     * (public/favicon-192x192.png, public/icon-512x512.png) are always included; the real uploaded
     * `business.logo_path` is added on top only when one is configured AND still exists on disk
     * (never a stale/broken reference).
     */
    public function manifest(): JsonResponse
    {
        // Square app icons only (generated from the site logo): "any" and "maskable" as separate entries.
        // The wide business logo is deliberately not listed, it made the installed app icon tiny.
        $icons = [
            ['src' => asset('icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => asset('icon-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => asset('icon-maskable-192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'maskable'],
            ['src' => asset('icon-maskable-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ];

        return response()->json([
            'name' => 'Looks Smart',
            'short_name' => 'Looks Smart',
            'description' => Setting::get('seo.default_description') ?: 'Book hair, skin, and nail appointments online.',
            'start_url' => '/',
            'display' => 'standalone',
            // Real design-system tokens (resources/css/app.css --color-ivory/--color-accent-500),
            // not placeholder colors.
            'background_color' => '#faf7f2',
            'theme_color' => '#c9a66b',
            'icons' => $icons,
        ])->header('Content-Type', 'application/manifest+json');
    }
}
