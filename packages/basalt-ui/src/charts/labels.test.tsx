/**
 * End labels (ledger row 108): which side of its point a label takes, and the room read through
 * the plot's own x mapping — never the labelled rows' extent, never a spread over the data.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Lines } from './Lines'
import {
  claimLabelBoxes,
  claimedLabelBoxes,
  endLabelAnchor,
  endLabelMarks,
  endLabelOffset,
  endLabelPlan,
} from './labels'
import type { EndLabel } from './labels'
import { yRangeWithin } from './ref-label'
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
    // Flipped: the lower label drops below its point, the higher rises above its own.
    const drawn = planned.map(
      (p, i) => (i === 0 ? 50 : 50.5) * 3 - (endLabelOffset(p.anchor, p.side).dy + p.nudge),
    )
    expect(Math.abs((drawn[0] ?? 0) - (drawn[1] ?? 0))).toBeGreaterThanOrEqual(15)
  })

  test('the collision gap is measured on the plot area, not the frame', () => {
    // Room to the right (level labels): 4 units of a 0-100 domain are 12 px on a 300 px plot (nudged), 24 px on a 600 px frame (clear).
    const data = rows(5).map((r) => ({ ...r, a: 50, b: 54 }))
    const nudged = (plotHeight: number): number[] =>
      plan(data, [A, B], { height: 600, plotHeight }, [day(1), day(40)]).map((p) => p.nudge)
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

describe('an end label never crosses its own line (w37 r2)', () => {
  const ending = (prev: number, last: number): Row[] => [
    { t: day(1), a: prev, b: null },
    { t: day(2), a: last, b: null },
  ]
  test('a line falling into its last point: the flipped label sits below it', () => {
    const [label] = endLabelPlan(plotOf(ending(80, 40), [A]), [A])
    expect(label?.anchor).toBe('end')
    expect(label?.side).toBe('below')
    expect(endLabelOffset('end', 'below').dy).toBeGreaterThan(0)
  })
  test('a line rising into its last point: the flipped label sits above it', () => {
    const [label] = endLabelPlan(plotOf(ending(40, 80), [A]), [A])
    expect(label?.side).toBe('above')
    expect(endLabelOffset('end', 'above').dy).toBeLessThan(0)
  })
  test('a label right of its point has no line to cross: level', () => {
    expect(endLabelOffset('start', 'below').dy).toBe(0)
  })
})

describe('endLabelPlan collision avoidance (argo body weight: Weight + 7 d mean)', () => {
  const LINE_HEIGHT = 15
  /** Two lines ending on the given values, both rising into the end (the same flip side). */
  const ending = (a: number, b: number, over: Partial<PlotContext<Row, Date>> = {}) => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      t: day(i + 1),
      a: i === 19 ? a : a - 2,
      b: i === 19 ? b : b - 2,
    }))
    const lines = [A, B]
    return endLabelPlan(plotOf(data, lines, { yDomain: [0, 100], ...over }), lines)
  }
  /** A label's centre in px from the plot bottom, as it is drawn. */
  const centre = (
    l: ReturnType<typeof ending>[number],
    last: number,
    over: { plotHeight?: number } = {},
  ) => (last / 100) * (over.plotHeight ?? 300) - (endLabelOffset(l.anchor, l.side).dy + l.nudge)

  test('two equal last values end at least one line apart', () => {
    const [a, b] = ending(50, 50)
    expect(Math.abs(centre(a as never, 50) - centre(b as never, 50))).toBeGreaterThanOrEqual(
      LINE_HEIGHT,
    )
  })

  test('two values 0.2 apart on a 20-unit axis still clear each other', () => {
    const [a, b] = ending(50, 50.2, { yDomain: [40, 60] })
    const yA = ((50 - 40) / 20) * 300
    const yB = ((50.2 - 40) / 20) * 300
    expect(
      Math.abs(centre(a as never, 0) + yA - (centre(b as never, 0) + yB)),
    ).toBeGreaterThanOrEqual(LINE_HEIGHT)
  })

  test('the stack slides down from the top edge and keeps its order', () => {
    const [a, b] = ending(100, 100)
    expect(centre(a as never, 100)).toBeLessThanOrEqual(300 - 7)
    expect(centre(b as never, 100)).toBeLessThanOrEqual(300 - 7)
    expect(Math.abs(centre(a as never, 100) - centre(b as never, 100))).toBeGreaterThanOrEqual(
      LINE_HEIGHT,
    )
  })

  test('a label keeps its own colour key and series', () => {
    const plan = ending(50, 50)
    expect(plan.map((p) => p.series.color)).toEqual(['red', 'blue'])
  })

  /** Both lines FALL into their end point (argo's weight loss): the per-line rule alone says "below" twice. */
  const falling = (a: number, b: number, c?: number) => {
    const last = [a, b, c]
    const data = Array.from({ length: 20 }, (_, i) => ({
      t: day(i + 1),
      a: i === 19 ? a : a + 3,
      b: i === 19 ? b : b + 3,
      c: i === 19 ? (c ?? null) : c === undefined ? null : c + 3,
    }))
    const C: ChartSeries<Row & { c: number | null }> = {
      key: 'c',
      label: 'Third',
      color: 'green',
      getValue: (d) => d.c,
    }
    const lines = c === undefined ? [A, B] : [A, B, C]
    return {
      last,
      plan: endLabelPlan(
        plotOf(data as never, lines as never, { yDomain: [0, 100] }),
        lines as never,
      ),
    }
  }

  test('two close flipped labels straddle their points: the higher above, the lower below', () => {
    const { plan } = falling(50, 50.2)
    const sides = Object.fromEntries(plan.map((p) => [p.series.key, p.side]))
    expect(sides).toEqual({ a: 'below', b: 'above' })
  })

  test('three close falling flipped labels: the lowest below, the rest above', () => {
    const { plan } = falling(50, 50.2, 50.4)
    const sides = Object.fromEntries(plan.map((p) => [p.series.key, p.side]))
    expect(sides['a']).toBe('below')
    expect(sides['b']).toBe('above')
    expect(sides['c']).toBe('above')
  })

  /** Lines ending on `ends`, each coming from `from` (above or below its end). */
  const moving = (ends: number[], from: number[]) => {
    const keys = ['a', 'b', 'c'] as const
    const series = ends.map((_, i) => ({
      key: keys[i] as string,
      label: `Line ${i}`,
      color: 'red',
      getValue: (d: Record<string, number>) => d[keys[i] as string] as number,
    }))
    const data = Array.from({ length: 20 }, (_, i) => ({
      t: day(i + 1),
      ...Object.fromEntries(keys.map((k, j) => [k, i === 19 ? ends[j] : from[j]])),
    }))
    return endLabelPlan(
      plotOf(data as never, series as never, { yDomain: [0, 100] }),
      series as never,
    ).map((p) => p.side)
  }

  test('two close RISING lines mirror: the highest above, the lower below its point', () => {
    // The lower label must not sit above-left on its own rising segment.
    expect(moving([50, 50.2], [47, 47])).toEqual(['below', 'above'])
  })

  test('a mixed pair keeps each line on the side away from its own segment', () => {
    // a falls into its end (label below), b rises into it (label above).
    expect(moving([50, 50.2], [53, 47])).toEqual(['below', 'above'])
    expect(moving([50, 50.2], [47, 53])).toEqual(['above', 'below'])
  })

  test('a stack taller than the plot closes its gaps and stays inside it', () => {
    const ends = [50, 50.1, 50.2]
    const lines = ['a', 'b', 'c'] as const
    const series = lines.map((k) => ({
      key: k as string,
      label: k,
      color: 'red',
      getValue: (d: Record<string, number>) => d[k] as number,
    }))
    const data = Array.from({ length: 20 }, (_, i) => ({
      t: day(i + 1),
      a: ends[0],
      b: ends[1],
      c: ends[2],
    }))
    const plotHeight = 30
    const plan = endLabelPlan(
      plotOf(data as never, series as never, { yDomain: [0, 100], plotHeight }),
      series as never,
    )
    const centres = plan.map(
      (p, i) =>
        ((ends[i] as number) / 100) * plotHeight - (endLabelOffset(p.anchor, p.side).dy + p.nudge),
    )
    for (const c of centres) {
      expect(c).toBeGreaterThanOrEqual(7)
      expect(c).toBeLessThanOrEqual(plotHeight - 7)
    }
  })
})

