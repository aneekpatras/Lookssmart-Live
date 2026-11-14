import { usePage } from '@inertiajs/react';
import { MessageCircle, X } from 'lucide-react';
import * as React from 'react';

import { isQuietPage, useOverlayOpen } from '@/lib/overlay';

interface SharedProps {
  [key: string]: unknown;
  site: { phone: string | null; whatsapp_url: string };
  wa_popup: { enabled: boolean; message: string; delay: number; sound: boolean };
}

const STORAGE_KEY = 'ls_wa_popup_until';
const DAY_MS = 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + DAY_MS));
  } catch {
    // Private mode / blocked storage: the popup may show again on the next page load.
  }
}

// Browsers block audio until the visitor has interacted, so remember whether that has happened yet.
let interacted = false;
let listening = false;
function trackFirstGesture(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const mark = () => {
    interacted = true;
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, mark));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) =>
    window.addEventListener(e, mark, { passive: true }),
  );
}

/** A soft two-tone "ding" (about 1 second), synthesised with the Web Audio API: no file, no library. */
function playDing(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
    gain.connect(ctx.destination);
    [
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.18 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + at);
      osc.stop(now + 1);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1300);
  } catch {
    // Audio is a nicety; never let it break the page.
  }
}

/**
 * Small bubble beside the floating WhatsApp button, shown once per 24 hours per browser after an
 * admin-set delay. Never on /book, /admin, auth or error pages, nor while the cart drawer or mobile menu
 * is open. The sound plays at most once, only if the visitor has already tapped or typed on the page.
 */
export function WhatsAppPopup() {
  const { props, url, component } = usePage<SharedProps>();
  const { site, wa_popup: config } = props;
  const quiet = isQuietPage(url, component);
  const overlay = useOverlayOpen();
  const [ready, setReady] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const counted = React.useRef(false);

  React.useEffect(() => {
    trackFirstGesture();
  }, []);

  // Start the delay timer once per page load, unless snoozed or disabled.
  React.useEffect(() => {
    if (!config.enabled || quiet || snoozed()) return;
    const timer = window.setTimeout(() => setReady(true), config.delay * 1000);
    return () => window.clearTimeout(timer);
  }, [config.enabled, config.delay, quiet]);

  const active = ready && config.enabled && !quiet && !overlay && !dismissed;

  // The first time it appears: count it as shown for 24 hours, play the sound once, start the slide-in.
  React.useEffect(() => {
    if (!active) return;
    if (!counted.current) {
      counted.current = true;
      snooze();
      if (config.sound && interacted) playDing();
    }
    const timer = window.setTimeout(() => setEntered(true), 20);
    return () => window.clearTimeout(timer);
  }, [active, config.sound]);

  if (!active) return null;

  const text = `Hello Looks Smart Beauty Salon! ${config.message}`;
  const href = `${site.whatsapp_url}?text=${encodeURIComponent(text)}`;

  return (
    <div
      role="dialog"
      aria-label="Chat on WhatsApp"
      className={`border-border-soft bg-ivory text-ink shadow-glass fixed right-4 bottom-44 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border p-4 transition duration-[250ms] motion-reduce:translate-y-0 sm:right-6 md:bottom-24 ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Close"
          className="text-ink-muted hover:text-ink absolute top-1 right-1 flex size-10 items-center justify-center rounded-full"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <div className="flex gap-3 pr-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-snug">{config.message}</p>
            {site.phone && <p className="text-ink-muted mt-1 text-xs">{site.phone}</p>}
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setDismissed(true)}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
