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
import { rect } from '@tanstack/charts/rect'
import { ruleY } from '@tanstack/charts/rule'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { text } from '@tanstack/charts/text'
import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, ReactElement } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { VX, alpha } from '../tokens'
import type { CartesianDefinition } from './compile'
import { chartCurve } from './curves'
import { barMark } from './marks'
import { VisualSlotContext } from '../dashboard/visual-slot'
import { bucketDay, dayGranular, defaultNumberFormat } from './compile'
import { referenceLabelPlacement } from './ref-label'
import { readoutClock, readoutDay } from './chart-dates'
import { toDate } from '../format/shared'
import { ChartEngine, idPrefixOf } from './host'
import classes from './sparkline.module.css'
import { ChartPlaceholder, resolveChartState } from './state'
import { CHART_THEME, DASH } from './theme'
import type { ChartMarks, ChartState } from './types'

export type SparklineProps = BasaltProps & {
  /** The accessible name. Required: a chart without one is an unlabeled image. */
  ariaLabel: string
  /** The values, or `{ at, value }` points: `at` (a Date, epoch ms or ISO string) names the point in
   * the readout, as a day or, within one day, an hour, in the page's format locale. */
  data: readonly number[] | readonly { at: Date | number | string; value: number }[]
  /** Height in px. */
  height: number
  /** Width in px. Default: the container's, measured by the host. */
  width?: number | undefined
  /** Default `'line'`. */
  mark?: 'line' | 'bar' | undefined
  /** A `VX.*` ref or a series token. Default `VX.faint`. */
  color?: string | undefined
  /** `'muted'`: the quiet trend line (a muted ink at low alpha). An explicit `color` wins. */
  tone?: 'muted' | undefined
  /** Paints the last point in `emphasisColor` — the one reading a trend beside a KPI is for.
   * Default `true`; pass `false` for a bare line. */
  emphasizeLast?: boolean | undefined
  /** Default `VX.line`, the line's own neutral, so a single metric stays neutral. Pass a status or
   * trend colour to make the end dot carry a verdict. */
  emphasisColor?: string | undefined
  /** Pending / error / empty, the same contract as every other kind. The placeholder fills the
   * sparkline's own `width` × `height`, so a loading tile does not shift when the trend lands. */
  state?: ChartState | undefined
  /** A quiet dashed hairline at a value, or at the mean of the plotted values (`'mean'`). The y
   * domain widens to include it. Not a legend item, never a status colour. */
  reference?: number | 'mean' | undefined
  /** A short caption for the `reference` line (`PR`, `30 d mean`), drawn at the plot end the line
   * is not near, just above the reference (below when there is no room above). */
  referenceLabel?: string | undefined
  /** A productive range (`{ from: 0.6, to: 1 }`) drawn as a quiet band behind the line. The y
   * domain widens to include it. Not a series: no legend item, no tooltip row. A non-finite bound or
   * an empty range (`from === to`) draws nothing and leaves the domain alone. */
  band?: { from: number; to: number } | undefined
  /** Formats the readout's value. Default: the compact number format. */
  format?: ((value: number) => string) | undefined
  /** The readout's x label per point, index-aligned with `data`: pass the point's day ("12 Oct"),
   * and the readout reads `3 items · 12 Oct` beside the point. Omitted: the moment of an `{ at }`
   * point, else the value alone. */
  labels?: readonly string[] | undefined
}

type Point = { i: number; v: number | null }

const LINE_WIDTH = 1.5
const DOT_R = 2.5
const BAR_GAP = 0.15
/** Air between the hovered point and a bare sparkline's readout chip beside it, px. */
const READOUT_GAP = 8
/** Air round a line's plot, px (the engine's plot margin): the end marker stays inside the svg box,
 * so it clears the 2px focus outline round it. A bar plot is flush. */
const LINE_INSET = 3
/** A bare line sparkline shorter than this has no room for a two-line readout (about 34px with its
 * padding and border): it keeps the one-line form, in the in-box band farthest from the line. */
