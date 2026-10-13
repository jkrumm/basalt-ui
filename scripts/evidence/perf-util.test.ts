import { describe, expect, test } from 'bun:test'
import { median, percentile, round, sortKeys, summarizeWindow } from './perf-util'

describe('perf-util', () => {
  test('percentile interpolates and is order-independent', () => {
    expect(percentile([4, 1, 3, 2], 50)).toBe(2.5)
    expect(percentile([1, 2, 3, 4, 5], 95)).toBeCloseTo(4.8)
    expect(percentile([7], 95)).toBe(7)
    expect(percentile([], 50)).toBeNaN()
  })

  test('median of an odd set is the middle element', () => {
    expect(median([9, 1, 5])).toBe(5)
  })

  test('round fixes the decimals', () => {
    expect(round(1.2349, 2)).toBe(1.23)
    expect(round(16.66)).toBe(16.7)
  })

  test('sortKeys orders nested keys and leaves arrays in order', () => {
    expect(JSON.stringify(sortKeys({ b: 1, a: { d: [3, 1], c: 2 } }))).toBe(
      '{"a":{"c":2,"d":[3,1]},"b":1}',
    )
  })

  test('summarizeWindow counts long tasks and rounds frame stats', () => {
    const s = summarizeWindow([16, 17, 50], [60, 70])
    expect(s).toEqual({
      frames: 3,
      frameP50: 17,
      frameP95: 46.7,
      frameMax: 50,
      longTasks: 2,
      longTaskMs: 130,
    })
  })
})
