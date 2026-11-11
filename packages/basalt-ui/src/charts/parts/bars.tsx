/**
 * `Bars` — bar series on a band x scale, stacked, grouped or normalized, with line overlays. A
 * negative value draws below zero. In a visual slot it drops both axes, the grid and the legend and
 * fills the slot like a Sparkline.
 *
 * @useWhen discrete values per bucket (a daily total, a monthly count) are compared or stacked
 * @neverWhen the measure is continuous (use Lines) or the chart is an inline trend (use MiniBars)
 */
import type { ReactElement } from 'react'
import type { CartesianChartProps, Series } from '../contract'
import { CartesianPlot } from './cartesian'

/** A series of `mark: 'bar'` or `mark: 'line'` (an overlay). */
export type BarsSeries<D> = Extract<Series<D>, { mark: 'bar' | 'line' }>

export type BarsProps<D> = Omit<CartesianChartProps<D>, 'series' | 'marks'> & {
  series: readonly BarsSeries<D>[]
  /** Default `'stacked'`. `'normalized'` stacks each x to its share of the total. */
  layout?: 'stacked' | 'grouped' | 'normalized'
}

export function Bars<D>(props: BarsProps<D>): ReactElement {
  return <CartesianPlot {...props} naming="legend" />
}
