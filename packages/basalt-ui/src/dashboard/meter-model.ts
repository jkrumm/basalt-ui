/**
 * Meter's pure model: everything the component shows, computed from numbers (no DOM, no React runtime).
 * Internal — `meter.tsx` and `meter-parts.tsx` render what this returns.
 */
import type { ReactNode } from 'react'
import { clamp01, toPct } from './scale'

export type MeterSegment = {
  value: number
  label: string
  color?: string
  /**
   * `'muted'`: the part takes the one flat muted fill every muted part shares, a hairline seam
   * between neighbours (never a lightness step). A `color` wins.
   */
  tone?: 'muted'
  forecast?: boolean
}
export type MeterZone = {
  from: number
  to: number
  label: string
  /**
   * `'muted'`: the band takes the one flat muted fill every muted zone shares, a hairline gap
   * between neighbours (never a lightness step): a non-verdict band is not a value bar. A `color` wins.
   */
  tone?: 'muted'
  /**
   * A shorter name for a narrow track. The row tries `label`, then `short`, and only then hides the
   * name; the holding zone always shows its full `label`. The described-by text keeps `label`.
   */
  short?: string
  color?: string
}
/**
 * A mark on the track at `at` (in the reading's units). A `label` is captioned beside it, above the
 * track; a `caption` sits under the track, centred on the mark and clamped inside the track.
 */
export type MeterTick = { at: number; label?: string; caption?: string }

/** A colour of a `stops` gradient at `at` (in the reading's units); the colour is the consumer's. */
type MeterStop = { at: number; color: string }

/** A ramp step's strength in percent of its neutral: from `lo`, spread over `step` across the steps. */
export const RAMP_ZONE = { lo: 15, step: 45, solo: 40 }
/** The flat muted fill, in percent of `--vx-muted`: a zone band (argo's alpha) and a segment (clears 3:1 on the track). */
const MUTED_ZONE = 35
const MUTED_PART = 65
/** Neighbouring steps stay at least this far apart (the contrast the zone ramp always had), up to `RAMP_MAX`. */
export const RAMP_MIN_STEP = 15
export const RAMP_MAX = 95

/**
 * Step `index` of `count`. The spread is floored at `RAMP_MIN_STEP` per step, so a ramp stays
 * distinguishable by lightness up to six zones; past that the last steps clamp at
 * `RAMP_MAX` and merge, which is the cue to group parts.
 */
export function rampStrength(index: number, count: number, ramp: typeof RAMP_ZONE): number {
  if (count <= 1) return ramp.solo
  return Math.min(RAMP_MAX, ramp.lo + index * Math.max(RAMP_MIN_STEP, ramp.step / (count - 1)))
}

function rampFill(base: 'line', index: number, count: number, ramp: typeof RAMP_ZONE): string {
  return `color-mix(in srgb, var(--vx-${base}) ${rampStrength(index, count, ramp)}%, transparent)`
}

const mutedFill = (pct: number) => `color-mix(in srgb, var(--vx-muted) ${pct}%, transparent)`

/** A zone's fill: its own colour, else the one flat muted fill (`tone="muted"`), else its step of the line ramp. */
export function zoneFill(zone: MeterZone, index: number, count: number): string {
  if (zone.color !== undefined) return zone.color
  return zone.tone === 'muted' ? mutedFill(MUTED_ZONE) : rampFill('line', index, count, RAMP_ZONE)
}

/** One tick on the track: its percent position and what it says (caption `label`, aria `text`). */
export type TickMark = {
  key: string
  pct: number
  label: string | undefined
  caption: string | undefined
  text: string
}

/** A fill on the track, as fractions (0–1) of the span, with the segment it was laid out from. */
export type Part = {
  readonly start: number
  readonly size: number
  readonly color: string | undefined
  readonly forecast: boolean
  /** A muted part right after another muted part: a hairline seam keeps the shared fill apart. */
  readonly seam: boolean
  readonly label: string
  /** The segment's own (normalised) amount, in the reading's units — what its caption states. */
  readonly amount: number
}

/** One categorical part's caption: its position key, name, formatted amount and fill colour (`undefined` = neutral). */
export type PartCaption = {
  key: string
  label: string
  text: string
  color: string | undefined
  /** Where the part starts on the track, in percent: the caption sits under it when they all fit. */
  startPct: number
}

/** One zone's name on the label row: its span's centre and width (percent) and whether it holds the reading. */
export type ZoneLabel = {
  key: string
  label: string
  /** The fallback name, when the zone has one. */
  short?: string
  centrePct: number
  widthPct: number
  holding: boolean
}

