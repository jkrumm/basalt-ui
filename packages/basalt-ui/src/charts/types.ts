/**
 * The public prop vocabulary of `basalt-ui/charts` (`docs/V2-SPEC.md` § 9). React-free and
 * engine-light: the only engine type named here is the mark array `marks` returns.
 */
import type { StoredChartSpec } from '@tanstack/charts/types/core'
import type { BasaltProps } from '../common/props'
import type { ContainerClass } from '../tokens/size-classes'
import type { CurveName } from './curves'

/** What `x` may return. The value type picks the x scale (§ 9.4): `Date` → time, `number` → linear,
 * `string` → point (lines) or band (bars). */
export type ChartX = Date | number | string

/**
 * A plotted series — the single source of truth for color, dash, legend entry and tooltip row. The
 * legend and the tooltip are derived from it, never authored beside it.
 */
export type ChartSeries<T> = {
  key: string
  label: string
  /** A `VX.*` ref or a consumer series token (`var(--…)`), never a literal. */
  color: string
  /** `null` is an ABSENCE, never a zero: a gap in the line, no tooltip row, out of the domain. A
   * series whose `getValue` is always `null` is a legend-only entry (a zone or reference key). */
  getValue: (d: T) => number | null
  /** The legend swatch shape. Default: the kind's own mark (`line` in `Lines`, `bar` in `Bars`). */
  mark?: 'line' | 'bar' | 'area'
  /** Default `'solid'`; `'dashed'` is `VX.dashArray` on the line, the legend and the tooltip. */
  dash?: 'solid' | 'dashed'
  /** Interpolation between points. Default `'monotone'`. A piecewise-constant quantity (a price
   * tier, a config value) is a step: a smoothed curve draws values that never existed. */
  curve?: CurveName
  strokeWidth?: number
  /** Dims the plotted stroke (a faint companion line). Strokes only. */
  strokeOpacity?: number
  /** Bars and areas. */
  fillOpacity?: number
  /** `Lines`: a soft gradient fill under the line — `true` in the series color, or a color ref. */
  area?: boolean | string
  /** Which y axis the series is measured against. `'right'` needs the chart's `y2`. */
  axis?: 'left' | 'right'
  /** Legend grouping: series → overlay → reference. Default `'series'`. */
  role?: 'series' | 'overlay' | 'reference'
  /** `false` keeps it out of the legend (a companion line folded under `parent`). Default `true`. */
  legend?: boolean
  /** `false` draws and legends it but never lists it as a tooltip row. Default `true`. */
  tooltip?: boolean
  /** A companion (an MA line) names its parent, so a legend toggle and hover keep the pair. */
  parent?: string
  /** A short qualifier after the label in the legend and the tooltip row, in muted text. */
  note?: string
  /** Per-series tooltip value format; receives the datum so a row can read more than the value. */
  formatValue?: (v: number, d: T) => string
  /** A marker at a point (a PR star, a status dot); `null` for none. */
  getMarker?: (d: T) => { color?: string; r?: number; fillOpacity?: number; ring?: boolean } | null
}

/** One y axis. */
export type AxisConfig<T> = {
  /**
   * `'auto'` (default) derives the domain from the VISIBLE series plus this axis' finite zone and
   * reference-line bounds; a tuple fixes it; a function computes it from the data and the visible
   * series (so a legend toggle can shrink a stacked domain).
   */
  domain?:
    | readonly [number, number]
    | 'auto'
    | ((data: readonly T[], visible: readonly ChartSeries<T>[]) => readonly [number, number])
  /** When `'auto'`: the raw upper bound is at least this; padding applies after. */
  autoMaxFloor?: number
  /** When `'auto'`: the lower bound is at most this. Default `0` (a zero baseline); `Infinity` pads
   * down from the data minimum instead. Ignored on a log axis. */
  autoMinCeil?: number
  /** When `'auto'`: padding multiplier away from the data. Default `1.1`. */
  autoPad?: number
  /** A tick count, or the exact tick values. Default: one per ~48px of plot height, ≤ 5. */
  ticks?: number | readonly number[]
  /** Tick and tooltip formatter. Default: compact numbers (`12.5k`). */
  format?: (v: number) => string
  /** Horizontal grid rules. Default: on for `y`, off for `y2`. */
  grid?: boolean
  /** Round the domain outward to nice ticks. Default `false` (a fixed domain stays fixed). */
  nice?: boolean
  /** Default `'linear'`. A log axis floors at the smallest positive visible value. */
  scale?: 'linear' | 'log'
}

/** A horizontal band on one y axis. `±Infinity` reaches the plot edge. */
export type ZoneSpec = {
  from: number
  to: number
  fill: string
  axisSide?: 'left' | 'right'
}

/**
 * A vertical band between two x values. An omitted bound is the plot's own edge. `'edge'` widens a
 * present bound by half a sample step, so a band covers its terminal samples in full (a night
 * from one hour to another, both hours included).
 */
export type XZoneSpec<X extends ChartX = ChartX> = {
  from?: X
  to?: X
  fill: string
  align?: 'center' | 'edge'
}

/** A horizontal reference line — annotation only, no domain role beyond staying inside the plot. */
export type RefLine = {
  value: number
  color: string
  dashed?: boolean
  axis?: 'left' | 'right'
}

/** A fill between the line and a value, on one side of it, tracking the line. */
export type Threshold = {
  value: number
  side: 'above' | 'below'
  fill: string
}

