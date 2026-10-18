/**
 * The public prop vocabulary of `basalt-ui/charts` (`docs/V2-SPEC.md` § 9). React-free and
 * engine-light: the only engine type named here is the mark array `marks` returns.
 */
import type { StoredChartSpec } from '@tanstack/charts/types/core'
import type { BasaltProps } from '../common/props'
import type { ContainerClass } from '../tokens/size-classes'
import type { CurveName } from './curves'
import type { RefLabelPosition } from './ref-label'

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
  mark?: 'line' | 'bar' | 'area' | undefined
  /** Default `'solid'`; `'dashed'` is `VX.dashArray` on the line, the legend and the tooltip. */
  dash?: 'solid' | 'dashed' | undefined
  /** Interpolation between points. Default `'linear'`: discrete values (a daily total, a monthly
   * rate) are joined by straight segments, never by a smoothed curve with crossings between points
   * that never happened. `'monotone'` is an opt-in for a continuous measure; a piecewise-constant
   * quantity (a price tier, a config value) is a step. */
  curve?: CurveName | undefined
  strokeWidth?: number | undefined
  /**
   * What a `null` value does to the line (and its `area`). `'break'` (default) leaves a gap;
   * `'connect'` draws through the series' non-null points only, skipping the null rows, so a series
   * that is null on most shared x values (one lift in a wide table) is one continuous line. Points,
   * markers, the cursor and the tooltip still read real values: a null row has no tooltip row.
   */
  gaps?: 'break' | 'connect' | undefined
  /** Dims the plotted stroke (a faint companion line). Strokes only. */
  strokeOpacity?: number | undefined
  /** Bars and areas. */
  fillOpacity?: number | undefined
  /** `Lines`: a soft gradient fill under the line — `true` in the series color, a color ref, or
   * `'zones'`: a vertical gradient coloured by the chart's `zones` on this series' axis, hard stops
   * at the zone boundaries (no zone in reach: the series color). Linear axes only. */
  area?: boolean | 'zones' | (string & {}) | undefined
  /** Which y axis the series is measured against. `'right'` needs the chart's `y2`. */
  axis?: 'left' | 'right' | undefined
  /** Legend grouping: series → overlay → reference. Default `'series'`. */
  role?: 'series' | 'overlay' | 'reference' | undefined
  /** `false` keeps it out of the legend (a companion line folded under `parent`). Default `true`. */
  legend?: boolean | undefined
  /** `false` draws and legends it but never lists it as a tooltip row. Default `true`. */
  tooltip?: boolean | undefined
  /** A companion (an MA line) names its parent, so a legend toggle and hover keep the pair. */
  parent?: string | undefined
  /** A short qualifier after the label in the legend and the tooltip row, in muted text. */
  note?: string | undefined
  /** Per-series tooltip value format; receives the datum so a row can read more than the value. */
  formatValue?: ((v: number, d: T) => string) | undefined
  /**
   * A cursor dot for a series whose mark the consumer draws itself (`marks`, so `getValue` stays
   * `null`): the y of the dot at each datum, `null` for none. The dot shows while the cursor is on
   * that datum's x and takes the series color, or `getMarker(d).color` when the series has one: the
   * dot follows the datum. A series drawn from `plot.rows` already has one.
   */
  cursorValue?: ((d: T) => number | null) | undefined
  /** A marker at a point (a PR star, a status dot); `null` for none. Always-on markers are `Lines`'
   * alone. On a `CartesianChart` with consumer `marks` only the CURSOR dot of a `cursorValue`
   * series reads `getMarker` (its `color`): without `cursorValue` it is ignored there, so draw a
   * persistent dot in `marks` yourself. Each distinct color of an always-on marker is one extra mark:
   * keep those a small categorical set (statuses, buckets), never a continuous scale. Only the
   * `cursorValue` cursor dot is ONE mark whatever its colors. */
  getMarker?:
    | ((d: T) => {
        color?: string | undefined
        r?: number | undefined
        fillOpacity?: number | undefined
        ring?: boolean | undefined
      } | null)
    | undefined
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
    | undefined
  /** When `'auto'`: the raw upper bound is at least this; padding applies after. */
  autoMaxFloor?: number | undefined
  /** When `'auto'`: the lower bound is at most this. Default `0` (a zero baseline); `Infinity` pads
   * down from the data minimum instead. Ignored on a log axis. */
  autoMinCeil?: number | undefined
  /** When `'auto'`: padding multiplier away from the data. Default `1.1`. */
  autoPad?: number | undefined
  /** A tick count, or the exact tick values. Default: one per ~48px of plot height, ≤ 5. */
  ticks?: number | readonly number[] | undefined
  /** Tick and tooltip formatter. Default: compact numbers (`12.5k`). */
  format?: ((v: number) => string) | undefined
  /** Horizontal grid rules. Default: on for `y`, off for `y2`. */
  grid?: boolean | undefined
  /** Round the domain outward to nice ticks. Default `false` (a fixed domain stays fixed). */
  nice?: boolean | undefined
  /** Default `'linear'`. A log axis floors at the smallest positive visible value. */
  scale?: 'linear' | 'log' | undefined
}

