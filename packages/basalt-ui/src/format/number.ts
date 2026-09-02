/**
 * Number formatting — `Intl.NumberFormat` with the arguments already decided, so a caller states
 * WHAT a number is rather than how to punctuate it. Moved here from `src/charts/utils/format.ts`
 * (C5 consolidation) — that file now re-exports from this module so charts keep working through
 * one implementation.
 *
 * `money`/`percent`/`integer`/`compact`/`deltaPct` are the argo-facing names (seeded from
 * `features/*\/{formatters,formulas}.ts`); `fmtCurrency`/`fmtPercent`/`fmtInt`/`fmtCompact` are the
 * original chart-formatter names, kept for source compatibility and delegated to by the new names.
 */
import { NON_FINITE, numberFormat } from './shared'
import type { LocaleOption } from './shared'

export type { LocaleOption }
export { NON_FINITE }

/** The compact `K` suffix, matched only where it follows the digits it qualifies — so a currency
 * prefix that happens to contain one (`HK$`) survives the lowercasing. */
const COMPACT_K = /(\d\s?)K/

export type FmtCompactOptions = LocaleOption & {
  /** Significant-ish fraction digits on the compacted number. Default 1 (`1.2k`, `3.4M`). */
  digits?: number
}

/**
 * Compact notation: `1.2k`, `3.4M`, `-820`. The axis formatter for any count whose range spans
 * more than three digits. A non-finite value prints {@link NON_FINITE}.
 *
 * Note `Intl`'s compact notation is LOCALE text, not a suffix table: `en` gives `1.2K`, and this
 * lowercases the `K` to match the package's own numeral style while leaving every other locale's
 * word (`1,2 Mio.`) untouched.
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

/** `compact` — the `basalt-ui/format` name for {@link fmtCompact}. */
export const compact = fmtCompact

export type FmtPercentOptions = LocaleOption & {
  /** Fraction digits. Default 0 (`42%`). */
  digits?: number
  /**
   * What the incoming number MEANS. `'ratio'` (default) is `0.42 → 42%`; `'percent'` is
   * `42 → 42%`. Required as an explicit option rather than guessed from magnitude.
   */
  input?: 'ratio' | 'percent'
}

/** Percentages, from either a ratio or an already-scaled percentage. A non-finite value prints
 * {@link NON_FINITE}. */
export function fmtPercent(value: number, options: FmtPercentOptions = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { digits = 0, input = 'ratio', locale } = options
  return numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(input === 'percent' ? value / 100 : value)
}

/** `percent` — the `basalt-ui/format` name for {@link fmtPercent}. */
export const percent = fmtPercent

export type DeltaPctOptions = FmtPercentOptions

/**
 * A signed percentage delta: `+4%`, `-12%`, `0%` — argo's `walking-pad/formatters.ts#formatPct`
 * (a `+`-prefixed ratio) generalized onto `Intl`'s own `signDisplay: 'exceptZero'`, which adds the
 * `+`/`-` sign the same way `Intl`'s own minus sign already does, and adds nothing for zero. A
 * non-finite value prints {@link NON_FINITE}.
 */
export function deltaPct(value: number, options: DeltaPctOptions = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { digits = 0, input = 'ratio', locale } = options
  return numberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(input === 'percent' ? value / 100 : value)
}

export type FmtCurrencyOptions = LocaleOption & {
  /** ISO 4217 code — required. There is no default currency. */
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
  const { currency, compact: isCompact = false, digits, locale } = options
  const fractionDigits = digits ?? (isCompact ? 1 : 0)
  return numberFormat(locale, {
    style: 'currency',
    currency,
    ...(isCompact && { notation: 'compact', compactDisplay: 'short' }),
    minimumFractionDigits: isCompact ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(value)
    .replace(COMPACT_K, '$1k')
}

/** `money` — the `basalt-ui/format` name for {@link fmtCurrency}. */
export const money = fmtCurrency

/** Grouped integer: `12,480`. Rounds. A non-finite value prints {@link NON_FINITE}. */
export function fmtInt(value: number, options: LocaleOption = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  return numberFormat(options.locale, { maximumFractionDigits: 0 }).format(value)
}

/** `integer` — the `basalt-ui/format` name for {@link fmtInt}. */
export const integer = fmtInt
