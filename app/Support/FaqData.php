<?php

namespace App\Support;

/**
 * Single source of truth for the FAQ text. The /faqs page, the Home and Contact mini blocks, the raw
 * HTML fallback and the FAQPage JSON-LD all read from here, so they can never differ.
 *
 * Answers may contain {phone}, {address} and {hours}; link hrefs may contain {whatsapp} and {maps}.
 * Placeholders are replaced by self::resolve().
 */
class FaqData
{
    /** Ids shown in the small FAQ block on Home and Contact. */
    public const PREVIEW_IDS = [1, 2, 10, 19, 20];

    /** @return list<array{id: string, label: string}> */
    public static function defaultCategories(): array
    {
        return [
            ['id' => 'booking', 'label' => 'Booking and visits'],
            ['id' => 'prices', 'label' => 'Prices and payment'],
            ['id' => 'bridal', 'label' => 'Bridal'],
            ['id' => 'hair-skin', 'label' => 'Hair and skin'],
            ['id' => 'visit', 'label' => 'Visit us'],
        ];
    }

    /** @return list<array{id: int, category: string, question: string, answer: string, links: list<array{label: string, href: string}>}> */
    public static function defaults(): array
    {
        $wa = ['label' => 'Message us on WhatsApp', 'href' => '{whatsapp}'];

        return [
            ['id' => 1, 'category' => 'booking', 'question' => 'How do I book an appointment at Looks Smart?',
                'answer' => 'Choose your services on our booking page, add them to your selection, and continue to confirm your details. You can also message us on WhatsApp at {phone} and we will confirm your slot.',
                'links' => [['label' => 'Book now', 'href' => '/book'], ['label' => 'Message on WhatsApp', 'href' => '{whatsapp}']]],
            ['id' => 2, 'category' => 'booking', 'question' => 'Can I walk in without an appointment?',
                'answer' => 'Yes, walk-ins are welcome. Booking ahead is the best way to get the time you want, especially for bridal, hair colour and longer treatments, and a quick WhatsApp message lets us tell you when a stylist is free.',
                'links' => []],
            ['id' => 3, 'category' => 'booking', 'question' => 'Can I book more than one service in a single visit?',
                'answer' => 'Yes. Add as many services as you like. The booking page shows your total service time and total amount before you continue, so you can plan your visit.',
                'links' => []],
            ['id' => 4, 'category' => 'booking', 'question' => 'Can I change or cancel my appointment?',
                'answer' => 'Plans change, and we understand. Message us on WhatsApp as early as you can with your name and booking details, and we will help you change or cancel your appointment.',
                'links' => []],
            ['id' => 5, 'category' => 'booking', 'question' => 'Is Looks Smart only for women?',
                'answer' => 'Yes. Looks Smart is a salon exclusively for women.',
                'links' => []],
            ['id' => 6, 'category' => 'booking', 'question' => 'Do you offer home or wedding venue services?',
                'answer' => 'No. We work only at our salon, so you can enjoy our full setup and a comfortable space.',
                'links' => []],
            ['id' => 7, 'category' => 'prices', 'question' => 'Where can I see the price and duration of each service?',
                'answer' => 'Every service shows its price and duration before you add it, so you know the cost and the time in advance. Browse by category on our Services page.',
                'links' => [['label' => 'View services', 'href' => '/services']]],
            ['id' => 8, 'category' => 'prices', 'question' => 'How do your deals work?',
                'answer' => "Each deal lists the services included, the discounted price beside the original, and the date it is valid till. Tap Claim Offer and we take you to booking with that deal's services and promo code already applied.",
                'links' => [['label' => 'See current deals', 'href' => '/deals']]],
            ['id' => 9, 'category' => 'prices', 'question' => 'Do hair prices depend on hair length?',
                'answer' => 'Many hair services are listed by length, for example Shoulder Length and Mid-Back, each with its own price. Choose the one closest to your hair, and message us on WhatsApp if you are between lengths.',
                'links' => []],
            ['id' => 10, 'category' => 'prices', 'question' => 'Which payment methods do you accept?',
                'answer' => 'You can pay by cash, bank transfer, JazzCash or Easypaisa.',
                'links' => []],
            ['id' => 11, 'category' => 'prices', 'question' => 'Do I need to pay in advance?',
                'answer' => 'For bridal and other major services we take a 20% advance. Before that, the salon owner personally consults with you to understand what you need, and the advance is collected only after that.',
                'links' => []],
            ['id' => 12, 'category' => 'bridal', 'question' => 'How does bridal booking work?',
                'answer' => 'Every bride is first consulted personally by the salon owner, who understands your look, your dress and your day. After that, a 20% advance confirms your date.',
                'links' => [$wa]],
            ['id' => 13, 'category' => 'bridal', 'question' => 'How early should I book bridal makeup?',
                'answer' => 'As soon as your wedding date is fixed. Wedding season fills quickly, and booking early gives you more choice of date and time.',
                'links' => []],
            ['id' => 14, 'category' => 'bridal', 'question' => 'What bridal options do you offer?',
                'answer' => 'See Bridal and Party Makeup on our Services page, where each option shows its price and duration. We have been creating bridal looks in Lahore for 12 years.',
                'links' => [['label' => 'View bridal services', 'href' => '/services']]],
            ['id' => 15, 'category' => 'hair-skin', 'question' => 'How long do hair treatments take?',
                'answer' => 'It depends on the treatment and your hair length. Each service shows its duration before you add it, so you can plan your day. Longer treatments such as rebonding and colour can take several hours.',
                'links' => []],
            ['id' => 16, 'category' => 'hair-skin', 'question' => 'What is the difference between rebonding and keratin or hair botox?',
                'answer' => 'Rebonding permanently straightens your hair, while keratin and botox-style treatments smooth frizz and restore softness and wear off gradually. Not sure which suits your hair? Send us a message on WhatsApp.',
                'links' => []],
            ['id' => 17, 'category' => 'hair-skin', 'question' => 'How should I care for my hair after a treatment?',
                'answer' => 'Your stylist will explain the aftercare for the product used, including how long to wait before washing or tying your hair. Following it closely gives the best result.',
                'links' => []],
            ['id' => 18, 'category' => 'hair-skin', 'question' => 'How do I choose the right facial?',
                'answer' => 'Browse Skin and Facial Care, then tell us your skin type and concern on WhatsApp, and we will point you to the right option.',
                'links' => [['label' => 'View facials', 'href' => '/services']]],
            ['id' => 19, 'category' => 'visit', 'question' => 'Where is Looks Smart and how do I find you?',
                'answer' => 'We are at {address}. Look for B Block on the Main Boulevard, near UBL Bank and close to Gate No. 1, the main gate.',
                'links' => [['label' => 'Get directions', 'href' => '{maps}']]],
            ['id' => 20, 'category' => 'visit', 'question' => 'What are your opening hours?',
                'answer' => 'We are open {hours}.',
                'links' => []],
            ['id' => 21, 'category' => 'visit', 'question' => 'Is parking available?',
                'answer' => 'Yes, parking and internet access are available for our guests.',
                'links' => []],
            ['id' => 22, 'category' => 'visit', 'question' => 'How can I contact you?',
                'answer' => 'Message or call us at {phone}, or use our Contact page.',
                'links' => [['label' => 'Contact us', 'href' => '/contact']]],
        ];
    }

