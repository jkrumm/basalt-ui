import { AreaStack } from '@visx/shape'
import { memo, useCallback, useMemo } from 'react'
import { assertRequiredProps } from '../../common/validate'
import type { BasaltProps } from '../../common/props'
import type { CursorResolution } from '../cursor/resolve'
import { CartesianChart } from '../primitives/CartesianChart'
import type { AxisConfig, PlotContext } from '../primitives/CartesianChart'
import type { ChartState } from '../primitives/ChartPending'
import { curveFor } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { isDev } from '../../common/is-dev'

export type StackedAreaProps<T> = BasaltProps & {
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
   * value. Pass a fixed tuple or your own function to override. No `scale` — stacking sums bar
   * heights directly and a log axis has no additive zero to sum from. */
  y?: Omit<AxisConfig<T>, 'scale'>
  /** Exact number of x ticks. Default: as many as fit. Ignored when `xTickValues` is set. */
  xTicks?: number
  /** Which domain keys get a tick, from the full key list and the resolved plot width. Takes
   * precedence over `xTicks` — see `CartesianChartProps.xTickValues` for why a count is not
   * always enough. */
  xTickValues?: (keys: readonly string[], xMax: number) => readonly string[]
  /** X tick label formatter. Default `fmtAxisDate` (DD.MM). */
  formatX?: (key: string) => string
  /** Tilt the x tick labels 45° or 90°, or `0` to opt out of the phone tier's auto-rotation —
   * see `CartesianChartProps.xLabelRotate`. */
  xLabelRotate?: 0 | 45 | 90
  /**
   * How a sibling chart's broadcast cursor key resolves against this chart's points. Default
   * `'nearest'`. Pass `'leading'` when `getX` returns a bucket's leading edge (a weekly series
   * keyed by its Monday) — see `CursorResolution`.
   */
  cursorResolution?: CursorResolution
  /** Legend config forwarded to `CartesianChart`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
  /** Accessible text alternative, forwarded as `aria-label` (+ `role="group"`). */
  ariaLabel?: string
  /** Forwarded to `CartesianChart` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
  /** The three "nothing to draw" states in one prop — pending → error → empty. See
   * `ChartState`; `isPending` stays a supported alias for `state={{ pending: true }}`. */
  state?: ChartState
}

/**
 * A stack is only as dense as its sparsest band. A band's value is only meaningful as part of a
 * cumulative total, so a row where ANY visible band reports `null` has no total — every band gaps
 * across it. Reading the missing band as `0` instead would be a positive claim the quantity was
 * measured at zero, which is exactly the absence-as-data lie `ChartSeries.getValue`'s null
 * contract exists to prevent.
 */
function rowIsDense<T>(d: T, bands: readonly ChartSeries<T>[]): boolean {
  return bands.every((s) => s.getValue(d) !== null)
}

/**
 * Multi-series stacked-area chart with an optional derived legend (default on) and legend-hover
 * dimming. Each band's fillOpacity is dimmed when a different key is highlighted via the legend.
 *
 * **A stack is only as dense as its sparsest series.** A row where any VISIBLE band is null is
 * dropped from the stack entirely — the bands break across that x, the crosshair reports no
 * cumulative value there, and the axis domain ignores it. Toggling the sparse band off in the
 * legend closes the gap, because density is measured against the visible set. A chart that needs
 * a null band to read as zero must say so in its own `getValue`.
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
  // F-ERR-1: name the component and the prop. Without this a missing accessor surfaces
  // from inside visx as `undefined is not a function`, which `BasaltErrorBoundary`
  // swallows into a blank subtree that names nothing.
  assertRequiredProps('StackedArea', props, ['data', 'getX', 'series'])
  const {
    data,
    chartId,
    getX,
    series,
    y,
    xTicks,
    xTickValues,
    formatX,
    xLabelRotate,
    cursorResolution,
    height,
    legend,
    ariaLabel,
    isPending,
    state,
    className,
    style,
  } = props

  // The stack sums band heights via `getValue` totals directly — a log axis has no additive zero
  // to sum from (`docs/CHARTS-SPEC.md`'s null-gap + log contract, mirrored from `Bars`' own guard).
  if (isDev() && (y as { scale?: string } | undefined)?.scale === 'log') {
    throw new Error(
      'StackedArea: cannot use a log axis (y.scale: "log") — the stack sums band heights, ' +
        'and a log axis has no additive zero to sum from.',
    )
  }

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
          // A sparse row is not drawn, so it cannot set the axis top either.
          if (!rowIsDense(d, visible)) continue
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
      // No total on a sparse row — the bands gap there, so a dot would sit on nothing. The
      // per-band tooltip rows keep skipping their own nulls (`deriveTooltipRows`), so a row the
      // stack cannot draw never contributes a value anywhere.
      if (!rowIsDense(d, visible)) return null
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
      {...(xTickValues !== undefined && { xTickValues })}
      {...(formatX !== undefined && { formatX })}
      {...(xLabelRotate !== undefined && { xLabelRotate })}
      {...(cursorResolution !== undefined && { cursorResolution })}
      {...(height !== undefined && { height })}
      {...(legend !== undefined && { legend })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
      {...(state !== undefined && { state })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
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

  // `AreaStack` draws every band from ONE curve — the bands share their boundaries, so two curves
  // would leave gaps and overlaps between them. `visible` is in `reversedSeries` order (top band
  // first), so this resolves to the TOPMOST VISIBLE band that declares a `curve` — the last such
  // entry in the caller's own `series` array. A band declaring none is skipped rather than read as
  // the monotone default, and a HIDDEN one is never consulted, so a legend toggle can hand the
  // stack to the next declarer down. `series.curve.test.tsx` pins all four halves of that.
  const curve = curveFor(visible.find((s) => s.curve !== undefined)?.curve)

  return (
    <AreaStack<T, string>
      data={rows}
      keys={groups}
      x={(d) => xScale(getX(d.data)) ?? 0}
      y0={(d) => yScale(d[0]) ?? 0}
      y1={(d) => yScale(d[1]) ?? 0}
      // d3's stack layout needs a number per cell, so a null still enters the layout as 0 — but
      // `defined` keeps that cell out of every band's PATH, so the zero is never drawn. Without it
      // a missing band reads as a measured zero and the bands above it slide down onto it.
      value={(d, key) => seriesByKey.get(key)?.getValue(d) ?? 0}
      defined={(d) => rowIsDense(d.data, visible)}
      curve={curve}
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
const StackedAreaMemo = memo(StackedAreaInner)
// Without it every kind reads as `Memo` in React DevTools (audit A16) — a profiler flame
// graph of nine identically-named nodes names nothing.
StackedAreaMemo.displayName = 'StackedArea'
export const StackedArea = StackedAreaMemo as typeof StackedAreaInner
