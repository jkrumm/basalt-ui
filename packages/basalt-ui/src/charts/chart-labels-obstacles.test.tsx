/**
 * `chartLabels.place` called from `CartesianChart.custom`'s `build` keeps clear of what the host
 * drew: zone and rule captions, line paths and the bars of a band axis (`v3-expr-5-kit-fixes`).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { chartLabels } from './chart-labels'
import type { ChartLabel, LabelBox } from './chart-labels'
import { hostObstacles } from './label-obstacles'
import { CartesianChart, CartesianPlot } from './parts/cartesian'
import type { CartesianChartBase, CartesianChartProps, ChartPlot } from './contract'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: ReactElement): Promise<void> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  await act(async () => new Promise((r) => setTimeout(r, 20)))
}

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

type Seen<D, R> = { plot: ChartPlot<D>; obstacles: readonly LabelBox[]; result: R }
/**
 * A custom-marks builder that runs `inside` while it builds, where the host's obstacles are
 * published, and records the plot, the obstacles and what `inside` returned.
 */
function probe<D, R = undefined>(
  inside?: (plot: ChartPlot<D>) => R,
): { seen: Seen<D, R>[]; marks: NonNullable<CartesianChartProps<D>['marks']> } {
  const seen: Seen<D, R>[] = []
  return {
    seen,
    marks: CartesianChart.custom<D>((plot) => {
      seen.push({ plot, obstacles: [...hostObstacles()], result: inside?.(plot) as R })
      return []
    }),
  }
}

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height
const contains = (box: LabelBox, x: number, y: number): boolean =>
  x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height

type Bar = { day: string; n: number }
const BARS: readonly Bar[] = [
  { day: 'Mon', n: 40 },
  { day: 'Tue', n: 90 },
  { day: 'Wed', n: 10 },
]

/** Mounts a chart whose custom marks run `inside` and returns the last build. */
async function built<D, R = undefined>(
  chart: (marks: NonNullable<CartesianChartProps<D>['marks']>) => ReactElement,
  inside?: (plot: ChartPlot<D>) => R,
): Promise<Seen<D, R>> {
  const { seen, marks } = probe<D, R>(inside)
  await mount(chart(marks))
  const last = seen.at(-1)
  if (last === undefined) throw new Error('the builder never ran')
  return last
}

type Framed = { plotWidth: number; plotHeight: number }
const place = (plot: Framed, labels: readonly ChartLabel[]) =>
  chartLabels.place(labels, { width: plot.plotWidth, height: plot.plotHeight })

const barChart =
  (extra: Partial<CartesianChartBase<Bar>> = {}) =>
  (marks: NonNullable<CartesianChartProps<Bar>['marks']>) => (
    <CartesianChart<Bar>
      label="Bars"
      data={BARS}
      x={{ value: (d) => d.day }}
      series={[{ key: 'n', label: 'N', color: COLOR, mark: 'bar', y: (d) => d.n }]}
      marks={marks}
      {...extra}
    />
  )

describe('bars of a band axis', () => {
  test('each bar is an obstacle from its top to the baseline, as wide as the bar draws', async () => {
    const { plot, obstacles } = await built(barChart())
    for (const d of BARS) {
      const cx = plot.x(d.day) as number
      const top = plot.y(d.n)
      const bottom = plot.y(0)
      const body = obstacles.find(
        (b) => Math.abs(b.left + b.width / 2 - cx) < 1 && Math.abs(b.top - top) < 1,
      )
      expect(body).toBeDefined()
      expect(Math.abs((body?.height ?? 0) - (bottom - top))).toBeLessThan(1)
      expect(body?.width).toBeGreaterThan(10)
    }
  })

  test('a label inside a bar is dropped and a label above it sits clear', async () => {
    const { result, obstacles } = await built(barChart(), (plot) => {
      const cx = plot.x('Tue') as number
      return {
        inside: place(plot, [{ key: 'in', text: 'Best', x: cx, y: (plot.y(90) + plot.y(0)) / 2 }]),
        above: place(plot, [{ key: 'top', text: 'Best', x: cx, y: plot.y(90) }]),
      }
    })
    expect(result.inside.placed).toEqual([])
    expect(result.inside.dropped.map((l) => l.key)).toEqual(['in'])
    expect(result.above.placed.map((l) => l.key)).toEqual(['top'])
    for (const l of result.above.placed)
      for (const o of obstacles) expect(overlaps(l, o)).toBe(false)
  })

  test('grouped bars are one obstacle each, side by side', async () => {
    type Two = Bar & { m: number }
    const data: Two[] = BARS.map((d) => ({ ...d, m: d.n / 2 }))
    const { plot, obstacles } = await built<Two>((marks) => (
      <CartesianPlot<Two>
        label="Grouped"
        data={data}
        x={{ value: (d) => d.day }}
        layout="grouped"
        series={[
          { key: 'n', label: 'N', color: COLOR, mark: 'bar', y: (d) => d.n },
          { key: 'm', label: 'M', color: COLOR, mark: 'bar', y: (d) => d.m },
        ]}
        marks={marks}
      />
    ))
    const cx = plot.x('Tue') as number
    const columns = obstacles.filter(
      (b) => b.left > cx - 100 && b.left + b.width < cx + 100 && b.height > 20,
    )
    // The tall and the short bar of Tuesday, not one body the width of both.
    expect(columns.length).toBe(2)
    expect(columns.some((b) => Math.abs(b.top - plot.y(90)) < 1)).toBe(true)
    expect(columns.some((b) => Math.abs(b.top - plot.y(45)) < 1)).toBe(true)
    expect(columns[0]!.left + columns[0]!.width).toBeLessThan(columns[1]!.left)
  })
})