/**
 * What the caption row says. `reading`: the formatted reading; `parts`: categorical segments name
 * every part instead; `forecast`: committed/forecast keeps the reading plus the forecast caption.
 */
export type CaptionMode = 'reading' | 'parts' | 'forecast'

type Format = (value: number) => string

/**
 * The ticks that sit on the track, in the order given. A tick outside `[min, max]` (or not a number)
 * is DROPPED, never clamped: a mark pinned to the end would state a position it is not at.
 */
export function tickMarks(
  ticks: readonly MeterTick[] | undefined,
  min: number,
  max: number,
  format: Format,
): TickMark[] {
  const { span } = spanOf(min, max)
  return (ticks ?? []).flatMap((t, i) =>
    Number.isFinite(t.at) && t.at >= min && t.at <= max
      ? [
          {
            key: String(i),
            pct: toPct((t.at - min) / span),
            label: t.label,
            caption: t.caption,
            text: `${t.label ?? 'Tick'} ${format(t.at)}`,
          },
        ]
      : [],
  )
}

/** A `stops` gradient's colour list, in order along the track; `at` outside `[min, max]` clamps. */
export function stopsGradient(stops: readonly MeterStop[], min: number, span: number): string {
  return stops
    .toSorted((a, b) => a.at - b.at)
    .map((s) => `${s.color} ${toPct(clamp01((s.at - min) / span))}%`)
    .join(', ')
}

const ringAngle = (pct: number) => Math.round(pct * 3.6 * 100) / 100

/** A ring's marks (target, ticks): the angle clockwise from the top, and the accessible text. */
export function ringMarks(
  target: number | undefined,
  ticks: readonly MeterTick[] | undefined,
  min: number,
  max: number,
  format: Format,
): { angle: number; text: string }[] {
  const { span } = spanOf(min, max)
  const marks = tickMarks(ticks, min, max, format).map((t) => ({
    angle: ringAngle(t.pct),
    text: t.text,
  }))
  if (target === undefined || !Number.isFinite(target) || target < min || target > max) return marks
  return [
    { angle: ringAngle(toPct((target - min) / span)), text: `Target ${format(target)}` },
    ...marks,
  ]
}

export const isReading = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n)

/** The track's span. A track that ends at or before its start falls back to 1 and is `valid: false`. */
export function spanOf(min: number, max: number): { span: number; valid: boolean } {
  return max > min ? { span: max - min, valid: true } : { span: 1, valid: false }
}

export function ariaValues(reading: number, min: number, max: number, format: Format) {
  return {
    role: 'meter',
    'aria-valuenow': Math.min(max, Math.max(min, reading)),
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuetext': format(reading),
  } as const
}

/**
 * The ONE place segment amounts are sanitised: a negative or non-finite amount is 0. The painted
 * track, the captions and `aria-valuenow` all derive from what this returns.
 */
export function normalizeSegments(segments: readonly MeterSegment[]): MeterSegment[] {
  return segments.map((s) => ({ ...s, value: Number.isFinite(s.value) ? Math.max(0, s.value) : 0 }))
}

/** Segment amounts (already normalised) accumulate from `min`; a part never passes the track end. */
export function layoutSegments(segments: readonly MeterSegment[], span: number): Part[] {
  let cursor = 0
  const isMuted = (s: MeterSegment) => s.tone === 'muted' && s.color === undefined && !s.forecast
  let prevMuted = false
  return segments.map((s) => {
    const size = Math.max(0, Math.min(clamp01(s.value / span), 1 - cursor))
    const forecast = s.forecast === true
    // A forecast stays the lighter neutral: a colour would turn the committed/forecast pair into hue.
    const part = {
      start: cursor,
      size,
      color: forecast ? undefined : isMuted(s) ? mutedFill(MUTED_PART) : s.color,
      forecast,
      seam: isMuted(s) && prevMuted,
      label: s.label,
      amount: s.value,
    }
    cursor += size
    prevMuted = isMuted(s)
    return part
  })
}

/** `from` is inclusive; a value on the last band's `to` belongs to that band. */
export function findHoldingZone(zones: readonly MeterZone[], value: number): MeterZone | undefined {
  const end = Math.max(...zones.map((z) => z.to))
  return zones.find((z) => value >= z.from && (value < z.to || (value === z.to && z.to === end)))
}

/** Sub-pixel rounding in measured boxes: two labels touching within this do not collide. */
export const LABEL_SUBPIXEL = 0.5

