/**
 * `Lines` — n line series over the rung. Per series: an optional `area` fade, `dash`, `curve`,
 * `weight` and the right axis. From the wide class up a chart of at most three lines names them with
 * end labels and its legend goes; below it the legend names them.
 *
 * @useWhen a continuous measure over time or a number axis is drawn as one or more lines
 * @neverWhen the values are discrete counts per bucket (use Bars) or the chart is an inline trend (use Sparkline)
 */
import type { ReactElement } from 'react'
import type { CartesianChartBase, ChartName, Series } from '../contract'
import { CartesianPlot } from './cartesian'

/** A series of `mark: 'line'`. */
export type LineSeries<D> = Extract<Series<D>, { mark: 'line' }>

export type LinesProps<D> = Omit<CartesianChartBase<D>, 'series' | 'marks'> &
  ChartName & {
    series: readonly LineSeries<D>[]
    /** Who names the lines: `'auto'` (end labels from the wide class, the legend below it), `'legend'` or `'endLabels'`. */
    naming?: 'auto' | 'legend' | 'endLabels'
  }

/**
 * `CartesianChart` with the series narrowed to lines: n series, an `area` fade, zones and reference
 * lines, and names at the line ends or in the legend (`naming`).
 *
 * @useWhen a metric over time or an ordered axis reads as one or more lines
 * @neverWhen the values are counts per category (use Bars), or a word must sit on one mark (compose CartesianChart with a custom text mark)
 *
 * @example
 * <Lines
 *   label="Sessions per day"
 *   data={rows}
 *   x={{ value: (d) => d.day }}
 *   series={[{ mark: 'line', key: 'sessions', label: 'Sessions', color: SERIES.sessions, y: (d) => d.sessions }]}
 * />
 */
export function Lines<D>(props: LinesProps<D>): ReactElement {
  return <CartesianPlot {...props} />
}
