/**
 * `Sparkline` — a quiet inline trend, line or bar (`docs/V2-SPEC.md` § 9.3; the two 1.x sparkline
 * kinds, merged). Guide-free and zero-margin, so the plot is the whole box: no axes, grid, legend,
 * cursor or tooltip. It does not ride `CartesianChart` (all of that is the rung's chrome); it
 * compiles a bare definition and mounts it on the same host. `width` omitted, the host measures
 * the container, which is what a `StatCard` sparkline slot or a flex row wants.
 */
import { dot } from '@tanstack/charts/dot'
import { decorative } from '@tanstack/charts/mark/decorative'
import { lineY } from '@tanstack/charts/line'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { useId, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { BasaltProps } from '../common/props'
import { VX } from '../tokens'
import type { CartesianDefinition } from './compile'
import { chartCurve } from './curves'
import { barMark } from './marks'
import { ChartEngine, idPrefixOf } from './host'
import { ChartPlaceholder, resolveChartState } from './state'
import { CHART_THEME } from './theme'
import type { ChartState } from './types'

export type SparklineProps = BasaltProps & {
  /** The accessible name. Required: a chart without one is an unlabeled image. */
  ariaLabel: string
  data: readonly number[]
  /** Height in px. */
  height: number
  /** Width in px. Default: the container's, measured by the host. */
  width?: number | undefined
  /** Default `'line'`. */
  mark?: 'line' | 'bar' | undefined
  /** A `VX.*` ref or a series token. Default `VX.faint`. */
  color?: string | undefined
  /** Paints the last point in `emphasisColor` — the one reading a trend beside a KPI is for.
   * Default `true`; pass `false` for a bare line. */
  emphasizeLast?: boolean | undefined
  /** Default `VX.line`, the line's own neutral, so a single metric stays neutral. Pass a status or
   * trend colour to make the end dot carry a verdict. */
  emphasisColor?: string | undefined
  /** Pending / error / empty, the same contract as every other kind. The placeholder fills the
   * sparkline's own `width` × `height`, so a loading tile does not shift when the trend lands. */
  state?: ChartState | undefined
}

type Point = { i: number; v: number | null }

const LINE_WIDTH = 1.5
const DOT_R = 2.5
const BAR_GAP = 0.15
// Pixel policy of the self-pooling (`poolSparkline`): the densest a series may draw.
const LINE_PX_PER_POINT = 1
const BAR_PX_PER_BAR = 2
/** First, last and one min/max pair: the fewest points a pooled line can hold. */
const LINE_POOL_MIN = 4

const finite = (v: number): number | null => (Number.isFinite(v) ? v : null)

/** Min and max of the finite values, by loop (a spread overflows the stack on long series). */
function extent(rows: readonly Point[]): readonly [number, number] | null {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const r of rows) {
    if (r.v === null) continue
    if (r.v < lo) lo = r.v
    if (r.v > hi) hi = r.v
  }
  return lo <= hi ? [lo, hi] : null
}

/** A row with its value proven finite, so no cast carries it through the pooling. */
type Sample = { row: Point; v: number }
const sampleOf = (row: Point): Sample | null => (row.v === null ? null : { row, v: row.v })

/** `rows` cut into `count` consecutive buckets of near-equal length (empty ones dropped). */
function buckets(rows: readonly Point[], count: number): Point[][] {
  const size = rows.length / count
  return Array.from({ length: count }, (_, b) =>
    rows.slice(Math.round(b * size), Math.round((b + 1) * size)),
  ).filter((bucket) => bucket.length > 0)
}

/** One maximal stretch of finite rows inside a bucket. */
type Run = { first: Sample; lo: Sample; hi: Sample; last: Sample; afterGap: boolean }

/** A run's rows in index order: its min and max, plus the edge that touches a gap, so the gap
 * stays exactly where the input had it. */
function runRows(run: Run, beforeGap: boolean): Point[] {
  const keep = [
    run.lo,
    run.hi,
    ...(run.afterGap ? [run.first] : []),
    ...(beforeGap ? [run.last] : []),
  ]
  const byIndex = new Map(keep.map((k) => [k.row.i, k.row]))
  return [...byIndex.values()].toSorted((a, b) => a.i - b.i)
}

/**
 * A line, pooled: the first and last rows, and each bucket's min and max between them. A null
 * row is a gap and is never pooled across: a run is closed at every null, one null row (at the
 * gap's first index) stands for the whole gap, and the finite rows beside it are kept.
 */
function poolLine(rows: readonly Point[], cap: number): readonly Point[] {
  const first = rows[0]
  const last = rows.at(-1)
  if (first === undefined || last === undefined) return rows
  if (cap < LINE_POOL_MIN) return [first, last]
  const out: Point[] = [first]
  const endsInGap = (): boolean => out.at(-1)?.v === null
  for (const bucket of buckets(rows.slice(1, -1), Math.floor(cap / 2) - 1)) {
    let run: Run | undefined
    for (const row of bucket) {
      const s = sampleOf(row)
      if (s === null) {
        if (run !== undefined) out.push(...runRows(run, true))
        run = undefined
        if (!endsInGap()) out.push(row)
        continue
      }
      run =
        run === undefined
          ? { first: s, lo: s, hi: s, last: s, afterGap: endsInGap() }
          : { ...run, lo: s.v < run.lo.v ? s : run.lo, hi: s.v > run.hi.v ? s : run.hi, last: s }
    }
    if (run !== undefined) out.push(...runRows(run, false))
  }
  return last.v === null && endsInGap() ? out : [...out, last]
}

