/**
 * The value labels of the bar series that set `values`, pure: one label per bar at its end, a stack
 * one total above (a negative part below) it, placed by the kit's own placer clear of the host's
 * obstacles and of each other. Where room runs out the label of a highlighted bar stays, then the
 * larger values, then the earlier x. Labels are decorative (the tooltip and the data table carry the
 * values). A normalized stack draws none: its bars are shares, not the values a label would name.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { BASALT } from '../../tokens'
import type { ChartLabel, LabelBox, LabelSpot } from '../chart-labels'
import { estimateWidth as measure, fitsWith, placeWith } from '../label-place'
import { dimmedPaint } from '../marks'
import type { PlotPx } from '../label-obstacles'
import type { ChartMarks, ChartSeries, ChartX } from '../types'
import { clampToDomain } from './axis-ext'
import { CV } from './theme'

/** The share of a bar slot kept between two grouped bars (`group({ padding })` in `bars-marks`). */
const GROUP_PADDING = 0.1
/** Air between a bar's end and its label, px. */
const GAP = 3
/** Air a label keeps inside the bar it stands in, px. */
const INSIDE_PAD = 2
const SIZE = BASALT.text.micro
type Side = 'left' | 'right'

/** One bar (or one stack end) to label. */
type Candidate<X extends ChartX> = {
  x: X
  side: Side
  text: string
  /** The value, drawn position: held on the plot's edge. */
  at: number
  /** The anchor in plot px: the middle of the bar's end. */
  anchor: { x: number; y: number }
  /** The band's centre in plot px, where the text mark's datum sits. */
  band: number
  /** The bar's body in px, for a label that stands inside it. */
  body: { width: number; height: number }
  /** The label's side of the baseline: above for a value of 0 or more. */
  up: boolean
  highlighted: boolean
  dimmed: boolean
  magnitude: number
}

export type BarValuesInput<T, X extends ChartX> = {
  /** The visible bar series, in stack order (bottom first). */
  series: readonly ChartSeries<T>[]
  data: readonly T[]
  x: (d: T) => X
  fraction: (x: X) => number | null
  /** Half a bar's body as a share of the plot width. */
  barHalf: number
  stack: 'stacked' | 'normalized' | undefined
  sideOf: (s: ChartSeries<T>) => Side
  domainOf: (side: Side) => readonly [number, number]
  scaleOf: (side: Side) => 'y' | 'y2'
  /** The axis' number format: the label's text when the series sets none. */
  formatOf: (side: Side) => (v: number) => string
  frame: PlotPx
  focused: T | null
  /** Every box a label keeps clear of: captions, rules, line paths and the bar bodies. */
  obstacles: readonly LabelBox[]
  /** The same without the bar bodies: where a label inside a bar may stand. */
  clear: readonly LabelBox[]
}

/** The text of a bar's value: the series' own function, its `format`, else the y axis'. */
function textOf<T>(s: ChartSeries<T>, v: number, d: T, axisFormat: (v: number) => string): string {
  if (typeof s.values === 'function') return s.values(v, d)
  return s.formatValue ? s.formatValue(v, d) : axisFormat(v)
}

/** The bars to label: one per datum of a grouped series, one or two per x of a stack. */
function candidates<T, X extends ChartX>(input: BarValuesInput<T, X>): Candidate<X>[] {
  if (input.stack === 'normalized') return []
  const { frame, barHalf } = input
  const yPx = (side: Side, v: number): number => {
    const [lo, hi] = [Math.min(...input.domainOf(side)), Math.max(...input.domainOf(side))]
    return ((hi - clampToDomain(v, [lo, hi])) / (hi - lo || 1)) * frame.height
  }
  const make = (opts: {
    x: X
    side: Side
    text: string
    value: number
    centre: number
    width: number
    group: readonly T[]
    s: readonly ChartSeries<T>[]
  }): Candidate<X> => {
    const { side, value } = opts
    const bandX = (input.fraction(opts.x) ?? 0) * frame.width
    const end = yPx(side, value)
    return {
      x: opts.x,
      side,
      text: opts.text,
      at: clampToDomain(value, input.domainOf(side)),
      anchor: { x: opts.centre * frame.width, y: end },
      band: bandX,
      body: { width: opts.width * frame.width, height: Math.abs(end - yPx(side, 0)) },
      up: value >= 0,
      highlighted: opts.s.some((s) => opts.group.some((d) => s.highlight?.(d))),
      dimmed: input.focused !== null && !opts.group.includes(input.focused),
      magnitude: Math.abs(value),
    }
  }
  const out: Candidate<X>[] = []
  const bars = input.series
  const labelled = (s: ChartSeries<T>): boolean => s.values !== undefined && s.values !== false

  if (input.stack === undefined) {
    // A grouped body splits into one slot per bar series, a tenth of a slot between them.
    const step = (2 * barHalf) / (bars.length - GROUP_PADDING)
    for (const [i, s] of bars.entries()) {
      if (!labelled(s)) continue
      const side = input.sideOf(s)
      for (const d of input.data) {
        const v = s.getValue(d)
        const fx = input.fraction(input.x(d))
        if (v === null || !Number.isFinite(v) || fx === null) continue
        const slot = step * (1 - GROUP_PADDING)
        out.push(
          make({
            x: input.x(d),
            side,
            text: textOf(s, v, d, input.formatOf(side)),
            value: v,
            centre: fx - barHalf + i * step + slot / 2,
            width: slot,
            group: [d],
            s: [s],
          }),
        )
      }
    }
    return out
  }

  // A stack: one total per x and side, above its positive part and below its negative one.
  type Total = {
    x: X
    fx: number
    side: Side
    up: number
    down: number
    seen: boolean
    data: T[]
    first?: { s: ChartSeries<T>; d: T }
  }
  const totals = new Map<string, Total>()
  for (const s of bars) {
    const side = input.sideOf(s)
    for (const d of input.data) {
      const v = s.getValue(d)
      const x = input.x(d)
      const fx = input.fraction(x)
      if (v === null || !Number.isFinite(v) || fx === null) continue
      const at = totals.get(`${side}:${fx}`) ?? {
        x,
        fx,
        side,
        up: 0,
        down: 0,
        seen: false,
        data: [],
      }
      at.up += Math.max(v, 0)
      at.down += Math.min(v, 0)
      at.seen = true
      at.data.push(d)
      if (at.first === undefined && labelled(s)) at.first = { s, d }
      totals.set(`${side}:${fx}`, at)
    }
  }
  for (const t of totals.values()) {
    if (t.first === undefined) continue
    const { s, d } = t.first
    const stackSeries = bars.filter((b) => input.sideOf(b) === t.side)
    const base = {
      x: t.x,
      side: t.side,
      centre: t.fx,
      width: 2 * barHalf,
      group: t.data,
      s: stackSeries,
    }
    const parts = [t.up > 0 ? t.up : null, t.down < 0 ? t.down : null]
    if (parts.every((p) => p === null))
      out.push(make({ ...base, text: textOf(s, 0, d, input.formatOf(t.side)), value: 0 }))
    for (const value of parts)
      if (value !== null)
        out.push(make({ ...base, text: textOf(s, value, d, input.formatOf(t.side)), value }))
  }
  return out
}

