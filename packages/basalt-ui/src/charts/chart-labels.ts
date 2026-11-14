/**
 * Deterministic label measuring and a direct-label collision pass. `width` sums advances from a
 * checked-in table (`chart-labels-widths.gen.ts`, generated from the real chart face in Chrome), so
 * it needs no canvas and no DOM and a server render equals a client render. `place` is pure
 * geometry over those widths.
 */
import { VX } from '../tokens'
import { GLYPHS, WIDTHS } from './chart-labels-widths.gen'
import { trackAxis, trackRow } from './track'
import type {
  RowLabel,
  TrackAxis,
  TrackAxisOptions,
  TrackRow,
  TrackRowOptions,
  TrackValue,
} from './track'

/** Weights the width table covers. */
export type LabelWeight = 400 | 500 | 600 | 700

/** Where a label sits relative to its anchor point. */
export type LabelSpot =
  | 'right'
  | 'left'
  | 'above'
  | 'below'
  | 'above-right'
  | 'above-left'
  | 'below-right'
  | 'below-left'

/** A rectangle in the label frame's pixel space. */
export type LabelBox = { left: number; top: number; width: number; height: number }

/** A label to place: its text, its anchor point and how it ranks against the others. */
export type ChartLabel<K extends string = string> = {
  key: K
  text: string
  x: number
  y: number
  /** Higher is placed first; ties keep input order. Default 0. */
  priority?: number
  /** Font size in px. Default: the chart tick size. */
  size?: number
  /** Default 400. */
  weight?: LabelWeight
  /** The spots to try, in order. Default: all eight, in `SPOTS` order. */
  spots?: readonly LabelSpot[]
}

/** A label with the spot and box it landed on, plus what a `<text>` element needs. */
export type PlacedLabel<K extends string = string> = ChartLabel<K> & {
  spot: LabelSpot
  left: number
  top: number
  width: number
  height: number
  textAnchor: 'start' | 'middle' | 'end'
  /** The `y` for a `<text>` element drawn with the default (alphabetic) baseline. */
  baselineY: number
  /** The `x` for a `<text>` element drawn with `textAnchor`. */
  textX: number
}

const SPOTS: readonly LabelSpot[] = [
  'right',
  'left',
  'above',
  'below',
  'above-right',
  'above-left',
  'below-right',
  'below-left',
]

/** A label box is this many times its font size tall. */
const LINE_HEIGHT_RATIO = 1.2

/** The alphabetic baseline sits this share of the font size below the box's vertical centre. */
const BASELINE_OFFSET = 0.35

/** Default distance in px between the anchor and the label box. */
const DEFAULT_GAP = 4

const DEFAULT_SIZE: number = VX.text.micro

const INDEX = new Map<string, number>([...GLYPHS].map((ch, i) => [ch, i]))

function measure(text: string, size: number, weight: LabelWeight): number {
  const table = WIDTHS[weight]
  let em = 0
  for (const ch of text) {
    const i = INDEX.get(ch)
    em += i === undefined ? table.mean : (table.advances[i] ?? table.mean)
  }
  return em * size
}

const lineHeight = (size: number): number => size * LINE_HEIGHT_RATIO

function boxFor(
  spot: LabelSpot,
  x: number,
  y: number,
  width: number,
  height: number,
  gap: number,
): Pick<PlacedLabel, 'left' | 'top' | 'textAnchor'> {
  const centredTop = y - height / 2
  const centredLeft = x - width / 2
  switch (spot) {
    case 'right':
      return { left: x + gap, top: centredTop, textAnchor: 'start' }
    case 'left':
      return { left: x - gap - width, top: centredTop, textAnchor: 'end' }
    case 'above':
      return { left: centredLeft, top: y - gap - height, textAnchor: 'middle' }
    case 'below':
      return { left: centredLeft, top: y + gap, textAnchor: 'middle' }
    case 'above-right':
      return { left: x + gap, top: y - gap - height, textAnchor: 'start' }
    case 'above-left':
      return { left: x - gap - width, top: y - gap - height, textAnchor: 'end' }
    case 'below-right':
      return { left: x + gap, top: y + gap, textAnchor: 'start' }
    case 'below-left':
      return { left: x - gap - width, top: y + gap, textAnchor: 'end' }
  }
}

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

const inside = (box: LabelBox, frame: { width: number; height: number }): boolean =>
  box.left >= 0 &&
  box.top >= 0 &&
  box.left + box.width <= frame.width &&
  box.top + box.height <= frame.height

/**
 * Label measuring and direct-label placement for marks a page draws itself (custom
 * `CartesianChart` marks, a hand-built SVG).
 *
 * `width(text, { size, weight })` is the text's width in px; `fits(text, box, { pad })` says
 * whether it fits a box; `place(labels, frame, { gap, obstacles })` puts each label on the first of
 * its spots that lies inside the frame and clears every placed label and obstacle, and returns the
 * ones it could not place as `dropped`.
 *
 * @example
 * const { placed } = chartLabels.place(
 *   points.map((p) => ({ key: p.id, text: p.name, x: p.x, y: p.y, priority: p.weight })),
 *   { width: 480, height: 240 },
 * )
 * placed.map((l) => <text key={l.key} x={l.textX} y={l.baselineY} textAnchor={l.textAnchor}>{l.text}</text>)
 *
 * @useWhen a page draws its own marks and needs direct labels that never overlap, or needs to know
 * whether a label fits its segment, with the same answer on the server and in the browser.
 * @neverWhen the chart is a shipped kind (it labels itself), or the label is HTML in normal flow
 * that the browser lays out.
 */
