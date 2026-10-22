/**
 * `Lines`' end labels: which series carry one, and on which side of its last point it sits. Pure,
 * so the rules are tested without an engine; `endLabelMarks` is the only part that draws.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { VX } from '../tokens'
import { yRangeWithin } from './ref-label'
import type { LabelBox, RefLabelPoint } from './ref-label'
import { rowX } from './types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from './types'

const MAX_END_LABELS = 3
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
/** A label's ink is this share of its font size tall, centred on its text's y. */
const BOX_INK = 0.75
/** Air a label keeps from any line, px, and the margin a claimed box carries for a caption. */
const LINE_AIR = 4.5
/** What a label across a reference rule from its own line costs in {@link place}'s air score, px. */
const CROSSED_PENALTY = 100
/** The most flipped labels whose two sides are all tried (2 ** n assignments). */
const MAX_SIDE_SEARCH = 5

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
 * dropped. A series whose last point the plot's own x scale cannot place, or places outside the plot
 * (`plot.xFraction` outside [0, 1]: clipped by a narrower `xDomain`), has no label.
 */
export function endLabelPlan<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  naming: LinesNaming = 'auto',
  /** The values of the reference lines on the left axis: rules a label must not sit on. */
  rules: readonly number[] = [],
): EndLabel<T, X>[] {
  if (naming === 'legend' || plot.y2 !== undefined || lines.length === 0) return []
  if (naming === 'auto' && (plot.containerClass !== 'wide' || lines.length > MAX_END_LABELS))
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
  const anchors = last.map(({ series, fraction }) =>
    endLabelAnchor({
      fraction,
      plotWidth: plot.plotWidth,
      label: series.label,
      fontSize: VX.text.micro,
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
  const half = (VX.text.micro * BOX_INK) / 2
  const plotW = Math.max(plot.plotWidth, 1)
  const spans = last.map(({ series, fraction }, i) => {
    const room = (END_LABEL_DX + series.label.length * VX.text.micro * BOX_GLYPH_EM) / plotW
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
          pts.push(pt)
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
  const place = (sides: readonly EndLabelSide[]) => {
    const start = last.map((_, i) =>
      cleared(i, sides[i] as EndLabelSide, nominal(i, sides[i] as EndLabelSide)),
    )
    const shifts = spreadLabels(start, plot.plotHeight)
    const centres = start.map((c, i) => c + (shifts[i] as number))
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
    return {
      series,
      row,
      anchor: anchors[i] as EndLabelAnchor,
      side,
      nudge: nominal(i, side) - centre,
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

export function endLabelMarks<T, X extends ChartX>(plan: readonly EndLabel<T, X>[]): ChartMarks {
  return plan.map(({ series, row, anchor, side, nudge }) =>
    decorative(
      text([row], {
        id: `${series.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => series.label,
        fill: series.color,
        fontSize: VX.text.micro,
        anchor,
        dx: endLabelOffset(anchor, side).dx,
        dy: endLabelOffset(anchor, side).dy + nudge,
      }),
    ),
  )
}
