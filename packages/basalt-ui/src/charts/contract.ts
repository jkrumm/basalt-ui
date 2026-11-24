/**
 * Charts contract: the public types of `CartesianChart`, `Sparkline`, `MiniBars` and `ChartCard`.
 * Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/charts-cards-kanban.md
 * section 4 (the `src/charts/contract.ts` block, plus the frame types it names).
 */
import type { FootFacts, FrameHead, FrameState, CardMenu, LegendEntry } from '../core/phase'
import type { BoxSlot, ControlsSlot, Delta, Phase, QueryStateLike, Verdict } from '../core/ports'
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react'

// ---- Frame types ---------------------------------------------------------------------------

// One declaration holds each: `core/phase.ts`, exported from `basalt-ui/cards` alone.

// ---- Series -------------------------------------------------------------------------------

// minimal; concept elides it (one `series.<group>.<key>` pair of the app's `basalt.tokens.ts`)
export type SeriesColor = { light: string; dark: string }

// minimal; concept elides it
export type CurveName = 'monotone' | 'linear' | 'step' | 'stepAfter' | 'stepBefore'

// minimal; concept elides it
export type Marker = { color?: string; label?: string }

// minimal; concept elides it
export type Extent = readonly [number, number]

export type SeriesBase<D> = {
  key: string
  label: string
  color: SeriesColor
  /** Partial data: legend reads unavailable, nothing is drawn, phase stays ready. */
  failed?: boolean
  axis?: 'left' | 'right'
  note?: string
  role?: 'series' | 'overlay' | 'reference'
  legend?: false
  tooltip?: false
  format?: (v: number, d: D) => string
  getMarker?: (d: D) => Marker | null
}

export type Y<D> = { y: (d: D) => number | null }

export type Series<D> = SeriesBase<D> &
  Y<D> &
  (
    | {
        mark: 'line'
        curve?: CurveName
        dash?: boolean
        area?: 'fade'
        weight?: 'quiet' | 'strong'
        gaps?: 'connect'
        parent?: string
      }
    | {
        mark: 'bar'
        stack?: string
        opacity?: (d: D) => number
        /**
         * A value label per bar, placed by the kit at the bar's end (a stack: one total above it)
         * clear of the other labels, the rules and the bars, and dropped by priority where room runs
         * out: highlighted bars last, then the larger values. `true` writes the series `format` (else
         * the y axis `format`); a function writes the text of the value (a stack: the total) and the
         * datum. A zero bar is labelled at the baseline.
         */
        values?: boolean | ((v: number, d: D) => string)
        /**
         * Where `values` writes. `'end'` (the default): at the bar's end, a stack once by its total.
         * `'segment'` on a series of a stack: this series' own value inside its own segment, centred,
         * in the ink read against the segment's fill (a clamped stack: inside the part that is drawn,
         * with the true value); a segment too small for the text drops its label. A stack may carry
         * both: `values` on one series for the total, `values` with `valuesAt: 'segment'` on another.
         * An unstacked bar labels its end either way.
         *
         * @example
         * { key: 'unrated', mark: 'bar', y: (p) => p.unrated, values: true, valuesAt: 'segment' }
         */
        valuesAt?: 'end' | 'segment'
        /**
         * The bars that answer the chart's question: drawn in the brand accent instead of the series
         * color, in the plot and the tooltip, and their value labels drop last. One series stays one
         * legend entry.
         */
        highlight?: (d: D) => boolean
      }
    | {
        mark: 'dot'
        r?: (d: D) => number
        /**
         * Coincident dots move apart along this axis: a dot that would overlap one drawn before it
         * (in data order) moves the least distance, either way, to the nearest free spot inside the
         * plot, and the same data always draws the same layout. The tooltip, the readout and the
         * announcement keep the true value. Name the axis that can take a few pixels without a
         * misread: a whole-number count, or the wider of two spans. Default: dots stay on their
         * values and may overlap.
         *
         * @example
         * { key: 'containers', label: 'Containers', color, mark: 'dot', y: (c) => c.peak, spread: 'x' }
         */
        spread?: 'x' | 'y'
      }
  )

/** No fake series for legends: declared once in `core/phase.ts`, shared with `./cards`. */
export type { LegendEntry }

// ---- Focus and readout (the geometry seam) -------------------------------------------------

/** What a hand-drawn container spreads to be the visualization's one tab stop. */
export type ChartFocusTarget = {
  tabIndex: 0
  role: 'group'
  'aria-roledescription': string
  onKeyDown: (event: KeyboardEvent<Element>) => void
  onBlur: () => void
  onPointerLeave: (event: PointerEvent<Element>) => void
}

