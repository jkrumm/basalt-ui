/**
 * The marks of the line series of a chart: area fade, the line, a lone dot, markers and end labels.
 * Ported from the 2.x `Lines` kind; `CartesianChart` composes them with the bar and dot marks.
 */
import { areaY } from '@tanstack/charts/area'
import { dot } from '@tanstack/charts/dot'
import { decorative } from '@tanstack/charts/mark/decorative'
import { areaGradientId } from '../core/compile'
import { CV } from '../core/theme'
import { BASALT } from '../../tokens'
import { chartCurve } from '../core/curves'
import { claimLabelBoxes, endLabelMarks, endLabelPlan } from '../labels'
import type { LinesNaming } from '../labels'
import { drawnRows, lineMark, linePaint, loneDots, markersOf, yScaleOf } from '../marks'
import { rowX } from '../types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from '../types'

const timeOf = (x: unknown): unknown => (x instanceof Date ? x.getTime() : x)

/**
 * A dot on every visible line at the x of the focused datum: the line's own "full strength" while
 * its rest dims (`lineMark`). A focused datum no row of a line shares an x with marks nothing there.
 */
function focusDots<D>(plot: PlotContext<D, ChartX>, lines: readonly ChartSeries<D>[]): ChartMarks {
  const focused = plot.focused
  if (focused === null) return []
  const at = plot.visible.flatMap((s) => plot.rows(s.key)).find((r) => r.datum === focused)?.x
  if (at === undefined) return []
  const out: ChartMarks[number][] = []
  for (const s of lines) {
    const row = plot.rows(s.key).find((r) => r.y !== null && timeOf(r.x) === timeOf(at))
    if (row === undefined) continue
    const yScale = yScaleOf(plot, s)
    out.push(
      decorative(
        dot([row], {
          id: `${s.key}-focus`,
          x: rowX,
          y: 'y',
          r: BASALT.dotR,
          fill: s.color,
          stroke: CV.surface,
          strokeWidth: 1.5,
          ...(yScale !== undefined && { yScale }),
        }),
      ),
    )
  }
  return out
}

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
  out.push(...focusDots(plot, plotted))
  const labelled = plotted.filter((s) => s.role !== 'reference')
  const plan = endLabelPlan(plot, labelled, naming, rules)
  claimLabelBoxes(
    plot,
    plan.map((p) => p.box),
  )
  out.push(...endLabelMarks(plan, (color) => linePaint(plot, color)))
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
