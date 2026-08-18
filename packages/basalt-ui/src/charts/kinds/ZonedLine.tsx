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
import { LINE_OVERLAY_STROKE_WIDTH } from '../series'
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
  /** Exact number of x ticks. Default: as many as fit. */
  xTicks?: number
  /** X tick label formatter. Default `fmtAxisDate` (DD.MM). */
  formatX?: (key: string) => string
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
  /** Accessible text alternative, forwarded to `CartesianChart` as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
  /** Forwarded to `CartesianChart` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
}

type Valid<T> = T & { __y: number }

/** The primary (and only) series' valid points — null values are dropped, creating line gaps. */
function validPoints<T>(series: ChartSeries<T> | undefined, data: readonly T[]): Valid<T>[] {
  if (!series) return []
  const out: Valid<T>[] = []
  for (const d of data) {
    const y = series.getValue(d)
    if (y !== null && y !== undefined && !Number.isNaN(y)) {
      out.push(Object.assign({}, d, { __y: y }) as Valid<T>)
    }
  }
  return out
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
 * X-axis is built from the full `data` array so the calendar is preserved even
 * when the series has nulls; the line itself skips null points (creating
 * visual gaps).
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
    formatX,
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
      {...(formatX !== undefined && { formatX })}
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
  const valid = useMemo(() => validPoints(primary, data), [primary, data])

  // Area is opt-in: pass a color token to get a cohesive single-hue fill under the line.
  // (A neutral fill under the neutral line just reads as grey haze, so there is no default-on.)
  const showArea = areaFill !== undefined && areaFill !== false
  const areaColor = typeof areaFill === 'string' ? areaFill : primary?.color
  const areaId = `${chartId}-area`

  return (
    <>
      {thresholds.map((t, i) => (
        <Threshold<Valid<T>>
          key={`thr-${i}`}
          id={`${chartId}-thr-${i}`}
          data={valid}
          x={(d) => xScale(getX(d)) ?? 0}
          y0={() => yScale(t.value)}
          y1={(d) => yScale(d.__y)}
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
          <AreaClosed<Valid<T>>
            data={valid}
            x={(d) => xScale(getX(d)) ?? 0}
            y={(d) => yScale(d.__y)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={areaFillUrl(areaId)}
          />
        </>
      )}

      {primary && (
        <LinePath<Valid<T>>
          data={valid}
          x={(d) => xScale(getX(d)) ?? 0}
          y={(d) => yScale(d.__y)}
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
