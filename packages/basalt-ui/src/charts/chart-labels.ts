/**
 * Deterministic label measuring and a direct-label collision pass. `width` sums advances from a
 * checked-in table (`chart-labels-widths.gen.ts`, generated from the real chart face in Chrome), so
 * it needs no canvas and no DOM and a server render equals a client render. `place` is the pure
 * geometry of `label-place.ts` over those widths.
 */
import { BASALT } from '../tokens'
import { GLYPHS, WIDTHS } from './chart-labels-widths.gen'
import { fitsWith, placeWith } from './label-place'
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
  /** The font size the label was measured at, px: draw the text at it (`fontSize`) so it fills the box. */
  size: number
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
  /**
   * The text's offset in px from its anchor, for an engine `text` mark drawn at the anchor's datum
   * (`dx`, `dy`, `anchor: textAnchor`): `textX - x`, and the box's middle less `y`, since that mark
   * centres its text on `y`.
   */
  dx: number
  dy: number
}

/** A numeric domain makes a numeric axis and a `Date` domain a time axis, never a literal type. */
type TrackAxisOf = {
  (options: TrackAxisOptions<number>): TrackAxis<number>
  (options: TrackAxisOptions<Date>): TrackAxis<Date>
}

const DEFAULT_SIZE: number = BASALT.text.micro

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

const warnedDrops = new Set<string>()

/** Dev only: a label `place` dropped is named once, with the frame that had no room for it. */
function warnDropped(
  dropped: readonly ChartLabel[],
  frame: { width: number; height: number },
): void {
  if (process.env.NODE_ENV === 'production' || dropped.length === 0) return
  const keys = dropped.map((label) => label.key).join(', ')
  const note = `${keys}@${Math.round(frame.width)}x${Math.round(frame.height)}`
  if (warnedDrops.has(note)) return
  warnedDrops.add(note)
  // oxlint-disable-next-line no-console -- the dev-only warning is the whole point of this function
  console.warn(
    `basalt-ui/charts: chartLabels.place dropped ${dropped.length} label(s) (${keys}): none of the eight spots clears the frame (${Math.round(frame.width)} x ${Math.round(frame.height)} px), the placed labels and the larger obstacles. Give them more room, or drop them on purpose.`,
  )
}

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
    return fitsWith(measure, text, box, { ...options, size: options.size ?? DEFAULT_SIZE })
  },

  /**
   * Place each label on the first free spot, highest `priority` first (ties keep input order). A
   * spot is free when its box lies fully inside `frame` and overlaps no placed label and no
   * obstacle; a label with no free spot is returned in `dropped`. A box that overflows the frame
   * slides along that edge to stay in (a centred spot sideways, a side spot up or down by at most
   * half its height), so a short label on a point at the plot's edge still lands beside it, whole.
   *
   * An obstacle no taller or wider than a label line is a point mark (a dot): in a crowded cloud a
   * label lands on the spot that meets the fewest of them, beside its anchor, instead of dropping;
   * a label no spot can hold is `dropped`, and a dev build warns once, naming its key and the frame.
   *
   * Called from `CartesianChart.custom`'s `build`, it also keeps clear of what the host drew under
   * the marks, with no option to pass: the end labels, the line paths, the rules and the bodies of
   * the bars (`frame` is the plot, as `ChartPlot.plotWidth` and `plotHeight`). The zone and rule
   * captions give way: they are placed after the page's labels, and move or drop to clear them.
   */
  place<K extends string>(
    labels: readonly ChartLabel<K>[],
    frame: { width: number; height: number },
    options: { gap?: number; obstacles?: readonly LabelBox[] } = {},
  ): { placed: PlacedLabel<K>[]; dropped: ChartLabel<K>[] } {
    const result = placeWith(measure, labels, frame, {
      ...options,
      size: DEFAULT_SIZE,
      pointMarks: true,
    })
    warnDropped(result.dropped, frame)
    return result
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
  axis: ((options: TrackAxisOptions<TrackValue>) =>
    trackAxis(options, (text, size) => measure(text, size, 400))) as TrackAxisOf,

  /**
   * The label pass for one HTML row: each label goes after its mark's end, inside its end, or before
   * its start, the first that stays on the track and clears the other marks, the placed labels and
   * `obstacles`, highest `priority` first; one with no room is `dropped` (the readout still says
   * it). Each label is placed by the room it has at each container class (`@narrow`, `@regular`,
   * `@wide`) and its `props.className` shows it from the first class where it fits, so a title too
   * long for a narrow track still shows on a wide one; `width` places once at that px width instead.
   * `lines` is `grid` without the gridlines under a placed label at the narrowest class.
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