/**
 * What a hand-drawn mark spreads: pointing focuses its datum; the data attributes style it, and the
 * kit dims a `data-dimmed` mark itself. `ref` lets a keyboard step scroll the focused mark into view.
 */
export type ChartFocusItem = {
  'data-chart-mark': ''
  'data-focused'?: ''
  'data-dimmed'?: ''
  ref: (element: Element | null) => void
  onPointerEnter: () => void
  onPointerDown: () => void
}

/**
 * What a row of a linked list of groups spreads (one row per `group` name): pointing at it focuses
 * the group's first item; it is marked while any item of its group is focused. Not a tab stop.
 */
export type ChartFocusGroupItem = {
  'data-focused'?: ''
  ref: (element: Element | null) => void
  onPointerEnter: () => void
  onPointerDown: () => void
}

export type ChartFocusOptions<D> = {
  /** The polite announcement for a focused datum: the readout as a sentence. */
  announce: (d: D) => string
  /** Items per row: arrows then move in a grid (Up and Down by a row). Default: one row. */
  columns?: number
  /**
   * The name of a datum's group (a version, a day). PageUp and PageDown then step between groups,
   * and focus entering a group announces its name first. Items of a group are contiguous.
   */
  group?: (d: D) => string
  /**
   * The polite announcement for several items held at once (`focus.hold`, a list row that stands
   * for a window of them), in item order. Default: the first and the last item's announcements,
   * joined by "to".
   */
  announceSpan?: (items: readonly D[]) => string
}

/**
 * One focused datum shared by the marks that dim the rest, the readout a card fact binds to, and
 * the polite live region. Made by `useChartFocus`; passed to a host as `focus`.
 */
export type ChartFocus<D> = {
  readonly items: readonly D[]
  readonly index: number | null
  readonly datum: D | null
  readonly set: (index: number | null) => void
  /**
   * Focuses several items at once, as a pointer does (a list row that stands for a window of them):
   * every one is marked, only the rest dim, and a cartesian host draws the run as one x band. The
   * first in item order becomes `index` and `datum`; one index is `set` of it, none clears.
   */
  readonly hold: (indexes: readonly number[]) => void
  /** The focused items in item order: `[datum]`, every item `hold` set, or none. */
  readonly span: readonly D[]
  /** `rest` while nothing is focused (the total), else `read(datum)`: the first of a held span. */
  readonly readout: <R>(rest: R, read: (d: D) => R) => R
  /** True for every item outside the focused ones while any is focused. */
  readonly dimmed: (d: D) => boolean
  readonly target: ChartFocusTarget
  readonly item: (index: number) => ChartFocusItem
  /** The props of a list row that stands for one group (`options.group`). */
  readonly groupItem: (name: string) => ChartFocusGroupItem
  /**
   * The key of the series emphasised across every x, or `null`. A chart with this `focus` draws it
   * as its legend highlight: that series at full strength, the others dimmed.
   */
  readonly series: string | null
  /** Emphasises one series by key (`null` clears); a chart's legend hover writes it too. */
  readonly setSeries: (key: string | null) => void
  /**
   * The props of a list row that stands for one series of the chart (a key of its `series`):
   * pointing at it emphasises that series, and it is marked while the series is emphasised, from the
   * row, the chart's legend or a table row. Not a tab stop; the list's own pointer leave calls
   * `setSeries(null)`, as `DataTable focusSeries` does.
   */
  readonly seriesItem: (key: string) => ChartFocusGroupItem
  /** The index a key moves the focus to (`null` clears, `undefined` is not ours); hosts step with it. */
  readonly step: (key: string) => number | null | undefined
  /** The polite live region; a host renders it, a hand-drawn container renders it once. */
  readonly live: ReactElement
}

// ---- CartesianChart -----------------------------------------------------------------------

// minimal; concept elides it
export type XConfig<D> = {
  value: (d: D) => number | Date | string
  /** Writes the hover readout, the tooltip title and the x tick labels (unless `tickFormat` is set). */
  format?: (x: number | Date | string) => string
  /**
   * Writes the x tick labels only, so the ticks can be shorter than the readout: `Nov 12` under the
   * axis while the readout names `Wed, Nov 12, 14:00`. Default: `format`, else the span-aware dates.
   */
  tickFormat?: (x: number | Date | string) => string
  domain?: readonly [number | Date, number | Date]
  /** The axis name with its unit, drawn under the ticks. */
  title?: string
  /** `log` is a numeric x on decades; a non-positive row is not drawn. Default `linear`. */
  scale?: 'linear' | 'log'
  /**
   * A number is the most labels; on a band axis they sit at an even stride that keeps the first
   * and the last band. A list labels exactly those values. Overlapping labels still thin.
   */
  ticks?: number | readonly (number | Date | string)[]
}

