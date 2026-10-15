/**
 * End labels (ledger row 108): which side of its point a label takes, and the room read through
 * the plot's own x mapping — never the labelled rows' extent, never a spread over the data.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Lines } from './Lines'
import { endLabelAnchor, endLabelPlan } from './labels'
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
): PlotContext<Row, Date> {
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
  test('an unknown position (a string x) keeps the default', () => {
    expect(endLabelAnchor({ ...base, fraction: null })).toBe('start')
    expect(endLabelAnchor({ ...base, fraction: Number.NaN })).toBe('start')
  })
})

describe('endLabelPlan', () => {
  test('the default domain: the last point is on the edge, so the label flips', () => {
    expect(anchors(endLabelPlan(plotOf(rows(20), [A]), [A], x, undefined))).toEqual(['end'])
  })

  test('an xDomain wider than the data leaves room: start', () => {
    const wide: [Date, Date] = [day(1), day(40)]
    expect(anchors(endLabelPlan(plotOf(rows(20), [A]), [A], x, wide))).toEqual(['start'])
  })

  test('an xDomain narrower than the data puts the last row past the edge: end, not clipped', () => {
    const narrow: [Date, Date] = [day(1), day(10)]
    expect(anchors(endLabelPlan(plotOf(rows(20), [A]), [A], x, narrow))).toEqual(['end'])
  })

  test('the extent is every datum, not the labelled series: a short series keeps its room', () => {
    // B stops 10 days early, A runs to the data's end: A's last point is on the edge, B's is not.
    const data = rows(20).map((r, i) => (i >= 10 ? { ...r, b: null } : r))
    const plan = endLabelPlan(plotOf(data, [A, B]), [A, B], x, undefined)
    expect(plan.map((p) => [p.series.key, p.anchor])).toEqual([
      ['a', 'end'],
      ['b', 'start'],
    ])
  })

  test('a single-point series on the domain edge has room to the right: start', () => {
    const data = [{ t: day(3), a: 10 }]
    expect(anchors(endLabelPlan(plotOf(data, [A]), [A], x, undefined))).toEqual(['start'])
    expect(anchors(endLabelPlan(plotOf(data, [A]), [A], x, [day(3), day(20)]))).toEqual(['start'])
  })

  test('a string x is undetermined: the default start', () => {
    type S = { t: string; a: number }
    const data: S[] = [
      { t: 'a', a: 1 },
      { t: 'b', a: 2 },
    ]
    const s: ChartSeries<S> = { key: 'a', label: 'Download', color: 'red', getValue: (d) => d.a }
    const plot = {
      ...plotOf([], []),
      data,
      rows: () => data.map((datum) => ({ x: datum.t, y: datum.a, series: 'a', datum })),
      visible: [s],
    } as unknown as PlotContext<S, string>
    expect(anchors(endLabelPlan(plot, [s], (d) => d.t, undefined))).toEqual(['start'])
  })

  test('off the wide class, with a right axis, or with more than three lines: none', () => {
    const data = rows(5)
    const regular = plotOf(data, [A], { containerClass: 'regular' })
    expect(endLabelPlan(regular, [A], x, undefined)).toEqual([])
    expect(endLabelPlan(plotOf(data, [A], { y2: 'y2' }), [A], x, undefined)).toEqual([])
    const four = [A, B, { ...A, key: 'c' }, { ...A, key: 'd' }]
    expect(endLabelPlan(plotOf(data, four), four, x, undefined)).toEqual([])
  })

  test('two labels closer than the minimum gap are both dropped', () => {
    const data = rows(5).map((r) => ({ ...r, a: 50, b: 50.5 }))
    expect(endLabelPlan(plotOf(data, [A, B]), [A, B], x, undefined)).toEqual([])
  })

  test('a 200k-point series plans without a spread over its rows', () => {
    const data = Array.from({ length: 200_000 }, (_, i) => ({
      t: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
      a: i % 90,
    }))
    const plan = endLabelPlan(plotOf(data, [A]), [A], x, undefined)
    expect(plan).toHaveLength(1)
    expect(plan[0]?.anchor).toBe('end')
  })

  test('a 200k-point Lines chart renders (no argument-spread RangeError)', () => {
    const data = Array.from({ length: 200_000 }, (_, i) => ({ t: day(1), a: i % 90 }))
    const html = renderToString(<Lines ariaLabel="Big" data={data} x={x} series={[A]} />)
    expect(html.length).toBeGreaterThan(100)
  })
})
