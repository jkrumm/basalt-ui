/**
 * `chartCurve` — the in-house port of d3's linear / step / monotoneX curves (no `d3-shape` peer).
 */
import { describe, expect, test } from 'bun:test'
import { chartCurve } from './curves'
import type { CurveName } from './curves'

type Pt = readonly [number, number]
const pts = (...p: Pt[]): readonly Pt[] => p

/** Every `x,y` pair a path visits, in order (control points included). */
const pairs = (d: string): Pt[] =>
  [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)

describe('chartCurve', () => {
  test('linear draws straight segments through every point', () => {
    expect(chartCurve('linear').line(pts([0, 0], [10, 5], [20, 0]))).toBe('M0,0L10,5L20,0')
  })

  test('step changes at the midpoint, stepAfter at the next x, stepBefore at its own', () => {
    const two = pts([0, 0], [10, 5])
    expect(chartCurve('step').line(two)).toBe('M0,0L5,0L5,5L10,5')
    expect(chartCurve('stepAfter').line(two)).toBe('M0,0L10,0L10,5')
    expect(chartCurve('stepBefore').line(two)).toBe('M0,0L0,0L0,5L10,5')
  })

  test('one and two points fall back to a move / a straight segment', () => {
    for (const name of ['linear', 'monotone', 'step', 'stepAfter', 'stepBefore'] as CurveName[]) {
      expect(chartCurve(name).line(pts([3, 4]))).toBe('M3,4')
      expect(chartCurve(name).line([])).toBe('')
    }
    expect(chartCurve('monotone').line(pts([0, 0], [10, 5]))).toBe('M0,0L10,5')
  })

  test('monotone never overshoots: a flat run stays flat, a rise never dips or peaks past its ends', () => {
    const flat = pairs(chartCurve('monotone').line(pts([0, 10], [10, 10], [20, 10])))
    expect(flat.every(([, y]) => y === 10)).toBe(true)
    const rise = pairs(chartCurve('monotone').line(pts([0, 0], [10, 1], [20, 9], [30, 10])))
    expect(rise.every(([, y]) => y >= 0 && y <= 10)).toBe(true)
  })

  test('the area composer walks the top forward and the baseline back, then closes', () => {
    const d = chartCurve('linear').area(pts([0, 1], [10, 2]), pts([0, 0], [10, 0]))
    expect(d).toBe('M0,1L10,2L10,0L0,0Z')
    expect(chartCurve('linear').area([], [])).toBe('')
  })

  test("a reversed stepAfter baseline holds like stepBefore (d3's flip)", () => {
    const d = chartCurve('stepAfter').area(pts([0, 1], [10, 2]), pts([0, 0], [10, 5]))
    // Top forward (after), then the baseline right-to-left with t flipped: the jump sits at x=10.
    expect(d).toBe('M0,1L10,1L10,2L10,5L10,5L10,0L0,0Z')
  })

  test('an unknown name from a JS caller draws straight segments, never the name', () => {
    const d = chartCurve('bogus' as CurveName).line(pts([0, 0], [10, 5]))
    expect(d).toBe('M0,0L10,5')
  })
})