/**
 * The value labels as text marks and the boxes they took, in plot px, for the marks a page draws
 * later to keep clear of. Outside the bar's end first; a label that finds no room there stands
 * inside the bar's end, in the card's own colour, when it fits the bar; else it is dropped.
 */
export function barValueLabels<T, X extends ChartX>(
  input: BarValuesInput<T, X>,
): { marks: ChartMarks; boxes: LabelBox[] } {
  const found = candidates(input)
  if (found.length === 0 || input.frame.width <= 0 || input.frame.height <= 0)
    return { marks: [], boxes: [] }
  // Highlighted first, then the larger value, then the earlier x.
  const rank = found
    .map((c, i) => ({ c, i }))
    .toSorted(
      (a, b) =>
        Number(b.c.highlighted) - Number(a.c.highlighted) ||
        b.c.magnitude - a.c.magnitude ||
        a.i - b.i,
    )
  const priority = new Map(rank.map(({ i }, r) => [i, found.length - r]))
  const label = (c: Candidate<X>, i: number, spot: LabelSpot): ChartLabel<string> => ({
    key: String(i),
    text: c.text,
    x: c.anchor.x,
    y: c.anchor.y,
    size: SIZE,
    priority: priority.get(i) ?? 0,
    spots: [spot],
  })
  const outside = placeWith(
    measure,
    found.map((c, i) => label(c, i, c.up ? 'above' : 'below')),
    input.frame,
    { gap: GAP, obstacles: input.obstacles, size: SIZE },
  )
  const taken = new Set(outside.placed.map((p) => p.key))
  const fitting = found.flatMap((c, i) =>
    !taken.has(String(i)) && fitsWith(measure, c.text, c.body, { size: SIZE, pad: INSIDE_PAD })
      ? [label(c, i, c.up ? 'below' : 'above')]
      : [],
  )
  const inside = placeWith(measure, fitting, input.frame, {
    gap: INSIDE_PAD,
    obstacles: [...input.clear, ...outside.placed],
    size: SIZE,
  })
  const marks = [
    ...outside.placed.map((p) => ({ p, ink: CV.inkMuted })),
    ...inside.placed.map((p) => ({ p, ink: CV.surface })),
  ].map(({ p, ink }) => {
    const c = found[Number(p.key)] as Candidate<X>
    return {
      x: c.x,
      y: c.at,
      scale: input.scaleOf(c.side),
      text: p.text,
      dx: p.dx + (c.anchor.x - c.band),
      dy: p.dy,
      fill: c.dimmed ? dimmedPaint(ink) : ink,
    }
  })
  const scales = [...new Set(marks.map((m) => m.scale))]
  return {
    marks: scales.map((scale) =>
      decorative(
        text(
          marks.filter((m) => m.scale === scale),
          {
            id: `bar-values-${scale}`,
            x: (m: (typeof marks)[number]) => m.x,
            y: (m: (typeof marks)[number]) => m.y,
            yScale: scale,
            text: (m: (typeof marks)[number]) => m.text,
            fill: (m: (typeof marks)[number]) => m.fill,
            fontSize: SIZE,
            anchor: 'middle',
            dx: (m: (typeof marks)[number]) => m.dx,
            dy: (m: (typeof marks)[number]) => m.dy,
          },
        ),
      ),
    ) as unknown as ChartMarks,
    boxes: [...outside.placed, ...inside.placed].map(({ left, top, width, height }) => ({
      left,
      top,
      width,
      height,
    })),
  }
}
