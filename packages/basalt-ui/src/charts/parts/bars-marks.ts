/**
 * The marks of the bar series of a chart: stacked, grouped or normalized bars on a band x scale,
 * the empty-bin ticks of a slotted chart and the log-axis guard. Ported from the 2.x `Bars` kind;
 * `CartesianChart` composes them with the line and dot marks.
 */
import { barY } from '@tanstack/charts/bar'
import { dot } from '@tanstack/charts/dot'
import { group } from '@tanstack/charts/group'
import { stack } from '@tanstack/charts/stack'
import { CV } from '../core/theme'
import { dimmedPaint, emphasis } from '../marks'
import { rowX } from '../types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from '../types'

export type BarLayout = 'stacked' | 'grouped' | 'normalized'

export const DEFAULT_BAR_OPACITY = 0.85
/** The empty-bin marker's radius, px: the plot's floor clips it to a 2px-high tick. */
const EMPTY_BIN_R = 2
/** The faintest shade told-apart-by-shade series step down to. */
const SHADE_FLOOR = 0.4

/**
 * Bar series that share one colour and set no opacity of their own would draw identical bars. They
 * step down from full strength to `SHADE_FLOOR` in series order (the first is the strongest), so the
 * legend swatches and the plot tell them apart by more than the label. A chart with a per-datum
 * `opacity` keeps its own shades. Every bar series leaves with a `fillOpacity`.
 */
export function shadeBars<D>(
  bars: readonly ChartSeries<D>[],
  perDatum: boolean,
): readonly ChartSeries<D>[] {
  return bars.map((b) => {
    const same = bars.filter((o) => o.color === b.color)
    if (perDatum || same.length < 2)
      return { ...b, fillOpacity: b.fillOpacity ?? DEFAULT_BAR_OPACITY }
    const step = (1 - SHADE_FLOOR) / (same.length - 1)
    return { ...b, fillOpacity: 1 - same.indexOf(b) * step }
  })
}

