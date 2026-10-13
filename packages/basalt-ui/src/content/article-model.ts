/** Article date formatting for `ArticleLayout` — pure, no React, no `@mantine/*`. */

/**
 * Formats an ISO 8601 date string via `Intl.DateTimeFormat` → `'Jul 16, 2026'`.
 *
 * Two things are PINNED, both load-bearing for SSR/client parity:
 * - `locale` defaults to `'en-US'`, not the runtime default — the runtime default can differ
 *   between the server and the browser, which would render a different string on each side and
 *   trip a React hydration mismatch.
 * - `timeZone` is pinned to `'UTC'` — a date-only ISO string (`'2026-07-16'`) parses as UTC
 *   midnight; formatting it in the server/browser's LOCAL zone can shift it a day either way
 *   depending on the runtime's offset, which is the same hydration-mismatch failure mode as an
 *   unpinned locale, just on the date instead of the string shape.
 *
 * Invalid/unparseable input is returned unchanged — never throws, never renders `'Invalid Date'`.
 */
export function formatArticleDate(iso: string, locale = 'en-US'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
