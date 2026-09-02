import { describe, expect, test } from 'bun:test'
import { VX } from '../../tokens'
import { maxTextWidth } from './measure-text'
import { autoXLabelRotate, smartTicks, smartTicksEvery, xLabelPxFor } from './ticks'

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

describe('autoXLabelRotate — the phone tier’s default rotation', () => {
  test('a desktop chart never auto-rotates, however wide the labels', () => {
    expect(autoXLabelRotate({ tier: 'desktop', xMax: 60, labelPx: 90 })).toBe(0)
  })

  test('a phone chart with room for three ticks stays horizontal', () => {
    expect(autoXLabelRotate({ tier: 'phone', xMax: 300, labelPx: 60 })).toBe(0)
  })

  test('a phone chart that cannot fit three ticks rotates 45', () => {
    // 240 / 90 = 2 ticks — a labelled left edge, a labelled right edge, nothing between.
    expect(autoXLabelRotate({ tier: 'phone', xMax: 240, labelPx: 90 })).toBe(45)
  })

  test('the boundary is exactly three ticks', () => {
    expect(autoXLabelRotate({ tier: 'phone', xMax: 270, labelPx: 90 })).toBe(0)
    expect(autoXLabelRotate({ tier: 'phone', xMax: 269, labelPx: 90 })).toBe(45)
  })

  test('an unmeasured plot or a zero-width label never rotates', () => {
    expect(autoXLabelRotate({ tier: 'phone', xMax: 0, labelPx: 90 })).toBe(0)
    expect(autoXLabelRotate({ tier: 'phone', xMax: 300, labelPx: 0 })).toBe(0)
  })
})

describe('xLabelPxFor — measured at the font that will be painted', () => {
  test('a smaller tick font needs less horizontal room', () => {
    const labels = ['Mar 08 14:00', 'Mar 09 02:00']
    expect(xLabelPxFor(labels, 10)).toBeLessThan(xLabelPxFor(labels, 11))
  })

  test('omitting the font keeps VX.axisFont — nothing moves for an existing caller', () => {
    const labels = ['01.03', '02.03']
    expect(xLabelPxFor(labels)).toBe(xLabelPxFor(labels, VX.axisFont))
  })
})

describe('smartTicks — the appended final tick no longer prints on its neighbour', () => {
  // 14 daily keys, wide `Mar DD HH:MM`-style labels (~78px + gap). At 1440px the grid lands on
  // index 12 and index 13 is appended a single index later — the pair the stress page rendered
  // one on top of the other.
  const dates = Array.from({ length: 14 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`)

  test('the crowded grid tick is dropped, and the final key is still painted', () => {
    const ticks = smartTicks(dates, 1000, 86)
    expect(ticks.at(-1)).toBe(dates.at(-1))
    // index 12 sat 1/14 of 1000px = 71px from the last one — under one 86px label.
    expect(ticks).not.toContain(dates[12])
  })

  test('a comfortably-spaced final tick keeps its neighbour — nothing is dropped needlessly', () => {
    const wide = Array.from({ length: 9 }, (_, i) => `k${i}`)
    // 280px / 60px = 4 ticks over 9 keys, so the thinning branch runs: step 3 -> 0,3,6 on the
    // grid, last index 8 appended two indices (62px) later — wider than the 60px label, so k6
    // stays. Deliberately NOT a width where `dates.length <= maxTicks` returns early: at 1000px
    // this asserted nothing about the keep/drop rule at all.
    const ticks = smartTicks(wide, 280, 60)
    expect(ticks).toEqual(['k0', 'k3', 'k6', 'k8'])
  })

  test('the LEFT-edge label is never the one dropped', () => {
    // 4 keys, a 200px label at 100px: maxTicks floors to 2, step 2 -> {0, 2}, index 3 appended
    // 25px later, so the crowded grid tick (index 2) IS dropped — and index 0 survives it.
    const ticks = smartTicks(['a', 'b', 'c', 'd'], 100, 200)
    expect(ticks).toEqual(['a', 'd'])
  })

  test('index 0 survives every drop the rule can produce — the reader orients from it', () => {
    for (const count of [4, 7, 11, 14, 23]) {
      const dates = Array.from({ length: count }, (_, i) => `k${i}`)
      for (const xMax of [100, 240, 360, 700, 1440]) {
        for (const labelPx of [55, 60, 86, 120, 200]) {
          const ticks = smartTicks(dates, xMax, labelPx)
          expect(ticks[0]).toBe('k0')
          expect(ticks.at(-1)).toBe(`k${count - 1}`)
        }
      }
    }
  })

  test('a grid that already lands on the last index is untouched', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `k${i}`)
    // step 2 -> 0,2,4,6,8: the last index IS on the grid, so nothing is appended or dropped.
    expect(smartTicks(nine, 280, 55)).toEqual(['k0', 'k2', 'k4', 'k6', 'k8'])
  })
})
