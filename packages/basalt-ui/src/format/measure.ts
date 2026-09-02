/**
 * Distance/energy formatting — seeded from `walking-pad/formatters.ts#formatKm`/`#formatKcal`.
 */
import { NON_FINITE } from './shared'

export type KmOptions = {
  /** Fraction digits. Default 2 (`"5.30 km"`). */
  digits?: number
}

/** Meters as kilometers — `"5.30 km"`. A non-finite value prints {@link NON_FINITE}. */
export function km(meters: number, options: KmOptions = {}): string {
  if (!Number.isFinite(meters)) return NON_FINITE
  const { digits = 2 } = options
  return `${(meters / 1000).toFixed(digits)} km`
}

export type KcalOptions = {
  /** Fraction digits once compacted to `k cal`. Default 2. Below 1000 kcal always rounds to a
   * whole number, matching the seed (`formatKcal`). */
  digits?: number
}

/** Kilocalories, compacting to `"k cal"` above 1000 — `"842 kcal"`, `"1.24 k cal"`. A non-finite
 * value prints {@link NON_FINITE}. */
export function kcal(value: number, options: KcalOptions = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { digits = 2 } = options
  if (value >= 1000) return `${(value / 1000).toFixed(digits)} k cal`
  return `${Math.round(value)} kcal`
}
