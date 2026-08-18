import { curveMonotoneX } from '@visx/curve'
import { LinePath } from '@visx/shape'
import { memo, useMemo } from 'react'
import type { CursorResolution } from '../cursor/resolve'
import { VX } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import { CartesianChart } from '../primitives/CartesianChart'
import type { AxisConfig, CartesianTooltipConfig, PlotContext } from '../primitives/CartesianChart'
import type { ZoneSpec } from '../primitives/ZoneRects'
import { LINE_OVERLAY_STROKE_WIDTH } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { padAutoLower } from '../utils/domain'

/**
 * `T = unknown` is load-bearing, not a shortcut: it keeps a consumer's existing
 * `const bars: BarsBar[] = [...]` compiling (and still assignable to `BarsBar<Row>[]`,
 * contravariantly) even though the type is now generic over the datum.
 */
export type BarsBar<T = unknown> = {
  /** Field key — `getValue(d, key)` extracts the number (null = skip this slot, not domain hole). */
  key: string
  /** Tooltip + legend label. */
  label: string
  /** Fill color (a resolved CSS color / token ref). Per `docs/DESIGN-SPEC.md` §5, the primary bar
   * series should typically resolve to `VX.accent`, a secondary companion to `VX.faint`. */
  color: string
  /** Per-series tooltip value formatter — overrides the left/right axis's own format. Receives the
   * hovered datum alongside the value. */
  formatValue?: (v: number, d: T) => string
  /** Y axis to plot against. Honored only in grouped layout. Default 'left'. */
  axisSide?: 'left' | 'right'
  /** Relative width within the group (only honored in grouped layout). Default 1 — all bars equal. */
  weight?: number
  /** Default true; false = drawn and legended, but never listed as a tooltip row — threads
   * `SeriesStyle.tooltip` through `Bars`, replacing the removed per-kind `hideBarTooltipRows`. */
  tooltip?: boolean
}

