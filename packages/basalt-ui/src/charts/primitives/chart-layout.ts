/**
 * `resolveChartLayout` — the single, pure decision point for a chart's space (`docs/waves/
 * RESPONSIVE-SPEC.md` §4): container class, height and legend fit. Also hosts the axis-economy
 * ladder (`resolveYPlacement`, `planXLabels`, `yTickCount`, `compactNumber`, …) that
 * `CartesianChart`/`useBandPlot` call directly. DOM-free and Mantine-free; deliberately not on any
 * public barrel.
 */

import { resolveContainerClass } from '../../tokens/size-classes'
import type { ContainerClass, SIZE_CLASSES } from '../../tokens/size-classes'
import { VX } from '../../tokens'
import { measureText } from '../utils/measure-text'
import type { LegendEntry } from './ChartLegend'
import { entriesWithinDotRows, entriesWithinRows, orderEntries } from './chart-frame-layout'

export type ChartLayout = {
  containerClass: ContainerClass
  height: number
  legend:
    | { mode: 'none' }
    | { mode: 'dots' | 'chips'; where: 'header' | 'band'; visible: number; overflow: number }
}

export type ChartLayoutInput = {
  /** The chart frame's MEASURED width; `<= 0` is unmeasured (SSR, first paint). */
  frameW: number
  /** Width of the card's header legend slot; `0` when there is none (the legend takes a band). */
  slotW: number
  /** Viewport height in px (`0` unknown). Only read on a coarse pointer. */
  viewportH: number
  legendItems: readonly LegendEntry[]
  /** Viewport class — decides the container class until the frame is measured. */
  sizeClass: keyof typeof SIZE_CLASSES
  coarse: boolean
  /**
   * The card's own `short` flag (`ChartCard`'s `measuredHeight < CARD_SHORT_HEIGHT`, wave 8's
   * header-fold law) — reused as the ONE source of truth for "this legend gets at most one row"
   * (wave 11, `docs/waves/PLAN.md`), rather than a second, narrower threshold. Default `false`
   * (no card, or an unmeasured/tall one).
   */
  cardShort?: boolean
  /** The legend's own `groups` config — whether role dividers render (and so count toward the
   * dots-mode fit, R2C-9). Default `false`. */
  groups?: boolean
  /** Consumer-stated values; each wins over the derived one. */
  override?: { height?: number }
}

/** Height = width × ratio, per container class. */
const HEIGHT_RATIO = { micro: 0.5, compact: 0.62, regular: 0.5, wide: 0.4 } as const
const HEIGHT_MIN = 160
const HEIGHT_MAX = 420
/** A coarse pointer never gets a chart taller than this share of the viewport. */
const COARSE_VIEWPORT_SHARE = 0.45
/** Width assumed per class before the frame is measured. */
const UNMEASURED_WIDTH = { micro: 200, compact: 360, regular: 640, wide: 960 } as const
/** A y-axis tick every ~44px of plot height. */
const TICK_SPACING = 44
const COMPACT_LABEL_CHARS = 4
/** Gap kept between two adjacent x labels. */
const X_LABEL_GAP = 8
/** A legend shares one header row; in the band it may wrap to two. */
const LEGEND_ROWS = { header: 1, band: 2 } as const

/** Before the first measurement a compact viewport implies a compact container. */
const CONTAINER_CLASS_OF_SIZE_CLASS = {
  compact: 'compact',
  medium: 'regular',
  expanded: 'wide',
} as const satisfies Record<keyof typeof SIZE_CLASSES, ContainerClass>