/** Bars, pooled: the first and last rows and one bar per bucket between them, the value furthest
 * from zero; a bucket of nulls is one null bar. Re-indexed 0..n-1 (a band x). */
function poolBar(rows: readonly Point[], cap: number): readonly Point[] {
  const first = rows[0]
  const last = rows.at(-1)
  if (first === undefined || last === undefined) return rows
  const furthest = (group: readonly Point[]): number | null =>
    group.reduce<number | null>((best, r) => {
      if (r.v === null) return best
      return best === null || Math.abs(r.v) > Math.abs(best) ? r.v : best
    }, null)
  if (cap < 2) return [{ i: 0, v: furthest(rows) }]
  const values =
    cap === 2
      ? [first.v, last.v]
      : [first.v, ...buckets(rows.slice(1, -1), cap - 2).map(furthest), last.v]
  return values.map((v, i) => ({ i, v }))
}

/**
 * Pools a series to what `width` px can show, so the caller never sizes it: at most one point
 * per `LINE_PX_PER_POINT` (min/max-preserving) or one bar per `BAR_PX_PER_BAR`. A series at or
 * under its cap is returned as is, so a short series draws exactly as before; `width <= 0`
 * (unmeasured) pools nothing. A line is never pooled below its two endpoints.
 */
export function poolSparkline(
  rows: readonly Point[],
  width: number,
  mark: 'line' | 'bar',
): readonly Point[] {
  const cap = Math.floor(width / (mark === 'bar' ? BAR_PX_PER_BAR : LINE_PX_PER_POINT))
  if (width <= 0 || rows.length <= Math.max(cap, mark === 'bar' ? 1 : 2)) return rows
  return mark === 'bar' ? poolBar(rows, cap) : poolLine(rows, cap)
}

function compileSparkline(
  source: readonly Point[],
  [lo, hi]: readonly [number, number],
  mark: 'line' | 'bar',
  color: string,
  emphasisColor: string | null,
): CartesianDefinition {
  return {
    chart: ({ width }) => {
      const rows = poolSparkline(source, width, mark)
      const last = rows.at(-1)
      if (mark === 'bar') {
        return {
          marks: [
            barMark(rows, {
              id: 'bars',
              x: 'i',
              y: 'v',
              fill: (r: Point) =>
                emphasisColor !== null && r.i === rows.length - 1 ? emphasisColor : color,
            }),
          ],
          scales: {
            x: {
              scale: scaleBand<number>()
                .domain(rows.map((r) => r.i))
                .padding(BAR_GAP),
              axis: false as const,
            },
            y: {
              scale: scaleLinear().domain([Math.min(lo, 0), Math.max(hi, 0) || 1]),
              axis: false as const,
            },
          },
          theme: CHART_THEME,
          guides: false,
          margin: 0,
        }
      }
      // A flat or single-point series needs an extent; 10% air keeps the stroke inside the box.
      const pad = (hi - lo) * 0.1 || 1
      // Half a dot of air at each end, in index units, so the last-point dot is not clipped.
      const xPad = emphasisColor === null ? 0 : (source.length - 1) * 0.04 || 0.5
      return {
        marks: [
          lineY(rows, {
            id: 'line',
            x: 'i',
            y: 'v',
            stroke: color,
            strokeWidth: LINE_WIDTH,
            curve: chartCurve('monotone'),
          }),
          ...(emphasisColor !== null && last !== undefined && last.v !== null
            ? [
                decorative(
                  dot([last], { id: 'last', x: 'i', y: 'v', r: DOT_R, fill: emphasisColor }),
                ),
              ]
            : []),
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([-xPad, Math.max(source.length - 1, 1) + xPad]),
            axis: false as const,
          },
          y: { scale: scaleLinear().domain([lo - pad, hi + pad]), axis: false as const },
        },
        theme: CHART_THEME,
        guides: false,
        margin: 0,
      }
    },
  }
}

/** `useId` output (`«r1»`, `:r1:`) is not a safe SVG id fragment. */

export function Sparkline(props: SparklineProps): ReactElement {
  const {
    ariaLabel,
    data,
    height,
    width,
    mark = 'line',
    color = VX.faint,
    emphasizeLast = true,
    emphasisColor = VX.line,
    state,
    className,
    style,
  } = props
  const id = useId()
  const definition = useMemo(() => {
    const rows: Point[] = data.map((v, i) => ({ i, v: finite(v) }))
    const range = extent(rows)
    // No finite value means nothing to scale: the empty render, never an Infinity domain.
    if (range === null) return null
    return compileSparkline(rows, range, mark, color, emphasizeLast ? emphasisColor : null)
  }, [data, mark, color, emphasizeLast, emphasisColor])
  const resolved = resolveChartState(state)
  return (
    <div
      data-basalt-sparkline=""
      {...(className !== undefined && { className })}
      style={{ width: width ?? '100%', height, minWidth: 0, ...style }}
    >
      {resolved !== null && <ChartPlaceholder state={state} height={height} compact />}
      {resolved === null && definition !== null && (
        <ChartEngine
          definition={definition}
          ariaLabel={ariaLabel}
          height={height}
          idPrefix={idPrefixOf(id, 'spark')}
          coarse={false}
        />
      )}
    </div>
  )
}
