import { Group } from '@visx/group'
import { scaleLinear } from '@visx/scale'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import { VX, alpha } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import type { CursorResolution } from '../cursor/resolve'
import { useBandPlot } from '../hooks/useBandPlot'
import type { BandFold, BandTooltipConfig } from '../hooks/useBandPlot'
import { probeAxisLabels } from '../layout/auto-margin'
import { AxisBottomDate, AxisLeftNumeric } from '../primitives/Axes'
import { ChartFrame, resolveLegend } from '../primitives/ChartFrame'
import {
  ChartTooltipFloat,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
} from '../primitives/ChartTooltip'
import { Crosshair } from '../primitives/Crosshair'
import { HatchPattern, hatchFill, hatchSizeFor } from '../primitives/HatchPattern'
import { HoverOverlay } from '../primitives/HoverOverlay'
import { deriveTooltipRows } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { fmtAxisDate } from '../utils/format'

/** One of the two panes. Each resolves its own domain — that is the whole point of the kind. */
export type MirroredBarPane = {
  /** Key of the `series` entry this pane draws: its colour, its legend entry, its tooltip row. */
  key: string
  /**
   * The pane's upper bound. `'auto'` (default) is its own visible maximum; a number pins it.
   *
   * A pane has no LOWER bound to configure — a mirrored bar's length is its magnitude measured
   * from the shared baseline, so the pane's zero IS the baseline. That is also why the two panes
   * never share a domain: an upload an order of magnitude below its download flattens to a line
   * along the baseline on a shared scale, and it is the half that explains a stalled call.
   */
  max?: number | 'auto'
  /** When `max` is `'auto'`: floors the upper bound, so a quiet window doesn't amplify noise to
   * full height. */
  autoMaxFloor?: number
  /** Tick count for this pane's own axis. Default 3. */
  ticks?: number
  /** Tick + tooltip formatter for this pane. A pane's axis is in its OWN units — one shared
   * formatter would be wrong for at least one of them whenever the two differ. */
  format: (v: number) => string
}

export type MirroredBarsProps<T> = {
  data: readonly T[]
  chartId: string
  /** Extracts the x-domain key — a slot start, hence the `'leading'` cursor default. */
  getX: (d: T) => string
  /**
   * The single source of truth for bar colours, legend entries and tooltip rows. `up.key` and
   * `down.key` name two of these; any further entry is legend-only (give it `getValue: () => null`)
   * — which is how ABSENCE gets named, and it has to be: a hatched bar is the one mark on this
   * chart a reader cannot decode from either axis.
   */
  series: readonly ChartSeries<T>[]
  /** The pane drawn ABOVE the baseline. */
  up: MirroredBarPane
  /** The pane drawn BELOW the baseline. */
  down: MirroredBarPane
  /** The up pane's share of the bar band. Default 0.35 — the mirrored pair is usually asymmetric,
   * and splitting evenly spends most of the chart on empty space above the smaller half. */
  upFraction?: number
  /**
   * 0..1 of this bar's width no source sample covers, hatched across the FULL band height.
   *
   * Full height, both panes, deliberately: a hatch drawn on one pane only reads as "that half
   * measured zero", which is the measured-and-idle state absence must stay distinguishable from.
   */
  getAbsentFraction?: (d: T) => number
  /** Per-datum bar opacity — a real but qualified measurement (a short bucket, a partial interval)
   * drawn dimmer. Default 1. */
  getBarOpacity?: (d: T) => number
  /** Fixed height in px, forwarded to `ChartFrame`. Default 240. */
  height?: number
  fill?: boolean
  formatX?: (key: string) => string
  xTickValues?: (keys: readonly string[], plotWidth: number) => readonly string[]
  fold?: BandFold<T>
  /** Default `'leading'` — see `BandStripProps.cursorResolution`. */
  cursorResolution?: CursorResolution
  tooltip?: BandTooltipConfig<T> | false
  legend?: ChartLegendConfig | false
  /** Series key whose colour the absence hatch is drawn in. Default `VX.neutral`. */
  absentState?: string
  margin?: Partial<ChartMargin>
  ariaLabel?: string
  isPending?: boolean
}

