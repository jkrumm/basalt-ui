/**
 * Charts contract: the public types of `CartesianChart`, `Sparkline`, `MiniBars` and `ChartCard`.
 * Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/charts-cards-kanban.md
 * section 4 (the `src/charts/contract.ts` block, plus the frame types it names).
 */
import type { FootFacts, FrameHead, FrameState, CardMenu } from '../core/phase'
import type { BoxSlot, ControlsSlot, Delta, Phase, QueryStateLike, Verdict } from '../core/ports'
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react'

// ---- Frame types ---------------------------------------------------------------------------

// One declaration holds each: `core/phase.ts`, exported from `basalt-ui/cards`. `basalt-ui/charts`
// keeps deprecated aliases for one minor (`charts/index.ts`).

// ---- Series -------------------------------------------------------------------------------

// minimal; concept elides it (a `defineSeries` entry)
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
         * The bars that answer the chart's question: drawn in the brand accent instead of the series
         * colour, in the plot and the tooltip, and their value labels drop last. One series stays one
         * legend entry.
         */
        highlight?: (d: D) => boolean
      }
    | { mark: 'dot'; r?: (d: D) => number }
  )

/** No fake series for legends. */
export type LegendEntry = {
  key: string
  label: string
  color: SeriesColor
  /**
   * `dot` is a filled dot, `ring` a hollow one; a `mark: 'dot'` series legends as `dot`. `bar` is a
   * filled square and `hollow` an outlined one: the keys of marks a page draws through the seam.
   */
  swatch?: 'solid' | 'dashed' | 'dot' | 'ring' | 'bar' | 'hollow'
  failed?: boolean
}

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
  format?: (x: number | Date | string) => string
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
   * extent. A datum past the domain (a capped outlier) is drawn on the plot's edge with an
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

/**
 * The accessible name of a chart, required: `label`. `ariaLabel` is the deprecated name for one minor;
 * a chart takes exactly one of the two.
 */
export type ChartName =
  | { label: string; ariaLabel?: undefined }
  | {
      /** @deprecated Use `label`; removed in the next minor. */ ariaLabel: string
      label?: undefined
    }

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
  series: readonly SparkPoint[]
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
   * A `Phase` or the query itself. With a query, `empty` takes effect only once `data` is an empty
   * array, so it can be passed unconditionally; with a `Phase`, `empty` applies whenever it is set.
   */
  phase?: Phase | QueryStateLike | undefined

  figure?: ChartFigure | undefined
  /** The legend row for marks the page draws through the seam, drawn in every phase. */
  legend?: readonly LegendEntry[] | undefined
  footer?: FootFacts | undefined
  controls?: ControlsSlot<'widget'> | undefined
  menu?: CardMenu | undefined
  height?: 'auto' | 'short' | 'fill' | undefined
} & (
    | (FrameHead & { chart: BoxSlot })
    /** A Suspense fallback. */
    | (Partial<FrameHead> & { phase: 'loading'; chart?: undefined })
  )
