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
import type { ChartLabel, LabelBox, LabelSpot, PlacedLabel } from '../chart-labels'
import { estimateWidth as measure, fitsWith, lineHeight, placeWith } from '../label-place'
import { barOnCard, dimmedPaint, inkOn } from '../marks'
import { DEFAULT_BAR_OPACITY } from '../parts/bars-marks'
import type { BarState } from '../marks'
import type { PlotPx } from '../label-obstacles'
import type { ChartMarks, ChartSeries, ChartX } from '../types'
import { CARET_SIZE, clampToDomain, offScaleSide } from './axis-ext'
import { CV } from './theme'

/** The share of a bar slot kept between two grouped bars (`group({ padding })` in `bars-marks`). */
const GROUP_PADDING = 0.1
/** Air between a bar's end and its label, px. */
const GAP = 3
/** Air a label keeps inside the bar it stands in, px. */
const INSIDE_PAD = 2
/** How far a label standing in a bar may reach past each side of it, px: the text estimate errs wide, and a bar a few px under its label still holds it. */
const OVERHANG = 4
const SIZE = BASALT.text.micro
/** The centre of a clamped value's row from the plot's edge: its box clears the edge's gridline. */
const CLAMPED_ROW = Math.max(CARET_SIZE / 2, lineHeight(SIZE) / 2 + 2)
/** The least side of a text-sized box, px: a rule is 4 px thick and a line path piece under 11, a caption is 13 and more. */
const CAPTION_MIN_PX = 12
type Side = 'left' | 'right'

/** One bar (or one stack end) to label. */
type Candidate<X extends ChartX> = {
  x: X
  side: Side
  text: string
  /** The value, drawn position: held on the plot's edge. */
  at: number
  /** The anchor in plot px: the middle of the bar's end, or for a value past the edge its caret's height. */
  anchor: { x: number; y: number }
  /** The bar's end in plot px, where its value's datum sits. */
  edge: number
  /** The value lies past a bounded axis: its caret is on the plot edge, on this side. */
  clamped: boolean
  caretSide: 'top' | 'bottom' | null
  /** The band's centre in plot px, where the text mark's datum sits. */
  band: number
  /** The bar's body in px, for a label that stands inside it. */
  body: { width: number; height: number }
  /** The label's side of the baseline: above for a value of 0 or more. */
  up: boolean
  highlighted: boolean
  dimmed: boolean
  /** The ink of a label standing on this bar: read against the fill the bar shows in its state. */
  onBar: string
  magnitude: number
  /** A grouped bar's name: `<series key>:<x fraction>`; none for a stack end. */
  id?: string
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
    id?: string
  }): Candidate<X> => {
    const dimmed = input.focused !== null && !opts.group.includes(input.focused)
    const top = opts.s.at(-1) as ChartSeries<T>
    const lit = opts.s.some((s) => opts.group.some((d) => s.highlight?.(d)))
    const state: BarState = dimmed
      ? 'dimmed'
      : input.focused !== null && opts.group.includes(input.focused)
        ? 'focused'
        : 'rest'
    // The ink is chosen against the series' own fill opacity; a per-datum `Series.opacity` is not modelled.
    const onBar = inkOn(
      barOnCard(lit ? CV.brand : top.color, top.fillOpacity ?? DEFAULT_BAR_OPACITY, state),
    )
    const { side, value } = opts
    const bandX = (input.fraction(opts.x) ?? 0) * frame.width
    const end = yPx(side, value)
    const past = offScaleSide(value, input.domainOf(side))
    return {
      x: opts.x,
      side,
      text: opts.text,
      at: clampToDomain(value, input.domainOf(side)),
      edge: end,
      clamped: past !== null,
      caretSide: past,
      anchor: {
        x: opts.centre * frame.width,
        // A clamped bar's value sits in the caret's row, beside its body, its box just inside the
        // plot's edge so the gridline on the edge does not run through it.
        y: past === null ? end : past === 'bottom' ? frame.height - CLAMPED_ROW : CLAMPED_ROW,
      },
      band: bandX,
      body: { width: opts.width * frame.width, height: Math.abs(end - yPx(side, 0)) },
      up: value >= 0,
      highlighted: lit,
      dimmed,
      onBar,
      magnitude: Math.abs(value),
      ...(opts.id !== undefined && { id: opts.id }),
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
            id: `${s.key}:${fx}`,
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
    // A stack of one series has one segment: its total is the bar's own value, so it may stand inside the bar
    // like a grouped value does, where the end has no room outside (a negative bar at the domain's floor, the
    // tallest bar of a fixed domain).
    const idOf = stackSeries.length === 1 ? { id: `${s.key}:${t.fx}` } : {}
    const parts = [t.up > 0 ? t.up : null, t.down < 0 ? t.down : null]
    if (parts.every((p) => p === null))
      out.push(make({ ...base, text: textOf(s, 0, d, input.formatOf(t.side)), value: 0, ...idOf }))
    for (const value of parts)
      if (value !== null)
        out.push(
          make({ ...base, text: textOf(s, value, d, input.formatOf(t.side)), value, ...idOf }),
        )
  }
  return out
}

