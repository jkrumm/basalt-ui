/**
 * The axis extensions of one chart, pure: the x tick picker for a band axis, the plot fraction of a
 * band's edge (an `at` rule), and the y domain bounds with the off-scale carets they draw.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { BASALT } from '../../tokens'
import type { LabelBox } from '../chart-labels'
import { estimateWidth, fitsWith, lineHeight, placeWith } from '../label-place'
import { backingMarks, isStruck } from './label-backing'
import type { PlotPx } from '../label-obstacles'
import type { ChartMarks, ChartSeries, ChartX, XRefAt } from '../types'
import type { XScaleModel } from './scales'
import { CV } from './theme'

const keyOf = (v: ChartX): number | string => (v instanceof Date ? v.getTime() : v)

/**
 * At most `count` of `values` at an even stride that always keeps the first and the last: the
 * indices are `round(i * (len - 1) / (count - 1))`. `count >= len` keeps all, `1` the first.
 */
export function strideKeepEnds<V>(values: readonly V[], count: number): V[] {
  const len = values.length
  if (len === 0 || !(count >= 1)) return []
  if (count >= len) return [...values]
  if (count < 2) return [values[0] as V]
  const picked = Array.from({ length: count }, (_, i) => Math.round((i * (len - 1)) / (count - 1)))
  return [...new Set(picked)].map((i) => values[i] as V)
}

/** The band keys a tick list names, in the list's order (a key the axis lacks is dropped; Dates by timestamp). */
export function matchBandKeys<X extends ChartX>(
  values: readonly X[],
  wanted: readonly ChartX[],
): X[] {
  const byKey = new Map(values.map((v) => [keyOf(v), v] as const))
  return wanted.flatMap((w) => {
    const hit = byKey.get(keyOf(w))
    return hit === undefined ? [] : [hit]
  })
}

/**
 * The plot fraction of x for a rule: the centre; on a band (or point) axis `start` and `end` sit half
 * a step to either side, so the rule falls mid-gap between two bars. Clamped to the plot. A continuous
 * axis ignores `at`.
 */
export function edgeFraction<X extends ChartX>(
  model: XScaleModel<X>,
  x: X,
  at: XRefAt | undefined,
): number | null {
  const centre = model.fraction(x)
  if (centre === null || at === undefined || at === 'centre') return centre
  if (!(model.band || model.kind === 'string')) return centre
  const shifted = centre + (at === 'start' ? -model.halfStep : model.halfStep)
  return Math.min(1, Math.max(0, shifted))
}

/** A domain as `[min, max]`: a reversed tuple (`[100, 0]`, an inverted axis) is a valid domain. */
const ordered = (domain: readonly [number, number]): [number, number] => [
  Math.min(domain[0], domain[1]),
  Math.max(domain[0], domain[1]),
]

/** Which end of the domain `v` lies past (`top` is the max), or `null` inside it. */
export function offScaleSide(
  v: number,
  domain: readonly [number, number],
): 'top' | 'bottom' | null {
  if (!Number.isFinite(v)) return null
  const [lo, hi] = ordered(domain)
  if (v > hi) return 'top'
  return v < lo ? 'bottom' : null
}

/** `v` held on the plot edge it lies past. */
export const clampToDomain = (v: number, domain: readonly [number, number]): number => {
  const [lo, hi] = ordered(domain)
  return Math.min(hi, Math.max(lo, v))
}

/** The caret's size, px: a dot capped at the plot's edge keeps this much clear above it for the caret. */
export const CARET_SIZE = 8
const CARETS = { top: '▲', bottom: '▼' } as const

/** Air between a caret and the value label beside it, px: the caret's half width and the dot's reach. */
const CAP_LABEL_GAP = 8
/** The gaps a value beside a bare caret tries, px: a line past the caret takes the next gap that clears it. */
const CAP_LABEL_GAPS: readonly number[] = [CAP_LABEL_GAP, 16, 24, 32]
/** The wider gaps a value tries when the near ones are taken: only across bare plot, never past another caret. */
const CAP_LABEL_FAR_GAPS: readonly number[] = [48, 64]

