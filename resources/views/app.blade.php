<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    @php($analyticsTag = \App\Support\Analytics::tag())
    @if ($analyticsTag)
    {{-- Google tag, in the raw HTML so Google's installation test finds it. External files only (no inline script). --}}
    <script src="/js/gtm-init.js" nonce="{{ $cspNonce ?? '' }}"></script>
    @if ($analyticsTag['kind'] === 'gtm')
    <script async src="https://www.googletagmanager.com/gtm.js?id={{ $analyticsTag['id'] }}" nonce="{{ $cspNonce ?? '' }}"></script>
    @else
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ $analyticsTag['id'] }}" nonce="{{ $cspNonce ?? '' }}"></script>
    <script src="/js/gtag-config.js" data-ga-id="{{ $analyticsTag['id'] }}" nonce="{{ $cspNonce ?? '' }}"></script>
    @endif
    @endif
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    {{-- Phase 13 sub-step 2: real brand accent (resources/css/app.css --color-accent-500), not a
    placeholder — tints supporting browsers' UI chrome and the PWA-lite splash/task-switcher card. --}}
    <meta name="theme-color" content="#c9a66b">
    {{-- Google Search Console ownership verification (public by design, not a secret). Keep it in place
    after verification succeeds, or Google will un-verify the property. --}}
    <meta name="google-site-verification" content="7eXs5Yo8XWjW7Fl2pYjKCHfY1nxQzLoz4g0AUoO7EvU" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    {{-- Real icon set (Google Search wants a >=48px multiple-of-48 icon; the SVG stays first for browsers
    that prefer it). Relative URLs, like the SVG link above. --}}
    <link rel="icon" href="/favicon.ico" sizes="48x48">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="{{ route('manifest') }}">

    {{-- SEO Phase 1: the page's real title / description / canonical / Open Graph, written into the RAW
    HTML on the server (from the database, on every request — so every existing and every newly
    added service/post is covered with no rebuild). Crawlers and link-preview bots (Google's first
    pass, Bing, WhatsApp, Facebook) do not run JavaScript, and shared hosting cannot run Inertia SSR,
    so this is what they actually see. `data-inertia="<key>"` is Inertia's own head-manager marker:
    SeoHead.tsx re-emits the identical tags under the same keys, so the browser swaps each in place
    rather than duplicating it. Pages that don't pass `$seoMeta` (admin, auth, customer) keep the
    plain site-name title and no extra tags. --}}
    <title>{{ $seoMeta['fullTitle'] ?? config('app.name', 'Looks Smart Beauty Salon') }}</title>
    @isset($seoMeta)
    @if (! empty($seoMeta['canonical']))
    <link rel="canonical" href="{{ $seoMeta['canonical'] }}" data-inertia="canonical">
    @endif
    @foreach ($seoMeta['meta'] as $seoTag)
    <meta {{ $seoTag['attr'] }}="{{ $seoTag['key'] }}" content="{{ $seoTag['content'] }}" data-inertia="{{ $seoTag['key'] }}">
    @endforeach
    {{-- SEO Phase 3: structured data (JSON-LD) in the RAW HTML — one <script> per schema type, built by
    SeoService from the database. JSON_HEX_* escapes < > & ' so database text can never close the
    script tag. The old client-side injection (SeoHead.tsx) no longer receives any schema, so each
    type appears exactly once per page. --}}
    @foreach (($seoMeta['jsonLd'] ?? []) as $seoSchema)
    <script type="application/ld+json" nonce="{{ $cspNonce ?? '' }}">{!! json_encode($seoSchema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) !!}</script>
    @endforeach
    @endisset

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    {{-- Preloading the font CSS itself (not a guessed woff2 URL) is the correct, stable optimization
    for a Google-Fonts-hosted stylesheet — the actual font file URLs it declares are generated
    per-user-agent by Google and aren't something we can safely hardcode a preload for. --}}
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@400;500;600;700&display=swap">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    @if (request()->routeIs('home'))
    {{-- The hero poster is the largest thing painted on the homepage: fetch it at top priority, the
    version that matches the screen (same breakpoint as the <picture> in Home.tsx), WebP only. --}}
    <link rel="preload" as="image" type="image/webp" href="/images/hero-poster-mobile.webp" media="(max-width: 767px)" fetchpriority="high">
    <link rel="preload" as="image" type="image/webp" href="/images/hero-poster.webp" media="(min-width: 768px)" fetchpriority="high">
    @endif
    @if (isset($seoMeta) && empty($__inertiaSsrResponse))
    {{-- Boot layer + visually-hidden crawlable copy. Styles carry the CSP nonce (no 'unsafe-inline'), and
    nothing below uses a style="" attribute (the CSP would block it) — everything is a class/id rule.
    Home: the layer IS the hero poster (same box, crop, overlay and base colour as the React hero in
    Home.tsx), so the first thing painted is the real photo and React takes over without a jump.
    Every other public page: a plain page-coloured layer, no logo, no image. The site is light-only
    (dark mode is admin-only and toggled after mount), so that colour is --color-ivory (#faf7f2). --}}
    <style nonce="{{ $cspNonce ?? '' }}">
        #boot-screen{position:fixed;inset:0;z-index:9999;background:#faf7f2;opacity:1;transition:opacity .45s ease;animation:boot-failsafe .01s linear 8s forwards}
        #boot-screen.is-done{opacity:0;pointer-events:none}
        @if (request()->routeIs('home'))
        /* Same box as the React hero section: PublicLayout's <main> has pt-24 (96px, room for the floating header), and the
           hero is min-h-[88svh]. The espresso base colour sits behind the image only; the strip above and below stays page-coloured. */
        #boot-screen .boot-hero-box{position:absolute;top:96px;left:0;width:100%;height:88vh;height:88svh;overflow:hidden;background:#2a2420}
        #boot-screen picture{display:block;position:absolute;inset:0}
        #boot-screen img{display:block;position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 50%}
        #boot-screen .boot-hero-overlay{position:absolute;inset:0;background:radial-gradient(circle at 75% 22%,rgba(201,166,107,.28),transparent 45%),linear-gradient(180deg,rgba(23,19,17,.72) 0%,rgba(23,19,17,.58) 45%,rgba(23,19,17,.86) 100%)}
        @endif
        /* If the app never mounts (JS blocked or failed), the layer still goes away by itself. */
        @keyframes boot-failsafe{to{opacity:0;visibility:hidden;pointer-events:none}}
        /* The standard sr-only pattern (NOT display:none): invisible to sight, still read by crawlers and screen readers. */
        #seo-fallback{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0}
    </style>
    <noscript><style nonce="{{ $cspNonce ?? '' }}">#boot-screen{display:none}</style></noscript>
    @endif

    @routes(null, $cspNonce ?? null)
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="font-sans antialiased">
    {{--
        Phase 13 sub-step 2: GTM's <body>-top noscript iframe fallback — the one piece of the GTM
        install that structurally cannot live in <head> (Inertia's <Head>/SeoHead.tsx only manages
        <head>), so it has to be here rather than centralized with the rest of the analytics wiring.
        Deliberately excluded from /admin* — SeoHead.tsx (public-only) already keeps the <head> GTM/GA4
        scripts off admin pages for the same reason: staff dashboard usage has no business being mixed
        into a customer-facing analytics property.
    --}}
    @if ($analyticsTag && $analyticsTag['kind'] === 'gtm')
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{ $analyticsTag['id'] }}" height="0" width="0" hidden></iframe></noscript>
    @endif
    @if (isset($seoMeta) && empty($__inertiaSsrResponse))
    @if (request()->routeIs('home'))
    {{-- Same sources/breakpoint (768px) as <HeroBackground> in Home.tsx and as the <link rel="preload"> above. The
    alt text matches the React hero's; the layer is aria-hidden so it is never announced twice. No lazy loading. --}}
    <div id="boot-screen" class="boot-hero" aria-hidden="true">
        <div class="boot-hero-box">
            <picture>
                <source media="(max-width: 767px)" srcset="/images/hero-poster-mobile.webp" type="image/webp">
                <source media="(max-width: 767px)" srcset="/images/hero-poster-mobile.jpg" type="image/jpeg">
                <source srcset="/images/hero-poster.webp" type="image/webp">
                <img src="/images/hero-poster.jpg" alt="Inside Looks Smart Beauty Salon, Central Park Housing Scheme, Lahore" width="1600" height="900" fetchpriority="high" decoding="async">
            </picture>
            <div class="boot-hero-overlay"></div>
        </div>
    </div>
    @else
    <div id="boot-screen" aria-hidden="true"></div>
    @endif
    @endif
    @inertia
    {{--
        SEO Phase 1: crawlable raw-HTML copy of the page (<h1>, intro, links). It sits in normal HTML so
        Google's first (non-JS) pass and no-JS visitors get real content and real internal links; it is
        visually hidden (sr-only, never display:none) and absolutely positioned, so nobody sees it and it
        can never push layout around; app.tsx removes it the instant the React app is about to mount. Skipped when Inertia SSR actually responded (that output is
        already the real page). Its styles live in <head> (nonced).
    --}}
    @if (isset($seoMeta) && empty($__inertiaSsrResponse))
    <main id="seo-fallback">
        <h1>{{ $seoMeta['h1'] }}</h1>
        @if (! empty($seoMeta['intro']))
        <p>{{ $seoMeta['intro'] }}</p>
        @endif
        @if (! empty($seoMeta['qa']))
        <section>
            @foreach ($seoMeta['qa'] as $seoQa)
            <h2>{{ $seoQa['question'] }}</h2>
            <p>{{ $seoQa['answer'] }}</p>
            @endforeach
        </section>
        @endif
        @if (! empty($seoMeta['links']))
        <ul>
            @foreach ($seoMeta['links'] as $seoLink)
            <li><a href="{{ $seoLink['url'] }}">{{ $seoLink['label'] }}</a></li>
            @endforeach
        </ul>
        @endif
        <nav aria-label="Main">
            <ul>
                @foreach ($seoMeta['nav'] as $seoLink)
                <li><a href="{{ $seoLink['url'] }}">{{ $seoLink['label'] }}</a></li>
                @endforeach
            </ul>
        </nav>
    </main>
    @endif
</body>
</html>
