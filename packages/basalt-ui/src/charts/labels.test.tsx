/**
 * End labels (ledger row 108): which side of its point a label takes, and the room read through
 * the plot's own x mapping — never the labelled rows' extent, never a spread over the data.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Lines } from './Lines'
import { endLabelAnchor, endLabelMarks, endLabelOffset, endLabelPlan } from './labels'
import { xScaleFor } from './scales'
import type { ChartSeries, PlotContext, PlotRow } from './types'

type Row = { t: Date; a: number | null; b?: number | null }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const A: ChartSeries<Row> = { key: 'a', label: 'Download', color: 'red', getValue: (d) => d.a }
const B: ChartSeries<Row> = {
  key: 'b',
  label: 'Upload',
  color: 'blue',
  getValue: (d) => d.b ?? null,
}

const x = (d: Row): Date => d.t

function plotOf(
  data: Row[],
  series: ChartSeries<Row>[],
  over: Partial<PlotContext<Row, Date>> = {},
  xDomain?: [Date, Date],
): PlotContext<Row, Date> {
  const model = xScaleFor(
    data.map((d) => d.t),
    false,
    xDomain,
  )
  const rows = (s: ChartSeries<Row>): PlotRow<Row, Date>[] =>
    data.map((datum) => ({ x: datum.t, y: s.getValue(datum), series: s.key, datum }))
  return {
    rows: (key) => rows(series.find((s) => s.key === key) as ChartSeries<Row>),
    visible: series,
    highlighted: null,
    containerClass: 'wide',
    width: 1000,
    height: 300,
    plotWidth: 1000,
    plotHeight: 300,
    data,
    xFraction: model.fraction,
    y2: undefined,
    yDomain: [0, 100],
    y2Domain: undefined,
    ...over,
  }
}

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ t: day(i + 1), a: 10 + (i % 7), b: 60 + (i % 5) }))

const anchors = (plan: { anchor: string }[]): string[] => plan.map((p) => p.anchor)

describe('endLabelAnchor', () => {
  const base = { plotWidth: 1000, label: 'Download', fontSize: 11 }
  test('room to the right: start', () => {
    expect(endLabelAnchor({ ...base, fraction: 0.5 })).toBe('start')
  })
  test('a point on the right edge: end', () => {
    expect(endLabelAnchor({ ...base, fraction: 1 })).toBe('end')
  })
  test('room just under the label width flips, just over does not', () => {
    // 8 glyphs x 11 px x 0.85 + 6 px dx = 80.8 px of room needed
    expect(endLabelAnchor({ ...base, fraction: 1 - 80 / 1000 })).toBe('end')
    expect(endLabelAnchor({ ...base, fraction: 1 - 82 / 1000 })).toBe('start')
  })
})

describe('endLabelOffset and endLabelMarks', () => {
  test('start sits right of the point and level; end sits left of it and above', () => {
    expect(endLabelOffset('start')).toEqual({ dx: 6, dy: 0 })
    const end = endLabelOffset('end')
    expect(end.dx).toBeLessThan(0)
    expect(end.dy).toBeLessThan(0)
  })

  test('one mark per planned label', () => {
    const plan = endLabelPlan(plotOf(rows(5), [A, B]), [A, B])
    expect(endLabelMarks(plan)).toHaveLength(plan.length)
  })
})

describe('endLabelPlan', () => {
  const plan = (
    data: Row[],
    lines: ChartSeries<Row>[],
    over: Partial<PlotContext<Row, Date>> = {},
    xDomain?: [Date, Date],
  ) => endLabelPlan(plotOf(data, lines, over, xDomain), lines)

  test('the default domain: the last point is on the edge, so the label flips', () => {
    expect(anchors(plan(rows(20), [A]))).toEqual(['end'])
  })

  test('an xDomain wider than the data leaves room: start', () => {
    expect(anchors(plan(rows(20), [A], {}, [day(1), day(40)]))).toEqual(['start'])
  })

  test('a last row beyond a narrower xDomain is clipped: no label; inside it: a label', () => {
    expect(plan(rows(20), [A], {}, [day(1), day(10)])).toEqual([])
    // the last row is day 20: inside [1, 20] (on the edge, flipped), outside [1, 19.9]
    expect(anchors(plan(rows(20), [A], {}, [day(1), day(20)]))).toEqual(['end'])
    expect(plan(rows(20), [A], {}, [day(2), day(30)])).toHaveLength(1)
  })

  test('the extent is every datum, not the labelled series: a short series keeps its room', () => {
    // B stops 10 days early, A runs to the data's end: A's last point is on the edge, B's is not.
    const data = rows(20).map((r, i) => (i >= 10 ? { ...r, b: null } : r))
    expect(plan(data, [A, B]).map((p) => [p.series.key, p.anchor])).toEqual([
      ['a', 'end'],
      ['b', 'start'],
    ])
  })

  test('a single-point series on the domain edge has room to the right: start', () => {
    const data = [{ t: day(3), a: 10 }]
    expect(anchors(plan(data, [A]))).toEqual(['start'])
    expect(anchors(plan(data, [A], {}, [day(3), day(20)]))).toEqual(['start'])
  })

  test('a string x is placed by its point scale', () => {
    type S = { t: string; a: number }
    const data: S[] = [
      { t: 'a', a: 1 },
      { t: 'b', a: 2 },
    ]
    const s: ChartSeries<S> = { key: 'a', label: 'Download', color: 'red', getValue: (d) => d.a }
    const model = xScaleFor(
      data.map((d) => d.t),
      false,
    )
    const plot = {
      ...plotOf([], []),
      data,
      rows: () => data.map((datum) => ({ x: datum.t, y: datum.a, series: 'a', datum })),
      visible: [s],
      xFraction: model.fraction,
    } as unknown as PlotContext<S, string>
    expect(anchors(endLabelPlan(plot, [s]))).toEqual(['start'])
  })

  test('off the wide class, with a right axis, or with more than three lines: none', () => {
    const data = rows(5)
    expect(plan(data, [A], { containerClass: 'regular' })).toEqual([])
    expect(plan(data, [A], { y2: 'y2' })).toEqual([])
    expect(plan(data, [A, B, { ...A, key: 'c' }, { ...A, key: 'd' }])).toEqual([])
  })

  test('two labels closer than the minimum gap are spread apart, both drawn', () => {
    const data = rows(5).map((r) => ({ ...r, a: 50, b: 50.5 }))
    const planned = plan(data, [A, B])
    expect(planned).toHaveLength(2)
    const [first, second] = planned.map((p) => p.nudge)
    expect(Math.abs((first ?? 0) - (second ?? 0))).toBeGreaterThan(11)
  })

  test('the collision gap is measured on the plot area, not the frame', () => {
    // 4 units of a 0-100 domain: 12 px on a 300 px plot (nudged), 24 px on a 600 px frame (clear).
    const data = rows(5).map((r) => ({ ...r, a: 50, b: 54 }))
    const nudged = (plotHeight: number): number[] =>
      plan(data, [A, B], { height: 600, plotHeight }).map((p) => p.nudge)
    expect(nudged(300).some((n) => n !== 0)).toBe(true)
    expect(nudged(600)).toEqual([0, 0])
  })

  test('a 200k-point series plans without a spread over its rows, and emits its label', () => {
    const data = Array.from({ length: 200_000 }, (_, i) => ({
      t: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
      a: i % 90,
    }))
    const planned = plan(data, [A])
    expect(planned).toHaveLength(1)
    expect(planned[0]?.anchor).toBe('end')
    expect(endLabelMarks(planned)).toHaveLength(1)
  })

  test('a 200k-point Lines chart renders (no argument-spread RangeError)', () => {
    const data = Array.from({ length: 200_000 }, (_, i) => ({ t: day(1), a: i % 90 }))
    const html = renderToString(<Lines ariaLabel="Big" data={data} x={x} series={[A]} />)
    expect(html.length).toBeGreaterThan(100)
  })
})
