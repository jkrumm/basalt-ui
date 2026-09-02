/**
 * Shared low-level pieces of `basalt-ui/format` — the em-dash sentinel and the memoized
 * `Intl.NumberFormat` cache every number formatter in this module reuses. Moved here (out of
 * `src/charts/utils/format.ts`, C5 consolidation) so the subpath is the single implementation and
 * `charts/utils/format.ts` becomes a thin re-export (`docs/CHARTS-SPEC.md` still calls it home for
 * chart callers, but the code lives here now).
 */

/**
 * What EVERY formatter in this module prints for input it cannot represent — `NaN`, `±Infinity`,
 * an `Invalid Date`. An em dash (U+2014). A formatter may say it does not know; it may not print a
 * number that is not one.
 */
export const NON_FINITE = '—'

/** Options every number formatter here accepts. */
export type LocaleOption = {
  /** BCP-47 tag. Default `undefined` — the runtime's own locale. */
  locale?: string
}

/**
 * `Intl.NumberFormat` construction is the expensive half of formatting and a chart formats one
 * label per tick per frame, so instances are memoized on their own arguments. The key is the
 * serialized options because that is exactly what identifies an instance.
 */
const formatterCache = new Map<string, Intl.NumberFormat>()

export function numberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`
  const cached = formatterCache.get(key)
  if (cached !== undefined) return cached
  const created = new Intl.NumberFormat(locale, options)
  formatterCache.set(key, created)
  return created
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()

export function dateFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`
  const cached = dateFormatterCache.get(key)
  if (cached !== undefined) return cached
  const created = new Intl.DateTimeFormat(locale, options)
  dateFormatterCache.set(key, created)
  return created
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