    /** @var array{categories: list<array{id: string, label: string}>, items: list<array<string, mixed>>}|null */
    private static ?array $current = null;

    /** Forget the per-request memo (used by tests and after admin edits). */
    public static function flush(): void
    {
        self::$current = null;
    }

    /**
     * The FAQs the public site shows: active questions in active categories from the database, or the
     * built-in defaults when the tables do not exist yet or hold no active question, so the public site
     * never breaks before the SQL has been run.
     *
     * @return array{categories: list<array{id: string, label: string}>, items: list<array<string, mixed>>}
     */
    public static function current(): array
    {
        if (self::$current !== null) {
            return self::$current;
        }

        $fromDb = null;

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('faqs') && \Illuminate\Support\Facades\Schema::hasTable('faq_categories')) {
                $faqs = \App\Models\Faq::query()
                    ->with('category')
                    ->where('is_active', true)
                    ->where(fn ($q) => $q->whereNull('faq_category_id')->orWhereHas('category', fn ($c) => $c->where('is_active', true)))
                    ->orderBy('sort_order')->orderBy('id')
                    ->get();

                if ($faqs->isNotEmpty()) {
                    $cats = \App\Models\FaqCategory::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->get();
                    $usedSlugs = $faqs->map(fn ($f) => $f->category?->slug)->filter()->unique()->all();
                    $categories = $cats->filter(fn ($c) => in_array($c->slug, $usedSlugs, true))
                        ->map(fn ($c) => ['id' => $c->slug, 'label' => $c->name])->values()->all();

                    if ($faqs->contains(fn ($f) => $f->category === null)) {
                        $categories[] = ['id' => 'other', 'label' => 'More questions'];
                    }

                    $fromDb = [
                        'categories' => $categories,
                        'items' => $faqs->map(fn ($f) => [
                            'id' => $f->id,
                            'category' => $f->category?->slug ?? 'other',
                            'question' => $f->question,
                            'answer' => $f->answer,
                            'links' => collect($f->links ?? [])->filter(fn ($l) => ! empty($l['label']) && ! empty($l['href']))
                                ->map(fn ($l) => ['label' => (string) $l['label'], 'href' => (string) $l['href']])->values()->all(),
                            'preview' => (bool) $f->show_in_preview,
                        ])->values()->all(),
                    ];
                }
            }
        } catch (\Throwable) {
            $fromDb = null;
        }

        return self::$current = $fromDb ?? [
            'categories' => self::defaultCategories(),
            'items' => array_map(fn (array $item) => [...$item, 'preview' => in_array($item['id'], self::PREVIEW_IDS, true)], self::defaults()),
        ];
    }

    /** @return list<array{id: string, label: string}> */
    public static function categories(): array
    {
        return self::current()['categories'];
    }

    /** "/faqs#faq-<id>" for the first question containing `$needle`, else "/faqs". */
    public static function hrefFor(string $needle): string
    {
        foreach (self::current()['items'] as $item) {
            if (stripos($item['question'], $needle) !== false) {
                return '/faqs#faq-' . $item['id'];
            }
        }

        return '/faqs';
    }

    /**
     * Items with every placeholder replaced. `$vars` keys: phone, address, hours, whatsapp, maps.
     * Each link also gets `external` (true for absolute URLs).
     *
     * @param  array{phone: string, address: string, hours: string, whatsapp: string, maps: string}  $vars
     * @param  bool  $previewOnly  only the questions flagged for the short block on Home and Contact
     * @return list<array{id: int, category: string, question: string, answer: string, preview: bool, links: list<array{label: string, href: string, external: bool}>}>
     */
    public static function resolve(array $vars, bool $previewOnly = false): array
    {
        $map = [
            '{phone}' => $vars['phone'],
            '{address}' => $vars['address'],
            '{hours}' => $vars['hours'],
            '{whatsapp}' => $vars['whatsapp'],
            '{maps}' => $vars['maps'],
        ];

        $items = array_map(fn (array $item) => [
            ...$item,
            'answer' => strtr($item['answer'], $map),
            'links' => array_map(function (array $link) use ($map) {
                $href = strtr($link['href'], $map);

                return ['label' => $link['label'], 'href' => $href, 'external' => str_starts_with($href, 'http')];
            }, $item['links']),
        ], self::current()['items']);

        if ($previewOnly) {
            $items = array_values(array_filter($items, fn (array $item) => $item['preview']));
        }

        return $items;
    }
}
