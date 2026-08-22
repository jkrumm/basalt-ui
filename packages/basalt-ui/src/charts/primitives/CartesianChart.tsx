import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { VX } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import type { CursorResolution } from '../cursor/resolve'
import { useChartCursor } from '../hooks/useChartCursor'
import { autoMargin, probeAxisLabels } from '../layout/auto-margin'
import { deriveTooltipRows } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { padAutoLower, padAutoUpper } from '../utils/domain'
import { fmtAxisDate } from '../utils/format'
import { smartTicks, smartTicksEvery } from '../utils/ticks'
import { AxisBottomDate, AxisLeftNumeric, AxisRightNumeric } from './Axes'
import { ChartFrame, resolveLegend } from './ChartFrame'
import { ChartTooltipFloat, TooltipBody, TooltipHeader, TooltipRow } from './ChartTooltip'
import { Crosshair, SeriesDot } from './Crosshair'
import { HoverOverlay } from './HoverOverlay'
import { XZoneRects } from './XZoneRects'
import type { XZoneSpec } from './XZoneRects'
import { ZoneRects } from './ZoneRects'
import type { ZoneSpec } from './ZoneRects'

type LinearScale = ReturnType<typeof scaleLinear<number>>
type PointScale = ReturnType<typeof scalePoint<string>>

const DEFAULT_TICKS = 5
const DEFAULT_AUTO_PAD = 1.1

/** One y-axis, fully described. Collapses the removed `yDomain` / `yAutoMaxFloor` / `yAutoMinCeil` /
 * `yAutoPad` / `numTicksY` / `formatYTick` prop soup into a single object per axis. */
export type AxisConfig<T> = {
  /**
   * `'auto'` (default) derives the domain from the VISIBLE series; a tuple fixes it; a function
   * computes it from the data — the seam a stacked chart uses to sum its bands. The function also
   * receives the visible series, so a stacked domain SHRINKS when the legend toggles a band off
   * (summing `props.series` there would leave a permanent gap above the stack).
   */
  domain?:
    | [number, number]
    | 'auto'
    | ((data: readonly T[], visible: readonly ChartSeries<T>[]) => [number, number])
  /**
   * When 'auto': the raw upper bound is at least this, and padding is applied AFTER — mirroring
   * `autoMinCeil`, which clamps first and pads second. A floor that padded before the clamp used
   * to land the axis top exactly on the floor value with zero headroom.
   */
  autoMaxFloor?: number
  /** When 'auto': the lower bound is at most this. Default 0 (forced zero baseline). `Infinity`
   * pads down from the raw data minimum instead. */
  autoMinCeil?: number
  /** When 'auto': padding multiplier applied away from the data. Default 1.1. */
  autoPad?: number
  ticks?: number
  /** Tick + tooltip formatter for this axis. Defaults to d3's own tick format. */
  format?: (v: number) => string
  /** Horizontal grid rules. Default: on for the left axis, off for the right. */
  grid?: boolean
  /**
   * Round the scale's domain outward to nice tick values (d3's `scale.nice()`). Threaded to BOTH
   * `probeAxisLabels` (measurement) and the real `scaleLinear` (rendering) — they must agree, or
   * the measured margin is computed from ticks the axis never paints.
   *
   * Default `false`, deliberately: flipping the default would move the domain of every
   * already-migrated chart. Opt in per axis.
   */
  nice?: boolean
}

/** Handed to `prependRows`/`extraRows` alongside the hovered datum — the same `visible`/`hidden`
 * the plot itself draws from, so a hand-authored row can't structurally desync from legend
 * toggling. */
export type CartesianTooltipRowContext<T> = {
  visible: readonly ChartSeries<T>[]
  hidden: ReadonlySet<string>
}