const DEFAULT_UP_FRACTION = 0.35
const DEFAULT_PANE_TICKS = 3

/**
 * Two bar panes over ONE x scale and one cursor, mirrored around a shared baseline, each in its
 * own independent domain.
 *
 * **Why not `DualPanel`.** `DualPanel`'s two panes are a LINE pane and a signed-histogram pane: it
 * requires `series` to be line series it draws with `LinePath`, and its bottom pane takes a single
 * signed `getBar` over one symmetric `[-maxAbs, maxAbs]` scale. Neither half fits. Two independent
 * magnitudes mirrored around a baseline are not one signed quantity — a 220 kB/s down and a 20 kB/s
 * up are two readings, not `+220` and `−20` of one — and forcing them onto one scale is exactly the
 * flattening this shape exists to avoid. Bending `DualPanel` to cover it would mean a
 * `topMark: 'line' | 'bars'` switch, a second value accessor, and a per-pane domain law that
 * contradicts its symmetric one: a fork of its internals wearing one name. It composes the same
 * `useBandPlot` choreography instead, which is where the sharing actually belongs.
 */
function MirroredBarsInner<T>(props: MirroredBarsProps<T>) {
  const { series, chartId, height, fill, legend, ariaLabel, isPending } = props

  return (
    <ChartFrame
      series={series}
      chartId={chartId}
      {...(height !== undefined && { height })}
      {...(fill !== undefined && { fill })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
      legend={resolveLegend(legend)}
    >
      {(plot) => <MirroredBarsPlot {...props} plot={plot} />}
    </ChartFrame>
  )
}

type MirroredBarsPlotProps<T> = MirroredBarsProps<T> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
}

/** The measured plot — split so the scale/cursor hooks only run once `ChartFrame` has resolved a
 * non-empty plot rect (parity with `DualPanel`). */
