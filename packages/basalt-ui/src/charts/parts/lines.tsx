/**
 * `Lines` — n line series over the rung. Per series: an optional `area` fade, `dash`, `curve`,
 * `weight` and the right axis. From the wide class up a chart of at most three lines names them with
 * end labels and its legend goes; below it the legend names them.
 *
 * @useWhen a continuous measure over time or a number axis is drawn as one or more lines
 * @neverWhen the values are discrete counts per bucket (use Bars) or the chart is an inline trend (use Sparkline)
 */
import type { ReactElement } from 'react'
import type { CartesianChartProps, Series } from '../contract'
import { CartesianPlot } from './cartesian'

/** A series of `mark: 'line'`. */
export type LineSeries<D> = Extract<Series<D>, { mark: 'line' }>

export type LinesProps<D> = Omit<CartesianChartProps<D>, 'series' | 'marks'> & {
  series: readonly LineSeries<D>[]
  /** Who names the lines: `'auto'` (end labels from the wide class, the legend below it), `'legend'` or `'endLabels'`. */
  naming?: 'auto' | 'legend' | 'endLabels'
}

export function Lines<D>(props: LinesProps<D>): ReactElement {
  return <CartesianPlot {...props} />
}
