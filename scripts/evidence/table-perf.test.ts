import { describe, expect, test } from 'bun:test'
import { keystrokeValues, overControl, scrollOffsets } from './table-perf'

describe('table-perf helpers', () => {
  test('keystrokeValues grows the term one character at a time after the prefix', () => {
    expect(keystrokeValues('acct-042', 'acct-')).toEqual(['acct-0', 'acct-04', 'acct-042'])
  })

  test('keystrokeValues rejects a term that does not extend the prefix', () => {
    expect(() => keystrokeValues('acct-', 'acct-')).toThrow()
    expect(() => keystrokeValues('zzz', 'acct-')).toThrow()
  })

  test('scrollOffsets is monotonic, evenly spaced and ends exactly at the bottom', () => {
    const offsets = scrollOffsets(1000, 4)
    expect(offsets).toEqual([250, 500, 750, 1000])
    expect(scrollOffsets(7, 3).at(-1)).toBe(7)
  })

  test('scrollOffsets is empty when there is nothing to scroll', () => {
    expect(scrollOffsets(0, 10)).toEqual([])
    expect(scrollOffsets(100, 0)).toEqual([])
  })

  test('overControl subtracts the same-run control', () => {
    expect(overControl(150.4, 66.6)).toBe(83.8)
    expect(overControl(60, 66.6)).toBe(-6.6)
  })
})
