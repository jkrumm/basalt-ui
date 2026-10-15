/**
 * `Lines` — n line series over the rung (`docs/V2-SPEC.md` § 9.3; the two 1.x line kinds, merged).
 * Per series: an optional `area` gradient, dash, curve, markers, the right axis. Per chart:
 * `thresholds` (fills between the first series and a value, Date/number x only). Zones, x-zones,
 * reference lines, `y2`, legend, cursor and tooltip are the rung's.
 *
 * At the wide class with ≤ 3 plotted lines and no `y2`, each line also carries an end label; the
 * legend still names every series (and still toggles them). A label that would not fit between its
 * last point and the plot's right edge ends at the point instead, above it.
 */
import { areaY } from '@tanstack/charts/area'
import { differenceY } from '@tanstack/charts/difference'
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { useCallback } from 'react'
import type { ReactElement } from 'react'
import { VX } from '../tokens'
import { CartesianRung } from './CartesianChart'
import { areaGradientId } from './compile'
import { chartCurve } from './curves'
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

const MAX_END_LABELS = 3
/** Below this vertical gap two end labels would collide; then none is drawn. */
const END_LABEL_MIN_GAP = 13
const END_LABEL_DX = 6
/** An average glyph's advance as a share of the font size, for the room check. */
const END_LABEL_GLYPH_EM = 0.62
/** A label flipped inside the plot sits this far above its point. */
const END_LABEL_FLIP_DY = -9

export type LinesProps<T, X extends ChartX = ChartX> = Omit<CartesianChartProps<T, X>, 'marks'> & {
  /**
   * Fills between the first visible series and a value, on one side of it. Unavailable on a string
   * x: the engine's `differenceY` takes a Date or number x only.
   */
  thresholds?: [X] extends [string] ? never : readonly Threshold[]
}

const hasValue = <T, X extends ChartX>(r: PlotRow<T, X>): boolean => r.y !== null

function endLabels<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
): ChartMarks {
  if (plot.containerClass !== 'wide' || plot.y2 !== undefined) return []
  if (lines.length === 0 || lines.length > MAX_END_LABELS) return []
  const last = lines.flatMap((s) => {
    const row = plot.rows(s.key).findLast(hasValue)
    return row ? [{ s, row }] : []
  })
  // Collision check in pixels from the plot height: labels that would overlap are not drawn at all.
  // No `y2` here (returned above), so every label reads the left domain.
  const domain = plot.yDomain
  const ys = last.map(({ row }) => {
    if (row.y === null) return Number.NaN
    return ((row.y - domain[0]) / (domain[1] - domain[0] || 1)) * plot.height
  })
  const sorted = ys.toSorted((a, b) => a - b)
  if (
    sorted.some(
      (y, i) => Number.isNaN(y) || (i > 0 && y - (sorted[i - 1] as number) < END_LABEL_MIN_GAP),
    )
  )
    return []
  // The data's x extent, from every row (a null value still has its x): where the last point sits.
  const xs = lines.flatMap((s) => plot.rows(s.key).map((r) => +r.x))
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)]
  return last.map(({ s, row }) => {
    // The room right of the point, against the label's estimated width. A string x (no extent) or a
    // point on the edge leaves none: the label then ends at the point and sits above it, never clipped.
    const fraction = hi > lo ? (+row.x - lo) / (hi - lo) : 1
    const room = (Number.isFinite(fraction) ? 1 - fraction : 0) * plot.plotWidth
    const fits = room >= s.label.length * VX.text.micro * END_LABEL_GLYPH_EM + END_LABEL_DX
    return decorative(
      text([row], {
        id: `${s.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => s.label,
        fill: s.color,
        fontSize: VX.text.micro,
        anchor: fits ? 'start' : 'end',
        dx: fits ? END_LABEL_DX : -END_LABEL_DX,
        ...(!fits && { dy: END_LABEL_FLIP_DY }),
      }),
    )
  })
}

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
        out.push(lineMark(plot, s))
        out.push(...loneDots(plot, s))
        out.push(...markersOf(s, plot.rows(s.key), yScaleOf(plot, s)))
      }
      out.push(
        ...endLabels(
          plot,
          plotted.filter((s) => s.role !== 'reference'),
        ),
      )
      return out
    },
    [series, thresholds],
  )
  return <CartesianRung {...rest} marks={marks} />
}
