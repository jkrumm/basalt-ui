/**
 * `Lines`' end labels: which series carry one, and on which side of its last point it sits. Pure,
 * so the rules are tested without an engine; `endLabelMarks` is the only part that draws.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { BASALT } from '../tokens'
import { warpFor } from './core/scales'
import { CV } from './core/theme'
import { lineHeight } from './label-place'
import { measure } from './label-widths'
import { yRangeWithin } from './ref-label'
import type { LabelBox, RefLabelPoint } from './ref-label'
import { rowX } from './types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from './types'
import type { ContainerClass } from '../tokens/size-classes'

const MAX_END_LABELS = 3

/** The narrowest plot of the narrow class, px: the room check of {@link phoneNamesFit} is made against it. */
const NARROW_PLOT_FLOOR = 240
/** The plot height the narrow class is checked against, px: the least a card's box leaves under its axis. */
const NARROW_PLOT_HEIGHT = 150

/**
 * Whether `auto` draws end labels in this class: from the wide class, and on the narrow one (a phone) only where
 * {@link phoneNamesFit} held, which the chart decides from its data so the legend gives way in the server HTML.
 */
export const autoNames = (cls: ContainerClass, phoneNames: boolean | undefined): boolean =>
  cls === 'wide' || (cls === 'narrow' && phoneNames === true)

/**
 * Whether a phone's lines can be named at their ends without a collision: at most {@link MAX_END_LABELS} lines, the
 * widest label's gutter within the share of the narrowest narrow plot, and the last values of the lines each a
 * label line apart on a plot of the least height. A chart that fails it keeps the legend. `last` is each line's
 * label and last value, `extent` the lowest and highest value the chart's lines reach.
 */
export function phoneNamesFit(opts: {
  last: readonly { label: string; value: number }[]
  extent: readonly [number, number]
}): boolean {
  const { last, extent } = opts
  if (last.length === 0 || last.length > MAX_END_LABELS) return false
  const widest = Math.max(
    ...last.map((l) => END_LABEL_DX + measure(l.label, BASALT.text.micro, 400) + GUTTER_AIR),
  )
  if (widest > NARROW_PLOT_FLOOR * MAX_GUTTER_SHARE) return false
  const span = (extent[1] - extent[0]) * 1.2
  if (!(span > 0)) return last.length === 1
  const ys = last.map((l) => l.value).toSorted((a, b) => a - b)
  return ys.every(
    (y, i) =>
      i === 0 || ((y - (ys[i - 1] as number)) / span) * NARROW_PLOT_HEIGHT >= END_LABEL_MIN_GAP,
  )
}
/** Two end labels closer than this (px, vertically) are pushed apart to it: one label line (11px at 1.35) plus two pixels of air. */
const END_LABEL_MIN_GAP = 17
const END_LABEL_DX = 6
/**
 * A glyph's advance as a share of the font size, for the room check. 0.85 covers proportional
 * Latin text, capitals included, in the shipped faces; a run of the widest capitals (`W`, `M` are
 * ~1 em) or a much wider face can still exceed it, so the estimate errs towards flipping: a label
 * that did not need to flip sits above its point, one that needed to and did not is cut.
 */
const END_LABEL_GLYPH_EM = 0.85
/** A label flipped inside the plot sits this far above (or, below its point, `BELOW`) its point. */
const END_LABEL_FLIP_DY = -9
const END_LABEL_FLIP_DY_BELOW = 13
/** The room a label's centre keeps from the plot's top and bottom edge, px: half its line. */
const END_LABEL_EDGE = 7
/** A glyph's advance as a share of the font size, for a label's drawn box (the room check's {@link END_LABEL_GLYPH_EM} errs wide). */
const BOX_GLYPH_EM = 0.68
/** A glyph's advance as a share of the font size when a flipped label asks again for the right of its end: the shipped face measures about 0.5 on mixed text. */
const RETRY_GLYPH_EM = 0.58
/** A label's ink is this share of its font size tall, centred on its text's y. */
const BOX_INK = 0.75
/** Air a label keeps from any line, px, and the margin a claimed box carries for a caption. */
const LINE_AIR = 4.5
/** What a label across a reference rule from its own line costs in {@link place}'s air score, px. */
const CROSSED_PENALTY = 100
/** The least air a label keeps from a line once it has to move off one, px: a touch is a collision. */
const MIN_AIR = 1
/** The most flipped labels whose two sides are all tried (2 ** n assignments). */
const MAX_SIDE_SEARCH = 5
/** How far a dot mark reaches from its centre, px: its radius and ring. */
const DOT_REACH = BASALT.dotR + 1
/** A label this far off its natural spot, px, is joined to its line's end by a leader: nearer, it reads as the line's own. */
const LEADER_AFTER_PX = lineHeight(BASALT.text.micro)