describe('end labels keep off every line and rule (w43 r2)', () => {
  // argo's body weight, invented: a falling jagged Weight ending 0.1 kg off its smooth 7 d mean,
  // over a Goal rule at 78 kg on a 77-86 kg axis, 190 px tall and 1000 px wide.
  const DAYS = 60
  const raw = Array.from({ length: DAYS }, (_, i) => {
    const trend = 84 - i * 0.09
    return i === DAYS - 1 ? trend + 0.1 : trend + Math.sin(i * 2.1) * 0.6 + Math.cos(i * 0.9) * 0.3
  })
  const data: Row[] = raw.map((a, i) => {
    const win = raw.slice(Math.max(0, i - 6), i + 1)
    return { t: day(i + 1), a, b: win.reduce((sum, v) => sum + v, 0) / win.length }
  })
  const W = { ...A, key: 'a', label: 'Weight' }
  const M = { ...B, key: 'b', label: '7 d mean' }
  const lines = [W, M]
  const GOAL = 78
  const over = {
    yDomain: [77, 86] as [number, number],
    plotHeight: 190,
    containerClass: 'wide' as const,
  }
  const perKg = 190 / 9
  const px = (v: number): number => (v - 77) * perKg

  /** The px (from the bottom) a label's ink spans, and the lines it runs into: [] when clear. */
  const crossed = (plan: EndLabel<Row, Date>[]): string[] =>
    plan.flatMap((p) => {
      const last = data.at(-1) as Row
      const y = px((p.series.key === 'a' ? last.a : last.b) as number)
      const c = y - (endLabelOffset(p.anchor, p.side).dy + p.nudge)
      const [from, to] = [c - 4.125, c + 4.125]
      const fx = 1
      const x0 = fx - (6 + p.series.label.length * 11 * 0.62) / 1000
      const x1 = fx - 6 / 1000
      const hit = [
        ...lines.map(
          (s) =>
            [
              s.key,
              data.map((d, i) => ({
                fx: (i + 0) / (DAYS - 1),
                y: px((s.key === 'a' ? d.a : d.b) as number),
              })),
            ] as const,
        ),
        [
          'goal',
          [
            { fx: 0, y: px(GOAL) },
            { fx: 1, y: px(GOAL) },
          ],
        ] as const,
      ].filter(([, pts]) => {
        const range = yRangeWithin(pts as never, x0, x1)
        return range !== null && range[1] >= from && range[0] <= to
      })
      return hit.map(([name]) => `${p.series.label} over ${name}`)
    })

  test('a label sits clear of the other line and the rule, not only of its own', () => {
    const plan = endLabelPlan(plotOf(data, lines, over), lines, 'auto', [GOAL])
    expect(plan).toHaveLength(2)
    expect(crossed(plan)).toEqual([])
  })

  test('the plan claims a box per label for a reference caption to avoid', () => {
    const plan = endLabelPlan(plotOf(data, lines), lines)
    for (const p of plan) {
      expect(p.box.fx1).toBeLessThanOrEqual(1)
      expect(p.box.y1).toBeGreaterThan(p.box.y0)
    }
    const plot = plotOf(data, lines)
    claimLabelBoxes(
      plot,
      plan.map((p) => p.box),
    )
    expect(claimedLabelBoxes(plot)).toHaveLength(2)
    expect(claimedLabelBoxes(plotOf(data, lines))).toEqual([])
  })
})
