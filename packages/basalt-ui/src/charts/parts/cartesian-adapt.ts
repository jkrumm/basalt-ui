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
} from '../contract'
import { resolvePhase } from '../../core/phase'
import type {
  ChartMarks,
  ChartSeries,
  ChartState,
  ChartX,
  ChartTooltipConfig as EngineTooltip,
  PlotContext,
  RefLine,
  ZoneSpec,
} from '../types'

/** The closed stroke scale: `weight` is the only way to thicken or soften a line. */
export const WEIGHT_WIDTH = { quiet: 1.25, strong: 2.5 } as const

/** A `{ light, dark }` pair as one CSS colour: `light-dark()` follows the page's `color-scheme`. */
export const cssColor = (c: SeriesColor): string => `light-dark(${c.light}, ${c.dark})`

/** The flat series the compiler, legend and tooltip read. */
export function toEngineSeries<D>(s: Series<D>): ChartSeries<D> {
  const base: ChartSeries<D> = {
    key: s.key,
    label: s.label,
    color: cssColor(s.color),
    // A failed series is drawn as nothing: its legend entry stays and reads as unavailable.
    getValue: s.failed === true ? () => null : s.y,
    mark: s.mark === 'bar' ? 'bar' : 'line',
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

export function toEngineZone(z: ChartZone): ZoneSpec {
  return {
    from: z.from,
    to: z.to,
    fill: z.fill,
    ...(z.axis !== undefined && { axisSide: z.axis }),
  }
}

export function toEngineRefLine(r: ChartRefLine): RefLine {
  return {
    value: r.value,
    color: cssColor(r.color),
    ...(r.dashed !== undefined && { dashed: r.dashed }),
    ...(r.label !== undefined && { label: r.label }),
    ...(r.axis !== undefined && { axis: r.axis }),
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

/** `phase` onto the three "nothing to draw" states the placeholders render. */
export function toChartState(phase: CartesianChartProps<unknown>['phase']): ChartState | undefined {
  const resolved = resolvePhase({ phase })
  if (resolved.tag === 'loading') return { pending: true }
  if (resolved.tag === 'error') return { error: resolved.message ?? true }
  return undefined
}

/** The engine-side props of one chart: everything the compiler reads that is not chrome. */
export type EngineSpec<D> = {
  data: readonly D[]
  x: (d: D) => ChartX
  series: readonly ChartSeries<D>[]
  y?: { domain?: readonly [number, number] }
  y2?: Record<string, never>
  xDomain?: readonly [ChartX, ChartX]
  formatX?: (x: ChartX) => string
  zones?: readonly ZoneSpec[]
  refLines?: readonly RefLine[]
  cursorGroup?: string
  tooltip?: EngineTooltip<D> | false
}

const asXDomain = (d: NonNullable<XConfig<unknown>['domain']>): readonly [ChartX, ChartX] => d

/** The v3 props as the engine-side spec, before the seams run. */
export function toEngineSpec<D>(
  props: CartesianChartProps<D>,
  series: readonly Series<D>[] = props.series,
): EngineSpec<D> {
  const { x, y, zones, refLines, cursor, tooltip } = props
  const domain = Array.isArray(y?.domain) ? (y.domain as [number, number]) : undefined
  return {
    data: props.data,
    x: x.value,
    series: series.map(toEngineSeries),
    ...(domain !== undefined && { y: { domain } }),
    // A right-axis series needs the chart's second axis; the v3 props have no `y2` to spell it.
    ...(series.some((s) => s.axis === 'right') && { y2: {} }),
    ...(x.domain !== undefined && { xDomain: asXDomain(x.domain) }),
    ...(x.format !== undefined && { formatX: x.format }),
    ...(zones !== undefined && { zones: zones.map(toEngineZone) }),
    ...(refLines !== undefined && { refLines: refLines.map(toEngineRefLine) }),
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
    plotHeight: plot.plotHeight,
  }
}

export const asMarks = (marks: readonly unknown[]): ChartMarks => marks as ChartMarks
