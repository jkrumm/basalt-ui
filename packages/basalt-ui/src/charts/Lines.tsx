/**
 * `Lines` — n line series over the rung (`docs/V2-SPEC.md` § 9.3; the two 1.x line kinds, merged).
 * Per series: an optional `area` gradient, dash, curve, markers, the right axis. Per chart:
 * `thresholds` (fills between the first series and a value, Date/number x only). Zones, x-zones,
 * reference lines, `y2`, legend, cursor and tooltip are the rung's.
 *
 * `naming` is the one switch for who names the series. `auto` (default): from the wide class up, a
 * chart of ≤ 3 lines and no `y2` names them with end labels and its legend goes; below it the
 * legend names them. `legend`: the legend at every width, no end labels. `endLabels`: end labels at
 * every width, no legend (a chart with a `y2` keeps its legend). A label that would not fit between
 * its last point and the plot's right edge ends at the point instead, above it; labels that would
 * collide are spread apart. Before the engine has measured the plot (the server HTML, the first
 * client frame) the room is read off the frame, which is wider by the axis gutters; the measured
 * render corrects it.
 */
import { areaY } from '@tanstack/charts/area'
import { differenceY } from '@tanstack/charts/difference'
import { decorative } from '@tanstack/charts/mark/decorative'
import { useCallback } from 'react'
import type { ReactElement } from 'react'
import { CartesianRung } from './CartesianChart'
import { areaGradientId } from './compile'
import { chartCurve } from './curves'
import { claimLabelBoxes, endLabelMarks, endLabelPlan } from './labels'
import type { LinesNaming } from './labels'
import { drawnRows, lineMark, loneDots, markersOf, yScaleOf } from './marks'
import { rowX } from './types'
import type {
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
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
  /** Who names the series: `'auto'` (default; end labels from the wide class, the legend below it),
   * `'legend'` or `'endLabels'`. */
  naming?: 'auto' | 'legend' | 'endLabels' | undefined
}

const hasValue = <T, X extends ChartX>(r: PlotRow<T, X>): boolean => r.y !== null

/** Whether a series' last non-null point exists and sits inside the chart's x domain. */
function lastIsPlaceable<T, X extends ChartX>(
  props: Pick<LinesProps<T, X>, 'data' | 'x' | 'xDomain'>,
  s: ChartSeries<T>,
): boolean {
  const last = props.data.findLast((d) => s.getValue(d) !== null)
  if (last === undefined) return false
  const { xDomain } = props
  if (xDomain === undefined) return true
  const at = +props.x(last) // a Date's timestamp, or the number itself
  return Number.isNaN(at) || (at >= +xDomain[0] && at <= +xDomain[1])
}

/** The most lines `auto` names with end labels (and so the most a legend gives way for). */
const AUTO_END_LABELS = 3

export function Lines<T, X extends ChartX = ChartX>(props: LinesProps<T, X>): ReactElement {
  const { thresholds, naming = 'auto', refLines, ...rest } = props
  const { series } = props
  // Whether end labels can name every legend entry: only then may the legend give way to them.
  const labelled = series.filter((s) => s.role !== 'reference')
  const namedByLabels =
    props.y2 === undefined &&
    series.every((s) => s.legend === false || s.role !== 'reference') &&
    !(props.refLines ?? []).some((r) => r.legend !== undefined)
  // When the legend must name something the labels cannot (a right axis, a named reference line),
  // it stays and the labels are not drawn: one naming, never two.
  const effective: LinesNaming = namedByLabels ? naming : 'legend'
  // The legend gives way only to labels that WILL draw for every line: each labelled series needs a
  // last value the plot can place (a narrower `xDomain` can clip it away).
  const placeable = labelled.every((s) => lastIsPlaceable(props, s))
  const labelsOnly = effective === 'endLabels'
  const hideAtWide =
    effective === 'auto' && placeable && labelled.length > 0 && labelled.length <= AUTO_END_LABELS
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
              curve: chartCurve(s.curve ?? 'linear'),
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
      // The reference rules on the left axis are lines a label must not sit on; the captions in turn
      // keep clear of the labels placed here.
      const rules = (refLines ?? []).flatMap((r) => (r.axis === 'right' ? [] : [r.value]))
      const plan = endLabelPlan(plot, labelled, effective, rules)
      claimLabelBoxes(
        plot,
        plan.map((p) => p.box),
      )
      out.push(...endLabelMarks(plan))
      return out
    },
    [series, thresholds, effective, refLines],
  )
  return (
    <CartesianRung
      {...rest}
      {...(refLines !== undefined && { refLines })}
      marks={marks}
      {...(labelsOnly && { legend: false as const })}
      {...(hideAtWide && { hideLegendAtWide: true })}
    />
  )
}
