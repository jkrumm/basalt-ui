import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { memo, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
import { deriveTooltipRows, LINE_OVERLAY_STROKE_WIDTH } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { VX } from '../../tokens'
import { padAutoLower } from '../utils/domain'
import { smartTicks, smartTicksEvery } from '../utils/ticks'

export type MultiLineProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  chartId: string
  /** Extracts the x-axis category (date string) from a data point. */
  getX: (d: T) => string
  /** 1+ line series sharing one y-axis — the single source of truth for color, dash, legend, and
   * tooltip rows. */
  series: ChartSeries<T>[]
  /** Fixed y-domain (e.g. [-2.5, 2.5]) or 'auto' to compute from all series. */
  yDomain: [number, number] | 'auto'
  /** When 'auto': upper bound is at least this value. */
  yAutoMaxFloor?: number
  /** When 'auto': lower bound is at most this value. Default 0. Pass `Infinity` to disable the
   * forced zero baseline — the lower bound then pads DOWN from the raw data minimum instead. */
  yAutoMinCeil?: number
  /** When 'auto': padding multiplier applied away from the domain. Default 1.1. The lower bound
   * always pads DOWN from `min(dataMin, yAutoMinCeil)` (never up, which would clip data) — see
   * {@link padAutoLower}. */
  yAutoPad?: number
  /** Horizontal value-range overlays (target zones), rendered behind the lines on the left scale. */
  zones?: ZoneSpec[]
  /** Horizontal reference lines. Solid by default; set dashed: true for a dashed line. */
  refLines?: { value: number; color: string; dashed?: boolean }[]
  numTicksX?: number
  numTicksY?: number
  /** Tooltip + (per-series) value formatter. */
  formatValue: (v: number) => string
  /** Y-axis tick label formatter. Falls back to the scale's default. */
  formatYTick?: (v: number) => string
  /** Label shown at the right of the tooltip header (e.g. status badge). */
  tooltipLabel?: (d: T) => { text: string; color: string } | null
  /** Extra tooltip rows rendered after the per-series rows. */
  renderExtraTooltipRows?: (d: T) => ReactNode
  /** Marker glyph for per-point markers. Default 'circle'. */
  markerShape?: 'circle' | 'star'
  /** Legend config forwarded to `ChartFrame`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded to `ChartFrame` as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
}

const STAR_R = 6

/** Five-point star path centered at (cx, cy) with outer radius r. */
function starPath(cx: number, cy: number, r: number): string {
  const inner = r * 0.4
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner
    const angle = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return `M${pts.join('L')}Z`
}

/**
 * N series sharing one y-axis, with optional zones/reference lines, per-point markers
 * (PR stars / status dots), a dashed companion line per series, legend-hover dimming, and a
 * shared-cursor tooltip. Generalizes the multi-line argo charts (e1RM trend, relative
 * progression, training load, fitness trends).
 *
 * Composes `ChartFrame` for measuring + the derived legend — `series` is the single array that
 * drives the plotted lines, the legend, and the tooltip rows.
 *
 * X-axis is built from the full `data` array so the calendar is preserved even when a series
 * has nulls; each series line skips null points (creating visual gaps).
 */
function MultiLineInner<T>(props: MultiLineProps<T>) {
  const { series, chartId, height, legend, ariaLabel } = props
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)

  // Default line overlays to the redesign's 1.9px stroke (docs/DESIGN-SPEC.md §5) — applied once
  // here so the plotted line, the derived legend swatch, and the derived tooltip row all agree.
  const styledSeries = useMemo<ChartSeries<T>[]>(
    () => series.map((s) => ({ ...s, strokeWidth: s.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH })),
    [series],
  )

  return (
    <ChartFrame
      series={styledSeries}
      chartId={chartId}
      {...(height !== undefined && { height })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      legend={resolveLegend(legend, {
        highlighted: highlightedKey,
        onHighlight: setHighlightedKey,
      })}
    >
      {(plot) => (
        <MultiLinePlot
          {...props}
          series={styledSeries}
          plot={plot}
          highlightedKey={highlightedKey}
        />
      )}
    </ChartFrame>
  )
}

type MultiLinePlotProps<T> = MultiLineProps<T> & {
  plot: { width: number; height: number }
  highlightedKey: string | null
}

/** The measured plot — split from {@link MultiLineInner} so its scale/hover-sync hooks only run
 * once `ChartFrame` has resolved a non-empty plot rect (hooks can't run inside a conditionally
 * invoked render-prop callback). */
function MultiLinePlot<T>(props: MultiLinePlotProps<T>) {
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
    refLines = [],
    numTicksX,
    numTicksY = 5,
    formatValue,
    formatYTick,
    tooltipLabel,
    renderExtraTooltipRows,
    markerShape = 'circle',
    plot,
    highlightedKey,
  } = props

  // A series stays at full opacity when nothing is highlighted, when it IS the highlighted series,
  // or when it is a companion of the highlighted series (its `parent` matches).
  const dimOpacity = (s: ChartSeries<T>): number =>
    highlightedKey === null || s.key === highlightedKey || s.parent === highlightedKey ? 1 : 0.25

  const MARGIN = VX.margin
  const xMax = plot.width - MARGIN.left - MARGIN.right
  const yMax = plot.height - MARGIN.top - MARGIN.bottom

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
      let dataMax = -Infinity
      let dataMin = Infinity
      for (const d of data) {
        for (const s of series) {
          const v = s.getValue(d)
          if (v === null || v === undefined || Number.isNaN(v)) continue
          if (v > dataMax) dataMax = v
          if (v < dataMin) dataMin = v
        }
      }
      const safeMax = Number.isFinite(dataMax) ? dataMax : 0
      const safeMin = Number.isFinite(dataMin) ? dataMin : 0
      const upper = Math.max(safeMax, yAutoMaxFloor ?? safeMax) * yAutoPad
      const lower = padAutoLower(Math.min(safeMin, yAutoMinCeil), yAutoPad)
      return scaleLinear<number>({ domain: [lower, upper], range: [yMax, 0], nice: true })
    }
    return scaleLinear<number>({ domain: yDomain, range: [yMax, 0] })
  }, [data, series, yDomain, yMax, yAutoPad, yAutoMaxFloor, yAutoMinCeil])

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

  // Per-series valid points, computed once per (data, series) change — not re-walked inside the
  // render map on every paint (parity with ZonedLine's single `valid` memo). Reused by the lines,
  // the per-point markers, and the synced dots.
  type LinePt = { __d: T; __y: number }
  const seriesPts = useMemo(() => {
    const out = new Map<string, LinePt[]>()
    for (const s of series) {
      const pts: LinePt[] = []
      for (const d of data) {
        const v = s.getValue(d)
        if (v !== null && v !== undefined && !Number.isNaN(v)) pts.push({ __d: d, __y: v })
      }
      out.set(s.key, pts)
    }
    return out
  }, [data, series])

  const tooltipLbl = tip ? (tooltipLabel?.(tip.data) ?? null) : null

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={xMax} stroke={VX.grid} numTicks={numTicksY} />

          <ZoneRects zones={zones} width={xMax} leftScale={yScale} />

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

          {series.map((s) => {
            const valid = seriesPts.get(s.key) ?? []
            if (valid.length === 0) return null
            return (
              <LinePath<LinePt>
                key={`line-${s.key}`}
                data={valid}
                x={(p) => xScale(getX(p.__d)) ?? 0}
                y={(p) => yScale(p.__y)}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? VX.lineWidth}
                strokeDasharray={s.dash === 'dashed' ? VX.dashArray : undefined}
                strokeOpacity={dimOpacity(s)}
                curve={curveMonotoneX}
              />
            )
          })}

          {series.flatMap((s) => {
            const getMarker = s.getMarker
            if (!getMarker) return [] as ReactNode[]
            const op = dimOpacity(s)
            const markers: ReactNode[] = []
            for (const p of seriesPts.get(s.key) ?? []) {
              const m = getMarker(p.__d)
              if (m === null) continue
              const cx = xScale(getX(p.__d)) ?? 0
              const cy = yScale(p.__y)
              const color = m.color ?? s.color
              const r = m.r ?? (markerShape === 'star' ? STAR_R : VX.dotR)
              markers.push(
                markerShape === 'star' ? (
                  <path
                    key={`mk-${s.key}-${getX(p.__d)}`}
                    d={starPath(cx, cy, r)}
                    fill={color}
                    stroke={VX.dotStroke}
                    strokeWidth={1.5}
                    fillOpacity={op}
                    strokeOpacity={op}
                  />
                ) : (
                  <circle
                    key={`mk-${s.key}-${getX(p.__d)}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={color}
                    stroke={VX.dotStroke}
                    strokeWidth={2}
                    fillOpacity={op}
                    strokeOpacity={op}
                  />
                ),
              )
            }
            return markers
          })}

          {syncedPoint &&
            (() => {
              const sx = xScale(getX(syncedPoint)) ?? 0
              return (
                <>
                  <Crosshair x={sx} top={0} bottom={yMax} />
                  {series.map((s) => {
                    const v = s.getValue(syncedPoint)
                    if (v === null || v === undefined || Number.isNaN(v)) return null
                    return <SeriesDot key={`dot-${s.key}`} cx={sx} cy={yScale(v)} color={s.color} />
                  })}
                </>
              )
            })()}

          <AxisLeftNumeric
            scale={yScale}
            numTicks={numTicksY}
            {...(formatYTick !== undefined && { tickFormat: formatYTick })}
          />
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
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot MultiLine kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with ZonedLine).
 */
export const MultiLine = memo(MultiLineInner) as typeof MultiLineInner