type Pt = { t: number; a: number; b: number }
const POINTS: readonly Pt[] = [0, 1, 2, 3, 4].map((t) => ({ t, a: t * 20, b: 80 - t * 10 }))

const lineChart =
  (extra: Partial<CartesianChartBase<Pt>> = {}) =>
  (marks: NonNullable<CartesianChartProps<Pt>['marks']>) => (
    <CartesianChart<Pt>
      label="Lines"
      data={POINTS}
      x={{ value: (d) => d.t }}
      series={[
        { key: 'a', label: 'A', color: COLOR, mark: 'line', y: (d) => d.a },
        { key: 'b', label: 'B', color: COLOR, mark: 'line', y: (d) => d.b },
      ]}
      marks={marks}
      {...extra}
    />
  )

describe('line paths, zone captions and rule captions', () => {
  test('every point of a line, and the stretch between two, is an obstacle', async () => {
    const { plot, obstacles } = await built(lineChart())
    for (const d of POINTS) {
      for (const key of ['a', 'b'] as const) {
        const x = plot.x(d.t) as number
        expect(obstacles.some((o) => contains(o, x, plot.y(d[key])))).toBe(true)
      }
    }
    const [p, q] = [POINTS[1] as Pt, POINTS[2] as Pt]
    const mid = {
      x: ((plot.x(p.t) as number) + (plot.x(q.t) as number)) / 2,
      y: (plot.y(p.a) + plot.y(q.a)) / 2,
    }
    expect(obstacles.some((o) => contains(o, mid.x, mid.y))).toBe(true)
  })

  test('a label anchored on a line never lands on it', async () => {
    const { result, obstacles } = await built(lineChart(), (plot) =>
      place(
        plot,
        POINTS.flatMap((d) => [
          { key: `a${d.t}`, text: 'Peak', x: plot.x(d.t) as number, y: plot.y(d.a) },
          { key: `b${d.t}`, text: 'Peak', x: plot.x(d.t) as number, y: plot.y(d.b) },
        ]),
      ),
    )
    expect(result.placed.length).toBeGreaterThan(0)
    for (const l of result.placed) for (const o of obstacles) expect(overlaps(l, o)).toBe(false)
  })

  const captioned = {
    zones: [
      { axis: 'x' as const, from: 1, to: 3, fill: 'var(--basalt-line)', label: 'Models part' },
    ],
    refLines: [{ value: 50, color: COLOR, dashed: true, label: 'Limit' }],
  }

  test('a zone caption and a rule caption are not obstacles: they give way to a data label', async () => {
    const { plot, obstacles } = await built(lineChart(captioned))
    const zoneLeft = plot.x(1) as number
    // The zone caption's top-start corner is free for a page's label.
    expect(
      obstacles.some(
        (o) => o.top < 24 && o.left >= zoneLeft && o.left < zoneLeft + 20 && o.width > 40,
      ),
    ).toBe(false)
    // So is the rule caption's end of the plot beside its line.
    const rule = plot.y(50)
    expect(
      obstacles.some(
        (o) =>
          Math.abs(o.top + o.height / 2 - rule) < 20 &&
          o.width > 20 &&
          o.width < 80 &&
          (o.left < 12 || o.left + o.width > plot.plotWidth - 12),
      ),
    ).toBe(false)
  })

  test('a label aimed at the zone caption keeps its spot', async () => {
    const { result, obstacles } = await built(lineChart(captioned), (plot) =>
      place(plot, [
        {
          key: 'n',
          text: '19.4 kt apart',
          x: plot.x(1) as number,
          y: 8,
          spots: ['right', 'above-right', 'below-right'],
        },
      ]),
    )
    expect(result.placed.map((l) => l.key)).toEqual(['n'])
    for (const l of result.placed) for (const o of obstacles) expect(overlaps(l, o)).toBe(false)
  })
})

describe('outside a host', () => {
  test('place is as it was: no obstacle but the ones passed', () => {
    expect(hostObstacles()).toEqual([])
    const { placed } = chartLabels.place([{ key: 'a', text: 'x', x: 50, y: 50 }], {
      width: 200,
      height: 100,
    })
    expect(placed.map((l) => l.spot)).toEqual(['right'])
  })

  test('the host scope ends with the build', async () => {
    await built(barChart())
    expect(hostObstacles()).toEqual([])
  })
})
