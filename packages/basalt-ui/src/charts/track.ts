/**
 * Geometry for marks a page draws on an HTML track (a waterfall row, a contract lane, a run of
 * squares): an axis from a domain and the label pass for one row. It is the `axis` and `row` half of
 * `chartLabels`, and like the rest of it pure: it measures with the checked-in width table, never
 * the DOM, so the server HTML equals the client's.
 *
 * Positions are shares of the track (0..1), written as `left: %`, so they hold at every width. What
 * depends on width is resolved against the container size classes instead of a measured width:
 * - an axis keeps the tick labels that fit at each class's floor, nested, and shows each from the
 *   class where it first fits (`@narrow:`, `@regular:`, `@wide:`);
 * - a row places its labels once, at the narrowest width the track is drawn at. A label anchored at
 *   a mark's edge that fits there fits at every wider width.
 */
import type { CSSProperties } from 'react'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from '@tanstack/charts/scales/time'
import { VX } from '../tokens'

/** What a tick label, a gridline or a row label spreads: classes and a style, no measuring. */
export type TrackProps = {
  className: string
  style: CSSProperties
  'aria-hidden': true
}

/** A value an axis spans. */
export type TrackValue = number | Date

export type TrackTick<V extends TrackValue = number> = {
  value: V
  text: string
  /** The tick's share of the track, 0..1. */
  at: number
  /** The tick label: start-anchored first, end-anchored last, centred between, never wrapping. */
  label: TrackProps
  /** A gridline at the tick, full height of the box it is drawn in. */
  line: TrackProps
}

export type TrackAxis<V extends TrackValue = number> = {
  /** The domain the ticks span: the input, rounded out to whole ticks with `nice`. */
  domain: readonly [V, V]
  /** A value's share of the track, 0..1 (clamped). */
  at: (value: V) => number
  ticks: readonly TrackTick<V>[]
}

export type TrackAxisOptions<V extends TrackValue> = {
  domain: readonly [V, V]
  /** A tick's text. Default: the scale's own tick format. */
  format?: (value: V) => string
  /** Round the domain out to whole ticks, so the end tick is the domain's end. Default true. */
  nice?: boolean
  /** The track's share of the width of its `@container`. Default 1. */
  share?: number
  /** Label font size in px. Default: the chart tick size. */
  size?: number
}

/** A label on one row, at a mark that spans `from`..`to` (shares of the track). */
export type RowLabel<K extends string = string> = {
  key: K
  text: string
  from: number
  to: number
  /** Higher is placed first; ties keep input order. Default 0. */
  priority?: number
}

/** Where a row label landed: after the mark's end, inside its end, or before its start. */
export type RowSpot = 'after' | 'inside' | 'before'

export type PlacedRowLabel<K extends string = string> = RowLabel<K> & {
  spot: RowSpot
  /** Style an `inside` label for ink on the mark's fill through `data-spot`. */
  props: { className: string; style: CSSProperties; 'data-spot': RowSpot }
}

export type TrackRowOptions<V extends TrackValue> = {
  /** The narrowest px width the track is drawn at. Default: the `@narrow` floor times `share`. */
  width?: number
  /** The track's share of the width of its `@container`, for the default `width`. Default 1. */
  share?: number
  /** Spans already taken on the row (other marks), as shares of the track. */
  obstacles?: readonly { from: number; to: number }[]
  /** An axis's ticks: the row's `lines` are these minus every gridline under a placed label. */
  grid?: readonly TrackTick<V>[]
  /** Label font size in px. Default: the chart tick size. */
  size?: number
  /** Px between a label and its mark. Default 4. */
  gap?: number
}

export type TrackRow<K extends string, V extends TrackValue> = {
  placed: PlacedRowLabel<K>[]
  dropped: RowLabel<K>[]
  /** The gridlines to draw on this row: `grid` without the ones a label sits on. */
  lines: TrackTick<V>[]
}

/** The container size classes, narrowest first: the floor in px and the class that shows a tick. */
const TIERS = [
  { floor: 160, show: '' },
  { floor: 240, show: 'hidden @narrow:block' },
  { floor: 480, show: 'hidden @regular:block' },
  { floor: 800, show: 'hidden @wide:block' },
] as const

