/**
 * The axis extensions of one chart, pure: the x tick picker for a band axis, the plot fraction of a
 * band's edge (an `at` rule), and the y domain bounds with the off-scale carets they draw.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { BASALT } from '../../tokens'
import type { LabelBox } from '../chart-labels'
import { estimateWidth, lineHeight, placeWith } from '../label-place'
import type { PlotPx } from '../label-obstacles'
import type { ChartMarks, ChartSeries, ChartX, XRefAt } from '../types'
import type { XScaleModel } from './scales'
import { CV } from './theme'

const keyOf = (v: ChartX): number | string => (v instanceof Date ? v.getTime() : v)

/**
 * At most `count` of `values` at an even stride that always keeps the first and the last: the
 * indices are `round(i * (len - 1) / (count - 1))`. `count >= len` keeps all, `1` the first.
 */
export function strideKeepEnds<V>(values: readonly V[], count: number): V[] {
  const len = values.length
  if (len === 0 || !(count >= 1)) return []
  if (count >= len) return [...values]
  if (count < 2) return [values[0] as V]
  const picked = Array.from({ length: count }, (_, i) => Math.round((i * (len - 1)) / (count - 1)))
  return [...new Set(picked)].map((i) => values[i] as V)
}

/** The band keys a tick list names, in the list's order (a key the axis lacks is dropped; Dates by timestamp). */
export function matchBandKeys<X extends ChartX>(
  values: readonly X[],
  wanted: readonly ChartX[],
): X[] {
  const byKey = new Map(values.map((v) => [keyOf(v), v] as const))
  return wanted.flatMap((w) => {
    const hit = byKey.get(keyOf(w))
    return hit === undefined ? [] : [hit]
  })
}

/**
 * The plot fraction of x for a rule: the centre; on a band (or point) axis `start` and `end` sit half
 * a step to either side, so the rule falls mid-gap between two bars. Clamped to the plot. A continuous
 * axis ignores `at`.
 */
export function edgeFraction<X extends ChartX>(
  model: XScaleModel<X>,
  x: X,
  at: XRefAt | undefined,
): number | null {
  const centre = model.fraction(x)
  if (centre === null || at === undefined || at === 'centre') return centre
  if (!(model.band || model.kind === 'string')) return centre
  const shifted = centre + (at === 'start' ? -model.halfStep : model.halfStep)
  return Math.min(1, Math.max(0, shifted))
}

/** A domain as `[min, max]`: a reversed tuple (`[100, 0]`, an inverted axis) is a valid domain. */
const ordered = (domain: readonly [number, number]): [number, number] => [
  Math.min(domain[0], domain[1]),
  Math.max(domain[0], domain[1]),
]

/** Which end of the domain `v` lies past (`top` is the max), or `null` inside it. */
export function offScaleSide(
  v: number,
  domain: readonly [number, number],
): 'top' | 'bottom' | null {
  if (!Number.isFinite(v)) return null
  const [lo, hi] = ordered(domain)
  if (v > hi) return 'top'
  return v < lo ? 'bottom' : null
}

/** `v` held on the plot edge it lies past. */
export const clampToDomain = (v: number, domain: readonly [number, number]): number => {
  const [lo, hi] = ordered(domain)
  return Math.min(hi, Math.max(lo, v))
}

/** The caret's size, px: a dot capped at the plot's edge keeps this much clear above it for the caret. */
export const CARET_SIZE = 8
const CARETS = { top: '▲', bottom: '▼' } as const

/** Air between a caret and the value label beside it, px: the caret's half width and the dot's reach. */
const CAP_LABEL_GAP = 8

/** Where a clamped mark's true value is written: the plot's size and what to keep clear of. */
export type CapLabelsOptions = {
  frame: () => PlotPx
  obstacles: () => readonly LabelBox[]
}

type CapMark = { f: number; text: string; color: string; magnitude: number }

/**
 * The true values of the marks held on the plot's edge, one text mark per series and side: each is
 * placed beside its caret by the kit's placer (right of it, else left), clear of the host's marks
 * and of the other values, and dropped when neither side has room. The caret says "past the edge";
 * this is how far past.
 */
