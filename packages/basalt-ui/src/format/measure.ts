/**
 * Distance/energy formatting. Both accept `null | undefined` and print {@link NON_FINITE} for it.
 */
import { isNumeric, NON_FINITE, numberFormat } from './shared'
import type { LocaleOption } from './shared'

export type KmOptions = LocaleOption & {
  /** Fraction digits. Default 2 (`"5.30 km"`). */
  digits?: number
}

/** Meters as kilometers — `"5.30 km"` (`"5,30 km"` in `de`). */
export function km(meters: number | null | undefined, options: KmOptions = {}): string {
  if (!isNumeric(meters)) return NON_FINITE
  const { digits = 2, locale } = options
  return numberFormat(locale, {
    signDisplay: 'negative',
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(meters / 1000)
}

export type KcalOptions = LocaleOption & {
  /** Max fraction digits once scaled to thousands. Default 2. Below 1000 always whole. */
  digits?: number
}

/** Kilocalories — `"842 kcal"`, and `"1.24k kcal"` from 1000 up. The unit string is always
 * `kcal`. */
export function kcal(value: number | null | undefined, options: KcalOptions = {}): string {
  if (!isNumeric(value)) return NON_FINITE
  const { digits = 2, locale } = options
  const thousands = Math.abs(value) >= 1000
  const text = numberFormat(locale, {
    signDisplay: 'negative',
    maximumFractionDigits: thousands ? digits : 0,
  }).format(thousands ? value / 1000 : value)
  return `${text}${thousands ? 'k' : ''} kcal`
}
