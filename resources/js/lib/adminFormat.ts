/**
 * Shared admin formatters: Karachi time as "15 Nov, 9:04 PM" plus a relative hint ("2 hours ago"), and
 * simple pluralisation. Use these instead of toLocaleString so every admin list reads the same.
 */
const TZ = 'Asia/Karachi';

export function formatKarachi(iso: string | null | undefined, withWeekday = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${day}, ${time}`;
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(diff)) return '';
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? 'ago' : 'from now';

  if (abs < 60) return 'just now';
  const units: [number, string][] = [
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [seconds, label] of units) {
    if (abs >= seconds) {
      const count = Math.floor(abs / seconds);
      return `${count} ${label}${count === 1 ? '' : 's'} ${suffix}`;
    }
  }
  return '';
}

/** "15 Nov, 9:04 PM (2 hours ago)" */
export function formatWithRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const hint = relativeTime(iso);

  return hint ? `${formatKarachi(iso)} (${hint})` : formatKarachi(iso);
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
