/**
 * Meter's pure model: everything the component shows, computed from numbers (no DOM, no React runtime).
 * Internal — `meter.tsx` and `meter-parts.tsx` render what this returns.
 */
import type { ReactNode } from 'react'
import { clamp01, toPct } from './scale'

export type MeterSegment = { value: number; label: string; color?: string; forecast?: boolean }
export type MeterZone = { from: number; to: number; label: string; color?: string }
/** A mark on the track at `at` (in the reading's units). A label is captioned beside it. */
export type MeterTick = { at: number; label?: string }

/** One tick on the track: its percent position and what it says (caption `label`, aria `text`). */
export type TickMark = { key: string; pct: number; label: string | undefined; text: string }

/** A fill on the track, as fractions (0–1) of the span, with the segment it was laid out from. */
export type Part = {
  readonly start: number
  readonly size: number
  readonly color: string | undefined
  readonly forecast: boolean
  readonly label: string
  /** The segment's own (normalised) amount, in the reading's units — what its caption states. */
  readonly amount: number
}

/** One categorical part's caption: its position key, name, formatted amount and fill colour (`undefined` = neutral). */
export type PartCaption = { key: string; label: string; text: string; color: string | undefined }

/** One zone's name on the label row: its span's centre and width (percent) and whether it holds the reading. */
export type ZoneLabel = {
  key: string
  label: string
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
            text: `${t.label ?? 'Tick'} ${format(t.at)}`,
          },
        ]
      : [],
  )
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
  return segments.map((s) => {
    const size = Math.max(0, Math.min(clamp01(s.value / span), 1 - cursor))
    const forecast = s.forecast === true
    // A forecast stays the lighter neutral: a colour would turn the committed/forecast pair into hue.
    const part = {
      start: cursor,
      size,
      color: forecast ? undefined : s.color,
      forecast,
      label: s.label,
      amount: s.value,
    }
    cursor += size
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
export type RowLabel = { box: LabelBox; span?: LabelBox; holding?: boolean }

/** The placement of the row's labels, index-aligned with the input. */
export type RowPlacement = {
  shown: boolean[]
  /** Pixels a shown label moves along the row's physical x axis to stay inside it (0 unless clamped). */
  shift: number[]
}

/**
 * Which labels of the row show, in input order. The holding zone's name claims its place first (it
 * is the reading's verdict, so it never hides for width: it may spill past its span, shifted inside
 * the row); the labels without a span (the end ticks) go next; every other zone name then shows only
 * when it lies inside the row and its own span and clears every label already kept. A hidden name is
 * still named in the described-by text.
 */
export function placeRowLabels(labels: readonly RowLabel[], rowWidth: number): RowPlacement {
  const shown = labels.map(() => false)
  const shift = labels.map(() => 0)
  const kept: LabelBox[] = []
  const rank = (l: RowLabel) => (l.holding ? 0 : l.span ? 2 : 1)
  const order = labels
    .map((_, i) => i)
    .toSorted((a, b) => rank(labels[a] as RowLabel) - rank(labels[b] as RowLabel))
  for (const i of order) {
    const label = labels[i] as RowLabel
    const { span } = label
    let box = label.box
    if (label.holding) {
      const width = box.right - box.left
      const left = Math.max(0, Math.min(box.left, rowWidth - width))
      shift[i] = left - box.left
      box = { left, right: left + width }
    } else {
      const inside =
        box.left >= -LABEL_SUBPIXEL &&
        box.right <= rowWidth + LABEL_SUBPIXEL &&
        (span === undefined ||
          (box.left >= span.left - LABEL_SUBPIXEL && box.right <= span.right + LABEL_SUBPIXEL))
      if (!inside) continue
    }
    if (
      kept.some((k) => box.left < k.right - LABEL_SUBPIXEL && k.left < box.right - LABEL_SUBPIXEL)
    )
      continue
    shown[i] = true
    kept.push(box)
  }
  return { shown, shift }
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
  forecastText: string | null
  captionMode: CaptionMode
  /** Only in `parts` mode: one caption per part, in order. Empty otherwise. */
  partCaptions: readonly PartCaption[]
  /** Only on a zoned track: every zone's name, in zone order. Empty otherwise. */
  zoneLabels: readonly ZoneLabel[]
  ticks: readonly TickMark[]
  markerPct: number | undefined
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

function fillParts(input: BarInput, span: number, zoned: boolean): Part[] {
  if (zoned) return []
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
  const { reading, min, max, format, segments, zones, target } = input
  const ticks = tickMarks(input.ticks, min, max, format)
  const { span } = spanOf(min, max)
  const zoned = zones !== undefined && zones.length > 0
  const holding = zoned ? findHoldingZone(zones, reading) : undefined

  const parts = fillParts(input, span, zoned)
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
    forecastText:
      forecastLabels.length === 0
        ? null
        : (input.forecastCaption ?? `Forecast: ${forecastLabels.join(', ')}`),
    captionMode,
    partCaptions,
    zoneLabels: !zoned
      ? []
      : zones.map((z, i) => {
          const band = zoneBand(z, min, span)
          return {
            key: String(i),
            label: z.label,
            centrePct: band.start + band.width / 2,
            widthPct: band.width,
            holding: z === holding,
          }
        }),
    ticks,
    markerPct: zoned ? toPct((reading - min) / span) : undefined,
    targetPct: target === undefined ? undefined : toPct((target - min) / span),
    startText: format(reading),
    endText: endCaptionText(reading, target, format),
    describedByText: describedBy.length > 0 ? describedBy.join('; ') : null,
  }
}

/** The ring's one arc, as a fraction of the circumference. */
export const ringFraction = (reading: number, min: number, max: number): number =>
  clamp01((reading - min) / spanOf(min, max).span)