function containerClassFromSizeClass(sizeClass: keyof typeof SIZE_CLASSES): ContainerClass {
  return CONTAINER_CLASS_OF_SIZE_CLASS[sizeClass]
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

function resolveHeight(input: ChartLayoutInput, containerClass: ContainerClass): number {
  const override = input.override?.height
  const width = input.frameW > 0 ? input.frameW : UNMEASURED_WIDTH[containerClass]
  const derived =
    override ?? clamp(Math.round(width * HEIGHT_RATIO[containerClass]), HEIGHT_MIN, HEIGHT_MAX)
  if (!input.coarse || input.viewportH <= 0) return derived
  // A viewport safety cap, not a design choice — a literal `height` used to skip it entirely, so a
  // consumer's fixed-height chart could still overflow a short landscape-phone viewport (R2C-12).
  return Math.min(derived, Math.round(input.viewportH * COARSE_VIEWPORT_SHARE))
}

/** A legend never rolls up fewer than 2 entries: "+1 more" hides nothing a chip would not show. */
function rollUp(total: number, fitted: number): { visible: number; overflow: number } {
  const visible = total - fitted < 2 ? total : fitted
  return { visible, overflow: total - visible }
}

function resolveLegend(
  input: ChartLayoutInput,
  containerClass: ContainerClass,
): ChartLayout['legend'] {
  const total = input.legendItems.length
  if (containerClass === 'micro' || total === 0) return { mode: 'none' }
  const where = input.slotW > 0 ? 'header' : 'band'
  const width = where === 'header' ? input.slotW : input.frameW
  // Unmeasured (first paint, before P2-8's synchronous slot seed lands): assume everything fits
  // rather than guessing a fold nothing has measured yet.
  if (width <= 0) return { mode: 'chips', where, visible: total, overflow: 0 }

  const { entries: ordered, dividerAfter } = orderEntries(input.legendItems, input.groups === true)
  const chipFit = entriesWithinRows(ordered, width, LEGEND_ROWS[where])
  const allChipsFit = chipFit >= total

  // The law (R2C-8, `docs/waves/PLAN.md` wave 3): chips whenever every entry fits one header row —
  // a compact/short header with ROOM stays labelled. Dots is a header-only FALLBACK for when chips
  // do not fit, and only while the card is short or the container itself is compact
  // (RESPONSIVE-SPEC.md §1/§4). A band legend (no header slot) always stays 'chips': a compact-width
  // chart with nowhere to portal its legend never had a designed dots form.
  const wantsDots =
    where === 'header' && !allChipsFit && (input.cardShort === true || containerClass === 'compact')

  if (!wantsDots) {
    const { visible, overflow } = rollUp(total, Math.max(1, chipFit))
    return { mode: 'chips', where, visible, overflow }
  }
  const dotFit = entriesWithinDotRows(ordered, width, LEGEND_ROWS[where], dividerAfter)
  const { visible, overflow } = rollUp(total, Math.max(1, dotFit))
  return { mode: 'dots', where, visible, overflow }
}

/** Compact and micro plots are tight: y labels move inside and terminal x labels anchor inward. */
export function isTightClass(containerClass: ContainerClass): boolean {
  return containerClass === 'compact' || containerClass === 'micro'
}

/**
 * Ladder step 5: at a tight container class the y labels move inside the plot (micro: no y axis
 * at all), so the left gutter drops to its floor. Not-tight, no left axis to place, or an explicit
 * `margin.left` (the consumer laid out an outside gutter themselves) all keep the axis outside —
 * the single implementation `CartesianChart`/`useBandPlot` both call, replacing three independent
 * copies of the same ladder (`docs/waves/PLAN.md` wave 8).
 */
export function resolveYPlacement(
  containerClass: ContainerClass,
  opts: { hasLeftAxis?: boolean | undefined; marginOverrideLeft?: number | undefined } = {},
): 'outside' | 'inside' | 'none' {
  const { hasLeftAxis = true, marginOverrideLeft } = opts
  if (!isTightClass(containerClass) || !hasLeftAxis || marginOverrideLeft !== undefined)
    return 'outside'
  return containerClass === 'micro' ? 'none' : 'inside'
}

/**
 * Left-margin floor once `resolveYPlacement` moves the labels INSIDE the plot: just enough for the
 * axis line and a hair of breathing room, not the outside axis's full label-width floor. Passing
 * the tier's own `margin.left` as the floor here (the pre-wave-4 bug) reserved a gutter for a label
 * that no longer paints there.
 */
export const INSIDE_Y_FLOOR = 4

const COMPACT_UNITS = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
] as const

const roundTenth = (value: number): number => Math.round(value * 10) / 10

/**
 * Ladder step 1: `12500` -> `12.5k`, `1_200_000` -> `1.2M`; `null` below 1000 or non-finite. Rounds
 * BEFORE choosing the unit's suffix, so `999_950` reads `1M`, never `1000k`; the largest unit caps.
 */
export function compactNumber(value: number): string | null {
  const abs = Math.abs(value)
  if (!Number.isFinite(value) || abs < 1000) return null
  let index = COMPACT_UNITS.findIndex(([unit]) => abs >= unit)
  let scaled = roundTenth(abs / COMPACT_UNITS[index]![0])
  if (scaled >= 1000 && index > 0) {
    index -= 1
    scaled = roundTenth(abs / COMPACT_UNITS[index]![0])
  }
  return `${value < 0 ? '-' : ''}${scaled}${COMPACT_UNITS[index]![1]}`
}