/** A measured label box on one axis (any shared origin), in CSS pixels. */
export type LabelBox = { left: number; right: number }

/**
 * A label on the shared row: its measured box and, for a zone name, the span it must stay inside.
 * The holding zone's name never hides for width: it ignores its span and is shifted into the row.
 */
export type RowLabel = {
  box: LabelBox
  span?: LabelBox
  holding?: boolean
  /** A tick at the track's start or end: it keeps its place over every zone name it would touch. */
  end?: boolean
  /**
   * The scale's own start figure (not a consumer tick): D38's caption order drops it before anything
   * wraps, so it never takes the second row; it hides when the first row cannot hold it.
   */
  figure?: boolean
  short?: LabelBox
}

/** The placement of the row's labels, index-aligned with the input. */
export type RowPlacement = {
  shown: boolean[]
  /** Index-aligned with `shown`: the label shows as its `short` box rather than the full one. */
  short: boolean[]
  /** Pixels a shown label moves along the row's physical x axis to stay inside it (0 unless clamped). */
  shift: number[]
  /** Index-aligned: the row a shown label stands on, 0 the first, 1 the second (staggered under it). */
  row: (0 | 1)[]
}

/**
 * Which labels of the row show, in input order. The holding zone's name claims its place first (it
 * is the reading's verdict, so it never hides for width: it may spill past its span, shifted inside
 * the row); the other ticks go next, then the end ticks (at the track's start or end: a scale's
 * figures); every other zone name then shows only when it lies inside the row and its own span and
 * clears every label already kept, trying its full name, then its `short` box, then hiding. A name
 * that does not fit its span borrows room: its neighbours (the holding name too) slide away, each
 * keeping its CENTRE inside its own span (it may overhang a span edge by up to half its width).
 * Order per name: full on row one, full on row two, `short` on row one, `short` on row two, hidden;
 * on an equal count of shown labels the full-name layout wins over the `short` one. An end
 * figure hides only when it cannot clear the holding name, an interior tick or the other end. A tick
 * keeps at least `gap` px (one gap step of the host's spacing) from every other label, and so does
 * a zone name from its neighbour. No zone name and no tick label is lost for width: one that cannot
 * hold its place on the first row stands on a second row directly under it (centred on its span or
 * mark, clamped inside the row, keeping the same gap), and only hides when neither row can hold it.
 * A hidden label is still named in the described-by text.
 */
export function placeRowLabels(
  labels: readonly RowLabel[],
  rowWidth: number,
  gap = 0,
): RowPlacement {
  // A name's order: full on row one (borrowing included), full on row two, then its `short` on row
  // one, `short` on row two, then hidden. So the full names are tried alone first and the `short`
  // fallback only runs when some label would otherwise be lost.
  const full = layOut(
    labels.map(({ short: _short, ...l }) => l),
    rowWidth,
    gap,
  )
  if (full.shown.every(Boolean) || labels.every((l) => l.short === undefined)) return full
  const withShort = layOut(labels, rowWidth, gap)
  return withShort.shown.filter(Boolean).length > full.shown.filter(Boolean).length
    ? withShort
    : full
}

function layOut(labels: readonly RowLabel[], rowWidth: number, gap: number): RowPlacement {
  const first = placeOnce(labels, rowWidth, gap, false)
  // One register: once any name falls back to its `short`, every other name that has one follows
  // (the holding name, which never shortens, is the one exception). The row is placed again with
  // those names in their `short` box, so every shift is computed against the box that renders.
  const registerShort = first.short.some(Boolean)
  const one = registerShort ? placeOnce(labels, rowWidth, gap, true) : first
  return stagger(labels, one, rowWidth, gap, registerShort)
}

/**
 * The second row: every label the first row could not hold, ticks before names, each centred on its
 * own box (a tick keeps its anchoring) and clamped inside the row like the holding name, keeping `gap`
 * px from the labels already on that row. The register follows the first row; a label that fits
 * neither row stays hidden.
 */
