/**
 * The sidebar-block law — every default a `SidebarBlock` leaves unstated, plus the two persisted
 * fold-key grammars.
 *
 * PURE BY CONTRACT, for the same reason `mobile-nav-model.ts` is: three consumers read these
 * defaults and none of them may disagree. `app-sidebar.tsx` decides where a block renders and
 * whether the rail keeps it, `sidebar-blocks.tsx` paints it, and `mobile-nav-model.ts` counts the
 * More-sheet rows it will produce — a count that picks `menu` vs `sheet` before any of it renders.
 * A default re-derived per call site is how the count and the renderer drift apart (see
 * `accountRowCount`'s doc for the same failure with account rows).
 */
import type { SidebarBlock } from './nav-types'

/** Envelope version for a persisted fold flag. Bump only if the value stops being a boolean. */
export const FOLD_VERSION = 1

/**
 * `'nav'` renders after the nav sections inside the scroll region; `'bottom'` pins above the
 * settings footer. A progress block is `'bottom'` — it is a pinned status row, not a nav tail.
 */
export function sidebarBlockPlacement(block: SidebarBlock): 'nav' | 'bottom' {
  if (block.kind === 'progress') return block.placement ?? 'bottom'
  return block.placement ?? 'nav'
}

/**
 * The collapsed-rail projection. A list block earns a dot only when it carries a `count` — a rail
 * icon with no number behind it is a dot that means nothing — and a progress block a ring on the
 * settings row. A `custom` block has no rail representation at all (arbitrary content in ~48px of
 * icon column), which is exactly what `sidebarNavExtra` did before it.
 */
export function sidebarBlockRail(block: SidebarBlock): 'dot' | 'ring' | 'hidden' {
  if (block.kind === 'custom') return 'hidden'
  if (block.kind === 'progress') return block.rail ?? 'ring'
  // A dot has to sit ON something. With no `icon` there is no rail node to badge, and with no
  // `count` there is no number behind the dot — either way the block leaves the rail rather than
  // occupying ~48px of icon column with a label the rail has already hidden. This overrides an
  // explicit `rail: 'dot'` too: that combination is a config mistake, not a shape to render blank.
  if (block.icon === undefined || block.count === undefined) return 'hidden'
  return block.rail ?? 'dot'
}

/**
 * The mobile projection. A list is reachable from More by default — below `sm` the sidebar does
 * not render at all, so a hidden list is unreachable, not merely unshown. A progress row defaults
 * to `'hidden'`: it is ambient status, and every More row costs headroom the menu-vs-sheet
 * threshold is measured against.
 */
export function sidebarBlockMobile(block: SidebarBlock): 'more' | 'hidden' {
  if (block.kind === 'custom') return 'hidden'
  if (block.kind === 'progress') return block.mobile ?? 'hidden'
  return block.mobile ?? 'more'
}

/** Rows a list block paints, honouring `max` — the "Show more" toggle reveals the remainder. */
export function sidebarBlockVisibleCount(itemCount: number, max: number | undefined): number {
  if (max === undefined || max >= itemCount) return itemCount
  return Math.max(0, max)
}

/**
 * A section label as a storage-key segment. Lowercase, every run of non-alphanumerics collapsed to
 * one `-`, no leading/trailing separator — `'Awaiting action'` → `'awaiting-action'`.
 */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * `createPersistedState` namespaces every key as `basalt:<key>`, so these return the UNNAMESPACED
 * halves — the real storage keys are `basalt:sidebar-block:<key>` and
 * `basalt:sidebar-section:<label-slug>` (`docs/CONTROLS-SPEC.md` §2.3).
 */
export function sidebarBlockFoldKey(blockKey: string): string {
  return `sidebar-block:${blockKey}`
}

export function sidebarSectionFoldKey(label: string): string {
  return `sidebar-section:${slugifyLabel(label)}`
}
