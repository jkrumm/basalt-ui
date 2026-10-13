/**
 * `Lines` — n line series over the rung (`docs/V2-SPEC.md` § 9.3; 1.x `ZonedLine` + `MultiLine`).
 * Per series: an optional `area` gradient, dash, curve, markers, the right axis. Per chart:
 * `thresholds` (fills between the first series and a value, Date/number x only). Zones, x-zones,
 * reference lines, `y2`, legend, cursor and tooltip are the rung's.
 *
 * At the wide class with ≤ 3 plotted lines and no `y2`, each line also carries an end label; the
 * legend still names every series (and still toggles them).
 */
import { areaY } from '@tanstack/charts/area'
import { differenceY } from '@tanstack/charts/difference'
import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { useCallback } from 'react'
import type { ReactElement } from 'react'
import { VX } from '../tokens'
import { CartesianRung } from './CartesianChart'
import { areaGradientId } from './compile'
import { chartCurve } from './curves'
import { DASH } from './theme'
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

/** The default plotted stroke: the redesign's 1.9px line overlay. */
export const LINE_STROKE_WIDTH = 1.9
/** A non-highlighted series while a legend entry is hovered. */
const DIMMED = 0.25
const MAX_END_LABELS = 3
/** Below this vertical gap two end labels would collide; then none is drawn. */
const END_LABEL_MIN_GAP = 13
const END_LABEL_DX = 6

export type LinesProps<T, X extends ChartX = ChartX> = Omit<CartesianChartProps<T, X>, 'marks'> & {
  /**
   * Fills between the first visible series and a value, on one side of it. Unavailable on a string
   * x: the engine's `differenceY` takes a Date or number x only.
   */
  thresholds?: [X] extends [string] ? never : readonly Threshold[]
}

const hasValue = <T, X extends ChartX>(r: PlotRow<T, X>): boolean => r.y !== null

function markersOf<T, X extends ChartX>(
  s: ChartSeries<T>,
  rows: readonly PlotRow<T, X>[],
  yScale: string | undefined,
): ChartMarks {
  const getMarker = s.getMarker
  if (!getMarker) return []
  // `dot.fill` is constant, so one decorative dot mark per distinct marker paint.
  const byPaint = new Map<
    string,
    { rows: (PlotRow<T, X> & { r: number })[]; opacity: number; ring: boolean }
  >()
  for (const row of rows) {
    if (row.y === null) continue
    const m = getMarker(row.datum)
    if (!m) continue
    const color = m.color ?? s.color
    const ring = m.ring !== false
    const opacity = m.fillOpacity ?? 1
    const key = `${color}|${opacity}|${ring}`
    const group = byPaint.get(key) ?? { rows: [], opacity, ring }
    group.rows.push({ ...row, r: m.r ?? VX.dotR })
    byPaint.set(key, group)
  }
  return [...byPaint.entries()].map(([key, group], i) => {
    const color = key.slice(0, key.indexOf('|'))
    return decorative(
      dot(group.rows, {
        id: `${s.key}-marker-${i}`,
        x: rowX,
        y: 'y',
        r: 'r',
        fill: color,
        fillOpacity: group.opacity,
        ...(group.ring && { stroke: VX.surface.panel, strokeWidth: 1.5 }),
        ...(yScale !== undefined && { yScale }),
      }),
    )
  })
}

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
  const ys = last.map(({ s, row }) => {
    const domain = s.axis === 'right' && plot.y2Domain ? plot.y2Domain : plot.yDomain
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
  return last.map(({ s, row }) =>
    decorative(
      text([row], {
        id: `${s.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => s.label,
        fill: s.color,
        fontSize: VX.text.micro,
        anchor: 'start',
        dx: END_LABEL_DX,
      }),
    ),
  )
}

export function Lines<T, X extends ChartX = ChartX>(props: LinesProps<T, X>): ReactElement {
  const { thresholds, ...rest } = props
  const { series } = props
  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const indexOf = new Map(series.map((s, i) => [s.key, i]))
      const yScaleOf = (s: ChartSeries<T>): 'y2' | undefined =>
        s.axis === 'right' ? plot.y2 : undefined
      const opacityOf = (s: ChartSeries<T>): number => {
        const base = s.strokeOpacity ?? 1
        const h = plot.highlighted
        return h === null || h === s.key || h === s.parent ? base : base * DIMMED
      }
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
                ...(yScaleOf(primary) !== undefined && { yScale: 'y2' }),
              }),
            ),
          )
        })
      }
      for (const s of plot.visible) {
        if (!s.area) continue
        out.push(
          decorative(
            areaY(plot.rows(s.key), {
              id: `${s.key}-area`,
              x: rowX,
              y2: 'y',
              y1: () => 0,
              fill: `url(#${areaGradientId(indexOf.get(s.key) ?? 0)})`,
              fillOpacity: 1,
              curve: chartCurve(s.curve ?? 'monotone'),
              ...(yScaleOf(s) !== undefined && { yScale: 'y2' }),
            }),
          ),
        )
      }
      for (const s of plot.visible) {
        out.push(
          lineY(plot.rows(s.key), {
            id: s.key,
            x: rowX,
            y: 'y',
            z: 'series',
            stroke: s.color,
            strokeWidth: s.strokeWidth ?? LINE_STROKE_WIDTH,
            strokeOpacity: opacityOf(s),
            curve: chartCurve(s.curve ?? 'monotone'),
            ...(s.dash === 'dashed' && { strokeDasharray: DASH }),
            ...(yScaleOf(s) !== undefined && { yScale: 'y2' }),
          }),
        )
        out.push(...markersOf(s, plot.rows(s.key), yScaleOf(s)))
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
