/**
 * The line-overlay mark every kind draws the same way: `Lines`' series and `Bars`' line overlays.
 * One place for stroke width, dash, curve, the right-axis binding and legend-hover emphasis (a
 * companion keeps full strength while its `parent` is the highlighted entry).
 */
import { lineY } from '@tanstack/charts/line'
import { chartCurve } from './curves'
import { DASH, DIMMED, LINE_STROKE_WIDTH } from './theme'
import { rowX } from './types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext } from './types'

/** `'y2'` for a right-axis series on a chart that has one; otherwise the default axis. */
export function yScaleOf<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  s: Pick<ChartSeries<T>, 'axis'>,
): 'y2' | undefined {
  return s.axis === 'right' ? plot.y2 : undefined
}

/** `1`, or `DIMMED` while ANOTHER legend entry (not this series, not its parent) is hovered. */
export function emphasis<T>(
  highlighted: string | null,
  s: Pick<ChartSeries<T>, 'key' | 'parent'>,
): number {
  return highlighted === null || highlighted === s.key || highlighted === s.parent ? 1 : DIMMED
}

export function lineMark<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  s: ChartSeries<T>,
): ChartMarks[number] {
  const yScale = yScaleOf(plot, s)
  return lineY(plot.rows(s.key), {
    id: s.key,
    x: rowX,
    y: 'y',
    z: 'series',
    stroke: s.color,
    strokeWidth: s.strokeWidth ?? LINE_STROKE_WIDTH,
    strokeOpacity: (s.strokeOpacity ?? 1) * emphasis(plot.highlighted, s),
    curve: chartCurve(s.curve ?? 'monotone'),
    ...(s.dash === 'dashed' && { strokeDasharray: DASH }),
    ...(yScale !== undefined && { yScale }),
  })
}