const SHORT_BOX = 36
/** The muted tone's line: the same alpha the consumers hand-built (`alpha(VX.muted, .35)`). */
const MUTED_LINE = alpha(VX.muted, 0.35)
/** The productive band: the chart layer's neutral wash (`BandStrip`'s), under the line in the paint order. */
/** The unit x scale (`zx`) a band is drawn on, whatever the series' own x is. */
const ZONE_X = {
  zx: { channel: 'x' as const, scale: scaleLinear().domain([0, 1]), axis: false as const },
}
const BAND_FILL = alpha(VX.neutral, 0.2)
/** Air between the plot's start and the reference label, so the focus outline never covers it. */
const REFERENCE_LABEL_DX = 3
// Pixel policy of the self-pooling (`poolSparkline`): the densest a series may draw.
const LINE_PX_PER_POINT = 1
const BAR_PX_PER_BAR = 2
/** First, last and one min/max pair: the fewest points a pooled line can hold. */
const LINE_POOL_MIN = 4

const DAY_MS = 86_400_000

const finite = (v: number): number | null => (Number.isFinite(v) ? v : null)

/** The readout's moment per point of `{ at }` data: the day when the points are a day or more apart,
 * else the hour (with the day once they cross midnight). `undefined` for plain values. */
function momentsOf(data: SparklineProps['data']): readonly (string | undefined)[] | undefined {
  const dates: (Date | null)[] = []
  for (const d of data) {
    if (typeof d !== 'object' || d === null) return undefined
    dates.push(toDate(d.at))
  }
  const known = dates.filter((d): d is Date => d !== null)
  if (known.length === 0) return undefined
  // By loop: a spread overflows the stack on a long series.
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const d of known) {
    const day = Math.floor(d.getTime() / DAY_MS)
    if (day < lo) lo = day
    if (day > hi) hi = day
  }
  // Hourly points inside one UTC day name the hour alone; a window that crosses midnight (24 points
  // from 12:00 on, or 25 from 12:00 to 12:00) names the day with each hour, so no clock repeats bare.
  const clockOnly = lo === hi
  const byDay = dayGranular(known)
  return dates.map((d) => {
    if (d === null) return undefined
    if (byDay) return readoutDay(bucketDay(d))
    return clockOnly ? readoutClock(d) : `${readoutDay(d)} ${readoutClock(d)}`
  })
}

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

type Frame = { x: readonly [number, number]; y: readonly [number, number] }

/** The domains a series is drawn in — shared by the compile and the readout's dot, which
 * must land where the mark did. A bar's x is a band, so only its y is a continuous domain. */
function frameOf(
  [lo, hi]: readonly [number, number],
  mark: 'line' | 'bar',
  count: number,
  hasEnd: boolean,
): Frame {
  if (mark === 'bar') return { x: [0, count], y: [Math.min(lo, 0), Math.max(hi, 0) || 1] }
  // A flat or single-point series needs an extent; 10% air keeps the stroke inside the box.
  const pad = (hi - lo) * 0.1 || 1
  // Half a dot of air at each end, in index units, so the last-point dot is not clipped.
  const xPad = hasEnd ? (count - 1) * 0.04 || 0.5 : 0
  return { x: [-xPad, Math.max(count - 1, 1) + xPad], y: [lo - pad, hi + pad] }
}

