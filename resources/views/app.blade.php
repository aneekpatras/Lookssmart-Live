<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    {{-- Phase 13 sub-step 2: real brand accent (resources/css/app.css --color-accent-500), not a
    placeholder — tints supporting browsers' UI chrome and the PWA-lite splash/task-switcher card. --}}
    <meta name="theme-color" content="#c9a66b">
    {{-- Google Search Console ownership verification (public by design, not a secret). Keep it in place
    after verification succeeds, or Google will un-verify the property. --}}
    <meta name="google-site-verification" content="7eXs5Yo8XWjW7Fl2pYjKCHfY1nxQzLoz4g0AUoO7EvU" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    {{-- favicon.ico is an empty 0-byte placeholder, so it is deliberately not linked here (it would
    override the SVG in Chromium browsers). Re-add it once a real .ico exists. --}}
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
    <link rel="canonical" href="{{ $seoMeta['canonical'] }}" data-inertia="canonical">
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
    @php($gtmId = \App\Models\Setting::get('integrations.google_tag_manager_id'))
    @if ($gtmId && ! request()->is('admin*'))
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{ $gtmId }}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    @endif
    @inertia
    {{--
        SEO Phase 1: crawlable raw-HTML copy of the page (<h1>, intro, links). It sits in normal HTML so
        Google's first (non-JS) pass and no-JS visitors get real content and real internal links; it is
        absolutely positioned, so it can never push layout around, and app.tsx removes it the instant
        the React app is about to mount. Skipped when Inertia SSR actually responded (that output is
        already the real page). The <style> carries the CSP nonce — this site's CSP has no
        'unsafe-inline', so an un-nonced <style> or style="" attribute would be silently dropped.
    --}}
    @if (isset($seoMeta) && empty($__inertiaSsrResponse))
    <style nonce="{{ $cspNonce ?? '' }}">
        #seo-fallback{position:absolute;top:0;left:0;right:0;z-index:60;box-sizing:border-box;min-height:100vh;padding:96px 24px 48px;background:var(--color-ivory,#faf7f2);color:var(--color-ink,#2a2420);font:16px/1.6 Inter,system-ui,sans-serif}
        #seo-fallback h1{max-width:48rem;margin:0 0 16px;font-family:Fraunces,Georgia,serif;font-weight:500;font-size:clamp(2rem,6vw,3.5rem);line-height:1.1}
        #seo-fallback p{max-width:42rem;margin:0 0 24px;color:var(--color-ink-muted,#6b6157)}
        #seo-fallback ul{display:flex;flex-wrap:wrap;gap:8px 20px;margin:0 0 24px;padding:0;list-style:none}
        #seo-fallback a{color:var(--color-accent-700,#8f7140)}
    </style>
    <main id="seo-fallback">
        <h1>{{ $seoMeta['h1'] }}</h1>
        @if (! empty($seoMeta['intro']))
        <p>{{ $seoMeta['intro'] }}</p>
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
