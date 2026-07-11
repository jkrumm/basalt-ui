import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { Bar, LinePath } from '@visx/shape'
import { Threshold } from '@visx/threshold'
import { memo, useMemo } from 'react'
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
import type { ChartLegendConfig, ChartSeries, SeriesStyle } from '../series'
import { VX } from '../../tokens'
import { smartTicks } from '../utils/ticks'

export type DualPanelProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  chartId: string
  getX: (d: T) => string
  /** 1+ line series in the top pane — the single source of truth for color, dash, legend, and
   * tooltip rows. E.g. acute (solid) / chronic (dashed). */
  series: ChartSeries<T>[]
  /** Top-pane y-domain. Default 'auto' (computed from all top lines, padded). */
  topYDomain?: [number, number] | 'auto'
  /** Shade the band between two top lines (by key), filled on both sides. */
  fillBetween?: { from: string; to: string; fill: string }
  /** Horizontal reference lines on the top pane. Solid by default; set dashed: true for a dashed line. */
  topRefLines?: { value: number; color: string; dashed?: boolean }[]
  /** Horizontal value-range bands on the top pane. */
  topZones?: ZoneSpec[]
  /** Bottom-pane signed value — return null to skip the bar. */
  getBar: (d: T) => number | null
  barLabel: string
  barColorPositive: string
  barColorNegative: string
  /** Top pane share of the inner plot height. Default 0.62. */
  topFraction?: number
  formatTop: (v: number) => string
  formatBottom: (v: number) => string
  /** Tooltip badge — appears at the right of the tooltip header. */
  tooltipLabel?: (d: T) => { text: string; color: string } | null
  /** Legend config forwarded to `ChartFrame`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded to `ChartFrame` as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
}

const PANE_GAP = 12

/**
 * Dual-pane chart: a top line pane and a bottom signed-histogram pane sharing
 * ONE x-scale and ONE cursor. Generalizes argo's divergence (acute/chronic +
 * divergence) and momentum (e1RM + velocity) charts.
 *
 * Composes `ChartFrame` for measuring + the derived legend — `series` (the top lines) plus a
 * synthesized divergence entry drive the legend, so acute/chronic/divergence are all legible
 * without hovering (previously legend-less).
 *
 * X-axis is built from the full `data` array so the calendar is preserved even
 * when a series has nulls; lines/bars skip null points (visual gaps).
 */