function compileSparkline(
  source: readonly Point[],
  extentOf: readonly [number, number],
  mark: 'line' | 'bar',
  color: string,
  emphasisColor: string | null,
  reference: number | null,
  referenceLabel: string | undefined,
  band: { from: number; to: number } | null,
): CartesianDefinition {
  const frame = frameOf(extentOf, mark, source.length, emphasisColor !== null)
  const bandMark = (): ChartMarks =>
    band === null
      ? []
      : [
          decorative(
            rect([band], {
              id: 'band',
              x1: () => 0,
              x2: () => 1,
              xScale: 'zx',
              y1: 'from',
              y2: 'to',
              fill: BAND_FILL,
              inset: 0,
            }),
          ),
        ]
  const referenceMark = (height: number, width: number, rows: readonly Point[]): ChartMarks => {
    if (reference === null) return []
    const place =
      referenceLabel === undefined
        ? null
        : referenceLabelPlacement({
            value: reference,
            domain: frame.y,
            height,
            width,
            inset: mark === 'bar' ? 0 : LINE_INSET,
            fontSize: VX.text.micro,
            label: referenceLabel,
            line:
              mark === 'bar'
                ? undefined
                : rows.flatMap((r) =>
                    r.v === null
                      ? []
                      : [{ fx: (r.i - frame.x[0]) / (frame.x[1] - frame.x[0]), y: r.v }],
                  ),
          })
    return [
      ruleY([reference], {
        id: 'reference',
        stroke: VX.line,
        strokeOpacity: 1,
        strokeWidth: 1,
        strokeDasharray: DASH,
      }),
      ...(referenceLabel === undefined || place === null
        ? []
        : [
            decorative(
              text([reference], {
                id: 'reference-label',
                x: () => (place.end === 'end' ? frame.x[1] : mark === 'bar' ? 0 : frame.x[0]),
                y: (v: number) => v,
                text: () => referenceLabel,
                fill: VX.ink2,
                fontSize: VX.text.micro,
                anchor: place.end,
                dx: place.end === 'end' ? -REFERENCE_LABEL_DX : REFERENCE_LABEL_DX,
                dy: place.dy,
              }),
            ),
          ]),
    ]
  }
  return {
    // A bar's hover is the bar and the readout chip: no engine point marker (bar chrome only, as
    // `Bars`).
    ...(mark === 'bar' && { focusRing: false as const }),
    chart: ({ width, height }) => {
      const rows = poolSparkline(source, width, mark)
      const last = rows.at(-1)
      if (mark === 'bar') {
        return {
          marks: [
            ...bandMark(),
            ...referenceMark(height, width, rows),
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
            // The band spans the whole plot, outer half-bars included: a unit scale, not the band x.
            ...ZONE_X,
            y: {
              scale: scaleLinear().domain(frame.y),
              axis: false as const,
            },
          },
          theme: CHART_THEME,
          guides: false,
          margin: 0,
        }
      }
      return {
        marks: [
          ...bandMark(),
          ...referenceMark(height, width, rows),
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
            scale: scaleLinear().domain(frame.x),
            axis: false as const,
          },
          ...ZONE_X,
          y: { scale: scaleLinear().domain(frame.y), axis: false as const },
        },
        theme: CHART_THEME,
        guides: false,
        margin: LINE_INSET,
      }
    },
  }
}

/** An `aria-hidden` ancestor makes the sparkline decorative, whatever its own props say. */
const hidden = (el: HTMLElement): boolean => el.closest('[aria-hidden="true"]') !== null

/** The point `from` steps to along `dir`, skipping gaps; `from` itself when there is none. */
function stepFrom(rows: readonly Point[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < rows.length; i += dir) if (rows[i]?.v !== null) return i
  return from
}

const lastFinite = (rows: readonly Point[]): number | null => {
  const i = rows.findLastIndex((r) => r.v !== null)
  return i < 0 ? null : i
}

/** The mean of the plotted (finite) values. */
function meanOf(rows: readonly Point[]): number {
  let sum = 0
  let n = 0
  for (const r of rows) {
    if (r.v === null) continue
    sum += r.v
    n += 1
  }
  return sum / n
}

/** A plotted point as fractions of the plot rect: `[fx, fy]`, fy down. */
type LinePoint = readonly [number, number]

/** Air between a stacked chip and the plotted line (stroke and dot radius included), px. */
const CLEAR = 4

/** Whether the polyline passes through the box `[left, left + w] x [top, top + h]`, grown by CLEAR. */
function lineHits(
  pts: readonly (readonly [number, number])[],
  box: { left: number; top: number; w: number; h: number },
): boolean {
  const x0 = box.left - CLEAR
  const x1 = box.left + box.w + CLEAR
  const y0 = box.top - CLEAR
  const y1 = box.top + box.h + CLEAR
  for (let i = 0; i < pts.length; i += 1) {
    const [ax, ay] = pts[i] as readonly [number, number]
    const next = pts[i + 1]
    if (next === undefined) return ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1
    const [bx, by] = next
    if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1) continue
    // y at the segment's ends clipped to the box's x-range: y is linear, so its range is the ends'.
    const yAt = (x: number): number => (bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax))
    const ya = yAt(Math.max(Math.min(ax, bx), x0))
    const yb = yAt(Math.min(Math.max(ax, bx), x1))
    if (Math.max(ya, yb) >= y0 && Math.min(ya, yb) <= y1) return true
  }
  return false
}

