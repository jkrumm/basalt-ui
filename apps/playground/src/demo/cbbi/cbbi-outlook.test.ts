/**
 * `cbbi-outlook.ts` on a synthetic three-cycle series — the gate, the forward arithmetic and the
 * days-since-ATH context, each against numbers the fixture makes exact.
 */
import { describe, expect, it } from 'bun:test'
import { CBBI_METRIC_KEYS, isoDay } from './cbbi-data'
import type { CbbiMetricKey, CbbiRow } from './cbbi-data'
import { diagnoseAll } from './cbbi-diagnostics'
import { baseRates, conditionalOutlook, todaySuggestions } from './cbbi-outlook'
import type { OutlookContext } from './cbbi-outlook'

const DAY = 86_400_000

function row(index: number, price: number, confidence: number): CbbiRow {
  const metrics = {} as Record<CbbiMetricKey, number | null>
  for (const key of CBBI_METRIC_KEYS) metrics[key] = confidence
  return { t: index * DAY, day: isoDay(index * DAY), price, confidence, metrics }
}

/** A monotone 0.1%/day ramp — every forward return at horizon `h` is exactly `1.001 ** h − 1`. */
function ramp(days: number, confidence: (i: number) => number): CbbiRow[] {
  return Array.from({ length: days }, (_v, i) => row(i, 100 * 1.001 ** i, confidence(i)))
}

/**
 * Three saw-tooth cycles: 200 days up to a running all-time high, 200 days down, each cycle an
 * order of magnitude above the last — so the ATH is a real, moving fact and `daysSinceAth` has
 * something to count from. The peak is the LAST day of each up leg, index `400 * cycle + 199`.
 */
function cycles(cycleCount: number): CbbiRow[] {
  const rows: CbbiRow[] = []
  let index = 0
  for (let cycle = 0; cycle < cycleCount; cycle++) {
    const base = 100 * 10 ** cycle
    const top = base * (1 + 199 / 200)
    for (let i = 0; i < 200; i++) rows.push(row(index++, base * (1 + i / 200), i / 200))
    for (let i = 0; i < 200; i++) rows.push(row(index++, top * (1 - (i + 1) / 400), 1 - i / 200))
  }
  return rows
}

describe('conditionalOutlook — the episode gate', () => {
  it('returns null below 8 episodes, however many days qualify', () => {
    // Three long runs, ~200 qualifying days each: plenty of observations, three episodes.
    const rows = ramp(2000, (i) => (Math.floor(i / 200) % 2 === 0 && i < 1200 ? 0.2 : 0.8))
    const outlook = conditionalOutlook(rows, (r) => r.confidence <= 0.5)
    expect(outlook).toBeNull()
  })

  it('returns null below 200 forward observations, however many episodes', () => {
    // 20 episodes of 5 days each = 100 qualifying days.
    const rows = ramp(2000, (i) => (i % 100 < 5 && i < 2000 ? 0.2 : 0.8))
    const outlook = conditionalOutlook(rows, (r) => r.confidence <= 0.5)
    expect(outlook).toBeNull()
  })

  it('counts maximal runs of consecutive days as episodes once the gate passes', () => {
    const rows = ramp(4000, (i) => (i % 100 < 40 ? 0.2 : 0.8))
    const outlook = conditionalOutlook(rows, (r) => r.confidence <= 0.5)
    expect(outlook).not.toBeNull()
    expect(outlook?.episodes).toBe(40)
    expect(outlook?.days).toBe(1600)
  })
})

describe('conditionalOutlook — forward returns', () => {
  const rows = ramp(4000, (i) => (i % 100 < 40 ? 0.2 : 0.8))
  const outlook = conditionalOutlook(rows, (r) => r.confidence <= 0.5)

  it('reads price[t + h] / price[t] − 1 at each horizon', () => {
    expect(outlook?.fwd[90].median).toBeCloseTo(1.001 ** 90 - 1, 10)
    expect(outlook?.fwd[180].median).toBeCloseTo(1.001 ** 180 - 1, 10)
    expect(outlook?.fwd[365].median).toBeCloseTo(1.001 ** 365 - 1, 10)
  })

  it('is 100% positive on a monotone ramp', () => {
    expect(outlook?.fwd[365].positive).toBe(1)
  })

  it('drops the qualifying days that have no row at t + h', () => {
    // The last 365 rows can never carry a 1-year forward return.
    expect(outlook?.fwd[365].n).toBeLessThan(outlook?.fwd[90].n ?? 0)
  })
})

describe('baseRates', () => {
  it('is the same arithmetic over every day of the series', () => {
    const rows = ramp(1000, () => 0.5)
    const base = baseRates(rows)
    expect(base[90].n).toBe(910)
    expect(base[90].median).toBeCloseTo(1.001 ** 90 - 1, 10)
    expect(base[90].positive).toBe(1)
  })
})