/** A rule along a band's boundary, painted with the band. A bound at the plot edge draws none. */
export type ZoneEdge<S extends string> = {
  side: S | 'both'
  color: string
  dashed?: boolean | undefined
  /** Default `1`. */
  width?: number | undefined
}

/** A horizontal band on one y axis. `±Infinity` reaches the plot edge. */
export type ZoneSpec = {
  from: number
  to: number
  fill: string
  axisSide?: 'left' | 'right' | undefined
  /**
   * Names the band in the legend (its fill as the swatch, a bar by default), so a zone chart keeps
   * a key at 390 and needs no always-`null` series. `mark` is the swatch shape. `color` is the
   * swatch when the fill is a whisper-alpha wash a 10px swatch would lose (default: the fill, a
   * status tint mapped to its solid).
   */
  legend?:
    | { label: string; mark?: 'line' | 'bar' | undefined; color?: string | undefined }
    | undefined
  /** A rule on the band's visual `top` (the larger bound) and/or `bottom` (the smaller), whichever
   * of `from`/`to` that is. */
  edge?: ZoneEdge<'top' | 'bottom'> | undefined
}

/**
 * A vertical band between two x values. An omitted bound is the plot's own edge. `'edge'` widens a
 * present bound by half a sample step, so a band covers its terminal samples in full (a night
 * from one hour to another, both hours included).
 */
export type XZoneSpec<X extends ChartX = ChartX> = {
  from?: X | undefined
  to?: X | undefined
  fill: string
  align?: 'center' | 'edge' | undefined
  /** A rule on the band's `start` (`from`) and/or `end` (`to`) boundary; an omitted bound has none. */
  edge?: ZoneEdge<'start' | 'end'> | undefined
}

/** A horizontal reference line — annotation only, no domain role beyond staying inside the plot. */
export type RefLine = {
  value: number
  color: string
  dashed?: boolean | undefined
  axis?: 'left' | 'right' | undefined
  /**
   * Names the line on the plot: a small muted caption on one of four spots (the plot's end or
   * start, above or below the line). It follows the legend toggle. The ink is `--vx-ink2`, never
   * the line colour.
   */
  label?: string | undefined
  /**
   * Pins the caption's spot. Default: the first spot (the plot's right end above the line; the left
   * end for a right-axis line) that stays inside the plot and that no data line runs through, so a
   * line in the top or bottom quarter, or one a series ends on, moves its caption.
   */
  labelPosition?: RefLabelPosition | undefined
  /**
   * Names the line in the legend (its color, dashed as `dashed`; a toggle hides the line), so a
   * threshold needs no always-`null` series. `mark` is the swatch shape. Default `'line'`. The
   * toggle state is keyed by the line's index in `refLines`: reordering the array while a line is
   * toggled off moves the "off" to whichever line now sits at that index.
   */
  legend?: { label: string; mark?: 'line' | 'bar' | undefined } | undefined
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
  color?: string | undefined
  /** The swatch shape; `'dashed'` for a reference or dashed series. Default `'solid'`. */
  swatch?: 'solid' | 'dashed' | undefined
}

export type ChartTooltipConfig<T, X extends ChartX = ChartX> = {
  /** The tooltip title. Default: a Date x reads weekday, day, month and year in the page locale
   * (`Tue 1 Sep 2026`; a non-day instant adds its time) whatever `formatX` shortens the ticks to;
   * any other x goes through `formatX`. */
  formatHeader?: ((x: X, d: T) => string) | undefined
  /** Rows after the per-series rows (a total, a zone badge, a context line). `visible`/`hidden` are
   * the legend's split, so a row never names a series the plot no longer draws. */
  rows?:
    | ((
        d: T,
        ctx: { visible: readonly ChartSeries<T>[]; hidden: readonly ChartSeries<T>[] },
      ) => readonly ChartTooltipRow[])
    | undefined
  /** Show this chart's tooltip while it FOLLOWS a sibling's cursor. Default `false`: only the chart
   * under the pointer or keyboard focus shows a tooltip and a live region. */
  onFollow?: boolean | undefined
}

export type ChartLegendConfig = {
  /** Default `'bottom'`. `'header'` draws the legend at the top of the chart body, spaced as the
   * enclosing `ChartCard`'s header legend row (in the chart's own markup, so it is in the server
   * HTML and the header never grows); outside a card it is `'top'`. */
  placement?: 'top' | 'bottom' | 'header' | undefined
  /** Visually separate roles: series | overlay | reference. */
  groups?: boolean | undefined
  /** Clicking an entry hides that series. Default: on whenever there are two or more entries. */
  toggle?: boolean | undefined
}

