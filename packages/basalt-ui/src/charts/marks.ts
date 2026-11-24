/**
 * The line-overlay mark every kind draws the same way: `Lines`' series and `Bars`' line overlays.
 * One place for stroke width, dash, curve, the right-axis binding and legend-hover emphasis (a
 * companion keeps full strength while its `parent` is the highlighted entry).
 */
import { barY } from '@tanstack/charts/bar'
import type { BarYOptions } from '@tanstack/charts/bar'
import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { BASALT } from '../tokens'
import { chartCurve } from './curves'
import { CV, DASH, DIMMED, DIMMED_TEXT, LINE_STROKE_WIDTH } from './core/theme'
import { rowX } from './types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from './types'

/** `'y2'` for a right-axis series on a chart that has one; otherwise the default axis. */
export function yScaleOf<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  s: Pick<ChartSeries<T>, 'axis'>,
): 'y2' | undefined {
  return s.axis === 'right' ? plot.y2 : undefined
}

/** `1`, or `DIMMED` while ANOTHER legend entry (not this series, not its parent) is hovered. */
export function emphasis<T>(
  highlighted: string | null,
  s: Pick<ChartSeries<T>, 'key' | 'parent'>,
): number {
  return highlighted === null || highlighted === s.key || highlighted === s.parent ? 1 : DIMMED
}

/** The share of the card's muted ink a dimmed mark takes in dark: the floor under a dark series color. */
const DARK_DIM_INK = 0.3
/** The same in light, where the dim fades a light series color into the pale card: the floor keeps it at 3:1. */
const LIGHT_DIM_INK = 0.6

