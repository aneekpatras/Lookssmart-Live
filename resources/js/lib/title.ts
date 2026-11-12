/**
 * Document-title formatting shared by the client (`app.tsx`) and the SSR entry (`ssr.tsx`).
 *
 * Admin/auth pages pass a short title ("Bookings") and get " - <app name>" appended. Public pages already
 * receive their FINAL <title> from the server (SEO: the exact string written into the raw HTML), so
 * `SeoHead` marks it with this invisible prefix and it is used verbatim — otherwise the browser would
 * re-title the page differently from what crawlers read in the raw HTML.
 */
export const EXACT_TITLE_PREFIX = '\u2063';

export function formatTitle(title: string, appName: string): string {
  if (!title) return appName;

  return title.startsWith(EXACT_TITLE_PREFIX)
    ? title.slice(EXACT_TITLE_PREFIX.length)
    : `${title} - ${appName}`;
}