function DualPanelInner<T>(props: DualPanelProps<T>) {
  const { series, chartId, height, barLabel, barColorPositive, legend, ariaLabel } = props

  // Default the top-pane line overlays to the redesign's 1.9px stroke (docs/DESIGN-SPEC.md §5) —
  // applied once here so the plotted line, the derived legend swatch, and the derived tooltip row
  // all agree.
  const styledSeries = useMemo<ChartSeries<T>[]>(
    () => series.map((s) => ({ ...s, strokeWidth: s.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH })),
    [series],
  )

  // The bottom pane's signed histogram gets one representative legend entry alongside the top
  // lines — a diverging metric can't express its sign-dependent color as a single SeriesStyle, so
  // `barColorPositive` stands in as the swatch color.
  const legendSeries = useMemo<SeriesStyle[]>(
    () => [
      ...styledSeries,
      { key: '__divergence', label: barLabel, color: barColorPositive, mark: 'bar' },
    ],
    [styledSeries, barLabel, barColorPositive],
  )

  return (
    <ChartFrame
      series={legendSeries}
      chartId={chartId}
      {...(height !== undefined && { height })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      legend={resolveLegend(legend)}
    >
      {(plot) => <DualPanelPlot {...props} series={styledSeries} plot={plot} />}
    </ChartFrame>
  )
}

type DualPanelPlotProps<T> = DualPanelProps<T> & {
  plot: { width: number; height: number }
}

/** The measured plot — split from {@link DualPanelInner} so its scale/hover-sync hooks only run
 * once `ChartFrame` has resolved a non-empty plot rect. */
function DualPanelPlot<T>(props: DualPanelPlotProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    topYDomain = 'auto',
    fillBetween,
    topRefLines = [],
    topZones = [],
    getBar,
    barLabel,
    barColorPositive,
    barColorNegative,
    topFraction = 0.62,
    formatTop,
    formatBottom,
    tooltipLabel,
    plot,
  } = props

  const MARGIN = VX.margin
  const xMax = plot.width - MARGIN.left - MARGIN.right
  // Inner plot height shared by both panes (excludes top/bottom margin + gutter).
  const plotH = plot.height - MARGIN.top - MARGIN.bottom - PANE_GAP
  const topH = Math.max(Math.round(plotH * topFraction), 1)
  const bottomH = Math.max(plotH - topH, 1)
  const bottomTop = topH + PANE_GAP
  // Full inner span — the synced crosshair line covers BOTH panes.
  const innerH = topH + PANE_GAP + bottomH

  const xScale = useMemo(
    () => scalePoint<string>({ domain: data.map(getX), range: [0, xMax], padding: 0.3 }),
    [data, xMax, getX],
  )

  const topYScale = useMemo(() => {
    if (topYDomain !== 'auto') {
      return scaleLinear<number>({ domain: topYDomain, range: [topH, 0] })
    }
    let lo = Infinity
    let hi = -Infinity
    for (const s of series) {
      for (const d of data) {
        const v = s.getValue(d)
        if (v === null || v === undefined || Number.isNaN(v)) continue
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0
      hi = 1
    }
    const span = hi - lo || Math.abs(hi) || 1
    return scaleLinear<number>({
      domain: [lo - span * 0.08, hi + span * 0.08],
      range: [topH, 0],
      nice: true,
    })
  }, [data, series, topYDomain, topH])

  // Bottom pane: symmetric signed scale around zero.
  const bottomYScale = useMemo(() => {
    let maxAbs = 0
    for (const d of data) {
      const v = getBar(d)
      if (v === null || v === undefined || Number.isNaN(v)) continue
      const a = Math.abs(v)
      if (a > maxAbs) maxAbs = a
    }
    if (maxAbs === 0) maxAbs = 1
    return scaleLinear<number>({
      domain: [-maxAbs, maxAbs],
      range: [bottomH, 0],
      nice: true,
    })
  }, [data, getBar, bottomH])

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

  const tickValues = useMemo(() => smartTicks(data.map(getX), xMax), [data, xMax, getX])

  const barWidth = data.length > 0 ? Math.max((xMax / data.length) * 0.6, 2) : 2

  type FillPt = { __d: T; __from: number; __to: number }
  const fillPts = useMemo<FillPt[]>(() => {
    if (!fillBetween) return []
    const fromLine = series.find((s) => s.key === fillBetween.from)
    const toLine = series.find((s) => s.key === fillBetween.to)
    if (!fromLine || !toLine) return []
    const out: FillPt[] = []
    for (const d of data) {
      const f = fromLine.getValue(d)
      const t = toLine.getValue(d)
      if (f === null || f === undefined || Number.isNaN(f)) continue
      if (t === null || t === undefined || Number.isNaN(t)) continue
      out.push({ __d: d, __from: f, __to: t })
    }
    return out
  }, [data, fillBetween, series])

  type LinePt = { __d: T; __y: number }
  // Per-line valid points, computed once per (data, series) — not re-walked inside the render map
  // every paint (parity with MultiLine's seriesPts).
  const lineValid = useMemo(() => {
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

  const sx = syncedPoint ? (xScale(getX(syncedPoint)) ?? 0) : 0
  const syncedBar = syncedPoint ? getBar(syncedPoint) : null

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        {/* Top pane: line series + fill-between + zones + ref lines. */}
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={topYScale} width={xMax} stroke={VX.grid} numTicks={4} />

          <ZoneRects zones={topZones} width={xMax} leftScale={topYScale} />

          {fillBetween && fillPts.length > 0 && (
            <Threshold<FillPt>
              id={`${chartId}-fill`}
              data={fillPts}
              x={(p) => xScale(getX(p.__d)) ?? 0}
              y0={(p) => topYScale(p.__from)}
              y1={(p) => topYScale(p.__to)}
              clipAboveTo={0}
              clipBelowTo={topH}
              curve={curveMonotoneX}
              belowAreaProps={{ fill: fillBetween.fill }}
              aboveAreaProps={{ fill: fillBetween.fill }}
            />
          )}

          {topRefLines.map((r, i) => (
            <line
              key={`top-ref-${i}`}
              x1={0}
              x2={xMax}
              y1={topYScale(r.value)}
              y2={topYScale(r.value)}
              stroke={r.color}
              strokeDasharray={r.dashed ? VX.dashArray : undefined}
            />
          ))}

          {series.map((s) => {
            const valid = lineValid.get(s.key) ?? []
            if (valid.length === 0) return null
            return (
              <LinePath<LinePt>
                key={`top-line-${s.key}`}
                data={valid}
                x={(p) => xScale(getX(p.__d)) ?? 0}
                y={(p) => topYScale(p.__y)}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? VX.lineWidth}
                strokeDasharray={s.dash === 'dashed' ? VX.dashArray : undefined}
                curve={curveMonotoneX}
              />
            )
          })}

          {/* Dots only — the crosshair LINE is the single continuous span drawn below. */}
          {syncedPoint && (
            <>
              {series.map((s) => {
                const v = s.getValue(syncedPoint)
                if (v === null || v === undefined || Number.isNaN(v)) return null
                return (
                  <SeriesDot key={`top-dot-${s.key}`} cx={sx} cy={topYScale(v)} color={s.color} />
                )
              })}
            </>
          )}

          <AxisLeftNumeric scale={topYScale} numTicks={4} tickFormat={formatTop} />
          {/* One HoverOverlay per pane, both driving the SAME useHoverSync — snap-to-nearest is
              x-only, so either overlay yields the same point. The top overlay extends over the gutter
              (height = topH + PANE_GAP) so there's no dead zone between the panes. */}
          <HoverOverlay
            width={xMax}
            height={topH + PANE_GAP}
            onMove={handleMouse}
            onLeave={handleLeave}
          />
        </Group>

        {/* Bottom pane: signed histogram around a zero baseline. */}
        <Group left={MARGIN.left} top={MARGIN.top + bottomTop}>
          <line
            x1={0}
            x2={xMax}
            y1={bottomYScale(0)}
            y2={bottomYScale(0)}
            stroke={VX.grid}
            strokeWidth={1}
          />

          {data.map((d) => {
            const v = getBar(d)
            if (v === null || v === undefined || Number.isNaN(v)) return null
            const cx = xScale(getX(d)) ?? 0
            const y0 = bottomYScale(0)
            const yVal = bottomYScale(v)
            return (
              <Bar
                key={`bar-${getX(d)}`}
                x={cx - barWidth / 2}
                y={Math.min(y0, yVal)}
                width={barWidth}
                height={Math.max(Math.abs(yVal - y0), 1)}
                fill={v >= 0 ? barColorPositive : barColorNegative}
                fillOpacity={0.7}
                rx={1.4}
              />
            )
          })}

          {syncedPoint && (
            <>
              {syncedBar !== null && syncedBar !== undefined && !Number.isNaN(syncedBar) && (
                <SeriesDot
                  cx={sx}
                  cy={bottomYScale(syncedBar)}
                  color={syncedBar >= 0 ? barColorPositive : barColorNegative}
                />
              )}
            </>
          )}

          <AxisLeftNumeric scale={bottomYScale} numTicks={3} tickFormat={formatBottom} />
          <AxisBottomDate top={bottomH} scale={xScale} tickValues={tickValues} />
          <HoverOverlay
            width={xMax}
            height={bottomH + MARGIN.bottom}
            onMove={handleMouse}
            onLeave={handleLeave}
          />
        </Group>

        {/* Continuous crosshair spanning the gutter between panes. */}
        {syncedPoint && (
          <Group left={MARGIN.left} top={MARGIN.top}>
            <Crosshair x={sx} top={0} bottom={innerH} />
          </Group>
        )}
      </svg>

      <ChartTooltip tip={isDirectHover ? tip : null} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && isDirectHover && (
          <>
            <TooltipHeader
              date={getX(tip.data)}
              {...(() => {
                const lbl = tooltipLabel?.(tip.data) ?? null
                return lbl !== null ? { label: lbl.text, labelColor: lbl.color } : {}
              })()}
            />
            <TooltipBody>
              {deriveTooltipRows(series, tip.data, formatTop).map((row) => (
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
              {(() => {
                const v = getBar(tip.data)
                if (v === null || v === undefined || Number.isNaN(v)) return null
                return (
                  <TooltipRow
                    color={v >= 0 ? barColorPositive : barColorNegative}
                    label={barLabel}
                    value={formatBottom(v)}
                    shape="bar"
                  />
                )
              })()}
            </TooltipBody>
          </>
        )}
      </ChartTooltip>
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot DualPanel kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with ZonedLine).
 */
export const DualPanel = memo(DualPanelInner) as typeof DualPanelInner