const mixed = (color: string, opacity: number): string =>
  opacity >= 1 ? color : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`

const withFloor = (paint: string, ink: number): string =>
  `color-mix(in srgb, ${paint}, ${CV.inkMuted} ${Math.round(ink * 100)}%)`

/** What a dimmed ink-step bar keeps of its resting opacity: a mid grey recedes from 3.9:1 on the card to 2.7:1, far enough to read against the focused bar and its resting neighbours. Deliberately under the 3:1 `dimmedPaint` keeps: a bar left in its own ink has no other way to recede. */
export const INK_STEP_DIM = 0.78

/** The widest spread between a grey's channels that still reads as a step of the ink scale. */
const GREY_SPREAD = 6
const INK_VAR = /^var\(--basalt-ink(?:-muted|-faint)?\)$/
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

function isInkValue(value: string): boolean {
  if (INK_VAR.test(value)) return true
  const channels = HEX.exec(value)
    ?.slice(1)
    .map((c) => Number.parseInt(c, 16))
  return channels !== undefined && Math.max(...channels) - Math.min(...channels) <= GREY_SPREAD
}

/**
 * Whether a series color is a step of the ink scale: a grey hex (or a `light-dark()` pair of them) or
 * one of the ink tokens. `dimmedPaint` mixes the card's muted ink into a mark as its floor, which is
 * the color of such a step already, so a dimmed ink-step bar looked as it does at rest: it dims by
 * `INK_STEP_DIM` of its resting opacity instead.
 */
export function isInkStep(color: string): boolean {
  const pair = color.startsWith('light-dark(') && color.endsWith(')')
  const values = pair ? color.slice(11, -1).split(',') : [color]
  return values.every((v) => isInkValue(v.trim()))
}

/** The state of a bar for the paint a label standing on it is read against: the focused datum, another's, or neither. */
export type BarState = 'rest' | 'focused' | 'dimmed'

const share = (v: number): number => Math.round(v * 1000) / 10

/**
 * The opaque color a bar of `color` shows on the card, per state: the exact composite of what
 * `barMarks` paints (`strength` at rest, `focusedPaint` on the focused datum, `dimmedPaint` on the
 * others), flattened over the card so a color function can read its lightness. A dimmed bar is
 * `color`, the card's muted ink and the card in the weights `dimmedPaint` mixes them.
 */
export function barOnCard(color: string, strength: number, state: BarState): string {
  if (state === 'focused') return focusedPaint(color)
  if (state === 'rest')
    return strength >= 1 ? color : `color-mix(in srgb, ${color} ${share(strength)}%, ${CV.surface})`
  if (state === 'dimmed' && isInkStep(color))
    return `color-mix(in srgb, ${color} ${share(strength * INK_STEP_DIM)}%, ${CV.surface})`
  const flat = (opacity: number, floor: number): string => {
    const own = (1 - floor) * strength * opacity
    const inner = `color-mix(in srgb, ${CV.inkMuted} ${share(floor / (1 - own))}%, ${CV.surface})`
    return `color-mix(in srgb, ${color} ${share(own)}%, ${inner})`
  }
  return `light-dark(${flat(DIMMED, LIGHT_DIM_INK)}, ${flat(DIMMED_TEXT, DARK_DIM_INK)})`
}

/**
 * OKLab lightness where black and white read alike on a grey (a relative luminance of 0.18, the cube
 * root of it): a fill lighter than this takes black, a darker one white, and both clear 4.5:1 there.
 */
const INK_FLIP = 0.565

/**
 * The ink for text standing on `surface` (an opaque color): black on a light fill, white on a dark
 * one, whichever reads better, through a relative color so it follows both schemes and every state
 * of the fill without a measured value.
 */
export function inkOn(surface: string): string {
  return `oklch(from ${surface} clamp(0, calc((${INK_FLIP} - l) * 1000), 1) 0 0)`
}

/** The share of the card's ink the focused mark takes, so it rises past its resting color as the rest falls. */
const FOCUS_INK = 0.4

/**
 * The paint of the mark that holds the focus while the rest dim: its color at full strength with
 * two fifths of the card's ink, so a neutral mark among neutral marks reads at 1.5 to 2 times the
 * contrast of its dimmed neighbours (a 0.55 faded bar included) and an accent in dark lifts off the card.
 */
export function focusedPaint(color: string): string {
  return `color-mix(in srgb, ${color}, ${CV.ink} ${Math.round(FOCUS_INK * 100)}%)`
}

/**
 * The paint of a mark while ANOTHER datum holds the focus, `strength` being what it draws at
 * otherwise: `DIMMED` of it with the card's muted ink mixed in on the light card, `DIMMED_TEXT` of
 * it with the same ink on the dark one, so a series color near the card's own keeps a floor against
 * the card instead of vanishing into it. Bars and lines dim through this one function.
 */
export function dimmedPaint(color: string, strength = 1): string {
  const light = withFloor(mixed(color, strength * DIMMED), LIGHT_DIM_INK)
  const dark = withFloor(mixed(color, strength * DIMMED_TEXT), DARK_DIM_INK)
  return `light-dark(${light}, ${dark})`
}

/** What a dimmed line in its own hue keeps of its color: the rest is the card's muted ink, a floor against the card. */
const HUE_STRENGTH = 0.8
const HUE_LIGHT_INK = 0.12
const HUE_DARK_INK = 0.08
/** The stroke a dimmed line keeps of its width when it stays in its own hue. */
const HUE_WEIGHT = 0.75

/**
 * The paint of a line that stays in its own hue while another datum holds the focus: its color at
 * reduced strength with a light touch of the card's muted ink for the floor, so two or more lines
 * stay told apart where `dimmedPaint` would turn them all the same slate.
 */
export function dimmedHuePaint(color: string): string {
  const light = withFloor(mixed(color, HUE_STRENGTH), HUE_LIGHT_INK)
  const dark = withFloor(mixed(color, HUE_STRENGTH), HUE_DARK_INK)
  return `light-dark(${light}, ${dark})`
}

/** Whether a chart's lines keep their own hue under a focus: two or more are visible, one is nothing to tell apart. */
const keepsHue = <T, X extends ChartX>(plot: PlotContext<T, X>): boolean =>
  plot.visible.filter((s) => s.mark === 'line').length >= 2

/** The paint of a line, or of the direct label that names it, while `plot.focused` holds a datum or not. */
export function linePaint<T, X extends ChartX>(plot: PlotContext<T, X>, color: string): string {
  if (plot.focused === null) return color
  return keepsHue(plot) ? dimmedHuePaint(color) : dimmedPaint(color)
}

/** The rows a series' line and area are drawn through: all of them, or only the non-null ones. */
export function drawnRows<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  s: Pick<ChartSeries<T>, 'key' | 'gaps'>,
): PlotRow<T, X>[] {
  const rows = plot.rows(s.key)
  return s.gaps === 'connect' ? rows.filter((r) => r.y !== null) : rows
}

export function lineMark<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  s: ChartSeries<T>,
): ChartMarks[number] {
  const yScale = yScaleOf(plot, s)
  return lineY(drawnRows(plot, s), {
    id: s.key,
    x: rowX,
    y: 'y',
    z: 'series',
    // A `focus` holding a datum dims every line: to the level a bar's rest dims to, or, with two or more lines, in its own hue at reduced weight.
    stroke: linePaint(plot, s.color),
    strokeWidth:
      (s.strokeWidth ?? LINE_STROKE_WIDTH) *
      (plot.focused !== null && keepsHue(plot) ? HUE_WEIGHT : 1),
    strokeOpacity: (s.strokeOpacity ?? 1) * emphasis(plot.highlighted, s),
    curve: chartCurve(s.curve ?? 'linear'),
    ...(s.dash === 'dashed' && { strokeDasharray: DASH }),
    ...(yScale !== undefined && { yScale }),
  })
}

const isFinitePoint = <T, X extends ChartX>(r: PlotRow<T, X> | undefined): boolean =>
  r !== undefined && r.y !== null && Number.isFinite(r.y)

/** A lone dot's radius as a multiple of the series' stroke width, so it reads as the line's end cap. */
const LONE_DOT_STROKE_FACTOR = 1.25

/**
 * The dot for a point a line cannot draw: a finite value with no finite neighbour in `drawn` (the
 * rows the line is drawn through: a one-point window, or a value between nulls). A path of one
 * point has no length, so without this the series is invisible. One mark per series. A point the
 * series' own `getMarker` already marks is left to it.
 */
export function loneDots<T, X extends ChartX>(
  s: ChartSeries<T>,
  drawn: readonly PlotRow<T, X>[],
  yScale: 'y2' | undefined,
  highlighted: string | null,
): ChartMarks {
  const lone = drawn.filter(
    (r, i) =>
      isFinitePoint(r) &&
      !isFinitePoint(drawn[i - 1]) &&
      !isFinitePoint(drawn[i + 1]) &&
      !s.getMarker?.(r.datum),
  )
  if (lone.length === 0) return []
  return [
    decorative(
      dot(lone, {
        id: `${s.key}-lone`,
        x: rowX,
        y: 'y',
        r: Math.max(BASALT.dotR - 1, (s.strokeWidth ?? LINE_STROKE_WIDTH) * LONE_DOT_STROKE_FACTOR),
        fill: s.color,
        fillOpacity: (s.strokeOpacity ?? 1) * emphasis(highlighted, s),
        ...(yScale !== undefined && { yScale }),
      }),
    ),
  ]
}

type MarkerGroup<T, X extends ChartX> = {
  color: string
  opacity: number
  ring: boolean
  rows: (PlotRow<T, X> & { r: number })[]
}

/** A series' `getMarker` points as dots: one decorative mark per distinct paint. */
export function markersOf<T, X extends ChartX>(
  s: ChartSeries<T>,
  rows: readonly PlotRow<T, X>[],
  yScale: 'y2' | undefined,
): ChartMarks {
  const getMarker = s.getMarker
  if (!getMarker) return []
  // `dot.fill` is constant, so one decorative dot mark per distinct marker paint.
  const groups: MarkerGroup<T, X>[] = []
  for (const row of rows) {
    if (row.y === null) continue
    const m = getMarker(row.datum)
    if (!m) continue
    const paint = { color: m.color ?? s.color, opacity: m.fillOpacity ?? 1, ring: m.ring !== false }
    let group = groups.find(
      (g) => g.color === paint.color && g.opacity === paint.opacity && g.ring === paint.ring,
    )
    if (!group) {
      group = { ...paint, rows: [] }
      groups.push(group)
    }
    group.rows.push({ ...row, r: m.r ?? BASALT.dotR })
  }
  return groups.map((group, i) =>
    decorative(
      dot(group.rows, {
        id: `${s.key}-marker-${i}`,
        x: rowX,
        y: 'y',
        r: 'r',
        fill: group.color,
        fillOpacity: group.opacity,
        ...(group.ring && { stroke: CV.surface, strokeWidth: 1.5 }),
        ...(yScale !== undefined && { yScale }),
      }),
    ),
  )
}

/**
 * The cursor dot of a series the consumer draws itself (`ChartSeries.cursorValue`): a dot per datum,
 * invisible until the cursor is on that datum's x. It is NOT decorative, so the engine counts it as
 * a focus point and the shared cursor, the focus group and the tooltip reach the series.
 */
export function cursorDots<T, X extends ChartX>(
  s: ChartSeries<T>,
  rows: readonly PlotRow<T, X>[],
  yScale: 'y2' | undefined,
): ChartMarks {
  const { getMarker } = s
  // `dot.fill` is constant but a state style's is not: one mark whose focused fill is the datum's
  // own `getMarker` color, resolved once per row here rather than on every focus repaint. The map
  // is keyed by the row OBJECT: the engine hands the same objects back as the state context's datum.
  const colors = getMarker
    ? new Map(rows.map((r) => [r, getMarker(r.datum)?.color ?? s.color]))
    : undefined
  const focused = {
    fillOpacity: 1,
    strokeOpacity: 1,
    ...(colors && {
      fill: ({ datum }: { datum: PlotRow<T, X> }): string => colors.get(datum) ?? s.color,
    }),
  }
  return [
    dot(rows, {
      id: `${s.key}-cursor`,
      x: rowX,
      y: 'y',
      r: BASALT.dotR,
      fill: s.color,
      fillOpacity: 0,
      stroke: CV.surface,
      strokeWidth: 1.5,
      strokeOpacity: 0,
      states: [{ when: { focus: 'x' }, style: focused }],
      ...(yScale !== undefined && { yScale }),
    }),
  ]
}

/**
 * A single-series `barY`. The engine stacks every `barY` that has no explicit extent, and a row with
 * no `z`/`color` channel is its own series: an N-by-N matrix (a 5k-row `DualPanel` took 10 s). So
 * the extent is explicit (`y1: 0`) unless the caller asks for a series (`z`, `color`) or a `layout`.
 * Every bar that is not `Bars'` stacked/grouped one is drawn through this.
 */
