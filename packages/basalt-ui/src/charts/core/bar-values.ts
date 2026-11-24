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
import { DEFAULT_BAR_OPACITY, MIN_SEGMENT_PX, fitSegments } from '../parts/bars-marks'
import type { BarState } from '../marks'
import type { PlotPx } from '../label-obstacles'
import type { ChartMarks, ChartSeries, ChartX } from '../types'
import { CARET_SIZE, clampToDomain, offScaleSide } from './axis-ext'
import { backingMarks, isStruck } from './label-backing'
import { CV } from './theme'

/** The share of a bar slot kept between two grouped bars (`group({ padding })` in `bars-marks`). */
const GROUP_PADDING = 0.1
/** Air between a bar's end and its label, px. */
const GAP = 3
/** Air between a bar's side and the value written beside its end, px. */
const BESIDE_GAP = 3
/** Air a label keeps inside the bar it stands in, px. */
const INSIDE_PAD = 2
/** How far a label standing in a bar may reach past each side of it, px: the text estimate errs wide, and a bar a few px under its label still holds it. A label needs the bar's height for its line, with no air. */
const OVERHANG = 6
const SIZE = BASALT.text.micro
/** How far into the plot a value label keeps off a tick label's row, px: a tick label is ~47 px wide and a value that starts within this of it reads as its neighbour (`US$0.40 US$0.33`). */
const TICK_REACH = 52

/** The centre of a clamped value's row from the plot's edge: its box clears the edge's gridline. */
const CLAMPED_ROW = Math.max(CARET_SIZE / 2, lineHeight(SIZE) / 2 + 2)
/** Air two value labels keep between their boxes, px: a box is the line, and a line against a line reads as touching. */
const LABEL_AIR = 1.5
/** How far a label may overlap the body of the bar beside its own, px: the text estimate errs wide, and a body the label grazes by a pixel still reads as the neighbour's. */
const BODY_TOLERANCE = 3
/** The same for a chart of few bars, which can raise a value that grazes the neighbour's body (see {@link LIFT_MAX_BARS}). */
const BODY_TOLERANCE_FEW = 1
/** A chart with this many bars or fewer lifts a value a bar's neighbour hides to the first free row above, tied to its bar by a leader; a denser one drops it. */
const LIFT_MAX_BARS = 16
/** How many label lines a lifted value climbs at most. */
const LIFT_MAX_STEPS = 6
/** A label this many px beyond its usual air from the bar's end is tied to the bar by a leader. */
const LEADER_AFTER_PX = 5
/** The least side of a text-sized box, px: a rule is 4 px thick and a line path piece under 11, a caption is 13 and more. */
const CAPTION_MIN_PX = 12
type Side = 'left' | 'right'

/** The boxes with `LABEL_AIR` more on every side: what the next label keeps clear of. */
const aired = (boxes: readonly LabelBox[]): LabelBox[] =>
  boxes.map((b) => ({
    left: b.left - LABEL_AIR,
    top: b.top - LABEL_AIR,
    width: b.width + 2 * LABEL_AIR,
    height: b.height + 2 * LABEL_AIR,
  }))

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
  /** The values each y axis labels, by side: the tick labels stand against the plot's edge, outside it. */
  ticks?: readonly { side: Side; value: number }[]
  focused: T | null
  /** Every box a label keeps clear of: captions, rules, line paths and the bar bodies. */
  obstacles: readonly LabelBox[]
  /** The same without the bar bodies: where a label inside a bar may stand. */
  clear: readonly LabelBox[]
}