export type YConfig = {
  /**
   * A fixed `[min, max]`; or `{ floor, ceil, pad }` on the data's extent (the domain always reaches
   * `floor` down and `ceil` up, then `pad` adds that share of the span); or a function of that
   * extent. The extent is what the plot draws: on stacked bars, the stack totals'. A datum past the domain (a capped outlier) is drawn on the plot's edge with an
   * off-scale marker, and its tooltip reads the true value.
   */
  domain?:
    | [number, number]
    | { floor?: number; ceil?: number; pad?: number }
    | ((v: Extent) => Extent)
  gutter?: number
  /** The axis name with its unit, drawn above the ticks. */
  title?: string
  /** Writes the y tick labels (a series' `format` still writes its tooltip value). */
  format?: (v: number) => string
  /**
   * `log` puts the axis on decades for values that span orders of magnitude: ticks fall on 1, 2 and 5
   * times a power of ten (thinned to fit) and go through `format`. Zones, reference lines, the cursor
   * and the tooltip stay in data values. A value of zero or below has no place on it: a dev build
   * throws an error naming the series and the value, a production build skips the point. Bars, areas
   * and stacks need a zero baseline and do not take it (`Bars` does not type it; `CartesianChart`
   * throws in a dev build and draws linear in production). Default `linear`.
   */
  scale?: 'linear' | 'log'
}

// minimal; concept elides it
export type ChartTooltipConfig<D> = {
  formatHeader?: (d: D) => string
  rows?: (d: D) => readonly { label: string; value: string; color?: SeriesColor }[]
}

// minimal; concept elides it
export type ChartZone =
  | { from: number; to: number; fill: string; axis?: 'left' | 'right' }
  /**
   * A band between two x values: numbers (a log axis too), `Date`s, or band keys (both bands
   * covered whole). `y` bounds it on the left axis (default: the plot's height). `label` is a muted
   * caption at the zone's top-start corner, beside the zone when it does not fit inside, dropped
   * when neither spot stays in the plot.
   */
  | {
      axis: 'x'
      from: number | Date | string
      to: number | Date | string
      fill: string
      y?: { from: number; to: number }
      label?: string
    }

// minimal; concept elides it
export type ChartRefLine = {
  color: SeriesColor
  dashed?: boolean
  label?: string
} & (
  | { value: number; axis?: 'left' | 'right' }
  /**
   * A vertical rule at an x: a band key, a number or a Date. On a band axis `at` puts it on the
   * band's leading or trailing edge, between two bars; default `centre`. A continuous x ignores it.
   */
  | { value: number | Date | string; axis: 'x'; at?: 'start' | 'centre' | 'end' }
)

// minimal; concept elides it
export type ChartSelection<D> = { selected: D | null; onSelect: (d: D | null) => void }

// minimal; concept elides it (the argument of `CartesianChart.custom`)
export type ChartPlot<D> = {
  data: readonly D[]
  rows: (key: string) => readonly D[]
  visible: readonly Series<D>[]
  /** The plot area in px; the frame for `chartLabels.place`. The first pass reports the frame. */
  plotWidth: number
  plotHeight: number
  /** An x value's px from the plot's left, on the axis' scale (a band key: its centre); `null` off it. */
  x: (value: number | Date | string) => number | null
  /** A y value's px from the plot's top, on the left axis or the right one. */
  y: (value: number, axis?: 'left' | 'right') => number
  /** The datum the chart's `focus` holds; `null` without one. Dim the rest against it. */
  focused: D | null
}

// minimal; concept elides it. `CartesianChart.custom` is the only way to build it; `lint --stats` counts it.
export type CustomMarks<D> = {
  readonly kind: 'custom-marks'
  readonly build: (plot: ChartPlot<D>) => readonly unknown[]
}

/** The accessible name of a chart, required: `label`. */
export type ChartName = { label: string }

export type CartesianChartBase<D> = {
  data: readonly D[]
  x: XConfig<D>
  y?: YConfig
  series: readonly Series<D>[]
  summary?: string
  table?: boolean
  height?: number | 'fill'
  phase?: Phase | QueryStateLike
  tooltip?: ChartTooltipConfig<D> | false
  zones?: readonly ChartZone[]
  refLines?: readonly ChartRefLine[]
  cursor?: string
  selection?: ChartSelection<D>
  marks?: CustomMarks<D>
  /** Pointer and arrow keys focus a datum of `focus.items`; the rest dims, the readout follows. */
  focus?: ChartFocus<D>
}

export type CartesianChartProps<D> = CartesianChartBase<D> & ChartName