export const chartLabels = {
  /**
   * The width in px of `text` on one line, default size the chart tick size and weight 400.
   *
   * An approximation, by design: the table holds the advances of the DEFAULT chart sans (Nunito
   * Sans Variable, tabular figures, no kerning), measured once in Chrome and checked in, so this
   * never touches canvas or DOM and a server render equals a client render. An app that retunes
   * `--basalt-chart-font` (or `--basalt-font-sans`) gets an estimate of that face, still identical
   * on the server and the client. A glyph the table lacks counts as the table's mean advance.
   */
  width(text: string, options: { size?: number; weight?: LabelWeight } = {}): number {
    return measure(text, options.size ?? DEFAULT_SIZE, options.weight ?? 400)
  },

  /** Whether `text` fits `box` on one line, with `pad` px kept free on every side. */
  fits(
    text: string,
    box: { width: number; height?: number },
    options: { size?: number; weight?: LabelWeight; pad?: number } = {},
  ): boolean {
    const size = options.size ?? DEFAULT_SIZE
    const pad = options.pad ?? 0
    if (measure(text, size, options.weight ?? 400) > box.width - 2 * pad) return false
    return box.height === undefined || lineHeight(size) <= box.height - 2 * pad
  },

  /**
   * Place each label on the first free spot, highest `priority` first (ties keep input order). A
   * spot is free when its box lies fully inside `frame` and overlaps no placed label and no
   * obstacle; a label with no free spot is returned in `dropped`.
   */
  place<K extends string>(
    labels: readonly ChartLabel<K>[],
    frame: { width: number; height: number },
    options: { gap?: number; obstacles?: readonly LabelBox[] } = {},
  ): { placed: PlacedLabel<K>[]; dropped: ChartLabel<K>[] } {
    const gap = options.gap ?? DEFAULT_GAP
    const taken: LabelBox[] = [...(options.obstacles ?? [])]
    const placed: PlacedLabel<K>[] = []
    const dropped: ChartLabel<K>[] = []
    const ranked = labels
      .map((label, index) => ({ label, index }))
      .toSorted((a, b) => (b.label.priority ?? 0) - (a.label.priority ?? 0) || a.index - b.index)

    for (const { label } of ranked) {
      const size = label.size ?? DEFAULT_SIZE
      const width = measure(label.text, size, label.weight ?? 400)
      const height = lineHeight(size)
      let landed: PlacedLabel<K> | undefined
      for (const spot of label.spots ?? SPOTS) {
        const at = boxFor(spot, label.x, label.y, width, height, gap)
        const box = { left: at.left, top: at.top, width, height }
        if (!inside(box, frame) || taken.some((other) => overlaps(box, other))) continue
        landed = {
          ...label,
          spot,
          ...box,
          textAnchor: at.textAnchor,
          baselineY: box.top + height / 2 + size * BASELINE_OFFSET,
          textX:
            at.textAnchor === 'start'
              ? box.left
              : at.textAnchor === 'end'
                ? box.left + width
                : box.left + width / 2,
        }
        break
      }
      if (landed === undefined) {
        dropped.push(label)
        continue
      }
      taken.push(landed)
      placed.push(landed)
    }
    return { placed, dropped }
  },

  /**
   * An axis for marks a page draws on an HTML track: ticks from a numeric or `Date` domain, with
   * label and gridline props to spread. `at(v)` is a value's share of the track (write it as
   * `left: %`). The end tick is the domain's end (`nice`, default on) and never wraps; the density
   * follows the container size classes, so nothing is measured and the server HTML equals the
   * client's. Put the track under an `@container`, and pass `share` when it is narrower than it.
   *
   * @example
   * const axis = chartLabels.axis({ domain: [0, runMs], format: seconds, share: 0.8 })
   * <div className="relative h-4">{axis.ticks.map((t) => <span key={t.at} {...t.label}>{t.text}</span>)}</div>
   */
  axis<V extends TrackValue>(options: TrackAxisOptions<V>): TrackAxis<V> {
    return trackAxis(options, (text, size) => measure(text, size, 400))
  },

  /**
   * The label pass for one HTML row: each label goes after its mark's end, inside its end, or before
   * its start, the first that stays on the track and clears the other marks, the placed labels and
   * `obstacles`, highest `priority` first; one with no room is `dropped` (the readout still says
   * it). It places once at `width`, the narrowest the track is drawn at, so it holds at any wider
   * width. `lines` is `grid` without the gridlines under a placed label.
   *
   * @example
   * const row = chartLabels.row([{ key: s.id, text: ms(s.duration), from: axis.at(s.start), to: axis.at(s.end) }], { grid: axis.ticks, share: 0.8 })
   */
  row<K extends string, V extends TrackValue = number>(
    labels: readonly RowLabel<K>[],
    options: TrackRowOptions<V> = {},
  ): TrackRow<K, V> {
    return trackRow(labels, options, (text, size) => measure(text, size, 400))
  },
}