const given = (v: unknown): boolean => v !== undefined && v !== null

export function barMark<TDatum>(
  rows: Iterable<TDatum>,
  options: BarYOptions<TDatum> = {},
): ChartMarks[number] {
  // On values, not keys: `z: undefined` from a conditional spread asks for no series.
  const seriesAsked = [options.z, options.color, options.layout].some(given)
  const extentGiven = [options.y1, options.y2].some(given)
  return barY(rows, seriesAsked || extentGiven ? options : { ...options, y1: 0 })
}

/** Rows per plot pixel beyond which {@link thinFill} thins. */
const FILL_ROWS_PER_PX = 4

type Extreme = { value: number; index: number }
type Bucket = {
  first: number
  last: number
  minFrom: Extreme
  maxFrom: Extreme
  minTo: Extreme
  maxTo: Extreme
  minGap: Extreme
  maxGap: Extreme
}

const extreme = (value: number, index: number): Extreme => ({ value, index })
const lower = (e: Extreme, value: number, index: number): void => {
  if (value < e.value) Object.assign(e, { value, index })
}
const upper = (e: Extreme, value: number, index: number): void => {
  if (value > e.value) Object.assign(e, { value, index })
}

/**
 * A band fill drawn at `width` px: each pixel column of the plot keeps its first and last row and the
 * rows holding the extremes of `from`, `to` and `to - from`, so the silhouette and every sign
 * crossing survive while a 10k-row series stops costing the engine a scene point per row. `at` is a
 * row's x as a plot fraction (0..1), so an irregularly sampled series (bursts, then a gap) is
 * bucketed by where it is drawn, not by its array index. The series' own first and last row are
 * always kept. Below {@link FILL_ROWS_PER_PX} rows per pixel, or for an unmeasured width, the rows
 * come back unchanged. Order is preserved; pure in its inputs, so the server render and the first
 * client render agree. Only for decorative fills: hover and focus must read the full series.
 */