function MirroredBarsPlot<T>(props: MirroredBarsPlotProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    up,
    down,
    upFraction = DEFAULT_UP_FRACTION,
    getAbsentFraction,
    getBarOpacity,
    formatX = fmtAxisDate,
    xTickValues,
    fold,
    cursorResolution = 'leading',
    tooltip,
    absentState,
    margin: marginOverride,
    ariaLabel,
    plot,
  } = props

  const { hidden } = plot
  const seriesByKey = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])
  const upSeries = seriesByKey.get(up.key)
  const downSeries = seriesByKey.get(down.key)
  const upVisible = upSeries !== undefined && !hidden.has(up.key)
  const downVisible = downSeries !== undefined && !hidden.has(down.key)

  // ── Pass 1: the two domains and their tick labels, both independent of the pixel rect ────────
  const upMax = usePaneMax(data, upSeries, up, upVisible)
  const downMax = usePaneMax(data, downSeries, down, downVisible)
  const upTicks = up.ticks ?? DEFAULT_PANE_TICKS
  const downTicks = down.ticks ?? DEFAULT_PANE_TICKS

  const leftLabels = useMemo(() => {
    const labels: string[] = []
    if (upVisible) {
      labels.push(
        ...probeAxisLabels({ domain: [0, upMax], ticks: upTicks, format: up.format }).labels,
      )
    }
    if (downVisible) {
      labels.push(
        ...probeAxisLabels({ domain: [0, downMax], ticks: downTicks, format: down.format }).labels,
      )
    }
    return labels
  }, [upVisible, downVisible, upMax, downMax, upTicks, downTicks, up.format, down.format])

  const band = useBandPlot<T>({
    data,
    chartId,
    getX,
    formatX,
    width: plot.width,
    cursorResolution,
    leftLabels,
    ...(fold !== undefined && { fold }),
    ...(xTickValues !== undefined && { xTickValues }),
    ...(marginOverride !== undefined && { margin: marginOverride }),
    ...(tooltip !== undefined && { tooltip }),
  })

  const { bands, margin, plotWidth, scale, cursor, point, crosshairX, step, bandWidth } = band

  // ── Pass 2: the pane rects, now that the plot height is known ───────────────────────────────
  const barBand = Math.max(plot.height - margin.top - margin.bottom, 2)
  const upHeight = Math.max(Math.round(barBand * upFraction), 1)
  const downHeight = Math.max(barBand - upHeight, 1)
  const baseline = upHeight

  const upScale = useMemo(
    () => scaleLinear<number>({ domain: [0, upMax], range: [0, upHeight] }),
    [upMax, upHeight],
  )
  const downScale = useMemo(
    () => scaleLinear<number>({ domain: [0, downMax], range: [0, downHeight] }),
    [downMax, downHeight],
  )
  // The up AXIS reads top-to-bottom while the up BARS grow bottom-to-top, so its scale is the
  // reverse of `upScale`. Same domain, same range — only the direction differs.
  const upAxisScale = useMemo(
    () => scaleLinear<number>({ domain: [upMax, 0], range: [0, upHeight] }),
    [upMax, upHeight],
  )

  const hatchId = `${chartId}-mirrored-absent`
  const absentColor =
    (absentState === undefined ? undefined : seriesByKey.get(absentState)?.color) ?? VX.neutral

  const drawnUp = upVisible ? upSeries : undefined
  const drawnDown = downVisible ? downSeries : undefined

  const bars = useMemo<ReactNode[]>(() => {
    const out: ReactNode[] = []
    bands.forEach((d, i) => {
      const x = i * step
      const absent = Math.min(Math.max(getAbsentFraction?.(d) ?? 0, 0), 1)
      const measuredWidth = bandWidth * (1 - absent)
      const hatchWidth = bandWidth - measuredWidth
      const opacity = getBarOpacity?.(d) ?? 1
      // `Number.isNaN` as well as null: `deriveTooltipRows` skips only null, and a NaN reaching
      // `scaleLinear` produces NaN `y`/`height` attributes — a bar that silently fails to paint
      // while React logs a warning nobody reads. Same guard `DualPanel` applies to its line paths.
      const upValue = finiteOrNull(drawnUp?.getValue(d))
      const downValue = finiteOrNull(drawnDown?.getValue(d))
      out.push(
        <g key={getX(d)}>
          {measuredWidth > 0 && drawnUp !== undefined && upValue !== null && (
            <rect
              x={x}
              y={baseline - upScale(upValue)}
              width={measuredWidth}
              height={Math.max(upScale(upValue), upValue > 0 ? 1 : 0)}
              fill={alpha(drawnUp.color, opacity)}
              pointerEvents="none"
            />
          )}
          {measuredWidth > 0 && drawnDown !== undefined && downValue !== null && (
            <rect
              x={x}
              y={baseline}
              width={measuredWidth}
              height={Math.max(downScale(downValue), downValue > 0 ? 1 : 0)}
              fill={alpha(drawnDown.color, opacity)}
              pointerEvents="none"
            />
          )}
          {hatchWidth > 0 && (
            <rect
              x={x + measuredWidth}
              y={0}
              width={hatchWidth}
              height={barBand}
              fill={hatchFill(hatchId)}
              pointerEvents="none"
            />
          )}
        </g>,
      )
    })
    return out
  }, [
    bands,
    step,
    bandWidth,
    barBand,
    baseline,
    getX,
    getAbsentFraction,
    getBarOpacity,
    drawnUp,
    drawnDown,
    upScale,
    downScale,
    hatchId,
  ])

  if (plotWidth <= 0 || bands.length === 0) return null

  const cfg = tooltip === false ? undefined : tooltip
  const badge = cfg?.label === undefined || point === null ? null : cfg.label(point)
  // Each pane's row falls back to ITS OWN axis formatter, never the other pane's — the two panes
  // are in different units by construction (an explicit per-series `formatValue` still wins).
  const visibleSeries = series
    .filter((s) => !hidden.has(s.key))
    .map((s) => {
      if (s.formatValue !== undefined) return s
      if (s.key === up.key) return { ...s, formatValue: (v: number) => up.format(v) }
      if (s.key === down.key) return { ...s, formatValue: (v: number) => down.format(v) }
      return s
    })
  const rows = point === null ? [] : deriveTooltipRows(visibleSeries, point, down.format)

  return (
    <>
      <svg ref={band.svgRef} width={plot.width} height={plot.height}>
        <defs>
          <HatchPattern
            id={hatchId}
            color={absentColor}
            opacity={0.7}
            size={hatchSizeFor(bandWidth)}
          />
        </defs>
        {/* theme-allow-file basalt/hand-rolled-plot — TWO bar panes over one x scale, in two
            INDEPENDENT domains mirrored around a shared baseline. `CartesianChart`'s contract is a
            single plot rect with one or two numeric y axes measured against the same marks, so it
            cannot express two panes; `DualPanel` is the wrong shape for the reason this kind's own
            docblock argues. Assembled from the SAME parts every other chart gets — `ChartFrame`,
            `autoMargin`, `useChartCursor`, `ChartTooltipFloat` — through `useBandPlot`, shared with
            `BandStrip` rather than copied from it. */}
        <Group left={margin.left} top={margin.top}>
          {bars}

          {/* One axis per pane, each in its own scale's units — a single shared axis would be
              wrong for at least one of them whenever the two domains differ, which is always. */}
          {upVisible && (
            <AxisLeftNumeric
              scale={upAxisScale}
              numTicks={upTicks}
              tickFormat={(v) => up.format(Number(v))}
            />
          )}
          {downVisible && (
            <Group top={baseline}>
              <AxisLeftNumeric
                scale={downScale}
                numTicks={downTicks}
                tickFormat={(v) => down.format(Number(v))}
              />
            </Group>
          )}

          <line
            x1={0}
            x2={plotWidth}
            y1={baseline}
            y2={baseline}
            stroke={VX.axisStroke}
            strokeWidth={1}
          />

          {crosshairX !== null && <Crosshair x={crosshairX} top={0} bottom={barBand} />}

          <AxisBottomDate
            top={barBand}
            scale={scale}
            tickValues={band.tickValues}
            tickFormat={(v) => formatX(String(v))}
          />

          <HoverOverlay
            width={plotWidth}
            height={barBand}
            onMove={cursor.onPointerMove}
            onLeave={cursor.onPointerLeave}
            onKeyDown={cursor.onKeyDown}
            onBlur={cursor.onBlur}
            valueMax={Math.max(bands.length - 1, 0)}
            {...(point !== null && {
              valueNow: bands.indexOf(point),
              valueText: formatX(getX(point)),
            })}
            {...(ariaLabel !== undefined && { ariaLabel })}
          />
        </Group>
      </svg>

      {band.showTooltip && point !== null && (
        <ChartTooltipFloat anchor={band.tooltipAnchor} ariaLive={band.ariaLive}>
          <TooltipHeader
            date={getX(point)}
            {...(cfg?.formatHeader !== undefined && {
              format: (key: string) => cfg.formatHeader?.(key, point) ?? key,
            })}
            {...(badge !== null && { label: badge.text, labelColor: badge.color })}
          />
          <TooltipBody>
            {cfg?.prependRows?.(point, { hidden })}
            {rows.map((row) => (
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
            {cfg?.extraRows?.(point, { hidden })}
          </TooltipBody>
        </ChartTooltipFloat>
      )}
    </>
  )
}

/** A drawable value, or null. See the call site for why NaN is not drawable. */
function finiteOrNull(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v
}

/**
 * One pane's upper bound. `|| 1` guards a window with no traffic at all — a zero-width domain
 * renders as NaN geometry rather than as an empty chart.
 */
function usePaneMax<T>(
  data: readonly T[],
  paneSeries: ChartSeries<T> | undefined,
  pane: MirroredBarPane,
  visible: boolean,
): number {
  return useMemo(() => {
    if (pane.max !== undefined && pane.max !== 'auto') return pane.max || 1
    if (!visible || paneSeries === undefined) return 1
    let max = 0
    for (const d of data) {
      const v = paneSeries.getValue(d)
      if (v === null || Number.isNaN(v)) continue
      if (v > max) max = v
    }
    const floored = pane.autoMaxFloor === undefined ? max : Math.max(max, pane.autoMaxFloor)
    return floored || 1
  }, [data, paneSeries, pane.max, pane.autoMaxFloor, visible])
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot kind is wrapped in
 * `React.memo` to retain the auto-memoization it had as source (parity with `DualPanel`).
 */
export const MirroredBars = memo(MirroredBarsInner) as typeof MirroredBarsInner