/** Air kept between a gutter's widest label and the plot's right edge, px: the table measures the shipped face, a fallback face draws wider. */
const GUTTER_AIR = 8
/** The widest share of the plot a gutter may take: past it the labels flip into the plot as before. */
const MAX_GUTTER_SHARE = 0.45

/**
 * The room (px) the x scale keeps right of the last point so every end label sits beside its line's end,
 * where no line runs through it; 0 when the labels already fit there or the gutter would take more than
 * {@link MAX_GUTTER_SHARE} of the plot. `labels` are the lines that carry one, each with its last point's
 * x as a share of the plot; the gutter holds the widest label as the face draws it. Same naming rules as
 * {@link endLabelPlan}: `legend` has none, `auto` only on the wide class and with ≤ {@link MAX_END_LABELS} lines.
 */
export function endLabelGutter(opts: {
  naming: LinesNaming
  containerClass: ContainerClass
  plotWidth: number
  labels: readonly { label: string; fraction: number }[]
  /** `auto` names the lines on the narrow class too: {@link phoneNamesFit} held for them. */
  phoneNames?: boolean | undefined
}): number {
  const { naming, containerClass, plotWidth, labels, phoneNames } = opts
  if (naming === 'legend' || labels.length === 0 || plotWidth <= 0) return 0
  if (
    naming === 'auto' &&
    (!autoNames(containerClass, phoneNames) || labels.length > MAX_END_LABELS)
  )
    return 0
  const boxes = labels.map(
    (l) => END_LABEL_DX + measure(l.label, BASALT.text.micro, 400) + GUTTER_AIR,
  )
  if (!labels.some((l, i) => (1 - l.fraction) * plotWidth < (boxes[i] as number))) return 0
  const gutter = Math.ceil(Math.max(...boxes))
  return gutter <= plotWidth * MAX_GUTTER_SHARE ? gutter : 0
}

export type EndLabelAnchor = 'start' | 'end'
/** Which side of its line a flipped label sits: away from the line's last segment. */
export type EndLabelSide = 'above' | 'below'

/**
 * The side of its point an end label takes: `start` (right of the point) unless the point leaves
 * less room than the label needs. `fraction` is the point's x as a share of the plot width,
 * `plotWidth` the plot in px. Before the engine has measured the plot, `plotWidth` is the frame's,
 * which is wider than the plot by the axis gutters: the first frame can keep `start` for a label
 * the measured frame then flips.
 */
export function endLabelAnchor(opts: {
  fraction: number
  plotWidth: number
  label: string
  fontSize: number
}): EndLabelAnchor {
  const { fraction, plotWidth, label, fontSize } = opts
  const room = (1 - fraction) * plotWidth
  return room >= label.length * fontSize * END_LABEL_GLYPH_EM + END_LABEL_DX ? 'start' : 'end'
}

/** `Lines`' one naming switch: who names the series. */
export type LinesNaming = 'auto' | 'legend' | 'endLabels'

/**
 * A hairline from a line's end to its label, drawn when the label was moved off its natural spot: a
 * stalk up (or down) from the end to the label's height. `from` and `to` are values on the left axis;
 * `thinX` and `thinY` are a hairline's width in fractions of the plot and in values.
 */
export type EndLabelLeader = {
  fraction: number
  from: number
  to: number
  dx: number
  thinX: number
  thinY: number
}

export type EndLabel<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  anchor: EndLabelAnchor
  /** Only a flipped label (left of its point) can meet its own line; it takes the clear side. */
  side: EndLabelSide
  /** A vertical shift in px (negative is up) that keeps this label clear of its neighbours and the lines. */
  nudge: number
  /** The room the drawn label takes, for a reference caption to keep clear of. */
  box: LabelBox
  /** Present when the label sits too far from its line's end to read as its own. */
  leader?: EndLabelLeader
  /** Present when another series' line runs through the label's glyphs where no height clears: the label is drawn on a surface backing, in plot fractions and values. */
  backing?: LabelBox
}