/** The row of each y tick label, from the plot's edge in as far as {@link TICK_REACH}, as boxes in plot px. */
function tickRows<T, X extends ChartX>(input: BarValuesInput<T, X>): LabelBox[] {
  const height = lineHeight(SIZE)
  return (input.ticks ?? []).flatMap(({ side, value }): LabelBox[] => {
    const [lo, hi] = [Math.min(...input.domainOf(side)), Math.max(...input.domainOf(side))]
    if (!(value >= lo && value <= hi)) return []
    const y = ((hi - value) / (hi - lo || 1)) * input.frame.height
    return [
      {
        left: side === 'left' ? 0 : input.frame.width - TICK_REACH,
        top: y - height / 2,
        width: TICK_REACH,
        height,
      },
    ]
  })
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
      // A series that labels its own segment names no total.
      if (at.first === undefined && labelled(s) && s.valuesAt !== 'segment') at.first = { s, d }
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
 * inside the bar's end, in the card's own color, when it fits the bar; else it is dropped.
 */
function endValueLabels<T, X extends ChartX>(
  given: BarValuesInput<T, X>,
): {
  marks: ChartMarks
  boxes: LabelBox[]
  written: ReadonlySet<string>
  /** A label sits on a backing: the chart's hidden `[0, 1]` x scale is then in use. */
  backed: boolean
} {
  // A value label keeps off the rows of the tick labels that stand against the plot's edge.
  const rows = tickRows(given)
  const input: BarValuesInput<T, X> = {
    ...given,
    obstacles: [...given.obstacles, ...rows],
    clear: [...given.clear, ...rows],
  }
  const found = candidates(input)
  if (found.length === 0 || input.frame.width <= 0 || input.frame.height <= 0)
    return { marks: [], boxes: [], written: new Set(), backed: false }
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
  // The bodies of the grouped bars among the obstacles are shaved at both sides: at a phone's width the slots
  // are narrower than a label, and a label above its bar may graze the body beside it.
  const bodies = found.flatMap((c): LabelBox[] =>
    c.id === undefined || c.clamped
      ? []
      : [
          {
            left: c.anchor.x - c.body.width / 2,
            top: c.up ? c.edge : c.edge - c.body.height,
            width: c.body.width,
            height: c.body.height,
          },
        ],
  )
  const isBody = (b: LabelBox): boolean =>
    bodies.some(
      (x) =>
        Math.abs(x.left - b.left) < 1.5 &&
        Math.abs(x.width - b.width) < 1.5 &&
        Math.abs(x.top - b.top) < 1.5 &&
        Math.abs(x.height - b.height) < 1.5,
    )
  const tolerance = found.length <= LIFT_MAX_BARS ? BODY_TOLERANCE_FEW : BODY_TOLERANCE
  const shaved = input.obstacles.map((b) =>
    isBody(b) && b.width > 2 * tolerance + 4
      ? { ...b, left: b.left + tolerance, width: b.width - 2 * tolerance }
      : b,
  )
  const outside = placeWith(
    measure,
    found.map((c, i) => label(c, i, outsideSpots(c, i))),
    input.frame,
    { gap: GAP, obstacles: shaved, size: SIZE, air: LABEL_AIR },
  )
  const taken = new Set(outside.placed.map((p) => p.key))
  // A bar that ends at the plot's edge has no room over (under) its end: its value stands beside the bar's end,
  // right of it, else left (the highlighted widest bar of n98, a negative bar at the domain's floor).
  const atEdge = (c: Candidate<X>): boolean =>
    c.up ? c.edge < lineHeight(SIZE) + GAP : input.frame.height - c.edge < lineHeight(SIZE) + GAP
  const aside: PlacedLabel<string>[] = []
  for (const spot of ['right', 'left'] as const) {
    const reached = new Set([...taken, ...aside.map((p) => p.key)])
    const pending = found.flatMap((c, i) =>
      !c.clamped && c.id !== undefined && atEdge(c) && !reached.has(String(i))
        ? [
            {
              ...label(c, i, [spot]),
              x: c.anchor.x + (spot === 'right' ? 1 : -1) * (c.body.width / 2),
              y: c.up ? c.edge + lineHeight(SIZE) / 2 : c.edge - lineHeight(SIZE) / 2,
            },
          ]
        : [],
    )
    if (pending.length === 0) break
    aside.push(
      ...placeWith(measure, pending, input.frame, {
        gap: BESIDE_GAP,
        obstacles: [...aired([...outside.placed, ...aside]), ...shaved],
        air: LABEL_AIR,
        size: SIZE,
      }).placed,
    )
  }
  for (const p of aside) taken.add(p.key)
  // A value its neighbour's bar hides climbs, a line at a time, to the first free row over its own bar (never
  // inside a bar, whose fill no ink reads on at every tone): a leader ties it back to the bar's end below.
  const raiseStep = lineHeight(SIZE)
  const raised: PlacedLabel<string>[] = []
  if (found.length <= LIFT_MAX_BARS)
    for (let step = 1; step <= LIFT_MAX_STEPS; step++) {
      const reached = new Set([...taken, ...raised.map((p) => p.key)])
      const pending = found.flatMap((c, i) =>
        !c.clamped && c.body.height > 0 && !reached.has(String(i))
          ? [
              {
                ...label(c, i, [c.up ? 'above' : 'below']),
                y: c.anchor.y + (c.up ? -1 : 1) * step * raiseStep,
              },
            ]
          : [],
      )
      if (pending.length === 0) break
      raised.push(
        ...placeWith(measure, pending, input.frame, {
          gap: GAP,
          obstacles: [...aired([...outside.placed, ...aside, ...raised]), ...shaved],
          air: LABEL_AIR,
          size: SIZE,
        }).placed,
      )
    }
  for (const p of raised) taken.add(p.key)
  /** Every label standing outside its bar: over its end, or raised off it. */
  const outsideAll = [...outside.placed, ...aside, ...raised]
  // A stack total never goes inside its stack: it sits above it, or it is dropped.
  const fitting = found.flatMap((c, i) =>
    !taken.has(String(i)) &&
    !c.clamped &&
    c.id !== undefined &&
    fitsWith(
      measure,
      c.text,
      {
        // The text itself may fill the slot (and the bar's width less than its overhang), air at the ends or not.
        width: Math.min(slot + INSIDE_PAD, c.body.width + 2 * OVERHANG) + 2 * INSIDE_PAD,
        height: c.body.height + 2 * INSIDE_PAD,
      },
      { size: SIZE, pad: INSIDE_PAD },
    )
      ? [
          {
            ...label(c, i, [c.up ? 'below' : 'above']),
            // The air at the bar's end shrinks to what its height spares, so the line stays inside it.
            y:
              c.anchor.y +
              (c.up ? 1 : -1) *
                (Math.max(0, Math.min(INSIDE_PAD, (c.body.height - lineHeight(SIZE)) / 2)) -
                  INSIDE_PAD),
          },
        ]
      : [],
  )
  const inside = placeWith(measure, fitting, input.frame, {
    gap: INSIDE_PAD,
    obstacles: [...input.clear, ...aired(outsideAll)],
    air: LABEL_AIR,
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
    /** Air kept from the labels already placed: none for the last pass of a label that names the answer. */
    air = LABEL_AIR,
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
        obstacles: [
          ...(air === 0
            ? [...outsideAll, ...inside.placed, ...earlier]
            : aired([...outsideAll, ...inside.placed, ...earlier])),
          ...obstacles,
        ],
        air,
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
  const climb = (
    pick: (c: Candidate<X>, i: number) => boolean,
    obstacles: readonly LabelBox[],
  ): void => {
    for (let step = 1; step * liftStep < input.frame.height; step++) {
      const reached = new Set([...standing, ...earlier.map((p) => p.key)])
      const pending = found.flatMap((c, i) =>
        pick(c, i) && !c.clamped && !reached.has(String(i))
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
        obstacles: [...aired([...outsideAll, ...inside.placed, ...earlier]), ...obstacles],
        air: LABEL_AIR,
        size: SIZE,
      }).placed
      lifted.push(...got)
      earlier.push(...got)
    }
  }
  climb((c, i) => c.id === undefined && named.has(String(i)), input.obstacles)
  rescue(
    input.clear.filter((b) => Math.min(b.width, b.height) >= CAPTION_MIN_PX),
    namedBar,
  )
  rescue([], namedBar)
  // A named bar still without a label (every spot beside it is a neighbour's label or body) climbs above them,
  // centred over its own bar: the answer is never dropped, and no label is written over another.
  climb((c, i) => c.id !== undefined && named.has(String(i)), shaved)
  // The last pass of a label that names the answer: any spot above its bar clear of the other labels' boxes,
  // their air given up (a label squeezed between two others is still readable, a dropped one is not).
  rescue([], namedBar, 0)
  rescue(input.clear, (c, i) => c.id === undefined && !named.has(String(i)))
  const rescued = { placed: earlier }
  // A clamped bar's value is never dropped: beside its body in the caret's row, the right side
  // first, then the left; over the bar under its caret when neither side has room.
  const others = aired([...outsideAll, ...rescued.placed, ...inside.placed])
  const right = placeWith(
    measure,
    found.flatMap((c, i) =>
      c.clamped && !standing.has(String(i))
        ? [{ ...label(c, i, ['right']), x: c.anchor.x + c.body.width / 2 }]
        : [],
    ),
    input.frame,
    { gap: GAP, obstacles: [...input.obstacles, ...others], size: SIZE, air: LABEL_AIR },
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
    {
      gap: GAP,
      obstacles: [...input.obstacles, ...others, ...aired(right.placed)],
      size: SIZE,
      air: LABEL_AIR,
    },
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
      obstacles: [
        ...input.clear,
        ...others,
        ...aired([...right.placed, ...left.placed, ...overPlaced]),
      ],
      air: LABEL_AIR,
      size: SIZE,
    })
    overPlaced.push(...got.placed)
  }
  const placedAll: PlacedLabel<string>[] = [
    ...outsideAll,
    ...rescued.placed,
    ...right.placed,
    ...left.placed,
    ...inside.placed,
    ...overPlaced,
  ]
  const paintOf = new Map<string, string>([
    ...[...outsideAll, ...rescued.placed, ...right.placed, ...left.placed].map(
      (p) => [p.key, CV.inkMuted] as const,
    ),
    ...[...inside.placed, ...overPlaced].map(
      (p) => [p.key, (found[Number(p.key)] as Candidate<X>).onBar] as const,
    ),
  ])
  // A label a rule or a line piece still crosses (every clear spot was taken) sits on a card-colored
  // backing: the rule gives way to the number. A label on a bar's body keeps the bar behind it; one on a
  // bar too short to carry it (a zero) is read against the card, in the card's muted ink.
  const backed = new Set(
    placedAll.flatMap((p) => {
      const c = found[Number(p.key)] as Candidate<X>
      const onBody = paintOf.get(p.key) !== CV.inkMuted && c.body.height >= p.height
      return !onBody && isStruck(p, given.obstacles, input.frame) ? [p.key] : []
    }),
  )
  // A value that stands off its bar's end (raised over a taller neighbour, stepped clear of another label) is tied
  // to the bar by a hairline, so it never floats: it is the bar's, and the eye reads it so.
  const leaders = placedAll.flatMap((p) => {
    const c = found[Number(p.key)] as Candidate<X>
    if (c.clamped || paintOf.get(p.key) !== CV.inkMuted) return []
    if (p.spot !== 'above' && p.spot !== 'below') return []
    const apart = c.up ? c.edge - (p.top + p.height) : p.top - c.edge
    if (apart <= GAP + LEADER_AFTER_PX) return []
    return [
      {
        side: c.side,
        box: {
          left: c.anchor.x - 0.5,
          top: c.up ? p.top + p.height + 1 : c.edge,
          width: 1,
          height: apart - 1,
        },
      },
    ]
  })
  const marks = placedAll.map((p) => {
    const c = found[Number(p.key)] as Candidate<X>
    const ink = backed.has(p.key) ? CV.inkMuted : (paintOf.get(p.key) ?? CV.inkMuted)
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
  const backings = scales.flatMap((scale) => {
    const struck = placedAll.filter(
      (p) =>
        backed.has(p.key) && input.scaleOf((found[Number(p.key)] as Candidate<X>).side) === scale,
    )
    const side =
      struck[0] === undefined ? undefined : (found[Number(struck[0].key)] as Candidate<X>).side
    return side === undefined
      ? []
      : backingMarks({
          id: `bar-values-${scale}-backing`,
          boxes: struck.map(({ left, top, width, height }) => ({ left, top, width, height })),
          frame: input.frame,
          domain: input.domainOf(side),
          scale,
        })
  })
  const ties = scales.flatMap((scale) => {
    const own = leaders.filter((l) => input.scaleOf(l.side) === scale)
    const first = own[0]
    return first === undefined
      ? []
      : backingMarks({
          id: `bar-values-${scale}-leader`,
          boxes: own.map((l) => l.box),
          frame: input.frame,
          domain: input.domainOf(first.side),
          scale,
          fill: CV.inkMuted,
        })
  })
  const written = new Set(placedAll.flatMap((p) => found[Number(p.key)]?.id ?? []))
  return {
    written,
    backed: backed.size > 0 || leaders.length > 0,
    marks: [...backings, ...ties, ...valueTextMarks(marks, 'bar-values')] as unknown as ChartMarks,
    boxes: placedAll.map(({ left, top, width, height }) => ({ left, top, width, height })),
  }
}

/** The y of a clamped bar's value written over its bar, under (or over, at the bottom) its caret. */
function overY(c: { caretSide: 'top' | 'bottom' | null }, frame: { height: number }): number {
  return c.caretSide === 'bottom' ? frame.height - 2 * CARET_SIZE : 2 * CARET_SIZE
}

/** A placed value label: its datum on the x and y scales, its text, anchor, offset in px and ink. */
type ValueMark<X extends ChartX> = {
  x: X
  y: number
  scale: 'y' | 'y2'
  text: string
  anchor: 'start' | 'middle' | 'end'
  dx: number
  dy: number
  fill: string
}

/** The placed value labels as one decorative text mark per y scale, each id `<prefix>-<scale>`. */
function valueTextMarks<X extends ChartX>(
  marks: readonly ValueMark<X>[],
  prefix: string,
): ChartMarks {
  type M = ValueMark<X>
  return [...new Set(marks.map((m) => m.scale))].map((scale) =>
    decorative(
      text(
        marks.filter((m) => m.scale === scale),
        {
          id: `${prefix}-${scale}`,
          x: (m: M) => m.x,
          y: (m: M) => m.y,
          yScale: scale,
          text: (m: M) => m.text,
          fill: (m: M) => m.fill,
          fontSize: SIZE,
          anchor: (m: M) => m.anchor,
          dx: (m: M) => m.dx,
          dy: (m: M) => m.dy,
        },
      ),
    ),
  ) as unknown as ChartMarks
}

type LabelSet = {
  marks: ChartMarks
  boxes: LabelBox[]
  written: ReadonlySet<string>
  /** A label sits on a backing: the chart's hidden `[0, 1]` x scale is then in use. */
  backed: boolean
}

/**
 * The value labels of the bar series that set `values`: the ends and the stack totals first, then the
 * segments of a stack whose series set `valuesAt: 'segment'`, clear of them.
 */
export function barValueLabels<T, X extends ChartX>(given: BarValuesInput<T, X>): LabelSet {
  const ends = endValueLabels(given)
  const segments = segmentValueLabels(given, ends.boxes)
  if (segments.boxes.length === 0) return ends
  return {
    ...ends,
    marks: [...ends.marks, ...segments.marks] as unknown as ChartMarks,
    boxes: [...ends.boxes, ...segments.boxes],
  }
}

const segmentLabelled = <T>(s: ChartSeries<T>): boolean =>
  s.values !== undefined && s.values !== false && s.valuesAt === 'segment'

/** One segment of a stack to label: its own value, inside its own body. */
type Segment<X extends ChartX> = {
  x: X
  side: Side
  text: string
  /** The value at the segment's middle, on the drawn scale: where the text mark's datum sits. */
  at: number
  /** The band's centre and the segment's middle, in plot px. */
  centre: { x: number; y: number }
  body: { width: number; height: number }
  band: number
  highlighted: boolean
  ink: string
  magnitude: number
}

/**
 * The labels of the series of a stack that set `valuesAt: 'segment'`: each writes its own value inside
 * its own segment, centred (else at the segment's top or bottom inside it, where a rule crosses the
 * middle), in the ink read against the segment's fill, clear of the rules, the captions and the labels
 * already placed (`taken`). A segment too small for its text drops its label. A clamped stack's
 * segments are labelled where they are drawn (fitted to the edge as `clampStacks` fits them), each
 * with its true value. Only a `stacked` layout has segments; elsewhere `'segment'` labels the end.
 */
function segmentValueLabels<T, X extends ChartX>(
  given: BarValuesInput<T, X>,
  taken: readonly LabelBox[],
): { marks: ChartMarks; boxes: LabelBox[] } {
  const none = { marks: [] as ChartMarks, boxes: [] as LabelBox[] }
  const { frame, barHalf } = given
  if (given.stack !== 'stacked' || frame.width <= 0 || frame.height <= 0) return none
  if (!given.series.some(segmentLabelled)) return none
  const slot = slotPx(given)
  const lh = lineHeight(SIZE)
  const found: Segment<X>[] = []
  for (const side of ['left', 'right'] as const) {
    const members = given.series.filter((s) => given.sideOf(s) === side)
    if (!members.some(segmentLabelled)) continue
    const domain = given.domainOf(side)
    const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
    const span = hi - lo || 1
    const yPx = (v: number): number => ((hi - clampToDomain(v, [lo, hi])) / span) * frame.height
    const min = (MIN_SEGMENT_PX * (hi - lo)) / frame.height
    for (const d of given.data) {
      const x = given.x(d)
      const fx = given.fraction(x)
      if (fx === null) continue
      const values = members.map((s) => {
        const v = s.getValue(d)
        return v === null || !Number.isFinite(v) ? null : v
      })
      const dimmed = given.focused !== null && given.focused !== d
      const state: BarState = dimmed ? 'dimmed' : given.focused === d ? 'focused' : 'rest'
      for (const up of [true, false]) {
        const parts = values.flatMap((v, i) => (v !== null && (up ? v > 0 : v < 0) ? [i] : []))
        const sizes = parts.map((i) => Math.abs(values[i] ?? 0))
        const cap = Math.max(0, up ? hi : -lo)
        const total = sizes.reduce((acc, v) => acc + v, 0)
        const drawn = total > cap ? fitSegments(sizes, cap, min) : sizes
        let from = 0
        for (const [k, i] of parts.entries()) {
          const to = from + (drawn[k] ?? 0)
          const [a, b] = up ? [from, to] : [-from, -to]
          from = to
          const s = members[i] as ChartSeries<T>
          const v = values[i] as number
          if (!segmentLabelled(s)) continue
          const text = textOf(s, v, d, given.formatOf(side))
          // An empty text is the page's way to leave a segment unlabelled.
          if (text === '') continue
          const [top, bottom] = [Math.min(yPx(a), yPx(b)), Math.max(yPx(a), yPx(b))]
          const lit = s.highlight?.(d) === true
          found.push({
            x,
            side,
            text,
            at: hi - ((top + bottom) / 2 / frame.height) * span,
            centre: { x: fx * frame.width, y: (top + bottom) / 2 },
            body: { width: 2 * barHalf * frame.width, height: bottom - top },
            band: fx * frame.width,
            highlighted: lit,
            ink: inkOn(
              barOnCard(lit ? CV.brand : s.color, s.fillOpacity ?? DEFAULT_BAR_OPACITY, state),
            ),
            magnitude: Math.abs(v),
          })
        }
      }
    }
  }
  // Only a segment that holds its line, the text as wide as its bar (and the overhang a bar inside its
  // slot allows), takes a label.
  const fits = found.flatMap((c, i) =>
    fitsWith(
      measure,
      c.text,
      {
        width: Math.min(slot + INSIDE_PAD, c.body.width + 2 * OVERHANG) + 2 * INSIDE_PAD,
        height: c.body.height + 2 * INSIDE_PAD,
      },
      { size: SIZE, pad: INSIDE_PAD },
    )
      ? [i]
      : [],
  )
  // Highlighted first, then the larger value, then the earlier x.
  const rank = fits.toSorted(
    (a, b) =>
      Number(found[b]?.highlighted) - Number(found[a]?.highlighted) ||
      (found[b]?.magnitude ?? 0) - (found[a]?.magnitude ?? 0) ||
      a - b,
  )
  const priority = new Map(rank.map((i, r) => [i, rank.length - r]))
  const rows = tickRows(given)
  const placed: PlacedLabel<string>[] = []
  // The middle first; where a rule or another label crosses it, the top of the segment, then its bottom.
  for (const shift of [0, -1, 1]) {
    const done = new Set(placed.map((p) => p.key))
    const pending = fits.flatMap((i): ChartLabel<string>[] => {
      const c = found[i] as Segment<X>
      if (done.has(String(i))) return []
      const reach = Math.max(0, (c.body.height - lh) / 2 - INSIDE_PAD)
      if (shift !== 0 && reach < 1) return []
      return [
        {
          key: String(i),
          text: c.text,
          x: c.centre.x,
          y: c.centre.y + shift * reach - lh / 2,
          size: SIZE,
          priority: priority.get(i) ?? 0,
          spots: ['below'],
        },
      ]
    })
    if (pending.length === 0) break
    const got = placeWith(measure, pending, frame, {
      gap: 0,
      obstacles: [...given.clear, ...rows, ...aired([...taken, ...placed])],
      air: LABEL_AIR,
      size: SIZE,
    })
    placed.push(...got.placed)
  }
  if (placed.length === 0) return none
  const marks = placed.map((p) => {
    const c = found[Number(p.key)] as Segment<X>
    return {
      x: c.x,
      // The datum sits at the segment's middle; the text's offset is from there.
      y: c.at,
      scale: given.scaleOf(c.side),
      text: p.text,
      anchor: p.textAnchor,
      dx: p.textX - c.band,
      dy: p.dy + (p.y - c.centre.y),
      fill: c.ink,
    }
  })
  return {
    marks: valueTextMarks(marks, 'bar-segment-values'),
    boxes: placed.map(({ left, top, width, height }) => ({ left, top, width, height })),
  }
}
