import { curveMonotoneX } from '@visx/curve'
import { AreaStack } from '@visx/shape'
import { memo, useCallback, useMemo } from 'react'
import type { CursorResolution } from '../cursor/resolve'
import { CartesianChart } from '../primitives/CartesianChart'
import type { AxisConfig, PlotContext } from '../primitives/CartesianChart'
import type { ChartLegendConfig, ChartSeries } from '../series'

export type StackedAreaProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to `CartesianChart`. Default 240. */
  height?: number
  chartId: string
  getX: (d: T) => string
  /** The stacked bands, bottom to top — the single source of truth for color, legend, and tooltip
   * rows. Typically `mark: 'area'` (rendered as a `bar`-shaped legend/tooltip swatch). */
  series: ChartSeries<T>[]
  /** Axis config for ticks/format/grid. `domain` defaults to the summed per-point stack total
   * (padded ×1.1, or `autoMaxFloor` if higher) rather than a per-series max — the seam a stacked
   * chart needs, since the plotted quantity is the cumulative band top, not any one series' own
   * value. Pass a fixed tuple or your own function to override. */
  y?: AxisConfig<T>
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
  /** Legend config forwarded to `CartesianChart`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
  /** Forwarded to `CartesianChart` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
}

/**
 * Multi-series stacked-area chart with an optional derived legend (default on) and legend-hover
 * dimming. Each band's fillOpacity is dimmed when a different key is highlighted via the legend.
 *
 * Composes `CartesianChart` (`docs/CHARTS-SPEC.md` §2) — margin, scale, grid, axes, cursor, and
 * tooltip are the primitive's job. This file draws only the `AreaStack` bands.
 *
 * The tooltip must render top-to-bottom (matching the visual stack read from the top), but the
 * marks must stack bottom-to-top (matching `series`' own order) — the two can't share one order.
 * `CartesianChart`'s `series` prop drives BOTH the derived tooltip rows and legend, so `series` is
 * passed reversed to it (tooltip/legend read top-first); the marks then reverse `ctx.visible` back
 * to restore the original bottom-to-top stacking order for `AreaStack`'s `keys`.
 */
function StackedAreaInner<T>(props: StackedAreaProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    y,
    xTicks,
    formatX,
    cursorResolution,
    height,
    legend,
    ariaLabel,
    isPending,
  } = props

  // The plotted quantity is the CUMULATIVE stack top, not any one series' value — the built-in
  // 'auto' domain (per-series max) would clip a multi-band stack. Skipped when the caller already
  // supplies a fixed tuple or their own domain function.
  const yConfig = useMemo<AxisConfig<T>>(() => {
    const base = y ?? {}
    if (base.domain !== undefined && base.domain !== 'auto') return base
    const pad = base.autoPad ?? 1.1
    return {
      ...base,
      // Sums the VISIBLE bands only, so toggling one off in the legend shrinks the axis instead
      // of leaving a permanent empty gap above the stack.
      domain: (rows: readonly T[], visible: readonly ChartSeries<T>[]) => {
        let maxTotal = 0
        for (const d of rows) {
          let total = 0
          for (const s of visible) total += s.getValue(d) ?? 0
          if (total > maxTotal) maxTotal = total
        }
        return [0, Math.max(maxTotal, base.autoMaxFloor ?? maxTotal) * pad]
      },
    }
  }, [y])

  // A stacked band's crosshair dot belongs at the CUMULATIVE band top — the edge the reader is
  // tracking — not at the band's own raw value, which sits somewhere inside the fill.
  const stackedCursorValue = useCallback(
    (d: T, s: ChartSeries<T>, visible: readonly ChartSeries<T>[]): number | null => {
      let total = 0
      // `visible` arrives top-to-bottom (the `series.toReversed()` handed to the primitive);
      // stacking accumulates bottom-up.
      for (let i = visible.length - 1; i >= 0; i--) {
        const band = visible[i] as ChartSeries<T>
        total += band.getValue(d) ?? 0
        if (band.key === s.key) return total
      }
      return null
    },
    [],
  )

  // Memoized: this array is `CartesianChart`'s `series` prop, and a fresh identity every render
  // would bust every memo keyed on it inside the primitive (domains, tick labels, margin, visible).
  const reversedSeries = useMemo(() => series.toReversed(), [series])

  return (
    <CartesianChart
      data={data}
      chartId={chartId}
      getX={getX}
      series={reversedSeries}
      y={yConfig}
      cursorValue={stackedCursorValue}
      {...(xTicks !== undefined && { xTicks })}
      {...(formatX !== undefined && { formatX })}
      {...(cursorResolution !== undefined && { cursorResolution })}
      {...(height !== undefined && { height })}
      {...(legend !== undefined && { legend })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
    >
      {(ctx) => <StackedAreaMarks getX={getX} ctx={ctx} />}
    </CartesianChart>
  )
}

/**
 * The bands. A component rather than an inline render-prop body so the stack bookkeeping can be
 * memoized: the cursor is a shared store, so every pointer frame re-renders every chart, and
 * rebuilding the key list + lookup Map + a copy of `data` per frame is pure waste.
 */
function StackedAreaMarks<T>({ getX, ctx }: { getX: (d: T) => string; ctx: PlotContext<T> }) {
  const { visible, xScale, yScale, highlighted } = ctx

  // Restore bottom-to-top order for the actual stacking geometry (see the component doc above).
  const { groups, seriesByKey } = useMemo(() => {
    const stackOrder = visible.toReversed()
    return {
      groups: stackOrder.map((s) => s.key),
      seriesByKey: new Map(stackOrder.map((s) => [s.key, s])),
    }
  }, [visible])

  // `AreaStack` wants a mutable array; `ctx.data` is readonly. Copy once per data change.
  const rows = useMemo(() => [...ctx.data], [ctx.data])

  return (
    <AreaStack<T, string>
      data={rows}
      keys={groups}
      x={(d) => xScale(getX(d.data)) ?? 0}
      y0={(d) => yScale(d[0]) ?? 0}
      y1={(d) => yScale(d[1]) ?? 0}
      value={(d, key) => seriesByKey.get(key)?.getValue(d) ?? 0}
      curve={curveMonotoneX}
    >
      {({ stacks, path }) =>
        stacks.map((stack) => (
          <path
            key={`stack-${stack.key}`}
            d={path(stack) || ''}
            fill={seriesByKey.get(stack.key)?.color}
            stroke="transparent"
            fillOpacity={highlighted === null || highlighted === stack.key ? 1 : 0.25}
          />
        ))
      }
    </AreaStack>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot stacked-area kind in `React.memo` to retain the auto-memoization it had as source
 * (parity with ZonedLine / Bars / MultiLine).
 */
export const StackedArea = memo(StackedAreaInner) as typeof StackedAreaInner
