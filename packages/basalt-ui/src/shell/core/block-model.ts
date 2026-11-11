/**
 * The rail-block law: every default a block leaves unstated, and the persisted fold-key grammar.
 * Ported from 2.x `src/shell/sidebar-block-model.ts`.
 *
 * Pure for the same reason the projector is: the rail decides where a block renders and what the
 * collapsed rail keeps, and the phone projection turns blocks into More rows that pick `menu`
 * against `sheet`. A default re-derived per call site is how a count and a renderer drift apart.
 *
 * Blocks are declared data, never a `ReactNode` slot (law C13). `CoreBlock` is a superset of the
 * frozen `SidebarBlock` of `src/shell/contract.ts`: it adds the `list` kind the concept names
 * (section 1 row "Rail and blocks") and the optional defaults below, and every contract block is a
 * valid `CoreBlock` (pinned in `types.type-guard.test.ts`).
 */
import type { IconComponent } from '../../core/ports'

/** Envelope version for a persisted fold flag. Bump only if the value stops being a boolean. */
export const FOLD_VERSION = 1

/** Status tone on a list row; reads `--vx-status-*`, never a literal colour. */
export type BlockTone = 'good' | 'warn' | 'bad'

/** One row inside a `list` block. */
export type CoreBlockItem = {
  id: string
  label: string
  /** Trailing muted text (a timestamp, a count, an owner). */
  meta?: string
  icon?: IconComponent
  /** A status dot in place of a missing `icon`. */
  tone?: BlockTone
  onClick?: () => void
}

/** Non-destination rows under a micro-label: "Awaiting action", "Recents". */
export type CoreListBlock = {
  kind: 'list'
  id: string
  label: string
  icon?: IconComponent
  /** The header badge, and what earns a rail dot. */
  count?: number
  /** Rows shown before the "Show more" toggle. Omit to show every row. */
  max?: number
  items: readonly CoreBlockItem[]
  /** @default 'nav' */
  placement?: 'nav' | 'bottom'
  collapsible?: boolean
  /** @default 'dot' when `count` and `icon` are set, `'hidden'` otherwise */
  rail?: 'dot' | 'hidden'
  /** @default 'more' */
  mobile?: 'more' | 'hidden'
}

/** A pinned status row ("Quota 70 %"). `value` is a fraction, 0 to 1. */
export type CoreProgressBlock = {
  kind: 'progress'
  id: string
  label: string
  value: number
  onClick?: () => void
  /** @default 'bottom' */
  placement?: 'bottom'
  /** A ring on the rail footer. @default 'ring' */
  rail?: 'ring' | 'hidden'
  /** @default 'hidden' */
  mobile?: 'more' | 'hidden'
}

/**
 * Arbitrary content no set of rows expresses (a tree, a filter panel), rendered into a box. Its
 * `mobile` pair is what names it wherever it shrinks to one control: a More row on the phone and
 * an icon (opening the content in a popover) on the collapsed rail. Without it the block is
 * desktop-only and leaves the collapsed rail.
 */
export type CoreCustomBlock = {
  kind: 'custom'
  id: string
  mobile?: { label: string; icon: IconComponent }
  /** @default 'nav' */
  placement?: 'nav' | 'bottom'
  /** @default 'icon' when `mobile` is set, `'hidden'` otherwise */
  rail?: 'icon' | 'hidden'
}

export type CoreBlock = CoreListBlock | CoreProgressBlock | CoreCustomBlock

/** `'nav'` renders after the sections in the scroll region; `'bottom'` pins above the footer. */
export function blockPlacement(block: CoreBlock): 'nav' | 'bottom' {
  if (block.kind === 'progress') return block.placement ?? 'bottom'
  return block.placement ?? 'nav'
}

/**
 * The collapsed-rail form. A list earns a dot only with a `count` AND an `icon` (a dot must sit on
 * something and mean a number); a progress block a ring; a custom block an icon only when it is
 * named. A missing half overrides an explicit `rail` value: that combination is a config mistake,
 * not a shape to render blank.
 */
export function blockRail(block: CoreBlock): 'dot' | 'ring' | 'icon' | 'hidden' {
  if (block.kind === 'custom') {
    if (block.mobile === undefined) return 'hidden'
    return block.rail ?? 'icon'
  }
  if (block.kind === 'progress') return block.rail ?? 'ring'
  if (block.icon === undefined || block.count === undefined) return 'hidden'
  return block.rail ?? 'dot'
}

/**
 * The phone form. A list is reachable from More by default: below `medium` there is no rail, so a
 * hidden list is unreachable, not merely unshown. Progress is ambient status and stays hidden
 * unless asked; a custom block projects to the phone when it is named.
 */
export function blockMobile(block: CoreBlock): 'more' | 'hidden' {
  if (block.kind === 'custom') return block.mobile === undefined ? 'hidden' : 'more'
  if (block.kind === 'progress') return block.mobile ?? 'hidden'
  return block.mobile ?? 'more'
}

/**
 * The blocks that become a More row, in declaration order. ONE row per block, never one per item:
 * a list projects to a single row that opens its items. An empty list is no row (it would open a
 * sheet with nothing in it).
 */
export function blockMoreRows<B extends CoreBlock>(blocks: readonly B[] | undefined): B[] {
  if (blocks === undefined) return []
  return blocks.filter((block) => {
    if (blockMobile(block) !== 'more') return false
    return block.kind !== 'list' || block.items.length > 0
  })
}

/** Rows a list block paints, honouring `max`; "Show more" reveals the rest. */
export function blockVisibleCount(itemCount: number, max: number | undefined): number {
  if (max === undefined || max >= itemCount) return itemCount
  return Math.max(0, max)
}

/**
 * A 2.x section label as a storage-key segment: lowercase, every run of non-alphanumerics one `-`,
 * no edge separator (`'Awaiting action'` gives `'awaiting-action'`). v3 keys folds by section `id`;
 * the codemod sets `id` to this slug of the 2.x label, so every stored fold survives. Frozen: a
 * change resets every user's rail.
 */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Unnamespaced fold keys; the persisted-state layer prefixes `basalt:`, so the stored keys are
 * `basalt:sidebar-block:<id>` and `basalt:sidebar-section:<section id>`.
 */
export function blockFoldKey(blockId: string): string {
  return `sidebar-block:${blockId}`
}

export function sectionFoldKey(sectionId: string): string {
  return `sidebar-section:${sectionId}`
}
