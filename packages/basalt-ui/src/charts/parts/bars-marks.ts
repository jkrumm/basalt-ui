/**
 * The marks of the bar series of a chart: stacked, grouped or normalized bars on a band x scale,
 * the empty-bin ticks of a slotted chart and the log-axis guard. Ported from the 2.x `Bars` kind;
 * `CartesianChart` composes them with the line and dot marks.
 */
import { barY } from '@tanstack/charts/bar'
import { dot } from '@tanstack/charts/dot'
import { group } from '@tanstack/charts/group'
import { decorative } from '@tanstack/charts/mark/decorative'
import { stack } from '@tanstack/charts/stack'
import { CV } from '../core/theme'
import { INK_STEP_DIM, dimmedPaint, emphasis, focusedPaint, isInkStep } from '../marks'
import { rowX } from '../types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from '../types'

export type BarLayout = 'stacked' | 'grouped' | 'normalized'

export const DEFAULT_BAR_OPACITY = 0.85
/** The empty-bin marker's radius, px: the plot's floor clips it to a 2px-high tick. */
const EMPTY_BIN_R = 2
/** The faintest shade told-apart-by-shade series step down to. */
const SHADE_FLOOR = 0.4

/**
 * Bar series that share one color and set no opacity of their own would draw identical bars. They
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
 * is hovered (the same `focus: 'x'` state that takes a drawn bar to full strength). A bin a `focus`
 * holds (keys, a list row) is lit the same way: the rest of the plot dims, so an empty bin must
 * not be the one place with no mark.
 */
