/**
 * `cbbi-diagnostics.ts` on SYNTHETIC series — the real one is a network fetch and a moving target,
 * so every rule is exercised against a series built to trip exactly it.
 *
 * The construction throughout: eight "peer" metrics carry one shared value per day (so the peer
 * median IS that value, and consensus days are declared by the fixture), and the metric under test
 * carries whatever the case needs.
 */
import { describe, expect, it } from 'bun:test'
import { CBBI_METRIC_KEYS, isoDay } from './cbbi-data'
import type { CbbiMetricKey, CbbiRow } from './cbbi-data'
import {
  activePreset,
  CBBI_PRESETS,
  diagnoseAll,
  metricHealth,
  peerMedian,
} from './cbbi-diagnostics'

const SUBJECT: CbbiMetricKey = 'PiCycle'
const DAY = 86_400_000

/** One series: `peer(i)` on the other eight metrics, `subject(i)` on the one under test. */
function series(
  days: number,
  peer: (i: number) => number,
  subject: (i: number) => number | null,
): CbbiRow[] {
  const rows: CbbiRow[] = []
  for (let i = 0; i < days; i++) {
    const metrics = {} as Record<CbbiMetricKey, number | null>
    for (const key of CBBI_METRIC_KEYS) metrics[key] = key === SUBJECT ? subject(i) : peer(i)
    rows.push({ t: i * DAY, day: isoDay(i * DAY), price: 100 + i, confidence: peer(i), metrics })
  }
  return rows
}

describe('peerMedian', () => {
  it('takes the median of the OTHER eight metrics, never the subject', () => {
    const row = series(
      1,
      () => 0.9,
      () => 0.1,
    )[0]
    if (!row) throw new Error('fixture produced no row')
    expect(peerMedian(row, SUBJECT)).toBe(0.9)
    expect(peerMedian(row, 'RUPL')).toBe(0.9)
  })

  it('is null when no peer has a reading', () => {
    const metrics = {} as Record<CbbiMetricKey, number | null>
    for (const key of CBBI_METRIC_KEYS) metrics[key] = key === SUBJECT ? 0.5 : null
    expect(
      peerMedian({ t: 0, day: isoDay(0), price: 1, confidence: 0.5, metrics }, SUBJECT),
    ).toBeNull()
  })
})