const claimedBoxes = new WeakMap<object, readonly LabelBox[]>()
/** Records the boxes the end labels of `plot` take (once per plot, by `Lines`). */
export function claimLabelBoxes(plot: object, boxes: readonly LabelBox[]): void {
  claimedBoxes.set(plot, boxes)
}
/** The boxes {@link claimLabelBoxes} recorded for `plot`: what a reference caption avoids. */
export function claimedLabelBoxes(plot: object): readonly LabelBox[] {
  return claimedBoxes.get(plot) ?? []
}

type LastPoint<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  y: number
  fraction: number
  /** The value one finite point earlier: where the line's last segment comes from. */
  prev: number | null
}

/**
 * Pushes labels apart: `ys` are the labels' heights in px from the plot's bottom, returned as the
 * shift each needs (positive is up) so no two sit closer than {@link END_LABEL_MIN_GAP} and the
 * lowest and the topmost stay {@link END_LABEL_EDGE} inside the plot; a stack too tall for the plot
 * shrinks its gap to fit. Order is kept.
 */
export function spreadLabels(ys: readonly number[], plotHeight: number): number[] {
  const order = ys.map((y, i) => i).toSorted((a, b) => (ys[a] as number) - (ys[b] as number))
  const placed = new Map<number, number>()
  // A stack taller than the plot closes its gaps evenly rather than leave the plot.
  const room = Math.max(plotHeight - 2 * END_LABEL_EDGE, 0)
  const gap =
    ys.length > 1 ? Math.min(END_LABEL_MIN_GAP, room / (ys.length - 1)) : END_LABEL_MIN_GAP
  let floor = END_LABEL_EDGE
  for (const i of order) {
    const at = Math.max(ys[i] as number, floor)
    placed.set(i, at)
    floor = at + gap
  }
  // Pushed past the top: slide the whole stack back down, then re-sweep from the top.
  const top = plotHeight - END_LABEL_EDGE
  let ceiling = Infinity
  for (const i of order.toReversed()) {
    const at = Math.min(placed.get(i) as number, ceiling, top)
    placed.set(i, at)
    ceiling = at - gap
  }
  return ys.map((y, i) => (placed.get(i) as number) - y)
}

/**
 * The end labels to draw. `auto`: on the wide class only, with ≤ {@link MAX_END_LABELS} lines and
 * no right axis; `endLabels`: at every width and any line count (still no right axis, whose
 * series read another scale); `legend`: none. Labels that would collide are spread apart, never
 * dropped: a label no height clears of the other series' lines stays where the spread left it, because
 * the legend may be hidden (`endLabels` draws none) and the label is then the only name. The text mark has no
 * stroke, so a label another line runs through gets a card-colored `backing` box under its glyphs. A label the
 * spread moves off its line's end gets a `leader` back to it. A series whose last point the plot's own x scale cannot place, or places outside the plot
 * (`plot.xFraction` outside [0, 1]: clipped by a narrower `xDomain`), has no label.
 */
export function endLabelPlan<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  naming: LinesNaming = 'auto',
  /** The values of the reference lines on the left axis: rules a label must not sit on. */
  rules: readonly number[] = [],
): EndLabel<T, X>[] {
  return plot.yLog === true
    ? endLabelPlanLog(plot, lines, naming, rules)
    : endLabelPlanIn(plot, lines, naming, rules)
}

/**
 * A log y: the plan is made in decades (a pixel is a fixed step there, so the spread and the air
 * from the lines are exact), then each value the marks draw at is carried back. The claimed `box`
 * stays in decades, the space every caption on this axis is placed in.
 */