function emptyBinTicks<D, X extends ChartX>(
  rows: readonly PlotRow<D, X>[],
  focused: D | null,
): ChartMarks {
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
  const lit = (row: PlotRow<D, X>): boolean => focused !== null && row.datum === focused
  const tick = (group: PlotRow<D, X>[], id: string, fillOpacity: number) =>
    dot(group, {
      id,
      x: rowX,
      y: () => 0,
      r: EMPTY_BIN_R,
      fill: CV.inkMuted,
      fillOpacity,
      states: [{ when: { focus: 'x' }, style: { fillOpacity: 1 } }],
    })
  const held = empty.filter(lit)
  const rest = empty.filter((row) => !lit(row))
  return [
    ...(rest.length > 0 ? [tick(rest, 'empty-bins', 0)] : []),
    ...(held.length > 0 ? [tick(held, 'empty-bins:focused', 1)] : []),
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

/** A segment of a clamped stack keeps at least this many px of height, so no part of the stack vanishes. */
export const MIN_SEGMENT_PX = 2

/**
 * The sizes of one side of a stack, fitted to `cap` in proportion: a segment the share would make
 * thinner than `min` keeps `min`, and the rest share out what is left. `floored` holds the segments
 * already at `min`. Returns the sizes in order.
 */
export function fitSegments(
  sizes: readonly number[],
  cap: number,
  min: number,
  floored: ReadonlySet<number> = new Set(),
): number[] {
  if (sizes.length * min >= cap) return sizes.map(() => cap / sizes.length)
  const free = sizes.reduce((acc, v, i) => (floored.has(i) ? acc : acc + v), 0)
  const share = (cap - floored.size * min) / free
  const thin = sizes.flatMap((v, i) => (!floored.has(i) && v * share < min ? [i] : []))
  if (thin.length > 0) return fitSegments(sizes, cap, min, new Set([...floored, ...thin]))
  return sizes.map((v, i) => (floored.has(i) ? min : v * share))
}

/**
 * A stack never draws past the plot's edge: a stack whose total passes a bounded domain is fitted to
 * the edge, its segments scaled in proportion, each (positive and negative part apart) kept at least
 * {@link MIN_SEGMENT_PX} tall, so the upper segments stay readable. A stack inside the domain is left
 * alone, and rows it does not change keep their identity. `plotHeight` is the px the domain spans.
 */
export function clampStacks<D>(
  rows: readonly PlotRow<D, ChartX>[],
  order: readonly string[],
  domain: readonly [number, number],
  plotHeight: number,
): PlotRow<D, ChartX>[] {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const min = plotHeight > 0 ? (MIN_SEGMENT_PX * (hi - lo)) / plotHeight : 0
  const cut = new Map<PlotRow<D, ChartX>, PlotRow<D, ChartX>>()
  for (const stack of stacksOf(rows)) {
    const live = stack.toSorted((a, b) => order.indexOf(a.series) - order.indexOf(b.series))
    const sides = [
      { parts: live.filter((r) => r.y !== null && r.y > 0), cap: Math.max(0, hi) },
      { parts: live.filter((r) => r.y !== null && r.y < 0), cap: Math.max(0, -lo) },
    ]
    for (const { parts, cap } of sides) {
      const sizes = parts.map((r) => Math.abs(r.y ?? 0))
      if (sizes.reduce((acc, v) => acc + v, 0) <= cap) continue
      const fitted = fitSegments(sizes, cap, min)
      for (const [i, row] of parts.entries()) {
        const size = fitted[i] ?? 0
        cut.set(row, { ...row, y: (row.y ?? 0) < 0 ? -size || 0 : size })
      }
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
  // Decorative: the tick's height is a drawing size (`ZERO_TICK_PX`), not a value, so it must not be the
  // focus point the hover chip and the cursor read ('0.03'); the zero rows' own 0 is.
  return [
    decorative(
      barY(drawn, {
        id: 'zero-ticks',
        x: rowX,
        y: 'y',
        z: 'series',
        fill: paint.fill,
        states: [{ when: { focus: 'x' }, style: { fill: paint.solid } }],
        layout: layout === 'grouped' ? group({ padding: 0.1 }) : stack({ order }),
      }),
    ),
  ]
}

/** A bar of a non-zero value is drawn at least this tall, px: above the zero bar's {@link ZERO_TICK_PX} tick, so one item never reads as none. */
const MIN_BAR_PX = 4

/**
 * The bars of a non-zero value drawn thinner than {@link MIN_BAR_PX} (a value a few hundredths of the
 * domain) as one bar mark of that height from the baseline, laid out like the bars so it is as wide as its
 * bar and on the side of its sign. A stack is judged by its total. Decorative, as the zero ticks are: the
 * height is a drawing size, never the value the hover chip and the cursor read. A normalized stack has none.
 */
function minBars<D>(
  plot: PlotContext<D, ChartX>,
  rows: readonly PlotRow<D, ChartX>[],
  paint: BarPaint<D>,
  layout: BarLayout,
  order: readonly string[],
): ChartMarks {
  if (layout === 'normalized' || !floorIsZero(plot.yDomain) || plot.plotHeight <= 0) return []
  const [lo, hi] = [Math.min(...plot.yDomain), Math.max(...plot.yDomain)]
  const unit = (hi - lo) / plot.plotHeight
  const thin = (value: number): boolean => value !== 0 && Math.abs(value) < MIN_BAR_PX * unit
  const valued = rows.filter((row) => row.y !== null && Number.isFinite(row.y))
  const lifted = new Map<PlotRow<D, ChartX>, number>()
  if (layout === 'grouped') {
    for (const row of valued)
      if (thin(row.y ?? 0)) lifted.set(row, Math.sign(row.y ?? 0) * MIN_BAR_PX * unit)
  } else {
    for (const stack of stacksOf(valued)) {
      const values = stack.map((row) => row.y ?? 0)
      const total = values.reduce((acc, v) => acc + v, 0)
      // One side only: a stack with parts on both sides has a body on each and is never thin.
      if (values.some((v) => v * total < 0) || !thin(total)) continue
      const widest = stack.reduce((a, b) => (Math.abs(b.y ?? 0) > Math.abs(a.y ?? 0) ? b : a))
      lifted.set(widest, Math.sign(total) * MIN_BAR_PX * unit)
    }
  }
  if (lifted.size === 0) return []
  const drawn =
    layout === 'grouped'
      ? rows.map((row) => ({ ...row, y: lifted.get(row) ?? null }))
      : [...lifted].map(([row, y]) => ({ ...row, y }))
  return [
    decorative(
      barY(drawn, {
        id: 'min-bars',
        x: rowX,
        y: 'y',
        z: 'series',
        fill: paint.fill,
        states: [{ when: { focus: 'x' }, style: { fill: paint.solid } }],
        layout: layout === 'grouped' ? group({ padding: 0.1 }) : stack({ order }),
      }),
    ),
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
  /** The series color, the brand accent for a highlighted datum. */
  const colorOf = (row: PlotRow<D, ChartX>): string | undefined => {
    const bar = byKey.get(row.series)
    if (bar?.highlight?.(row.datum)) return CV.brand
    return bar?.fillOf?.(row.datum) ?? bar?.color
  }
  /** The hovered bar: an ink-step bar rises through `focusedPaint`, as the focused one does, so it stands out from the bars that recede. */
  const solid = ({ datum }: { datum: PlotRow<D, ChartX> }): string => {
    const color = colorOf(datum)
    if (color === undefined) return 'transparent'
    return isInkStep(color) ? focusedPaint(color) : color
  }
  const fill = (row: PlotRow<D, ChartX>): string => {
    const bar = byKey.get(row.series)
    const color = colorOf(row)
    if (!bar || color === undefined) return 'transparent'
    const base = opacityOf?.(row.datum, row.series) ?? bar.fillOpacity ?? DEFAULT_BAR_OPACITY
    const strength = base * emphasis(h, { key: row.series })
    if (plot.focused === null) return paint(color, strength)
    // A `focus` holding a datum dims every other bar (`dimmedPaint`: the dark card's floor included)
    // and lifts the focused one past its resting color (`focusedPaint`).
    if (row.datum === plot.focused) return focusedPaint(color)
    // An ink-step bar fades by opacity (`INK_STEP_DIM`): `dimmedPaint`'s floor is its own color. It fades here, in its
    // paint, so a focus held outside the chart (a table row, a list) dims it as it dims a hue; a state the engine
    // resolves on its own hover never ran for such a focus.
    if (isInkStep(color)) return paint(color, strength * INK_STEP_DIM)
    return dimmedPaint(color, strength)
  }
  const order = visibleBars.map((s) => s.key)
  // A floating bar (a waterfall step) spans its base to its value: no stack, no zero tick.
  const base = visibleBars.find((s) => s.base !== undefined)?.base
  if (base !== undefined)
    return [
      barY(rows, {
        id: 'bars',
        x: rowX,
        y1: (row: PlotRow<D, ChartX>) => base(row.datum),
        y2: 'y',
        z: 'series',
        fill,
        states: [{ when: { focus: 'x' }, style: { fill: solid } }],
      }),
    ]
  // A stack stops at the plot's edge: a total past a bounded domain would overrun it.
  const drawn =
    layout === 'stacked' ? clampStacks(rows, order, plot.yDomain, plot.plotHeight) : rows
  return [
    barY(drawn, {
      id: 'bars',
      x: rowX,
      y: 'y',
      z: 'series',
      fill,
      // Series of one color differ by shade alone: a surface hairline keeps stacked segments apart.
      ...(sharedColor && layout !== 'grouped' && { stroke: CV.surface, strokeWidth: 1 }),
      // The hovered x is its own highlight: the bar reads at full strength.
      states: [{ when: { focus: 'x' }, style: { fill: solid } }],
      layout:
        layout === 'grouped'
          ? group({ padding: 0.1 })
          : stack({ order, ...(layout === 'normalized' && { offset: 'normalize' }) }),
    }),
    ...(emptyTicks
      ? emptyBinTicks(rows, plot.focused)
      : zeroTicks(plot, rows, { fill, solid }, layout, order)),
    ...minBars(plot, rows, { fill, solid }, layout, order),
  ]
}

/** Whether the baseline (y = 0) is on the plot: not on a log axis, not in a domain that starts above it. */
export function floorIsZero(domain: readonly [number, number] | undefined): boolean {
  return domain === undefined || (domain[0] <= 0 && domain[1] >= 0)
}
