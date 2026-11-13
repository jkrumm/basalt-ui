/**
 * c03 fixture and model: one tool's calls over the last 24 hours against its SLO.
 *
 * Seeded and pure: the window is pinned to a fixed instant and every number derives from a small
 * PRNG, so a render is identical on every run. The hourly buckets exist to make the totals; the
 * surface only states the totals.
 */

/** The instant the 24 h window ends (UTC). Nothing reads the clock. */
export const WINDOW_END = Date.UTC(2026, 10, 13, 12, 0, 0)
export const TOOL_NAME = 'search_documents'
/** The availability objective, percent of calls that must succeed. */
export const SLO_TARGET_PCT = 99.9

const HOURS = 24
const SEED = 0x5eed_c03

/** mulberry32: a 32-bit seeded generator, enough for a fixture. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Calls = { total: number; failed: number }

/** One point per hour, the running totals at the end of that hour. */
export type BurnRow = { at: Date; total: number; failed: number; allowed: number }

export type SloFixture = { calls: Calls; rows: readonly BurnRow[] }

/** `rest`: inside the SLO. `over`: the same traffic with failures near doubled, past the allowance. `zero`: no failure at all. */
export type FixtureName = 'rest' | 'over' | 'zero'
const FAILURE_SCALE: Record<FixtureName, number> = { rest: 1, over: 1.9, zero: 0 }

export const isFixtureName = (value: unknown): value is FixtureName =>
  value === 'rest' || value === 'over' || value === 'zero'

const HOUR_MS = 3_600_000

/** Hourly buckets oldest first: a daytime peak, a quiet night, and several hours with no failure. */
function hourlyCalls(failureScale: number): readonly Calls[] {
  const rand = seeded(SEED)
  return Array.from({ length: HOURS }, (_, h) => {
    const clock = (new Date(WINDOW_END).getUTCHours() - (HOURS - 1 - h) + 48) % 24
    const diurnal = 0.35 + 0.65 * Math.max(0, Math.sin(((clock - 6) / 24) * 2 * Math.PI))
    const total = Math.round(52_000 * diurnal * (0.9 + 0.2 * rand()))
    const quiet = rand() < 0.2
    const failed = quiet ? 0 : Math.round(total * 0.0012 * (0.2 + 1.6 * rand()) * failureScale)
    return { total, failed }
  })
}

export function sloFixture(name: FixtureName, targetPct: number): SloFixture {
  let total = 0
  let failed = 0
  const rows = hourlyCalls(FAILURE_SCALE[name]).map((h, i): BurnRow => {
    total += h.total
    failed += h.failed
    return {
      at: new Date(WINDOW_END - (HOURS - 1 - i) * HOUR_MS),
      total,
      failed,
      allowed: allowedFailures(total, targetPct),
    }
  })
  return { calls: { total, failed }, rows }
}

const FLOAT_SLACK = 1e-9

// cycle-expression-1: no SLO or error-budget helper in the kit; allowed-failures arithmetic is hand-written.
function allowedFailures(total: number, targetPct: number): number {
  return Math.floor((total * (100 - targetPct)) / 100 + FLOAT_SLACK)
}

export type SloReading = {
  /** Success rate in percent, truncated to three decimals; null when there were no calls. */
  ratePct: number | null
  /** Success rate minus the target, in percentage points; null with no reading. */
  marginPts: number | null
  /** Failed calls the target allows over this many calls. */
  allowed: number
  /** Allowed minus failed: negative once the SLO is missed. */
  left: number
  inside: boolean
}

/**
 * The rate is truncated, never rounded: 99.8996 must not print as the 99.900 that meets a 99.9
 * target. Inside is decided on whole calls (failed <= allowed), which is the same test as the rate.
 */
export function sloReading(calls: Calls, targetPct: number): SloReading {
  const allowed = allowedFailures(calls.total, targetPct)
  const left = allowed - calls.failed
  if (calls.total === 0) return { ratePct: null, marginPts: null, allowed, left, inside: true }
  // cycle-expression-1: `percent()` only rounds, so a never-overstate truncation is hand-written.
  const ratePct = Math.floor(((calls.total - calls.failed) / calls.total) * 100 * 1000) / 1000
  // Three decimals again: the subtraction carries float noise that would read as a non-zero margin.
  const marginPts = Math.round((ratePct - targetPct) * 1000) / 1000
  return { ratePct, marginPts, allowed, left, inside: left >= 0 }
}