function endLabelPlanLog<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  naming: LinesNaming,
  rules: readonly number[],
): EndLabel<T, X>[] {
  const warp = warpFor(true)
  const original = new Map<PlotRow<T, X>, PlotRow<T, X>>()
  const rows = new Map<string, PlotRow<T, X>[]>()
  const warpedRows = (key: string): PlotRow<T, X>[] => {
    const found = rows.get(key)
    if (found !== undefined) return found
    const made = plot.rows(key).map((r) => {
      const w = { ...r, y: r.y === null ? null : warp.to(r.y) }
      original.set(w, r)
      return w
    })
    rows.set(key, made)
    return made
  }
  const warped: PlotContext<T, X> = {
    ...plot,
    plotWidth: plot.plotWidth,
    plotHeight: plot.plotHeight,
    focused: plot.focused,
    rows: warpedRows,
    yDomain: warp.domain(plot.yDomain),
  }
  return endLabelPlanIn(warped, lines, naming, rules.map(warp.to)).map((l) => ({
    ...l,
    row: original.get(l.row) ?? l.row,
    ...(l.leader !== undefined && {
      leader: { ...l.leader, from: warp.from(l.leader.from), to: warp.from(l.leader.to) },
    }),
    ...(l.backing !== undefined && {
      backing: { ...l.backing, y0: warp.from(l.backing.y0), y1: warp.from(l.backing.y1) },
    }),
  }))
}

function endLabelPlanIn<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  naming: LinesNaming,
  rules: readonly number[],
): EndLabel<T, X>[] {
  const plan = planEndLabels(plot, lines, naming, rules, new Set())
  // The room check errs wide, so a label can flip over its own line for room it has, and the lines
  // it then has to clear carry it far off its end. Such a label tries the right of its end, by the
  // drawn box's width, and keeps that side when the labels end up nearer their lines.
  const plotW = Math.max(plot.plotWidth, 1)
  const beside = plan.flatMap((l) => {
    const fraction = plot.xFraction(l.row.x)
    const room = END_LABEL_DX + l.series.label.length * BASALT.text.micro * RETRY_GLYPH_EM
    return l.anchor === 'end' &&
      l.leader !== undefined &&
      fraction !== null &&
      (1 - fraction) * plotW >= room
      ? [l.series.key]
      : []
  })
  if (beside.length === 0) return plan
  const again = planEndLabels(plot, lines, naming, rules, new Set(beside))
  const drift = (p: readonly EndLabel<T, X>[]): number =>
    p.reduce((sum, l) => sum + Math.abs(l.nudge), 0)
  return drift(again) < drift(plan) ? again : plan
}

