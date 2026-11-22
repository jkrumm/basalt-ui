/**
 * What a host chart lays under the marks a page draws through `CartesianChart.custom`, as boxes in
 * the plot's own px (from its top left, the space `ChartPlot.x` and `ChartPlot.y` answer in): the
 * end labels, the line paths, the rules and the bodies of the bars; the zone and rule captions are
 * placed after the page's labels and give way to them. While the
 * host builds the custom marks it publishes them here, and `chartLabels.place` adds them to the
 * obstacles a page passes, so a placed label clears what the page cannot see. Outside a host (a
 * hand-built SVG) nothing is published and `place` is as it was.
 *
 * A module-level scope rather than a `ChartPlot` field: the contract stays as it is, and a builder
 * changes nothing. The scope is synchronous (`build` runs inside it, and an async read sees none).
 */
import type { LabelBox } from './chart-labels'
import type { LabelBox as ValueBox } from './ref-label'

/** A plot's width and height in px. */
export type PlotPx = { width: number; height: number }

/** Air a line path keeps round its stroke, px: half the stroke is already in the box. */
const LINE_AIR = 1.5
/** The longest stretch of a path one box covers, px: a long diagonal is many small boxes, not one tall one. */
const PIECE_PX = 6

/** Half the height of a rule's box, px: its half stroke and the air a label keeps. */
const RULE_REACH = 2

/** A hairline from a label's anchor to its box, in the plot's px. */
export type LabelLeader = { from: { x: number; y: number }; to: { x: number; y: number } }

/** What a page's label pass asks the host to draw under its text: hairlines to labels set farther off, and surface plates under labels that had to lie over dots. */
export type LabelTies = { leaders: LabelLeader[]; plates: LabelBox[] }

let current: (() => readonly LabelBox[]) | undefined
let sink: LabelBox[] | undefined
let ties: LabelTies | undefined

/**
 * Runs `run` with `boxes` as the host's obstacles; read lazily, once, on the first `place`. The
 * labels a page's own `chartLabels.place` lands while it runs are pushed to `placed`, so the host
 * can have its captions give way to them. Its ties (`takeLabelTies`) are the host's to draw.
 */
export function withHostObstacles<T>(
  boxes: () => readonly LabelBox[],
  run: () => T,
  placed?: LabelBox[],
): T {
  const before = current
  const beforeSink = sink
  const beforeTies = ties
  let memo: readonly LabelBox[] | undefined
  current = () => (memo ??= boxes())
  sink = placed
  ties = { leaders: [], plates: [] }
  try {
    return run()
  } finally {
    current = before
    sink = beforeSink
    ties = beforeTies
  }
}

/** Tells the host which boxes a page's own label pass landed; nothing outside a host. */
export function recordPlacedLabels(boxes: readonly LabelBox[]): void {
  sink?.push(...boxes)
}

/** Tells the host which hairlines and plates a page's own label pass needs; nothing outside a host. */
export function recordLabelTies(found: LabelTies): void {
  ties?.leaders.push(...found.leaders)
  ties?.plates.push(...found.plates)
}

/** The ties recorded since the last call, cleared; empty outside a host. */
export function takeLabelTies(): LabelTies {
  const taken = { leaders: [...(ties?.leaders ?? [])], plates: [...(ties?.plates ?? [])] }
  if (ties !== undefined) ties = { leaders: [], plates: [] }
  return taken
}

/** The boxes the host published for the marks being built; none outside a host. */
export const hostObstacles = (): readonly LabelBox[] => current?.() ?? []

const dotBoxes = new WeakSet<LabelBox>()

/** Marks a published box as one dot: a crowded cloud of them leaves a label the spot that meets the fewest. */
export function markDot(box: LabelBox): LabelBox {
  dotBoxes.add(box)
  return box
}

/** Whether the host published `box` as a dot. */
export const isDotBox = (box: LabelBox): boolean => dotBoxes.has(box)