function capValueMarks(
  found: { top: CapMark[]; bottom: CapMark[] },
  opts: { id: string; edge: readonly [number, number]; scale: 'y' | 'y2' } & CapLabelsOptions,
): ChartMarks {
  if (found.top.length === 0 && found.bottom.length === 0) return []
  const frame = opts.frame()
  if (frame.width <= 0 || frame.height <= 0) return []
  const size = BASALT.text.micro
  const half = lineHeight(size) / 2
  const sides = (['top', 'bottom'] as const).flatMap((side) =>
    found[side].map((m, i) => ({ side, m, key: `${side}:${i}` })),
  )
  const { placed } = placeWith(
    estimateWidth,
    sides.map(({ side, m, key }) => ({
      key,
      text: m.text,
      x: m.f * frame.width,
      y: side === 'top' ? half : frame.height - half,
      size,
      priority: m.magnitude,
      spots: ['right', 'left'] as const,
    })),
    frame,
    { gap: CAP_LABEL_GAP, obstacles: opts.obstacles(), size },
  )
  const byKey = new Map(sides.map((s) => [s.key, s]))
  const marks = placed.map((p) => {
    const { side, m } = byKey.get(p.key)!
    // The text mark centres on its datum, which is the edge: carry it to the box's middle.
    return { ...m, side, dx: p.dx, dy: p.top + p.height / 2 - (side === 'top' ? 0 : frame.height) }
  })
  if (marks.length === 0) return []
  type Mark = (typeof marks)[number]
  return [
    decorative(
      text(marks, {
        id: opts.id,
        x: (m: Mark) => m.f,
        y: (m: Mark) => ordered(opts.edge)[m.side === 'top' ? 1 : 0],
        xScale: 'zx',
        yScale: opts.scale,
        text: (m: Mark) => m.text,
        fill: (m: Mark) => m.color,
        fontSize: size,
        anchor: (m: Mark) => (m.dx < 0 ? 'end' : 'start'),
        dx: (m: Mark) => m.dx,
        dy: (m: Mark) => m.dy,
      }),
    ),
  ] as unknown as ChartMarks
}

/**
 * One caret per datum past a bounded axis, in the series colour, at the datum's x on the plot's top
 * or bottom edge. Drawn on the hidden `[0, 1]` x scale `zx`, so any x scale places it.
 */
export function offScaleMarks<T, X extends ChartX>(opts: {
  series: readonly ChartSeries<T>[]
  data: readonly T[]
  x: (d: T) => X
  fraction: (x: X) => number | null
  /** The domain a datum is past (the page's cap), or `null` for an axis with none. */
  domainOf: (s: ChartSeries<T>) => readonly [number, number] | null
  /** The plotted domain, where the caret sits; the cap's own when absent. */
  edgeOf?: (s: ChartSeries<T>) => readonly [number, number]
  yScaleOf: (s: ChartSeries<T>) => 'y' | 'y2'
  /** The text of a value past the cap: the series' `formatValue`, else the axis' format. */
  formatOf: (s: ChartSeries<T>) => (v: number, d: T) => string
  /** Where each caret's true value is written; a series that labels its own values is left to it. */
  labels: CapLabelsOptions
}): ChartMarks {
  return opts.series.flatMap((s) => {
    const domain = opts.domainOf(s)
    if (domain === null) return []
    const found = { top: [] as number[], bottom: [] as number[] }
    const values = { top: [] as CapMark[], bottom: [] as CapMark[] }
    for (const d of opts.data) {
      const v = s.getValue(d)
      const side = v === null ? null : offScaleSide(v, domain)
      const f = side === null ? null : opts.fraction(opts.x(d))
      if (side === null || f === null || v === null) continue
      found[side].push(f)
      values[side].push({ f, text: opts.formatOf(s)(v, d), color: s.color, magnitude: Math.abs(v) })
    }
    const own = s.values !== undefined && s.values !== false
    const edge = opts.edgeOf?.(s) ?? domain
    const carets = (['top', 'bottom'] as const).flatMap((side) =>
      found[side].length === 0
        ? []
        : [
            decorative(
              text(found[side], {
                id: `off-scale-${s.key}-${side}`,
                x: (f: number) => f,
                y: () => ordered(opts.edgeOf?.(s) ?? domain)[side === 'top' ? 1 : 0],
                xScale: 'zx',
                yScale: opts.yScaleOf(s),
                text: () => CARETS[side],
                fill: s.color,
                fontSize: CARET_SIZE,
                anchor: 'middle',
                dy: side === 'top' ? CARET_SIZE : -1,
              }),
            ),
          ],
    )
    const named = own
      ? []
      : capValueMarks(values, {
          id: `off-scale-${s.key}-value`,
          edge,
          scale: opts.yScaleOf(s),
          ...opts.labels,
        })
    return [...carets, ...named]
  }) as unknown as ChartMarks
}