/**
 * A hosted line's stacked chip is two lines tall, more than the host's one reserved line, so it sits
 * in the plot, and never on the plotted line: first at the cursor (slid with it) at the plot's top,
 * then its bottom, then to the right and to the left of the cursor at either edge, the first of
 * those the line misses. A plot too short for the chip has no such spot: it returns false and the
 * chip hangs from the plot's bottom edge, over the host's footer or card padding: a hover covers the
 * figure's secondary text before it covers the data or the figure's delta above. Not for a strip
 * row (`fitReadout` never stacks there: a chip hung below the plot lands on the next row).
 * Offsets go on `margin-left` and `top`, which React's `left` / `translate` do not own.
 */
function placeStacked(node: HTMLElement, line: () => readonly LinePoint[], fx: number): boolean {
  const layer = node.parentElement
  if (!layer) return true
  const [W, H, w, h] = [layer.clientWidth, layer.clientHeight, node.offsetWidth, node.offsetHeight]
  if (W <= 0 || H <= 0) return true
  const pts = line().map(([x, y]): [number, number] => [x * W, y * H])
  const slid = fx * (W - w)
  const room = (left: number): number => Math.min(Math.max(left, 0), Math.max(W - w, 0))
  const lefts = [slid, room(fx * W + CLEAR * 2), room(fx * W - CLEAR * 2 - w)]
  const tops = [0, Math.max(H - h, 0)]
  const fit = lefts
    .flatMap((left) => tops.map((top) => ({ left, top, w, h })))
    .find((box) => !lineHits(pts, box))
  if (!fit) return false
  node.style.top = `${fit.top}px`
  node.style.marginLeft = `${fit.left - slid}px`
  return true
}

/** The plotted line's y (fraction of the box) at x, interpolated along the polyline; null outside it. */
function lineYAt(pts: readonly (readonly [number, number])[], x: number): number | null {
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const [ax, ay] = pts[i] as readonly [number, number]
    const [bx, by] = pts[i + 1] as readonly [number, number]
    if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx))
      return bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax)
  }
  return null
}

/**
 * A short bare line's one-line chip stays inside its box (it can never reach a sibling above or
 * below). It slides with the point and takes the band, top or bottom, farthest from the plotted line
 * under it; a box so short that the chip fills it moves beside the point instead, so the chip never
 * covers the dot. Offsets go on `margin-left` and `top`, which React's `left` / `translate` do not own.
 */
function placeInBand(node: HTMLElement, line: () => readonly LinePoint[], fx: number): void {
  const layer = node.parentElement
  if (!layer) return
  const [W, H, w, h] = [layer.clientWidth, layer.clientHeight, node.offsetWidth, node.offsetHeight]
  if (W <= 0 || H <= 0) return
  const pts = line().map(([x, y]): [number, number] => [x * W, y * H])
  const slid = fx * (W - w)
  const room = (left: number): number => Math.min(Math.max(left, 0), Math.max(W - w, 0))
  const lefts = [slid, room(fx * W + CLEAR * 2), room(fx * W - CLEAR * 2 - w)]
  const bands = [0, Math.max(H - h, 0)]
  const dotY = lineYAt(pts, fx * W)
  const score = (left: number, top: number): number => {
    const covers =
      dotY !== null &&
      fx * W + CLEAR > left &&
      fx * W - CLEAR < left + w &&
      dotY + CLEAR > top &&
      dotY - CLEAR < top + h
    let nearest = Number.POSITIVE_INFINITY
    for (let x = left; x <= left + w; x += 2) {
      const y = lineYAt(pts, x)
      if (y === null) continue
      nearest = Math.min(nearest, y < top ? top - y : y > top + h ? y - (top + h) : 0)
    }
    return (covers ? -1000 : 0) + Math.min(nearest, 999)
  }
  const fit = lefts
    .flatMap((left) => bands.map((top) => ({ left, top, s: score(left, top) })))
    .reduce((a, b) => (b.s > a.s ? b : a))
  node.style.top = `${fit.top}px`
  node.style.marginLeft = `${fit.left - slid}px`
}