function stagger(
  labels: readonly RowLabel[],
  one: Omit<RowPlacement, 'row'>,
  rowWidth: number,
  gap: number,
  registerShort: boolean,
): RowPlacement {
  const row = labels.map((): 0 | 1 => 0)
  const { shown, short, shift } = one
  const kept: LabelBox[] = []
  const rank = (l: RowLabel) => (l.end ? 0 : l.span ? 2 : 1)
  const pending = labels
    .map((_, i) => i)
    .filter((i) => !shown[i] && labels[i]?.figure !== true)
    .toSorted((a, b) => rank(labels[a] as RowLabel) - rank(labels[b] as RowLabel))
  const clamped = (b: LabelBox): LabelBox => {
    const width = b.right - b.left
    const left = Math.max(0, Math.min(b.left, rowWidth - width))
    return { left, right: left + width }
  }
  const clears = (b: LabelBox) =>
    !kept.some(
      (k) => b.left < k.right + gap - LABEL_SUBPIXEL && k.left < b.right + gap - LABEL_SUBPIXEL,
    )
  for (const i of pending) {
    const label = labels[i] as RowLabel
    const useShort = registerShort && label.short !== undefined
    const candidates = useShort
      ? [label.short as LabelBox]
      : label.short !== undefined
        ? [label.box, label.short]
        : [label.box]
    for (const base of candidates) {
      const box = clamped(base)
      if (box.right - box.left > rowWidth + LABEL_SUBPIXEL || !clears(box)) continue
      kept.push(box)
      shown[i] = true
      short[i] = base !== label.box
      shift[i] = box.left - base.left
      row[i] = 1
      break
    }
  }
  return { shown, short, shift, row }
}