/**
 * One caret per x for a stack whose TOTAL passes a bounded axis (`offScaleMarks` sees one series at a
 * time, so it misses a stack of values that are each inside the cap). The caret sits on the plot's
 * edge in the colour of the segment on top, the brand accent where that datum is highlighted.
 * `series` are the stacked bars, `domain` the cap and `edge` the plotted domain.
 */
export function stackCapMarks<T, X extends ChartX>(opts: {
  series: readonly ChartSeries<T>[]
  data: readonly T[]
  x: (d: T) => X
  fraction: (x: X) => number | null
  domain: readonly [number, number]
  edge: readonly [number, number]
  /** The text of a total past the cap: the left axis' format. */
  format: (v: number) => string
  /** Where each caret's true total is written; a stack whose bars label their own totals is left to them. */
  labels: CapLabelsOptions
}): ChartMarks {
  const found = {
    top: [] as { f: number; color: string; total: number }[],
    bottom: [] as { f: number; color: string; total: number }[],
  }
  for (const d of opts.data) {
    const f = opts.fraction(opts.x(d))
    if (f === null) continue
    const sums = { top: 0, bottom: 0 }
    const last: Partial<Record<'top' | 'bottom', ChartSeries<T>>> = {}
    for (const s of opts.series) {
      const v = s.getValue(d)
      if (v === null || !Number.isFinite(v) || v === 0) continue
      const side = v > 0 ? 'top' : 'bottom'
      sums[side] += v
      last[side] = s
    }
    for (const side of ['top', 'bottom'] as const) {
      const s = last[side]
      if (s === undefined || offScaleSide(sums[side], opts.domain) !== side) continue
      found[side].push({ f, color: s.highlight?.(d) ? CV.brand : s.color, total: sums[side] })
    }
  }
  const carets = (['top', 'bottom'] as const).flatMap((side) =>
    found[side].length === 0
      ? []
      : [
          decorative(
            text(found[side], {
              id: `stack-cap-${side}`,
              x: (c: { f: number }) => c.f,
              y: () => ordered(opts.edge)[side === 'top' ? 1 : 0],
              xScale: 'zx',
              yScale: 'y',
              text: () => CARETS[side],
              fill: (c: { color: string }) => c.color,
              fontSize: CARET_SIZE,
              anchor: 'middle',
              dy: side === 'top' ? CARET_SIZE : -1,
            }),
          ),
        ],
  )
  const own = opts.series.some((s) => s.values !== undefined && s.values !== false)
  const named = own
    ? []
    : capValueMarks(
        {
          top: found.top.map((c) => ({
            ...c,
            text: opts.format(c.total),
            magnitude: Math.abs(c.total),
          })),
          bottom: found.bottom.map((c) => ({
            ...c,
            text: opts.format(c.total),
            magnitude: Math.abs(c.total),
          })),
        },
        { id: 'stack-cap-value', edge: opts.edge, scale: 'y', ...opts.labels },
      )
  return [...carets, ...named] as unknown as ChartMarks
}

/**
 * The x domain of a point chart grown so every dot (`xs`: the dots' x as numbers, `r` the radius and
 * ring in px) sits whole inside the plot, which clips its marks at the edge: a dot centred on the
 * domain's end draws half. Grown only at an end a dot inside the domain reaches, found by settling (the room is a
 * share of the grown span). `null` when no dot reaches an end.
 */
export function xRoomForDots(
  extent: readonly [number, number],
  xs: readonly number[],
  r: number,
  plotWidth: number,
): [number, number] | null {
  const [lo, hi] = extent
  // A dot past the domain is clipped by design (a fixed window), never a reason to widen it.
  const finite = xs.filter((x) => x >= lo && x <= hi)
  if (finite.length === 0 || plotWidth <= 0 || !(hi > lo)) return null
  const [low, high] = [Math.min(...finite), Math.max(...finite)]
  let [from, to] = [lo, hi]
  for (let i = 0; i < 4; i++) {
    const room = (r * (to - from)) / plotWidth
    from = Math.min(lo, low - room)
    to = Math.max(hi, high + room)
  }
  return from === lo && to === hi ? null : [from, to]
}
