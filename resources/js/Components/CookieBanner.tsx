import { Link, usePage } from '@inertiajs/react';
import { Cookie } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';

const KEY = 'ls_consent_v1';
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // ask again after 12 months
export const COOKIE_SETTINGS_EVENT = 'ls:cookie-settings';

interface Stored {
  choice: 'accepted' | 'declined' | 'ok';
  ts: number;
}

function readChoice(): Stored | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Stored | null;
    if (value && typeof value.ts === 'number' && Date.now() - value.ts < MAX_AGE_MS) return value;
  } catch {
    // Storage unavailable or corrupt: treat as no choice yet.
  }

  return null;
}

function saveChoice(choice: Stored['choice']) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ choice, ts: Date.now() }));
  } catch {
    // Private mode: the choice just lasts for this page view.
  }
}

/** Footer "Cookie settings" link: reopens the banner. */
export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT));
}

/**
 * Small, non-blocking cookie card (public pages only). Accept / Decline only controls the optional Google
 * analytics tag (loaded by /js/consent-analytics.js, never after Decline or with Do Not Track). Everything
 * else (essential cookies, the site's own first-party visit tracking) is unchanged. When analytics is
 * switched off in Settings, there is nothing to choose, so it is a plain notice with an OK button.
 */
export function CookieBanner() {
  const { analytics } = usePage<{ [key: string]: unknown; analytics?: { enabled: boolean } }>()
    .props;
  const analyticsEnabled = analytics?.enabled === true;
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      if (readChoice() === null) setOpen(true);
    };
    sync();
    const reopen = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);

    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  function choose(choice: Stored['choice']) {
    saveChoice(choice);
    setOpen(false);
    if (choice === 'accepted') {
      (window as Window & { lsAnalytics?: { load: () => void } }).lsAnalytics?.load();
    }
  }

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="border-border-soft bg-ivory text-ink shadow-glass fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[35] rounded-2xl border p-4 md:inset-x-auto md:bottom-4 md:left-4 md:max-w-sm"
    >
      <p className="flex items-start gap-2 text-sm leading-6">
        <Cookie className="text-accent-700 mt-1 size-4 shrink-0" aria-hidden="true" />
        <span>
          We use essential cookies to run the site, and optional analytics cookies to improve it.
          See our{' '}
          <Link
            href="/privacy-policy"
            className="text-accent-700 font-medium underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </p>
      <div className="mt-3 flex gap-2">
        {analyticsEnabled ? (
          <>
            <Button type="button" size="sm" variant="accent" onClick={() => choose('accepted')}>
              Accept
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => choose('declined')}>
              Decline
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="accent" onClick={() => choose('ok')}>
            OK
          </Button>
        )}
      </div>
    </div>
  );
}
