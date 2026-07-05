import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { memo, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AxisBottomDate, AxisLeftNumeric, AxisRightNumeric } from '../primitives/Axes'
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

export type BarsBar = {
  /** Field key — `getValue(d, key)` extracts the number (null = skip this slot, not domain hole). */
  key: string
  /** Tooltip + legend label. */
  label: string
  /** Fill color (a resolved CSS color / token ref). */
  color: string
  /** Per-series tooltip value formatter — overrides top-level formatValue. */
  formatValue?: (v: number) => string
  /** Y axis to plot against. Honored only in grouped layout. Default 'left'. */
  axisSide?: 'left' | 'right'
  /** Relative width within the group (only honored in grouped layout). Default 1 — all bars equal. */
  weight?: number
}

export type BarsLine = {
  key: string
  label: string
  color: string
  axisSide?: 'left' | 'right'
  strokeWidth?: number
  dashed?: boolean
  formatValue?: (v: number) => string
}

/** @deprecated Use ZoneSpec from primitives/ZoneRects. Kept as an alias. */
export type BarsZone = ZoneSpec

export type BarsRefLine = {
  value: number
  color: string
  /** Solid by default; set true for a dashed line. */
  dashed?: boolean
  axisSide?: 'left' | 'right'
}

export type BarsAxisConfig = {
  /** Fixed [min, max] or 'auto' (computed from bars + lines + zones + refLines on this axis). */
  domain: [number, number] | 'auto'
  /** Auto-domain padding multiplier away from zero. Default 1.1. */
  autoPad?: number
  /** Auto-domain lower bound ceiling — never above this. Default 0. */
  autoMinCeil?: number
  /** Auto-domain upper bound floor — never below this. */
  autoMaxFloor?: number
  /** Tick label formatter (e.g. (v) => `${v}h`). */
  formatTick?: (v: number) => string
  /** Number of ticks. Default 5. */
  numTicks?: number
}

export type BarsProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  chartId: string
  getX: (d: T) => string
  /** Generic value accessor — given a data point and a bar/line key, returns the value or null. */
  getValue: (d: T, key: string) => number | null

  /** 1+ bar series, stacked when ≥2, plotted above baseline (y >= 0). */
  positiveBars: BarsBar[]
  /** Optional bar series stacked below baseline (rendered as flipped negatives). */
  negativeBars?: BarsBar[]

  /** 0–2 line overlays, each on left or right axis. */
  lines?: BarsLine[]

  /** Horizontal value-range overlays (target zones, optimal bands). */
  zones?: BarsZone[]
  /** Dashed/solid horizontal reference lines. */
  refLines?: BarsRefLine[]

  /** Left axis config (always present — bars live here). */
  leftAxis: BarsAxisConfig
  /** Right axis config — only required when at least one line/zone/refLine uses 'right'. */
  rightAxis?: BarsAxisConfig

  /** Bar width as fraction of slot width. Default 0.6. */
  barWidthRatio?: number

  /**
   * How multiple positive bars are arranged per x slot.
   * - `stacked` (default): bars stack vertically on the left axis; negativeBars stack below baseline.
   * - `grouped`: bars sit side-by-side within the slot. Each bar honors its own `axisSide`.
   *   negativeBars are ignored in grouped layout.
   */
  barLayout?: 'stacked' | 'grouped'

  /** Per-bar opacity override. Receives the data point + bar key. Default 0.85. */
  barOpacity?: (d: T, key: string) => number

  /** Tooltip badge — appears at the right of the tooltip header. */
  tooltipLabel?: (d: T) => { text: string; color: string } | null
  /** Tooltip rows rendered BEFORE the generated bar/line rows. */
  renderPrefixTooltipRows?: (d: T) => ReactNode
  /** Tooltip rows rendered AFTER the generated bar/line rows. */
  renderExtraTooltipRows?: (d: T) => ReactNode
  /** Skip the auto-generated positive/negative bar rows in the tooltip (chart still renders them). */
  hideBarTooltipRows?: boolean
  /** Default value formatter if a series doesn't define its own. */
  formatValue?: (v: number) => string
  /** X-axis tick count override. */
  numTicksX?: number
  /** Override the left margin (defaults to VX.margin.left = 44). Useful when
   * y-axis labels are unusually wide (e.g. five-digit step counts). */
  marginLeft?: number
  /** Legend config forwarded to `ChartFrame`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
}

/**
 * Bars on a categorical x-axis with optional stacked negative series, 0–2 line
 * overlays on left/right axes, horizontal zones, and reference lines. Covers
 * diverging-stack + bar+line + any future stacked-bar preset.
 *
 * Composes `ChartFrame` for measuring + the derived legend — the legend was previously pushed
 * entirely to the consumer; it is now derived from `positiveBars` + `negativeBars` + `lines` and
 * owns its own hover-dim state (the legend-hover wiring that used to require a consumer-supplied
 * `highlightedKey` prop).
 *
 * X-axis is built from the full `data` array so the calendar is preserved even
 * with per-bar nulls (nulls become visual gaps, not domain holes).
 */
