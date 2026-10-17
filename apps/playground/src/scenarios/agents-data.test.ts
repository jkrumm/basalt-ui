/**
 * S3 fixture invariants: the figures the page states must agree with each other.
 */
import { describe, expect, it } from 'bun:test'
import {
  ABANDON_HOURS,
  BUDGETS,
  DISPATCH_DAILY,
  FAILURES_24H,
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

  it('stuck lists exactly the awaiting items, oldest first', () => {
    expect(STUCK).toHaveLength(NEEDS_YOU)
    for (const [i, item] of STUCK.entries()) {
      expect(item.state).toBe('awaiting')
      const prev = STUCK[i - 1]
      if (prev) expect(prev.waitHours).toBeGreaterThanOrEqual(item.waitHours)
    }
  })

  it('the oldest wait is the first stuck item and sits between the warn and abandon limits', () => {
    expect(STUCK[0]?.waitHours).toBe(OLDEST_WAIT_HOURS)
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
})
