/**
 * Anonymous funnel tracking helper. Sends only whitelisted events (add_to_cart, begin_booking,
 * form_started, booking_submitted) to POST /track, with a random anonymous session id kept in
 * localStorage. No keystrokes, no field values. Sends nothing when Do Not Track is on. Fire-and-forget:
 * uses fetch with keepalive, never awaits, ignores every failure.
 */
export type TrackEvent = 'add_to_cart' | 'begin_booking' | 'form_started' | 'booking_submitted';

const SESSION_KEY = 'ls_sid';
let memorySession: string | null = null;

function randomId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function trackingSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = randomId();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    memorySession ??= randomId();
    return memorySession;
  }
}

function doNotTrack(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1';
}

function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : '';
}

function send(url: string, payload: Record<string, unknown>): void {
  if (typeof window === 'undefined' || doNotTrack()) return;
  try {
    void fetch(url, {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrfToken(),
      },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // Tracking must never affect the page.
  }
}

export function track(event: TrackEvent, meta?: { kind: 'service' | 'deal'; id: number }): void {
  send('/track', {
    session_id: trackingSessionId(),
    event,
    path: window.location.pathname,
    ...(meta ? { meta } : {}),
  });
}

export interface IncompleteBookingPayload {
  name: string;
  phone: string;
  items: { id: number; name: string; price: number }[];
  total: number;
}

export function saveIncompleteBooking(payload: IncompleteBookingPayload): void {
  send('/track/incomplete', { session_id: trackingSessionId(), ...payload });
}

/** Sends session details once per browser session: screen, language, timezone, referrer host, utm and landing path. */
export function trackSessionStart(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem('ls_ss') === '1') return;
    window.sessionStorage.setItem('ls_ss', '1');
  } catch {
    // storage blocked: send anyway, the server upserts
  }

  let referrerHost = '';
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    referrerHost = host && host !== window.location.hostname ? host : '';
  } catch {
    referrerHost = '';
  }
  const params = new URLSearchParams(window.location.search);

  send('/track', {
    session_id: trackingSessionId(),
    event: 'session_start',
    path: window.location.pathname,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: (navigator.language || '').slice(0, 12),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer_host: referrerHost || undefined,
    utm_source: params.get('utm_source')?.slice(0, 60) || undefined,
    utm_medium: params.get('utm_medium')?.slice(0, 60) || undefined,
    utm_campaign: params.get('utm_campaign')?.slice(0, 60) || undefined,
  });
}

/** One page view (path only). The server keeps at most 25 per session per day. */
export function trackPageView(): void {
  send('/track', {
    session_id: trackingSessionId(),
    event: 'page_view',
    path: window.location.pathname,
  });
}

export interface CartSnapshotItem {
  id: number;
  name: string;
  type: 'service' | 'deal';
  price: number;
}

/** Current cart for the follow-up lists: names, ids, types and prices only. An empty cart clears it. */
export function syncCartSnapshot(items: CartSnapshotItem[]): void {
  const capped = items.slice(0, 40).map((item) => ({ ...item, name: item.name.slice(0, 120) }));
  send('/track', {
    session_id: trackingSessionId(),
    event: 'cart_update',
    path: window.location.pathname,
    cart: { items: capped, total: capped.reduce((sum, item) => sum + item.price, 0) },
  });
}

export interface ContactDraftPayload {
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  website: string;
}

/** Contact form draft (name and a valid phone are filled). Uses keepalive so a final save survives leaving. */
export function saveContactDraft(payload: ContactDraftPayload): void {
  send('/track/contact', { session_id: trackingSessionId(), ...payload });
}
