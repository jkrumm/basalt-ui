import { curveMonotoneX } from '@visx/curve'
import { AreaClosed, LinePath } from '@visx/shape'
import { Threshold } from '@visx/threshold'
import { memo, useMemo } from 'react'
import type { CursorResolution } from '../cursor/resolve'
import { AreaGradient, areaFillUrl } from '../primitives/AreaGradient'
import type { CartesianTooltipConfig, AxisConfig, PlotContext } from '../primitives/CartesianChart'
import { CartesianChart } from '../primitives/CartesianChart'
import type { XZoneSpec } from '../primitives/XZoneRects'
import type { ZoneSpec } from '../primitives/ZoneRects'
import { definedOn, LINE_OVERLAY_STROKE_WIDTH, toPlotPoint } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { VX } from '../../tokens'

/** @deprecated Use ZoneSpec from primitives/ZoneRects. Kept as an alias for back-compat. */
export type ZonedLineZone = ZoneSpec

/** Semi-transparent fill above (or below) a threshold value, tracking the line. */
export type ZonedLineThreshold = {
  value: number
  side: 'above' | 'below'
  fill: string
}

/** Dashed horizontal reference line — visual annotation only, no fill. */
export type ZonedLineRefLine = {
  value: number
  color: string
  /** Solid by default; set true for a dashed line. */
  dashed?: boolean
}

export type ZonedLineProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to `CartesianChart`. Default 240. */
  height?: number
  chartId: string
  /** Extracts the x-axis category (date string) from a data point. */
  getX: (d: T) => string
  /** Single-series line — the sole source of truth for color, dash, legend, and tooltip row. Pass
   * exactly one entry (kept as an array for parity with the other kinds and so `CartesianChart` /
   * `deriveLegend` / `deriveTooltipRows` can consume it directly). */
  series: ChartSeries<T>[]
  /** Y-axis. Collapses the old `yDomain` / `yAutoMaxFloor` / `yAutoMinCeil` / `yAutoPad` /
   * `numTicksY` / `formatYTick` prop soup into one object. */
  y?: AxisConfig<T>
  zones?: ZonedLineZone[]
  /** Vertical x-range overlays (time windows), rendered behind the line. Bounds are `getX`
   * domain keys. */
  xZones?: XZoneSpec[]
  thresholds?: ZonedLineThreshold[]
  refLines?: ZonedLineRefLine[]
  /** Exact number of x ticks. Default: as many as fit. Ignored when `xTickValues` is set. */
  xTicks?: number
  /** Which domain keys get a tick, from the full key list and the resolved plot width. Takes
   * precedence over `xTicks` — see `CartesianChartProps.xTickValues` for why a count is not
   * always enough. */
  xTickValues?: (keys: readonly string[], xMax: number) => readonly string[]
  /** X tick label formatter. Default `fmtAxisDate` (DD.MM). */
  formatX?: (key: string) => string
  /** Tilt the x tick labels 45° or 90° — see `CartesianChartProps.xLabelRotate`. */
  xLabelRotate?: 45 | 90
  /**
   * How a sibling chart's broadcast cursor key resolves against this chart's points. Default
   * `'nearest'`. Pass `'leading'` when `getX` returns a bucket's leading edge (a weekly series
   * keyed by its Monday) — see `CursorResolution`.
   */
  cursorResolution?: CursorResolution
  /** Tooltip config — `label` for a right-aligned header badge (e.g. zone name with zone color),
   * `extraRows` for rows appended after the derived row. `false` disables the tooltip entirely. */
  tooltip?: CartesianTooltipConfig<T> | false
  /**
   * Opt-in soft gradient fill under the line. Pass a color token to tint the area
   * with that hue — the modern single-hue look. `true` falls back to the series color. Off by
   * default (a neutral fill under the neutral line just reads as grey haze). Strength is global
   * via `--vx-area-top` / `--vx-area-bottom` (tunable in the dev theme lab).
   */
  areaFill?: string | boolean
  /** Legend config forwarded to `CartesianChart`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded to `CartesianChart` as `aria-label` (+ `role="group"`). */
  ariaLabel?: string
  /** Forwarded to `CartesianChart` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
}

type Pt<T> = T & { __y: number | null }

/**
 * Every row, in x order, with `__y: null` where the series reports no value. The null row STAYS in
 * the array — see `MultiLine`'s `seriesPoints`: dropping it makes `LinePath`/`AreaClosed`/
 * `Threshold` join straight across a coverage hole, drawing a measurement that was never taken.
 * The shared `defined` guard below is what turns it back into a gap.
 */
function linePoints<T>(series: ChartSeries<T> | undefined, data: readonly T[]): Pt<T>[] {
  if (!series) return []
  return data.map((d) => Object.assign({}, d, { __y: toPlotPoint(series.getValue(d)) }) as Pt<T>)
}

/**
 * Single-series line chart with zone backgrounds, threshold fills, an optional area gradient,
 * reference lines, and a shared-cursor tooltip. Covers the line-with-zones pattern. Does NOT
 * handle dual-panel charts (keep those bespoke).
 *
 * Composes `CartesianChart` for measuring, scales, grid, zones/x-zones, axes, the shared cursor,
 * and the derived tooltip — this kind draws ONLY the marks (thresholds, area fill, and the line).
 * Single-series, so the legend is optional in practice but present by default.
 *
 * X-axis is built from the full `data` array so the calendar is preserved even when the series has
 * nulls; the line, the area fill and the threshold fills all BREAK at a null point, leaving a real
 * gap rather than interpolating across it.
 */
