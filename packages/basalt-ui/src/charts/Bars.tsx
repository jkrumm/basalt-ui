/**
 * `Bars` — bar series on a band x scale (Date, number or string), stacked, grouped or normalized,
 * with line overlays on `y`/`y2` (`docs/V2-SPEC.md` § 9.3). A negative value draws below zero: a
 * stack diverges around the baseline (the 1.x `negativeBars`, now just a signed value). Zones,
 * reference lines, legend, cursor and tooltip are the rung's.
 */
import { barY } from '@tanstack/charts/bar'
import { group } from '@tanstack/charts/group'
import { lineY } from '@tanstack/charts/line'
import { stack } from '@tanstack/charts/stack'
import { useCallback, useMemo } from 'react'
import type { ReactElement } from 'react'
import { CartesianRung } from './CartesianChart'
import { chartCurve } from './curves'
import { DASH, DIMMED, LINE_STROKE_WIDTH } from './theme'
import { rowX } from './types'
import type {
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
  ChartX,
  PlotContext,
  PlotRow,
} from './types'

/** A bar series. Bars always read the left axis. */
export type BarsBar<T> = Pick<
  ChartSeries<T>,
  'key' | 'label' | 'color' | 'getValue' | 'formatValue' | 'tooltip' | 'legend' | 'role' | 'note'
> & {
  /** Default 0.85. */
  fillOpacity?: number
}

/** A line overlay; `axis: 'right'` reads the chart's `y2`. */
export type BarsLine<T> = Pick<
  ChartSeries<T>,
  | 'key'
  | 'label'
  | 'color'
  | 'getValue'
  | 'formatValue'
  | 'tooltip'
  | 'legend'
  | 'role'
  | 'note'
  | 'axis'
  | 'dash'
  | 'curve'
  | 'strokeWidth'
  | 'strokeOpacity'
>

export type BarsProps<T, X extends ChartX = ChartX> = Omit<
  CartesianChartProps<T, X>,
  'marks' | 'series'
> & {
  bars: readonly BarsBar<T>[]
  lines?: readonly BarsLine<T>[]
  /** Default `'stacked'`. `'normalized'` stacks each x to its share of the total. */
  layout?: 'stacked' | 'grouped' | 'normalized'
  /** Per-bar opacity (a partial week, an estimate). Overrides the series' `fillOpacity`. */
  barOpacity?: (d: T, key: string) => number
}

const DEFAULT_BAR_OPACITY = 0.85

const paint = (color: string, opacity: number): string =>
  opacity >= 1 ? color : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`

export function Bars<T, X extends ChartX = ChartX>(props: BarsProps<T, X>): ReactElement {
  const { bars, lines, layout = 'stacked', barOpacity, ...rest } = props
  const series = useMemo<ChartSeries<T>[]>(
    () => [
      ...bars.map((b) => ({ ...b, mark: 'bar' as const })),
      ...(lines ?? []).map((l) => ({ ...l, mark: 'line' as const })),
    ],
    [bars, lines],
  )

  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const barKeys = new Set(bars.map((b) => b.key))
      const visibleBars = plot.visible.filter((s) => barKeys.has(s.key))
      const byKey = new Map(bars.map((b) => [b.key, b]))
      const rows = visibleBars.flatMap((s) => plot.rows(s.key))
      const h = plot.highlighted
      const fill = (row: PlotRow<T, X>): string => {
        const bar = byKey.get(row.series)
        if (!bar) return 'transparent'
        const base = barOpacity?.(row.datum, row.series) ?? bar.fillOpacity ?? DEFAULT_BAR_OPACITY
        return paint(bar.color, h === null || h === row.series ? base : base * DIMMED)
      }
      const order = visibleBars.map((s) => s.key)
      const out: ChartMarks[number][] = []
      if (rows.length > 0)
        out.push(
          barY(rows, {
            id: 'bars',
            x: rowX,
            y: 'y',
            z: 'series',
            fill,
            layout:
              layout === 'grouped'
                ? group({ padding: 0.1 })
                : stack({ order, ...(layout === 'normalized' && { offset: 'normalize' }) }),
          }),
        )
      for (const s of plot.visible) {
        if (barKeys.has(s.key)) continue
        const dim = h !== null && h !== s.key
        out.push(
          lineY(plot.rows(s.key), {
            id: s.key,
            x: rowX,
            y: 'y',
            z: 'series',
            stroke: s.color,
            strokeWidth: s.strokeWidth ?? LINE_STROKE_WIDTH,
            strokeOpacity: (s.strokeOpacity ?? 1) * (dim ? DIMMED : 1),
            curve: chartCurve(s.curve ?? 'monotone'),
            ...(s.dash === 'dashed' && { strokeDasharray: DASH }),
            ...(s.axis === 'right' && plot.y2 !== undefined && { yScale: 'y2' }),
          }),
        )
      }
      return out
    },
    [bars, layout, barOpacity],
  )

  return (
    <CartesianRung
      {...rest}
      series={series}
      marks={marks}
      band
      reverseRows={layout !== 'grouped'}
      {...(layout !== 'grouped' && { stack: layout })}
    />
  )
}
