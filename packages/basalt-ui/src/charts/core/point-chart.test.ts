/** A point chart past a bounded y keeps its caret clear of the dot, grows x for the edge dots, and opens its tooltip off the mark. */
import { describe, expect, test } from 'bun:test'
import type { ChartSeries, PlotContext } from '../types'
import { compileCartesian } from './compile'
import { xRoomForDots } from './axis-ext'

type Row = { d: number; v: number }
const rows: Row[] = [1, 2, 3, 4].map((d, i) => ({ d, v: i === 3 ? 21.42 : 1 + i }))
const dot: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'red',
  getValue: (r) => r.v,
  mark: 'dot',
}
const bar: ChartSeries<Row> = { ...dot, mark: 'bar' }

const build = (xOf: (r: Row) => number | Date, series: ChartSeries<Row>[] = [dot]) => {
  let seen: PlotContext<Row, number | Date> | undefined
  const def = compileCartesian({
    chartId: 'pc',
    data: rows,
    x: xOf,
    series,
    y: { domain: [0, 3] },
    marks: (plot: PlotContext<Row, number | Date>) => {
      seen = plot
      return []
    },
  } as never)
  const spec = def.chart({ width: 390, height: 240, defaultTheme: {} as never })
  return { def, spec, plot: seen as PlotContext<Row, number | Date> }
}

describe('a point series past a bounded y', () => {
  for (const [name, xOf] of [
    ['numeric', (r: Row) => r.d],
    ['time', (r: Row) => new Date(r.d * 86_400_000)],
  ] as const) {
    test(`draws the off-scale caret on a ${name} x, clear above the capped dot`, () => {
      const { spec, plot } = build(xOf)
      expect(Object.keys(spec.scales as object)).toContain('zx')
      const top = Math.max(...plot.yDomain)
      // The capped dot sits on the cap; the plot's edge is grown past it by the dot and the caret.
      expect(Math.max(...plot.rows('v').map((r) => r.y as number))).toBe(3)
      const perPx = (top - Math.min(...plot.yDomain)) / plot.plotHeight
      expect((top - 3) / perPx).toBeGreaterThanOrEqual(8 + 5)
    })
  }
})

describe('the x domain of a point chart', () => {
  test('leaves a whole dot at each edge', () => {
    const grown = xRoomForDots([1, 4], [1, 2, 3, 4], 6, 300)
    expect(grown).not.toBeNull()
    const [from, to] = grown as [number, number]
    const px = (x: number) => ((x - from) / (to - from)) * 300
    expect(px(1)).toBeGreaterThanOrEqual(6 - 0.01)
    expect(300 - px(4)).toBeGreaterThanOrEqual(6 - 0.01)
  })
  test('is left alone when no dot reaches an end', () => {
    expect(xRoomForDots([0, 100], [40, 60], 6, 300)).toBeNull()
  })
  test('a dot past a fixed window never widens it', () => {
    const grown = xRoomForDots([0, 6], [2.1, 5, 40], 6, 300)
    expect(grown === null || grown[1] === 6).toBe(true)
  })
  test('a line with a dot at its last x scales x wider than its data, so the dot is whole', () => {
    const line: ChartSeries<Row> = { ...dot, key: 'line', mark: 'line' }
    const today: ChartSeries<Row> = {
      ...dot,
      key: 'today',
      getValue: (r) => (r.d === 4 ? r.v : null),
    }
    const { spec } = build((r) => r.d, [line, today])
    const scale = (spec.scales as unknown as { x: { scale: { domain: () => number[] } } }).x.scale
    const [lo, hi] = scale.domain() as [number, number]
    expect(hi).toBeGreaterThan(4)
    expect(lo).toBe(1)
  })
  test('a line alone keeps the data extent', () => {
    const line: ChartSeries<Row> = { ...dot, key: 'line', mark: 'line' }
    const { spec } = build((r) => r.d, [line])
    const scale = (spec.scales as unknown as { x: { scale: { domain: () => number[] } } }).x.scale
    expect(scale.domain()).toEqual([1, 4])
  })
  test('a compiled point chart scales x wider than its data', () => {
    const { spec } = build((r) => r.d)
    const scale = (spec.scales as unknown as { x: { scale: { domain: () => number[] } } }).x.scale
    const [lo, hi] = scale.domain() as [number, number]
    expect(lo).toBeLessThan(1)
    expect(hi).toBeGreaterThan(4)
  })
})

describe('the tooltip', () => {
  test('anchors a point at its topmost mark, over it then below, off the dot', () => {
    const { def } = build((r) => r.d)
    const tip = def.tooltip as { anchor: unknown; placement: readonly string[]; offset: number }
    expect(typeof tip.anchor).toBe('function')
    expect(tip.placement).toEqual(['top', 'bottom'])
    expect(tip.offset).toBeGreaterThan(8)
    const at = (tip.anchor as (p: unknown[]) => { x: number; y: number })([
      { x: 10, y: 80 },
      { x: 10, y: 40 },
    ])
    expect(at).toEqual({ x: 10, y: 40 })
  })
  test('a column opens beside it at the pointer, never on its body, and at its top without a pointer', () => {
    const { def } = build((r) => r.d, [bar])
    const tip = def.tooltip as { anchor: unknown; placement: readonly string[] }
    expect(tip.placement).toEqual(['right', 'left'])
    const anchor = tip.anchor as (p: unknown[], c: { pointer: unknown }) => { x: number; y: number }
    const points = [
      { x: 10, y: 80 },
      { x: 10, y: 40 },
    ]
    expect(anchor(points, { pointer: { x: 12, y: 120 } })).toEqual({ x: 10, y: 120 })
    expect(anchor(points, { pointer: null })).toEqual({ x: 10, y: 40 })
  })
})
