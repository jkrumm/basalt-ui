/**
 * `Bars` — bar series on a band x scale, stacked, grouped or normalized, with line overlays. A
 * negative value draws below zero. In a visual slot it drops both axes, the grid and the legend and
 * fills the slot like a Sparkline.
 *
 * @useWhen discrete values per bucket (a daily total, a monthly count) are compared or stacked
 * @neverWhen the measure is continuous (use Lines) or the chart is an inline trend (use MiniBars)
 */
import type { ReactElement } from 'react'
import type { CartesianChartBase, ChartName, Series, YConfig } from '../contract'
import { CartesianPlot } from './cartesian'

/** A series of `mark: 'bar'` or `mark: 'line'` (an overlay). */
export type BarsSeries<D> = Extract<Series<D>, { mark: 'bar' | 'line' }>

export type BarsProps<D> = Omit<CartesianChartBase<D>, 'series' | 'marks' | 'y'> &
  ChartName & {
    series: readonly BarsSeries<D>[]
    /** A bar stands on zero, so `y` takes no `scale`: a log y is a type error here. */
    y?: Omit<YConfig, 'scale'>
    /** Default `'stacked'`. `'normalized'` stacks each x to its share of the total. */
    layout?: 'stacked' | 'grouped' | 'normalized'
  }

/**
 * `CartesianChart` with the series narrowed to bars, plus line overlays: stacked, grouped or
 * normalised by `layout`.
 *
 * @useWhen values are counts or amounts per category or per period, or parts of a whole stack
 * @neverWhen the trend is the point (use Lines), or a custom mark is needed (compose CartesianChart: Bars takes none)
 *
 * @example
 * <Bars
 *   label="Orders per week"
 *   data={rows}
 *   x={{ value: (d) => d.week }}
 *   series={[{ mark: 'bar', key: 'orders', label: 'Orders', color: SERIES.orders, y: (d) => d.orders }]}
 * />
 */
export function Bars<D>(props: BarsProps<D>): ReactElement {
  return <CartesianPlot {...props} naming="legend" />
}