function placeOnce(
  labels: readonly RowLabel[],
  rowWidth: number,
  gap: number,
  registerShort: boolean,
): Omit<RowPlacement, 'row'> {
  const shown = labels.map(() => false)
  const short = labels.map(() => false)
  const shift = labels.map(() => 0)
  const kept: { box: LabelBox; tick: boolean; i: number }[] = []
  const rank = (l: RowLabel) => (l.holding ? 0 : l.span ? 3 : l.end ? 2 : 1)
  const order = labels
    .map((_, i) => i)
    .toSorted((a, b) => rank(labels[a] as RowLabel) - rank(labels[b] as RowLabel))
  // Every pair of labels keeps the gap step apart, a zone name from its neighbour as a tick does.
  const clears = (b: LabelBox) =>
    !kept.some(
      ({ box: k }) =>
        b.left < k.right + gap - LABEL_SUBPIXEL && k.left < b.right + gap - LABEL_SUBPIXEL,
    )
  for (const i of order) {
    const label = labels[i] as RowLabel
    const { span } = label
    const tick = span === undefined && !label.holding
    let box = label.box
    if (tick) {
      // A tick may sit past the row's end (a wide label hugging a mark in the near half): it is
      // shifted inside the row, as the holding name is, rather than lost.
      const width = box.right - box.left
      const left = Math.max(0, Math.min(box.left, rowWidth - width))
      shift[i] = left - box.left
      box = { left, right: left + width }
    }
    if (label.holding) {
      const width = box.right - box.left
      const left = Math.max(0, Math.min(box.left, rowWidth - width))
      shift[i] = left - box.left
      box = { left, right: left + width }
      if (!clears(box)) continue
      shown[i] = true
      kept.push({ box, tick: false, i })
      continue
    }
    const fits = (b: LabelBox) =>
      b.left >= -LABEL_SUBPIXEL &&
      b.right <= rowWidth + LABEL_SUBPIXEL &&
      (span === undefined ||
        (b.left >= span.left - LABEL_SUBPIXEL && b.right <= span.right + LABEL_SUBPIXEL)) &&
      clears(b)
    const useShort =
      label.short !== undefined && (registerShort ? true : !fits(box)) && fits(label.short)
    if (registerShort && label.short !== undefined && !useShort) continue
    if (useShort) box = label.short as LabelBox
    else if (!fits(box)) {
      shift[i] = 0
      continue
    }
    shown[i] = true
    short[i] = useShort
    kept.push({ box, tick, i })
  }
  // A name that did not fit inside its own span borrows room from the row: the zone names beside it
  // (the holding one included) slide away from it and it takes the gap. The rule is D38's: a name's
  // CENTRE stays inside its own span, so a slid name may overhang a span edge by up to half its width,
  // never past its centre. Full name first, then `short`; ticks never move.
  for (const [i, label] of labels.entries()) {
    if (label.span === undefined || label.holding || (shown[i] && !short[i])) continue
    const { span } = label
    const centre = (b: LabelBox) => (b.left + b.right) / 2
    const others = kept.filter((k) => k.i !== i)
    const movable = (k: (typeof kept)[number]) => !k.tick
    const fixed = others.filter((k) => !movable(k))
    const slidable = others.filter(movable)
    const base = registerShort && label.short ? label.short : label.box
    const mid = centre(base)
    // Only a name that sits in the row and clears every tick: a tick keeps its place over a name.
    const touches = (a: LabelBox, b: LabelBox) =>
      a.left < b.right + gap - LABEL_SUBPIXEL && b.left < a.right + gap - LABEL_SUBPIXEL
    if (
      base.left < -LABEL_SUBPIXEL ||
      base.right > rowWidth + LABEL_SUBPIXEL ||
      others.some((k) => k.tick && touches(base, k.box)) ||
      fixed.some((f) => f.box.left < mid && f.box.right > mid)
    )
      continue
    const rightOf = slidable
      .filter((k) => centre(k.box) >= mid)
      .toSorted((a, b) => b.box.left - a.box.left)
    const leftOf = slidable
      .filter((k) => centre(k.box) < mid)
      .toSorted((a, b) => a.box.left - b.box.left)
    const place = (b: LabelBox, lo: number, hi: number): LabelBox => {
      const left = Math.max(lo, Math.min(b.left, hi - (b.right - b.left)))
      return { left, right: left + (b.right - b.left) }
    }
    // Slide only the sides the name needs: none, then the right, the left, both.
    const attempt = (right: boolean, left: boolean) => {
      const slides = new Map<number, number>()
      let hi = rowWidth
      for (const k of rightOf) {
        const w = k.box.right - k.box.left
        const stop = right
          ? Math.min(
              (labels[k.i]?.span?.right ?? rowWidth) + w / 2 + LABEL_SUBPIXEL,
              hi,
              ...fixed.filter((f) => f.box.left >= k.box.left).map((f) => f.box.left - gap),
            )
          : k.box.left + w
        const at = Math.max(k.box.left, stop - w)
        slides.set(k.i, at - k.box.left)
        hi = at - gap
      }
      let lo = 0
      for (const k of leftOf) {
        const w = k.box.right - k.box.left
        const stop = left
          ? Math.max(
              (labels[k.i]?.span?.left ?? 0) - w / 2 - LABEL_SUBPIXEL,
              lo,
              ...fixed.filter((f) => f.box.right <= k.box.right).map((f) => f.box.right + gap),
            )
          : k.box.left
        const at = Math.min(k.box.left, stop)
        slides.set(k.i, at - k.box.left)
        lo = at + w + gap
      }
      // The gap this name may take: after the nearest left neighbour and fixed label, before the right.
      const gapLo = Math.max(
        lo,
        ...fixed.filter((f) => f.box.right <= mid).map((f) => f.box.right + gap),
        0,
      )
      const gapHi = Math.min(
        hi,
        ...fixed.filter((f) => f.box.left >= mid).map((f) => f.box.left - gap),
        rowWidth,
      )
      return { slides, gapLo, gapHi }
    }
    const tries = [
      attempt(false, false),
      attempt(true, false),
      attempt(false, true),
      attempt(true, true),
    ]
    const names =
      registerShort && label.short
        ? [label.short]
        : shown[i]
          ? [label.box]
          : label.short
            ? [label.box, label.short]
            : [label.box]
    for (const box of names) {
      const w = box.right - box.left
      const fit = tries.find(({ gapLo, gapHi }) => {
        if (gapHi - gapLo + LABEL_SUBPIXEL < w) return false
        const c = centre(place(box, gapLo, gapHi))
        return c >= span.left && c <= span.right
      })
      if (fit === undefined) continue
      const placed = place(box, fit.gapLo, fit.gapHi)
      for (const k of kept) {
        const by = fit.slides.get(k.i) ?? 0
        if (by === 0) continue
        k.box = { left: k.box.left + by, right: k.box.right + by }
        shift[k.i] = (shift[k.i] ?? 0) + by
      }
      const own = kept.findIndex((k) => k.i === i)
      if (own >= 0) kept.splice(own, 1)
      kept.push({ box: placed, tick: false, i })
      shift[i] = placed.left - box.left
      shown[i] = true
      short[i] = box !== label.box
      break
    }
  }
  return { shown, short, shift }
}

/** A zone band as left edge + width in percent, clipped to the track. */
export function zoneBand(zone: MeterZone, min: number, span: number) {
  const lo = clamp01((zone.from - min) / span)
  const hi = clamp01((zone.to - min) / span)
  return { start: toPct(lo), width: toPct(hi - lo) }
}

const segmentText = (s: MeterSegment, format: Format): string =>
  `${s.label} ${format(s.value)}${s.forecast === true ? ' (forecast)' : ''}`

