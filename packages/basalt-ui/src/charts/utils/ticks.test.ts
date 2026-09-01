import { describe, expect, test } from 'bun:test'
import { VX } from '../../tokens'
import { maxTextWidth } from './measure-text'
import { smartTicks, smartTicksEvery, xLabelPxFor } from './ticks'

const keys = (n: number): string[] => Array.from({ length: n }, (_, i) => `k${i}`)

describe('smartTicks', () => {
  test('thins to what the width holds at the default spacing', () => {
    // 250px / 55px = 4 ticks, so 7 keys thin by a step of 2.
    expect(smartTicks(keys(7), 250)).toEqual(['k0', 'k2', 'k4', 'k6'])
  })

  test('a wide measured label overrides the constant — 80px labels at 250px allow 3 ticks', () => {
    expect(smartTicks(keys(7), 250, 80)).toEqual(['k0', 'k3', 'k6'])
  })

  test('a label narrower than the floor changes nothing', () => {
    expect(smartTicks(keys(7), 250, 20)).toEqual(smartTicks(keys(7), 250))
    expect(VX.minPxPerTick).toBeGreaterThan(20)
  })

  test('the last key is still appended unconditionally, even when the step misses it', () => {
    const ticks = smartTicks(keys(8), 250, 80)
    expect(ticks[ticks.length - 1]).toBe('k7')
  })

  test('never thins below two ticks, however wide the label', () => {
    expect(smartTicks(keys(9), 100, 500).length).toBeGreaterThanOrEqual(2)
  })

  test('an empty domain stays empty', () => {
    expect(smartTicks([], 250, 80)).toEqual([])
  })
})

describe('smartTicksEvery', () => {
  test('targets an exact count and still appends the last key', () => {
    expect(smartTicksEvery(keys(8), 3)).toEqual(['k0', 'k3', 'k6', 'k7'])
  })
})

describe('xLabelPxFor', () => {
  test('is the widest measured label plus an 8px neighbour gap', () => {
    const labels = ['k0', 'a much wider label', 'k2']
    expect(xLabelPxFor(labels)).toBe(maxTextWidth(labels, VX.axisFont) + 8)
  })

  test('an empty label set measures to just the gap', () => {
    expect(xLabelPxFor([])).toBe(maxTextWidth([], VX.axisFont) + 8)
  })

  test('feeds smartTicks the same way a manually-computed labelPx would', () => {
    const wide = keys(7).map((k) => `${k} 14:00 CEST`)
    expect(smartTicks(keys(7), 250, xLabelPxFor(wide))).toEqual(
      smartTicks(keys(7), 250, maxTextWidth(wide, VX.axisFont) + 8),
    )
  })
})
