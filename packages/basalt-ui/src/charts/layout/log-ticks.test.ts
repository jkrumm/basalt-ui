import { describe, expect, test } from 'bun:test'
import { logTickValues, niceLogDomain } from './log-ticks'

describe('logTickValues', () => {
  test('every value is positive with a mantissa in {1, 2, 5}, thinned to the tick budget', () => {
    const values = logTickValues([16, 80000], 5)
    expect(values.length).toBeGreaterThan(0)
    expect(values.length).toBeLessThanOrEqual(5)
    for (const v of values) {
      expect(v).toBeGreaterThan(0)
      const mantissa = v / 10 ** Math.floor(Math.log10(v))
      const rounded = Math.round(mantissa * 100) / 100
      expect([1, 2, 5]).toContain(rounded)
    }
  })

  test('a small domain within one decade keeps every 1-2-5 candidate untouched', () => {
    expect(logTickValues([0.5, 5], 5)).toEqual([0.5, 1, 2, 5])
  })

  test('a non-positive domain returns no ticks', () => {
    expect(logTickValues([0, 100], 5)).toEqual([])
    expect(logTickValues([-10, 100], 5)).toEqual([])
  })

  test('an inverted domain returns no ticks', () => {
    expect(logTickValues([100, 10], 5)).toEqual([])
  })

  test('a flat domain returns no ticks', () => {
    expect(logTickValues([10, 10], 5)).toEqual([])
  })

  test('a wide multi-decade span thins to whole decades, keeping the extremes', () => {
    const values = logTickValues([1, 100000000], 5)
    expect(values.length).toBeLessThanOrEqual(5)
    expect(values[0]).toBe(1)
    expect(values[values.length - 1]).toBe(100000000)
  })
})

describe('logTickValues — densifying a short (sub-4-tick) span', () => {
  // The exact shape of the bug: a 1-year BTC price window ($58k-$139k) spans under half a decade,
  // so the strict {1, 2, 5} law leaves only $100,000 in domain — a single, unreadable tick.
  test('a one-year-shaped price domain no longer collapses to a single tick', () => {
    const values = logTickValues([58000, 139000], 5)
    expect(values.length).toBeGreaterThanOrEqual(4)
    expect(values).toEqual([60000, 70000, 80000, 90000, 100000])
  })

  // The 4-year window holds ONE whole decade ($100k), so the old unconditional decade collapse
  // returned a single tick even after densifying — the decades branch must stay readable-only.
  test('a four-year-shaped price domain never falls back to its single whole decade', () => {
    expect(logTickValues([15500, 139000], 5)).toEqual([20000, 40000, 70000, 100000])
  })

  test('the densified values need not have a mantissa in {1, 2, 5}', () => {
    const values = logTickValues([58000, 139000], 5)
    // 90,000 has mantissa 9 — outside the strict law, proof the densest set actually engaged.
    expect(values).toContain(90000)
  })

  test('no domain spanning at least 0.3 decades degenerates to fewer than 2 ticks', () => {
    const ratio = 10 ** 0.3 // ~1.995 — comfortably below a full decade
    const offsets = [1.2, 2.3, 3.7, 5.8, 8.1]
    for (let exp = -3; exp <= 6; exp++) {
      for (const offset of offsets) {
        const min = offset * 10 ** exp
        const max = min * ratio
        expect(logTickValues([min, max], 5).length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  test('a span already at or above the densify floor is left at the strict {1, 2, 5} law', () => {
    // [16, 80000] already yields 11 strict candidates (>= DENSIFY_BELOW) — no widening needed.
    const values = logTickValues([16, 80000], 5)
    for (const v of values) {
      const mantissa = v / 10 ** Math.floor(Math.log10(v))
      expect([1, 2, 5]).toContain(Math.round(mantissa * 100) / 100)
    }
  })
})

describe('logTickValues — stays within budget across a sweep of spans and tick counts', () => {
  test('length never exceeds the tick budget by more than one', () => {
    for (let decades = 2; decades <= 14; decades++) {
      for (let ticks = 2; ticks <= 8; ticks++) {
        const domain: [number, number] = [1, 10 ** decades]
        const values = logTickValues(domain, ticks)
        expect(values.length).toBeLessThanOrEqual(ticks + 1)
      }
    }
  })
})

describe('niceLogDomain', () => {
  test('rounds outward to the enclosing decade bounds', () => {
    expect(niceLogDomain([16, 80000])).toEqual([10, 100000])
  })

  test('a domain already on decade bounds is unchanged', () => {
    expect(niceLogDomain([100, 10000])).toEqual([100, 10000])
  })
})