/** How a sibling chart's cursor value lands on this chart's x values. Strings always match exactly. */
export type CursorResolution = 'exact' | 'nearest' | 'leading'

/** One tooltip row, as data. */
export type ChartTooltipRow = {
  label: string
  value: string
  /** The row swatch; omitted, the row has none. */
  color?: string
}

export type ChartTooltipConfig<T, X extends ChartX = ChartX> = {
  /** The tooltip title. Default: the x value through `formatX`'s long form (a date reads
   * `Mon Sep 1 2026`). */
  formatHeader?: (x: X, d: T) => string
  /** Rows after the per-series rows (a total, a zone badge, a context line). `visible`/`hidden` are
   * the legend's split, so a row never names a series the plot no longer draws. */
  rows?: (
    d: T,
    ctx: { visible: readonly ChartSeries<T>[]; hidden: readonly ChartSeries<T>[] },
  ) => readonly ChartTooltipRow[]
  /** Show this chart's tooltip while it FOLLOWS a sibling's cursor. Default `false`: only the chart
   * under the pointer or keyboard focus shows a tooltip and a live region. */
  onFollow?: boolean
}

export type ChartLegendConfig = {
  /** Default `'bottom'`. `'header'` draws the legend at the top of the chart body, spaced as the
   * enclosing `ChartCard`'s header legend row (in the chart's own markup, so it is in the server
   * HTML and the header never grows); outside a card it is `'top'`. */
  placement?: 'top' | 'bottom' | 'header'
  /** Visually separate roles: series | overlay | reference. */
  groups?: boolean
  /** Clicking an entry hides that series. Default: on whenever there are two or more entries. */
  toggle?: boolean
}

/** A height per container class, `base` below `regular`. A plain number is fixed. */
export type ResponsiveChartHeight = {
  base: number
  regular?: number
  wide?: number
}

/** The three "nothing to draw" states, pending → error → empty. */
export type ChartState = {
  pending?: boolean
  /** Truthy = the query failed; an `Error`'s message is the label. */
  error?: unknown
  /** `true`, or the empty label itself. The label is the one way to say WHY (`'No runs match the
   * filter'` vs `'No runs yet'`): § 9 fixes the state shape, so there is no reason field. */
  empty?: boolean | string
}

/** A row of `plot.rows(key)`: one per datum, `y: null` kept as a gap. */
export type PlotRow<T, X extends ChartX = ChartX> = {
  x: X
  y: number | null
  series: string
  datum: T
}

/** What `CartesianChart`'s `marks` receives. */
export type PlotContext<T, X extends ChartX = ChartX> = {
  /** One row per datum for a VISIBLE series; a hidden series returns `[]`, so a legend toggle hides
   * the mark, its tooltip row and its share of the auto domain together. */
  rows: (key: string) => PlotRow<T, X>[]
  /** `series` minus what the legend toggled off. */
  visible: readonly ChartSeries<T>[]
  /** The legend entry under the pointer, for emphasis; `null` when none. */
  highlighted: string | null
  /** The measured container class (`regular` on the server). */
  containerClass: ContainerClass
  /** The chart's size in px, for a kind that lays out labels against the plot. */
  width: number
  height: number
  /** Bind a mark to the right axis with `yScale: plot.y2` (present only with a `y2` config). */
  y2: 'y2' | undefined
  /** The resolved y domain (and the right axis', with `y2`): basalt's, never the engine's. */
  yDomain: readonly [number, number]
  y2Domain: readonly [number, number] | undefined
}

/** The marks a `marks` function returns: TanStack marks from the allowed `@tanstack/charts/*`
 * subpaths (V2-SPEC § 9.8). basalt re-exports none. */
export type ChartMarks = StoredChartSpec['marks']

export type CartesianChartProps<T, X extends ChartX = ChartX> = BasaltProps & {
  /** The accessible name. Required: a chart without one is an unlabeled image. */
  ariaLabel: string
  data: readonly T[]
  x: (d: T) => X
  series: readonly ChartSeries<T>[]
  /** The plot's marks. Draw `plot.rows(key)` / `plot.visible`, never `series` directly. */
  marks: (plot: PlotContext<T, X>) => ChartMarks
  y?: AxisConfig<T>
  /** A right axis; series with `axis: 'right'` and marks bound to `plot.y2` read it. */
  y2?: AxisConfig<T>
  /** A tick count, or the exact x tick values. Default: by container class. */
  xTicks?: number | readonly X[]
  /** Tick label for an x value. Default: `DD.MM` for dates, compact numbers, strings verbatim. */
  formatX?: (x: X) => string
  zones?: readonly ZoneSpec[]
  xZones?: readonly XZoneSpec<X>[]
  refLines?: readonly RefLine[]
  /** `false` hides the legend. */
  legend?: ChartLegendConfig | false
  /** Default: the height law (measured width × class ratio, 160–420px, ≤ 45vh on touch). */
  height?: number | ResponsiveChartHeight
  state?: ChartState
  /** Joins a named cursor group instead of the page-shared default. */
  cursorGroup?: string
  /** Default `'nearest'`. `'leading'` for a series keyed by a bucket's leading edge (a weekly
   * value keyed by its Monday). */
  cursorResolution?: CursorResolution
  tooltip?: ChartTooltipConfig<T, X> | false
}

/** The x channel of a `plot.rows()` row, as an accessor (a field name does not type-check against a
 * generic `X`). */
export const rowX = <T, X extends ChartX>(row: PlotRow<T, X>): X => row.x
