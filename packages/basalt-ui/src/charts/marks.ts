/**
 * The line-overlay mark every kind draws the same way: `Lines`' series and `Bars`' line overlays.
 * One place for stroke width, dash, curve, the right-axis binding and legend-hover emphasis (a
 * companion keeps full strength while its `parent` is the highlighted entry).
 */
import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { VX } from '../tokens'
import { chartCurve } from './curves'
import { DASH, DIMMED, LINE_STROKE_WIDTH } from './theme'
import { rowX } from './types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from './types'

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

type MarkerGroup<T, X extends ChartX> = {
  color: string
  opacity: number
  ring: boolean
  rows: (PlotRow<T, X> & { r: number })[]
}

/** A series' `getMarker` points as dots: one decorative mark per distinct paint. */
export function markersOf<T, X extends ChartX>(
  s: ChartSeries<T>,
  rows: readonly PlotRow<T, X>[],
  yScale: 'y2' | undefined,
): ChartMarks {
  const getMarker = s.getMarker
  if (!getMarker) return []
  // `dot.fill` is constant, so one decorative dot mark per distinct marker paint.
  const groups: MarkerGroup<T, X>[] = []
  for (const row of rows) {
    if (row.y === null) continue
    const m = getMarker(row.datum)
    if (!m) continue
    const paint = { color: m.color ?? s.color, opacity: m.fillOpacity ?? 1, ring: m.ring !== false }
    let group = groups.find(
      (g) => g.color === paint.color && g.opacity === paint.opacity && g.ring === paint.ring,
    )
    if (!group) {
      group = { ...paint, rows: [] }
      groups.push(group)
    }
    group.rows.push({ ...row, r: m.r ?? VX.dotR })
  }
  return groups.map((group, i) =>
    decorative(
      dot(group.rows, {
        id: `${s.key}-marker-${i}`,
        x: rowX,
        y: 'y',
        r: 'r',
        fill: group.color,
        fillOpacity: group.opacity,
        ...(group.ring && { stroke: VX.surface.panel, strokeWidth: 1.5 }),
        ...(yScale !== undefined && { yScale }),
      }),
    ),
  )
}
