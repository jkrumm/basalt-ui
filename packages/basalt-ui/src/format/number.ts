/**
 * Number formatting — `Intl.NumberFormat` with the arguments already decided, so a caller states
 * WHAT a number is rather than how to punctuate it. One implementation: the chart layer imports
 * `compact` from here for its default axis format. Every formatter accepts `null | undefined` and
 * prints {@link NON_FINITE} for it (as for `NaN` / `±Infinity`).
 */
import { isNumeric, NON_FINITE, numberFormat } from './shared'
import type { LocaleOption } from './shared'

export type { LocaleOption }
export { NON_FINITE }

type Numeric = number | null | undefined

/** The compact `K` suffix, matched only where it follows the digits it qualifies — so a currency
 * prefix that happens to contain one (`HK$`) survives the lowercasing. */
const COMPACT_K = /(\d\s?)K/

/** `negative` hides the sign of `-0` and of a negative that rounds to zero (`-0.4` → `0`). */
const SIGN: Intl.NumberFormatOptions = { signDisplay: 'negative' }

export type CompactOptions = LocaleOption & {
  /** Fraction digits on the compacted number. Default 1 (`1.2k`, `3.4M`). */
  digits?: number
}

/**
 * Compact notation: `1.2k`, `3.4M`, `-820`. The axis formatter for any count whose range spans
 * more than three digits.
 *
 * Note `Intl`'s compact notation is LOCALE text, not a suffix table: `en` gives `1.2K`, and this
 * lowercases the `K` to match the package's own numeral style while leaving every other locale's
 * word (`1,2 Mio.`) untouched.
 */
export function compact(value: Numeric, options: CompactOptions = {}): string {
  if (!isNumeric(value)) return NON_FINITE
  const { digits = 1, locale } = options
  return numberFormat(locale, {
    ...SIGN,
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(COMPACT_K, '$1k')
}

export type PercentOptions = LocaleOption & {
  /** Fraction digits. Default 0 (`42%`). */
  digits?: number
  /**
   * What the incoming number MEANS. `'ratio'` (default) is `0.42 → 42%`; `'percent'` is
   * `42 → 42%`. Required as an explicit option rather than guessed from magnitude.
   */
  input?: 'ratio' | 'percent'
}

/** Percentages, from either a ratio or an already-scaled percentage. */
export function percent(value: Numeric, options: PercentOptions = {}): string {
  if (!isNumeric(value)) return NON_FINITE
  const { digits = 0, input = 'ratio', locale } = options
  return numberFormat(locale, {
    ...SIGN,
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(input === 'percent' ? value / 100 : value)
}

export type MoneyOptions = LocaleOption & {
  /** ISO 4217 code — required. There is no default currency. */
  currency: string
  /** Compact notation for the amount (`$1.2k`). Default false. */
  compact?: boolean
  /**
   * Fraction digits. Unset → the currency's own default (USD 2, JPY 0) — or, compacted, up to 1.
   * An explicit number (`0`) pins min and max: an opt-in to rounding away the cents.
   */
  digits?: number
}

/** Money. `money(12.5, { currency: 'USD' })` → `$12.50`. */
export function money(value: Numeric, options: MoneyOptions): string {
  if (!isNumeric(value)) return NON_FINITE
  const { currency, compact: isCompact = false, digits, locale } = options
  return numberFormat(locale, {
    ...SIGN,
    style: 'currency',
    currency,
    ...(isCompact && { notation: 'compact', compactDisplay: 'short' }),
    ...(isCompact
      ? { minimumFractionDigits: 0, maximumFractionDigits: digits ?? 1 }
      : digits !== undefined && { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  })
    .format(value)
    .replace(COMPACT_K, '$1k')
}

/** Grouped integer: `12,480`. Rounds. */
export function integer(value: Numeric, options: LocaleOption = {}): string {
  if (!isNumeric(value)) return NON_FINITE
  return numberFormat(options.locale, { ...SIGN, maximumFractionDigits: 0 }).format(value)
}

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'] as const

export type BytesOptions = LocaleOption & {
  /** Max fraction digits. Default 1 (`1.2 MB`). */
  digits?: number
}

/**
 * Byte sizes in DECIMAL (SI) units — `1 kB` is 1000 bytes, the convention of browsers' download
 * UIs, storage vendors and `Intl`'s own `kilobyte`. `bytes(1_200_000)` → `1.2 MB`; below 1000 it
 * prints whole bytes (`512 B`). Negative values keep their sign. The cap is `PB`.
 */
export function bytes(value: Numeric, options: BytesOptions = {}): string {
  if (!isNumeric(value)) return NON_FINITE
  const { digits = 1, locale } = options
  let unit = 0
  let scaled = value
  while (Math.abs(scaled) >= 1000 && unit < BYTE_UNITS.length - 1) {
    scaled /= 1000
    unit += 1
  }
  const text = numberFormat(locale, {
    ...SIGN,
    maximumFractionDigits: unit === 0 ? 0 : digits,
  }).format(scaled)
  return `${text} ${BYTE_UNITS[unit]}`
}

export type DeltaOptions = LocaleOption & {
  /** Max fraction digits. Default 1 (`+3.2`). */
  digits?: number
}

/** A signed change: `+3.2`, `-1`, `0`. Zero (and anything that rounds to it) carries no sign. */
export function delta(value: Numeric, options: DeltaOptions = {}): string {
  if (!isNumeric(value)) return NON_FINITE
  const { digits = 1, locale } = options
  return numberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: digits }).format(
    value,
  )
}
