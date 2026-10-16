/**
 * S1 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  DOWNTIME_MINUTES,
  HOURLY,
  LAST_OUTAGE,
  LATENCY_DISTRIBUTION,
  LOSS_24H_PCT,
  MINUTE_LATENCY,
  NOW_DATE,
  OUTAGES,
  TRANSITIONS,
  UPTIME_PCT,
  WINDOW_HOURS,
  lineState,
} from './ops-data'

const HOUR_MS = 3_600_000

describe('ops-data', () => {
  it('covers 168 consecutive hourly buckets ending at the reading time', () => {
    expect(HOURLY).toHaveLength(WINDOW_HOURS)
    for (const [i, row] of HOURLY.entries()) {
      const prev = HOURLY[i - 1]
      if (prev) expect(row.start.getTime() - prev.start.getTime()).toBe(HOUR_MS)
    }
    const last = HOURLY[HOURLY.length - 1]
    expect(last && last.start.getTime() + HOUR_MS).toBe(NOW_DATE.getTime())
  })

  it('outages are newest first, non-overlapping and end where their duration says', () => {
    for (const [i, o] of OUTAGES.entries()) {
      expect(o.end.getTime() - o.start.getTime()).toBe(o.minutes * 60_000)
      const older = OUTAGES[i + 1]
      if (older) expect(older.end.getTime()).toBeLessThanOrEqual(o.start.getTime())
    }
    expect(OUTAGES.indexOf(LAST_OUTAGE)).toBe(0)
  })

  it('hourly down-minutes add up to the outage total, and uptime follows from it', () => {
    const total = HOURLY.reduce((acc, h) => acc + h.downMinutes, 0)
    expect(total).toBeCloseTo(DOWNTIME_MINUTES, 9)
    expect(UPTIME_PCT).toBeCloseTo((1 - DOWNTIME_MINUTES / (WINDOW_HOURS * 60)) * 100, 9)
  })

  it('every outage hour is down and every other hour is up or degraded', () => {
    for (const row of HOURLY) {
      expect(lineState(row) === 'down').toBe(row.downMinutes > 0)
    }
  })

  it('transitions pair every outage, newest first, alternating up then down', () => {
    expect(TRANSITIONS).toHaveLength(OUTAGES.length * 2)
    for (const [i, t] of TRANSITIONS.entries()) expect(t.to).toBe(i % 2 === 0 ? 'up' : 'down')
    const times = TRANSITIONS.map((t) => t.at.getTime())
    expect(times).toEqual(times.toSorted((a, b) => b - a))
  })

  it('an unmeasured hour has no throughput and no latency', () => {
    for (const row of HOURLY) {
      if (row.latencyMs !== null) continue
      expect(row.downMbit).toBeNull()
      expect(row.upMbit).toBeNull()
    }
  })

  it('the distribution counts every measured hour exactly once', () => {
    const measured = HOURLY.filter((h) => h.latencyMs !== null).length
    expect(LATENCY_DISTRIBUTION.reduce((acc, b) => acc + b.hours, 0)).toBe(measured)
  })

  it('has 60 minute readings and a positive 24 h loss', () => {
    expect(MINUTE_LATENCY).toHaveLength(60)
    expect(LOSS_24H_PCT).toBeGreaterThan(0)
  })
})
