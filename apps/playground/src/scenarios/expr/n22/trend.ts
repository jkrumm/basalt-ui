import type { Morning } from './fixture'

export type Signal = 'rhr' | 'hrv'
export type Verdict = 'improving' | 'stable' | 'declining'

export const WINDOW = 28
/** Mornings a window needs before its slope counts. */
export const MIN_MORNINGS = 20
/** The slope that counts as a change: 5 % of the window's mean over 28 days. */
export const THRESHOLD_PCT = 5

/** A lower resting rate is fitter, a higher HRV is fitter. */
const FIT_SIGN: Record<Signal, 1 | -1> = { rhr: -1, hrv: 1 }

export type Change = {
  /** Least-squares change over 28 days, in the signal's unit. */
  raw: number
  /** The same change as a share of the window mean, signed so that up is fitter. */
  pct: number
  mean: number
  logged: number
}

export type TrendRow = {
  date: Date
  rhr: number | null
  hrv: number | null
  rhrChange: Change | null
  hrvChange: Change | null
}

/** Least-squares slope over the 28 mornings ending at `end`, gaps skipped. */
function windowChange(
  values: readonly (number | null)[],
  end: number,
  signal: Signal,
): Change | null {
  const points: { t: number; v: number }[] = []
  for (let t = Math.max(0, end - WINDOW + 1); t <= end; t++) {
    const v = values[t]
    if (typeof v === 'number') points.push({ t, v })
  }
  if (points.length < MIN_MORNINGS) return null
  const n = points.length
  const meanT = points.reduce((s, p) => s + p.t, 0) / n
  const mean = points.reduce((s, p) => s + p.v, 0) / n
  const num = points.reduce((s, p) => s + (p.t - meanT) * (p.v - mean), 0)
  const den = points.reduce((s, p) => s + (p.t - meanT) ** 2, 0)
  const raw = (num / den) * WINDOW
  return { raw, pct: ((FIT_SIGN[signal] * raw) / mean) * 100, mean, logged: n }
}

/** One row per morning that has a full 28-day window behind it. */
export function buildTrend(mornings: readonly Morning[]): readonly TrendRow[] {
  const rhrs = mornings.map((m) => m.rhr)
  const hrvs = mornings.map((m) => m.hrv)
  return mornings.flatMap((m, i) => {
    if (i < WINDOW - 1) return []
    const rhrChange = windowChange(rhrs, i, 'rhr')
    const hrvChange = windowChange(hrvs, i, 'hrv')
    return [
      {
        date: m.date,
        rhr: rhrChange?.pct ?? null,
        hrv: hrvChange?.pct ?? null,
        rhrChange,
        hrvChange,
      },
    ]
  })
}

export function signalVerdict(change: Change | null): Verdict | null {
  if (change === null) return null
  if (change.pct > THRESHOLD_PCT) return 'improving'
  if (change.pct < -THRESHOLD_PCT) return 'declining'
  return 'stable'
}

export type Direction = {
  verdict: Verdict
  /** The signals past the threshold in the verdict's direction, the larger first. */
  leading: readonly Signal[]
  /** The leading signal's change, or the larger of the two when stable. */
  headline: { signal: Signal; pct: number }
}

/** The verdict is the net of the signals that moved; null when no signal has a window. */
export function direction(row: TrendRow): Direction | null {
  const entries = (['rhr', 'hrv'] as const).flatMap((signal) => {
    const change = signal === 'rhr' ? row.rhrChange : row.hrvChange
    return change === null ? [] : [{ signal, pct: change.pct, verdict: signalVerdict(change) }]
  })
  if (entries.length === 0) return null
  const net = entries.reduce(
    (s, e) => s + (e.verdict === 'improving' ? 1 : e.verdict === 'declining' ? -1 : 0),
    0,
  )
  const verdict: Verdict = net > 0 ? 'improving' : net < 0 ? 'declining' : 'stable'
  const sorted = [...entries].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
  const leading = sorted.filter((e) => e.verdict === verdict && verdict !== 'stable')
  const first = leading[0] ?? sorted[0]
  if (first === undefined) return null
  return {
    verdict,
    leading: leading.map((e) => e.signal),
    headline: { signal: first.signal, pct: first.pct },
  }
}
