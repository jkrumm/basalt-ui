/**
 * S1 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  DEGRADED_LOSS_PCT,
  DOWN_24H_MBIT,
  DOWN_24H_SERIES,
  DOWN_PEAK_MBIT,
  DOWNTIME_MINUTES,
  HOURLY,
  LAST_OUTAGE,
  LATENCY_DISTRIBUTION,
  LATENCY_MEDIAN_7D_MS,
  MEASURED_HOURS,
  LOSS_24H_PCT,
  LOSS_24H_SERIES,
  LOSS_7D_PCT,
  MINUTE_LATENCY,
  NOW_DATE,
  OUTAGES,
  TRANSITIONS,
  UPTIME_PCT,
  WINDOW_HOURS,
  lineState,
} from './ops-data'

const HOUR_MS = 3_600_000

const mean = (rows: readonly { lossPct: number }[]): number =>
  rows.reduce((acc, h) => acc + h.lossPct, 0) / rows.length

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

  it('an hour is down with any downtime, else degraded at the loss threshold, else up', () => {
    for (const row of HOURLY) {
      if (row.downMinutes > 0) expect(lineState(row)).toBe('down')
      else if (row.lossPct >= DEGRADED_LOSS_PCT) expect(lineState(row)).toBe('degraded')
      else expect(lineState(row)).toBe('up')
    }
    const states = new Set(HOURLY.map(lineState))
    expect(states).toEqual(new Set(['up', 'degraded', 'down']))
  })

  it('outages lie inside the window', () => {
    const start = NOW_DATE.getTime() - WINDOW_HOURS * HOUR_MS
    for (const o of OUTAGES) {
      expect(o.start.getTime()).toBeGreaterThanOrEqual(start)
      expect(o.end.getTime()).toBeLessThanOrEqual(NOW_DATE.getTime())
    }
  })

  it('transitions pair every outage, newest first, alternating up then down', () => {
    expect(TRANSITIONS).toHaveLength(OUTAGES.length * 2)
    for (const [i, t] of TRANSITIONS.entries()) expect(t.to).toBe(i % 2 === 0 ? 'up' : 'down')
    const times = TRANSITIONS.map((t) => t.at.getTime())
    expect(times).toEqual(times.toSorted((a, b) => b - a))
  })

  it('readings are null for exactly the down hours', () => {
    for (const row of HOURLY) {
      const unmeasured = [row.latencyMs, row.downMbit, row.upMbit].map((v) => v === null)
      expect(unmeasured).toEqual(Array(3).fill(row.downMinutes > 0))
    }
  })

  it('the distribution counts every measured hour exactly once', () => {
    expect(LATENCY_DISTRIBUTION.reduce((acc, b) => acc + b.hours, 0)).toBe(MEASURED_HOURS)
    expect(MEASURED_HOURS).toBeLessThan(HOURLY.length)
  })

  it('the headline aggregates are finite numbers', () => {
    for (const v of [DOWN_24H_MBIT, LATENCY_MEDIAN_7D_MS, DOWN_PEAK_MBIT]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('has 60 minute readings', () => {
    expect(MINUTE_LATENCY).toHaveLength(60)
  })

  it('loss figures are the mean of their hourly buckets', () => {
    expect(LOSS_24H_PCT).toBeCloseTo(mean(HOURLY.slice(-24)), 9)
    expect(LOSS_7D_PCT).toBeCloseTo(mean(HOURLY), 9)
    expect(LOSS_24H_PCT).toBeGreaterThan(0)
  })
})

describe('the metric-card sparklines state the same numbers as their figures', () => {
  it('has one point per hour, a missing reading kept as a gap (NaN)', () => {
    expect(LOSS_24H_SERIES).toHaveLength(24)
    expect(DOWN_24H_SERIES).toHaveLength(24)
    expect(DOWN_24H_SERIES.filter(Number.isNaN).length).toBe(
      HOURLY.slice(-24).filter((h) => h.downMbit === null).length,
    )
  })

  it('packet loss: the series mean is the figure', () => {
    const mean24 = LOSS_24H_SERIES.reduce((a, v) => a + v, 0) / LOSS_24H_SERIES.length
    expect(mean24).toBeCloseTo(LOSS_24H_PCT, 10)
  })

  it('download: the mean of the measured hours is the figure', () => {
    const measured = DOWN_24H_SERIES.filter((v) => !Number.isNaN(v))
    expect(measured.reduce((a, v) => a + v, 0) / measured.length).toBeCloseTo(DOWN_24H_MBIT, 10)
  })
})