/** Where a clamped mark's true value is written: the plot's size and what to keep clear of. */
export type CapLabelsOptions = {
  frame: () => PlotPx
  obstacles: () => readonly LabelBox[]
  /** The same without the bar bodies: where a value may stand inside the bar it names. */
  clear?: () => readonly LabelBox[]
}

/** The room inside a clamped bar: its centre as a plot-width shift from `f`, and its width. */
export type CapSlot = { shift: number; width: number }

type CapMark = { f: number; text: string; color: string; magnitude: number; slot?: CapSlot }

/** Air between a clamped bar's caret and the value written inside the bar's end, px. */
const INSIDE_GAP = 1
/** Air a value keeps inside the bar it stands in, px. */
const INSIDE_PAD = 2
/** Air between a clamped bar's end and the value written beside it, px. */
const BESIDE_GAP = 2
/** The least side of a text-sized box, px: a rule is 4 px thick and a line path piece under 11, a caption is 13 and more. */
const TEXT_BOX_MIN_PX = 12

/**
 * The true values of the marks held on the plot's edge, one text mark per series and side: each is
 * placed beside its caret by the kit's placer (right of it, else left), clear of the host's marks
 * and of the other values, and dropped when neither side has room. A clamped bar has no room beside
 * its caret (its own body fills the edge): its value stands inside the bar's end under the caret, in
 * the card's color, when it fits the bar. The caret says "past the edge"; this is how far past.
 */