/** A box in a share of the plot width and a span of values on an axis with `domain`, as plot px. */
export function pxBox(box: ValueBox, domain: readonly [number, number], plot: PlotPx): LabelBox {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const span = hi - lo || 1
  const yPx = (v: number): number => ((hi - v) / span) * plot.height
  const top = yPx(Math.max(box.y0, box.y1))
  const bottom = yPx(Math.min(box.y0, box.y1))
  return {
    left: box.fx0 * plot.width,
    top,
    width: (box.fx1 - box.fx0) * plot.width,
    height: bottom - top,
  }
}

/** A px box as a share of the plot width and a span of values on an axis with `domain`: `pxBox` read back. */
export function valueBox(box: LabelBox, domain: readonly [number, number], plot: PlotPx): ValueBox {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const perPx = plot.height > 0 ? (hi - lo) / plot.height : 0
  return {
    fx0: plot.width > 0 ? box.left / plot.width : 0,
    fx1: plot.width > 0 ? (box.left + box.width) / plot.width : 0,
    y0: hi - (box.top + box.height) * perPx,
    y1: hi - box.top * perPx,
  }
}

/** A caption box a share of the plot width wide, `top` to `bottom` px below the plot's top. */
export const captionPx = (
  box: { fx0: number; fx1: number; top: number; bottom: number },
  plot: PlotPx,
): LabelBox => ({
  left: box.fx0 * plot.width,
  top: box.top,
  width: (box.fx1 - box.fx0) * plot.width,
  height: box.bottom - box.top,
})

/**
 * Reference lines as boxes: each rule spans the plot's width at its value's y, a hairline and its
 * air tall, so a label never runs along or through a drawn rule. `domain` is the rule's own axis.
 */
export function ruleBoxes(
  rules: readonly { value: number; domain: readonly [number, number] }[],
  plot: PlotPx,
): LabelBox[] {
  return rules.flatMap(({ value, domain }) => {
    const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
    if (!Number.isFinite(value) || value < lo || value > hi) return []
    const y = ((hi - value) / (hi - lo || 1)) * plot.height
    return [{ left: 0, top: y - RULE_REACH, width: plot.width, height: 2 * RULE_REACH }]
  })
}

/**
 * Vertical reference rules as boxes: each spans the plot's height at its share of the width, a
 * hairline and its air wide. `fractions` are the rules' plot fractions (a rule off the plot has none).
 */
export const xRuleBoxes = (fractions: readonly number[], plot: PlotPx): LabelBox[] =>
  fractions
    .filter((f) => f >= 0 && f <= 1)
    .map((f) => ({
      left: f * plot.width - RULE_REACH,
      top: 0,
      width: 2 * RULE_REACH,
      height: plot.height,
    }))

/**
 * A line path as boxes: each stretch of at most {@link PIECE_PX} gets the box of its two ends, so a
 * diagonal costs the label only the room under it. A run of one point is a small box. `runs` are
 * polylines in plot px, broken where the line has a gap.
 */
export function pathBoxes(
  runs: readonly (readonly { x: number; y: number }[])[],
  strokePx: number,
): LabelBox[] {
  const reach = strokePx / 2 + LINE_AIR
  const out: LabelBox[] = []
  const add = (x0: number, y0: number, x1: number, y1: number): void => {
    out.push({
      left: Math.min(x0, x1) - reach,
      top: Math.min(y0, y1) - reach,
      width: Math.abs(x1 - x0) + 2 * reach,
      height: Math.abs(y1 - y0) + 2 * reach,
    })
  }
  for (const run of runs) {
    const first = run[0]
    if (first === undefined) continue
    if (run.length === 1) add(first.x, first.y, first.x, first.y)
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1] as { x: number; y: number }
      const b = run[i] as { x: number; y: number }
      const pieces = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / PIECE_PX),
      )
      for (let p = 0; p < pieces; p++) {
        const t0 = p / pieces
        const t1 = (p + 1) / pieces
        add(
          a.x + (b.x - a.x) * t0,
          a.y + (b.y - a.y) * t0,
          a.x + (b.x - a.x) * t1,
          a.y + (b.y - a.y) * t1,
        )
      }
    }
  }
  return out
}
