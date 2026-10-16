/**
 * Shared low-level pieces of `basalt-ui/format` — the em-dash sentinel, the default
 * locale / time zone ({@link defineFormat}) and the memoized `Intl` caches every formatter in this
 * module reuses. Moved here (out of
 * `src/charts/utils/format.ts`, C5 consolidation) so the subpath is the single implementation;
 * 2.0's chart layer imports it directly (`docs/V2-SPEC.md` § 9).
 */

/**
 * What EVERY formatter in this module prints for input it cannot represent — `NaN`, `±Infinity`,
 * an `Invalid Date`. An em dash (U+2014). A formatter may say it does not know; it may not print a
 * number that is not one.
 */
export const NON_FINITE = '—'

/** Options every number/measure formatter accepts. */
export type LocaleOption = {
  /** BCP-47 tag. Default: the {@link defineFormat} default, else the runtime's own locale. */
  locale?: string | undefined
}

export type FormatDefaults = {
  /** BCP-47 tag every formatter uses when a call passes none. */
  locale?: string | undefined
  /** IANA time zone every date formatter uses when a call passes none. */
  timeZone?: string | undefined
}

let defaults: FormatDefaults = {}

/**
 * Sets the locale / time zone every formatter in `basalt-ui/format` falls back to. Replaces the
 * previous defaults wholesale (so `defineFormat()` resets) and is idempotent — `BasaltProvider`
 * calls it during render from its `locale` / `timeZone` props. Unset stays `undefined`: the
 * runtime's own locale and zone.
 */
export function defineFormat(next: FormatDefaults = {}): void {
  defaults = { locale: next.locale, timeZone: next.timeZone }
}

/**
 * Cache key: the options' own entries, sorted, joined — no serialization of the whole object per
 * call (a chart formats one label per tick per frame). Option values here are primitives.
 */
function optionsKey(options: object): string {
  let key = ''
  for (const name of Object.keys(options).toSorted()) {
    key += `${name}=${String((options as Record<string, unknown>)[name])};`
  }
  return key
}

/**
 * `Intl` construction is the expensive half of formatting, so instances are memoized per RESOLVED
 * locale (call locale, else the default) — a changed default can never serve a stale instance.
 */
const numberCaches = new Map<string, Map<string, Intl.NumberFormat>>()
const dateCaches = new Map<string, Map<string, Intl.DateTimeFormat>>()

function memoize<T>(
  caches: Map<string, Map<string, T>>,
  locale: string | undefined,
  options: object,
  create: () => T,
): T {
  const localeKey = locale ?? ''
  let cache = caches.get(localeKey)
  if (cache === undefined) {
    cache = new Map()
    caches.set(localeKey, cache)
  }
  const key = optionsKey(options)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const created = create()
  cache.set(key, created)
  return created
}

export function numberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const resolved = locale ?? defaults.locale
  return memoize(numberCaches, resolved, options, () => new Intl.NumberFormat(resolved, options))
}

export function dateFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const resolved = locale ?? defaults.locale
  const withZone =
    options.timeZone === undefined && defaults.timeZone !== undefined
      ? { ...options, timeZone: defaults.timeZone }
      : options
  return memoize(dateCaches, resolved, withZone, () => new Intl.DateTimeFormat(resolved, withZone))
}

/** True for a finite number; `null`, `undefined`, `NaN` and `±Infinity` are the inputs every
 * number/measure formatter answers with {@link NON_FINITE}. */
export function isNumeric(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Coerces the flexible `Date | number | string` inputs this module's date formatters accept into
 * a `Date`. A `number` is treated as epoch milliseconds (matching `Date`'s own constructor and
 * `agent-chat/relative-time.ts`'s prior contract) — a caller with epoch seconds multiplies by
 * 1000 first. Returns `null` for a non-finite/unparseable input so every caller can share one
 * {@link NON_FINITE} guard instead of re-deriving one. */
export function toDate(value: Date | number | string): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
