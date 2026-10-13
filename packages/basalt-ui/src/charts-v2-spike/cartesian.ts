import { crosshair, rect, ruleY } from '@tanstack/charts'
import type { ChartMark } from '@tanstack/charts'
import type {
  ChartBuildContext,
  ResponsiveChartDefinition,
  StoredChartSpec,
} from '@tanstack/charts/types/core'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import { scaleLog, scaleUtc } from 'd3-scale'
import { cursorBinding, sourceOnlyFocus } from './cursor'
import type { CursorResolution } from './cursor'
import { CHART_THEME } from './theme-bridge'

/** A plotted series — the single source of truth for color, dash, legend and tooltip row. */
export type Series<T> = {
  key: string
  label: string
  /** A `VX.*` ref (`var(--vx-…)`); never a literal. */
  color: string
  getValue: (d: T) => number | null
  dashed?: boolean
  format?: (v: number) => string
}

/** One long-format row per (datum, series). `y: null` stays in the array: it is a gap. */
export type CartesianRow<T> = { x: Date; y: number | null; series: string; datum: T }

export type AxisSpec = {
  domain?: readonly [number, number]
  format?: (v: number) => string
  log?: boolean
}
export type YZone = { from: number; to: number; fill: string }
export type RefLine = { value: number; color: string; dashed?: boolean }
export type ChartTooltipRow = { label: string; value: string; color?: string }
export type ChartTooltipConfig<T> = {
  /** Data rows appended after the per-series rows (replaces 1.x `TooltipRow`/`extraRows`). */
  rows?: (
    d: T,
    ctx: { visible: readonly Series<T>[]; hidden: readonly Series<T>[] },
  ) => readonly ChartTooltipRow[]
  /** Show this chart's tooltip while it FOLLOWS a sibling's cursor (1.x `onFollow`). */
  onFollow?: boolean
}
/** What a kind's `marks` receives. */
export type PlotContext<T> = { rows: (key: string) => CartesianRow<T>[] }

// The rung is generic over arbitrary TanStack marks; their generics are erased at this seam.
// oxlint-disable-next-line typescript/no-explicit-any -- spike: TanStack's own erased-mark type
type AnyMark = ChartMark<any, any, any, any, any, any, any>

export type CartesianSpec<T> = {
  /** Unique per mounted chart (React `useId`): owns what this chart publishes to the cursor. */
  chartId: string
  data: readonly T[]
  x: (d: T) => Date
  series: readonly Series<T>[]
  y?: AxisSpec
  zones?: readonly YZone[]
  refLines?: readonly RefLine[]
  formatX?: (d: Date) => string
  /** `undefined` joins the shared default cursor; a name isolates a group. */
  cursorGroup?: string
  /** How a sibling's cursor value lands on this chart's x keys. Default `'nearest'`. */
  cursorResolution?: CursorResolution
  /** The kind's marks — the ONLY thing a kind supplies. */
  marks: (plot: PlotContext<T>) => readonly AnyMark[]
  tooltip?: ChartTooltipConfig<T>
}

/**
 * basalt resolves every y domain itself and hands TanStack a CONFIGURED instance: TanStack's
 * factory inference would widen the domain to every scale-contributing mark — zones and ref lines
 * included — and could not see legend-hidden series.
 */
function yScale(axis: AxisSpec | undefined, values: readonly number[]) {
  const domain: [number, number] = axis?.domain
    ? [axis.domain[0], axis.domain[1]]
    : values.length
      ? [Math.min(...values), Math.max(...values)]
      : [0, 1]
  if (axis?.log) return scaleLog().domain(domain)
  const linear = scaleLinear().domain(domain)
  return axis?.domain ? linear : linear.nice()
}

/** Below this measured width the phone tier applies (1.x `VX.phoneChartWidth`). */
export const PHONE_WIDTH = 480
const DASH = '6 4'

/**
 * The composition rung: basalt's spec in, a TanStack definition out. Owns scales, the theme
 * bridge, zones/ref lines, crosshair, grouped focus, the shared cursor, tooltip and the phone
 * tier. TanStack owns margins (measured), layout, focus/keyboard, the tooltip surface and SSR.
 */