function planEndLabels<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  naming: LinesNaming,
  rules: readonly number[],
  /** Series whose label goes right of its end whatever the room estimate says. */
  startAt: ReadonlySet<string>,
): EndLabel<T, X>[] {
  if (naming === 'legend' || plot.y2 !== undefined || lines.length === 0) return []
  if (
    naming === 'auto' &&
    (!autoNames(plot.containerClass, plot.phoneNames) || lines.length > MAX_END_LABELS)
  )
    return []
  const last = lines.flatMap((series): LastPoint<T, X>[] => {
    const finite = plot.rows(series.key).filter((r) => r.y !== null)
    const row = finite.at(-1)
    if (row === undefined || row.y === null) return []
    const fraction = plot.xFraction(row.x)
    if (fraction === null || fraction < 0 || fraction > 1) return []
    return [{ series, row, y: row.y, fraction, prev: finite.at(-2)?.y ?? null }]
  })
  // No `y2` here (returned above), so every label reads the left domain.
  const [lo, hi] = plot.yDomain
  const anchors = last.map(({ series, fraction }): EndLabelAnchor =>
    startAt.has(series.key) || plot.endRoom === true
      ? 'start'
      : endLabelAnchor({
          fraction,
          plotWidth: plot.plotWidth,
          label: series.label,
          fontSize: BASALT.text.micro,
        }),
  )
  // Flipped labels (left of their point) sit over their own line. A line falling into its end
  // comes from above, so its label drops below; a rising line's rises above. Several flipped lines
  // that move the same way would all take the same side and stack in the gap between them, so they
  // wrap the lines instead: falling, the lowest below and the rest above; rising, the mirror.
  const falls = last.map(({ y, prev }) => prev !== null && prev > y)
  const flipped = last.flatMap((_, i) => (anchors[i] === 'end' ? [i] : []))
  const lineY = (i: number): number => (last[i] as (typeof last)[number]).y
  const sameWay =
    flipped.length > 1 && flipped.every((i) => falls[i] === falls[flipped[0] as number])
  const wrapped = sameWay ? flipped.toSorted((a, b) => lineY(a) - lineY(b)) : []
  // The one that keeps the far side: the lowest when falling, the highest when rising.
  const outlier = falls[flipped[0] as number] ? wrapped[0] : wrapped.at(-1)
  const preferred = last.map((_, i): EndLabelSide => {
    const fall = falls[i] as boolean
    return sameWay && anchors[i] === 'end'
      ? (i === outlier) === fall
        ? 'below'
        : 'above'
      : fall
        ? 'below'
        : 'above'
  })
  const toPx = (y: number): number => ((y - lo) / (hi - lo || 1)) * plot.plotHeight
  const nominal = (i: number, side: EndLabelSide): number =>
    toPx(lineY(i)) - endLabelOffset(anchors[i] as EndLabelAnchor, side).dy
  const half = (BASALT.text.micro * BOX_INK) / 2
  const plotW = Math.max(plot.plotWidth, 1)
  const spans = last.map(({ series, fraction }, i) => {
    const room = (END_LABEL_DX + series.label.length * BASALT.text.micro * BOX_GLYPH_EM) / plotW
    const edge = END_LABEL_DX / plotW
    return anchors[i] === 'end'
      ? ([fraction - room, fraction - edge] as const)
      : ([fraction + edge, fraction + room] as const)
  })
  // Every line a label could sit on, as polylines in px from the plot's bottom: each visible
  // series and each reference rule. Only the stretch under the labels matters.
  const from = Math.min(...spans.map(([x0]) => x0))
  const obstacles: RefLabelPoint[][] = [
    ...plot.visible.map((s) => {
      const pts: RefLabelPoint[] = []
      let before: RefLabelPoint | undefined
      for (const r of plot.rows(s.key)) {
        const fx = r.y === null ? null : plot.xFraction(r.x)
        if (fx === null || r.y === null) continue
        const pt = { fx, y: toPx(r.y) }
        if (fx < from) before = pt
        else {
          if (before !== undefined) pts.push(before)
          before = undefined
          // A dot fills its radius above and below its centre: a label keeps off the whole mark.
          if (s.mark === 'dot')
            pts.push({ fx, y: pt.y - DOT_REACH }, pt, { fx, y: pt.y + DOT_REACH })
          else pts.push(pt)
        }
      }
      if (before !== undefined) pts.push(before)
      return pts
    }),
    ...rules.map((v) => [
      { fx: 0, y: toPx(v) },
      { fx: 1, y: toPx(v) },
    ]),
  ]
  /** Per label, the line ranges (px) its x-window runs into: fixed, so computed once. */
  const windowRanges = spans.map(([x0, x1]) =>
    obstacles.flatMap((pts) => {
      const range = yRangeWithin(pts, x0, x1)
      return range === null ? [] : [range]
    }),
  )
  const ranges = (i: number): readonly [number, number][] => windowRanges[i] as [number, number][]
  /** Per label, the ranges of every line but its own (the other series and the reference rules) under the glyphs alone: its own line never strikes it. */
  const inkSpans = last.map(({ series, fraction }, i): readonly [number, number] => {
    const reach = (END_LABEL_DX + series.label.length * BASALT.text.micro * RETRY_GLYPH_EM) / plotW
    const edge = END_LABEL_DX / plotW
    return anchors[i] === 'end'
      ? [fraction - reach, fraction - edge]
      : [fraction + edge, fraction + reach]
  })
  const rivalRanges = last.map(({ series }, i) =>
    obstacles.flatMap((_, k) => {
      if (plot.visible[k]?.key === series.key) return []
      const range = yRangeWithin(
        obstacles[k] as RefLabelPoint[],
        ...(inkSpans[i] as readonly [number, number]),
      )
      return range === null ? [] : [range]
    }),
  )
  /** Where the centre goes to clear the lines on `side` of `start`, stepping past each one it meets. */
  const cleared = (i: number, side: EndLabelSide, start: number): number => {
    const blockers = ranges(i)
    let c = start
    for (let n = 0; n <= blockers.length; n++) {
      const hit = blockers.find(([a, b]) => b + LINE_AIR > c - half && a - LINE_AIR < c + half)
      if (hit === undefined) break
      c = side === 'above' ? hit[1] + LINE_AIR + half : hit[0] - LINE_AIR - half
    }
    return c
  }
  const airOf = (i: number, c: number): number =>
    Math.min(
      Number.POSITIVE_INFINITY,
      ...ranges(i).map(([a, b]) => Math.max(a - (c + half), c - half - b)),
    )
  const stackRoom = Math.max(plot.plotHeight - 2 * END_LABEL_EDGE, 0)
  const gap =
    last.length > 1 ? Math.min(END_LABEL_MIN_GAP, stackRoom / (last.length - 1)) : END_LABEL_MIN_GAP
  const shareX = (i: number, j: number): boolean => {
    const [a0, a1] = spans[i] as readonly [number, number]
    const [b0, b1] = spans[j] as readonly [number, number]
    return a0 < b1 && b0 < a1
  }
  /**
   * A label the spread left on a line (it pushed it there, or the line sits at the plot's edge)
   * moves to the nearest height clear of every line that keeps its gap from the labels already
   * fixed: the clear ones keep theirs, the rest take the nearest of what is free. One that finds
   * none stays where the spread left it.
   */
  const unstruck = (centres: readonly number[]): number[] => {
    const out = [...centres]
    const struck = (i: number): boolean => airOf(i, out[i] as number) < MIN_AIR
    const fixed = out.flatMap((_, i) => (struck(i) ? [] : [i]))
    const highest = plot.plotHeight - END_LABEL_EDGE
    for (const i of out.flatMap((_, k) => (struck(k) ? [k] : []))) {
      const free = (c: number, air: number): boolean =>
        airOf(i, c) >= air &&
        fixed.every((j) => !shareX(i, j) || Math.abs(c - (out[j] as number)) >= gap)
      const from = out[i] as number
      let found: number | undefined
      for (const air of [LINE_AIR, MIN_AIR]) {
        let nearest = Number.POSITIVE_INFINITY
        for (let c = END_LABEL_EDGE; c <= highest; c++) {
          if (Math.abs(c - from) < nearest && free(c, air)) {
            nearest = Math.abs(c - from)
            found = c
          }
        }
        if (found !== undefined) break
      }
      if (found !== undefined) {
        out[i] = found
        fixed.push(i)
      }
    }
    return out
  }
  const place = (sides: readonly EndLabelSide[]) => {
    const start = last.map((_, i) =>
      cleared(i, sides[i] as EndLabelSide, nominal(i, sides[i] as EndLabelSide)),
    )
    const shifts = spreadLabels(start, plot.plotHeight)
    const centres = unstruck(start.map((c, i) => c + (shifts[i] as number)))
    // A label across a reference rule from its own line's end reads as the rule's label: worse
    // than any amount of lost air.
    const crossed = centres.filter((c, i) => {
      const end = toPx(lineY(i))
      return rules.some(
        (v) => (toPx(v) - c) * (toPx(v) - end) < 0 && (c - end) * (toPx(v) - end) > 0,
      )
    }).length
    const score =
      centres.reduce((sum, c, i) => sum + Math.min(airOf(i, c), LINE_AIR), 0) -
      CROSSED_PENALTY * crossed
    return { sides, centres, score }
  }
  // Each flipped label may take either side: the assignment that keeps most air from the lines
  // wins, the preferred one on a tie. Level labels (right of
  // their point) keep theirs.
  const options = flipped.length <= MAX_SIDE_SEARCH ? flipped.length : 0
  let best = place(preferred)
  for (let mask = 1; mask < 1 << options; mask++) {
    const sides = preferred.map((side, i): EndLabelSide => {
      const at = flipped.indexOf(i)
      return at >= 0 && (mask >> at) & 1 ? (side === 'above' ? 'below' : 'above') : side
    })
    const trial = place(sides)
    if (trial.score > best.score + 0.01) best = trial
  }
  return last.map(({ series, row }, i) => {
    const side = best.sides[i] as EndLabelSide
    const centre = best.centres[i] as number
    const [x0, x1] = spans[i] as readonly [number, number]
    const perPx = (hi - lo) / (plot.plotHeight || 1)
    // Two pixels of margin each way: the caption keeps its own gap from the claimed box.
    const fraction = last[i]?.fraction ?? 0
    const struck = (rivalRanges[i] as [number, number][]).some(
      ([a, b]) => b > centre - half && a < centre + half,
    )
    const leader =
      Math.abs(nominal(i, side) - centre) > LEADER_AFTER_PX
        ? {
            fraction,
            from: lineY(i),
            to: lo + (centre * (hi - lo)) / (plot.plotHeight || 1),
            dx: endLabelOffset(anchors[i] as EndLabelAnchor, side).dx,
            thinX: 1 / plotW,
            thinY: (hi - lo) / (plot.plotHeight || 1),
          }
        : undefined
    return {
      series,
      row,
      anchor: anchors[i] as EndLabelAnchor,
      side,
      nudge: nominal(i, side) - centre,
      ...(leader !== undefined && { leader }),
      ...(struck && {
        backing: {
          fx0: (inkSpans[i] as readonly [number, number])[0],
          fx1: (inkSpans[i] as readonly [number, number])[1],
          y0: lo + (centre - half) * perPx,
          y1: lo + (centre + half) * perPx,
        },
      }),
      box: {
        fx0: x0 - 2 / plotW,
        fx1: x1 + 2 / plotW,
        y0: lo + (centre - half - 2) * perPx,
        y1: lo + (centre + half + 2) * perPx,
      },
    }
  })
}

