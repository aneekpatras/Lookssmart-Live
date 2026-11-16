<?php

namespace App\Support;

use App\Models\GalleryImage;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\ShowcaseSlide;

/**
 * Content of the Home "showcase" section: admin-editable texts (settings with the `showcase.` prefix),
 * automatic category chips, the top live deal, and the slides. Every read is guarded, so a missing
 * table, column or setting falls back to the defaults instead of breaking the Home page.
 */
class Showcase
{
    public const DEFAULTS = [
        'enabled' => true,
        'eyebrow' => 'Women-only salon · Central Park, Lahore',
        'heading_1' => 'Bridal artistry,',
        'heading_2' => 'and everyday beauty.',
        'paragraph' => 'Hair, skin, makeup and bridal looks in Central Park, Lahore. Every service shows its price and time before you book.',
        'chips_enabled' => true,
        'chips_label' => 'What are you looking for?',
        'deal_enabled' => true,
        'deal_label' => 'Current deal',
        'deal_button_label' => 'View gallery',
        'deal_button_url' => '/gallery',
        'primary_label' => 'Book appointment',
        'primary_url' => '/book',
        'secondary_label' => 'Explore more deals',
        'secondary_url' => '/deals',
        'trust_1' => 'Women only',
        'trust_2' => '12 years of bridal looks',
        'trust_3' => 'Walk-ins welcome',
        'card_title' => '12 years',
        'card_line' => 'of bridal looks',
        'interval' => 5,
    ];

    /** A site path ("/book") or an https:// URL; anything else is rejected. */
    public static function validLink(?string $value): bool
    {
        return (bool) preg_match('#^(/(?!/)[^\s]*|https://[^\s]+)$#i', trim((string) $value));
    }

    public static function safeLink(mixed $value, string $fallback): string
    {
        $value = trim((string) $value);

        return self::validLink($value) ? $value : $fallback;
    }

    /** @return array<string, mixed> */
    public static function options(): array
    {
        $out = self::DEFAULTS;

        try {
            foreach (self::DEFAULTS as $key => $default) {
                $stored = Setting::get("showcase.{$key}");

                if ($stored === null) {
                    continue;
                }

                if (is_bool($default)) {
                    $out[$key] = (bool) $stored;
                } elseif (is_int($default)) {
                    $out[$key] = max(3, min(15, (int) $stored));
                } else {
                    // Trust-row items may be saved empty on purpose (hides the item).
                    $out[$key] = trim(strip_tags((string) $stored));
                }
            }
        } catch (\Throwable) {
            return self::DEFAULTS;
        }

        foreach (['deal_button_url' => '/gallery', 'primary_url' => '/book', 'secondary_url' => '/deals'] as $key => $fallback) {
            $out[$key] = self::safeLink($out[$key], $fallback);
        }

        foreach (['eyebrow', 'heading_1', 'heading_2', 'paragraph', 'chips_label', 'deal_label', 'deal_button_label', 'primary_label', 'secondary_label', 'card_title', 'card_line'] as $key) {
            if ($out[$key] === '') {
                $out[$key] = self::DEFAULTS[$key];
            }
        }

        return $out;
    }

    /** @return list<array{id: int, name: string}> */
    public static function chips(): array
    {
        try {
            return ServiceCategory::active()->ordered()
                ->whereHas('services', fn ($query) => $query->active())
                ->limit(6)->get(['id', 'name'])
                ->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /** @return list<array<string, mixed>> */
    public static function slides(): array
    {
        try {
            $rows = ShowcaseSlide::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->get();
        } catch (\Throwable) {
            $rows = collect();
        }

        if ($rows->isNotEmpty()) {
            return $rows->map(fn (ShowcaseSlide $slide) => [
                'id' => $slide->id,
                'url' => asset('storage/' . $slide->image_path),
                'title' => $slide->title,
                'subtitle' => $slide->subtitle,
                'link' => $slide->link && self::validLink($slide->link) ? $slide->link : null,
                'focus' => $slide->focus === 'center' ? 'center' : 'top',
            ])->all();
        }

        // Fallback: gallery photos ticked "show on homepage". The caption is the title only when set.
        try {
            return GalleryImage::query()->forHomepageSlider()->with('gallery:id,sort')->get()
                ->sortBy(fn (GalleryImage $image) => sprintf('%010d:%010d:%010d', $image->gallery?->sort ?? 0, $image->sort, $image->id))
                ->take(8)->values()
                ->map(fn (GalleryImage $image) => [
                    'id' => 'g' . $image->id,
                    'url' => asset('storage/' . $image->image_path),
                    'title' => trim((string) $image->caption),
                    'subtitle' => null,
                    'link' => null,
                    'focus' => 'top',
                ])->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param list<array<string, mixed>> $offers The Home offers, already ranked (pinned first, soonest ending).
     * @return array<string, mixed>
     */
    public static function forHome(array $offers): array
    {
        $options = self::options();
        $top = $offers[0] ?? null;

        return [
            'options' => $options,
            'chips' => $options['chips_enabled'] ? self::chips() : [],
            'slides' => self::slides(),
            'deal' => $options['deal_enabled'] && $top ? [
                'title' => $top['title'],
                'deal_price' => $top['deal_price'],
                'original_price' => $top['original_price'],
                'percent' => $top['savings_percent'] ?? (($top['type'] ?? '') === 'percent' ? (float) $top['value'] : null),
                'ends_at' => $top['ends_at'],
                'included_count' => count($top['included_services'] ?? []),
            ] : null,
        ];
    }
}
