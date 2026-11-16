import { router } from '@inertiajs/react';

type DataLayerWindow = Window & { dataLayer?: unknown[] };

/**
 * Inertia swaps pages without a reload, so the tag only sees the first load. After that, every
 * Inertia "navigate" pushes an `inertia_page_view` event to the dataLayer for Google Tag Manager.
 * The first navigate (the initial load) is skipped, admin pages are never tracked, and nothing here
 * can throw.
 */
export function trackInertiaPageViews(): void {
  let first = true;

  router.on('navigate', () => {
    try {
      if (first) {
        first = false;
        return;
      }
      const path = window.location.pathname;
      const layer = (window as DataLayerWindow).dataLayer;
      if (!Array.isArray(layer) || path.startsWith('/admin')) return;

      layer.push({ event: 'inertia_page_view', page_path: path, page_title: document.title });
    } catch {
      // Analytics must never break navigation.
    }
  });
}