/** Ladder step 1's rule: compact only when the longest y label is over 4 chars. */
export function shouldCompactYLabels(labels: readonly string[]): boolean {
  return labels.some((label) => label.length > COMPACT_LABEL_CHARS)
}

/** Ladder step 2 + the `VX.minPlotHeight` guard: one tick per ~44px, 2 when the plot is under the floor. */
export function yTickCount(plotHeight: number): number {
  if (plotHeight < VX.minPlotHeight) return 2
  return clamp(Math.round(plotHeight / TICK_SPACING), 2, 6)
}

/** Greedy word wrap by measured px; a single word wider than `maxPx` keeps its own line. */
export function wrapLabel(label: string, maxPx: number, fontPx: number): string[] {
  const words = label.split(/\s+/).filter((word) => word !== '')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (current !== '' && measureText(candidate, fontPx) > maxPx) {
      lines.push(current)
      current = word
      continue
    }
    current = candidate
  }
  if (current !== '') lines.push(current)
  return lines.length > 0 ? lines : [label]
}

export type XLabelPlan = {
  wrap: boolean
  rotate: 0 | 45
  thinTo: number
  /** Lines the tallest label takes once wrapped (1 when it does not). */
  lines: number
  /** Px one tick label needs: measured width (wrapped width when wrapping) plus the gap. */
  labelPx: number
  /** Width labels wrap to; `0` when they do not wrap. */
  wrapPx: number
}

/**
 * Ladder step 4: x labels that do not all fit side by side wrap — categorical (band) domains
 * only, and only when wrapping shows EVERY key. A wrap that would still drop keys buys nothing
 * (it costs a line of bottom gutter to thin the same way flat already would), so it falls back to
 * flat/thinned instead. Rotating is the last resort, reached only once even a full wrap can't fit.
 */
export function planXLabels(input: {
  labels: readonly string[]
  plotWidth: number
  fontPx: number
  categorical: boolean
}): XLabelPlan {
  const { labels, plotWidth, fontPx, categorical } = input
  const count = labels.length
  const widest = labels.reduce((max, label) => Math.max(max, measureText(label, fontPx)), 0)
  const flatPx = widest + X_LABEL_GAP
  const fit = plotWidth > 0 && widest > 0 ? Math.floor(plotWidth / flatPx) : count
  const flat = {
    wrap: false,
    rotate: 0,
    thinTo: clamp(fit, 2, Math.max(count, 2)),
    lines: 1,
    labelPx: flatPx,
    wrapPx: 0,
  } as const satisfies XLabelPlan
  if (!categorical || count <= fit || plotWidth <= 0) return flat

  const widestWord = labels.reduce(
    (max, label) => Math.max(max, ...label.split(/\s+/).map((word) => measureText(word, fontPx))),
    0,
  )
  const wrapPx = Math.min(widest, Math.max(widestWord, Math.floor(plotWidth / count) - X_LABEL_GAP))
  const wrapped = labels.map((label) => wrapLabel(label, wrapPx, fontPx))
  const lines = wrapped.reduce((max, parts) => Math.max(max, parts.length), 1)
  if (lines === 1) {
    // Nothing to wrap (single words): rotating is the only remaining answer.
    return count > 2 * Math.max(fit, 1) ? { ...flat, rotate: 45 } : flat
  }
  const wrappedWidest = wrapped.reduce(
    (max, parts) => Math.max(max, ...parts.map((part) => measureText(part, fontPx))),
    0,
  )
  const wrappedFit = Math.max(Math.floor(plotWidth / (wrappedWidest + X_LABEL_GAP)), 1)
  if (wrappedFit >= count) {
    return {
      wrap: true,
      rotate: 0,
      thinTo: count,
      lines,
      labelPx: wrappedWidest + X_LABEL_GAP,
      wrapPx,
    }
  }
  return count > 2 * wrappedFit ? { ...flat, rotate: 45 } : flat
}

/** The container class: the measured width's, or the viewport-implied one while unmeasured. */
export function resolveFrameClass(input: {
  frameW: number
  sizeClass: keyof typeof SIZE_CLASSES
}): ContainerClass {
  return input.frameW > 0
    ? resolveContainerClass(input.frameW)
    : containerClassFromSizeClass(input.sizeClass)
}

export function resolveChartLayout(input: ChartLayoutInput): ChartLayout {
  const containerClass = resolveFrameClass(input)
  return {
    containerClass,
    height: resolveHeight(input, containerClass),
    legend: resolveLegend(input, containerClass),
  }
}
