import '../css/app.css';

import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react';
import * as Sentry from '@sentry/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { ErrorBoundary } from '@/Components/ErrorBoundary';
import { formatTitle } from '@/lib/title';

const appName = import.meta.env.VITE_APP_NAME || 'Looks Smart Beauty Salon';

// Browser error tracking — only enabled when a DSN is configured and we're actually in production,
// mirroring the backend's sentry/sentry-laravel setup. A blank VITE_SENTRY_DSN (the local/dev
// default) leaves this a no-op, so nothing is ever sent from a developer's machine.
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_APP_ENV === 'production') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV,
    tracesSampleRate: 0.1,
  });
}

// Longest we hold the boot layer for; stays under the 8s CSS failsafe in resources/views/app.blade.php.
const BOOT_MAX_WAIT_MS = 6000;

/**
 * Removes the raw-HTML boot layer (`#boot-screen`, see resources/views/app.blade.php) once the app has
 * really painted: the page component has mounted (Inertia resolves it asynchronously, so `render()`
 * alone is not enough) and, on the homepage, the React hero poster has loaded AND decoded. The layer on
 * the homepage is the same poster image, so waiting for React's own copy means the photo never
 * disappears and re-appears. Then two frames later it fades out. If the app never mounts, the CSS
 * failsafe hides the layer by itself.
 */
function dismissBootLayer(): void {
  const boot = document.getElementById('boot-screen');
  if (!boot) return;

  const startedAt = performance.now();
  const hasPoster = boot.querySelector('picture') !== null;

  const fadeOut = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        boot.classList.add('is-done');
        window.setTimeout(() => boot.remove(), 600);
      }),
    );

  const check = () => {
    const mounted = document.getElementById('app')?.firstElementChild != null;
    const timedOut = performance.now() - startedAt > BOOT_MAX_WAIT_MS;

    if (!mounted && !timedOut) {
      requestAnimationFrame(check);
      return;
    }

    if (hasPoster && !timedOut) {
      const poster = document.querySelector<HTMLImageElement>('#app [data-hero-poster]');

      if (!poster || !poster.complete || poster.naturalWidth === 0) {
        requestAnimationFrame(check);
        return;
      }

      // Decoded, not just downloaded — otherwise the first frame could still paint without it.
      void (poster.decode?.() ?? Promise.resolve()).catch(() => undefined).then(fadeOut);
      return;
    }

    fadeOut();
  };

  requestAnimationFrame(check);
}

createInertiaApp({
  title: (title) => formatTitle(title, appName),
  resolve: (name): Promise<ResolvedComponent> =>
    resolvePageComponent<ResolvedComponent>(
      `./Pages/${name}.tsx`,
      import.meta.glob<ResolvedComponent>('./Pages/**/*.tsx', { import: 'default' }),
    ),
  setup({ el, App, props }) {
    // The server writes a plain, crawlable copy of the page's <h1>/intro/links into the raw HTML
    // (`#seo-fallback`, see resources/views/app.blade.php) for crawlers and no-JS visitors. Once the
    // real app is about to mount it has done its job — remove it so it never shows alongside the app.
    if (typeof document !== 'undefined') {
      document.getElementById('seo-fallback')?.remove();
    }

    const app = (
      <ErrorBoundary>
        <App {...props} />
      </ErrorBoundary>
    );

    if (import.meta.env.SSR) {
      hydrateRoot(el, app);
      return;
    }

    createRoot(el).render(app);

    dismissBootLayer();
  },
  progress: {
    color: '#c9a66b',
  },
});
