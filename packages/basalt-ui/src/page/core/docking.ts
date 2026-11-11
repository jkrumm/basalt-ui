/**
 * Aside docking: the pure decision the shell sizes its aside region from (docs/v3/concepts/
 * shell-nav-router.md sections 3.5 and 4, invariants 10, 11). Headless: no React, no DOM.
 *
 * `PageAside dock` is `'auto'` (default) or `'always'`:
 * - `'auto'` docks an open aside, pushing main, only in `expanded` while main keeps
 *   `MAIN_MIN_WIDTH` beside the rail; otherwise an open panel overlays main and the region reserves
 *   just its rail.
 * - `'always'` is for canvas apps: it docks at `medium` and `expanded` whatever the room (spike S8
 *   measured 516 px of main at window 900 with the rail collapsed). `compact` never docks.
 *
 * Unclaimed, the region is zero-wide, with no ghost seam.
 */
import { SIZE_CLASSES, toEm } from '../../tokens/size-classes'

export type DockSizeClass = keyof typeof SIZE_CLASSES

export type AsideDock = 'always' | 'auto'

/**
 * Main keeps at least this much width, or an `'auto'` aside overlays it instead of docking. Not
 * derived from a token: it is the readable floor for a page body, independent of density.
 */
export const MAIN_MIN_WIDTH = 720

export type AsideDockingInput = {
  claimed: boolean
  folded: boolean
  sizeClass: DockSizeClass
  /** The `asideDockQuery` media query's result. Only `'auto'` reads it. */
  roomToDock: boolean
  asideWidth: number
  asideRailWidth: number
  /** Default `'auto'`. */
  dock?: AsideDock
}

export type AsideDocking = {
  /** An open aside pushes main rather than overlaying it. */
  docks: boolean
  /** An open aside renders over main (reserving only its rail). */
  overlay: boolean
  /** The width the shell reserves for the region. */
  width: number
}

/** The `min-width` query that holds while rail + open aside + `MAIN_MIN_WIDTH` fit side by side. */
export function asideDockQuery(input: { navbarWidth: number; asideWidth: number }): string {
  return `(min-width: ${toEm(input.navbarWidth + input.asideWidth + MAIN_MIN_WIDTH)})`
}

/**
 * The room-to-dock query's SSR/no-`matchMedia` fallback: an `'expanded'` size-class hint means the
 * server already believes there is room, so the first client paint does not fold a default-open
 * aside for one commit.
 */
export function roomToDockServerFallback(sizeClassHint: DockSizeClass | undefined): boolean {
  return sizeClassHint === 'expanded'
}

function canDock(input: AsideDockingInput): boolean {
  if (input.dock === 'always') return input.sizeClass !== 'compact'
  return input.sizeClass === 'expanded' && input.roomToDock
}

export function resolveAsideDocking(input: AsideDockingInput): AsideDocking {
  const docks = canDock(input)
  const open = input.claimed && !input.folded
  const reserved = open && docks ? input.asideWidth : input.asideRailWidth
  return { docks, overlay: open && !docks, width: input.claimed ? reserved : 0 }
}
