/** Expression cycle 2 kit fixes, the pure parts: rule captions, reference caption drops and the Date tick floor. */
import { describe, expect, test } from 'bun:test'
import { xRefLabelSpots } from './axis-gaps'
import { dateTicks } from './compile'
import { dateTicks as coreDateTicks } from './core/compile'
import { placeRefLabel } from './ref-label'

const DAY = 86_400_000
const rules = (days: readonly number[], labels: readonly string[]) =>
  days.map((x, i) => ({ x, color: 'red', label: labels[i] }))

describe('rule captions (xRefLabelSpots)', () => {
  const spots = (plotWidth: number) =>
    xRefLabelSpots({
      lines: rules([3, 4, 5, 9], ['v2.9.8', 'v2.9.9', 'v2.9.10', 'v2.10.0']),
      fraction: (x: number) => x / 12,
      plotWidth,
      fontSize: 11,
    })

  test('wide: every caption takes its own side of the top row', () => {
    const wide = spots(1400)
    expect(wide).toHaveLength(4)
    expect(wide.every((s) => s.row === 0)).toBe(true)
  })

  test('narrow: no two captions on one row overlap, and none leaves the plot', () => {
    const narrow = spots(330)
    for (const a of narrow) {
      expect(a.x0).toBeGreaterThanOrEqual(0)
      expect(a.x1).toBeLessThanOrEqual(330)
      for (const b of narrow)
        if (a !== b && a.row === b.row) expect(a.x1 <= b.x0 || b.x1 <= a.x0).toBe(true)
    }
  })

  test('before the plot is measured every caption keeps its natural spot', () => {
    expect(spots(0)).toHaveLength(4)
  })
})

describe('reference caption placement', () => {
  const base = {
    pinned: undefined,
    startFirst: false,
    value: 50,
    domain: [0, 100] as const,
    plotWidth: 400,
    plotHeight: 200,
    label: 'Cap',
    fontSize: 11,
    series: [],
  }

  test('a pinned spot a data line runs through gives way to a clear one', () => {
    const line = [
      { fx: 0, y: 53 },
      { fx: 0.3, y: 53 },
    ]
    const placed = placeRefLabel({ ...base, pinned: 'start-above', series: [line] })
    expect(placed?.position).not.toBe('start-above')
  })

  test('a caption drops when every spot meets another caption', () => {
    const everywhere = [{ fx0: 0, fx1: 1, y0: 0, y1: 100 }]
    expect(placeRefLabel({ ...base, claimed: everywhere })).toBeNull()
  })
})

describe('Date tick floor', () => {
  const at = (day: number): Date => new Date(Date.UTC(2026, 10, day))
  for (const [name, ticks] of [
    ['root', dateTicks],
    ['core', coreDateTicks],
  ] as const) {
    test(`${name}: twelve days asked for 3 ticks keeps at least three`, () => {
      expect(ticks([at(2), at(14)], 3, DAY).length).toBeGreaterThanOrEqual(3)
    })
    test(`${name}: a two-day span is not forced past what it holds`, () => {
      expect(ticks([at(2), at(4)], 3, DAY).length).toBeLessThanOrEqual(3)
    })
  }
})
