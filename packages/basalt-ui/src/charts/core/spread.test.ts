/** `spreadAlong`: coincident dots move apart the least distance along one axis, inside the plot. */
import { describe, expect, test } from 'bun:test'
import type { ChartSeries, PlotContext } from '../types'
import { compileCartesian } from './compile'
import { spreadAlong } from './spread'
import type { SpreadPoint } from './spread'

const at = (along: number, across = 50, r = 4): SpreadPoint => ({ along, across, r })

/** Whether any two dots overlap once spread (their radii and the padding apart at least). */
const overlaps = (points: readonly SpreadPoint[], along: readonly number[], padding = 1): boolean =>
  points.some((p, i) =>
    points.some((q, j) => {
      if (j <= i) return false
      const dx = (along[i] as number) - (along[j] as number)
      const dy = p.across - q.across
      return Math.hypot(dx, dy) < p.r + q.r + padding - 1e-6
    }),
  )

describe('spreadAlong', () => {
  test('leaves dots that do not touch where they are', () => {
    const points = [at(10), at(40), at(80)]
    expect(spreadAlong(points, 200)).toEqual([10, 40, 80])
  })

  test('separates exact duplicates, alternating either side of their value', () => {
    const points = [at(100), at(100), at(100)]
    const placed = spreadAlong(points, 200)
    expect(placed[0]).toBe(100)
    expect(placed[1]).toBeCloseTo(109)
    expect(placed[2]).toBeCloseTo(91)
    expect(overlaps(points, placed)).toBe(false)
  })

  test('moves a touching dot only as far as it must', () => {
    const points = [at(100, 50), at(102, 53)]
    const placed = spreadAlong(points, 200)
    expect(placed[0]).toBe(100)
    // Its centre ends 9 px from the first (4 + 4 + 1) at the 3 px vertical offset: about 8.49 along.
    expect((placed[1] as number) - 100).toBeCloseTo(Math.sqrt(81 - 9))
    expect(overlaps(points, placed)).toBe(false)
  })

  test('keeps a heap inside the plot, never past its edge', () => {
    const points = Array.from({ length: 12 }, () => at(6))
    const placed = spreadAlong(points, 200)
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(4 - 1e-6)
    expect(overlaps(points, placed)).toBe(false)
  })

  test('a dot with no free spot inside the plot keeps its place', () => {
    const points = [at(10), at(10), at(10)]
    // 20 px holds one 8 px dot and its padding at most once on each side of 10.
    const placed = spreadAlong(points, 20)
    expect(placed[0]).toBe(10)
    expect(placed[2]).toBe(10)
  })

  test('is deterministic: the same points give the same layout', () => {
    // 20 dots of 9 px each fit the 300 px plot; past that the last ones keep their place.
    const points = Array.from({ length: 20 }, (_, i) => at(150 + (i % 5), 40 + (i % 3)))
    expect(spreadAlong(points, 300)).toEqual(spreadAlong(points, 300))
    expect(overlaps(points, spreadAlong(points, 300))).toBe(false)
  })
})

type Box = { id: string; restarts: number; peak: number }
const boxes: Box[] = [
  { id: 'a', restarts: 0, peak: 66 },
  { id: 'b', restarts: 0, peak: 66 },
  { id: 'c', restarts: 0, peak: 67 },
  { id: 'd', restarts: 4, peak: 30 },
]
const dots: ChartSeries<Box> = {
  key: 'peak',
  label: 'Peak',
  color: 'red',
  getValue: (b) => b.peak,
  mark: 'dot',
}

const plotOf = (spread?: 'x' | 'y'): PlotContext<Box, number> => {
  let seen: PlotContext<Box, number> | undefined
  const def = compileCartesian({
    chartId: 'spread',
    data: boxes,
    x: (b: Box) => b.restarts,
    series: [dots],
    y: { domain: [0, 100] },
    ...(spread !== undefined && { dotSpread: new Map([['peak', spread]]) }),
    marks: (plot: PlotContext<Box, number>) => {
      seen = plot
      return []
    },
  } as never)
  def.chart({ width: 600, height: 300, defaultTheme: {} as never })
  return seen as PlotContext<Box, number>
}

describe('a dot series with spread', () => {
  test('without it, coincident dots share one position', () => {
    const rows = plotOf().rows('peak')
    expect(rows[0]?.x).toBe(rows[1]?.x as number)
  })

  test("'x' moves coincident dots apart along x and keeps y and the datum", () => {
    const rows = plotOf('x').rows('peak')
    const [a, b, c, d] = rows
    expect(a?.x).not.toBe(b?.x as number)
    expect(c?.x).not.toBe(a?.x as number)
    expect(rows.map((r) => r.y)).toEqual([66, 66, 67, 30])
    expect(rows.map((r) => r.datum.id)).toEqual(['a', 'b', 'c', 'd'])
    // A dot nothing overlaps stays on its value.
    expect(d?.x).toBe(4)
  })

  test("'y' moves them apart along y and keeps x", () => {
    const rows = plotOf('y').rows('peak')
    expect(rows.map((r) => r.x)).toEqual([0, 0, 0, 4])
    expect(rows[0]?.y).not.toBe(rows[1]?.y as number)
    expect(rows[3]?.y).toBe(30)
  })
})

describe('the tooltip of a spread dot', () => {
  test("names the datum's true x, never the position the dot moved to", () => {
    let seen: PlotContext<Box, number> | undefined
    const def = compileCartesian({
      chartId: 'spread-tip',
      data: boxes,
      x: (b: Box) => b.restarts,
      series: [dots],
      y: { domain: [0, 100] },
      dotSpread: new Map([['peak', 'x']]),
      marks: (plot: PlotContext<Box, number>) => {
        seen = plot
        return []
      },
    } as never)
    def.chart({ width: 600, height: 300, defaultTheme: {} as never })
    const [a, b] = (seen as PlotContext<Box, number>).rows('peak')
    expect(b?.x).not.toBe(0)
    const content = (def.tooltip as unknown as { content: (p: unknown[]) => { title: string } })
      .content
    const titleOf = (row: typeof a) => content([{ xValue: row?.x, datum: row }]).title
    expect(titleOf(b)).toBe(titleOf(a))
  })
})