const NARROW_FLOOR = 240

/** The most ticks an axis offers its widest class; each class keeps a stride of them. */
const CANDIDATES = 12

/** Px kept free between two tick labels. */
const TICK_GAP = 8

const DEFAULT_GAP = 4

const DEFAULT_SIZE: number = VX.text.micro

type Measure = (text: string, size: number) => number

type Span = { left: number; right: number }

const clampShare = (v: number): number => Math.min(1, Math.max(0, v))

const pct = (share: number): string => `${share * 100}%`

/** A label's box in px on a track `width` wide: start-anchored, end-anchored or centred. */
function tickSpan(at: number, width: number, w: number, anchor: Anchor): Span {
  const x = at * width
  if (anchor === 'start') return { left: x, right: x + w }
  if (anchor === 'end') return { left: x - w, right: x }
  return { left: x - w / 2, right: x + w / 2 }
}

type Anchor = 'start' | 'middle' | 'end'

/** The first tick at the track's start is start-anchored and the last at its end end-anchored. */
const anchorOf = (i: number, count: number, at: number): Anchor =>
  i === 0 && at <= 0 ? 'start' : i === count - 1 && at >= 1 ? 'end' : 'middle'

/** Whether the ticks at `picks` fit side by side on a track `width` px wide. */
function fits(picks: readonly Pick[], width: number): boolean {
  let edge = Number.NEGATIVE_INFINITY
  for (const p of picks) {
    const span = tickSpan(p.at, width, p.w, p.anchor)
    if (span.left < 0 || span.right > width || span.left < edge + TICK_GAP) return false
    edge = span.right
  }
  return true
}

type Pick = { i: number; at: number; w: number; anchor: Anchor }

/**
 * Every `stride`-th candidate from the first, plus the last; the one before the last is dropped
 * when it crowds the last at `width` (an un-niced end such as 8.12 s after 8 s).
 */
function strided(all: readonly Pick[], stride: number, width: number): Pick[] {
  const last = all.at(-1)
  if (last === undefined) return []
  const picks = all.filter((p) => p.i % stride === 0 && p !== last)
  const before = picks.at(-1)
  if (before !== undefined && picks.length > 1 && !fits([before, last], width)) picks.pop()
  return [...picks, last]
}

export function trackAxis<V extends TrackValue>(
  options: TrackAxisOptions<V>,
  measure: Measure,
): TrackAxis<V> {
  const { nice = true, share = 1 } = options
  const size = options.size ?? DEFAULT_SIZE
  const dates = options.domain[0] instanceof Date
  const scale = dates
    ? scaleUtc().domain(options.domain as readonly [Date, Date])
    : scaleLinear().domain(options.domain as readonly [number, number])
  if (nice) scale.nice(CANDIDATES)
  scale.range([0, 1])
  const [d0, d1] = scale.domain() as [V, V]
  const toNum = (v: V): number => (v instanceof Date ? v.getTime() : v)
  const at = (v: V): number => clampShare((scale as (x: V) => number | undefined)(v) ?? 0)
  const fallback = scale.tickFormat(CANDIDATES) as (v: V) => string
  const format = options.format ?? fallback

  // The candidates, with the domain's own ends when the scale's ticks stop short of them.
  const raw = scale.ticks(CANDIDATES) as V[]
  const values: V[] = [...raw]
  if (values.length === 0 || toNum(values[0] as V) > toNum(d0)) values.unshift(d0)
  if (toNum(values.at(-1) as V) < toNum(d1)) values.push(d1)
  const picks: Pick[] = values.map((v, i) => {
    const share0 = at(v)
    return {
      i,
      at: share0,
      w: measure(format(v), size),
      anchor: anchorOf(i, values.length, share0),
    }
  })

  // Widest class first: its stride, then each narrower class a multiple of it, so sets nest.
  const tierOf = new Map<number, number>()
  let stride = 1
  for (let t = TIERS.length - 1; t >= 0; t--) {
    const width = (TIERS[t] as (typeof TIERS)[number]).floor * share
    let k = stride
    while (k < picks.length && !fits(strided(picks, k, width), width)) k += stride
    stride = k
    for (const p of strided(picks, k, width)) tierOf.set(p.i, t)
  }

  const ticks = picks.flatMap((p): TrackTick<V>[] => {
    const tier = tierOf.get(p.i)
    if (tier === undefined) return []
    const show = TIERS[tier]?.show ?? ''
    const value = values[p.i] as V
    const place: CSSProperties =
      p.anchor === 'start' ? { left: 0 } : p.anchor === 'end' ? { right: 0 } : { left: pct(p.at) }
    return [
      {
        value,
        text: format(value),
        at: p.at,
        label: {
          className: cls(
            'absolute top-0 whitespace-nowrap tabular-nums text-muted-foreground',
            p.anchor === 'middle' && '-translate-x-1/2',
            show,
          ),
          style: { ...place, fontSize: size },
          'aria-hidden': true,
        },
        line: {
          className: cls('pointer-events-none absolute inset-y-0 w-px bg-grid', show),
          style: { left: pct(p.at) },
          'aria-hidden': true,
        },
      },
    ]
  })
  return { domain: [d0, d1], at, ticks }
}