function BarsInner<T>(props: BarsProps<T>) {
  const { positiveBars, negativeBars = [], lines = [], getValue, chartId, height, legend } = props
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)

  const barSeries = useMemo<ChartSeries<T>[]>(
    () =>
      [...positiveBars, ...negativeBars].map((b) => ({
        key: b.key,
        label: b.label,
        color: b.color,
        mark: 'bar' as const,
        fillOpacity: 0.85,
        getValue: (d: T) => getValue(d, b.key),
        ...(b.formatValue !== undefined && { formatValue: b.formatValue }),
      })),
    [positiveBars, negativeBars, getValue],
  )

  const lineSeries = useMemo<ChartSeries<T>[]>(
    () =>
      lines.map((ln) => ({
        key: ln.key,
        label: ln.label,
        color: ln.color,
        mark: 'line' as const,
        dash: ln.dashed ? ('dashed' as const) : ('solid' as const),
        ...(ln.strokeWidth !== undefined && { strokeWidth: ln.strokeWidth }),
        getValue: (d: T) => getValue(d, ln.key),
        ...(ln.formatValue !== undefined && { formatValue: ln.formatValue }),
      })),
    [lines, getValue],
  )

  const legendSeries = useMemo<ChartSeries<T>[]>(
    () => [...barSeries, ...lineSeries],
    [barSeries, lineSeries],
  )

  return (
    <ChartFrame
      series={legendSeries}
      chartId={chartId}
      {...(height !== undefined && { height })}
      legend={resolveLegend(legend, {
        highlighted: highlightedKey,
        onHighlight: setHighlightedKey,
      })}
    >
      {(plot) => (
        <BarsPlot
          {...props}
          plot={plot}
          highlightedKey={highlightedKey}
          barSeries={barSeries}
          lineSeries={lineSeries}
        />
      )}
    </ChartFrame>
  )
}

type BarsPlotProps<T> = BarsProps<T> & {
  plot: { width: number; height: number }
  highlightedKey: string | null
  barSeries: ChartSeries<T>[]
  lineSeries: ChartSeries<T>[]
}

/** The measured plot — split from {@link BarsInner} so its scale/hover-sync hooks only run once
 * `ChartFrame` has resolved a non-empty plot rect. */
