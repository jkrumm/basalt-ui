/**
 * Distance/energy formatting. Both accept `null | undefined` and print {@link NON_FINITE} for it.
 */
import { isFiniteNumber, NON_FINITE, numberFormat, scaleThousands } from './shared'
import type { LocaleOption, Numeric } from './shared'

export type KmOptions = LocaleOption & {
  /** Fraction digits. Default 2 (`"5.30 km"`). */
  digits?: number
}

/** Meters as kilometers — `"5.30 km"` (`"5,30 km"` in `de`). */
export function km(meters: Numeric, options: KmOptions = {}): string {
  if (!isFiniteNumber(meters)) return NON_FINITE
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
export function kcal(value: Numeric, options: KcalOptions = {}): string {
  if (!isFiniteNumber(value)) return NON_FINITE
  const { digits = 2, locale } = options
  const { scaled, unit } = scaleThousands(value, digits, 1)
  const text = numberFormat(locale, {
    signDisplay: 'negative',
    maximumFractionDigits: unit === 0 ? 0 : digits,
  }).format(scaled)
  return `${text}${unit === 0 ? '' : 'k'} kcal`
}
