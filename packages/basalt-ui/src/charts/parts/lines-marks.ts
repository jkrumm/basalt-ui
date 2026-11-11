/**
 * The marks of the line series of a chart: area fade, the line, a lone dot, markers and end labels.
 * Ported from the 2.x `Lines` kind; `CartesianChart` composes them with the bar and dot marks.
 */
import { areaY } from '@tanstack/charts/area'
import { decorative } from '@tanstack/charts/mark/decorative'
import { areaGradientId } from '../core/compile'
import { chartCurve } from '../core/curves'
import { claimLabelBoxes, endLabelMarks, endLabelPlan } from '../labels'
import type { LinesNaming } from '../labels'
import { drawnRows, lineMark, loneDots, markersOf, yScaleOf } from '../marks'
import { rowX } from '../types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from '../types'

const hasValue = <T, X extends ChartX>(r: PlotRow<T, X>): boolean => r.y !== null

/** The most lines `auto` names with end labels (and so the most a legend gives way for). */
export const AUTO_END_LABELS = 3

export type LineMarksInput<D> = {
  /** Every engine series of the chart, in order: the area gradient ids index into it. */
  all: readonly ChartSeries<D>[]
  /** The keys of the line series this call draws. */
  keys: ReadonlySet<string>
  naming: LinesNaming
  /** Values of the left-axis reference lines: a label must not sit on one. */
  rules: readonly number[]
}

export function lineMarks<D>(plot: PlotContext<D, ChartX>, input: LineMarksInput<D>): ChartMarks {
  const { all, keys, naming, rules } = input
  const lines = plot.visible.filter((s) => keys.has(s.key))
  const plotted = lines.filter((s) => plot.rows(s.key).some(hasValue))
  const out: ChartMarks[number][] = []
  for (const s of lines) {
    if (!s.area) continue
    const yScale = yScaleOf(plot, s)
    out.push(
      decorative(
        areaY(drawnRows(plot, s), {
          id: `${s.key}-area`,
          x: rowX,
          y2: 'y',
          y1: () => 0,
          fill: `url(#${areaGradientId(all.findIndex((o) => o.key === s.key))})`,
          fillOpacity: 1,
          curve: chartCurve(s.curve ?? 'linear'),
          ...(yScale !== undefined && { yScale }),
        }),
      ),
    )
  }
  for (const s of lines) {
    const yScale = yScaleOf(plot, s)
    out.push(lineMark(plot, s))
    out.push(...loneDots(s, drawnRows(plot, s), yScale, plot.highlighted))
    out.push(...markersOf(s, plot.rows(s.key), yScale))
  }
  const labelled = plotted.filter((s) => s.role !== 'reference')
  const plan = endLabelPlan(plot, labelled, naming, rules)
  claimLabelBoxes(
    plot,
    plan.map((p) => p.box),
  )
  out.push(...endLabelMarks(plan))
  return out
}

/** Whether a series' last non-null point exists and sits inside the chart's x domain. */
export function lastIsPlaceable<D>(
  data: readonly D[],
  x: (d: D) => ChartX,
  xDomain: readonly [ChartX, ChartX] | undefined,
  s: ChartSeries<D>,
): boolean {
  const last = data.findLast((d) => s.getValue(d) !== null)
  if (last === undefined) return false
  if (xDomain === undefined) return true
  const at = +x(last) // a Date's timestamp, or the number itself
  return Number.isNaN(at) || (at >= +xDomain[0] && at <= +xDomain[1])
}