function capValueMarks(
  found: { top: CapMark[]; bottom: CapMark[] },
  opts: {
    id: string
    edge: readonly [number, number]
    scale: 'y' | 'y2'
    /** The boxes of the values already written on this plot, shared by every series of one chart. */
    taken?: LabelBox[]
    /** The plot fractions of every caret on the chart: a value never lies over one. */
    carets?: { top: readonly number[]; bottom: readonly number[] }
  } & CapLabelsOptions,
): ChartMarks {
  if (found.top.length === 0 && found.bottom.length === 0) return []
  const frame = opts.frame()
  if (frame.width <= 0 || frame.height <= 0) return []
  const size = BASALT.text.micro
  const half = lineHeight(size) / 2
  const sides = (['top', 'bottom'] as const).flatMap((side) =>
    found[side].map((m, i) => ({ side, m, key: `${side}:${i}` })),
  )
  const byKey = new Map(sides.map((s) => [s.key, s]))
  const edgeY = (side: 'top' | 'bottom'): number => (side === 'top' ? 0 : frame.height)
  const pending = new Set(byKey.keys())
  const taken: LabelBox[] = opts.taken ?? []
  const struck: LabelBox[] = []
  type Spot = 'right' | 'left' | 'below' | 'above'
  const marks: (CapMark & {
    side: 'top' | 'bottom'
    dx: number
    dy: number
    anchor: 'start' | 'middle' | 'end'
  })[] = []
  /** Places the pending marks `at` gives a spot for; each that lands is written there and leaves the queue. */
  const land = (
    at: (side: 'top' | 'bottom', m: CapMark) => { x: number; y: number; spots: Spot[] } | undefined,
    options: {
      gap: number
      obstacles: readonly LabelBox[]
      color?: string
      /** A spot over a rule or a line piece is taken on a card-colored backing, so the rule gives way to the value. */
      backed?: boolean
    },
  ): void => {
    const wanted = [...pending].flatMap((key) => {
      const { side, m } = byKey.get(key)!
      const anchor = at(side, m)
      return anchor === undefined
        ? []
        : [{ key, text: m.text, ...anchor, size, priority: m.magnitude }]
    })
    const { placed } = placeWith(estimateWidth, wanted, frame, {
      gap: options.gap,
      obstacles: [...options.obstacles, ...taken],
      size,
    })
    for (const p of placed) {
      const { side, m } = byKey.get(p.key)!
      pending.delete(p.key)
      taken.push(p)
      if (options.backed === true && isStruck(p, all, frame)) struck.push(p)
      // The text mark centres on its datum, which is the edge: carry it to the box's middle.
      marks.push({
        ...m,
        ...(options.color !== undefined && { color: options.color }),
        side,
        dx: p.dx + (p.x - m.f * frame.width),
        dy: p.top + p.height / 2 - edgeY(side),
        anchor: p.textAnchor,
      })
    }
  }
  const rim = (side: 'top' | 'bottom'): number => (side === 'top' ? half : frame.height - half)
  const room = (m: CapMark): number => (m.slot?.width ?? 0) * frame.width
  const centre = (m: CapMark): number => (m.f + (m.slot?.shift ?? 0)) * frame.width
  // A bar's body fills the edge beside its caret: its value stands under the caret, inside the bar.
  land(
    (side, m) =>
      m.slot !== undefined &&
      fitsWith(estimateWidth, m.text, { width: room(m) }, { size, pad: INSIDE_PAD })
        ? {
            x: centre(m),
            y: edgeY(side) + (side === 'top' ? CARET_SIZE : -CARET_SIZE),
            spots: [side === 'top' ? 'below' : 'above'],
          }
        : undefined,
    { gap: INSIDE_GAP, obstacles: (opts.clear ?? opts.obstacles)(), color: CV.surface },
  )
  const caretBoxes: LabelBox[] = (['top', 'bottom'] as const).flatMap((side) =>
    (opts.carets?.[side] ?? []).map((f) => ({
      left: f * frame.width - CARET_SIZE / 2,
      top: side === 'top' ? 0 : frame.height - CARET_SIZE - 1,
      width: CARET_SIZE,
      height: CARET_SIZE + 1,
    })),
  )
  const all = [...opts.obstacles(), ...caretBoxes]
  // A bar too narrow for it: beside the bar's end, right of the bar else left.
  for (const [sign, spot] of [
    [1, 'right'],
    [-1, 'left'],
  ] as const)
    land(
      (side, m) =>
        m.slot === undefined
          ? undefined
          : { x: centre(m) + (sign * room(m)) / 2, y: rim(side), spots: [spot] },
      { gap: BESIDE_GAP, obstacles: all },
    )
  // A mark with no bar under it: beside its caret, right of it else left, at the first gap that clears.
  for (const gap of CAP_LABEL_GAPS)
    land(
      (side, m) =>
        m.slot === undefined
          ? { x: m.f * frame.width, y: rim(side), spots: ['right', 'left'] }
          : undefined,
      { gap, obstacles: all },
    )
  // Further out, one value at a time, highest first: the stretch between its caret and its box holds no
  // other caret, so the number cannot be read as belonging to a neighbour.
  const byMagnitude = [...pending].toSorted(
    (x, y) => (byKey.get(y)?.m.magnitude ?? 0) - (byKey.get(x)?.m.magnitude ?? 0),
  )
  for (const gap of CAP_LABEL_FAR_GAPS)
    for (const key of byMagnitude)
      for (const spot of ['right', 'left'] as const) {
        const entry = byKey.get(key)
        if (entry === undefined || !pending.has(key) || entry.m.slot !== undefined) continue
        const x = entry.m.f * frame.width
        const corridor: LabelBox = {
          left: spot === 'right' ? x : x - gap,
          top: entry.side === 'top' ? 0 : frame.height - CARET_SIZE - 1,
          width: gap,
          height: CARET_SIZE + 1,
        }
        // The caret's own box is not a neighbour: other carets and written values block the way.
        const blockers = [
          ...caretBoxes.filter((b) => Math.abs(b.left + CARET_SIZE / 2 - x) > 0.5),
          ...taken,
        ]
        if (
          blockers.some(
            (b) =>
              b.left < corridor.left + corridor.width &&
              corridor.left < b.left + b.width &&
              b.top < corridor.top + corridor.height &&
              corridor.top < b.top + b.height,
          )
        )
          continue
        land(
          (side, m) =>
            m === entry.m && m.slot === undefined ? { x, y: rim(side), spots: [spot] } : undefined,
          { gap, obstacles: all },
        )
      }
  // Last, row by row down from the edge under the caret: the first row clear of every box holds the
  // value, so it is never dropped while the plot has a free row beneath its caret.
  const rowStep = lineHeight(size) + INSIDE_PAD
  for (let row = 0; row * rowStep < frame.height && pending.size > 0; row++)
    land(
      (side, m) =>
        m.slot === undefined
          ? {
              x: m.f * frame.width,
              y: rim(side) + (side === 'top' ? row : -row) * rowStep,
              spots: [side === 'top' ? 'below' : 'above'],
            }
          : undefined,
      { gap: INSIDE_PAD, obstacles: all },
    )
  // Still pending: every spot clear of the lines and rules is taken (a spike's own line runs under its caret
  // and the plot's top is full). A clamped value is never dropped for a line: it stands beside its caret,
  // right then left, row by row down from the edge, clear of every label, caption and caret, over a line
  // if it must. It never overprints another text.
  const texts = [...(opts.clear ?? opts.obstacles)()].filter(
    (b) => Math.min(b.width, b.height) >= TEXT_BOX_MIN_PX,
  )
  for (let row = 0; row * rowStep < frame.height && pending.size > 0; row++)
    for (const spot of ['right', 'left'] as const)
      land(
        (side, m) =>
          m.slot === undefined
            ? {
                x: m.f * frame.width,
                y: rim(side) + (side === 'top' ? row : -row) * rowStep,
                spots: [spot],
              }
            : undefined,
        { gap: BESIDE_GAP, obstacles: [...texts, ...caretBoxes], backed: true },
      )
  if (marks.length === 0) return []
  type Mark = (typeof marks)[number]
  return [
    ...backingMarks({
      id: `${opts.id}-backing`,
      boxes: struck.map(({ left, top, width, height }) => ({ left, top, width, height })),
      frame,
      domain: opts.edge,
      scale: opts.scale,
    }),
    decorative(
      text(marks, {
        id: opts.id,
        x: (m: Mark) => m.f,
        y: (m: Mark) => ordered(opts.edge)[m.side === 'top' ? 1 : 0],
        xScale: 'zx',
        yScale: opts.scale,
        text: (m: Mark) => m.text,
        fill: (m: Mark) => m.color,
        fontSize: size,
        anchor: (m: Mark) => m.anchor,
        dx: (m: Mark) => m.dx,
        dy: (m: Mark) => m.dy,
      }),
    ),
  ] as unknown as ChartMarks
}

