import { curveMonotoneX } from '@visx/curve'
import { LinePath } from '@visx/shape'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { CartesianTooltipConfig, AxisConfig, PlotContext } from '../primitives/CartesianChart'
import { CartesianChart } from '../primitives/CartesianChart'
import type { XZoneSpec } from '../primitives/XZoneRects'
import type { ZoneSpec } from '../primitives/ZoneRects'
import { LINE_OVERLAY_STROKE_WIDTH } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { VX } from '../../tokens'

export type MultiLineProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to `CartesianChart`. Default 240. */
  height?: number
  chartId: string
  /** Extracts the x-axis category (date string) from a data point. */
  getX: (d: T) => string
  /** 1+ line series sharing the y-axis(es) — the single source of truth for color, dash, legend,
   * and tooltip rows. A series opts into the right axis with `axis: 'right'`. */
  series: ChartSeries<T>[]
  /** Left y-axis. Collapses the old `yDomain` / `yAutoMaxFloor` / `yAutoMinCeil` / `yAutoPad` /
   * `numTicksY` / `formatYTick` prop soup into one object. */
  y?: AxisConfig<T>
  /** Right y-axis. Passing it is what makes the chart dual-axis — the margin widens by
   * measurement, and `axis: 'right'` series read against it. */
  y2?: AxisConfig<T>
  /** Horizontal value-range overlays (target zones), rendered behind the lines. */
  zones?: ZoneSpec[]
  /** Vertical x-range overlays (time windows), rendered behind the lines. Bounds are `getX`
   * domain keys. */
  xZones?: XZoneSpec[]
  /** Horizontal reference lines. Solid by default; set dashed: true for a dashed line. */
  refLines?: { value: number; color: string; dashed?: boolean }[]
  /** Exact number of x ticks. Default: as many as fit. */
  xTicks?: number
  /** Tooltip config — `label` for a right-aligned header badge, `extraRows` for rows appended
   * after the derived per-series rows. `false` disables the tooltip entirely. */
  tooltip?: CartesianTooltipConfig<T> | false
  /** Marker glyph for per-point markers. Default 'circle'. */
  markerShape?: 'circle' | 'star'
  /** Legend config forwarded to `CartesianChart`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded to `CartesianChart` as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
  /** Forwarded to `CartesianChart` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
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

type LinePt<T> = { __d: T; __y: number }

/** Per-series valid points (null-value gaps dropped). Reused by the lines and the markers. */
function seriesPoints<T>(series: ChartSeries<T>, data: readonly T[]): LinePt<T>[] {
  const pts: LinePt<T>[] = []
  for (const d of data) {
    const v = series.getValue(d)
    if (v !== null && v !== undefined && !Number.isNaN(v)) pts.push({ __d: d, __y: v })
  }
  return pts
}

/**
 * N series sharing one or two y-axes, with optional zones/reference lines, per-point markers
 * (PR stars / status dots), a dashed companion line per series, legend-hover dimming, and a
 * shared-cursor tooltip. Generalizes the multi-line argo charts (e1RM trend, relative
 * progression, training load, fitness trends).
 *
 * Composes `CartesianChart` for measuring, scales, grid, axes, cursor, and tooltip — this kind
 * draws ONLY the marks (lines + per-point markers). `series` is the single array that drives the
 * plotted lines, the legend, and the tooltip rows.
 *
 * X-axis is built from the full `data` array so the calendar is preserved even when a series
 * has nulls; each series line skips null points (creating visual gaps).
 */
function MultiLineInner<T>(props: MultiLineProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    y,
    y2,
    zones,
    xZones,
    refLines,
    xTicks,
    tooltip,
    markerShape = 'circle',
    height,
    legend,
    ariaLabel,
    isPending,
  } = props

  // Default line overlays to the redesign's 1.9px stroke (docs/DESIGN-SPEC.md §5) — applied once
  // here so the plotted line, the derived legend swatch, and the derived tooltip row all agree.
  const styledSeries = useMemo<ChartSeries<T>[]>(
    () => series.map((s) => ({ ...s, strokeWidth: s.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH })),
    [series],
  )

  return (
    <CartesianChart
      data={data}
      chartId={chartId}
      getX={getX}
      series={styledSeries}
      {...(y !== undefined && { y })}
      {...(y2 !== undefined && { y2 })}
      {...(zones !== undefined && { zones })}
      {...(xZones !== undefined && { xZones })}
      {...(refLines !== undefined && { refLines })}
      {...(xTicks !== undefined && { xTicks })}
      {...(tooltip !== undefined && { tooltip })}
      {...(height !== undefined && { height })}
      {...(legend !== undefined && { legend })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
    >
      {(ctx: PlotContext<T>) => <MultiLineMarks getX={getX} markerShape={markerShape} ctx={ctx} />}
    </CartesianChart>
  )
}

/** Draws lines + per-point markers for the visible series, dimming everything except the
 * legend-highlighted series (and its dashed companions, matched by `parent`). */
function MultiLineMarks<T>({
  getX,
  markerShape,
  ctx,
}: {
  getX: (d: T) => string
  markerShape: 'circle' | 'star'
  ctx: PlotContext<T>
}) {
  const { data, visible, xScale, yScale, y2Scale, highlighted } = ctx

  // Memoized per (visible, data), NOT recomputed per render: the cursor is a shared store now, so
  // every pointer frame re-renders every chart on the page. Without this, each frame walks the
  // full series × data grid twice (lines, then markers) and allocates a fresh point array for
  // each — the exact per-paint recompute the
  // pre-rebuild kind memoized away.
  const pointsBySeries = useMemo(() => {
    const m = new Map<string, LinePt<T>[]>()
    for (const s of visible) m.set(s.key, seriesPoints(s, data))
    return m
  }, [visible, data])

  // A series stays at full opacity when nothing is highlighted, when it IS the highlighted series,
  // or when it is a companion of the highlighted series (its `parent` matches).
  const dimOpacity = (s: ChartSeries<T>): number =>
    highlighted === null || s.key === highlighted || s.parent === highlighted ? 1 : 0.25

  const scaleFor = (s: ChartSeries<T>) =>
    s.axis === 'right' && y2Scale !== null ? y2Scale : yScale

  return (
    <>
      {visible.map((s) => {
        const valid = pointsBySeries.get(s.key) ?? []
        if (valid.length === 0) return null
        const scale = scaleFor(s)
        return (
          <LinePath<LinePt<T>>
            key={`line-${s.key}`}
            data={valid}
            x={(p) => xScale(getX(p.__d)) ?? 0}
            y={(p) => scale(p.__y)}
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH}
            strokeDasharray={s.dash === 'dashed' ? VX.dashArray : undefined}
            strokeOpacity={dimOpacity(s)}
            curve={curveMonotoneX}
          />
        )
      })}

      {visible.flatMap((s) => {
        const getMarker = s.getMarker
        if (!getMarker) return [] as ReactNode[]
        const scale = scaleFor(s)
        const op = dimOpacity(s)
        const markers: ReactNode[] = []
        for (const p of pointsBySeries.get(s.key) ?? []) {
          const m = getMarker(p.__d)
          if (m === null) continue
          const cx = xScale(getX(p.__d)) ?? 0
          const cy = scale(p.__y)
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
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot MultiLine kind is
 * wrapped in `React.memo` to retain the auto-memoization it had as source (parity with ZonedLine).
 */
export const MultiLine = memo(MultiLineInner) as typeof MultiLineInner
