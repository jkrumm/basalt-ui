import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import { Threshold } from '@visx/threshold'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import { AreaGradient, areaFillUrl } from '../primitives/AreaGradient'
import { AxisBottomDate, AxisLeftNumeric } from '../primitives/Axes'
import {
  ChartTooltip,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
  useTooltipStyles,
} from '../primitives/ChartTooltip'
import { ChartFrame, resolveLegend } from '../primitives/ChartFrame'
import { Crosshair, SeriesDot } from '../primitives/Crosshair'
import { HoverOverlay } from '../primitives/HoverOverlay'
import { ZoneRects } from '../primitives/ZoneRects'
import type { ZoneSpec } from '../primitives/ZoneRects'
import { useHoverSync } from '../hooks/useHoverSync'
import { deriveTooltipRows } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { VX } from '../../tokens'
import { smartTicks, smartTicksEvery } from '../utils/ticks'

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

export type ZonedLineTooltipLabel = {
  text: string
  color: string
}

export type ZonedLineProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  chartId: string
  /** Extracts the x-axis category (date string) from a data point. */
  getX: (d: T) => string
  /** Single-series line — the sole source of truth for color, dash, legend, and tooltip row. Pass
   * exactly one entry (kept as an array for parity with the other kinds and so `ChartFrame` /
   * `deriveLegend` / `deriveTooltipRows` can consume it directly). */
  series: ChartSeries<T>[]
  /** Fixed y-domain (e.g. [0, 100]) or 'auto' to compute from data. */
  yDomain: [number, number] | 'auto'
  /**
   * When yDomain is 'auto': the upper bound is at least this value (caps data max).
   * e.g. yAutoMaxFloor=2 guarantees the y-axis always reaches 2 even if data is smaller.
   */
  yAutoMaxFloor?: number
  /**
   * When yDomain is 'auto': the lower bound is at most this value.
   * Default 0 — always includes zero when data is all positive. Pass a negative
   * number (or Infinity to disable) for metrics that can legitimately swing both ways.
   */
  yAutoMinCeil?: number
  /** Padding multiplier applied to auto-computed bounds (away from zero). Default 1.1. */
  yAutoPad?: number
  zones?: ZonedLineZone[]
  thresholds?: ZonedLineThreshold[]
  refLines?: ZonedLineRefLine[]
  numTicksY?: number
  numTicksX?: number
  /** Label shown at the right of the tooltip header (e.g. zone name with zone color). */
  tooltipLabel?: (d: T) => ZonedLineTooltipLabel | null
  /** Formatter for the tooltip value. */
  formatValue: (v: number) => string
  /** Optional extra tooltip rows (rendered after the main row). */
  renderExtraTooltipRows?: (d: T) => ReactNode
  /**
   * Opt-in soft gradient fill under the line. Pass a color token to tint the area
   * with that hue — the modern single-hue look. `true` falls back to the series color. Off by
   * default (a neutral fill under the neutral line just reads as grey haze). Strength is global
   * via `--vx-area-top` / `--vx-area-bottom` (tunable in the dev theme lab).
   */
  areaFill?: string | boolean
  /** Legend config forwarded to `ChartFrame`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
}

/**
 * Line chart with zone backgrounds, threshold fills, reference lines, and a
 * shared-cursor tooltip. Covers the line-with-zones pattern. Does NOT handle
 * dual-panel charts (keep those bespoke).
 *
 * Composes `ChartFrame` for measuring + the derived legend — single-series, so the legend is
 * optional in practice but present by default (gained relative to the pre-redesign kind).
 *
 * X-axis is built from the full `data` array so the calendar is preserved even
 * when the series has nulls; the line itself skips null points (creating
 * visual gaps).
 */
function ZonedLineInner<T>(props: ZonedLineProps<T>) {
  const { series, chartId, height, legend } = props

  return (
    <ChartFrame
      series={series}
      chartId={chartId}
      {...(height !== undefined && { height })}
      legend={resolveLegend(legend)}
    >
      {(plot) => <ZonedLinePlot {...props} plot={plot} />}
    </ChartFrame>
  )
}

type ZonedLinePlotProps<T> = ZonedLineProps<T> & {
  plot: { width: number; height: number }
}

/** The measured plot — split from {@link ZonedLineInner} so its scale/hover-sync hooks only run
 * once `ChartFrame` has resolved a non-empty plot rect. */
