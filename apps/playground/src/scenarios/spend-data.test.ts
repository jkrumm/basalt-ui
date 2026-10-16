/**
 * S4 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  DAILY,
  DAYS_ELAPSED,
  DISTRIBUTION,
  FORECAST_EUR,
  MODELS_MTD,
  MONTH_DAYS,
  MTD_DAYS,
  MTD_EUR,
  PRIOR_MTD_EUR,
  PROJECTS_MTD,
} from './spend-data'
import { seeded } from './fixture-utils'

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

describe('spend-data', () => {
  it('covers 90 consecutive UTC days', () => {
    expect(DAILY).toHaveLength(90)
    for (const [i, row] of DAILY.entries()) {
      const prev = DAILY[i - 1]
      if (prev) expect(row.date.getTime() - prev.date.getTime()).toBe(86_400_000)
    }
  })

  it('a day total is the sum of its models', () => {
    for (const row of DAILY) expect(row.total).toBeCloseTo(row.large + row.mid + row.small, 9)
  })

  it('projects and models each sum to the month-to-date total', () => {
    expect(sum(PROJECTS_MTD.map((p) => p.spend))).toBeCloseTo(MTD_EUR, 6)
    expect(sum(MODELS_MTD.map((m) => m.spend))).toBeCloseTo(MTD_EUR, 6)
    expect(sum(MTD_DAYS.map((d) => d.total))).toBeCloseTo(MTD_EUR, 6)
  })

  it('shares sum to 1 and rows are ranked by spend', () => {
    expect(sum(PROJECTS_MTD.map((p) => p.share))).toBeCloseTo(1, 9)
    expect(sum(MODELS_MTD.map((m) => m.share))).toBeCloseTo(1, 9)
    const spends = PROJECTS_MTD.map((p) => p.spend)
    expect(spends).toEqual(spends.toSorted((a, b) => b - a))
  })

  it('the month-to-date window is the elapsed days and the forecast is the naive extrapolation', () => {
    expect(MTD_DAYS).toHaveLength(DAYS_ELAPSED)
    expect(FORECAST_EUR).toBeCloseTo((MTD_EUR / DAYS_ELAPSED) * MONTH_DAYS, 6)
    expect(PRIOR_MTD_EUR).toBeGreaterThan(0)
  })

  it('the distribution counts every day of the window exactly once', () => {
    expect(sum(DISTRIBUTION.map((b) => b.days))).toBe(DAILY.length)
  })

  it('is deterministic: a seed reproduces its sequence', () => {
    const a = seeded(7)
    const b = seeded(7)
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b))
    expect(seeded(8)()).not.toBe(seeded(7)())
  })
})