describe('metricHealth', () => {
  it('scores a metric that tracks the peer consensus as ok, with a high J', () => {
    const rows = series(
      500,
      (i) => (i < 200 ? 0.9 : 0.3),
      (i) => (i < 200 ? 0.9 : 0.3),
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.consensusDays).toBe(200)
    expect(health.tpr).toBe(1)
    expect(health.fa).toBe(0)
    expect(health.j).toBe(1)
    expect(health.verdict).toBe('ok')
  })

  it('flags a metric stuck at 0.5 as broken — it never fires, so J is 0', () => {
    const rows = series(
      500,
      (i) => (i < 200 ? 0.9 : 0.3),
      () => 0.5,
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.tpr).toBe(0)
    expect(health.fa).toBe(0)
    expect(health.j).toBe(0)
    expect(health.verdict).toBe('broken')
    expect(health.reason).toContain('J 0.00')
  })

  it('flags a null tail as stale, and keeps the (best-in-class) J in the record', () => {
    const rows = series(
      500,
      (i) => (i < 200 ? 0.9 : 0.3),
      (i) => (i >= 498 ? null : i < 200 ? 0.9 : 0.3),
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.nullTail).toBe(2)
    expect(health.verdict).toBe('stale')
    expect(health.j).toBe(1)
  })

  it('flags a metric that reads hot far more this window than over its life as noisy', () => {
    // 900 days of history where the metric fires but never goes hot, then a 100-day window with 20
    // hot days — 20% of the window against 2% of the series.
    const rows = series(
      1000,
      (i) => (i < 450 || (i >= 900 && i < 980) ? 0.9 : 0.3),
      (i) => {
        if (i >= 900 && i < 920) return 0.95
        if (i < 450 || (i >= 900 && i < 980)) return 0.86
        return 0.1
      },
    )
    const health = metricHealth(rows, SUBJECT, { window: 100 })

    expect(health.consensusDays).toBe(80)
    expect(health.j).toBe(1)
    expect(health.hotShareWindow).toBeCloseTo(0.2, 5)
    expect(health.hotShareAll).toBeCloseTo(0.02, 5)
    expect(health.verdict).toBe('noisy')
  })

  it('reports insufficient below 60 consensus days rather than guessing a verdict', () => {
    const rows = series(
      100,
      () => 0.3,
      () => 0.1,
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.consensusDays).toBe(0)
    expect(health.verdict).toBe('insufficient')
    expect(health.reason).toContain('60')
  })

  it('does NOT call a one-day publication lag stale — one of ninety is under the 3% floor', () => {
    // The tail is 1 (under STALE_TAIL) and the share is 1/90 = 1.1% (under STALE_NULL_SHARE). The
    // old `> 1%` floor made this `stale` and left the two-day tail tolerance unreachable.
    const rows = series(
      500,
      (i) => (i < 200 ? 0.9 : 0.3),
      (i) => (i === 499 ? null : i < 200 ? 0.9 : 0.3),
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.nullTail).toBe(1)
    expect(health.nullShare90).toBeCloseTo(1 / 90, 6)
    expect(health.verdict).toBe('ok')
  })

  it('calls three scattered nulls in the trailing 90 days stale, with no tail at all', () => {
    const missing = new Set([460, 470, 480])
    const rows = series(
      500,
      (i) => (i < 200 ? 0.9 : 0.3),
      (i) => (missing.has(i) ? null : i < 200 ? 0.9 : 0.3),
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.nullTail).toBe(0)
    expect(health.nullShare90).toBeCloseTo(3 / 90, 6)
    expect(health.verdict).toBe('stale')
  })

  it('prefers stale over broken — a lagging metric is not a discredited one', () => {
    const rows = series(
      500,
      (i) => (i < 200 ? 0.9 : 0.3),
      (i) => (i >= 497 ? null : 0.5),
    )
    const health = metricHealth(rows, SUBJECT)

    expect(health.j).toBe(0)
    expect(health.verdict).toBe('stale')
  })
})

describe('diagnoseAll', () => {
  it('answers for every metric key', () => {
    const rows = series(
      200,
      (i) => (i < 100 ? 0.9 : 0.3),
      (i) => (i < 100 ? 0.9 : 0.3),
    )
    const all = diagnoseAll(rows)
    expect(Object.keys(all).toSorted()).toEqual(CBBI_METRIC_KEYS.toSorted())
  })
})

describe('CBBI_PRESETS / activePreset', () => {
  const allEnabled = new Set<CbbiMetricKey>(CBBI_METRIC_KEYS)

  it('declares a weight for every metric in every preset', () => {
    for (const preset of CBBI_PRESETS) {
      expect(Object.keys(preset.weights).toSorted()).toEqual(CBBI_METRIC_KEYS.toSorted())
    }
  })

  it('recognises the official composition', () => {
    const weights = Object.fromEntries(CBBI_METRIC_KEYS.map((k) => [k, 1])) as Record<
      CbbiMetricKey,
      number
    >
    expect(activePreset(weights, allEnabled)).toBe('official')
  })

  it('recognises a preset whose zero-weight metrics are simply absent from the selection', () => {
    const upstream = CBBI_PRESETS.find((p) => p.key === 'upstream')
    expect(upstream).toBeDefined()
    const enabled = new Set<CbbiMetricKey>(
      CBBI_METRIC_KEYS.filter((k) => (upstream?.weights[k] ?? 0) > 0),
    )
    // The disabled metrics keep whatever weight they had — only their absence is compared.
    const weights = Object.fromEntries(CBBI_METRIC_KEYS.map((k) => [k, 1])) as Record<
      CbbiMetricKey,
      number
    >
    weights.PiCycle = 1.75
    expect(activePreset(weights, enabled)).toBe('upstream')
  })

  it('is null once an enabled weight is off the vector', () => {
    const weights = Object.fromEntries(CBBI_METRIC_KEYS.map((k) => [k, 1])) as Record<
      CbbiMetricKey,
      number
    >
    weights.RUPL = 1.25
    expect(activePreset(weights, allEnabled)).toBeNull()
  })
})
