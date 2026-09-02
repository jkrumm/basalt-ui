const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * What EVERY formatter here prints for input it cannot represent — `NaN`, `±Infinity`, an
 * `Invalid Date`. An em dash (U+2014), the same glyph the tooltip already uses for a missing value.
 *
 * The rule is one rule on purpose. `Intl.NumberFormat` renders `NaN` as the literal string `"NaN"`
 * and `Infinity` as `"∞"`, so a y axis whose domain collapsed (an empty series, a 0/0 rate, a log
 * scale reaching zero) painted its own arithmetic accident as a tick label and a tooltip read
 * `NaN%`. A chart may say it does not know; it may not print a number that is not one.
 */
export const NON_FINITE = '\u2014'

/** Axis-friendly short date: DD.MM. A non-finite or invalid date prints {@link NON_FINITE}. */
export function fmtAxisDate(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) return NON_FINITE
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return NON_FINITE
    const dd = String(value.getDate()).padStart(2, '0')
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}`
  }
  const s = String(value ?? '')
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}.${match[2]}`
  return s
}

/** Tooltip-friendly long date: "Mon Apr 21 2026". A non-finite or invalid date prints
 * {@link NON_FINITE}. */
export function fmtTooltipDate(date: unknown): string {
  if (typeof date === 'number' && !Number.isFinite(date)) return NON_FINITE
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return NON_FINITE
    return `${SHORT_DAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
  }
  const s = String(date ?? '')
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return s
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return `${SHORT_DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`
}

/**
 * The number-format law.
 *
 * `format.ts` shipped two date formatters and nothing else, so every axis and every tooltip in
 * every demo and consumer hand-rolled its own `` `$${v}k` `` — a template literal that is not
 * locale-aware, not compact-aware, and different in each of the places it was written. These four
 * are `Intl.NumberFormat` with the arguments already decided, so a chart states WHAT a number is
 * rather than how to punctuate it.
 *
 * `locale` defaults to `undefined`, which is `Intl`'s own "use the runtime's locale" — the correct
 * default for an app whose reader is the person looking at it. Pass it explicitly (`'en-US'`) when
 * the output must be stable regardless of where it runs, which is what the tests here do.
 *
 * Every one of them returns {@link NON_FINITE} for input that is not a finite number — see its
 * JSDoc for why that is a law of this module rather than a per-call-site guard.
 */

/** Options every formatter here accepts. */
type LocaleOption = {
  /** BCP-47 tag. Default `undefined` — the runtime's own locale. */
  locale?: string
}

/**
 * `Intl.NumberFormat` construction is the expensive half of formatting and a chart formats one
 * label per tick per frame, so instances are memoized on their own arguments. The key is the
 * serialized options because that is exactly what identifies an instance.
 */
const formatterCache = new Map<string, Intl.NumberFormat>()

/** The compact `K` suffix, matched only where it follows the digits it qualifies — so a currency
 * prefix that happens to contain one (`HK$`) survives the lowercasing. */
const COMPACT_K = /(\d\s?)K/

function numberFormat(
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

export type FmtCompactOptions = LocaleOption & {
  /** Significant-ish fraction digits on the compacted number. Default 1 (`1.2k`, `3.4M`). */
  digits?: number
}

/**
 * Compact notation: `1.2k`, `3.4M`, `-820`. The axis formatter for any count whose range spans
 * more than three digits — a y axis reading `1,200,000` spends a third of the plot width on a
 * gutter. A non-finite value prints {@link NON_FINITE}.
 *
 * Note `Intl`'s compact notation is LOCALE text, not a suffix table: `en` gives `1.2K`, and this
 * lowercases the `K` to match the package's own numeral style while leaving every other locale's
 * word (`1,2 Mio.`) untouched. Only a `K` attached to the DIGITS is touched — `HK$1.2K` must keep
 * its currency prefix, which a bare `replace('K', 'k')` ate.
 */
export function fmtCompact(value: number, options: FmtCompactOptions = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { digits = 1, locale } = options
  return numberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(COMPACT_K, '$1k')
}

export type FmtPercentOptions = LocaleOption & {
  /** Fraction digits. Default 0 (`42%`). */
  digits?: number
  /**
   * What the incoming number MEANS. `'ratio'` (default) is `0.42 → 42%`; `'percent'` is
   * `42 → 42%`. Required as an explicit option rather than guessed from magnitude: a ratio of 1.2
   * and a percentage of 1.2 are both perfectly ordinary numbers, and a heuristic would silently
   * render one of them 100× wrong.
   */
  input?: 'ratio' | 'percent'
}

/** Percentages, from either a ratio or an already-scaled percentage. A non-finite value prints
 * {@link NON_FINITE} — a rate is the commonest source of a 0/0. */
export function fmtPercent(value: number, options: FmtPercentOptions = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { digits = 0, input = 'ratio', locale } = options
  return numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(input === 'percent' ? value / 100 : value)
}

export type FmtCurrencyOptions = LocaleOption & {
  /** ISO 4217 code — required. There is no default currency; a wrong symbol is worse than a
   * verbose call site. */
  currency: string
  /** Compact notation for the amount (`$1.2k`). Default false. */
  compact?: boolean
  /** Fraction digits. Default 0 compacted, else the currency's own default (`undefined`). */
  digits?: number
}

/** Money. `fmtCurrency(1234, { currency: 'USD' })` → `$1,234`. A non-finite amount prints
 * {@link NON_FINITE}. */
export function fmtCurrency(value: number, options: FmtCurrencyOptions): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { currency, compact = false, digits, locale } = options
  const fractionDigits = digits ?? (compact ? 1 : 0)
  return numberFormat(locale, {
    style: 'currency',
    currency,
    ...(compact && { notation: 'compact', compactDisplay: 'short' }),
    minimumFractionDigits: compact ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(value)
    .replace(COMPACT_K, '$1k')
}

/** Grouped integer: `12,480`. Rounds — an integer formatter that printed `12,480.4` would be
 * lying about its own name. A non-finite value prints {@link NON_FINITE}. */
export function fmtInt(value: number, options: LocaleOption = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  return numberFormat(options.locale, { maximumFractionDigits: 0 }).format(value)
}

/**
 * Every shipped formatter under one name, so a chart can be handed the whole set
 * (`format={formatters.compact}`) and a consumer has one import to reach for instead of four.
 * Same members as the named exports — this is a convenience, never a second implementation.
 */
export const formatters = {
  compact: fmtCompact,
  percent: fmtPercent,
  currency: fmtCurrency,
  int: fmtInt,
  axisDate: fmtAxisDate,
  tooltipDate: fmtTooltipDate,
} as const
