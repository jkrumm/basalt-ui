/**
 * Aside docking (`docs/DESIGN-CORE.md` § Layout, elevation, shapes) — the pure decision `ShellFrame`
 * sizes `AppShell.Aside` from. An open aside pushes main only in `expanded` while main keeps
 * `MAIN_MIN_WIDTH` beside the navbar; otherwise the region reserves just its rail and an open panel
 * overlays main. Unclaimed, the region is zero-wide.
 */
import { toEm } from '../tokens/size-classes'
import type { SizeClass } from './use-size-class'

/**
 * Main keeps at least this much width, or an open aside overlays it instead of docking. Not
 * derived from a token: it is the readable floor for a page body, independent of density.
 */
const MAIN_MIN_WIDTH = 720

export type AsideDockingInput = {
  claimed: boolean
  folded: boolean
  sizeClass: SizeClass
  /** The `asideDockQuery` media query's result. */
  roomToDock: boolean
  asideWidth: number
  asideRailWidth: number
}

export type AsideDocking = {
  /** An open aside pushes main rather than overlaying it. */
  docks: boolean
  /** An open aside renders over main (reserving only its rail). */
  overlay: boolean
  /** The width `AppShell` reserves for the region. */
  width: number
}

/** The `min-width` query that holds while navbar + open aside + `MAIN_MIN_WIDTH` fit side by side. */
export function asideDockQuery(input: { navbarWidth: number; asideWidth: number }): string {
  return `(min-width: ${toEm(input.navbarWidth + input.asideWidth + MAIN_MIN_WIDTH)})`
}

/**
 * The room-to-dock query's SSR/no-`matchMedia` fallback — an `'expanded'` `sizeClassHint` means the
 * server already believes there is room, matching `useSizeClass`'s own hint-seeded guard
 * (`use-size-class.ts`), so the first client paint doesn't fold a default-open aside for one commit.
 */
export function roomToDockServerFallback(sizeClassHint: SizeClass | undefined): boolean {
  return sizeClassHint === 'expanded'
}

export function resolveAsideDocking(input: AsideDockingInput): AsideDocking {
  const docks = input.sizeClass === 'expanded' && input.roomToDock
  const open = input.claimed && !input.folded
  const reserved = open && docks ? input.asideWidth : input.asideRailWidth
  return { docks, overlay: open && !docks, width: input.claimed ? reserved : 0 }
}
