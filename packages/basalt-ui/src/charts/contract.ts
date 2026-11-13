/**
 * Charts contract: the public types of `CartesianChart`, `Sparkline`, `MiniBars` and `ChartCard`.
 * Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/charts-cards-kanban.md
 * section 4 (the `src/charts/contract.ts` block, plus the frame types it names).
 */
import type {
  BoxSlot,
  ControlsSlot,
  Delta,
  IconComponent,
  Phase,
  QueryStateLike,
  Status,
} from '../core/ports'
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react'

// ---- Frame types the sketch files under ports (absent from ports.ts) ----------------------

// minimal; concept elides it
export type CardAction = { label: string } & ({ href: string } | { onSelect: () => void })

/** No-results under active filters renders Clear filters. */
export type Empty = { cause: string; action?: CardAction; filtered?: { reset: () => void } }

/** `empty` wins once the query settled; `data-phase` prints the result. */
export type FrameState = { phase?: Phase | QueryStateLike; empty?: Empty | null }

export type Fact = { label: string; value: string | number }

/** Capped at 2; `null` drops one. */
export type FootFacts = readonly [Fact | null, (Fact | null)?]

export type FrameHead = { title: string; subtitle?: string; icon?: IconComponent; info?: string }

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
    | { mark: 'bar'; stack?: string; opacity?: (d: D) => number }
    | { mark: 'dot'; r?: (d: D) => number }
  )

/** No fake series for legends. */
export type LegendEntry = {
  key: string
  label: string
  color: SeriesColor
  /** `dot` is a filled dot, `ring` a hollow one; a `mark: 'dot'` series legends as `dot`. */
  swatch?: 'solid' | 'dashed' | 'dot' | 'ring'
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

/** What a hand-drawn mark spreads: pointing focuses its datum; the data attributes style it. */
export type ChartFocusItem = {
  'data-focused'?: ''
  'data-dimmed'?: ''
  onPointerEnter: () => void
  onPointerDown: () => void
}

export type ChartFocusOptions<D> = {
  /** The polite announcement for a focused datum: the readout as a sentence. */
  announce: (d: D) => string
  /** Items per row: arrows then move in a grid (Up and Down by a row). Default: one row. */
  columns?: number
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
  /** `rest` while nothing is focused (the total), else `read(datum)`. */
  readonly readout: <R>(rest: R, read: (d: D) => R) => R
  /** True for every item but the focused one while one is focused. */
  readonly dimmed: (d: D) => boolean
  readonly target: ChartFocusTarget
  readonly item: (index: number) => ChartFocusItem
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
}

export type YConfig = {
  domain?:
    | [number, number]
    | { floor?: number; ceil?: number; pad?: number }
    | ((v: Extent) => Extent)
  gutter?: number
  /** The axis name with its unit, drawn above the ticks. */
  title?: string
}

// minimal; concept elides it
export type ChartTooltipConfig<D> = {
  formatHeader?: (d: D) => string
  rows?: (d: D) => readonly { label: string; value: string; color?: SeriesColor }[]
}

// minimal; concept elides it
export type ChartZone = { from: number; to: number; fill: string; axis?: 'left' | 'right' }

// minimal; concept elides it
export type ChartRefLine = {
  color: SeriesColor
  dashed?: boolean
  label?: string
} & (
  | { value: number; axis?: 'left' | 'right' }
  /** A vertical rule at an x: a band key, a number or a Date. */
  | { value: number | Date | string; axis: 'x' }
)

// minimal; concept elides it
export type ChartSelection<D> = { selected: D | null; onSelect: (d: D | null) => void }

// minimal; concept elides it (the argument of `CartesianChart.custom`)
export type ChartPlot<D> = {
  data: readonly D[]
  rows: (key: string) => readonly D[]
  visible: readonly Series<D>[]
  plotHeight: number
  /** The datum the chart's `focus` holds; `null` without one. Dim the rest against it. */
  focused: D | null
}

// minimal; concept elides it. `CartesianChart.custom` is the only way to build it; `lint --stats` counts it.
export type CustomMarks<D> = {
  readonly kind: 'custom-marks'
  readonly build: (plot: ChartPlot<D>) => readonly unknown[]
}

export type CartesianChartProps<D> = {
  data: readonly D[]
  x: XConfig<D>
  y?: YConfig
  series: readonly Series<D>[]
  ariaLabel: string
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

// ---- Sparkline and MiniBars ---------------------------------------------------------------

export type SparkPoint = number | null | { at: Date | number; value: number | null }

export type SparklineProps = {
  series: readonly SparkPoint[]
  ariaLabel: string
  height: number | 'fill'
  width?: number
  form?: 'line' | 'area'
  reference?: number | 'mean'
  axisLabels?: readonly [string, string, string]
  format?: (v: number) => string
  summary?: string
}

export type MiniBarsProps = Omit<SparklineProps, 'form' | 'reference'> & {
  highlight?: number | 'last'
}

// ---- ChartCard ----------------------------------------------------------------------------

export type ChartFigure = {
  value: number | string | null
  unit?: string
  delta?: Delta
  period?: string
  status?: Status
}

export type ChartCardProps = FrameState & {
  figure?: ChartFigure
  footer?: FootFacts
  controls?: ControlsSlot<'widget'>
  menu?: BoxSlot
  height?: 'auto' | 'short' | 'fill'
} & (
    | (FrameHead & { chart: BoxSlot })
    /** A Suspense fallback. */
    | (Partial<FrameHead> & { phase: 'loading'; chart?: undefined })
  )