/**
 * A hosted chip in a strip row measures against the row, not the narrow visual column it is drawn
 * in: it stays on the reserved line above the plot and slides over the label column, up to the row's
 * own value. Returns that `[left, right]` in viewport px; null outside a strip row.
 */
function rowSpan(node: HTMLElement): readonly [number, number] | null {
  const row = node.closest('[data-strip-row]')
  if (row === null) return null
  const box = row.getBoundingClientRect()
  const value = row.querySelector('[data-strip-row-value]')
  const end = value === null ? box.right : value.getBoundingClientRect().left
  return [box.left, Math.max(box.left, end - CLEAR)]
}

/**
 * A readout never loses its separator or its date to an ellipsis: when the one-line chip overflows
 * its box it first tightens (`data-tight`: less padding, the separator's air stays), then stacks
 * (`data-stacked`: the date on its own line, placed off the plotted line when `line` is given). A
 * chip in a strip row never stacks (a second line, or a hang below the plot, lands on the next row):
 * it measures against the row, tightens, then drops its date (`data-short`). Set on the node, so a
 * measure never re-renders.
 */
function fitReadout(
  node: HTMLElement,
  line: (() => readonly LinePoint[]) | null,
  fx: number,
  band: boolean,
): void {
  const overflows = (): boolean => node.scrollWidth > node.clientWidth
  node.removeAttribute('data-tight')
  node.removeAttribute('data-stacked')
  node.removeAttribute('data-short')
  // `top` is React's on a bare chip; a hosted line's chip is the only one `placeStacked` writes to.
  if (line !== null) {
    node.style.removeProperty('top')
    node.style.removeProperty('margin-left')
  }
  // `max-width` is React's on every chip; a strip row's chip is the only one widened past it.
  const span = line !== null && !band ? rowSpan(node) : null
  if (line !== null && !band) node.style.maxWidth = '100%'
  if (span !== null && span[1] > span[0]) node.style.maxWidth = `${span[1] - span[0]}px`
  if (overflows()) {
    node.setAttribute('data-tight', '')
    if (overflows()) {
      // A short bare box has no room for two lines: it stays one line, tight.
      if (span !== null) node.setAttribute('data-short', '')
      else if (!band) node.setAttribute('data-stacked', '')
    }
  }
  if (line === null) return
  if (band) {
    placeInBand(node, line, fx)
    return
  }
  if (span === null) {
    // Not in a strip row: the chip hangs from the plot's bottom edge, over the host's footer.
    if (node.hasAttribute('data-stacked') && !placeStacked(node, line, fx))
      node.style.top = `${(node.parentElement?.clientHeight ?? 0) + CLEAR}px`
    return
  }
  // Slide the one-line chip back inside the row (`margin-left` on top of the point's own slide).
  const { left, width } = node.getBoundingClientRect()
  const inside = Math.min(Math.max(left, span[0]), Math.max(span[1] - width, span[0]))
  if (inside !== left) node.style.marginLeft = `${inside - left}px`
}

