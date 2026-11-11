/**
 * The projector: rail, tab bar and header are projections of ONE declaration (concept section 1,
 * decision 5). This module owns the rail rows, the section fold keyed by section `id`, the block
 * rows and the badge rollups; the phone rows come from `projectMobileNav`, the header tiers from
 * `header-tiers.ts`. Headless: no React, no DOM, no class strings. The parts paint the result.
 *
 * Every row holds the declared item object in `item`, so a part keys anchor identity on it
 * (invariant 25) and a re-projection never remounts a link.
 */
import { badgeTone, devAssertOnce, litAttentionIds, rollupBadges } from './badges'
import type { BadgeTone } from './badges'
import {
  blockFoldKey,
  blockMobile,
  blockPlacement,
  blockRail,
  blockVisibleCount,
  sectionFoldKey,
} from './block-model'
import type { CoreBlock } from './block-model'
import { projectMobileNav } from './mobile-projection'
import type { PhoneModel, PhoneProjectionInput } from './mobile-projection'
import type { NavState } from './nav-runtime'
import type { IconComponent } from '../../core/ports'
import type { BadgeMap, CoreNavItem, CoreNavSection, NavBadge } from './types'

/** One rail row. `badge` is the row's own; `rollup` adds its descendants, for a folded parent. */
export type RailRow = {
  readonly id: string
  readonly item: CoreNavItem
  readonly label: string
  readonly icon: IconComponent | undefined
  /** 0 for a section's top-level item. */
  readonly depth: number
  /** The one active item: the only row with `aria-current`. */
  readonly active: boolean
  /** On the path above the active item; never `aria-current`. */
  readonly ancestor: boolean
  readonly disabled: boolean
  readonly badge: NavBadge | null
  readonly rollup: NavBadge | null
  /** `warn` when the rollup carries attention: the one attention colour. */
  readonly tone: BadgeTone
  readonly children: readonly RailRow[]
}

export type RailSection = {
  readonly id: string
  readonly label: string
  readonly icon: IconComponent | undefined
  readonly collapsible: boolean
  /** The persisted fold, seeded by `defaultCollapsed`; always false when not collapsible. */
  readonly folded: boolean
  /** Unnamespaced persisted key, `sidebar-section:<id>`. */
  readonly foldKey: string
  /** The section header's badge while folded, and the collapsed rail's section dot. */
  readonly rollup: NavBadge | null
  readonly tone: BadgeTone
  /** Whether the active item is inside; a folded section still says so on its header. */
  readonly containsActive: boolean
  readonly rows: readonly RailRow[]
}

export type RailBlockRow<B extends CoreBlock = CoreBlock> = {
  readonly id: string
  readonly block: B
  readonly placement: 'nav' | 'bottom'
  /** The collapsed-rail form. */
  readonly rail: 'dot' | 'ring' | 'icon' | 'hidden'
  readonly mobile: 'more' | 'hidden'
  /** Unnamespaced persisted key, `sidebar-block:<id>`. */
  readonly foldKey: string
  /** A list's rows before "Show more"; `undefined` for other kinds. */
  readonly visibleCount: number | undefined
}

export type RailModel = {
  readonly sections: readonly RailSection[]
  /** Rail bottom. */
  readonly pinned: readonly RailRow[]
  readonly blocks: {
    readonly nav: readonly RailBlockRow[]
    readonly bottom: readonly RailBlockRow[]
  }
}

export type RailProjectionInput = Pick<
  PhoneProjectionInput,
  'nav' | 'state' | 'badges' | 'blocks'
> & {
  /** Persisted section folds keyed by section `id`. A missing id falls back to `defaultCollapsed`. */
  folds?: Readonly<Partial<Record<string, boolean>>>
}

type RowContext = { state: NavState; badges: BadgeMap | undefined }

function toRailRow(item: CoreNavItem, depth: number, ctx: RowContext): RailRow {
  const children = (item.children ?? []).map((child) => toRailRow(child, depth + 1, ctx))
  const badge = ctx.badges?.[item.id] ?? null
  const rollup = rollupBadges([badge, ...children.map((child) => child.rollup)])
  return {
    id: item.id,
    item,
    label: item.label,
    icon: item.icon,
    depth,
    active: item.id === ctx.state.activeId,
    ancestor: ctx.state.ancestorIds.has(item.id),
    disabled: item.disabled === true,
    badge,
    rollup,
    tone: badgeTone(rollup),
    children,
  }
}

const containsActive = (rows: readonly RailRow[]): boolean =>
  rows.some((row) => row.active || containsActive(row.children))

function toRailSection(
  section: CoreNavSection,
  ctx: RowContext,
  folds: RailProjectionInput['folds'],
): RailSection {
  const rows = section.items.map((item) => toRailRow(item, 0, ctx))
  const rollup = rollupBadges(rows.map((row) => row.rollup))
  const collapsible = section.collapsible === true
  return {
    id: section.id,
    label: section.label,
    icon: section.icon,
    collapsible,
    folded: collapsible && (folds?.[section.id] ?? section.defaultCollapsed === true),
    foldKey: sectionFoldKey(section.id),
    rollup,
    tone: badgeTone(rollup),
    containsActive: containsActive(rows),
    rows,
  }
}

function toBlockRow<B extends CoreBlock>(block: B): RailBlockRow<B> {
  return {
    id: block.id,
    block,
    placement: blockPlacement(block),
    rail: blockRail(block),
    mobile: blockMobile(block),
    foldKey: blockFoldKey(block.id),
    visibleCount:
      block.kind === 'list' ? blockVisibleCount(block.items.length, block.max) : undefined,
  }
}

export function projectRail(input: RailProjectionInput): RailModel {
  const ctx: RowContext = { state: input.state, badges: input.badges }
  const blocks = (input.blocks ?? []).map(toBlockRow)
  return {
    sections: input.nav.sections.map((section) => toRailSection(section, ctx, input.folds)),
    pinned: (input.nav.pinned ?? []).map((item) => toRailRow(item, 0, ctx)),
    blocks: {
      nav: blocks.filter((row) => row.placement === 'nav'),
      bottom: blocks.filter((row) => row.placement === 'bottom'),
    },
  }
}

export type ProjectorInput = PhoneProjectionInput & RailProjectionInput

export type ShellProjection = { readonly rail: RailModel; readonly phone: PhoneModel }

export type ProjectorOptions = {
  /** Called once per projector when two or more attention badges are lit at the same time. */
  onAttentionConflict?: (ids: readonly string[]) => void
}

/**
 * One projector per mounted shell. It holds the one dev assertion (two attention badges lit), so a
 * re-render projects again without repeating the warning.
 */
export function createProjector(
  options: ProjectorOptions = {},
): (input: ProjectorInput) => ShellProjection {
  const onConflict = options.onAttentionConflict ?? devAssertOnce(attentionMessage)
  return (input) => {
    const lit = litAttentionIds(input.badges)
    if (lit.length > 1) onConflict(lit)
    return { rail: projectRail(input), phone: projectMobileNav(input) }
  }
}

function attentionMessage(ids: readonly string[]): string {
  return `[basalt] AppShell: ${ids.length} attention badges are lit (${ids.map((id) => `"${id}"`).join(', ')}). Attention marks the one place that needs the user; lit twice it marks none. Keep one attention badge and make the others plain counts.`
}