/**
 * One caret per datum past a bounded axis, in the series color, at the datum's x on the plot's top
 * or bottom edge. Drawn on the hidden `[0, 1]` x scale `zx`, so any x scale places it.
 */
export function offScaleMarks<T, X extends ChartX>(opts: {
  series: readonly ChartSeries<T>[]
  data: readonly T[]
  x: (d: T) => X
  fraction: (x: X) => number | null
  /** The domain a datum is past (the page's cap), or `null` for an axis with none. */
  domainOf: (s: ChartSeries<T>) => readonly [number, number] | null
  /** The plotted domain, where the caret sits; the cap's own when absent. */
  edgeOf?: (s: ChartSeries<T>) => readonly [number, number]
  yScaleOf: (s: ChartSeries<T>) => 'y' | 'y2'
  /** The text of a value past the cap: the series' `formatValue`, else the axis' format. */
  formatOf: (s: ChartSeries<T>) => (v: number, d: T) => string
  /** Where each caret's true value is written; a series that labels its own values is left to it. */
  labels: CapLabelsOptions
  /** A bar series' room inside its bar, where a value past the cap is written; none for any other. */
  slotOf?: (s: ChartSeries<T>) => CapSlot | undefined
  /** Bars whose own `values` label was placed, `<series key>:<x fraction>`: their value is not written twice. */
  written?: ReadonlySet<string>
  /** Bars and lines share the plot: a value written for a line names its series, so it is not read as a bar's. */
  nameLines?: boolean
}): ChartMarks {
  // One pass over the chart's values: a value past the cap is written once, and no two labels overprint.
  const taken: LabelBox[] = []
  const written = new Set<string>()
  // Bars and lines on one plot: a number written beside a line's caret reads as the bar's unless it names its series.
  const mixed = opts.nameLines === true
  const scanned = opts.series.flatMap((s) => {
    const domain = opts.domainOf(s)
    if (domain === null) return []
    const slot = opts.slotOf?.(s)
    // A series that labels its own values is left to its labels, where they landed.
    const own = s.values !== undefined && s.values !== false
    const found = { top: [] as number[], bottom: [] as number[] }
    const values = { top: [] as CapMark[], bottom: [] as CapMark[] }
    // An unbroken stretch of data past one end of the cap is written once, at its furthest point:
    // the number says how far the stretch reaches, and every caret of it is still drawn.
    let run: { side: 'top' | 'bottom'; peak: CapMark } | undefined
    const close = (): void => {
      if (run === undefined) return
      const { side, peak } = run
      run = undefined
      // Two series past the cap at one datum with one true value write it once.
      const once = `${side}:${peak.f}:${peak.text}`
      if (written.has(once)) return
      written.add(once)
      values[side].push(peak)
    }
    for (const d of opts.data) {
      const v = s.getValue(d)
      const side = v === null ? null : offScaleSide(v, domain)
      const f = side === null ? null : opts.fraction(opts.x(d))
      if (side === null || f === null || v === null) {
        close()
        continue
      }
      found[side].push(f)
      if (own && (opts.written === undefined || opts.written.has(`${s.key}:${f}`))) continue
      if (run !== undefined && run.side !== side) close()
      const at: CapMark = {
        f,
        text:
          mixed && s.mark !== 'bar'
            ? `${s.label} ${opts.formatOf(s)(v, d)}`
            : opts.formatOf(s)(v, d),
        color: s.color,
        magnitude: Math.abs(v),
        ...(slot !== undefined && { slot }),
      }
      if (run === undefined || at.magnitude > run.peak.magnitude) run = { side, peak: at }
    }
    close()
    return [{ s, domain, found, values }]
  })
  // Every caret of the chart is a mark a value keeps clear of, whichever series drew it.
  const carets = {
    top: scanned.flatMap((x) => x.found.top),
    bottom: scanned.flatMap((x) => x.found.bottom),
  }
  return scanned.flatMap(({ s, domain, found, values }) => {
    const edge = opts.edgeOf?.(s) ?? domain
    const marks = (['top', 'bottom'] as const).flatMap((side) =>
      found[side].length === 0
        ? []
        : [
            decorative(
              text(found[side], {
                id: `off-scale-${s.key}-${side}`,
                x: (f: number) => f,
                y: () => ordered(opts.edgeOf?.(s) ?? domain)[side === 'top' ? 1 : 0],
                xScale: 'zx',
                yScale: opts.yScaleOf(s),
                text: () => CARETS[side],
                // On a bar the caret sits inside the body that fills the edge: in the series color it is the bar's own, so it is cut in the card's color.
                fill: opts.slotOf?.(s) === undefined ? s.color : CV.surface,
                fontSize: CARET_SIZE,
                anchor: 'middle',
                dy: side === 'top' ? CARET_SIZE : -1,
              }),
            ),
          ],
    )
    const named = capValueMarks(values, {
      id: `off-scale-${s.key}-value`,
      edge,
      scale: opts.yScaleOf(s),
      taken,
      carets,
      ...opts.labels,
    })
    return [...marks, ...named]
  }) as unknown as ChartMarks
}