const cls = (...parts: (string | false)[]): string => parts.filter(Boolean).join(' ')

const overlaps = (a: Span, b: Span): boolean => a.left < b.right && b.left < a.right

export function trackRow<K extends string, V extends TrackValue>(
  labels: readonly RowLabel<K>[],
  options: TrackRowOptions<V>,
  measure: Measure,
): TrackRow<K, V> {
  const width = options.width ?? NARROW_FLOOR * (options.share ?? 1)
  const size = options.size ?? DEFAULT_SIZE
  const gap = options.gap ?? DEFAULT_GAP
  const taken: Span[] = (options.obstacles ?? []).map((o) => ({
    left: o.from * width,
    right: o.to * width,
  }))
  const marks: Span[] = labels.map((l) => ({ left: l.from * width, right: l.to * width }))
  const placed: PlacedRowLabel<K>[] = []
  const dropped: RowLabel<K>[] = []
  const boxes: Span[] = []
  const ranked = labels
    .map((label, index) => ({ label, index }))
    .toSorted((a, b) => (b.label.priority ?? 0) - (a.label.priority ?? 0) || a.index - b.index)

  for (const { label, index } of ranked) {
    const w = measure(label.text, size)
    const start = label.from * width
    const end = label.to * width
    const others = [...taken, ...boxes, ...marks.filter((_, i) => i !== index)]
    // A label keeps its px size while the track widens, so in shares it shrinks toward its anchor:
    // the hull from the anchor to the far edge at `width` holds it at every wider width.
    const tries: [RowSpot, Span][] = [
      ['after', { left: end, right: end + gap + w }],
      ['inside', { left: end - gap - w, right: end }],
      ['before', { left: start - gap - w, right: start }],
    ]
    const hit = tries.find(
      ([spot, hull]) =>
        hull.left >= 0 &&
        hull.right <= width &&
        !others.some((o) => overlaps(hull, o)) &&
        (spot !== 'inside' || hull.left >= start + gap),
    )
    if (hit === undefined) {
      dropped.push(label)
      continue
    }
    const [spot, hull] = hit
    boxes.push(hull)
    const style: CSSProperties =
      spot === 'after'
        ? { left: pct(label.to), marginLeft: gap }
        : { right: pct(1 - (spot === 'inside' ? label.to : label.from)), marginRight: gap }
    placed.push({
      ...label,
      spot,
      props: {
        className: 'absolute top-1/2 -translate-y-1/2 whitespace-nowrap tabular-nums',
        style: { ...style, fontSize: size },
        'data-spot': spot,
      },
    })
  }

  const lines = (options.grid ?? []).filter((t) => {
    const x = t.at * width
    return !boxes.some((b) => x >= b.left && x <= b.right)
  })
  return { placed, dropped, lines }
}