export const paint = (color: string, opacity: number): string =>
  opacity >= 1 ? color : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`

/**
 * A slotted chart has no axes to name the hovered bin, and an empty bin has no bar to light. Each bin
 * whose stack sums to zero gets a baseline mark (a half-dot on the plot's floor), hidden until that x
 * is hovered (the same `focus: 'x'` state that takes a drawn bar to full strength).
 */
function emptyBinTicks<D, X extends ChartX>(rows: readonly PlotRow<D, X>[]): ChartMarks {
  // A gap (`y: null` on every series) is an absence, not a zero: only a bin with a value counts.
  const sums = new Map<string, { row: PlotRow<D, X>; sum: number; values: number }>()
  for (const row of rows) {
    const key = String(row.x instanceof Date ? row.x.getTime() : row.x)
    const entry = sums.get(key) ?? { row, sum: 0, values: 0 }
    if (row.y !== null && Number.isFinite(row.y)) {
      entry.sum += Math.abs(row.y)
      entry.values += 1
    }
    sums.set(key, entry)
  }
  const empty = [...sums.values()].filter((e) => e.values > 0 && e.sum === 0).map((e) => e.row)
  if (empty.length === 0) return []
  return [
    dot(empty, {
      id: 'empty-bins',
      x: rowX,
      y: () => 0,
      r: EMPTY_BIN_R,
      fill: CV.inkMuted,
      fillOpacity: 0,
      states: [{ when: { focus: 'x' }, style: { fillOpacity: 1 } }],
    }),
  ]
}

/** A zero bar's tick is this tall, px. */
const ZERO_TICK_PX = 2

const rowKey = (row: PlotRow<unknown, ChartX>): string =>
  String(row.x instanceof Date ? row.x.getTime() : row.x)

/** The rows by x, in first-seen order. */
function stacksOf<D>(rows: readonly PlotRow<D, ChartX>[]): PlotRow<D, ChartX>[][] {
  const byX = new Map<string, PlotRow<D, ChartX>[]>()
  for (const row of rows) byX.set(rowKey(row), [...(byX.get(rowKey(row)) ?? []), row])
  return [...byX.values()]
}

/**
 * A stack never draws past the plot's edge: each x walks its segments bottom up and cuts a segment
 * at the domain's end (the positive and the negative parts apart), so a stack whose total passes a
 * bounded domain stops at the edge. Rows it leaves alone keep their identity.
 */
export function clampStacks<D>(
  rows: readonly PlotRow<D, ChartX>[],
  order: readonly string[],
  domain: readonly [number, number],
): PlotRow<D, ChartX>[] {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const cut = new Map<PlotRow<D, ChartX>, PlotRow<D, ChartX>>()
  for (const stack of stacksOf(rows)) {
    let up = 0
    let down = 0
    for (const row of stack.toSorted((a, b) => order.indexOf(a.series) - order.indexOf(b.series))) {
      if (row.y === null || !Number.isFinite(row.y)) continue
      const y =
        row.y >= 0 ? Math.min(row.y, Math.max(0, hi - up)) : Math.max(row.y, Math.min(0, lo - down))
      if (row.y >= 0) up += y
      else down += y
      if (y !== row.y) cut.set(row, { ...row, y })
    }
  }
  return rows.map((row) => cut.get(row) ?? row)
}

/**
 * The bars whose value is exactly 0 (a stack: whose whole stack sums to 0) as one bar mark of
 * {@link ZERO_TICK_PX} height on the baseline, laid out like the bars so a tick is as wide as its
 * bar. A gap (`y: null`) stays absent. Grouped keeps every row (a null `y` draws nothing but still
 * holds its slot), a stack gets one row per empty x. A normalized stack has no tick: a share of 0.
 */
function zeroTicks<D>(
  plot: PlotContext<D, ChartX>,
  rows: readonly PlotRow<D, ChartX>[],
  paint: BarPaint<D>,
  layout: BarLayout,
  order: readonly string[],
): ChartMarks {
  if (layout === 'normalized' || !floorIsZero(plot.yDomain)) return []
  const valued = rows.filter((row) => row.y !== null && Number.isFinite(row.y))
  const ticks =
    layout === 'grouped'
      ? valued.filter((row) => row.y === 0)
      : stacksOf(valued)
          .filter((stack) => stack.every((row) => row.y === 0))
          .map((stack) => stack[0] as PlotRow<D, ChartX>)
  if (ticks.length === 0) return []
  const [lo, hi] = [Math.min(...plot.yDomain), Math.max(...plot.yDomain)]
  const height = plot.plotHeight > 0 ? (ZERO_TICK_PX * (hi - lo)) / plot.plotHeight : 0
  const drawn =
    layout === 'grouped'
      ? rows.map((row) => ({ ...row, y: ticks.includes(row) ? height : null }))
      : ticks.map((row) => ({ ...row, y: height }))
  return [
    barY(drawn, {
      id: 'zero-ticks',
      x: rowX,
      y: 'y',
      z: 'series',
      fill: paint.fill,
      states: [{ when: { focus: 'x' }, style: { fill: paint.solid } }],
      layout: layout === 'grouped' ? group({ padding: 0.1 }) : stack({ order }),
    }),
  ]
}

/** How a bar row paints: at rest and dimmed (`fill`), at full strength on hover (`solid`). */
type BarPaint<D> = {
  fill: (row: PlotRow<D, ChartX>) => string
  solid: (point: { datum: PlotRow<D, ChartX> }) => string
}

export type BarMarksInput<D> = {
  /** The bar series (already through {@link shadeBars}). */
  bars: readonly ChartSeries<D>[]
  layout: BarLayout
  /** Per-datum opacity by series key; absent, the series' own `fillOpacity` draws. */
  opacityOf?: (d: D, key: string) => number | undefined
  /** In a visual slot, with the baseline on the plot: empty bins get a hover tick. */
  emptyTicks: boolean
}

export function barMarks<D>(plot: PlotContext<D, ChartX>, input: BarMarksInput<D>): ChartMarks {
  const { bars, layout, opacityOf, emptyTicks } = input
  const sharedColor = bars.some((b, i) => bars.findIndex((o) => o.color === b.color) !== i)
  const byKey = new Map(bars.map((b) => [b.key, b]))
  const visibleBars = plot.visible.filter((s) => byKey.has(s.key))
  const rows = visibleBars.flatMap((s) => plot.rows(s.key))
  if (rows.length === 0) return []
  const h = plot.highlighted
  /** The series colour, the brand accent for a highlighted datum. */
  const colorOf = (row: PlotRow<D, ChartX>): string | undefined => {
    const bar = byKey.get(row.series)
    return bar?.highlight?.(row.datum) ? CV.brand : bar?.color
  }
  const solid = ({ datum }: { datum: PlotRow<D, ChartX> }): string =>
    colorOf(datum) ?? 'transparent'
  const fill = (row: PlotRow<D, ChartX>): string => {
    const bar = byKey.get(row.series)
    const color = colorOf(row)
    if (!bar || color === undefined) return 'transparent'
    const base = opacityOf?.(row.datum, row.series) ?? bar.fillOpacity ?? DEFAULT_BAR_OPACITY
    const strength = base * emphasis(h, { key: row.series })
    // A `focus` holding a datum dims every other bar (`dimmedPaint`: the dark card's floor included).
    if (plot.focused === null || row.datum === plot.focused) return paint(color, strength)
    return dimmedPaint(color, strength)
  }
  const order = visibleBars.map((s) => s.key)
  // A stack stops at the plot's edge: a total past a bounded domain would overrun it.
  const drawn = layout === 'stacked' ? clampStacks(rows, order, plot.yDomain) : rows
  return [
    barY(drawn, {
      id: 'bars',
      x: rowX,
      y: 'y',
      z: 'series',
      fill,
      // Series of one colour differ by shade alone: a surface hairline keeps stacked segments apart.
      ...(sharedColor && layout !== 'grouped' && { stroke: CV.surface, strokeWidth: 1 }),
      // The hovered x is its own highlight: the bar reads at full strength.
      states: [{ when: { focus: 'x' }, style: { fill: solid } }],
      layout:
        layout === 'grouped'
          ? group({ padding: 0.1 })
          : stack({ order, ...(layout === 'normalized' && { offset: 'normalize' }) }),
    }),
    ...(emptyTicks ? emptyBinTicks(rows) : zeroTicks(plot, rows, { fill, solid }, layout, order)),
  ]
}

/** Whether the baseline (y = 0) is on the plot: not on a log axis, not in a domain that starts above it. */
export function floorIsZero(domain: readonly [number, number] | undefined): boolean {
  return domain === undefined || (domain[0] <= 0 && domain[1] >= 0)
}
