import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { Bar, LinePath } from '@visx/shape'
import { Threshold } from '@visx/threshold'
import { memo, useMemo } from 'react'
import { AxisBottomDate, AxisLeftNumeric } from '../primitives/Axes'
import {
  ChartTooltipFloat,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
} from '../primitives/ChartTooltip'
import { ChartFrame, resolveLegend } from '../primitives/ChartFrame'
import { Crosshair, SeriesDot } from '../primitives/Crosshair'
import { HoverOverlay } from '../primitives/HoverOverlay'
import { ZoneRects } from '../primitives/ZoneRects'
import type { ZoneSpec } from '../primitives/ZoneRects'
import { useChartCursor } from '../hooks/useChartCursor'
import { autoMargin, probeAxisLabels } from '../layout/auto-margin'
import { deriveTooltipRows, LINE_OVERLAY_STROKE_WIDTH } from '../series'
import type { ChartLegendConfig, ChartSeries, SeriesStyle } from '../series'
import { VX } from '../../tokens'
import { fmtAxisDate } from '../utils/format'
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
  /** Forwarded to `ChartFrame` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
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
  const { series, chartId, height, barLabel, barColorPositive, legend, ariaLabel, isPending } =
    props

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
      {...(isPending !== undefined && { isPending })}
      legend={resolveLegend(legend)}
    >
      {(plot) => <DualPanelPlot {...props} series={styledSeries} plot={plot} />}
    </ChartFrame>
  )
}

type DualPanelPlotProps<T> = DualPanelProps<T> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
}

/** The measured plot — split from {@link DualPanelInner} so its scale/cursor hooks only run
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

  const { hidden } = plot
  // Legend-hidden series drop out of the domain, the drawn lines/dots, and the tooltip together
  // (`docs/CHARTS-SPEC.md` §5) — the synthesized `__divergence` key gates the bottom histogram the
  // same way.
  const visibleSeries = useMemo(() => series.filter((s) => !hidden.has(s.key)), [series, hidden])
  const barVisible = !hidden.has('__divergence')

  // ── Pass 1: y domains + tick labels, both independent of the pixel rect ─────────────────────
  // A linear scale's domain (and, with `nice`, its rounded bounds) is a pure function of the
  // input domain — not of its pixel range — so the tick labels used to MEASURE the margin can be
  // read off a throwaway [1, 0] range before the real [topH, 0] / [bottomH, 0] range is known.
  const useNiceTop = topYDomain === 'auto'
  // Deliberately NOT `resolveAxisDomain`'s law, and not drift: that one anchors to a zero baseline
  // and pads multiplicatively, which is right for a magnitude chart. This pane plots a signal line
  // whose interesting range is a narrow band far from zero (MACD, a price series) — a zero
  // baseline would squash it into a sliver at the top of the pane. Hence a SPAN-relative symmetric
  // pad instead. If a third pane-shaped kind ever wants this law, promote it into
  // `layout/auto-margin.ts` beside `probeAxisLabels` rather than copying it again.
  const topDomain = useMemo<[number, number]>(() => {
    if (topYDomain !== 'auto') return topYDomain
    let lo = Infinity
    let hi = -Infinity
    for (const s of visibleSeries) {
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
    return [lo - span * 0.08, hi + span * 0.08]
  }, [data, visibleSeries, topYDomain])

  const topLabels = useMemo(
    () =>
      probeAxisLabels({ domain: topDomain, ticks: 4, format: formatTop, nice: useNiceTop }).labels,
    [topDomain, useNiceTop, formatTop],
  )

  // Bottom pane: symmetric signed domain around zero.
  const maxAbs = useMemo(() => {
    let m = 0
    for (const d of data) {
      const v = getBar(d)
      if (v === null || v === undefined || Number.isNaN(v)) continue
      const a = Math.abs(v)
      if (a > m) m = a
    }
    return m === 0 ? 1 : m
  }, [data, getBar])

  const bottomLabels = useMemo(
    () =>
      probeAxisLabels({
        domain: [-maxAbs, maxAbs],
        ticks: 3,
        format: formatBottom,
        nice: true,
      }).labels,
    [maxAbs, formatBottom],
  )

  // Full (untinned) x labels are enough to measure the bottom/right gutters — thinning only drops
  // labels, never widens the max, so measuring against the full set is a safe over-estimate.
  const xLabelsAll = useMemo(() => data.map((d) => fmtAxisDate(getX(d))), [data, getX])

  const margin = useMemo(
    () => autoMargin({ left: [...topLabels, ...bottomLabels], bottom: xLabelsAll }),
    [topLabels, bottomLabels, xLabelsAll],
  )

  // ── Pass 2: the real scales, now that the plot rect is known ────────────────────────────────
  const xMax = Math.max(plot.width - margin.left - margin.right, 0)
  // Inner plot height shared by both panes (excludes top/bottom margin + gutter).
  const plotH = plot.height - margin.top - margin.bottom - PANE_GAP
  const topH = Math.max(Math.round(plotH * topFraction), 1)
  const bottomH = Math.max(plotH - topH, 1)
  const bottomTop = topH + PANE_GAP
  // Full inner span — the synced crosshair line covers BOTH panes.
  const innerH = topH + PANE_GAP + bottomH

  const xScale = useMemo(
    () => scalePoint<string>({ domain: data.map(getX), range: [0, xMax], padding: 0.3 }),
    [data, xMax, getX],
  )

  const topYScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: topDomain,
        range: [topH, 0],
        ...(useNiceTop && { nice: true }),
      }),
    [topDomain, useNiceTop, topH],
  )

  const bottomYScale = useMemo(
    () => scaleLinear<number>({ domain: [-maxAbs, maxAbs], range: [bottomH, 0], nice: true }),
    [maxAbs, bottomH],
  )

  const cursor = useChartCursor<T>({
    data,
    chartId,
    getKey: getX,
    xScale,
    marginLeft: margin.left,
  })

  const tickValues = useMemo(() => smartTicks(data.map(getX), xMax), [data, xMax, getX])

  const barWidth = data.length > 0 ? Math.max((xMax / data.length) * 0.6, 2) : 2

  type HistogramBar = {
    key: string
    x: number
    y: number
    width: number
    height: number
    fill: string
  }

  // Bottom-pane histogram geometry — memoized since the shared cursor re-renders every mounted
  // chart on every pointer frame, and this walks the full `data` array building fresh bar
  // geometry each time otherwise (parity with Bars' barGroups).
  const histogramBars = useMemo<HistogramBar[]>(() => {
    if (!barVisible) return []
    const y0 = bottomYScale(0)
    const bars: HistogramBar[] = []
    for (const d of data) {
      const v = getBar(d)
      if (v === null || v === undefined || Number.isNaN(v)) continue
      const cx = xScale(getX(d)) ?? 0
      const yVal = bottomYScale(v)
      bars.push({
        key: `bar-${getX(d)}`,
        x: cx - barWidth / 2,
        y: Math.min(y0, yVal),
        width: barWidth,
        height: Math.max(Math.abs(yVal - y0), 1),
        fill: v >= 0 ? barColorPositive : barColorNegative,
      })
    }
    return bars
  }, [
    barVisible,
    data,
    getBar,
    getX,
    xScale,
    bottomYScale,
    barWidth,
    barColorPositive,
    barColorNegative,
  ])

  type FillPt = { __d: T; __from: number; __to: number }
  const fillPts = useMemo<FillPt[]>(() => {
    if (!fillBetween) return []
    const fromLine = visibleSeries.find((s) => s.key === fillBetween.from)
    const toLine = visibleSeries.find((s) => s.key === fillBetween.to)
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
  }, [data, fillBetween, visibleSeries])

  type LinePt = { __d: T; __y: number }
  // Per-line valid points, computed once per (data, visibleSeries) — not re-walked inside the
  // render map every paint (parity with MultiLine's seriesPts).
  const lineValid = useMemo(() => {
    const out = new Map<string, LinePt[]>()
    for (const s of visibleSeries) {
      const pts: LinePt[] = []
      for (const d of data) {
        const v = s.getValue(d)
        if (v !== null && v !== undefined && !Number.isNaN(v)) pts.push({ __d: d, __y: v })
      }
      out.set(s.key, pts)
    }
    return out
  }, [data, visibleSeries])

  const point = cursor.point
  const sx = point !== null ? (xScale(getX(point)) ?? 0) : 0
  const syncedBar = point !== null ? getBar(point) : null

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        {/* Top pane: line series + fill-between + zones + ref lines. */}
        <Group left={margin.left} top={margin.top}>
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

          {visibleSeries.map((s) => {
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
          {point !== null && (
            <>
              {visibleSeries.map((s) => {
                const v = s.getValue(point)
                if (v === null || v === undefined || Number.isNaN(v)) return null
                return (
                  <SeriesDot key={`top-dot-${s.key}`} cx={sx} cy={topYScale(v)} color={s.color} />
                )
              })}
            </>
          )}

          {/* theme-allow basalt/hand-rolled-plot: TWO panes over one x scale is not a single
              cartesian plot, so `CartesianChart` (one plot rect, one or two y axes) cannot express
              it. This file therefore assembles the plot itself — but from the SAME parts every
              other chart gets: `ChartFrame`, `autoMargin` + `probeAxisLabels`, `useChartCursor`,
              `ChartTooltipFloat`. If a second multi-pane kind ever appears, promote the shared
              choreography rather than copying this file. */}
          <AxisLeftNumeric scale={topYScale} numTicks={4} tickFormat={formatTop} />
          {/* One HoverOverlay per pane, both driving the SAME shared cursor — snap-to-nearest is
              x-only, so either overlay yields the same point. The top overlay extends over the gutter
              (height = topH + PANE_GAP) so there's no dead zone between the panes. */}
          <HoverOverlay
            width={xMax}
            height={topH + PANE_GAP}
            onMove={cursor.onPointerMove}
            onLeave={cursor.onPointerLeave}
            onKeyDown={cursor.onKeyDown}
            onBlur={cursor.onBlur}
          />
        </Group>

        {/* Bottom pane: signed histogram around a zero baseline. */}
        <Group left={margin.left} top={margin.top + bottomTop}>
          <line
            x1={0}
            x2={xMax}
            y1={bottomYScale(0)}
            y2={bottomYScale(0)}
            stroke={VX.grid}
            strokeWidth={1}
          />

          {histogramBars.map((b) => (
            <Bar
              key={b.key}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              fill={b.fill}
              fillOpacity={0.7}
              rx={1.4}
            />
          ))}

          {barVisible &&
            point !== null &&
            syncedBar !== null &&
            syncedBar !== undefined &&
            !Number.isNaN(syncedBar) && (
              <SeriesDot
                cx={sx}
                cy={bottomYScale(syncedBar)}
                color={syncedBar >= 0 ? barColorPositive : barColorNegative}
              />
            )}

          <AxisLeftNumeric scale={bottomYScale} numTicks={3} tickFormat={formatBottom} />
          <AxisBottomDate top={bottomH} scale={xScale} tickValues={tickValues} />
          {/* Pointer only — deliberately NO `onKeyDown`, which is what makes an overlay focusable.
              Both panes scrub the same single x cursor, so a second tab stop would be a second
              control for one logical axis: a keyboard user would tab twice through one chart and
              find the arrow keys doing the same thing. The top overlay owns the keyboard. */}
          <HoverOverlay
            width={xMax}
            height={bottomH + margin.bottom}
            onMove={cursor.onPointerMove}
            onLeave={cursor.onPointerLeave}
          />
        </Group>

        {/* Continuous crosshair spanning the gutter between panes. */}
        {point !== null && (
          <Group left={margin.left} top={margin.top}>
            <Crosshair x={sx} top={0} bottom={innerH} />
          </Group>
        )}
      </svg>

      {cursor.isSource && point !== null && (
        <ChartTooltipFloat anchor={cursor.anchor}>
          <TooltipHeader
            date={getX(point)}
            {...(() => {
              const lbl = tooltipLabel?.(point) ?? null
              return lbl !== null ? { label: lbl.text, labelColor: lbl.color } : {}
            })()}
          />
          <TooltipBody>
            {deriveTooltipRows(visibleSeries, point, formatTop).map((row) => (
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
            {barVisible &&
              (() => {
                const v = getBar(point)
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
        </ChartTooltipFloat>
      )}
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot DualPanel kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with ZonedLine).
 */
export const DualPanel = memo(DualPanelInner) as typeof DualPanelInner