export type CartesianTooltipConfig<T> = {
  /**
   * Default true — the tooltip tracks the pointer. Set false to ANCHOR it to the crosshair at the
   * plot's top edge instead, which reads better across a column of charts sharing one cursor
   * (every tooltip then lines up on the same x). Anchoring costs one `getBoundingClientRect` per
   * hovered frame, which is why following stays the default.
   */
  follow?: boolean
  /** Right-aligned badge in the tooltip header (e.g. a status label). */
  label?: (d: T) => { text: string; color: string } | null
  /**
   * Overrides the tooltip header's date text. Default: `TooltipHeader`'s own `fmtTooltipDate`
   * behavior, unchanged. `fmtTooltipDate` regexes `YYYY-MM-DD` out of the domain key and builds a
   * LOCAL `Date` from it — a UTC ISO key then names the wrong day next to `formatX`, the tooltip
   * badge, and every sibling chart, which all resolve locally. Receives the raw `getX` key
   * alongside the hovered datum, so a caller can format from either.
   */
  formatHeader?: (key: string, d: T) => string
  /** Rows rendered BEFORE the derived per-series rows (a total, a context line). The second
   * argument carries the same `visible`/`hidden` the plot draws from, so a hand-authored row
   * stays in sync with legend toggling instead of naming a series the plot no longer draws. */
  prependRows?: (d: T, ctx: CartesianTooltipRowContext<T>) => ReactNode
  /** Rows appended after the derived per-series rows. Same `ctx` as {@link prependRows}. */
  extraRows?: (d: T, ctx: CartesianTooltipRowContext<T>) => ReactNode
  /**
   * Render this chart's tooltip when it is a cursor FOLLOWER (the crosshair came from a sibling
   * chart sharing the cursor), not only when this chart is the SOURCE. Default false — today's
   * behaviour, nothing moves. A follower has no pointer under it, so its tooltip is always ANCHORED
   * to the crosshair — the same positioning `follow: false` gives the source — regardless of what
   * `follow` is set to on this chart: there is no other valid position for a chart nobody is
   * hovering. `follow` keeps governing the SOURCE's own tooltip exactly as before; the two options
   * only interact for a follower, where `onFollow` always wins on positioning. Only the SOURCE's
   * tooltip is `aria-live` — followers announce nothing, so a shared-cursor page doesn't fire N
   * live-region updates per pointer move.
   *
   * Cost, since it scales with the page rather than the chart: anchoring reads one
   * `getBoundingClientRect` per hovered frame (the same cost `follow: false` documents), so N
   * opted-in followers pay N of them per frame. That is the reason this is opt-in per chart rather
   * than a page-level switch — turn it on for the charts a reader actually correlates.
   */
  onFollow?: boolean
}

/** Everything a mark renderer needs. Handed to `CartesianChart`'s child on every render. */
export type PlotContext<T> = {
  data: readonly T[]
  /** Series minus the ones the legend has toggled off — draw THESE, not `props.series`. */
  visible: ChartSeries<T>[]
  hidden: ReadonlySet<string>
  xScale: PointScale
  yScale: LinearScale
  /** Present only when a `y2` axis is configured. */
  y2Scale: LinearScale | null
  xMax: number
  yMax: number
  margin: ChartMargin
  /** The point the shared cursor currently rests on, or null. */
  cursorPoint: T | null
  /** Series key the legend is hovering, for mark dimming. */
  highlighted: string | null
}

export type CartesianChartProps<T> = {
  data: T[]
  /** Stable id — identifies this chart as the cursor's source. */
  chartId: string
  /** Extracts the x-domain key (a date or category string) from a point. */
  getX: (d: T) => string
  /** The single source of truth for marks, legend entries, and tooltip rows. */
  series: ChartSeries<T>[]
  y?: AxisConfig<T>
  /** Passing `y2` is what makes the chart dual-axis: it draws the right axis and widens the
   * right margin by measurement. Series opt in with `axis: 'right'`. */
  y2?: AxisConfig<T>
  /** Exact number of x ticks. Default: as many as fit (`smartTicks`). Ignored when
   * `xTickValues` is set. */
  xTicks?: number
  /**
   * Which domain keys get a tick, chosen from the full key list and the resolved plot width.
   * Takes precedence over `xTicks`; omit both for `smartTicks`.
   *
   * A COUNT is not always enough. `smartTicks`/`smartTicksEvery` append the final key
   * unconditionally, so when the step does not land on the last index that appended tick sits a
   * partial step from its neighbour — measured on a 24h window, two `DD.MM HH:MM` labels printed
   * on top of each other at the right edge, at every tick count. The only fix a count can express
   * is thinning the whole axis to avoid one crowded pair. A consumer whose labels are richer than
   * the default `DD.MM` needs to pick the VALUES, which until now meant measuring the container
   * itself with `useChartSize` to derive a count — the chart already knows its own width.
   *
   * `BandStrip`/`MirroredBars` take the identical prop, so the seam does not fork by kind.
   */
  xTickValues?: (keys: readonly string[], xMax: number) => readonly string[]
  /** X tick label formatter. Default `fmtAxisDate` (DD.MM). */
  formatX?: (key: string) => string
  /** Value-range bands on the left scale, drawn behind the marks. */
  zones?: ZoneSpec[]
  /** X-range bands (time windows), drawn behind the marks. */
  xZones?: XZoneSpec[]
  refLines?: { value: number; color: string; dashed?: boolean; axis?: 'left' | 'right' }[]
  height?: number
  aspectRatio?: number
  fill?: boolean
  legend?: ChartLegendConfig | false
  /** `false` disables the tooltip entirely (and with it the crosshair dots). */
  tooltip?: CartesianTooltipConfig<T> | false
  /** Per-side overrides of the measured margins — the escape hatch, applied last. */
  margin?: Partial<ChartMargin>
  /**
   * Where this series' crosshair dot sits, as a value in the axis domain. Defaults to
   * `series.getValue`, which is correct for every unstacked chart. A STACKED chart must override
   * it with the cumulative band top — otherwise its dots sit at each band's raw value, off the
   * line the reader is actually looking at.
   */
  cursorValue?: (
    point: T,
    series: ChartSeries<T>,
    visible: readonly ChartSeries<T>[],
  ) => number | null
  /**
   * How a sibling chart's broadcast cursor key resolves against THIS chart's points. Default
   * `'nearest'`, correct when `getX` returns an instant. Pass `'leading'` when it returns a
   * bucket's leading edge (a weekly series keyed by its Monday): under `'nearest'` a hover landing
   * in the back half of a bucket resolves to the FOLLOWING bucket, so the shared crosshair sits
   * one column right of the data the reader is pointing at.
   */
  cursorResolution?: CursorResolution
  ariaLabel?: string
  isPending?: boolean
  /** Draw ONLY the marks. Everything around them is the primitive's job. */
  children: (ctx: PlotContext<T>) => ReactNode
}