function BarsPlot<T>(props: BarsPlotProps<T>) {
  const {
    data,
    chartId,
    getX,
    getValue,
    positiveBars,
    negativeBars = [],
    lines = [],
    zones = [],
    refLines = [],
    leftAxis,
    rightAxis,
    barWidthRatio = 0.6,
    barLayout = 'stacked',
    barOpacity,
    tooltipLabel,
    renderPrefixTooltipRows,
    renderExtraTooltipRows,
    hideBarTooltipRows = false,
    formatValue = (v) => String(Math.round(v)),
    numTicksX,
    marginLeft,
    plot,
    highlightedKey,
    barSeries,
    lineSeries,
  } = props

  const dimOpacity = (key: string): number =>
    highlightedKey === null || highlightedKey === key ? 1 : 0.15

  // Widen right margin when a right axis is rendered — labels need ~36px to fit "100"/"60m" etc.
  const MARGIN = useMemo(
    () => ({
      ...VX.margin,
      left: marginLeft ?? VX.margin.left,
      right: rightAxis ? Math.max(VX.margin.right, 40) : VX.margin.right,
    }),
    [rightAxis, marginLeft],
  )
  const xMax = plot.width - MARGIN.left - MARGIN.right
  const yMax = plot.height - MARGIN.top - MARGIN.bottom

  const xScale = useMemo(
    () => scalePoint<string>({ domain: data.map(getX), range: [0, xMax], padding: 0.3 }),
    [data, xMax, getX],
  )

  const leftYScale = useMemo(() => {
    if (leftAxis.domain === 'auto') {
      const autoPad = leftAxis.autoPad ?? 1.1
      let maxSum = 0
      let minSum = 0
      if (barLayout === 'stacked') {
        for (const d of data) {
          let pos = 0
          for (const b of positiveBars) {
            const v = getValue(d, b.key)
            if (v !== null && !Number.isNaN(v) && v > 0) pos += v
          }
          let neg = 0
          for (const b of negativeBars) {
            const v = getValue(d, b.key)
            if (v !== null && !Number.isNaN(v) && v > 0) neg -= v
          }
          if (pos > maxSum) maxSum = pos
          if (neg < minSum) minSum = neg
        }
      } else {
        for (const d of data) {
          for (const b of positiveBars) {
            if ((b.axisSide ?? 'left') !== 'left') continue
            const v = getValue(d, b.key)
            if (v === null || Number.isNaN(v)) continue
            if (v > maxSum) maxSum = v
          }
        }
      }
      for (const ln of lines) {
        if ((ln.axisSide ?? 'left') !== 'left') continue
        for (const d of data) {
          const v = getValue(d, ln.key)
          if (v === null || Number.isNaN(v)) continue
          if (v > maxSum) maxSum = v
          if (v < minSum) minSum = v
        }
      }
      const upper = Math.max(maxSum, leftAxis.autoMaxFloor ?? maxSum) * autoPad
      const ceil = leftAxis.autoMinCeil ?? 0
      const lower = Math.min(minSum, ceil) * autoPad
      return scaleLinear<number>({ domain: [lower, upper], range: [yMax, 0], nice: true })
    }
    return scaleLinear<number>({ domain: leftAxis.domain, range: [yMax, 0] })
  }, [data, leftAxis, positiveBars, negativeBars, lines, getValue, yMax, barLayout])

  const rightYScale = useMemo(() => {
    if (!rightAxis) return null
    if (rightAxis.domain === 'auto') {
      const autoPad = rightAxis.autoPad ?? 1.1
      let max = -Infinity
      let min = Infinity
      if (barLayout === 'grouped') {
        for (const d of data) {
          for (const b of positiveBars) {
            if ((b.axisSide ?? 'left') !== 'right') continue
            const v = getValue(d, b.key)
            if (v === null || Number.isNaN(v)) continue
            if (v > max) max = v
            if (v < min) min = v
          }
        }
      }
      for (const ln of lines) {
        if ((ln.axisSide ?? 'left') !== 'right') continue
        for (const d of data) {
          const v = getValue(d, ln.key)
          if (v === null || Number.isNaN(v)) continue
          if (v > max) max = v
          if (v < min) min = v
        }
      }
      for (const z of zones) {
        if ((z.axisSide ?? 'left') !== 'right') continue
        if (Number.isFinite(z.to) && z.to > max) max = z.to
        if (Number.isFinite(z.from) && z.from < min) min = z.from
      }
      for (const r of refLines) {
        if ((r.axisSide ?? 'left') !== 'right') continue
        if (r.value > max) max = r.value
        if (r.value < min) min = r.value
      }
      const safeMax = Number.isFinite(max) ? max : 0
      const safeMin = Number.isFinite(min) ? min : 0
      const upper = Math.max(safeMax, rightAxis.autoMaxFloor ?? safeMax) * autoPad
      const ceil = rightAxis.autoMinCeil ?? 0
      const lower = Math.min(safeMin, ceil) * autoPad
      return scaleLinear<number>({ domain: [lower, upper], range: [yMax, 0], nice: true })
    }
    return scaleLinear<number>({ domain: rightAxis.domain, range: [yMax, 0] })
  }, [data, rightAxis, lines, zones, refLines, positiveBars, getValue, yMax, barLayout])

  const tooltipStyles = useTooltipStyles()
  const { tip, tooltipRef, syncedPoint, isDirectHover, handleMouse, handleLeave } = useHoverSync<T>(
    {
      data,
      chartId,
      getKey: getX,
      xScale,
      marginLeft: MARGIN.left,
    },
  )

  const tickValues = useMemo(
    () =>
      numTicksX ? smartTicksEvery(data.map(getX), numTicksX) : smartTicks(data.map(getX), xMax),
    [data, xMax, getX, numTicksX],
  )

  const groupWidth = Math.max((xMax / Math.max(data.length, 1)) * barWidthRatio, 2)
  // Per-bar widths + offsets for grouped layout (weighted distribution).
  const groupedBarWidths = useMemo(() => {
    if (barLayout !== 'grouped') return [] as number[]
    const totalWeight = positiveBars.reduce((s, b) => s + (b.weight ?? 1), 0) || 1
    return positiveBars.map((b) => Math.max(groupWidth * ((b.weight ?? 1) / totalWeight), 1))
  }, [positiveBars, groupWidth, barLayout])
  const groupedBarOffsets = useMemo(() => {
    const out: number[] = []
    let cursor = 0
    for (const w of groupedBarWidths) {
      out.push(cursor)
      cursor += w
    }
    return out
  }, [groupedBarWidths])

  const scaleFor = (side: 'left' | 'right' | undefined) =>
    side === 'right' && rightYScale ? rightYScale : leftYScale

  const tooltipLbl = tip ? (tooltipLabel?.(tip.data) ?? null) : null

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows
            scale={leftYScale}
            width={xMax}
            stroke={VX.grid}
            numTicks={leftAxis.numTicks ?? 5}
          />

          <ZoneRects zones={zones} width={xMax} leftScale={leftYScale} rightScale={rightYScale} />

          {refLines.map((r, i) => {
            const scale = scaleFor(r.axisSide)
            return (
              <line
                key={`ref-${i}`}
                x1={0}
                x2={xMax}
                y1={scale(r.value)}
                y2={scale(r.value)}
                stroke={r.color}
                strokeDasharray={r.dashed ? VX.dashArray : undefined}
              />
            )
          })}

          {data.map((d) => {
            const cx = xScale(getX(d)) ?? 0
            const groupLeft = cx - groupWidth / 2

            const els: ReactNode[] = []

            if (barLayout === 'stacked') {
              let posOffset = 0
              for (const b of positiveBars) {
                const v = getValue(d, b.key)
                if (v === null || Number.isNaN(v) || v <= 0) continue
                const top = posOffset + v
                const yTop = leftYScale(top)
                const yBottom = leftYScale(posOffset)
                els.push(
                  <rect
                    key={`${getX(d)}-${b.key}`}
                    x={groupLeft}
                    y={yTop}
                    width={groupWidth}
                    height={yBottom - yTop}
                    fill={b.color}
                    fillOpacity={(barOpacity?.(d, b.key) ?? 0.85) * dimOpacity(b.key)}
                  />,
                )
                posOffset = top
              }
              let negOffset = 0
              for (const b of negativeBars) {
                const v = getValue(d, b.key)
                if (v === null || Number.isNaN(v) || v <= 0) continue
                const top = negOffset + v
                const yTop = leftYScale(-negOffset)
                const yBottom = leftYScale(-top)
                els.push(
                  <rect
                    key={`${getX(d)}-${b.key}-neg`}
                    x={groupLeft}
                    y={yTop}
                    width={groupWidth}
                    height={yBottom - yTop}
                    fill={b.color}
                    fillOpacity={(barOpacity?.(d, b.key) ?? 0.85) * dimOpacity(b.key)}
                  />,
                )
                negOffset = top
              }
            } else {
              positiveBars.forEach((b, i) => {
                const v = getValue(d, b.key)
                if (v === null || Number.isNaN(v) || v <= 0) return
                const scale = scaleFor(b.axisSide)
                const yTop = scale(v)
                const yBottom = scale(0)
                els.push(
                  <rect
                    key={`${getX(d)}-${b.key}`}
                    x={groupLeft + (groupedBarOffsets[i] ?? 0)}
                    y={yTop}
                    width={groupedBarWidths[i] ?? 0}
                    height={yBottom - yTop}
                    fill={b.color}
                    fillOpacity={(barOpacity?.(d, b.key) ?? 0.85) * dimOpacity(b.key)}
                  />,
                )
              })
            }

            return <g key={`bars-${getX(d)}`}>{els}</g>
          })}

          {lines.map((ln) => {
            const scale = scaleFor(ln.axisSide)
            type LinePt = { __d: T; __y: number }
            const valid: LinePt[] = []
            for (const d of data) {
              const v = getValue(d, ln.key)
              if (v !== null && !Number.isNaN(v)) valid.push({ __d: d, __y: v })
            }
            if (valid.length === 0) return null
            return (
              <LinePath<LinePt>
                key={`line-${ln.key}`}
                data={valid}
                x={(p) => xScale(getX(p.__d)) ?? 0}
                y={(p) => scale(p.__y)}
                stroke={ln.color}
                strokeWidth={ln.strokeWidth ?? VX.lineWidth}
                strokeDasharray={ln.dashed ? VX.dashArray : undefined}
                strokeOpacity={dimOpacity(ln.key)}
                curve={curveMonotoneX}
              />
            )
          })}

          {negativeBars.length > 0 && (
            <line
              x1={0}
              x2={xMax}
              y1={leftYScale(0)}
              y2={leftYScale(0)}
              stroke={VX.grid}
              strokeWidth={1}
            />
          )}

          {syncedPoint &&
            (() => {
              const sx = xScale(getX(syncedPoint)) ?? 0
              return (
                <>
                  <Crosshair x={sx} top={0} bottom={yMax} />
                  {lines.map((ln) => {
                    const v = getValue(syncedPoint, ln.key)
                    if (v === null || Number.isNaN(v)) return null
                    const scale = scaleFor(ln.axisSide)
                    return (
                      <SeriesDot key={`dot-${ln.key}`} cx={sx} cy={scale(v)} color={ln.color} />
                    )
                  })}
                </>
              )
            })()}

          <AxisLeftNumeric
            scale={leftYScale}
            numTicks={leftAxis.numTicks ?? 5}
            {...(leftAxis.formatTick !== undefined && { tickFormat: leftAxis.formatTick })}
          />
          {rightYScale && rightAxis && (
            <AxisRightNumeric
              scale={rightYScale}
              left={xMax}
              numTicks={rightAxis.numTicks ?? 5}
              {...(rightAxis.formatTick !== undefined && { tickFormat: rightAxis.formatTick })}
            />
          )}
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
              {renderPrefixTooltipRows?.(tip.data)}
              {!hideBarTooltipRows &&
                deriveTooltipRows(barSeries, tip.data, formatValue).map((row) => (
                  <TooltipRow
                    key={row.key}
                    color={row.color}
                    label={row.label}
                    value={row.value}
                    shape={row.shape}
                  />
                ))}
              {deriveTooltipRows(lineSeries, tip.data, formatValue).map((row) => (
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
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot bars kind in `React.memo` to retain the auto-memoization it had as source.
 */
export const Bars = memo(BarsInner) as typeof BarsInner