export function Sparkline(props: SparklineProps): ReactElement {
  const {
    ariaLabel,
    data,
    height,
    width,
    mark = 'line',
    tone,
    color = tone === 'muted' ? MUTED_LINE : VX.faint,
    emphasizeLast = true,
    emphasisColor = VX.line,
    state,
    reference,
    referenceLabel,
    band,
    format = defaultNumberFormat,
    labels,
    className,
    style,
  } = props
  const id = useId()
  const hosted = useContext(VisualSlotContext) !== null
  // Two sources, so a pointer leaving a focused chart hands the readout back to the focused point.
  const [hover, setHover] = useState<number | null>(null)
  const [keyed, setKeyed] = useState<number | null>(null)
  const active = hover ?? keyed
  const readoutRef = useRef<HTMLOutputElement>(null)
  const bandFrom = band?.from
  const bandTo = band?.to
  const model = useMemo(() => {
    const rows: Point[] = data.map((d, i) => ({
      i,
      v: finite(typeof d === 'object' && d !== null ? d.value : d),
    }))
    const range = extent(rows)
    // No finite value means nothing to scale: the empty render, never an Infinity domain.
    if (range === null) return null
    const at = reference === 'mean' ? meanOf(rows) : (reference ?? null)
    const ref = at !== null && Number.isFinite(at) ? at : null
    // The reference is part of the extent, so it is never clipped.
    const bandSpan =
      bandFrom !== undefined &&
      bandTo !== undefined &&
      Number.isFinite(bandFrom + bandTo) &&
      bandFrom !== bandTo
        ? { from: Math.min(bandFrom, bandTo), to: Math.max(bandFrom, bandTo) }
        : null
    const edges = [ref, bandSpan?.from, bandSpan?.to].filter(
      (v): v is number => typeof v === 'number',
    )
    const full: readonly [number, number] = [
      Math.min(range[0], ...edges),
      Math.max(range[1], ...edges),
    ]
    const end = emphasizeLast ? emphasisColor : null
    return {
      rows,
      moments: momentsOf(data),
      frame: frameOf(full, mark, rows.length, end !== null),
      definition: compileSparkline(rows, full, mark, color, end, ref, referenceLabel, bandSpan),
    }
  }, [data, mark, color, emphasizeLast, emphasisColor, reference, referenceLabel, bandFrom, bandTo])
  const resolved = resolveChartState(state)
  const rows = model?.rows
  const interactive = resolved === null && model !== null

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!interactive || rows === undefined || hidden(e.currentTarget)) return
    const box = e.currentTarget.getBoundingClientRect()
    if (box.width <= 0) return
    const frac = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1)
    const [x0, x1] = model.frame.x
    const i =
      mark === 'bar'
        ? Math.min(Math.floor(frac * rows.length), rows.length - 1)
        : Math.min(Math.max(Math.round(x0 + frac * (x1 - x0)), 0), rows.length - 1)
    setHover(rows[i]?.v === null ? null : i)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!interactive || rows === undefined || hidden(e.currentTarget)) return
    const from = keyed ?? lastFinite(rows)
    if (from === null) return
    const next =
      e.key === 'ArrowLeft'
        ? stepFrom(rows, from, -1)
        : e.key === 'ArrowRight'
          ? stepFrom(rows, from, 1)
          : e.key === 'Home'
            ? stepFrom(rows, -1, 1)
            : e.key === 'End'
              ? stepFrom(rows, rows.length, -1)
              : e.key === 'Escape'
                ? null
                : undefined
    if (next === undefined) return
    e.preventDefault()
    setHover(null)
    setKeyed(next)
  }
  const onFocus = (e: FocusEvent<HTMLDivElement>): void => {
    if (!interactive || rows === undefined || keyed !== null || hidden(e.currentTarget)) return
    setKeyed(lastFinite(rows))
  }

  const inset = mark === 'line' ? LINE_INSET : 0
  const layerStyle: CSSProperties = { inset, ['--basalt-spark-inset' as string]: `${inset}px` }
  const value = active === null ? null : (rows?.[active]?.v ?? null)
  const at =
    interactive && active !== null && value !== null
      ? {
          value,
          fx:
            mark === 'bar'
              ? (active + 0.5) / model.rows.length
              : (active - model.frame.x[0]) / (model.frame.x[1] - model.frame.x[0]),
          fy: (model.frame.y[1] - value) / (model.frame.y[1] - model.frame.y[0]),
          label: labels?.[active] ?? model.moments?.[active],
        }
      : null
  // Hosted (a host that reserves a line above the plot): the chip slides with the point (`left` and
  // `translate` take one fraction), inside the box at either edge whatever its width, and the
  // stylesheet lifts it above the plot. Bare: beside the point, on the roomier side and on the half of
  // the box away from it, so the chip covers neither the dot nor anything the host draws round it.
  const short = !hosted && mark === 'line' && height < SHORT_BOX
  const beside = at === null ? null : at.fx > 0.5 ? 'left' : 'right'
  // The chip's fit depends on its text and (bare) its side, not on the pointer's every tick.
  const shown = at !== null
  // The cursor's fraction is read at fit time: it moves with `active`, which already refits.
  const fxRef = useRef(0)
  useLayoutEffect(() => {
    fxRef.current = at?.fx ?? 0
  })
  const fitRef = useRef<() => void>(() => {})
  useLayoutEffect(() => {
    // A hosted line's stacked chip clears the plotted line, built only when the chip stacks; a bar
    // or a bare chip keeps its place.
    const line =
      (hosted || short) && mark === 'line' && model !== null
        ? (): LinePoint[] =>
            model.rows.flatMap((r, i): LinePoint[] =>
              r.v === null
                ? []
                : [
                    [
                      (i - model.frame.x[0]) / (model.frame.x[1] - model.frame.x[0]),
                      (model.frame.y[1] - r.v) / (model.frame.y[1] - model.frame.y[0]),
                    ],
                  ],
            )
        : null
    fitRef.current = () => {
      if (readoutRef.current !== null) fitReadout(readoutRef.current, line, fxRef.current, short)
    }
    fitRef.current()
  }, [active, at?.label, at?.value, beside, hosted, short, mark, model])
  // ...and on the box, which a container resize changes without a hover.
  useEffect(() => {
    const layer = readoutRef.current?.parentElement
    if (!shown || !layer || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fitRef.current())
    observer.observe(layer)
    return () => observer.disconnect()
  }, [shown])
  const readoutStyle: CSSProperties | undefined =
    at === null
      ? undefined
      : hosted || short
        ? { left: `${at.fx * 100}%`, translate: `${-at.fx * 100}% 0`, maxWidth: '100%' }
        : {
            ...(beside === 'right'
              ? {
                  left: `calc(${at.fx * 100}% + ${READOUT_GAP}px)`,
                  maxWidth: `calc(${(1 - at.fx) * 100}% - ${READOUT_GAP}px)`,
                }
              : {
                  right: `calc(${(1 - at.fx) * 100}% + ${READOUT_GAP}px)`,
                  maxWidth: `calc(${at.fx * 100}% - ${READOUT_GAP}px)`,
                }),
            ...(at.fy > 0.5 ? { top: 0 } : { bottom: 0 }),
          }
  return (
    <div
      data-basalt-sparkline=""
      {...(hosted && { 'data-basalt-hosted': '' })}
      role="presentation"
      className={cx(classes.root, className)}
      style={{ width: width ?? '100%', height, minWidth: 0, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={() => {
        setHover(null)
        setKeyed(null)
      }}
    >
      {resolved !== null && <ChartPlaceholder state={state} height={height} compact />}
      {resolved === null && model !== null && (
        <ChartEngine
          definition={model.definition}
          ariaLabel={ariaLabel}
          height={height}
          idPrefix={idPrefixOf(id, 'spark')}
          coarse={false}
        />
      )}
      {at !== null && (
        // One layer on the plot rect (inside a line's margin): the dot and the readout take their
        // fractions of the same box, so both land where the mark did. A bar has no dot: the bar
        // is the marker.
        <span aria-hidden="true" className={classes.layer} style={layerStyle}>
          {mark === 'line' && (
            <span
              data-basalt-sparkline-dot=""
              className={classes.dot}
              style={{ left: `${at.fx * 100}%`, top: `${at.fy * 100}%` }}
            />
          )}
          <output
            ref={readoutRef}
            data-basalt-sparkline-readout=""
            aria-live={hover === null ? 'polite' : 'off'}
            className={classes.readout}
            style={readoutStyle}
          >
            {format(at.value)}
            {at.label !== undefined && (
              <span className={classes.label}>
                <span className={classes.sep}> · </span>
                {at.label}
              </span>
            )}
          </output>
        </span>
      )}
    </div>
  )
}
