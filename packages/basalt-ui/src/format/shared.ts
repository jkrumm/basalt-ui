/**
 * Shared low-level pieces of `basalt-ui/format`: the {@link NON_FINITE} sentinel, the default
 * locale / time zone ({@link defineFormat}), the memoized `Intl` caches and the number-input
 * guard every formatter in this module reuses. The subpath is the single implementation; the chart
 * layer imports it directly (`docs/V2-SPEC.md` § 9).
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

/**
 * `Intl` construction is the expensive half of formatting, so instances are memoized per RESOLVED
 * locale (call locale, else the default) — a changed default can never serve a stale instance.
 */
const numberCaches = new Map<string, Map<string, Intl.NumberFormat>>()
const dateCaches = new Map<string, Map<string, Intl.DateTimeFormat>>()

let defaults: FormatDefaults = {}

/**
 * Sets the locale / time zone every formatter in `basalt-ui/format` falls back to when a call
 * passes none. Merges: only DEFINED fields are applied, `undefined` leaves the earlier value.
 *
 * The default is ONE module-global per process (formatters are plain functions, not hooks), so it
 * is an app-wide setting, not a per-request one — a server rendering many locales passes `locale`
 * per call instead. `BasaltProvider`'s `locale` / `timeZone` props call this.
 */
export function defineFormat(next: FormatDefaults = {}): void {
  const merged: FormatDefaults = {
    locale: next.locale ?? defaults.locale,
    timeZone: next.timeZone ?? defaults.timeZone,
  }
  if (merged.locale === defaults.locale && merged.timeZone === defaults.timeZone) return
  defaults = merged
  numberCaches.clear()
  dateCaches.clear()
}

/** Clears the {@link defineFormat} defaults back to the runtime's own locale and zone. */
export function resetFormatDefaults(): void {
  defaults = {}
  numberCaches.clear()
  dateCaches.clear()
}

/**
 * Cache key: the options' own entries, sorted, joined — no serialization of the whole object per
 * call (a chart formats one label per tick per frame). Option values here are primitives.
 */
function optionsKey(options: object): string {
  let key = ''
  for (const [name, value] of Object.entries(options).sort(([a], [b]) => (a < b ? -1 : 1))) {
    key += `${name}=${String(value)};`
  }
  return key
}

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

/**
 * The ONE locale resolution every formatter shares: the call's own tag, else the
 * {@link defineFormat} default, else `undefined` (the runtime's own locale). Internal — not
 * re-exported from the public barrel.
 */
export function resolveLocale(locale?: string): string | undefined {
  return locale ?? defaults.locale
}

export function numberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const resolved = resolveLocale(locale)
  return memoize(numberCaches, resolved, options, () => new Intl.NumberFormat(resolved, options))
}

export function dateFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const resolved = resolveLocale(locale)
  const withZone =
    options.timeZone === undefined && defaults.timeZone !== undefined
      ? { ...options, timeZone: defaults.timeZone }
      : options
  return memoize(dateCaches, resolved, withZone, () => new Intl.DateTimeFormat(resolved, withZone))
}

/** What every number/measure formatter accepts. */
export type Numeric = number | null | undefined

/** True for a finite number; `null`, `undefined`, `NaN` and `±Infinity` are the inputs every
 * number/measure formatter answers with {@link NON_FINITE}. */
export function isFiniteNumber(value: Numeric): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Scales `value` down by 1000 per step (up to `maxUnit`) and returns the step. Rounds FIRST, then
 * promotes when the rounded magnitude reaches 1000 — `999.6` at step 0 is `1000` and belongs to
 * the next unit, not `1,000 B`. Step 0 is whole numbers; higher steps round to `digits`.
 */
export function scaleThousands(
  value: number,
  digits: number,
  maxUnit: number,
): { scaled: number; unit: number } {
  let scaled = value
  let unit = 0
  while (unit < maxUnit) {
    const factor = 10 ** (unit === 0 ? 0 : digits)
    if (Math.round(Math.abs(scaled) * factor) / factor < 1000) break
    scaled /= 1000
    unit += 1
  }
  return { scaled, unit }
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