describe('the predicate context', () => {
  const rows = cycles(3)
  const seen: OutlookContext[] = []
  conditionalOutlook(rows, (_r, ctx) => {
    seen.push(ctx)
    return false
  })

  it('is built for every row, in order', () => {
    expect(seen).toHaveLength(rows.length)
    expect(seen[0]?.index).toBe(0)
  })

  it('resets daysSinceAth to 0 on a day that sets a new high', () => {
    // Each cycle peaks on its 200th day, which is a running all-time high.
    expect(seen[199]?.daysSinceAth).toBe(0)
    expect(seen[199]?.drawdownFromAth).toBe(0)
  })

  it('counts days forward from the running high while the price is below it', () => {
    expect(seen[299]?.daysSinceAth).toBe(100)
    expect(seen[299]?.drawdownFromAth).toBeLessThan(0)
  })

  it('carries the official confidence and the series tail on every row', () => {
    expect(seen[10]?.composite).toBe(rows[10]?.confidence)
    expect(seen[10]?.latestRow).toBe(rows[rows.length - 1])
  })
})

/**
 * The gap case — the one `parseCbbi` creates and no fixture above had.
 *
 * A day whose upstream `Price` or `Confidence` is null never becomes a row, so a row INDEX is not a
 * day count. Every fixture here prices the CALENDAR day (`100 · 1.001 ** d`), which makes a
 * date-resolved horizon exact and an index-resolved one visibly wrong.
 */
describe('a series the parser has left gaps in', () => {
  /** Dense for 400 days, then every OTHER day — so `rows[i + 90]` is 180 calendar days out. */
  function sparseRamp(): CbbiRow[] {
    const out: CbbiRow[] = []
    for (let d = 0; d < 400; d++) out.push(row(d, 100 * 1.001 ** d, 0.8))
    for (let d = 400; d < 4000; d += 2) out.push(row(d, 100 * 1.001 ** d, d % 100 < 40 ? 0.2 : 0.8))
    return out
  }

  const rows = sparseRamp()
  const outlook = conditionalOutlook(rows, (r) => r.confidence <= 0.5)

  it('reads the forward return at t + h DAYS, not at row + h', () => {
    expect(outlook).not.toBeNull()
    expect(outlook?.fwd[90].median).toBeCloseTo(1.001 ** 90 - 1, 10)
    expect(outlook?.fwd[180].median).toBeCloseTo(1.001 ** 180 - 1, 10)
    // Row + 90 on the sparse half would be 180 calendar days out — a 0.10 error, not a rounding one.
    expect(outlook?.fwd[90].median).not.toBeCloseTo(1.001 ** 180 - 1, 2)
  })

  it('resolves a horizon that lands on a MISSING day to the first row after it', () => {
    // Every qualifying day is even and 365 is odd, so no row carries that exact date. The horizon
    // resolves one day late rather than being dropped — the documented `t ≥ t0 + h·day` rule.
    expect(outlook?.fwd[365].median).toBeCloseTo(1.001 ** 366 - 1, 10)
  })

  it('counts every qualifying day, gaps and all', () => {
    // 36 blocks of 20 rows each on the sparse half (`d % 100 < 40`, stepping by 2).
    expect(outlook?.episodes).toBe(36)
    expect(outlook?.days).toBe(720)
  })
})

/** The gapped fixture's confidence law — a pre-top dip at 0.10, a post-top floor at 0.41. */
function gappedConfidence(d: number): number {
  if (d <= 9) return 0.02
  if (d <= 38) return 0.5
  if (d <= 48) return 0.1
  if (d === 49) return 0.95
  return 0.9 - (d - 50) * 0.01
}

describe('the composite floor across a gap', () => {
  /**
   * 90 rows over 100 calendar days: a rising leg to an all-time high on day 49 (row 49), then a
   * falling leg with days 60–69 MISSING. Today is day 99, so `daysSinceAth` is 50 while the ATH is
   * 40 rows back — `index − daysSinceAth` would start the scan at row 39, ten rows BEFORE the top,
   * where the fixture parks a 0.10 dip that the floor must not see.
   */
  function gapped(): CbbiRow[] {
    const out: CbbiRow[] = []
    for (let d = 0; d <= 99; d++) {
      if (d >= 60 && d <= 69) continue
      const price = d <= 49 ? 100 + d : 149 - (d - 49) * 2
      out.push(row(d, price, gappedConfidence(d)))
    }
    return out
  }

  const rows = gapped()
  const floor = todaySuggestions(rows, diagnoseAll(rows)).find((s) => s.key === 'composite-floor')

  it('scans forward from the ATH ROW, never from an index the day count implied', () => {
    expect(rows).toHaveLength(90)
    expect(floor?.text).toContain('Lowest composite since the top: 0.410')
    expect(floor?.text).not.toContain('0.100')
  })

  it('still states the whole-series floor beside it', () => {
    expect(floor?.text).toContain('the lowest in the whole series is 0.020')
  })

  it('keeps daysSinceAth on the CALENDAR, not on the row count', () => {
    const seen: OutlookContext[] = []
    conditionalOutlook(rows, (_r, ctx) => {
      seen.push(ctx)
      return false
    })
    const today = seen[seen.length - 1]
    expect(today?.index).toBe(89)
    expect(today?.athIndex).toBe(49)
    expect(today?.daysSinceAth).toBe(50)
  })
})
