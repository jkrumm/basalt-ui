/**
 * The pure geometry of `IntervalTrack`: lanes for the spans of one row that overlap, and the label
 * pass of one lane at the plot's px width. A label goes after its mark's end, inside its end, or
 * before its start, the first spot that stays on the plot and clears the lane's other marks and
 * labels; with none free it is dropped, never cut to an ellipsis. Highest priority first, ties in
 * input order. Measured with the checked-in width table (`chartLabels.width`), so the server render
 * equals the client's.
 */
import { chartLabels } from '../chart-labels'

/** A span on one lane, px from the plot's left. A point has `to === from`. */
export type PxSpan = { from: number; to: number }

export type LaneLabel = PxSpan & {
  key: number
  text: string
  /** Higher is placed first. */
  priority: number
}

/** Where a label landed: after the mark, inside its end, or before its start. */
export type LaneSpot = 'after' | 'inside' | 'before'

export type PlacedLaneLabel = {
  key: number
  /** The text drawn: always the label's own, never a cut prefix. */
  text: string
  spot: LaneSpot
}

export type LaneLabelOptions = {
  /** The plot's width, px. */
  width: number
  /** Font size, px. */
  size: number
  /** Px between a label and its mark. */
  gap: number
}

/**
 * The width table estimates the default chart face; a fallback face (CI's Linux Chrome) measured a
 * cut label about 15% wider than the estimate, so every label is placed as if a fifth wider.
 */
export const LABEL_SLACK = 1.2

/** A cut label keeps at least this many characters of its text before the ellipsis. */
const MIN_KEPT = 5
const ELLIPSIS = '\u2026'

const meets = (a: PxSpan, b: PxSpan): boolean => a.from < b.to && b.from < a.to

/** The longest prefix of `text` that fits `room` px with an ellipsis, or `null`. */
export function cutToFit(text: string, room: number, size: number): string | null {
  const chars = [...text]
  for (let n = chars.length - 1; n >= MIN_KEPT; n--) {
    const cut = `${chars.slice(0, n).join('').trimEnd()}${ELLIPSIS}`
    if (chartLabels.width(cut, { size }) * LABEL_SLACK <= room) return cut
  }
  return null
}

/**
 * The label pass of one lane: `marks` are every span drawn on it (a label's own mark included,
 * matched by `key` in `labels`); a placed label keeps clear of the others and of every placed label.
 */
export function placeLaneLabels(
  labels: readonly LaneLabel[],
  marks: readonly (PxSpan & { key: number })[],
  options: LaneLabelOptions,
): { placed: PlacedLaneLabel[]; dropped: number[] } {
  const { width, size, gap } = options
  const boxes: PxSpan[] = []
  const placed: PlacedLaneLabel[] = []
  const dropped: number[] = []
  const ranked = labels
    .map((label, index) => ({ label, index }))
    .toSorted((a, b) => b.label.priority - a.label.priority || a.index - b.index)
  for (const { label } of ranked) {
    const others = marks.filter((m) => m.key !== label.key)
    const free = (box: PxSpan): boolean =>
      box.from >= 0 &&
      box.to <= width &&
      !others.some((m) => meets(box, m)) &&
      !boxes.some((b) => meets(box, b))
    const w = chartLabels.width(label.text, { size }) * LABEL_SLACK
    const tries: [LaneSpot, PxSpan][] = [
      ['after', { from: label.to + gap, to: label.to + gap + w }],
      ['inside', { from: label.to - gap - w, to: label.to - gap }],
      ['before', { from: label.from - gap - w, to: label.from - gap }],
    ]
    const hit = tries.find(
      ([spot, box]) => free(box) && (spot !== 'inside' || box.from >= label.from + gap),
    )
    if (hit !== undefined) {
      boxes.push(hit[1])
      placed.push({ key: label.key, text: label.text, spot: hit[0] })
      continue
    }
    // No spot holds it whole: it is dropped. A cut label reads as a different one, so none is cut.
    dropped.push(label.key)
  }
  return { placed, dropped }
}