/** The width of one bar's slot in px: the distance to the nearest other x of the chart. */
function slotPx<T, X extends ChartX>(input: BarValuesInput<T, X>): number {
  const fractions = [
    ...new Set(
      input.data.map((d) => input.fraction(input.x(d))).filter((f): f is number => f !== null),
    ),
  ].toSorted((a, b) => a - b)
  const gaps = fractions.slice(1).map((f, i) => f - (fractions[i] ?? 0))
  return (gaps.length === 0 ? 1 : Math.min(...gaps)) * input.frame.width
}

/**
 * The value labels as text marks and the boxes they took, in plot px, for the marks a page draws
 * later to keep clear of. Outside the bar's end first; a label that finds no room there stands
 * inside the bar's end, in the card's own colour, when it fits the bar; else it is dropped.
 */
export function barValueLabels<T, X extends ChartX>(
  input: BarValuesInput<T, X>,
): { marks: ChartMarks; boxes: LabelBox[]; written: ReadonlySet<string> } {
  const found = candidates(input)
  if (found.length === 0 || input.frame.width <= 0 || input.frame.height <= 0)
    return { marks: [], boxes: [], written: new Set() }
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
  // The bars that name the answer: the highlighted ones, else the largest. Their label survives:
  // it tries the spot above or below its end, and last any free spot, rather than drop.
  const named = new Set(
    (rank.some(({ c }) => c.highlighted)
      ? rank.filter(({ c }) => c.highlighted)
      : rank.slice(0, 1)
    ).map(({ i }) => String(i)),
  )
  const label = (c: Candidate<X>, i: number, spots: readonly LabelSpot[]): ChartLabel<string> => ({
    key: String(i),
    text: c.text,
    x: c.anchor.x,
    y: c.anchor.y,
    size: SIZE,
    priority: priority.get(i) ?? 0,
    spots,
  })
  // Above or below its end, centred over its own bar: a stack total never leaves its stack. A named
  // grouped value may also stand beside its end, but only while the whole label stays inside the
  // bar's own slot, never in a neighbour's. A value past the edge has no room there: its caret is.
  const slot = slotPx(input)
  const outsideSpots = (c: Candidate<X>, i: number): readonly LabelSpot[] => {
    if (c.clamped) return []
    const end: LabelSpot = c.up ? 'above' : 'below'
    if (c.id === undefined || !named.has(String(i)) || GAP + measure(c.text, SIZE) > slot / 2)
      return [end]
    return [end, `${end}-right`, `${end}-left`, 'right', 'left']
  }
  const outside = placeWith(
    measure,
    found.map((c, i) => label(c, i, outsideSpots(c, i))),
    input.frame,
    { gap: GAP, obstacles: input.obstacles, size: SIZE },
  )
  const taken = new Set(outside.placed.map((p) => p.key))
  // A stack total never goes inside its stack: it sits above it, or it is dropped.
  const fitting = found.flatMap((c, i) =>
    !taken.has(String(i)) &&
    !c.clamped &&
    c.id !== undefined &&
    fitsWith(
      measure,
      c.text,
      { ...c.body, width: c.body.width + 2 * OVERHANG },
      { size: SIZE, pad: INSIDE_PAD },
    )
      ? [label(c, i, [c.up ? 'below' : 'above'])]
      : [],
  )
  const inside = placeWith(measure, fitting, input.frame, {
    gap: INSIDE_PAD,
    obstacles: [...input.clear, ...outside.placed],
    size: SIZE,
  })
  // A named bar still without a label takes any spot clear of the other labels, over a rule or a
  // line if it must: a label that names the answer is never dropped for what the host drew.
  const standing = new Set([...taken, ...inside.placed.map((p) => p.key)])
  // A bar that names the answer, a stack total included, takes a spot over a rule or a line when none is
  // clear (a rule through the whole bar): the answer is never dropped for what the host drew.
  const namedBar = (_: Candidate<X>, i: number): boolean => named.has(String(i))
  // Every label a rescue pass landed, in order: the next pass keeps clear of them, so two rescued labels
  // never overlap (n68 at 390: '81/124' and '85/129').
  const earlier: PlacedLabel<string>[] = []
  const rescue = (
    obstacles: readonly LabelBox[],
    keep: (c: Candidate<X>, i: number) => boolean,
  ): ReturnType<typeof placeWith<string>> => {
    const pending = new Set([...standing, ...earlier.map((p) => p.key)])
    const got = placeWith(
      measure,
      found.flatMap((c, i) =>
        keep(c, i) && !c.clamped && !pending.has(String(i))
          ? [label(c, i, outsideSpots(c, i))]
          : [],
      ),
      input.frame,
      {
        gap: GAP,
        obstacles: [...outside.placed, ...inside.placed, ...earlier, ...obstacles],
        size: SIZE,
      },
    )
    earlier.push(...got.placed)
    return got
  }
  // The named stack totals come first, so the others keep clear of them. A stack total that finds no
  // spot clear of the captions, rules and lines is dropped. A named bar takes a spot clear of the
  // captions first, then any spot clear of the other labels: over a rule or a line if it must.
  rescue(input.clear, (c, i) => c.id === undefined && named.has(String(i)))
  // A named stack total that every spot beside its caption, rule and line refused climbs above them one
  // line at a time: still centred over its own stack, never inside it, and off the rule.
  const lifted: PlacedLabel<string>[] = []
  const liftStep = lineHeight(SIZE)
  for (let step = 1; step * liftStep < input.frame.height; step++) {
    const reached = new Set([...standing, ...earlier.map((p) => p.key)])
    const pending = found.flatMap((c, i) =>
      c.id === undefined && named.has(String(i)) && !c.clamped && !reached.has(String(i))
        ? [
            {
              ...label(c, i, [c.up ? 'above' : 'below']),
              y: c.anchor.y + (c.up ? -1 : 1) * step * liftStep,
            },
          ]
        : [],
    )
    if (pending.length === 0) break
    const got = placeWith(measure, pending, input.frame, {
      gap: GAP,
      obstacles: [...outside.placed, ...inside.placed, ...earlier, ...input.obstacles],
      size: SIZE,
    }).placed
    lifted.push(...got)
    earlier.push(...got)
  }
  rescue(
    input.clear.filter((b) => Math.min(b.width, b.height) >= CAPTION_MIN_PX),
    namedBar,
  )
  rescue([], namedBar)
  rescue(input.clear, (c, i) => c.id === undefined && !named.has(String(i)))
  const rescued = { placed: earlier }
  // A clamped bar's value is never dropped: beside its body in the caret's row, the right side
  // first, then the left; over the bar under its caret when neither side has room.
  const others = [...outside.placed, ...rescued.placed, ...inside.placed]
  const right = placeWith(
    measure,
    found.flatMap((c, i) =>
      c.clamped && !standing.has(String(i))
        ? [{ ...label(c, i, ['right']), x: c.anchor.x + c.body.width / 2 }]
        : [],
    ),
    input.frame,
    { gap: GAP, obstacles: [...input.obstacles, ...others], size: SIZE },
  )
  const beside = new Set([...standing, ...right.placed.map((p) => p.key)])
  const left = placeWith(
    measure,
    found.flatMap((c, i) =>
      c.clamped && !beside.has(String(i))
        ? [{ ...label(c, i, ['left']), x: c.anchor.x - c.body.width / 2 }]
        : [],
    ),
    input.frame,
    { gap: GAP, obstacles: [...input.obstacles, ...others, ...right.placed], size: SIZE },
  )
  const settled = new Set([...beside, ...left.placed.map((p) => p.key)])
  // Under the caret, row by row down the bar, the first row clear of the other labels and the zone
  // captions: a value that lost its side of the bar still keeps a row of its own.
  const rowStep = lineHeight(SIZE) + INSIDE_PAD
  const overPlaced: PlacedLabel<string>[] = []
  for (let row = 0; row * rowStep < input.frame.height; row++) {
    const pending = found.flatMap((c, i) =>
      c.clamped && !settled.has(String(i)) && !overPlaced.some((p) => p.key === String(i))
        ? [
            label(
              {
                ...c,
                anchor: {
                  x: c.anchor.x,
                  y: overY(c, input.frame) + (c.caretSide === 'bottom' ? -row : row) * rowStep,
                },
              },
              i,
              [c.caretSide === 'bottom' ? 'above' : 'below'],
            ),
          ]
        : [],
    )
    if (pending.length === 0) break
    const got = placeWith(measure, pending, input.frame, {
      gap: INSIDE_PAD,
      obstacles: [...input.clear, ...others, ...right.placed, ...left.placed, ...overPlaced],
      size: SIZE,
    })
    overPlaced.push(...got.placed)
  }
  const placedAll: PlacedLabel<string>[] = [
    ...outside.placed,
    ...rescued.placed,
    ...right.placed,
    ...left.placed,
    ...inside.placed,
    ...overPlaced,
  ]
  const paintOf = new Map<string, string>([
    ...[...outside.placed, ...rescued.placed, ...right.placed, ...left.placed].map(
      (p) => [p.key, CV.inkMuted] as const,
    ),
    ...[...inside.placed, ...overPlaced].map(
      (p) => [p.key, (found[Number(p.key)] as Candidate<X>).onBar] as const,
    ),
  ])
  const marks = placedAll.map((p) => {
    const c = found[Number(p.key)] as Candidate<X>
    const ink = paintOf.get(p.key) ?? CV.inkMuted
    const onBar = ink === c.onBar
    return {
      x: c.x,
      y: c.at,
      scale: input.scaleOf(c.side),
      text: p.text,
      anchor: p.textAnchor,
      dx: p.textX - c.band,
      dy: p.dy + (p.y - c.edge),
      // A label on a bar reads against the fill the bar shows (dimmed already), so it never dims itself.
      fill: c.dimmed && !onBar ? dimmedPaint(ink) : ink,
    }
  })
  const scales = [...new Set(marks.map((m) => m.scale))]
  const written = new Set(placedAll.flatMap((p) => found[Number(p.key)]?.id ?? []))
  return {
    written,
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
            anchor: (m: (typeof marks)[number]) => m.anchor,
            dx: (m: (typeof marks)[number]) => m.dx,
            dy: (m: (typeof marks)[number]) => m.dy,
          },
        ),
      ),
    ) as unknown as ChartMarks,
    boxes: placedAll.map(({ left, top, width, height }) => ({ left, top, width, height })),
  }
}

/** The y of a clamped bar's value written over its bar, under (or over, at the bottom) its caret. */
function overY(c: { caretSide: 'top' | 'bottom' | null }, frame: { height: number }): number {
  return c.caretSide === 'bottom' ? frame.height - 2 * CARET_SIZE : 2 * CARET_SIZE
}
