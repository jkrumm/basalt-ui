/**
 * Header priority tiers as data (concept section 1 row "Header"; spike S6 in
 * `docs/v3/spikes/shell-frame.md`). The header part writes these thresholds as CSS container tiers
 * on the header; this module is the single source of the numbers and the model the tests and the
 * kebab read.
 *
 * `priority` 1 never yields, 2 yields below 860 px of header content width, 3 below 1040. The
 * header content width is the header row's own width minus its 12 px inline padding: the row is
 * the frame's top row beside the brand zone, so it is the window less the rail, and a collapsed
 * rail gives the row room. The numbers are spike S6's 1100 and 1280 of window less the
 * expanded rail's 240, so the room each tier was measured with is the room it still gets. Under
 * `native-overlay` the header is the window's title bar and its row holds the brand zone too, so
 * there each threshold is 240 px more of row (`HEADER_TITLEBAR_BRAND_PX`), the spike's own numbers. A yielded item is listed in the ONE kebab, in
 * declaration order, so nothing is ever lost. Labels are long at the `expanded` size class and
 * short below it (`box.sizeClass` carries the same axis to a `custom` item).
 *
 * Measured by S6 with shutterflow's cluster at 1024, 1200 and 1440, rail expanded and collapsed:
 * no wrap, nothing lost. The 161 px breadcrumb at window 1300 is the number to watch when a
 * consumer adds an item.
 */
import type { SizeClass } from '../contract'

export type HeaderPriority = 1 | 2 | 3

/** Inline padding of the header row, subtracted from the row's width. */
export const HEADER_INLINE_PADDING = 12

/** Minimum header content width at which each priority is shown in the row. */
export const HEADER_TIER_MIN_WIDTH: Readonly<Record<HeaderPriority, number>> = {
  1: 0,
  2: 860,
  3: 1040,
}

/** The brand zone a native title bar's row holds besides the actions: the expanded rail's width. */
export const HEADER_TITLEBAR_BRAND_PX = 240

/** An item's declared `priority` as a tier: missing is 1, out of range clamps to 1 or 3. */
export function headerPriority(priority: number | undefined): HeaderPriority {
  if (priority === undefined || !Number.isFinite(priority) || priority <= 1) return 1
  if (priority >= 3) return 3
  return Math.round(priority) as HeaderPriority
}

export function headerContentWidth(rowWidth: number): number {
  return Math.max(0, rowWidth - HEADER_INLINE_PADDING)
}

/** Whether a priority is shown in the row at a header content width. */
export function isTierShown(priority: HeaderPriority, contentWidth: number): boolean {
  return contentWidth >= HEADER_TIER_MIN_WIDTH[priority]
}

export type HeaderTierItem = { readonly id: string; readonly priority?: number }

export type HeaderTiers = {
  /** Ids shown in the row, declaration order. */
  readonly shown: readonly string[]
  /** Ids yielded to the kebab, declaration order. Empty means no item needs the kebab. */
  readonly kebab: readonly string[]
  readonly labels: 'long' | 'short'
}

export function projectHeaderTiers(
  items: readonly HeaderTierItem[],
  at: { rowWidth: number; sizeClass: SizeClass },
): HeaderTiers {
  const width = headerContentWidth(at.rowWidth)
  const shown: string[] = []
  const kebab: string[] = []
  for (const item of items) {
    if (isTierShown(headerPriority(item.priority), width)) shown.push(item.id)
    else kebab.push(item.id)
  }
  return { shown, kebab, labels: at.sizeClass === 'expanded' ? 'long' : 'short' }
}
