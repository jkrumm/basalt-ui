/**
 * S2 came back HAND-SVG (`docs/v3/spikes/charts-s2.md`): Sparkline and MiniBars draw from this
 * engine-free geometry. Pure functions, no DOM.
 */
import { describe, expect, test } from 'bun:test'
import { barGeometry, sparkGeometry } from './compile-spark'

const segments = (d: string): number => d.split('M').length - 1

describe('sparkGeometry', () => {
  test('a line spans the box, first point on the left edge, last on the right', () => {
    const g = sparkGeometry({ values: [1, 3, 2], width: 100, height: 20 })
    expect(g.x(0)).toBe(0)
    expect(g.x(2)).toBe(100)
    expect(g.last).toEqual({ x: 100, y: g.y(2) })
    expect(segments(g.line)).toBe(1)
  })

  test('the y scale puts the max at the top and the min at the bottom, inside the pad', () => {
    const g = sparkGeometry({ values: [0, 10], width: 100, height: 20, padY: 2 })
    expect(g.y(10)).toBe(2)
    expect(g.y(0)).toBe(18)
  })

  test('a null is a gap, never a zero: the line breaks into two segments', () => {
    const g = sparkGeometry({ values: [1, 2, null, 4, 5], width: 100, height: 20 })
    expect(segments(g.line)).toBe(2)
    expect(g.line).not.toContain('NaN')
  })

  test('a lone point between gaps is still drawn as a point segment', () => {
    const g = sparkGeometry({ values: [1, null, 3, null, 5], width: 100, height: 20 })
    expect(segments(g.line)).toBe(3)
  })

  test('the area closes to the baseline (the bottom of the box) per segment', () => {
    const g = sparkGeometry({ values: [1, 2, 3], width: 90, height: 20 })
    expect(g.area.endsWith('Z')).toBe(true)
    expect(g.area).toContain(`L90,20`)
    expect(g.area).toContain(`L0,20`)
  })

  test('a flat series has extent and sits mid-box', () => {
    const g = sparkGeometry({ values: [5, 5, 5], width: 100, height: 20 })
    expect(g.y(5)).toBe(10)
  })

  test('all null draws nothing and has no last point', () => {
    const g = sparkGeometry({ values: [null, null], width: 100, height: 20 })
    expect(g.line).toBe('')
    expect(g.area).toBe('')
    expect(g.last).toBeNull()
  })

  test('the last point is the last finite value, not a trailing gap', () => {
    const g = sparkGeometry({ values: [1, 2, null], width: 100, height: 20 })
    expect(g.last?.x).toBe(50)
  })

  test('a reference value maps through the same y scale and widens the domain', () => {
    const g = sparkGeometry({ values: [2, 4], width: 100, height: 20, reference: 10 })
    expect(g.domain[1]).toBe(10)
    expect(g.y(10)).toBe(0)
  })

  test('one value draws one point in the middle', () => {
    const g = sparkGeometry({ values: [3], width: 100, height: 20 })
    expect(g.x(0)).toBe(50)
    expect(g.last).toEqual({ x: 50, y: 10 })
  })
})

describe('barGeometry', () => {
  test('one bar per value, the gap between them, the box filled edge to edge', () => {
    const bars = barGeometry({ values: [1, 2, 4], width: 100, height: 40, gap: 2 })
    expect(bars).toHaveLength(3)
    const [a, , c] = bars
    expect(a?.x).toBe(0)
    expect((c?.x ?? 0) + (c?.width ?? 0)).toBeCloseTo(100)
    expect(bars[1]!.x - (a!.x + a!.width)).toBeCloseTo(2)
  })

  test('bars grow up from the baseline; the max reaches the top', () => {
    const [low, high] = barGeometry({ values: [1, 4], width: 100, height: 40, gap: 2 })
    expect(high?.y).toBe(0)
    expect(high?.height).toBe(40)
    expect((low?.y ?? 0) + (low?.height ?? 0)).toBe(40)
  })

  test('a bar is at most maxWidth wide and the set is centred', () => {
    const bars = barGeometry({ values: [1, 2], width: 200, height: 40, gap: 2, maxWidth: 24 })
    expect(bars[0]?.width).toBe(24)
    const span = bars[1]!.x + 24 - bars[0]!.x
    expect(bars[0]!.x).toBeCloseTo((200 - span) / 2)
  })

  test('a null is an absent bar, not a zero-height one', () => {
    const bars = barGeometry({ values: [1, null, 3], width: 90, height: 40, gap: 0 })
    expect(bars[1]).toBeNull()
  })
})