function ZonedLineInner<T>(props: ZonedLineProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    y,
    zones,
    xZones,
    thresholds,
    refLines,
    xTicks,
    xTickValues,
    formatX,
    xLabelRotate,
    cursorResolution,
    tooltip,
    areaFill,
    height,
    legend,
    ariaLabel,
    isPending,
  } = props

  // Default the line overlay to the redesign's 1.9px stroke (docs/DESIGN-SPEC.md §5) — applied
  // once here so the plotted line, the derived legend swatch, and the derived tooltip row agree.
  const styledSeries = useMemo<ChartSeries<T>[]>(
    () =>
      series.map((s) => ({
        ...s,
        strokeWidth: s.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH,
      })),
    [series],
  )

  return (
    <CartesianChart
      data={data}
      chartId={chartId}
      getX={getX}
      series={styledSeries}
      {...(y !== undefined && { y })}
      {...(zones !== undefined && { zones })}
      {...(xZones !== undefined && { xZones })}
      {...(refLines !== undefined && { refLines })}
      {...(xTicks !== undefined && { xTicks })}
      {...(xTickValues !== undefined && { xTickValues })}
      {...(formatX !== undefined && { formatX })}
      {...(xLabelRotate !== undefined && { xLabelRotate })}
      {...(cursorResolution !== undefined && { cursorResolution })}
      {...(tooltip !== undefined && { tooltip })}
      {...(height !== undefined && { height })}
      {...(legend !== undefined && { legend })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
    >
      {(ctx: PlotContext<T>) => (
        <ZonedLineMarks
          getX={getX}
          chartId={chartId}
          thresholds={thresholds ?? []}
          areaFill={areaFill}
          ctx={ctx}
        />
      )}
    </CartesianChart>
  )
}

/** Draws the threshold fills, the optional area gradient, and the line for the (single) visible
 * series. Hidden via the legend toggle draws nothing, same as every other kind. */
function ZonedLineMarks<T>({
  getX,
  chartId,
  thresholds,
  areaFill,
  ctx,
}: {
  getX: (d: T) => string
  chartId: string
  thresholds: ZonedLineThreshold[]
  areaFill: string | boolean | undefined
  ctx: PlotContext<T>
}) {
  const { data, visible, xScale, yScale, yMax } = ctx
  const primary = visible[0]
  // Memoized: the shared cursor re-renders every chart on every pointer frame, and this both
  // walks the full series and clones an object per point.
  const pts = useMemo(() => linePoints(primary, data), [primary, data])

  // ONE guard for all three shapes below, covering two absences. A null value is a documented GAP
  // (`ChartSeries.getValue`), and a non-positive value on a log axis maps to NaN via `yScale` —
  // without `defined` the first is drawn as an interpolated straight line across a coverage hole
  // and the second emits a NaN path command, which per SVG error handling blanks the ENTIRE path
  // from that point on.
  const defined = definedOn(yScale)
  // Never reached with a null `__y`: d3's line/area generators call the position accessors only
  // for points `defined` accepted. The `NaN` floor is a type-level one, and it can never paint at
  // zero the way a `?? 0` would.
  const yOf = (d: Pt<T>) => yScale(d.__y ?? NaN)

  // Area is opt-in: pass a color token to get a cohesive single-hue fill under the line.
  // (A neutral fill under the neutral line just reads as grey haze, so there is no default-on.)
  const showArea = areaFill !== undefined && areaFill !== false
  const areaColor = typeof areaFill === 'string' ? areaFill : primary?.color
  const areaId = `${chartId}-area`

  return (
    <>
      {thresholds.map((t, i) => (
        <Threshold<Pt<T>>
          key={`thr-${i}`}
          id={`${chartId}-thr-${i}`}
          data={pts}
          defined={defined}
          x={(d) => xScale(getX(d)) ?? 0}
          y0={() => yScale(t.value)}
          y1={yOf}
          clipAboveTo={0}
          clipBelowTo={yMax}
          curve={curveMonotoneX}
          belowAreaProps={{ fill: t.side === 'above' ? t.fill : 'transparent' }}
          aboveAreaProps={{ fill: t.side === 'below' ? t.fill : 'transparent' }}
        />
      ))}

      {showArea && areaColor !== undefined && (
        <>
          <defs>
            <AreaGradient id={areaId} color={areaColor} />
          </defs>
          <AreaClosed<Pt<T>>
            data={pts}
            defined={defined}
            x={(d) => xScale(getX(d)) ?? 0}
            y={yOf}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={areaFillUrl(areaId)}
          />
        </>
      )}

      {primary && (
        <LinePath<Pt<T>>
          data={pts}
          defined={defined}
          x={(d) => xScale(getX(d)) ?? 0}
          y={yOf}
          stroke={primary.color}
          strokeWidth={primary.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH}
          strokeDasharray={primary.dash === 'dashed' ? VX.dashArray : undefined}
          strokeOpacity={primary.strokeOpacity ?? 1}
          curve={curveMonotoneX}
        />
      )}
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot ZonedLine kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with Bars).
 */
export const ZonedLine = memo(ZonedLineInner) as typeof ZonedLineInner
