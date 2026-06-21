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
import { HoverOverlay } from '../primitives/HoverOverlay'
import { ZoneRects, type ZoneSpec } from '../primitives/ZoneRects'
import { useHoverSync } from '../hooks/useHoverSync'
import { VX } from '../../tokens'
import { smartTicks } from '../utils/ticks'

/** One line in the top pane. `color` is a resolved CSS color / token ref. */
export type DualPanelLine<T> = {
  key: string
  label: string
  color: string
  /** Extracts the y value — return null to drop the point (creates a gap). */
  getY: (d: T) => number | null
  dashed?: boolean
}

export type DualPanelProps<T> = {
  data: T[]
  width: number
  height: number
  chartId: string
  getX: (d: T) => string
  /** 1+ line series in the top pane. */
  topLines: DualPanelLine<T>[]
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
}

const PANE_GAP = 12

/**
 * Dual-pane chart: a top line pane and a bottom signed-histogram pane sharing
 * ONE x-scale and ONE cursor. Generalizes argo's divergence (acute/chronic +
 * divergence) and momentum (e1RM + velocity) charts.
 *
 * X-axis is built from the full `data` array so the calendar is preserved even
 * when a series has nulls; lines/bars skip null points (visual gaps).
 */
function DualPanelInner<T>(props: DualPanelProps<T>) {
  const {
    data,
    width,
    height,
    chartId,
    getX,
    topLines,
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
  } = props

  const MARGIN = VX.margin
  const xMax = width - MARGIN.left - MARGIN.right
  // Inner plot height shared by both panes (excludes top/bottom margin + gutter).
  const plotH = height - MARGIN.top - MARGIN.bottom - PANE_GAP
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
    for (const ln of topLines) {
      for (const d of data) {
        const v = ln.getY(d)
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
  }, [data, topLines, topYDomain, topH])

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
      getX,
      xScale,
      marginLeft: MARGIN.left,
    },
  )

  const tickValues = useMemo(() => smartTicks(data.map(getX), xMax), [data, xMax, getX])

  const barWidth = data.length > 0 ? Math.max((xMax / data.length) * 0.6, 2) : 2

  type FillPt = { __d: T; __from: number; __to: number }
  const fillPts = useMemo<FillPt[]>(() => {
    if (!fillBetween) return []
    const fromLine = topLines.find((ln) => ln.key === fillBetween.from)
    const toLine = topLines.find((ln) => ln.key === fillBetween.to)
    if (!fromLine || !toLine) return []
    const out: FillPt[] = []
    for (const d of data) {
      const f = fromLine.getY(d)
      const t = toLine.getY(d)
      if (f === null || f === undefined || Number.isNaN(f)) continue
      if (t === null || t === undefined || Number.isNaN(t)) continue
      out.push({ __d: d, __from: f, __to: t })
    }
    return out
  }, [data, fillBetween, topLines])

  type LinePt = { __d: T; __y: number }
  // Per-line valid points, computed once per (data, topLines) — not re-walked inside the render map
  // every paint (parity with MultiLine's seriesPts).
  const lineValid = useMemo(() => {
    const out = new Map<string, LinePt[]>()
    for (const ln of topLines) {
      const pts: LinePt[] = []
      for (const d of data) {
        const v = ln.getY(d)
        if (v !== null && v !== undefined && !Number.isNaN(v)) pts.push({ __d: d, __y: v })
      }
      out.set(ln.key, pts)
    }
    return out
  }, [data, topLines])

  const sx = syncedPoint ? (xScale(getX(syncedPoint)) ?? 0) : 0
  const syncedBar = syncedPoint ? getBar(syncedPoint) : null

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
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
              strokeDasharray={r.dashed ? '4 4' : undefined}
            />
          ))}

          {topLines.map((ln) => {
            const valid = lineValid.get(ln.key) ?? []
            if (valid.length === 0) return null
            return (
              <LinePath<LinePt>
                key={`top-line-${ln.key}`}
                data={valid}
                x={(p) => xScale(getX(p.__d)) ?? 0}
                y={(p) => topYScale(p.__y)}
                stroke={ln.color}
                strokeWidth={VX.lineWidth}
                strokeDasharray={ln.dashed ? '6 4' : undefined}
                curve={curveMonotoneX}
              />
            )
          })}

          {/* Dots only — the crosshair LINE is the single continuous span drawn below. */}
          {syncedPoint && (
            <>
              {topLines.map((ln) => {
                const v = ln.getY(syncedPoint)
                if (v === null || v === undefined || Number.isNaN(v)) return null
                return (
                  <circle
                    key={`top-dot-${ln.key}`}
                    cx={sx}
                    cy={topYScale(v)}
                    r={VX.dotR}
                    fill={ln.color}
                    stroke={VX.dotStroke}
                    strokeWidth={2}
                  />
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
                rx={1}
              />
            )
          })}

          {syncedPoint && (
            <>
              {syncedBar !== null && syncedBar !== undefined && !Number.isNaN(syncedBar) && (
                <circle
                  cx={sx}
                  cy={bottomYScale(syncedBar)}
                  r={VX.dotR}
                  fill={syncedBar >= 0 ? barColorPositive : barColorNegative}
                  stroke={VX.dotStroke}
                  strokeWidth={2}
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
            <line x1={sx} x2={sx} y1={0} y2={innerH} stroke={VX.crosshair} strokeWidth={1} />
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
              {topLines.map((ln) => {
                const v = ln.getY(tip.data)
                if (v === null || v === undefined || Number.isNaN(v)) return null
                return (
                  <TooltipRow
                    key={`tip-${ln.key}`}
                    color={ln.color}
                    label={ln.label}
                    value={formatTop(v)}
                    shape="line"
                    {...(ln.dashed !== undefined && { dashed: ln.dashed })}
                  />
                )
              })}
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
    </div>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot DualPanel kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with ZonedLine).
 */
export const DualPanel = memo(DualPanelInner) as typeof DualPanelInner