function ZonedLinePlot<T>(props: ZonedLinePlotProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    yDomain,
    yAutoPad = 1.1,
    yAutoMaxFloor,
    yAutoMinCeil = 0,
    zones = [],
    thresholds = [],
    refLines = [],
    numTicksY = 5,
    numTicksX,
    tooltipLabel,
    formatValue,
    renderExtraTooltipRows,
    areaFill,
    plot,
  } = props

  const primary = series[0]
  const MARGIN = VX.margin
  const xMax = plot.width - MARGIN.left - MARGIN.right
  const yMax = plot.height - MARGIN.top - MARGIN.bottom

  // Area is opt-in: pass a color token to get a cohesive single-hue fill under the line.
  // (A neutral fill under the neutral line just reads as grey haze, so there is no default-on.)
  const showArea = areaFill !== undefined && areaFill !== false
  const areaColor = typeof areaFill === 'string' ? areaFill : primary?.color
  const areaId = `${chartId}-area`

  type Valid = T & { __y: number }
  const valid = useMemo<Valid[]>(() => {
    const out: Valid[] = []
    for (const d of data) {
      const y = primary?.getValue(d) ?? null
      if (y !== null && y !== undefined && !Number.isNaN(y)) {
        out.push(Object.assign({}, d, { __y: y }) as Valid)
      }
    }
    return out
  }, [data, primary])

  const xScale = useMemo(
    () =>
      scalePoint<string>({
        // Full calendar — axis does not compress across nulls.
        domain: data.map(getX),
        range: [0, xMax],
        padding: 0.3,
      }),
    [data, xMax, getX],
  )

  const yScale = useMemo(() => {
    if (yDomain === 'auto') {
      const ys = valid.map((d) => d.__y)
      const dataMax = ys.length ? Math.max(...ys) : 0
      const dataMin = ys.length ? Math.min(...ys) : 0
      const upper = Math.max(dataMax, yAutoMaxFloor ?? dataMax) * yAutoPad
      const lower = Math.min(dataMin, yAutoMinCeil) * yAutoPad
      return scaleLinear<number>({ domain: [lower, upper], range: [yMax, 0], nice: true })
    }
    return scaleLinear<number>({ domain: yDomain, range: [yMax, 0] })
  }, [valid, yDomain, yMax, yAutoPad, yAutoMaxFloor, yAutoMinCeil])

  const tooltipStyles = useTooltipStyles()
  const { tip, tooltipRef, syncedPoint, isDirectHover, handleMouse, handleLeave } =
    useHoverSync<Valid>({
      data: valid,
      chartId,
      getKey: getX,
      xScale,
      marginLeft: MARGIN.left,
    })

  const tickValues = useMemo(
    () =>
      numTicksX ? smartTicksEvery(data.map(getX), numTicksX) : smartTicks(data.map(getX), xMax),
    [data, xMax, getX, numTicksX],
  )

  const tooltipLbl = tip ? (tooltipLabel?.(tip.data) ?? null) : null

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={xMax} stroke={VX.grid} numTicks={numTicksY} />

          <ZoneRects zones={zones} width={xMax} leftScale={yScale} />

          {thresholds.map((t, i) => (
            <Threshold<Valid>
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
              <AreaClosed<Valid>
                data={valid}
                x={(d) => xScale(getX(d)) ?? 0}
                y={(d) => yScale(d.__y)}
                yScale={yScale}
                curve={curveMonotoneX}
                fill={areaFillUrl(areaId)}
              />
            </>
          )}

          {refLines.map((r, i) => (
            <line
              key={`ref-${i}`}
              x1={0}
              x2={xMax}
              y1={yScale(r.value)}
              y2={yScale(r.value)}
              stroke={r.color}
              strokeDasharray={r.dashed ? VX.dashArray : undefined}
            />
          ))}

          {primary && (
            <LinePath<Valid>
              data={valid}
              x={(d) => xScale(getX(d)) ?? 0}
              y={(d) => yScale(d.__y)}
              stroke={primary.color}
              strokeWidth={primary.strokeWidth ?? VX.lineWidth}
              strokeDasharray={primary.dash === 'dashed' ? VX.dashArray : undefined}
              curve={curveMonotoneX}
            />
          )}

          {syncedPoint && primary && (
            <>
              <Crosshair x={xScale(getX(syncedPoint)) ?? 0} top={0} bottom={yMax} />
              <SeriesDot
                cx={xScale(getX(syncedPoint)) ?? 0}
                cy={yScale(syncedPoint.__y)}
                color={primary.color}
              />
            </>
          )}

          <AxisLeftNumeric scale={yScale} numTicks={numTicksY} />
          <AxisBottomDate top={yMax} scale={xScale} tickValues={tickValues} />

          <HoverOverlay width={xMax} height={yMax} onMove={handleMouse} onLeave={handleLeave} />
        </Group>
      </svg>
      <ChartTooltip tip={isDirectHover ? tip : null} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && isDirectHover && (
          <>
            <TooltipHeader
              date={getX(tip.data)}
              {...(tooltipLbl !== null && { label: tooltipLbl.text, labelColor: tooltipLbl.color })}
            />
            <TooltipBody>
              {deriveTooltipRows(series, tip.data, formatValue).map((row) => (
                <TooltipRow
                  key={row.key}
                  color={row.color}
                  label={row.label}
                  value={row.value}
                  shape={row.shape}
                  dashed={row.dashed}
                  {...(row.strokeWidth !== undefined && { strokeWidth: row.strokeWidth })}
                />
              ))}
              {renderExtraTooltipRows?.(tip.data)}
            </TooltipBody>
          </>
        )}
      </ChartTooltip>
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot ZonedLine kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with Bars).
 */
export const ZonedLine = memo(ZonedLineInner) as typeof ZonedLineInner