/**
 * One caret per x for a stack whose TOTAL passes a bounded axis (`offScaleMarks` sees one series at a
 * time, so it misses a stack of values that are each inside the cap). The caret sits on the plot's
 * edge in the color of the segment on top, the brand accent where that datum is highlighted.
 * `series` are the stacked bars, `domain` the cap and `edge` the plotted domain.
 */
export function stackCapMarks<T, X extends ChartX>(opts: {
  series: readonly ChartSeries<T>[]
  data: readonly T[]
  x: (d: T) => X
  fraction: (x: X) => number | null
  domain: readonly [number, number]
  edge: readonly [number, number]
  /** The text of a total past the cap: the left axis' format. */
  format: (v: number) => string
  /** Where each caret's true total is written; a stack whose bars label their own totals is left to them. */
  labels: CapLabelsOptions
}): ChartMarks {
  const found = {
    top: [] as { f: number; color: string; total: number }[],
    bottom: [] as { f: number; color: string; total: number }[],
  }
  for (const d of opts.data) {
    const f = opts.fraction(opts.x(d))
    if (f === null) continue
    const sums = { top: 0, bottom: 0 }
    const last: Partial<Record<'top' | 'bottom', ChartSeries<T>>> = {}
    for (const s of opts.series) {
      const v = s.getValue(d)
      if (v === null || !Number.isFinite(v) || v === 0) continue
      const side = v > 0 ? 'top' : 'bottom'
      sums[side] += v
      last[side] = s
    }
    for (const side of ['top', 'bottom'] as const) {
      const s = last[side]
      if (s === undefined || offScaleSide(sums[side], opts.domain) !== side) continue
      // The total is the whole stack's, no one segment's: it takes the ink of a stack total above an
      // unclamped stack, never its top segment's color (a pale segment's color read as that segment's value).
      found[side].push({ f, color: CV.inkMuted, total: sums[side] })
    }
  }
  const carets = (['top', 'bottom'] as const).flatMap((side) =>
    found[side].length === 0
      ? []
      : [
          decorative(
            text(found[side], {
              id: `stack-cap-${side}`,
              x: (c: { f: number }) => c.f,
              y: () => ordered(opts.edge)[side === 'top' ? 1 : 0],
              xScale: 'zx',
              yScale: 'y',
              text: () => CARETS[side],
              // The caret sits inside the stack's top bar, whose own color it would be: it is cut in the card's color.
              fill: CV.surface,
              fontSize: CARET_SIZE,
              anchor: 'middle',
              dy: side === 'top' ? CARET_SIZE : -1,
            }),
          ),
        ],
  )
  // A series that labels its own segment writes no total, so the caret's total stays the kit's to write.
  const own = opts.series.some(
    (s) => s.values !== undefined && s.values !== false && s.valuesAt !== 'segment',
  )
  const named = own
    ? []
    : capValueMarks(
        {
          top: found.top.map((c) => ({
            ...c,
            text: opts.format(c.total),
            magnitude: Math.abs(c.total),
          })),
          bottom: found.bottom.map((c) => ({
            ...c,
            text: opts.format(c.total),
            magnitude: Math.abs(c.total),
          })),
        },
        { id: 'stack-cap-value', edge: opts.edge, scale: 'y', ...opts.labels },
      )
  return [...carets, ...named] as unknown as ChartMarks
}

/**
 * The x domain of a point chart grown so every dot (`xs`: the dots' x as numbers, `r` the radius and
 * ring in px) sits whole inside the plot, which clips its marks at the edge: a dot centred on the
 * domain's end draws half. Grown only at an end a dot inside the domain reaches, found by settling (the room is a
 * share of the grown span). `null` when no dot reaches an end.
 */
export function xRoomForDots(
  extent: readonly [number, number],
  xs: readonly number[],
  r: number,
  plotWidth: number,
): [number, number] | null {
  const [lo, hi] = extent
  // A dot past the domain is clipped by design (a fixed window), never a reason to widen it.
  const finite = xs.filter((x) => x >= lo && x <= hi)
  if (finite.length === 0 || plotWidth <= 0 || !(hi > lo)) return null
  const [low, high] = [Math.min(...finite), Math.max(...finite)]
  let [from, to] = [lo, hi]
  for (let i = 0; i < 4; i++) {
    const room = (r * (to - from)) / plotWidth
    from = Math.min(lo, low - room)
    to = Math.max(hi, high + room)
  }
  return from === lo && to === hi ? null : [from, to]
}