/**
 * Resolve one axis' `[min, max]` from its {@link AxisConfig} and the VISIBLE series. Exported for
 * testing and for a hand-composed kind that needs the same auto-domain law `CartesianChart`
 * applies (rather than reinventing the padding rules per chart).
 */
export function resolveAxisDomain<T>(
  cfg: AxisConfig<T> | undefined,
  data: readonly T[],
  series: readonly ChartSeries<T>[],
  /**
   * Values that must stay inside the plot even though no series reports them — the bounds of the
   * zones and reference lines pinned to THIS axis. Without them a target zone or a stretch-goal
   * ref line sitting past the data silently clips, which is precisely the case those overlays
   * exist for. Infinite bounds ("top/bottom of axis") are ignored: they clamp to the domain by
   * definition and would otherwise blow it up.
   */
  extraBounds: readonly number[] = [],
): [number, number] {
  const domain = cfg?.domain ?? 'auto'
  if (Array.isArray(domain)) return domain
  if (typeof domain === 'function') return domain(data, series)

  let min = Infinity
  let max = -Infinity
  for (const d of data) {
    for (const s of series) {
      const v = s.getValue(d)
      if (v === null) continue
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  for (const v of extraBounds) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === Infinity) return [0, cfg?.autoMaxFloor ?? 1]

  const pad = cfg?.autoPad ?? DEFAULT_AUTO_PAD
  const ceil = cfg?.autoMinCeil ?? 0
  // Symmetric with the lower bound: clamp the RAW value against the floor/ceiling first, then pad
  // once, away from zero. Padding before the clamp (the old law) lands a floored axis top exactly
  // on the floor with zero headroom — a target line pinned there sits glued to the plot edge.
  const upper = padAutoUpper(Math.max(max, cfg?.autoMaxFloor ?? -Infinity), pad)
  const lower = padAutoLower(Math.min(min, ceil), pad)
  // A flat series (every value identical, the all-zero case included) collapses to `[n, n]`,
  // which is a scale with no extent: every point maps to the same pixel and the line renders as a
  // dot on the axis. Give it the same usable baseline the empty-data branch above gets.
  if (lower === upper) return [Math.min(lower, 0), upper === 0 ? 1 : upper * pad]
  return [lower, upper]
}

/**
 * The cartesian chart primitive — the rung that was missing between `ChartFrame` and raw visx
 * (`docs/CHARTS-SPEC.md` §2).
 *
 * It owns, once, everything every chart repeated: measured margins, both y scales and their
 * domains, the x scale and its tick thinning, grid, zones, axes, the shared cursor, the crosshair
 * and its per-series dots, the hover/keyboard overlay, and the derived tooltip. The child draws
 * marks and nothing else, so two charts cannot drift apart in any of those layers — that identity
 * IS the consistency guarantee.
 *
 * Margins are MEASURED from the labels that will actually be painted, so a wide tick label widens
 * its own gutter instead of clipping or needing a hand-tuned `margin` prop.
 */
export function CartesianChart<T>({
  data,
  chartId,
  getX,
  series,
  y,
  y2,
  xTicks,
  xTickValues,
  formatX = fmtAxisDate,
  zones,
  xZones,
  refLines,
  height,
  aspectRatio,
  fill,
  legend,
  tooltip,
  margin: marginOverride,
  cursorValue,
  cursorResolution,
  ariaLabel,
  isPending,
  children,
}: CartesianChartProps<T>): ReactNode {
  const [highlighted, setHighlighted] = useState<string | null>(null)

  return (
    <ChartFrame
      series={series}
      chartId={chartId}
      {...(height !== undefined && { height })}
      {...(aspectRatio !== undefined && { aspectRatio })}
      {...(fill !== undefined && { fill })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
      legend={resolveLegend(legend, { highlighted, onHighlight: setHighlighted })}
    >
      {(plot) => (
        <CartesianPlot
          data={data}
          chartId={chartId}
          getX={getX}
          series={series}
          {...(y !== undefined && { y })}
          {...(y2 !== undefined && { y2 })}
          {...(xTicks !== undefined && { xTicks })}
          {...(xTickValues !== undefined && { xTickValues })}
          formatX={formatX}
          {...(zones !== undefined && { zones })}
          {...(xZones !== undefined && { xZones })}
          {...(refLines !== undefined && { refLines })}
          {...(tooltip !== undefined && { tooltip })}
          {...(marginOverride !== undefined && { marginOverride })}
          {...(cursorValue !== undefined && { cursorValue })}
          {...(cursorResolution !== undefined && { cursorResolution })}
          {...(ariaLabel !== undefined && { ariaLabel })}
          plot={plot}
          highlighted={highlighted}
        >
          {children}
        </CartesianPlot>
      )}
    </ChartFrame>
  )
}

type CartesianPlotProps<T> = Omit<
  CartesianChartProps<T>,
  'height' | 'aspectRatio' | 'fill' | 'legend' | 'isPending' | 'margin'
> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
  highlighted: string | null
  marginOverride?: Partial<ChartMargin>
}

/** Split from {@link CartesianChart} so scale + margin work runs only once the frame has resolved
 * a non-empty plot rect (and so the hook order never depends on that rect). */
function CartesianPlot<T>({
  data,
  chartId,
  getX,
  series,
  y,
  y2,
  xTicks,
  xTickValues,
  formatX = fmtAxisDate,
  zones,
  xZones,
  refLines,
  tooltip,
  marginOverride,
  cursorValue,
  cursorResolution,
  ariaLabel,
  plot,
  highlighted,
  children,
}: CartesianPlotProps<T>): ReactNode {
  const { hidden } = plot

  const visible = useMemo(() => series.filter((s) => !hidden.has(s.key)), [series, hidden])
  const leftSeries = useMemo(() => visible.filter((s) => s.axis !== 'right'), [visible])
  const rightSeries = useMemo(() => visible.filter((s) => s.axis === 'right'), [visible])

  // Honest deps on the accessors, deliberately: a ref would keep the scales, ticks and margins
  // keyed on `data` alone, and then swapping which field `getX` reads (a field picker over the
  // same rows) would render marks through a new accessor against stale scales. The re-render this
  // costs is narrower than it looks — a cursor move re-renders `CartesianPlot` without changing
  // its props, so hover frames reuse these memos regardless.
  const keys = useMemo(() => data.map(getX), [data, getX])

  // ── Pass 1: domains + tick labels, both independent of the pixel range ──────────────────────
  // This is what breaks the margin/scale circularity: a linear scale's tick VALUES depend only on
  // its domain, so the labels can be measured before the plot rect exists.
  // Overlay bounds per axis — see `resolveAxisDomain`'s `extraBounds`.
  const [leftBounds, rightBounds] = useMemo(() => {
    const left: number[] = []
    const right: number[] = []
    for (const z of zones ?? []) (z.axisSide === 'right' ? right : left).push(z.from, z.to)
    for (const l of refLines ?? []) (l.axis === 'right' ? right : left).push(l.value)
    return [left, right]
  }, [zones, refLines])

  const leftDomain = useMemo(
    () => resolveAxisDomain(y, data, leftSeries, leftBounds),
    [y, data, leftSeries, leftBounds],
  )
  const rightDomain = useMemo(
    () => (y2 === undefined ? null : resolveAxisDomain(y2, data, rightSeries, rightBounds)),
    [y2, data, rightSeries, rightBounds],
  )

  const leftTicks = y?.ticks ?? DEFAULT_TICKS
  const rightTicks = y2?.ticks ?? DEFAULT_TICKS

  const { labels: leftLabels, format: leftFormat } = useMemo(
    () =>
      probeAxisLabels({
        domain: leftDomain,
        ticks: leftTicks,
        nice: y?.nice ?? false,
        ...(y?.format !== undefined && { format: y.format }),
      }),
    [leftDomain, leftTicks, y?.format, y?.nice],
  )

  const { labels: rightLabels, format: rightFormat } = useMemo(
    () =>
      rightDomain === null
        ? { labels: [], format: (v: number) => String(v) }
        : probeAxisLabels({
            domain: rightDomain,
            ticks: rightTicks,
            nice: y2?.nice ?? false,
            ...(y2?.format !== undefined && { format: y2.format }),
          }),
    [rightDomain, rightTicks, y2?.format, y2?.nice],
  )

  const xLabels = useMemo(() => keys.map(formatX), [keys, formatX])

  const margin = useMemo(
    () =>
      autoMargin({
        left: leftLabels,
        right: rightLabels,
        bottom: xLabels,
        ...(marginOverride !== undefined && { override: marginOverride }),
      }),
    [leftLabels, rightLabels, xLabels, marginOverride],
  )

  // ── Pass 2: the real scales, now that the plot rect is known ────────────────────────────────
  const xMax = Math.max(plot.width - margin.left - margin.right, 0)
  const yMax = Math.max(plot.height - margin.top - margin.bottom, 0)

  const xScale = useMemo(
    () => scalePoint<string>({ domain: keys, range: [0, xMax], padding: 0.5 }),
    [keys, xMax],
  )
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: leftDomain,
        range: [yMax, 0],
        ...(y?.nice === true && { nice: true }),
      }),
    [leftDomain, yMax, y?.nice],
  )
  const y2Scale = useMemo(
    () =>
      rightDomain === null
        ? null
        : scaleLinear<number>({
            domain: rightDomain,
            range: [yMax, 0],
            ...(y2?.nice === true && { nice: true }),
          }),
    [rightDomain, yMax, y2?.nice],
  )

  // Resolution order: explicit VALUES win, then an explicit COUNT, then as many as fit.
  const tickValues = useMemo(
    () =>
      xTickValues !== undefined
        ? [...xTickValues(keys, xMax)]
        : xTicks === undefined
          ? smartTicks(keys, xMax)
          : smartTicksEvery(keys, xTicks),
    [keys, xMax, xTicks, xTickValues],
  )

  const cursor = useChartCursor<T>({
    data,
    chartId,
    getKey: getX,
    xScale,
    marginLeft: margin.left,
    ...(cursorResolution !== undefined && { resolution: cursorResolution }),
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipEnabled = tooltip !== false
  const tooltipCfg = tooltip === false ? undefined : tooltip
  const point = cursor.point
  const cursorX = point === null ? null : (xScale(getX(point)) ?? null)
  const badge = tooltipCfg?.label === undefined || point === null ? null : tooltipCfg.label(point)
  const formatHeader = tooltipCfg?.formatHeader

  // Each series falls back to ITS OWN axis's tick format, so a right-axis value is never
  // formatted with the left axis's rules (an explicit per-series `formatValue` still wins).
  const tooltipSeries = useMemo(
    () =>
      visible.map((s) =>
        s.formatValue === undefined
          ? { ...s, formatValue: s.axis === 'right' ? rightFormat : leftFormat }
          : s,
      ),
    [visible, leftFormat, rightFormat],
  )

  const rows =
    tooltipEnabled && point !== null ? deriveTooltipRows(tooltipSeries, point, leftFormat) : []

  // This chart renders its tooltip either as the cursor SOURCE (always) or, opted in via
  // `onFollow`, as a FOLLOWER (a sibling owns the cursor). A follower has no pointer under it, so
  // it is always positioned via the anchored (crosshair) path below, regardless of `follow`.
  const isFollowerRender = !cursor.isSource && tooltipCfg?.onFollow === true
  const showTooltip = tooltipEnabled && point !== null && (cursor.isSource || isFollowerRender)

  // Anchored mode resolves the crosshair's plot-local x into viewport space; following mode uses
  // the pointer position `useChartCursor` already recorded. A follower render always anchors, since
  // `follow`'s pointer-tracking path has no pointer to read on this chart.
  const useAnchoredPosition = tooltipCfg?.follow === false || isFollowerRender
  const anchorX = useAnchoredPosition && point !== null && cursorX !== null ? cursorX : null
  const svgRect = anchorX === null ? undefined : svgRef.current?.getBoundingClientRect()
  const tooltipAnchor =
    svgRect === undefined || anchorX === null
      ? cursor.anchor
      : { x: svgRect.left + margin.left + anchorX, y: svgRect.top + margin.top }

  const ctx: PlotContext<T> = {
    data,
    visible,
    hidden,
    xScale,
    yScale,
    y2Scale,
    xMax,
    yMax,
    margin,
    cursorPoint: point,
    highlighted,
  }

  return (
    <>
      <svg ref={svgRef} width={plot.width} height={plot.height}>
        <Group left={margin.left} top={margin.top}>
          {(y?.grid ?? true) && (
            <GridRows scale={yScale} width={xMax} stroke={VX.grid} numTicks={leftTicks} />
          )}
          {xZones !== undefined && <XZoneRects zones={xZones} height={yMax} xScale={xScale} />}
          {zones !== undefined && (
            <ZoneRects zones={zones} width={xMax} leftScale={yScale} rightScale={y2Scale} />
          )}

          {children(ctx)}

          {refLines?.map((line) => {
            const scale = line.axis === 'right' && y2Scale !== null ? y2Scale : yScale
            return (
              <line
                key={`${line.axis ?? 'left'}-${line.value}`}
                x1={0}
                x2={xMax}
                y1={scale(line.value)}
                y2={scale(line.value)}
                stroke={line.color}
                strokeWidth={1}
                strokeDasharray={line.dashed === true ? VX.dashArray : undefined}
              />
            )
          })}

          {tooltipEnabled && point !== null && cursorX !== null && (
            <>
              <Crosshair x={cursorX} top={0} bottom={yMax} />
              {visible.map((s) => {
                // A dot on a bar is noise — the hovered column is already marked by the crosshair,
                // and the dot would land inside the fill rather than on an edge a reader tracks.
                if (s.mark === 'bar') return null
                const value =
                  cursorValue === undefined ? s.getValue(point) : cursorValue(point, s, visible)
                if (value === null) return null
                const scale = s.axis === 'right' && y2Scale !== null ? y2Scale : yScale
                const marker = s.getMarker?.(point)
                return (
                  <SeriesDot
                    key={s.key}
                    cx={cursorX}
                    cy={scale(value)}
                    color={marker?.color ?? s.color}
                    {...(marker?.r !== undefined && { r: marker.r })}
                  />
                )
              })}
            </>
          )}

          <AxisLeftNumeric
            scale={yScale}
            numTicks={leftTicks}
            tickFormat={(v) => leftFormat(Number(v))}
          />
          {y2Scale !== null && (
            <AxisRightNumeric
              scale={y2Scale}
              left={xMax}
              numTicks={rightTicks}
              tickFormat={(v) => rightFormat(Number(v))}
            />
          )}
          <AxisBottomDate
            top={yMax}
            scale={xScale}
            tickValues={tickValues}
            tickFormat={(v) => formatX(String(v))}
          />

          <HoverOverlay
            width={xMax}
            height={yMax}
            onMove={cursor.onPointerMove}
            onLeave={cursor.onPointerLeave}
            onKeyDown={cursor.onKeyDown}
            onBlur={cursor.onBlur}
            valueMax={Math.max(data.length - 1, 0)}
            {...(point !== null && {
              valueNow: data.indexOf(point),
              valueText: formatX(getX(point)),
            })}
            {...(ariaLabel !== undefined && { ariaLabel })}
          />
        </Group>
      </svg>

      {showTooltip && (
        <ChartTooltipFloat anchor={tooltipAnchor} ariaLive={cursor.isSource}>
          <TooltipHeader
            date={getX(point)}
            {...(formatHeader !== undefined && {
              format: (key: string) => formatHeader(key, point),
            })}
            {...(badge !== null && { label: badge.text, labelColor: badge.color })}
          />
          <TooltipBody>
            {tooltipCfg?.prependRows?.(point, { visible, hidden })}
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
            {tooltipCfg?.extraRows?.(point, { visible, hidden })}
          </TooltipBody>
        </ChartTooltipFloat>
      )}
    </>
  )
}