/** A height per container class, `base` below `regular`. A plain number is fixed. */
export type ResponsiveChartHeight = {
  base: number
  regular?: number | undefined
  wide?: number | undefined
}

/** The three "nothing to draw" states, pending → error → empty. */
export type ChartState = {
  pending?: boolean | undefined
  /** Truthy = the query failed; an `Error`'s message is the label. */
  error?: unknown
  /** `true`, or the empty label itself. The label is the one way to say WHY (`'No runs match the
   * filter'` vs `'No runs yet'`): § 9 fixes the state shape, so there is no reason field. */
  empty?: boolean | string | undefined
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
  /** The chart's FRAME in px (plot plus axis gutters), for a kind that lays out labels against it. */
  width: number
  height: number
  /**
   * The plot area in px: the frame less the axis gutters. Pin a mark in pixels with it (a 3 px
   * rail along the top is `yMax - 3 * (yMax - yMin) / plot.plotHeight` down from `yMax`). The
   * engine measures its gutters after `marks` runs, so the first pass (the server HTML, the first
   * client frame) reports the FRAME, one frame-sized draw; the chart then re-renders once with the
   * measured area, and only a chart whose `marks` read these fields pays that render. Every kind,
   * single or composed, reports it the same way.
   */
  plotWidth: number
  plotHeight: number
  /**
   * Every row of `data`, whatever the legend hides: raw datums (`T`), NOT `PlotRow`s. For bucket-level marks only (absent columns,
   * rails: the slot grid must not vanish with its last visible series); a series' own marks still
   * draw `plot.rows(key)` and gate on `plot.visible`.
   */
  data: readonly T[]
  /** Bind a mark to the right axis with `yScale: plot.y2` (present only with a `y2` config). */
  y2: 'y2' | undefined
  /**
   * Where an x value sits in the plot, 0 (left edge) to 1 (right edge), on the SAME x scale the
   * axis draws: an explicit `xDomain` or the extent of every datum. Outside [0, 1] a value is
   * clipped; `null` for a value the scale cannot place.
   */
  xFraction: (x: X) => number | null
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
  y?: AxisConfig<T> | undefined
  /** A right axis; series with `axis: 'right'` and marks bound to `plot.y2` read it. */
  y2?: AxisConfig<T> | undefined
  /** A tick count, or the exact x tick values. Default: by container class. */
  xTicks?: number | readonly X[] | undefined
  /**
   * `[min, max]` of the x scale, in `x`'s type. Default: the data's own extent. Charts given the
   * same domain put the same instant on the same pixel column, whatever their data spans; rows
   * outside it are clipped. A domain that is reversed, flat or not finite falls back to the data
   * extent (and warns in dev). A no-op on a string or band x (`Bars`, `MirroredBars`, `BandStrip`).
   */
  xDomain?: readonly [X, X] | undefined
  /**
   * Tick label for an x value. Default: compact numbers, strings verbatim, and dates by tick step
   * (`HH:MM` with the day on midnight, the day (`4 Oct`, in the page locale), a month with the year on January; a label recurs
   * only behind a day or year label).
   */
  formatX?: ((x: X) => string) | undefined
  zones?: readonly ZoneSpec[] | undefined
  xZones?: readonly XZoneSpec<X>[] | undefined
  refLines?: readonly RefLine[] | undefined
  /** `false` hides the legend. */
  legend?: ChartLegendConfig | false | undefined
  /**
   * Default: the height law (measured width × class ratio, 160–420px, ≤ 45vh on touch). Always the
   * FRAME, in every kind: the plot plus the axis the engine measures. A `BandStrip` band is the
   * frame less the x axis (about 21 px at the default font and density, so `height: 65` for a
   * 44 px band). The box is CSS-owned before any measurement exists, so the plot area is read back
   * from the engine's layout (`PlotContext.plotWidth`/`plotHeight`), never an input.
   */
  height?: number | ResponsiveChartHeight | undefined
  state?: ChartState | undefined
  /** Joins a named cursor group instead of the page-shared default. */
  cursorGroup?: string | undefined
  /** Default `'nearest'`. `'leading'` for a series keyed by a bucket's leading edge (a weekly
   * value keyed by its Monday). */
  cursorResolution?: CursorResolution | undefined
  tooltip?: ChartTooltipConfig<T, X> | false | undefined
}

/** The x channel of a `plot.rows()` row, as an accessor (a field name does not type-check against a
 * generic `X`). */
export const rowX = <T, X extends ChartX>(row: PlotRow<T, X>): X => row.x
