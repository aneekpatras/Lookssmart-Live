<?php

/** Source-level checks: the admin breadcrumb map must cover the whole sidebar and the markup must be accessible. */

function navItems(): array
{
    $nav = file_get_contents(resource_path('js/config/adminNav.ts'));
    preg_match_all("/label: '([^']+)',\s*(?:badge: '[^']+',\s*)?href: '([^']+)'/s", $nav, $items, PREG_SET_ORDER);
    preg_match_all("/label: '([^']+)',\s*items:/", $nav, $sections);

    return ['items' => $items, 'sections' => $sections[1]];
}

it('has a breadcrumb entry for every sidebar item', function () {
    $map = file_get_contents(resource_path('js/lib/adminBreadcrumbs.ts'));
    $nav = navItems();

    expect(count($nav['items']))->toBeGreaterThan(25);

    foreach ($nav['items'] as [, $label, $href]) {
        if ($href === '/admin') {
            continue; // the dashboard is handled before the map
        }
        $base = explode('#', $href)[0];
        expect(str_contains($map, "href: '{$base}'"))->toBeTrue("no breadcrumb entry for {$href}");
    }
});

it('uses the sidebar group names as breadcrumb sections', function () {
    $map = file_get_contents(resource_path('js/lib/adminBreadcrumbs.ts'));

    foreach (array_diff(navItems()['sections'], ['Overview']) as $section) {
        expect($map)->toContain("section: '{$section}'");
    }
});

it('covers the nested create, edit and detail admin pages', function () {
    $map = file_get_contents(resource_path('js/lib/adminBreadcrumbs.ts'));

    foreach (['New service', 'Edit service', 'New deal', 'Edit deal', 'New post', 'Edit post', 'New FAQ', 'Edit FAQ', 'New gallery', 'Edit gallery', 'New slide', 'Edit slide', 'Booking details', 'Lead details', 'Customer profile', 'Sale details', 'Import details'] as $label) {
        expect($map)->toContain("current: '{$label}'");
    }
});

it('renders an accessible breadcrumb nav in the admin layout, with a back link and the settings tab in the URL hash', function () {
    $component = file_get_contents(resource_path('js/Components/admin/AdminBreadcrumbs.tsx'));
    $layout = file_get_contents(resource_path('js/Layouts/AdminLayout.tsx'));
    $settings = file_get_contents(resource_path('js/Pages/Admin/CMS/Settings/Index.tsx'));

    expect($component)->toContain('aria-label="Breadcrumb"')->toContain('<ol')->toContain('aria-current="page"')->toContain('Back to ');
    expect($layout)->toContain('<AdminBreadcrumbs />');
    expect($settings)->toContain('useAdminBreadcrumb(')->toContain('window.location.hash')->toContain('hashchange');
});
