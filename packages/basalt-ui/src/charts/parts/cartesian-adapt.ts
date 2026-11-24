/**
 * The v3 prop vocabulary (`charts/contract.ts`) in, the engine-side chart spec out. Pure and
 * React-free. v3 `Series` is a union by `mark`; the compiler in `core/compile.ts` reads one flat
 * `ChartSeries`, so this module is the only place the two vocabularies meet.
 */
import type {
  CartesianChartProps,
  ChartRefLine,
  ChartTooltipConfig,
  ChartZone,
  Series,
  SeriesColor,
  XConfig,
  YConfig,
} from '../contract'
import { resolvePhase } from '../../core/phase'
import type { Empty } from '../../core/phase'
import type {
  AxisConfig,
  ChartMarks,
  ChartSeries,
  ChartState,
  ChartX,
  ChartTooltipConfig as EngineTooltip,
  PlotContext,
  RefLine,
  XRefLine,
  XZoneSpec,
  ZoneSpec,
} from '../types'
import { plotScales } from '../seams/plot-scales'

/** The closed stroke scale: `weight` is the only way to thicken or soften a line. */
export const WEIGHT_WIDTH = { quiet: 1.25, strong: 2.5 } as const

/** A `{ light, dark }` pair as one CSS color: `light-dark()` follows the page's `color-scheme`. */
export const cssColor = (c: SeriesColor): string => `light-dark(${c.light}, ${c.dark})`

/** The flat series the compiler, legend and tooltip read. */
export function toEngineSeries<D>(s: Series<D>): ChartSeries<D> {
  const base: ChartSeries<D> = {
    key: s.key,
    label: s.label,
    color: cssColor(s.color),
    // A failed series is drawn as nothing: its legend entry stays and reads as unavailable.
    getValue: s.failed === true ? () => null : s.y,
    mark: s.mark === 'bar' ? 'bar' : s.mark === 'dot' ? 'dot' : 'line',
    ...(s.axis !== undefined && { axis: s.axis }),
    ...(s.role !== undefined && { role: s.role }),
    ...(s.legend === false && { legend: false }),
    ...(s.tooltip === false && { tooltip: false }),
    ...(s.note !== undefined && { note: s.note }),
    ...(s.format !== undefined && { formatValue: s.format }),
    ...(s.getMarker !== undefined && {
      getMarker: (d: D) => {
        const m = s.getMarker?.(d)
        return m?.color === undefined ? (m ? {} : null) : { color: m.color }
      },
    }),
  }
  if (s.failed === true) return { ...base, note: s.note ?? 'unavailable' }
  if (s.mark === 'bar')
    return {
      ...base,
      ...(s.values !== undefined && { values: s.values }),
      ...(s.valuesAt !== undefined && { valuesAt: s.valuesAt }),
      ...(s.highlight !== undefined && { highlight: s.highlight }),
    }
  if (s.mark !== 'line') return base
  return {
    ...base,
    ...(s.curve !== undefined && { curve: s.curve }),
    ...(s.dash === true && { dash: 'dashed' as const }),
    ...(s.area === 'fade' && { area: true }),
    ...(s.weight !== undefined && { strokeWidth: WEIGHT_WIDTH[s.weight] }),
    ...(s.gaps === 'connect' && { gaps: 'connect' as const }),
    ...(s.parent !== undefined && { parent: s.parent }),
  }
}

/** A y band (`axis` left, right or absent). */
export type YZone = Exclude<ChartZone, { axis: 'x' }>
/** An x range (`axis: 'x'`). */
export type XAxisZone = Extract<ChartZone, { axis: 'x' }>

export const isXZone = (z: ChartZone): z is XAxisZone => z.axis === 'x'

export function toEngineZone(z: YZone): ZoneSpec {
  return {
    from: z.from,
    to: z.to,
    fill: z.fill,
    ...(z.axis !== undefined && { axisSide: z.axis }),
  }
}

/** A band key bound covers its band whole; a continuous bound is exact. */
export function toEngineXZone(z: XAxisZone): XZoneSpec {
  const keyed = typeof z.from === 'string' || typeof z.to === 'string'
  return {
    from: z.from,
    to: z.to,
    fill: z.fill,
    ...(keyed && { align: 'edge' as const }),
    ...(z.y !== undefined && { y: z.y }),
    ...(z.label !== undefined && { label: z.label }),
  }
}

/** A horizontal reference line (a y value on the left or right axis). */
export type YRefLine = Extract<ChartRefLine, { axis?: 'left' | 'right' }>
/** A vertical reference rule (`axis: 'x'`). */
export type XAxisRefLine = Extract<ChartRefLine, { axis: 'x' }>

export const isXRefLine = (r: ChartRefLine): r is XAxisRefLine => r.axis === 'x'

export function toEngineRefLine(r: YRefLine): RefLine {
  return {
    value: r.value,
    color: cssColor(r.color),
    ...(r.dashed !== undefined && { dashed: r.dashed }),
    ...(r.label !== undefined && { label: r.label }),
    ...(r.axis !== undefined && { axis: r.axis }),
  }
}

export function toEngineXRefLine(r: XAxisRefLine): XRefLine {
  return {
    x: r.value,
    color: cssColor(r.color),
    ...(r.dashed !== undefined && { dashed: r.dashed }),
    ...(r.label !== undefined && { label: r.label }),
    ...(r.at !== undefined && { at: r.at }),
  }
}

export function toEngineTooltip<D>(t: ChartTooltipConfig<D>): EngineTooltip<D> {
  const { formatHeader, rows } = t
  return {
    ...(formatHeader !== undefined && { formatHeader: (_x: ChartX, d: D) => formatHeader(d) }),
    ...(rows !== undefined && {
      rows: (d: D) =>
        rows(d).map((r) => ({
          label: r.label,
          value: r.value,
          ...(r.color !== undefined && { color: cssColor(r.color) }),
        })),
    }),
  }
}