/** The offset of a label from its point: right of it, level; or left of it, above or below. */
export function endLabelOffset(
  anchor: EndLabelAnchor,
  side: EndLabelSide = 'above',
): { dx: number; dy: number } {
  if (anchor === 'start') return { dx: END_LABEL_DX, dy: 0 }
  return { dx: -END_LABEL_DX, dy: side === 'above' ? END_LABEL_FLIP_DY : END_LABEL_FLIP_DY_BELOW }
}

/** `paint` is the label's fill for a series color: its line's own paint, so a label dims with its line. */
export function endLabelMarks<T, X extends ChartX>(
  plan: readonly EndLabel<T, X>[],
  paint: (color: string) => string = (color) => color,
): ChartMarks {
  return plan.flatMap(({ series, row, anchor, side, nudge, leader, backing }) => [
    ...(leader === undefined ? [] : leaderMarks(series.key, leader, paint(series.color))),
    ...(backing === undefined ? [] : backingMarks(series.key, backing)),
    decorative(
      text([row], {
        id: `${series.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => series.label,
        fill: paint(series.color),
        fontSize: BASALT.text.micro,
        anchor,
        dx: endLabelOffset(anchor, side).dx,
        dy: endLabelOffset(anchor, side).dy + nudge,
      }),
    ),
  ])
}

/** The surface a struck label is drawn on: the text mark has no stroke, so a line through it is covered by a card-colored box instead of a halo. */
function backingMarks(key: string, box: LabelBox): ChartMarks {
  return [
    decorative(
      rect([box], {
        x1: 'fx0',
        x2: 'fx1',
        y1: 'y0',
        y2: 'y1',
        xScale: 'zx',
        yScale: 'y',
        fill: CV.surface,
        inset: 0,
        id: `${key}-end-backing`,
      }),
    ),
  ]
}

/**
 * The hairline of a displaced end label as a box: its two plot fractions and its two values. A line that
 * ends on the plot's right edge has its stalk just inside it: past the edge the plot clips it away.
 */
export function leaderStalk(leader: EndLabelLeader): {
  f0: number
  f1: number
  y0: number
  y1: number
} {
  const { fraction, from, to, thinX } = leader
  const f0 = Math.min(fraction, 1 - thinX)
  return { f0, f1: f0 + thinX, y0: Math.min(from, to), y1: Math.max(from, to) }
}

/** The leader of a displaced end label: a hairline stalk from its line's end up (or down) to the label's height. */
function leaderMarks(key: string, leader: EndLabelLeader, fill: string): ChartMarks {
  const stalk = leaderStalk(leader)
  const channels = {
    x1: 'f0',
    x2: 'f1',
    y1: 'y0',
    y2: 'y1',
    xScale: 'zx',
    yScale: 'y',
    fill,
    inset: 0,
  } as const
  // A stalk alone: a stub reaching the label's edge would sit against its last glyph and read as a dash after the name.
  return [decorative(rect([stalk], { ...channels, id: `${key}-end-leader` }))]
}
