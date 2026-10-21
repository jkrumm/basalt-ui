/**
 * S2 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  CONTRIBUTORS,
  DAYS_ELAPSED,
  DISTANCE_7D_TREND,
  DISTANCE_CHANGE_PCT,
  GOAL_SESSIONS,
  HIT_HISTORY,
  HIT_MONTHS,
  HIT_RATE_PCT,
  HIT_RANGE_LABEL,
  LOAD_MAX,
  LOAD_RATIO,
  MONTHLY_SESSIONS,
  MONTHS_HIT,
  MONTH_DAYS,
  PACE_GAP,
  PACE_SESSIONS,
  PRIOR_WINDOW_LABEL,
  READINESS_SCORE,
  READING_DATE,
  SESSION_LOG,
  SESSIONS_7D_TREND,
  SESSIONS_CHANGE_PCT,
  SESSIONS_MTD,
  SESSIONS_PRIOR,
  VOLUME_7D_TREND,
  VOLUME_CHANGE_PCT,
  TOP_LIFTS,
  TYPE_MIX,
  VOLUME_MTD_KG,
  WINDOW_LABEL,
  loadZoneName,
  readinessLevel,
} from './training-data'

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

describe('training-data', () => {
  it('derives its period labels from the reading date', () => {
    expect(WINDOW_LABEL).toBe('1–16 Oct')
    expect(PRIOR_WINDOW_LABEL).toBe('1–16 Sep')
    expect(HIT_RANGE_LABEL).toBe('Apr–Sep')
    expect(DAYS_ELAPSED).toBe(16)
    expect(MONTH_DAYS).toBe(31)
  })

  it('the session types sum to the month-to-date sessions', () => {
    expect(sum(TYPE_MIX.map((t) => t.count))).toBe(SESSIONS_MTD)
  })

  it('the pace gap is the whole sessions ahead of an even spread over the month', () => {
    expect(PACE_SESSIONS).toBeCloseTo((GOAL_SESSIONS * DAYS_ELAPSED) / MONTH_DAYS, 9)
    expect(PACE_GAP).toBe(Math.round(SESSIONS_MTD - PACE_SESSIONS))
  })

  it('the stated change is the ratio of the two windows, in percent', () => {
    expect(SESSIONS_PRIOR).toBeGreaterThan(0)
    expect(SESSIONS_CHANGE_PCT).toBeCloseTo((SESSIONS_MTD / SESSIONS_PRIOR - 1) * 100, 9)
  })

  it('the trends cover 30 days and are non-negative', () => {
    for (const trend of [SESSIONS_7D_TREND, VOLUME_7D_TREND, DISTANCE_7D_TREND]) {
      expect(trend).toHaveLength(30)
      expect(trend.every((v) => v >= 0)).toBe(true)
    }
  })

  it('the lifts are ranked, and their volume sums to the month-to-date volume', () => {
    const volumes = TOP_LIFTS.map((l) => l.volumeKg)
    expect(volumes).toEqual(volumes.toSorted((a, b) => b - a))
    expect(sum(volumes)).toBeCloseTo(VOLUME_MTD_KG, 6)
    expect(sum(TOP_LIFTS.map((l) => l.share))).toBeCloseTo(1, 9)
    expect(TOP_LIFTS.length).toBeGreaterThanOrEqual(5)
  })

  it('the load ratio sits in a named zone and the readiness is the mean of its contributors', () => {
    expect(loadZoneName(LOAD_RATIO)).toBe('Optimal')
    expect(READINESS_SCORE).toBe(Math.round(sum(CONTRIBUTORS.map((c) => c.value)) / 4))
    expect(readinessLevel(READINESS_SCORE)).toBe('Fair')
    expect(CONTRIBUTORS.every((c) => c.value >= 0 && c.value <= 100)).toBe(true)
  })

  it('zone boundaries belong to the upper band', () => {
    expect(loadZoneName(0.8)).toBe('Optimal')
    expect(loadZoneName(1.5)).toBe('Overreaching')
    expect(readinessLevel(80)).toBe('Good')
    expect(readinessLevel(59)).toBe('Low')
  })

  it('the hit rate is the share of complete months that reached the goal', () => {
    expect(MONTHLY_SESSIONS).toHaveLength(HIT_MONTHS)
    expect(MONTHS_HIT).toBe(MONTHLY_SESSIONS.filter((n) => n >= GOAL_SESSIONS).length)
    expect(HIT_RATE_PCT).toBe(Math.round((MONTHS_HIT / HIT_MONTHS) * 100))
  })

  it('pins the figures the copy states', () => {
    expect(SESSIONS_MTD).toBe(17)
    expect(PACE_GAP).toBe(3)
    expect(MONTHS_HIT).toBe(4)
    expect(HIT_RATE_PCT).toBe(67)
    expect(READINESS_SCORE).toBe(76)
  })

  it('pins the change percentages and the last trend points', () => {
    expect(SESSIONS_CHANGE_PCT).toBeCloseTo(13.33, 2)
    expect(VOLUME_CHANGE_PCT).toBeCloseTo(33.02, 2)
    expect(DISTANCE_CHANGE_PCT).toBeCloseTo(5.62, 2)
    expect(SESSIONS_7D_TREND.at(-1)).toBe(8)
    expect(VOLUME_7D_TREND.at(-1)).toBe(31_345)
    expect(DISTANCE_7D_TREND.at(-1)).toBeCloseTo(7.29, 2)
  })

  it('the load ratio is a finite reading inside the scale', () => {
    expect(Number.isFinite(LOAD_RATIO)).toBe(true)
    expect(LOAD_RATIO).toBeGreaterThan(0)
    expect(LOAD_RATIO).toBeLessThan(LOAD_MAX)
  })

  it('the hit-rate history labels every complete month and agrees with the rate', () => {
    expect(HIT_HISTORY.length).toBeGreaterThanOrEqual(6)
    expect(HIT_HISTORY.map((m) => m.label)).toEqual(['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'])
    expect(HIT_HISTORY.map((m) => m.sessions)).toEqual([...MONTHLY_SESSIONS])
    expect(HIT_HISTORY.filter((m) => m.sessions >= GOAL_SESSIONS)).toHaveLength(MONTHS_HIT)
  })
})

describe('session log', () => {
  it('is eight rows, newest first, covering four exercises and all three results', () => {
    expect(SESSION_LOG).toHaveLength(8)
    const times = SESSION_LOG.map((r) => r.date.getTime())
    expect(times).toEqual(times.toSorted((a, b) => b - a))
    expect(new Set(SESSION_LOG.map((r) => r.exercise)).size).toBe(4)
    expect(new Set(SESSION_LOG.map((r) => r.result))).toEqual(new Set(['PR', 'Held', 'Dropped']))
  })

  it('the top-lifts card sums the log rows of each logged lift', () => {
    for (const exercise of new Set(SESSION_LOG.map((r) => r.exercise))) {
      const rows = SESSION_LOG.filter((r) => r.exercise === exercise)
      const top = TOP_LIFTS.find((l) => l.name === exercise)
      expect(top).toBeDefined()
      expect(sum(rows.map((r) => r.volumeKg))).toBe(top?.volumeKg ?? Number.NaN)
    }
  })

  it('every row falls inside the month-to-date window', () => {
    const start = Date.UTC(2026, 9, 1)
    for (const r of SESSION_LOG) {
      expect(r.date.getTime()).toBeGreaterThanOrEqual(start)
      expect(r.date.getTime()).toBeLessThanOrEqual(READING_DATE.getTime())
    }
  })

  it('every row has a positive volume and a positive estimated 1RM', () => {
    for (const r of SESSION_LOG) {
      expect(r.volumeKg).toBeGreaterThan(0)
      expect(r.e1rmKg).toBeGreaterThan(0)
    }
  })
})
