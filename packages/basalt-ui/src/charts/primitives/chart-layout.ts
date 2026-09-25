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
  xAxis: { anchorTerminals: true; wrap: boolean; rotate: 0 | 45; thinTo: number }
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
function containerClassFromSizeClass(sizeClass: keyof typeof SIZE_CLASSES): ContainerClass {
  if (sizeClass === 'compact') return 'compact'
  return sizeClass === 'medium' ? 'regular' : 'wide'
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
  return {
    mode: containerClass === 'compact' ? 'dots' : 'chips',
    where,
    visible,
    overflow: total - visible,
  }
}

function resolveYAxis(
  input: ChartLayoutInput,
  containerClass: ContainerClass,
  height: number,
): ChartLayout['yAxis'] {
  const longest = input.yLabels.reduce((max, label) => Math.max(max, label.length), 0)
  return {
    mode: containerClass === 'micro' ? 'none' : containerClass === 'compact' ? 'inside' : 'outside',
    ticks: clamp(Math.round(height / TICK_SPACING), 2, 6),
    compact: containerClass !== 'wide' || longest > COMPACT_LABEL_CHARS,
  }
}

function resolveXAxis(
  input: ChartLayoutInput,
  containerClass: ContainerClass,
): ChartLayout['xAxis'] {
  const count = input.xLabels.length
  const widest = input.xLabels.reduce(
    (max, label) => Math.max(max, measureText(label, VX.axisFont)),
    0,
  )
  const fit =
    input.frameW > 0 && widest > 0 ? Math.floor(input.frameW / (widest + X_LABEL_GAP)) : count
  return {
    anchorTerminals: true,
    wrap: input.categorical,
    // Categorical labels wrap first; they rotate only when there are over twice as many as fit.
    rotate: input.categorical && count > 2 * Math.max(fit, 1) ? 45 : 0,
    thinTo: containerClass === 'micro' ? 2 : clamp(fit, 2, Math.max(count, 2)),
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
    yAxis: resolveYAxis(input, containerClass, height),
    xAxis: resolveXAxis(input, containerClass),
  }
}