export type BarsLine<T = unknown> = {
  key: string
  label: string
  color: string
  axisSide?: 'left' | 'right'
  strokeWidth?: number
  dashed?: boolean
  formatValue?: (v: number, d: T) => string
  /** Default true; false = drawn and legended, but never listed as a tooltip row. */
  tooltip?: boolean
  /** Dims the plotted stroke AND the legend swatch, never the tooltip row (`SeriesStyle.strokeOpacity`). */
  strokeOpacity?: number
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

export type BarsProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to `CartesianChart`. Default 240. */
  height?: number
  chartId: string
  getX: (d: T) => string
  /** Generic value accessor — given a data point and a bar/line key, returns the value or null. */
  getValue: (d: T, key: string) => number | null

  /** 1+ bar series, stacked when ≥2, plotted above baseline (y >= 0). */
  positiveBars: BarsBar<T>[]
  /** Optional bar series stacked below baseline (rendered as flipped negatives). */
  negativeBars?: BarsBar<T>[]

  /** 0–2 line overlays, each on left or right axis. */
  lines?: BarsLine<T>[]

  /** Horizontal value-range overlays (target zones, optimal bands). */
  zones?: BarsZone[]
  /** Dashed/solid horizontal reference lines. */
  refLines?: BarsRefLine[]

  /** Left axis config — bars always live here. In `barLayout: 'stacked'` (the default), `domain`
   * defaults to the summed per-point stack total (bars + any left-axis lines), not a per-series
   * max — the same function-domain seam `StackedArea` uses — unless overridden with a fixed tuple
   * or a custom function. Optional, like every other kind's — omit it for a plain auto domain. */
  y?: AxisConfig<T>
  /** Right axis config. Passing it is what makes the chart dual-axis: it draws the right axis and
   * widens the right margin by measurement. Line overlays (and grouped-layout bars) opt in with
   * `axisSide: 'right'`. */
  y2?: AxisConfig<T>

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

  /** X tick count override. Default: as many as fit. */
  xTicks?: number
  /** X tick label formatter. Default `fmtAxisDate` (DD.MM). */
  formatX?: (key: string) => string
  /**
   * How a sibling chart's broadcast cursor key resolves against this chart's points. Default
   * `'nearest'`. Pass `'leading'` when `getX` returns a bucket's leading edge (a weekly series
   * keyed by its Monday) — see `CursorResolution`.
   */
  cursorResolution?: CursorResolution

  /** `false` disables the tooltip entirely (and with it the crosshair dots). */
  tooltip?: CartesianTooltipConfig<T> | false
  /** Per-side overrides of the measured margins — the escape hatch, applied last. */
  margin?: Partial<ChartMargin>
  /** Legend config forwarded to `CartesianChart`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
  /** Forwarded to `CartesianChart` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
}

/**
 * Bars on a categorical x-axis with optional stacked negative series, 0–2 line
 * overlays on left/right axes, horizontal zones, and reference lines. Covers
 * diverging-stack + bar+line + any future stacked-bar preset.
 *
 * Composes `CartesianChart` (`docs/CHARTS-SPEC.md` §2) — margin, scales, grid, axes, the shared
 * cursor, the crosshair + per-series dots, and the tooltip are ALL the primitive's job. This file
 * draws only the bar rects, the line overlays, and (for a diverging stack) the zero baseline.
 *
 * X-axis is built from the full `data` array so the calendar is preserved even
 * with per-bar nulls (nulls become visual gaps, not domain holes).
 */
function BarsInner<T>(props: BarsProps<T>) {
  const {
    data,
    height,
    chartId,
    getX,
    getValue,
    positiveBars,
    negativeBars = [],
    lines = [],
    zones,
    refLines,
    y,
    y2,
    barWidthRatio = 0.6,
    barLayout = 'stacked',
    barOpacity,
    xTicks,
    formatX,
    cursorResolution,
    tooltip,
    margin,
    legend,
    ariaLabel,
    isPending,
  } = props

  const barSeries = useMemo<ChartSeries<T>[]>(
    () =>
      [...positiveBars, ...negativeBars].map((b) => ({
        key: b.key,
        label: b.label,
        color: b.color,
        mark: 'bar' as const,
        fillOpacity: 0.85,
        ...(b.axisSide !== undefined && { axis: b.axisSide }),
        getValue: (d: T) => getValue(d, b.key),
        ...(b.formatValue !== undefined && { formatValue: b.formatValue }),
        ...(b.tooltip !== undefined && { tooltip: b.tooltip }),
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
        strokeWidth: ln.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH,
        ...(ln.axisSide !== undefined && { axis: ln.axisSide }),
        getValue: (d: T) => getValue(d, ln.key),
        ...(ln.formatValue !== undefined && { formatValue: ln.formatValue }),
        ...(ln.tooltip !== undefined && { tooltip: ln.tooltip }),
        ...(ln.strokeOpacity !== undefined && { strokeOpacity: ln.strokeOpacity }),
      })),
    [lines, getValue],
  )

  const series = useMemo<ChartSeries<T>[]>(
    () => [...barSeries, ...lineSeries],
    [barSeries, lineSeries],
  )

  // `stacked` needs the SUMMED per-point total (bars stack on top of each other), not a per-series
  // max — the built-in 'auto' domain (per-series max) would clip a multi-bar stack. Left-axis line
  // overlays fold into the same min/max comparison, matching the pre-CartesianChart auto-domain
  // math. Skipped when the caller already supplies a fixed tuple or their own domain function.
  const yConfig = useMemo<AxisConfig<T>>(() => {
    // `y ?? {}` INSIDE the memo, never a `y = {}` destructuring default: the default builds a
    // fresh object every render, which busts this memo and cascades into `CartesianChart`'s own
    // margin/scale memos. Same pattern as `StackedArea`.
    const base = y ?? {}
    if (barLayout !== 'stacked' || (base.domain !== undefined && base.domain !== 'auto'))
      return base
    const pad = base.autoPad ?? 1.1
    return {
      ...base,
      // Visible-only, so a legend toggle shrinks the axis rather than leaving a gap.
      domain: (rows: readonly T[], visible: readonly ChartSeries<T>[]) => {
        const shown = new Set(visible.map((s) => s.key))
        let maxSum = 0
        let minSum = 0
        for (const d of rows) {
          let pos = 0
          for (const b of positiveBars) {
            if (!shown.has(b.key)) continue
            const v = getValue(d, b.key)
            if (v !== null && !Number.isNaN(v) && v > 0) pos += v
          }
          let neg = 0
          for (const b of negativeBars) {
            if (!shown.has(b.key)) continue
            const v = getValue(d, b.key)
            if (v !== null && !Number.isNaN(v) && v > 0) neg -= v
          }
          if (pos > maxSum) maxSum = pos
          if (neg < minSum) minSum = neg
        }
        for (const ln of lines) {
          if ((ln.axisSide ?? 'left') !== 'left' || !shown.has(ln.key)) continue
          for (const d of rows) {
            const v = getValue(d, ln.key)
            if (v === null || Number.isNaN(v)) continue
            if (v > maxSum) maxSum = v
            if (v < minSum) minSum = v
          }
        }
        const upper = Math.max(maxSum, base.autoMaxFloor ?? maxSum) * pad
        const ceil = base.autoMinCeil ?? 0
        return [padAutoLower(Math.min(minSum, ceil), pad), upper]
      },
    }
  }, [y, barLayout, positiveBars, negativeBars, lines, getValue])

  const mappedRefLines = useMemo(
    () =>
      refLines?.map((r) => ({
        value: r.value,
        color: r.color,
        ...(r.dashed !== undefined && { dashed: r.dashed }),
        ...(r.axisSide !== undefined && { axis: r.axisSide }),
      })),
    [refLines],
  )

  return (
    <CartesianChart
      data={data}
      chartId={chartId}
      getX={getX}
      series={series}
      y={yConfig}
      {...(y2 !== undefined && { y2 })}
      {...(xTicks !== undefined && { xTicks })}
      {...(formatX !== undefined && { formatX })}
      {...(cursorResolution !== undefined && { cursorResolution })}
      {...(zones !== undefined && { zones })}
      {...(mappedRefLines !== undefined && { refLines: mappedRefLines })}
      {...(height !== undefined && { height })}
      {...(legend !== undefined && { legend })}
      {...(tooltip !== undefined && { tooltip })}
      {...(margin !== undefined && { margin })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
    >
      {(ctx) => (
        <BarsMarks
          getX={getX}
          getValue={getValue}
          positiveBars={positiveBars}
          negativeBars={negativeBars}
          lines={lines}
          barWidthRatio={barWidthRatio}
          barLayout={barLayout}
          {...(barOpacity !== undefined && { barOpacity })}
          ctx={ctx}
        />
      )}
    </CartesianChart>
  )
}

type BarRectDatum = {
  key: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  fillOpacity: number
}

type LinePt<T> = { __d: T; __y: number }

type BarsMarksProps<T> = {
  getX: (d: T) => string
  getValue: (d: T, key: string) => number | null
  positiveBars: BarsBar<T>[]
  negativeBars: BarsBar<T>[]
  lines: BarsLine<T>[]
  barWidthRatio: number
  barLayout: 'stacked' | 'grouped'
  barOpacity?: (d: T, key: string) => number
  ctx: PlotContext<T>
}

/**
 * The bars, line overlays, and zero baseline. A component rather than an inline render-prop body
 * so the per-row rect geometry can be memoized: the cursor is a shared store, so every pointer
 * frame re-renders every mounted chart, and re-walking rows × bar-series (building fresh rect data
 * + allocating a `<rect>`/`<g>` per bar) each frame is pure waste (parity with StackedAreaMarks /
 * MultiLineMarks).
 */
function BarsMarks<T>({
  getX,
  getValue,
  positiveBars,
  negativeBars,
  lines,
  barWidthRatio,
  barLayout,
  barOpacity,
  ctx,
}: BarsMarksProps<T>) {
  const { data: rows, xScale, yScale, y2Scale, xMax, hidden, highlighted } = ctx

  // Per-row bar rects — memoized on every input that drives the geometry (not on `hidden`/
  // `highlighted` alone: a legend toggle or hover must still recompute, a hover-frame re-render of
  // an unrelated chart must not). `scaleForSide`/`dim` are declared INSIDE the factory (rather than
  // shared with the JSX below) so exhaustive-deps traces their `yScale`/`y2Scale`/`highlighted`
  // reads directly instead of demanding the closures themselves as deps — those are recreated every
  // render and would bust the memo every render if listed.
  const barGroups = useMemo(() => {
    const scaleForSide = (side: 'left' | 'right' | undefined) =>
      side === 'right' && y2Scale ? y2Scale : yScale
    const dim = (key: string) => (highlighted === null || highlighted === key ? 1 : 0.15)

    const groupWidth = Math.max((xMax / Math.max(rows.length, 1)) * barWidthRatio, 2)
    const totalWeight =
      barLayout === 'grouped' ? positiveBars.reduce((s, b) => s + (b.weight ?? 1), 0) || 1 : 1
    const groupedBarWidths =
      barLayout === 'grouped'
        ? positiveBars.map((b) => Math.max(groupWidth * ((b.weight ?? 1) / totalWeight), 1))
        : []
    const groupedBarOffsets: number[] = []
    let cursor = 0
    for (const w of groupedBarWidths) {
      groupedBarOffsets.push(cursor)
      cursor += w
    }

    return rows.map((d) => {
      const cx = xScale(getX(d)) ?? 0
      const groupLeft = cx - groupWidth / 2
      const rects: BarRectDatum[] = []

      if (barLayout === 'stacked') {
        let posOffset = 0
        for (const b of positiveBars) {
          if (hidden.has(b.key)) continue
          const v = getValue(d, b.key)
          if (v === null || Number.isNaN(v) || v <= 0) continue
          const top = posOffset + v
          const yTop = yScale(top)
          const yBottom = yScale(posOffset)
          rects.push({
            key: `${getX(d)}-${b.key}`,
            x: groupLeft,
            y: yTop,
            width: groupWidth,
            height: yBottom - yTop,
            fill: b.color,
            fillOpacity: (barOpacity?.(d, b.key) ?? 0.85) * dim(b.key),
          })
          posOffset = top
        }
        let negOffset = 0
        for (const b of negativeBars) {
          if (hidden.has(b.key)) continue
          const v = getValue(d, b.key)
          if (v === null || Number.isNaN(v) || v <= 0) continue
          const top = negOffset + v
          const yTop = yScale(-negOffset)
          const yBottom = yScale(-top)
          rects.push({
            key: `${getX(d)}-${b.key}-neg`,
            x: groupLeft,
            y: yTop,
            width: groupWidth,
            height: yBottom - yTop,
            fill: b.color,
            fillOpacity: (barOpacity?.(d, b.key) ?? 0.85) * dim(b.key),
          })
          negOffset = top
        }
      } else {
        positiveBars.forEach((b, i) => {
          if (hidden.has(b.key)) return
          const v = getValue(d, b.key)
          if (v === null || Number.isNaN(v) || v <= 0) return
          const scale = scaleForSide(b.axisSide)
          const yTop = scale(v)
          const yBottom = scale(0)
          rects.push({
            key: `${getX(d)}-${b.key}`,
            x: groupLeft + (groupedBarOffsets[i] ?? 0),
            y: yTop,
            width: groupedBarWidths[i] ?? 0,
            height: yBottom - yTop,
            fill: b.color,
            fillOpacity: (barOpacity?.(d, b.key) ?? 0.85) * dim(b.key),
          })
        })
      }

      return { rowKey: getX(d), rects }
    })
  }, [
    rows,
    xScale,
    yScale,
    y2Scale,
    xMax,
    hidden,
    highlighted,
    positiveBars,
    negativeBars,
    barLayout,
    barWidthRatio,
    barOpacity,
    getX,
    getValue,
  ])

  // Per-line valid points — walked once per (lines, rows), not re-walked inside the render map
  // every paint (parity with DualPanel's lineValid / MultiLine's pointsBySeries).
  const lineValid = useMemo(() => {
    const out = new Map<string, LinePt<T>[]>()
    for (const ln of lines) {
      const valid: LinePt<T>[] = []
      for (const d of rows) {
        const v = getValue(d, ln.key)
        if (v !== null && !Number.isNaN(v)) valid.push({ __d: d, __y: v })
      }
      out.set(ln.key, valid)
    }
    return out
  }, [lines, rows, getValue])

  // Cheap per-render closures for the JSX below — unlike `barGroups`' O(rows × series) walk,
  // calling these a handful of times per paint (once per line/baseline) isn't worth memoizing.
  const scaleForSide = (side: 'left' | 'right' | undefined) =>
    side === 'right' && y2Scale ? y2Scale : yScale
  const dim = (key: string) => (highlighted === null || highlighted === key ? 1 : 0.15)

  return (
    <>
      {barGroups.map((group) => (
        <g key={`bars-${group.rowKey}`}>
          {group.rects.map((r) => (
            <rect
              key={r.key}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              rx={1.4}
              fill={r.fill}
              fillOpacity={r.fillOpacity}
            />
          ))}
        </g>
      ))}

      {lines.map((ln) => {
        if (hidden.has(ln.key)) return null
        const scale = scaleForSide(ln.axisSide)
        const valid = lineValid.get(ln.key) ?? []
        if (valid.length === 0) return null
        return (
          <LinePath<LinePt<T>>
            key={`line-${ln.key}`}
            data={valid}
            x={(p) => xScale(getX(p.__d)) ?? 0}
            y={(p) => scale(p.__y)}
            stroke={ln.color}
            strokeWidth={ln.strokeWidth ?? LINE_OVERLAY_STROKE_WIDTH}
            strokeDasharray={ln.dashed ? VX.dashArray : undefined}
            strokeOpacity={dim(ln.key) * (ln.strokeOpacity ?? 1)}
            curve={curveMonotoneX}
          />
        )
      })}

      {negativeBars.length > 0 && (
        <line x1={0} x2={xMax} y1={yScale(0)} y2={yScale(0)} stroke={VX.grid} strokeWidth={1} />
      )}
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot bars kind in `React.memo` to retain the auto-memoization it had as source.
 */
export const Bars = memo(BarsInner) as typeof BarsInner
