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

/** A plausible phone: optional +, then 10 to 19 digits once spaces and dashes are removed. */
export function normalisePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  return /^\+?[0-9]{10,19}$/.test(cleaned) ? cleaned : null;
}

export function saveIncompleteBooking(payload: IncompleteBookingPayload): void {
  send('/track/incomplete', { session_id: trackingSessionId(), ...payload });
}