export type BarInput = {
  reading: number
  min: number
  max: number
  format: Format
  segments?: readonly MeterSegment[] | undefined
  zones?: readonly MeterZone[] | undefined
  stops?: readonly MeterStop[] | undefined
  target?: number | undefined
  ticks?: readonly MeterTick[] | undefined
  color?: string | undefined
  forecastCaption?: string | undefined
}

export type BarModel = {
  span: number
  /** Fills, or none when the track is drawn as zones. */
  parts: readonly Part[]
  /** Percent where the first forecast part starts; absent when the forecast opens the track. */
  boundaryPct: number | undefined
  /** Where the forecast part ends (clamped to the track): the forecast caption ends here. */
  forecastEndPct: number | undefined
  forecastText: string | null
  captionMode: CaptionMode
  /** Only in `parts` mode: one caption per part, in order. Empty otherwise. */
  partCaptions: readonly PartCaption[]
  /** The `stops` gradient's colour list; absent without `stops`. */
  stopsCss: string | undefined
  /** Only on a zoned track: every zone's name, in zone order. Empty otherwise. */
  zoneLabels: readonly ZoneLabel[]
  ticks: readonly TickMark[]
  markerPct: number | undefined
  /** Percent where the committed fill ends: the reading caption's anchor. Absent on a marked track. */
  fillEndPct: number | undefined
  targetPct: number | undefined
  /** The default start caption (the zone is named on the band, so it is the bare reading); `startCaption` decides whether it shows. */
  startText: string
  endText: string | null
  describedByText: string | null
}

function endCaptionText(reading: number, target: number | undefined, format: Format) {
  if (target === undefined) return null
  if (reading > target) return `Target ${format(target)} · ${format(reading - target)} over`
  return `Target ${format(target)}`
}

function fillParts(input: BarInput, span: number, marked: boolean): Part[] {
  if (marked) return []
  if (input.segments !== undefined) return layoutSegments(input.segments, span)
  const fill = { value: input.reading - input.min, label: '' }
  return layoutSegments([input.color === undefined ? fill : { ...fill, color: input.color }], span)
}

/** Segments are amounts accumulated from `min`, so the reading is `min` plus their sum. */
export const segmentReading = (segments: readonly MeterSegment[], min: number): number =>
  segments.reduce((sum, s) => sum + s.value, min)

/** Keyed by index: segments are an ordered list, and labels are the consumer's, so they may repeat. */
function partCaptionsOf(parts: readonly Part[], format: Format): PartCaption[] {
  return parts.map((p, i) => ({
    key: String(i),
    label: p.label,
    text: format(p.amount),
    color: p.color,
    startPct: toPct(p.start),
  }))
}

/**
 * Zones win over segments (the union forbids both, a JS caller can still pass them): a zoned track
 * has no fills to caption. Empty segments are the empty state, never categorical.
 */
function captionModeOf(
  segments: readonly MeterSegment[] | undefined,
  zoned: boolean,
  firstForecast: number,
): CaptionMode {
  if (zoned) return 'reading'
  if (segments === undefined || segments.length === 0) return 'reading'
  return firstForecast < 0 ? 'parts' : 'forecast'
}

/** The start caption: the consumer's override, else the model's default — absent in `parts` mode. */
export function startCaptionText(model: BarModel, override: ReactNode | undefined): ReactNode {
  if (override !== undefined) return override
  return model.captionMode === 'parts' ? null : model.startText
}

