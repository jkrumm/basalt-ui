/**
 * Helpers shared by the scenario fixtures: the seeded generator and the day label.
 */

/** mulberry32 — a 32-bit seeded generator, the smallest one with a flat enough spread for noise. */
export function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/**
 * A UTC month name from a fixed table: ICU data differs by platform (Linux renders September as
 * "Sept"), and the labels are pinned in tests and screenshots.
 */
export const monthName = (date: Date, style: 'long' | 'short'): string => {
  const name = MONTHS[date.getUTCMonth()] ?? ''
  return style === 'long' ? name : name.slice(0, 3)
}

// A fixed table, not `basalt-ui/format`: its `date` has no day-and-month width ("16 Oct"), and ICU
// differs by platform for en-GB September. Page-level dates are the provider's `locale="en-GB"`.
export const fmtDay = (date: Date): string => `${date.getUTCDate()} ${monthName(date, 'short')}`

/** `values` as `{ at, value }` points `stepMs` apart, the last at `lastAt` (epoch ms): a sparkline readout names the point it hovers. */
export const timedPoints = (
  values: readonly number[],
  lastAt: number,
  stepMs: number,
): { at: number; value: number }[] =>
  values.map((value, i) => ({ at: lastAt - (values.length - 1 - i) * stepMs, value }))

/** The value at `index`, or a throw naming the fixture — a fixture list is never sparse. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const resolved = index < 0 ? items.length + index : index
  if (resolved < 0 || resolved >= items.length) {
    throw new Error(`fixture list of ${items.length} has no item at ${index}`)
  }
  return items[resolved] as T
}

/** A contiguous band of a scale; `from` is inclusive. */
type Zone = { from: number; to: number; label: string }

/**
 * The zone holding `value`: below the first zone falls in the first, at or past the end in the last.
 * A non-finite value has no zone (`undefined`); the caller decides the copy, never a NaN.
 */
export function zoneFor<const Z extends readonly Zone[]>(
  zones: Z,
  value: number,
): Z[number] | undefined {
  if (!Number.isFinite(value)) return undefined
  const first = itemAt(zones, 0)
  if (value < first.from) return first
  return zones.find((z) => value >= z.from && value < z.to) ?? itemAt(zones, -1)
}

/** `+` or the true minus sign in front of `body`, by the sign of `value`. */
export const withSign = (value: number, body: string): string =>
  `${value < 0 ? '\u2212' : '+'}${body}`

const INT = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const EUR = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const EUR_COMPACT = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const fmtInt = (value: number): string => INT.format(value)
/** `€400`, `€1.2K`: an axis tick that keeps its unit. */
export const fmtEurCompact = (value: number): string => EUR_COMPACT.format(value)
export const fmtShare = (value: number): string => `${Math.round(value * 100)}%`
/**
 * Whole percents of `shares` (fractions of one whole) that sum to exactly 100: each share is floored,
 * then the leftover points go to the largest remainders. Plain rounding gives 99 or 101.
 */
export function roundShares(shares: readonly number[]): number[] {
  const floored = shares.map((s) => Math.floor(s * 100 + 1e-9))
  let left = 100 - floored.reduce((a, b) => a + b, 0)
  const byRemainder = shares
    .map((s, i) => ({ i, rest: s * 100 - (floored[i] ?? 0) }))
    .toSorted((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of byRemainder) {
    if (left <= 0) break
    floored[i] = (floored[i] ?? 0) + 1
    left -= 1
  }
  return floored
}
export const fmtSignedShare = (value: number): string =>
  withSign(value, `${Math.abs(Math.round(value * 100))}%`)
export const fmtEur = (value: number): string => EUR.format(Math.round(value))
export const fmtSignedEur = (value: number): string => withSign(value, fmtEur(Math.abs(value)))
export const fmtKg = (value: number): string => `${fmtInt(Math.round(value))} kg`
export const fmtKm = (value: number): string => value.toFixed(1)
export const fmtRatio = (value: number): string => value.toFixed(2)
