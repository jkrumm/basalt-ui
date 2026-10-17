/**
 * S2 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  CONTRIBUTORS,
  DAYS_ELAPSED,
  DISTANCE_7D_TREND,
  GOAL_SESSIONS,
  HIT_MONTHS,
  HIT_RATE_PCT,
  HIT_RANGE_LABEL,
  LOAD_RATIO,
  MONTHLY_SESSIONS,
  MONTHS_HIT,
  MONTH_DAYS,
  PACE_GAP,
  PACE_SESSIONS,
  PRIOR_WINDOW_LABEL,
  READINESS_SCORE,
  SESSIONS_7D_TREND,
  SESSIONS_CHANGE_PCT,
  SESSIONS_MTD,
  SESSIONS_PRIOR,
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

  it('the trends cover 30 days and end on a window that is non-negative', () => {
    for (const trend of [SESSIONS_7D_TREND, DISTANCE_7D_TREND]) {
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
})
