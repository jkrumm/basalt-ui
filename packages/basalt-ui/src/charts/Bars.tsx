/**
 * `Bars` — bar series on a band x scale (Date, number or string), stacked, grouped or normalized,
 * with line overlays on `y`/`y2` (`docs/V2-SPEC.md` § 9.3). A negative value draws below zero: a
 * stack diverges around the baseline (the 1.x `negativeBars`, now just a signed value). Zones,
 * reference lines, legend, cursor and tooltip are the rung's.
 */
import { barY } from '@tanstack/charts/bar'
import { group } from '@tanstack/charts/group'
import { stack } from '@tanstack/charts/stack'
import { useCallback, useMemo } from 'react'
import type { ReactElement } from 'react'
import { CartesianRung } from './CartesianChart'
import { emphasis, lineMark } from './marks'
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
  fillOpacity?: number | undefined
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
  lines?: readonly BarsLine<T>[] | undefined
  /** Default `'stacked'`. `'normalized'` stacks each x to its share of the total. */
  layout?: 'stacked' | 'grouped' | 'normalized' | undefined
  /** Per-bar opacity (a partial week, an estimate, a shade per series). Overrides the series' `fillOpacity`; the legend swatch samples it on the first row. */
  barOpacity?: ((d: T, key: string) => number) | undefined
}

const DEFAULT_BAR_OPACITY = 0.85

const paint = (color: string, opacity: number): string =>
  opacity >= 1 ? color : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`

let warnedLogStack = false

/** A stack sums bar heights and a log axis has no additive zero to sum from (V2-SPEC § 9.9): dev
 * throws, production logs once and draws what it can. Lines-only and grouped charts are fine. */
function guardLogStack(layout: string, onLog: boolean): void {
  if (!onLog || layout === 'grouped') return
  const message = `Bars: ${layout} bars cannot use a log axis; use layout: 'grouped'`
  if (process.env.NODE_ENV !== 'production') throw new Error(message)
  // oxlint-disable-next-line no-console -- the production leg of a dev-only throw
  if (!warnedLogStack) console.error(message)
  warnedLogStack = true
}

export function Bars<T, X extends ChartX = ChartX>(props: BarsProps<T, X>): ReactElement {
  const { bars, lines, layout = 'stacked', barOpacity, ...rest } = props
  guardLogStack(layout, bars.length > 0 && rest.y?.scale === 'log')
  const sample = rest.data[0]
  const series = useMemo<ChartSeries<T>[]>(
    () => [
      // The legend has no datum: its swatch wears the shade the bars draw on the first row, so
      // per-bar shades (`barOpacity`) read the same in the legend as on the plot.
      ...bars.map((b) => ({
        ...b,
        mark: 'bar' as const,
        fillOpacity:
          (sample !== undefined ? barOpacity?.(sample, b.key) : undefined) ??
          b.fillOpacity ??
          DEFAULT_BAR_OPACITY,
      })),
      ...(lines ?? []).map((l) => ({ ...l, mark: 'line' as const })),
    ],
    [bars, lines, barOpacity, sample],
  )

  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const barKeys = new Set(bars.map((b) => b.key))
      const visibleBars = plot.visible.filter((s) => barKeys.has(s.key))
      const byKey = new Map(bars.map((b) => [b.key, b]))
      const rows = visibleBars.flatMap((s) => plot.rows(s.key))
      const h = plot.highlighted
      const solid = ({ datum }: { datum: PlotRow<T, X> }): string =>
        byKey.get(datum.series)?.color ?? 'transparent'
      const fill = (row: PlotRow<T, X>): string => {
        const bar = byKey.get(row.series)
        if (!bar) return 'transparent'
        const base = barOpacity?.(row.datum, row.series) ?? bar.fillOpacity ?? DEFAULT_BAR_OPACITY
        return paint(bar.color, base * emphasis(h, { key: row.series }))
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
            // The hovered x is its own highlight: the bar reads at full strength (no dimming, no
            // point marker, no crosshair rule: that is line-chart chrome).
            states: [{ when: { focus: 'x' }, style: { fill: solid } }],
            layout:
              layout === 'grouped'
                ? group({ padding: 0.1 })
                : stack({ order, ...(layout === 'normalized' && { offset: 'normalize' }) }),
          }),
        )
      for (const s of plot.visible) {
        if (barKeys.has(s.key)) continue
        out.push(lineMark(plot, s))
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
      crosshair={false}
      reverseRows={layout !== 'grouped'}
      {...(layout !== 'grouped' && { stack: layout })}
    />
  )
}
