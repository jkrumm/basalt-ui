/**
 * Article — the structured data model behind `ArticleCard`/`ArticleLayout` (docs/CONTENT-SPEC.md).
 * Pure data + pure functions: no React, no `@mantine/*`. Sortable/filterable article metadata
 * replaces the old preformatted `meta` string so a consumer can build a filter bar or a Spotlight
 * projector on top of it (both are a later stage — this module only ships the model).
 */

export type Article<C extends string = string, T extends string = string> = {
  readonly slug: string
  readonly title: string
  readonly description?: string
  /** ISO 8601 — sortable. Articles without a date sort last regardless of `ArticleOrder`. */
  readonly date?: string
  readonly category?: C
  readonly tags?: readonly T[]
  /** Minutes. */
  readonly readingTime?: number
}

export type ArticleOrder = 'date-desc' | 'date-asc' | 'title'

/**
 * Sorts articles. Pure — never mutates `articles`, always returns a new array.
 *
 * - `'date-desc'` (default) / `'date-asc'` — compares `date` lexicographically (ISO 8601 sorts
 *   chronologically as a string, so no `Date` parsing is needed). Articles missing a `date` sort
 *   LAST in both directions — a missing date is not "oldest", it's unranked.
 * - `'title'` — `localeCompare` with a PINNED `'en-US'` locale, not the runtime default, so sort
 *   order doesn't drift between environments.
 *
 * Stable: articles that compare equal keep their input order (native `toSorted` is a stable sort).
 */
export function sortArticles<A extends Article>(
  articles: readonly A[],
  order: ArticleOrder = 'date-desc',
): readonly A[] {
  if (order === 'title') {
    return articles.toSorted((a, b) => a.title.localeCompare(b.title, 'en-US'))
  }

  const direction = order === 'date-asc' ? 1 : -1
  return articles.toSorted((a, b) => {
    if (a.date === undefined && b.date === undefined) return 0
    if (a.date === undefined) return 1
    if (b.date === undefined) return -1
    if (a.date === b.date) return 0
    return a.date < b.date ? -direction : direction
  })
}

export type ArticleFilterQuery = {
  readonly category?: string
  readonly tags?: readonly string[]
}

/**
 * Filters articles. Pure — never mutates `articles`.
 *
 * - `category` — exact match. `undefined`/`''` applies no constraint.
 * - `tags` — ANY-OF (OR): an article matches if it carries at least one queried tag.
 *   `undefined`/`[]` applies no constraint.
 * - Both axes given: AND between category and tags, OR within tags — matches the multi-facet
 *   `filterFn` semantics in `data/data-table.tsx`.
 *
 * An empty query (`{}`, or a query where both axes are unset) returns `articles` unchanged.
 */
export function filterArticles<A extends Article>(
  articles: readonly A[],
  query: ArticleFilterQuery,
): readonly A[] {
  const { category, tags } = query
  const hasCategory = category !== undefined && category !== ''
  const hasTags = tags !== undefined && tags.length > 0

  if (!hasCategory && !hasTags) return articles

  return articles.filter((article) => {
    if (hasCategory && article.category !== category) return false
    if (hasTags && tags !== undefined && !tags.some((tag) => article.tags?.includes(tag))) {
      return false
    }
    return true
  })
}

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
