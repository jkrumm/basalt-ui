/**
 * `resolveChartLayout` — the single, pure decision point for a chart's space (`docs/waves/
 * RESPONSIVE-SPEC.md` §4): container class, height and legend fit, plus the axis economy the next
 * step consumes. DOM-free and Mantine-free; deliberately not on any public barrel.
 */

import { resolveContainerClass } from '../../tokens/size-classes'
import type { ContainerClass, SIZE_CLASSES } from '../../tokens/size-classes'
import { VX } from '../../tokens'
import { measureText } from '../utils/measure-text'
import type { LegendEntry } from './ChartLegend'
import { entriesWithinRows } from './chart-frame-layout'

export type ChartLayout = {
  containerClass: ContainerClass
  height: number
  legend:
    | { mode: 'none' }
    | { mode: 'dots' | 'chips'; where: 'header' | 'band'; visible: number; overflow: number }
    | { mode: 'side'; width: number }
  yAxis: { mode: 'outside' | 'inside' | 'none'; ticks: number; compact: boolean }
  xAxis: {
    /** First label anchored `start`, last `end` — only where the plot is tight (micro/compact). */
    anchorTerminals: boolean
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
}

export type ChartLayoutInput = {
  /** The chart frame's MEASURED width; `<= 0` is unmeasured (SSR, first paint). */
  frameW: number
  /** Width of the card's header legend slot; `0` when there is none (the legend takes a band). */
  slotW: number
  /** Viewport height in px (`0` unknown). Only read on a coarse pointer. */
  viewportH: number
  legendItems: readonly LegendEntry[]
  yLabels: readonly string[]
  xLabels: readonly string[]
  categorical: boolean
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
  if (override !== undefined) return override
  const width = input.frameW > 0 ? input.frameW : UNMEASURED_WIDTH[containerClass]
  const derived = clamp(Math.round(width * HEIGHT_RATIO[containerClass]), HEIGHT_MIN, HEIGHT_MAX)
  if (!input.coarse || input.viewportH <= 0) return derived
  return Math.min(derived, Math.round(input.viewportH * COARSE_VIEWPORT_SHARE))
}

function resolveLegend(
  input: ChartLayoutInput,
  containerClass: ContainerClass,
): ChartLayout['legend'] {
  const total = input.legendItems.length
  if (containerClass === 'micro' || total === 0) return { mode: 'none' }
  const where = input.slotW > 0 ? 'header' : 'band'
  const width = where === 'header' ? input.slotW : input.frameW
  const fitted =
    width > 0 ? Math.max(1, entriesWithinRows(input.legendItems, width, LEGEND_ROWS[where])) : total
  // A legend never rolls up fewer than 2 entries: "+1 more" hides nothing a chip would not show.
  const visible = total - fitted < 2 ? total : fitted
  // Dots is a HEADER-ONLY fold (RESPONSIVE-SPEC.md §1's container table: "compact: … legend in
  // header (dots)" — every row names the header, never the band). A short card (wave 11, PLAN.md
  // "the legend gets at most one row and folds to dots… before it takes plot height") forces the
  // same fold regardless of container class, on the same header-only condition — only the RENDER
  // MODE changes, not `LEGEND_ROWS.header` or the fit/overflow math above. A band legend (no
  // header slot) always stays 'chips': a compact-width chart with nowhere to portal its legend
  // never had a designed dots form, before or after wave 11.
  const mode =
    where === 'header' && (input.cardShort === true || containerClass === 'compact')
      ? 'dots'
      : 'chips'
  return {
    mode,
    where,
    visible,
    overflow: total - visible,
  }
}

/** Compact and micro plots are tight: y labels move inside and terminal x labels anchor inward. */
export function isTightClass(containerClass: ContainerClass): boolean {
  return containerClass === 'compact' || containerClass === 'micro'
}

/**
 * Ladder step 5: at a tight container class the y labels move inside the plot (micro: no y axis
 * at all), so the left gutter drops to its floor. Not-tight, no left axis to place, or an explicit
 * `margin.left` (the consumer laid out an outside gutter themselves) all keep the axis outside —
 * the single implementation `CartesianChart`/`useBandPlot`/`resolveAxisEconomy` all call, replacing
 * three independent copies of the same ladder (`docs/waves/PLAN.md` wave 8).
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

export type XLabelPlan = Pick<
  ChartLayout['xAxis'],
  'wrap' | 'rotate' | 'thinTo' | 'lines' | 'labelPx' | 'wrapPx'
>

/**
 * Ladder step 4: x labels that do not all fit side by side wrap (categorical only) before they
 * rotate; they rotate only when there are more than twice as many keys as fit even wrapped.
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
  if (count > 2 * wrappedFit) return { ...flat, rotate: 45 }
  return {
    wrap: true,
    rotate: 0,
    thinTo: clamp(wrappedFit, 2, Math.max(count, 2)),
    lines,
    labelPx: wrappedWidest + X_LABEL_GAP,
    wrapPx,
  }
}

export type AxisEconomyInput = {
  containerClass: ContainerClass
  /** Plot height in px (an estimate is fine before margins are known). */
  plotHeight: number
  /** Plot width in px; `0` unknown. */
  plotWidth: number
  yLabels: readonly string[]
  xLabels: readonly string[]
  categorical: boolean
  /** Tick font the labels are measured at. */
  fontPx?: number
}

/** The axis half of the layout, from the labels that will actually be painted. */
export function resolveAxisEconomy(input: AxisEconomyInput): Pick<ChartLayout, 'yAxis' | 'xAxis'> {
  const { containerClass } = input
  const plan = planXLabels({
    labels: input.xLabels,
    plotWidth: input.plotWidth,
    fontPx: input.fontPx ?? VX.axisFont,
    categorical: input.categorical,
  })
  return {
    yAxis: {
      mode: resolveYPlacement(containerClass),
      ticks: yTickCount(input.plotHeight),
      compact: shouldCompactYLabels(input.yLabels),
    },
    xAxis: {
      anchorTerminals: isTightClass(containerClass),
      ...plan,
      thinTo: containerClass === 'micro' ? 2 : plan.thinTo,
    },
  }
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
  const height = resolveHeight(input, containerClass)
  return {
    containerClass,
    height,
    legend: resolveLegend(input, containerClass),
    ...resolveAxisEconomy({
      containerClass,
      plotHeight: height - VX.margin.top - VX.margin.bottom,
      plotWidth: input.frameW - VX.margin.left - VX.margin.right,
      yLabels: input.yLabels,
      xLabels: input.xLabels,
      categorical: input.categorical,
    }),
  }
}