/** `phase` and `empty` onto the three "nothing to draw" states the placeholders render. */
export function toChartState(
  phase: CartesianChartProps<unknown>['phase'],
  empty?: Empty | null,
): ChartState | undefined {
  const resolved = resolvePhase({ phase, empty })
  if (resolved.tag === 'loading' || resolved.tag === 'offline') return { pending: true }
  if (resolved.tag === 'error') return { error: resolved.message ?? true }
  if (resolved.tag === 'empty') return { empty: resolved.empty.cause }
  return undefined
}

/** The engine-side props of one chart: everything the compiler reads that is not chrome. */
export type EngineSpec<D> = {
  data: readonly D[]
  x: (d: D) => ChartX
  series: readonly ChartSeries<D>[]
  y?: Omit<AxisConfig<D>, 'domain'> & { domain?: readonly [number, number] }
  y2?: Record<string, never>
  xDomain?: readonly [ChartX, ChartX]
  xTitle?: string
  xScale?: 'linear' | 'log'
  xTicks?: number | readonly ChartX[]
  formatX?: (x: ChartX) => string
  formatXTick?: (x: ChartX) => string
  zones?: readonly ZoneSpec[]
  xZones?: readonly XZoneSpec[]
  refLines?: readonly RefLine[]
  xRefLines?: readonly XRefLine[]
  cursorGroup?: string
  tooltip?: EngineTooltip<D> | false
}

/** `YConfig` as the engine axis: a tuple fixes the domain (the object and function forms are the `y.domain` seam's, which writes a tuple). */
function toEngineY<D>(y: YConfig | undefined): EngineSpec<D>['y'] {
  if (y === undefined) return undefined
  const { domain } = y
  const axis: AxisConfig<D> = {
    ...(y.title !== undefined && { title: y.title }),
    ...(y.format !== undefined && { format: y.format }),
    ...(y.scale === 'log' && { scale: 'log' as const }),
    ...(Array.isArray(domain) && { domain: domain as [number, number] }),
  }
  return Object.keys(axis).length === 0 ? undefined : (axis as EngineSpec<D>['y'])
}

const asXDomain = (d: NonNullable<XConfig<unknown>['domain']>): readonly [ChartX, ChartX] => d

/** The v3 props as the engine-side spec, before the seams run. */
export function toEngineSpec<D>(
  props: CartesianChartProps<D>,
  series: readonly Series<D>[] = props.series,
): EngineSpec<D> {
  const { x, y, zones, refLines, cursor, tooltip } = props
  const engineY = toEngineY<D>(y)
  return {
    data: props.data,
    x: x.value,
    series: series.map(toEngineSeries),
    ...(engineY !== undefined && { y: engineY }),
    // A right-axis series needs the chart's second axis; the v3 props have no `y2` to spell it.
    ...(series.some((s) => s.axis === 'right') && { y2: {} }),
    ...(x.domain !== undefined && { xDomain: asXDomain(x.domain) }),
    ...(x.format !== undefined && { formatX: x.format }),
    ...(x.tickFormat !== undefined && { formatXTick: x.tickFormat }),
    ...(x.title !== undefined && { xTitle: x.title }),
    ...(x.scale !== undefined && { xScale: x.scale }),
    ...(x.ticks !== undefined && { xTicks: x.ticks as number | readonly ChartX[] }),
    ...(zones?.some((z) => !isXZone(z)) === true && {
      zones: zones.flatMap((z) => (isXZone(z) ? [] : [toEngineZone(z)])),
    }),
    ...(zones?.some(isXZone) === true && { xZones: zones.filter(isXZone).map(toEngineXZone) }),
    ...(refLines !== undefined && {
      refLines: refLines.flatMap((r) => (isXRefLine(r) ? [] : [toEngineRefLine(r)])),
    }),
    ...(refLines?.some(isXRefLine) === true && {
      xRefLines: refLines.filter(isXRefLine).map(toEngineXRefLine),
    }),
    ...(cursor !== undefined && { cursorGroup: cursor }),
    ...(tooltip !== undefined && { tooltip: tooltip === false ? false : toEngineTooltip(tooltip) }),
  }
}

/** The plot a custom-marks builder sees: datums, not engine rows. */
export function customPlot<D>(
  plot: PlotContext<D, ChartX>,
  byKey: ReadonlyMap<string, Series<D>>,
): Parameters<NonNullable<CartesianChartProps<D>['marks']>['build']>[0] {
  return {
    data: plot.data,
    rows: (key) => plot.rows(key).map((r) => r.datum),
    visible: plot.visible.flatMap((s) => {
      const v3 = byKey.get(s.key)
      return v3 === undefined ? [] : [v3]
    }),
    plotWidth: plot.plotWidth,
    plotHeight: plot.plotHeight,
    x: (value) => {
      const fraction = plot.xFraction(value)
      return fraction === null ? null : fraction * plot.plotWidth
    },
    y: (value, axis) => {
      const yDomain = axis === 'right' ? (plot.y2Domain ?? plot.yDomain) : plot.yDomain
      return plotScales(
        {
          plotWidth: plot.plotWidth,
          plotHeight: plot.plotHeight,
          yDomain,
          ...(axis !== 'right' && plot.yLog === true && { yLog: true }),
        },
        [0, 1],
      ).y(value)
    },
    focused: plot.focused,
  }
}

export const asMarks = (marks: readonly unknown[]): ChartMarks => marks as ChartMarks