export function thinFill<R extends { from: number; to: number }>(
  rows: readonly R[],
  width: number,
  at: (row: R) => number,
): R[] {
  const buckets = Math.floor(width)
  if (!(buckets >= 1) || rows.length <= buckets * FILL_ROWS_PER_PX) return rows.slice()
  const kept = new Set<number>([0, rows.length - 1])
  const columns = new Map<number, Bucket>()
  for (const [i, r] of rows.entries()) {
    const position = at(r)
    // A gap (a non-finite value) breaks the fill and must stay where it is; it never seeds or wins an
    // extremum. A row with no position cannot be placed in a column: keep it too.
    if (!Number.isFinite(r.from) || !Number.isFinite(r.to) || !Number.isFinite(position)) {
      kept.add(i)
      continue
    }
    const column = Math.min(buckets - 1, Math.max(0, Math.floor(position * buckets)))
    const gap = r.to - r.from
    const b = columns.get(column)
    if (!b) {
      columns.set(column, {
        first: i,
        last: i,
        minFrom: extreme(r.from, i),
        maxFrom: extreme(r.from, i),
        minTo: extreme(r.to, i),
        maxTo: extreme(r.to, i),
        minGap: extreme(gap, i),
        maxGap: extreme(gap, i),
      })
      continue
    }
    b.last = i
    lower(b.minFrom, r.from, i)
    upper(b.maxFrom, r.from, i)
    lower(b.minTo, r.to, i)
    upper(b.maxTo, r.to, i)
    lower(b.minGap, gap, i)
    upper(b.maxGap, gap, i)
  }
  for (const b of columns.values()) {
    for (const i of [b.first, b.last]) kept.add(i)
    for (const e of [b.minFrom, b.maxFrom, b.minTo, b.maxTo, b.minGap, b.maxGap]) kept.add(e.index)
  }
  return [...kept]
    .toSorted((p, q) => p - q)
    .flatMap((i) => {
      const row = rows[i]
      return row === undefined ? [] : [row]
    })
}
