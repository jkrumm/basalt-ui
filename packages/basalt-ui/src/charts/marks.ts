/**
 * The line-overlay mark every kind draws the same way: `Lines`' series and `Bars`' line overlays.
 * One place for stroke width, dash, curve, the right-axis binding and legend-hover emphasis (a
 * companion keeps full strength while its `parent` is the highlighted entry).
 */
import { barY } from '@tanstack/charts/bar'
import type { BarYOptions } from '@tanstack/charts/bar'
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

/**
 * A single-series `barY`. The engine stacks every `barY` that has no explicit extent, and a row with
 * no `z`/`color` channel is its own series: an N-by-N matrix (a 5k-row `DualPanel` took 10 s). So
 * the extent is explicit (`y1: 0`) unless the caller asks for a series (`z`, `color`) or a `layout`.
 * Every bar that is not `Bars'` stacked/grouped one is drawn through this.
 */
const given = (v: unknown): boolean => v !== undefined && v !== null

export function barMark<TDatum>(
  rows: Iterable<TDatum>,
  options: BarYOptions<TDatum> = {},
): ChartMarks[number] {
  // On values, not keys: `z: undefined` from a conditional spread asks for no series.
  const seriesAsked = [options.z, options.color, options.layout].some(given)
  const extentGiven = [options.y1, options.y2].some(given)
  return barY(rows, seriesAsked || extentGiven ? options : { ...options, y1: 0 })
}

/** Rows per plot pixel beyond which {@link thinFill} thins. */
const FILL_ROWS_PER_PX = 4

type Extreme = { value: number; index: number }
type Bucket = {
  first: number
  last: number
  minFrom: Extreme
  maxFrom: Extreme
  minTo: Extreme
  maxTo: Extreme
  minGap: Extreme
  maxGap: Extreme
}

const extreme = (value: number, index: number): Extreme => ({ value, index })
const lower = (e: Extreme, value: number, index: number): void => {
  if (value < e.value) Object.assign(e, { value, index })
}
const upper = (e: Extreme, value: number, index: number): void => {
  if (value > e.value) Object.assign(e, { value, index })
}

/**
 * A band fill drawn at `width` px: each pixel column of the plot keeps its first and last row and the
 * rows holding the extremes of `from`, `to` and `to - from`, so the silhouette and every sign
 * crossing survive while a 10k-row series stops costing the engine a scene point per row. `at` is a
 * row's x as a plot fraction (0..1), so an irregularly sampled series (bursts, then a gap) is
 * bucketed by where it is drawn, not by its array index. The series' own first and last row are
 * always kept. Below {@link FILL_ROWS_PER_PX} rows per pixel, or for an unmeasured width, the rows
 * come back unchanged. Order is preserved; pure in its inputs, so the server render and the first
 * client render agree. Only for decorative fills: hover and focus must read the full series.
 */
export function thinFill<R extends { from: number; to: number }>(
  rows: readonly R[],
  width: number,
  at: (row: R) => number,
): R[] {
  const buckets = Math.floor(width)
  if (!(buckets >= 1) || rows.length <= buckets * FILL_ROWS_PER_PX) return rows.slice()
  const kept = new Set<number>([0, rows.length - 1])
  const columns = new Map<number, Bucket>()
  for (const [i, r] of rows.entries()) {
    const position = at(r)
    // A gap (a non-finite value) breaks the fill and must stay where it is; it never seeds or wins an
    // extremum. A row with no position cannot be placed in a column: keep it too.
    if (!Number.isFinite(r.from) || !Number.isFinite(r.to) || !Number.isFinite(position)) {
      kept.add(i)
      continue
    }
    const column = Math.min(buckets - 1, Math.max(0, Math.floor(position * buckets)))
    const gap = r.to - r.from
    const b = columns.get(column)
    if (!b) {
      columns.set(column, {
        first: i,
        last: i,
        minFrom: extreme(r.from, i),
        maxFrom: extreme(r.from, i),
        minTo: extreme(r.to, i),
        maxTo: extreme(r.to, i),
        minGap: extreme(gap, i),
        maxGap: extreme(gap, i),
      })
      continue
    }
    b.last = i
    lower(b.minFrom, r.from, i)
    upper(b.maxFrom, r.from, i)
    lower(b.minTo, r.to, i)
    upper(b.maxTo, r.to, i)
    lower(b.minGap, gap, i)
    upper(b.maxGap, gap, i)
  }
  for (const b of columns.values()) {
    for (const i of [b.first, b.last]) kept.add(i)
    for (const e of [b.minFrom, b.maxFrom, b.minTo, b.maxTo, b.minGap, b.maxGap]) kept.add(e.index)
  }
  return [...kept]
    .toSorted((p, q) => p - q)
    .flatMap((i) => {
      const row = rows[i]
      return row === undefined ? [] : [row]
    })
}