// The return type is annotated on purpose: TanStack's inferred definition type names internal
// modules (`dist/scene`, `cursor-host-contract`) and fails declaration emit (TS2883/TS4058).
export type CartesianDefinition<T> = ResponsiveChartDefinition<CartesianRow<T>, Date, number, 'dom'>

export function cartesian<T>(spec: CartesianSpec<T>): CartesianDefinition<T> {
  const seriesBy = new Map(spec.series.map((s) => [s.key, s]))
  const plot: PlotContext<T> = {
    rows: (key) => {
      const s = seriesBy.get(key)
      if (!s) throw new Error(`[basalt] CartesianChart: no series "${key}"`)
      return spec.data.map((d) => ({ x: spec.x(d), y: s.getValue(d), series: s.key, datum: d }))
    },
  }
  const xs = spec.data.map(spec.x)
  const x0 = xs[0]
  const x1 = xs[xs.length - 1]
  const values = spec.series.flatMap((s) =>
    spec.data.map(s.getValue).filter((v): v is number => v !== null && Number.isFinite(v)),
  )
  const y = yScale(spec.y, values)
  const formatY = spec.y?.format ?? ((v: number) => v.toLocaleString('en-US'))
  const formatX = (v: unknown) =>
    v instanceof Date ? (spec.formatX ?? ((d: Date) => d.toISOString().slice(0, 10)))(v) : ''

  // `rect.fill` is a constant, so one decorative rect per zone (no interaction points).
  const underlay: AnyMark[] =
    x0 && x1
      ? (spec.zones ?? []).map((z, i) =>
          decorative(
            rect([z], {
              id: `zone-${i}`,
              x1: () => x0,
              x2: () => x1,
              y1: 'from',
              y2: 'to',
              fill: z.fill,
              inset: 0,
            }),
          ),
        )
      : []
  const overlay: AnyMark[] = (spec.refLines ?? []).map((r, i) =>
    ruleY([r.value], {
      id: `ref-${i}`,
      stroke: r.color,
      strokeOpacity: 1,
      ...(r.dashed && { strokeDasharray: DASH }),
    }),
  )

  return {
    chart: ({ width }: ChartBuildContext): StoredChartSpec => {
      const phone = width < PHONE_WIDTH
      return {
        marks: [
          ...underlay,
          ...spec.marks(plot),
          ...overlay,
          crosshair({ x: true, y: false, strokeDasharray: '3 3' }),
        ],
        scales: {
          x: {
            scale: scaleUtc,
            axis: {
              ticks: {
                count: phone ? 3 : 6,
                ...(spec.formatX && { format: spec.formatX }),
              },
              line: { strokeOpacity: 1 },
              tickLabels: { fontSize: phone ? 10 : 11, thin: true, opacity: 1 },
            },
          },
          y: {
            scale: y,
            grid: { strokeDasharray: '2 3', strokeOpacity: 1 },
            axis: {
              line: false,
              ticks: { count: phone ? 3 : 5, format: formatY, line: false },
              tickLabels: { fontSize: phone ? 10 : 11, opacity: 1 },
            },
          },
        },
        theme: CHART_THEME,
        clip: true,
      }
    },
    // Followers draw the crosshair only, unless the chart opts into following tooltips.
    focus: spec.tooltip?.onFollow ? 'group-x' : sourceOnlyFocus(spec.cursorGroup, spec.chartId),
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: cursorBinding(spec.cursorGroup, spec.chartId, xs, spec.cursorResolution ?? 'nearest'),
    tooltip: {
      use: tooltip,
      portal,
      anchor: 'group-center',
      // Structured rows: heading = the formatted x, one row per series with its own formatter.
      content: (points) => {
        const series = points.flatMap((p) => {
          const s = seriesBy.get(String(p.groupLabel))
          const v = p.yValue
          if (!s || typeof v !== 'number') return []
          return [{ label: s.label, value: (s.format ?? formatY)(v), color: s.color }]
        })
        // ...then the consumer's data rows (spike: nothing is hidden, there is no legend yet).
        const d = (points[0]?.datum as CartesianRow<T> | undefined)?.datum
        const extra = d ? (spec.tooltip?.rows?.(d, { visible: spec.series, hidden: [] }) ?? []) : []
        return { title: formatX(points[0]?.xValue), rows: [...series, ...extra] }
      },
    },
  }
}