export function modelBar(input: BarInput): BarModel {
  const { reading, min, max, format, segments, zones, target, stops } = input
  const ticks = tickMarks(input.ticks, min, max, format)
  const { span } = spanOf(min, max)
  const zoned = zones !== undefined && zones.length > 0
  const holding = zoned ? findHoldingZone(zones, reading) : undefined

  const striped = !zoned && stops !== undefined && stops.length > 0
  const parts = fillParts(input, span, zoned || striped)
  const firstForecast = parts.findIndex((p) => p.forecast)
  const forecastLabels =
    segments?.filter((s) => s.forecast === true).map((s) => `${s.label} ${format(s.value)}`) ?? []

  const captionMode = captionModeOf(segments, zoned, firstForecast)
  const partCaptions = captionMode === 'parts' ? partCaptionsOf(parts, format) : []

  const zoneText = !zoned
    ? []
    : [
        ...zones.map((z) => `${z.label} ${format(z.from)} to ${format(z.to)}`),
        holding === undefined
          ? `${format(reading)} is outside every zone`
          : `${format(reading)} is in ${holding.label}`,
      ]
  const describedBy = [
    ...(segments?.map((s) => segmentText(s, format)) ?? []),
    ...zoneText,
    ...(target === undefined ? [] : [`Target ${format(target)}`]),
    ...ticks.map((t) => t.text),
  ]

  return {
    span,
    parts,
    boundaryPct: firstForecast > 0 ? toPct(parts[firstForecast]?.start ?? 0) : undefined,
    forecastEndPct:
      firstForecast > 0
        ? toPct(
            parts.filter((p) => p.forecast).reduce((end, p) => Math.max(end, p.start + p.size), 0),
          )
        : undefined,
    forecastText:
      forecastLabels.length === 0
        ? null
        : (input.forecastCaption ?? `Forecast: ${forecastLabels.join(', ')}`),
    captionMode,
    partCaptions,
    stopsCss: striped ? stopsGradient(stops, min, span) : undefined,
    zoneLabels: !zoned
      ? []
      : zones.map((z, i) => {
          const band = zoneBand(z, min, span)
          return {
            key: String(i),
            label: z.label,
            ...(z.short !== undefined && { short: z.short }),
            centrePct: band.start + band.width / 2,
            widthPct: band.width,
            holding: z === holding,
          }
        }),
    ticks,
    markerPct: zoned || striped ? toPct((reading - min) / span) : undefined,
    fillEndPct:
      zoned || striped
        ? undefined
        : toPct(
            parts.filter((p) => !p.forecast).reduce((end, p) => Math.max(end, p.start + p.size), 0),
          ),
    targetPct: target === undefined ? undefined : toPct((target - min) / span),
    startText: format(reading),
    endText: endCaptionText(reading, target, format),
    describedByText: describedBy.length > 0 ? describedBy.join('; ') : null,
  }
}

/** The ring's one arc, as a fraction of the circumference. */
export const ringFraction = (reading: number, min: number, max: number): number =>
  clamp01((reading - min) / spanOf(min, max).span)

/**
 * One caption on the marks row: its natural width and where it is anchored (`pct`), else its edge.
 * `align` is which edge of the caption sits on the mark (default: its centre). `drop` ranks it for
 * dropping when the row is too narrow: the lowest rank goes first, none never drops.
 */
export type MarkItem = {
  width: number
  pct?: number
  edge?: 'end'
  align?: 'start' | 'center' | 'end'
  drop?: number
}

/** Where a caption starts before any caption is pushed off it: on its mark, else at its edge. */
function idealLeft(i: MarkItem, rowWidth: number): number {
  if (i.pct === undefined) return i.edge === 'end' ? rowWidth - i.width : 0
  const at = (rowWidth * i.pct) / 100
  const left = i.align === 'end' ? at - i.width : i.align === 'start' ? at : at - i.width / 2
  return Math.max(0, Math.min(left, rowWidth - i.width))
}

/**
 * Where each caption of the marks row starts (px, logical start edge), index-aligned with `items`: an
 * anchored caption is centred on its mark and clamped inside the row, the others sit at the start (or,
 * `edge: 'end'`, the end). Two captions closer than `gap` are pushed apart, in order, the least that
 * clears them, so a caption stays as near its mark as the row allows. `null` when nothing is anchored,
 * the row is unmeasured, a caption is wider than the row, or the captions cannot all clear each other
 * inside the row: the row then flows and wraps instead.
 */
export function placeMarkCaptions(
  items: readonly MarkItem[],
  rowWidth: number,
  gap: number,
): number[] | null {
  if (rowWidth <= 0 || !items.some((i) => i.pct !== undefined)) return null
  if (items.some((i) => i.width > rowWidth)) return null
  const lefts = items.map((i) => idealLeft(i, rowWidth))
  // Captions keep their order along the track: by their mark (an edge caption by its edge), not by
  // where clamping left them, so a reading near the end never ends up right of the target.
  const markAt = (i: MarkItem) => i.pct ?? (i.edge === 'end' ? 100 : 0)
  const order = lefts
    .map((_, i) => i)
    .toSorted((a, b) => markAt(items[a] as MarkItem) - markAt(items[b] as MarkItem) || a - b)
  const widthOf = (i: number) => items[i]?.width ?? 0
  for (const [n, i] of order.entries()) {
    const prev = order[n - 1]
    if (prev !== undefined)
      lefts[i] = Math.max(lefts[i] ?? 0, (lefts[prev] ?? 0) + widthOf(prev) + gap)
  }
  for (const [n, i] of order.toReversed().entries()) {
    const next = order.toReversed()[n - 1]
    const limit = next === undefined ? rowWidth : (lefts[next] ?? 0) - gap
    lefts[i] = Math.min(lefts[i] ?? 0, limit - widthOf(i))
  }
  const first = order[0]
  return first !== undefined && (lefts[first] ?? 0) < -LABEL_SUBPIXEL ? null : lefts
}