// ---- Sparkline and MiniBars ---------------------------------------------------------------

/**
 * A value, or a value with its name: `label` (a week, a build) names the point in the readout and the
 * announcement, `at` dates it (shown when there is no `label`). A `null` value is a gap.
 */
export type SparkPoint =
  | number
  | null
  | { value: number | null; at?: Date | number | undefined; label?: string | undefined }

export type SparklineBase = {
  points: readonly SparkPoint[]
  height: number | 'fill'
  width?: number
  form?: 'line' | 'area'
  /** A value, the `'mean'`, or a target range: two dashed lines with a faint band between. */
  reference?: number | 'mean' | { min: number; max: number }
  /**
   * The highest value the plot scales to: a point above it is drawn on the top edge with the
   * off-scale caret, so one outlier does not flatten the rest. The readout, the announcement and the
   * summary keep the true value.
   */
  cap?: number | undefined
  /**
   * The label row (start, middle, end). With it the sparkline answers: arrow keys, Home, End or a
   * pointer step a readout naming the point into the middle slot, announce it politely, and dim the
   * line round the point.
   */
  axisLabels?: readonly [string, string, string]
  format?: (v: number) => string
  summary?: string
}

export type SparklineProps = SparklineBase & ChartName

export type MiniBarsProps = Omit<SparklineBase, 'form' | 'reference'> &
  ChartName & {
    highlight?: number | 'last'
  }

// ---- ChartCard panes ----------------------------------------------------------------------

/**
 * One pane of a `ChartCard` stacked on one x (`panes`): its share of the chart box by `weight`
 * (default 1) above a 160 px floor (the `short` box), and the chart, called with `height: 'fill'` so
 * it takes the pane. The card grows its box to hold every pane's floor.
 */
export type ChartPane = {
  /** The pane's share of the box against the others' weights. Default 1. */
  weight?: number | undefined
  chart: BoxSlot
}

// ---- ChartCard ----------------------------------------------------------------------------

/** An `undefined` field is an absent one, so a maybe-value passes straight. */
export type ChartFigure = {
  value: number | string | null
  unit?: string | undefined
  delta?: Delta | undefined
  period?: string | undefined
  /** The period is a time or an id: drawn in the mono face with tabular numerals. */
  periodMono?: boolean | undefined
  status?: Verdict | undefined
}

/** An `undefined` field is an absent one, so a maybe-value passes straight. */
export type ChartCardProps = Omit<FrameState, 'phase'> & {
  /**
   * A `Phase` or the query itself. With a query, `empty` takes effect only once the settled `data` is
   * empty (an empty array, or where `empty.when(data)` says so for a result of another shape), so it can
   * be passed unconditionally; with a `Phase`, `empty` applies whenever it is set.
   */
  phase?: Phase | QueryStateLike | undefined

  figure?: ChartFigure | undefined
  /**
   * The legend row for marks the page draws through the seam, drawn in every phase. With two or
   * more entries each entry toggles the series of the chart in the box that has its `key`, and a
   * double click or a modifier click isolates it, as a chart's own legend does.
   */
  legend?: readonly LegendEntry[] | undefined
  footer?: FootFacts | undefined
  controls?: ControlsSlot<'widget'> | undefined
  menu?: CardMenu | undefined
  /**
   * The chart box: `auto` (default) half the card width between 192 and 420 px; `tall` the same
   * with a 288 px floor, for the chart that answers the page and needs its axis at 390; `short`
   * 160 px; `fill` the card's remainder in a parent that sets the height. Each is a floor: in a grid
   * row the card takes the row's height and the box grows into it, so the cards of a row end level.
   */
  height?: 'auto' | 'tall' | 'short' | 'fill' | undefined
  /**
   * Runs the plot to the card's edges on any size: the chart box leaves the inset's side padding, so it is as
   * wide as the card, and the inset drops its gutter and rounded sides to stay one surface under it. The
   * figure, the legend and the footer keep the card's edge. A phone card whose plot answers the page
   * (a trend, a long series) takes it for the 12 px each side it gives back.
   *
   * @default false
   */
  bleed?: boolean | undefined
} & (
    | (FrameHead & { chart: BoxSlot; panes?: undefined })
    /**
     * Charts stacked on one x share the chart box: each pane takes its share by `weight` above a
     * 160 px floor, 4 px apart, and the box grows to hold the floors, so no pane and no page states a
     * pixel height at any width.
     */
    | (FrameHead & { panes: readonly ChartPane[]; chart?: undefined })
    /** A Suspense fallback. */
    | (Partial<FrameHead> & { phase: 'loading'; chart?: undefined; panes?: undefined })
  )
