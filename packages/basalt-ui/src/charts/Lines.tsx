/**
 * `Lines` — n line series over the rung (`docs/V2-SPEC.md` § 9.3; the two 1.x line kinds, merged).
 * Per series: an optional `area` gradient, dash, curve, markers, the right axis. Per chart:
 * `thresholds` (fills between the first series and a value, Date/number x only). Zones, x-zones,
 * reference lines, `y2`, legend, cursor and tooltip are the rung's.
 *
 * At the wide class with ≤ 3 plotted lines and no `y2`, each line also carries an end label; the
 * legend still names every series (and still toggles them). A label that would not fit between its
 * last point and the plot's right edge ends at the point instead, above it. Before the engine has
 * measured the plot (the server HTML, the first client frame) the room is read off the frame, which
 * is wider by the axis gutters; the measured render corrects it.
 */
import { areaY } from '@tanstack/charts/area'
import { differenceY } from '@tanstack/charts/difference'
import { decorative } from '@tanstack/charts/mark/decorative'
import { useCallback } from 'react'
import type { ReactElement } from 'react'
import { CartesianRung } from './CartesianChart'
import { areaGradientId } from './compile'
import { chartCurve } from './curves'
import { endLabelMarks, endLabelPlan } from './labels'
import { drawnRows, lineMark, loneDots, markersOf, yScaleOf } from './marks'
import { rowX } from './types'
import type {
  CartesianChartProps,
  ChartMarks,
  ChartX,
  PlotContext,
  PlotRow,
  Threshold,
} from './types'

export type LinesProps<T, X extends ChartX = ChartX> = Omit<CartesianChartProps<T, X>, 'marks'> & {
  /**
   * Fills between the first visible series and a value, on one side of it. Unavailable on a string
   * x: the engine's `differenceY` takes a Date or number x only.
   */
  thresholds?: [X] extends [string] ? never : readonly Threshold[]
}

const hasValue = <T, X extends ChartX>(r: PlotRow<T, X>): boolean => r.y !== null

export function Lines<T, X extends ChartX = ChartX>(props: LinesProps<T, X>): ReactElement {
  const { thresholds, ...rest } = props
  const { series } = props
  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const indexOf = new Map(series.map((s, i) => [s.key, i]))
      const plotted = plot.visible.filter((s) => plot.rows(s.key).some(hasValue))
      const primary = plotted[0]
      const out: ChartMarks[number][] = []

      // Threshold lobes first (under the line), against the first plotted series.
      if (primary && thresholds) {
        const pts = plot.rows(primary.key).filter(hasValue) as PlotRow<T, Date | number>[]
        thresholds.forEach((t, i) => {
          out.push(
            decorative(
              differenceY(pts, {
                id: `threshold-${i}`,
                x: rowX,
                y1: t.value,
                y2: 'y',
                positiveFill: t.side === 'above' ? t.fill : null,
                negativeFill: t.side === 'below' ? t.fill : null,
                fillOpacity: 1,
                stroke: 'none',
                comparisonStroke: 'none',
                ...(yScaleOf(plot, primary) !== undefined && { yScale: 'y2' }),
              }),
            ),
          )
        })
      }
      for (const s of plot.visible) {
        if (!s.area) continue
        out.push(
          decorative(
            areaY(drawnRows(plot, s), {
              id: `${s.key}-area`,
              x: rowX,
              y2: 'y',
              y1: () => 0,
              fill: `url(#${areaGradientId(indexOf.get(s.key) ?? 0)})`,
              fillOpacity: 1,
              curve: chartCurve(s.curve ?? 'monotone'),
              ...(yScaleOf(plot, s) !== undefined && { yScale: 'y2' }),
            }),
          ),
        )
      }
      for (const s of plot.visible) {
        const yScale = yScaleOf(plot, s)
        out.push(lineMark(plot, s))
        out.push(...loneDots(s, drawnRows(plot, s), yScale, plot.highlighted))
        out.push(...markersOf(s, plot.rows(s.key), yScale))
      }
      const labelled = plotted.filter((s) => s.role !== 'reference')
      out.push(...endLabelMarks(endLabelPlan(plot, labelled, props.x, props.xDomain)))
      return out
    },
    [series, thresholds, props.x, props.xDomain],
  )
  return <CartesianRung {...rest} marks={marks} />
}