/** The furthest a droppable caption may sit from its own mark (Wave 37 r2's "not far"); past it, it drops. */
export const MAX_CAPTION_SHIFT = 24

/**
 * `placeMarkCaptions` with dropping: when the captions cannot all clear each other on one line, the
 * droppable ones go one at a time in `drop` rank order (a caption without a rank never goes) until
 * the rest fit. A droppable caption stays while it sits within `MAX_CAPTION_SHIFT` of its mark and
 * moves no undroppable caption (the reading, the target) further than those move with every droppable
 * one dropped: two undroppables that collide on their own are not a reason to drop anything.
 * `starts[i]` is the start of caption `i`, `undefined` when it dropped; `dropped[i]` marks the drop.
 * `null` when even the undroppable ones do not fit, so the row flows instead.
 */
export function placeCaptionRow(
  items: readonly MarkItem[],
  rowWidth: number,
  gap: number,
): { starts: (number | undefined)[]; dropped: boolean[] } | null {
  const fixed = items.map((_, i) => i).filter((i) => items[i]?.drop === undefined)
  const baseline = placeMarkCaptions(
    fixed.map((i) => items[i] as MarkItem),
    rowWidth,
    gap,
  )
  if (baseline === null) return null
  const allowed = new Map(
    fixed.map((i, n) => [
      i,
      Math.abs((baseline[n] ?? 0) - idealLeft(items[i] as MarkItem, rowWidth)) + LABEL_SUBPIXEL,
    ]),
  )
  const dropped = items.map(() => false)
  const order = items
    .map((item, i) => ({ rank: item.drop, i }))
    .filter((d): d is { rank: number; i: number } => d.rank !== undefined)
    .toSorted((a, b) => a.rank - b.rank)
  for (let step = 0; step <= order.length; step++) {
    const kept = items.map((_, i) => i).filter((i) => !dropped[i])
    const lefts = placeMarkCaptions(
      kept.map((i) => items[i] as MarkItem),
      rowWidth,
      gap,
    )
    const settled =
      lefts !== null &&
      (step === order.length ||
        kept.every((i, n) => {
          const item = items[i] as MarkItem
          const moved = Math.abs((lefts[n] ?? 0) - idealLeft(item, rowWidth))
          if (item.drop === undefined) return moved <= (allowed.get(i) ?? 0)
          return item.pct === undefined || moved <= MAX_CAPTION_SHIFT
        }))
    if (lefts !== null && settled) {
      const starts = items.map((): number | undefined => undefined)
      for (const [n, i] of kept.entries()) starts[i] = lefts[n]
      return { starts, dropped }
    }
    const next = order[step]
    if (next === undefined) return null
    dropped[next.i] = true
  }
  return null
}

/**
 * How many columns the categorical part captions take when they do not fit under their segments:
 * the most columns whose widest-per-column entries fit the row, with no lone entry on the last row
 * (`n % cols === 1`). All in one row when they fit; one column is always valid.
 */
export function partColumns(widths: readonly number[], rowWidth: number, gap: number): number {
  const n = widths.length
  for (let cols = n; cols > 1; cols--) {
    if (n > cols && n % cols === 1) continue
    const widest = Array.from({ length: cols }, (_, c) =>
      Math.max(0, ...widths.filter((_w, i) => i % cols === c)),
    )
    const total = widest.reduce((a, b) => a + b, 0) + gap * (cols - 1)
    if (total <= rowWidth + LABEL_SUBPIXEL) return cols
  }
  return 1
}

/**
 * Whether every categorical part's caption fits under its own segment: left-aligned at the part's
 * start and ending before the next part's start (less `gap`) or the row's end. A zero-width part never fits.
 */
export function partsFitUnder(
  parts: readonly { startPct: number; width: number }[],
  rowWidth: number,
  gap: number,
): boolean {
  if (rowWidth <= 0) return false
  return parts.every((p, i) => {
    const left = (rowWidth * p.startPct) / 100
    const next = parts[i + 1]
    const limit = next === undefined ? rowWidth : (rowWidth * next.startPct) / 100 - gap
    return left + p.width <= limit + LABEL_SUBPIXEL
  })
}
