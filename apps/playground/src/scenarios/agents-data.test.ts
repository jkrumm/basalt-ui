/**
 * S3 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  ABANDON_HOURS,
  BUDGETS,
  DISPATCH_COMPLETE_DAYS,
  DISPATCH_DAILY,
  FAILURES_24H,
  FAILURES_BY_HOUR,
  FAILURES_WINDOW,
  FAILURE_TIMES,
  FLEET,
  FLEET_TOTAL,
  FLOW,
  ITEMS,
  NEEDS_YOU,
  NEEDS_YOU_TREND,
  OLDEST_WAIT_HOURS,
  STUCK,
  WARN_HOURS,
  fmtAge,
} from './agents-data'

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

describe('agents-data', () => {
  it('needs-you counts the items awaiting a decision, and the trend ends on it', () => {
    expect(NEEDS_YOU).toBe(ITEMS.filter((i) => i.state === 'awaiting').length)
    expect(NEEDS_YOU).toBeGreaterThan(0)
    expect(NEEDS_YOU_TREND.at(-1)).toBe(NEEDS_YOU)
  })

  it('stuck lists the awaiting and blocked items, oldest first, each blocked one with a reason', () => {
    const held = ITEMS.filter((i) => i.state === 'awaiting' || i.state === 'blocked')
    expect(STUCK).toHaveLength(held.length)
    expect(STUCK.filter((i) => i.state === 'blocked')).toHaveLength(3)
    for (const [i, item] of STUCK.entries()) {
      const prev = STUCK[i - 1]
      if (prev) expect(prev.waitHours).toBeGreaterThanOrEqual(item.waitHours)
      if (item.state === 'blocked') expect(item.reason).toBeTruthy()
    }
  })

  it('the oldest wait is the longest awaiting item, between the warn and abandon limits', () => {
    const waits = ITEMS.filter((i) => i.state === 'awaiting').map((i) => i.waitHours)
    expect(OLDEST_WAIT_HOURS).toBe(Math.max(...waits))
    expect(OLDEST_WAIT_HOURS).toBeGreaterThan(WARN_HOURS)
    expect(OLDEST_WAIT_HOURS).toBeLessThan(ABANDON_HOURS)
  })

  it('fleet segments sum to the total, which is every item', () => {
    expect(sum(FLEET.map((s) => s.count))).toBe(FLEET_TOTAL)
    expect(FLEET_TOTAL).toBe(ITEMS.length)
    expect(FLEET.every((s) => s.count > 0)).toBe(true)
  })

  it('flow covers 14 consecutive UTC days with whole counts', () => {
    expect(FLOW).toHaveLength(14)
    for (const [i, row] of FLOW.entries()) {
      expect(Number.isInteger(row.opened) && Number.isInteger(row.closed)).toBe(true)
      const prev = FLOW[i - 1]
      if (prev) expect(row.date.getTime() - prev.date.getTime()).toBe(86_400_000)
    }
  })

  it('failures are a count and the budgets stay inside their caps', () => {
    expect(Number.isInteger(FAILURES_24H.count)).toBe(true)
    expect(DISPATCH_DAILY.at(-1)).toBe(BUDGETS.day.spent)
    expect(DISPATCH_COMPLETE_DAYS).toHaveLength(DISPATCH_DAILY.length - 1)
    for (const b of [BUDGETS.day, BUDGETS.week]) {
      expect(b.spent).toBeGreaterThan(0)
      expect(b.spent).toBeLessThanOrEqual(b.cap)
    }
  })

  it('fmtAge words an age in the unit a reader decides by', () => {
    expect(fmtAge(5)).toBe('5 h')
    expect(fmtAge(26)).toBe('1 d 2 h')
    expect(fmtAge(48)).toBe('2 d')
  })

  it('failures by hour covers 24 hours and sums to the failure count', () => {
    expect(FAILURES_BY_HOUR).toHaveLength(24)
    expect(sum(FAILURES_BY_HOUR)).toBe(FAILURES_24H.count)
    expect(FAILURES_BY_HOUR.every((n) => Number.isInteger(n) && n >= 0)).toBe(true)
  })

  it('failure timestamps sit inside the stated 24 h window and fill the hourly bars', () => {
    expect(FAILURES_WINDOW.end.getTime() - FAILURES_WINDOW.start.getTime()).toBe(86_400_000)
    expect(FAILURE_TIMES).toHaveLength(FAILURES_24H.count)
    for (const t of FAILURE_TIMES) {
      expect(t.getTime()).toBeGreaterThanOrEqual(FAILURES_WINDOW.start.getTime())
      expect(t.getTime()).toBeLessThan(FAILURES_WINDOW.end.getTime())
      const hour = Math.floor((t.getTime() - FAILURES_WINDOW.start.getTime()) / 3_600_000)
      expect(FAILURES_BY_HOUR[hour]).toBeGreaterThan(0)
    }
  })
})
