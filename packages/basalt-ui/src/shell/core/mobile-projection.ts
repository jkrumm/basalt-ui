/**
 * The phone projection: nav declaration + active state → the slots of the tab bar. Ported from 2.x
 * `src/shell/mobile-nav-model.ts` (`projectMobileNav`), with three rewrites the concept names
 * (section 4): sections are keyed by `id`, activeness comes from `NavState` instead of a flag on the
 * item, and the More rows for blocks, settings and the account are projector-owned rows instead of
 * an `extraMoreRows` count the shell computed beside the model.
 *
 * The law is the interaction model: a slot is a DESTINATION, so a tap navigates with nothing to
 * dismiss. An overlay exists only where a slot holds more than one destination, and its surface is
 * inferred from its row count: up to `menuMax` rows a menu, past that a sheet. What keeps a menu
 * above the fold is the part's CSS (`max-height: min(72dvh, 560px)` with inner scroll), not this
 * number; `menuMax` only keeps a 30-destination nav from hanging a tall popover off one tab.
 *
 * Exclusivity is structural (invariant 14): a slot is active only when the active destination is
 * one it COVERS, and coverage is the same set the overflow is built from, so no destination is in
 * two slots and never two tabs carry `aria-current`.
 */
import type { Account, AccountRow, SettingsConfig, SettingsItem } from '../contract'
import type { IconComponent } from '../../core/ports'
import { rollupBadges } from './badges'
import { blockMoreRows } from './block-model'
import type { CoreBlock } from './block-model'
import type { NavState } from './nav-runtime'
import type {
  BadgeMap,
  CoreMobilePlacement,
  CoreNavConfig,
  CoreNavItem,
  CoreSectionMobile,
  NavBadge,
} from './types'

/** Hard cap on bar slots, INCLUDING More. Five 72 px slots is the widest a 360 px phone holds. */
export const MOBILE_MAX_TABS_DEFAULT = 5

/** Rows a slot holds before it becomes a sheet. Inclusive. */
export const MOBILE_MENU_MAX_DEFAULT = 12

/** The More slot's reserved id. It exists only when something overflows. */
export const MOBILE_MORE_ID = '__more'

/** The group id of the pinned items, which project after the sections under no heading. */
export const PINNED_GROUP_ID = '__pinned'

/** One destination row. `item` is the declared object itself (anchor identity keys on it). */
export type PhoneRow = {
  readonly id: string
  readonly item: CoreNavItem
  readonly label: string
  readonly short: string
  readonly icon: IconComponent | undefined
  /** The one active destination: the only row that carries `aria-current`. */
  readonly active: boolean
  /** Rendered disabled, never dropped. */
  readonly disabled: boolean
  readonly badge: NavBadge | null
  readonly children: readonly PhoneRow[]
}

/** Rows grouped under their source section; `label` is absent for the pinned group. */
export type PhoneGroup = {
  readonly id: string
  readonly label?: string
  readonly rows: readonly PhoneRow[]
}

/** A More row that is not a nav destination. The part names the account rows from its messages. */
export type PhoneExtraRow =
  | { readonly kind: 'block'; readonly id: string; readonly block: CoreBlock }
  | { readonly kind: 'settings'; readonly id: string; readonly item: SettingsItem }
  | {
      readonly kind: 'account'
      readonly id: string
      readonly role: 'identity' | 'sign-in' | 'sign-out' | 'row'
      readonly row?: AccountRow
    }

type SlotBase = {
  readonly id: string
  /** The accessible name; never abbreviated. */
  readonly label: string
  /** The visible bar label. */
  readonly short: string
  readonly icon: IconComponent | undefined
  readonly active: boolean
  /** A link slot's own badge (the tab dot); a surface's rollup (the More sum). */
  readonly badge: NavBadge | null
}

export type PhoneSlot =
  | (SlotBase & { readonly kind: 'link'; readonly row: PhoneRow })
  | (SlotBase & {
      readonly kind: 'menu' | 'sheet'
      readonly groups: readonly PhoneGroup[]
      /** Blocks, settings and account rows; only the More slot holds any. */
      readonly extras: readonly PhoneExtraRow[]
      readonly isMore: boolean
    })

export type PhoneModel = { readonly slots: readonly PhoneSlot[] }

export type PhoneProjectionInput = {
  nav: CoreNavConfig
  state: NavState
  badges?: BadgeMap
  blocks?: readonly CoreBlock[]
  settings?: SettingsConfig
  account?: Account
}

type Group = {
  id: string
  label: string | undefined
  icon: IconComponent | undefined
  mobile: CoreSectionMobile | undefined
  items: readonly CoreNavItem[]
}

type Context = { activeId: string | undefined; badges: BadgeMap | undefined }

const warn = (message: string): void => {
  if (process.env.NODE_ENV === 'production') return
  // eslint-disable-next-line no-console -- dev-only diagnostic
  console.warn(`[basalt] tab bar: ${message}`)
}

/** Rule 1: a section's `mobile: false` wins; `undefined` means reachable, not from the bar. */
function placementOf(item: CoreNavItem): CoreMobilePlacement {
  const mobile = item.mobile
  if (mobile === undefined) return 'more'
  if (mobile === true) return 'tab'
  if (mobile === false) return 'hidden'
  return mobile
}

const isHiddenGroup = (group: Group): boolean => group.mobile === false
const isSectionTab = (group: Group): boolean =>
  group.mobile !== undefined && group.mobile !== false && group.mobile.tab === true

function toRow(item: CoreNavItem, ctx: Context): PhoneRow {
  return {
    id: item.id,
    item,
    label: item.label,
    short: item.short ?? item.label,
    icon: item.icon,
    active: item.id === ctx.activeId,
    disabled: item.disabled === true,
    badge: ctx.badges?.[item.id] ?? null,
    children: (item.children ?? []).map((child) => toRow(child, ctx)),
  }
}

/** The rollup a SECTION slot reads: it covers its whole pruned tree. */
const hasActiveDestination = (row: PhoneRow): boolean =>
  row.active || row.children.some(hasActiveDestination)

/** Rows a tree renders: nesting costs a row per node. */
const countRows = (rows: readonly PhoneRow[]): number =>
  rows.reduce((total, row) => total + 1 + countRows(row.children), 0)

function collectIds(rows: readonly PhoneRow[], out: Set<string>): void {
  for (const row of rows) {
    out.add(row.id)
    collectIds(row.children, out)
  }
}

function flatten(rows: readonly PhoneRow[], out: PhoneRow[]): void {
  for (const row of rows) {
    out.push(row)
    flatten(row.children, out)
  }
}

function allBadges(rows: readonly PhoneRow[]): (NavBadge | null)[] {
  const flat: PhoneRow[] = []
  flatten(rows, flat)
  return flat.map((row) => row.badge)
}

/** Drops rejected rows, HOISTING a rejected parent's surviving children into its place. */
function pruneTree(rows: readonly PhoneRow[], keep: (row: PhoneRow) => boolean): PhoneRow[] {
  const out: PhoneRow[] = []
  for (const row of rows) {
    const children = pruneTree(row.children, keep)
    if (!keep(row)) out.push(...children)
    else out.push({ ...row, children })
  }
  return out
}

/**
 * The overflow prune. A hidden row hoists its visible children (nothing hints it exists). A covered
 * row (it has its own slot) with surviving children stays as their GROUP ANCHOR, so the tree edge is
 * not lost; its own `active` is forced false, since its real slot is the one that lights. A covered
 * leaf drops: it has nothing new to add.
 */
function pruneOverflowTree(
  rows: readonly PhoneRow[],
  isHidden: (row: PhoneRow) => boolean,
  isCovered: (row: PhoneRow) => boolean,
): PhoneRow[] {
  const out: PhoneRow[] = []
  for (const row of rows) {
    const children = pruneOverflowTree(row.children, isHidden, isCovered)
    if (isHidden(row)) {
      out.push(...children)
      continue
    }
    if (isCovered(row)) {
      if (children.length > 0) out.push({ ...row, active: false, children })
      continue
    }
    out.push({ ...row, children })
  }
  return out
}

/** A candidate before the `maxTabs` slice decides which survive. */
type Candidate = {
  /** The id named in the rule-13 warning. */
  id: string
  /** Destination ids this slot reaches; everything else falls to More (rule 7). */
  covered: Set<string>
  toSlot: () => PhoneSlot | undefined
}

/** A link slot covers exactly the destination its tap reaches, and reads only that one's state. */
function linkSlot(row: PhoneRow, label = row.label, short = row.short, icon = row.icon): PhoneSlot {
  return { kind: 'link', id: row.id, label, short, icon, active: row.active, badge: row.badge, row }
}

function itemCandidate(row: PhoneRow): Candidate {
  return { id: row.id, covered: new Set([row.id]), toSlot: () => linkSlot(row) }
}

/**
 * A `mobile: { tab: true }` section is one slot; one destination collapses to that link. `claimed`
 * are destinations an earlier slot already covers: they leave this slot's tree (their children
 * hoist), so no destination is covered twice.
 */
function sectionCandidate(
  group: Group,
  rows: readonly PhoneRow[],
  menuMax: number,
  claimed: ReadonlySet<string> = new Set(),
): Candidate {
  const mobile = group.mobile === false ? undefined : group.mobile
  const kept = pruneTree(rows, (row) => placementOf(row.item) !== 'hidden' && !claimed.has(row.id))
  const covered = new Set<string>()
  collectIds(kept, covered)
  const label = mobile?.label ?? group.label ?? group.id
  const icon = mobile?.icon ?? group.icon
  const count = countRows(kept)
  const only = kept[0]
  return {
    id: group.id,
    covered,
    toSlot: () => {
      if (count === 0) return undefined
      if (count === 1 && only !== undefined && !only.disabled) {
        return linkSlot(only, label, label, icon ?? only.icon)
      }
      return {
        kind: count <= menuMax ? 'menu' : 'sheet',
        id: group.id,
        label,
        short: label,
        icon,
        active: kept.some(hasActiveDestination),
        badge: rollupBadges(allBadges(kept)),
        groups: [{ id: group.id, rows: kept }],
        extras: [],
        isMore: false,
      }
    },
  }
}

/** Rule 11: a disabled destination asking for a tab is a config mistake, not a slot. */
function tabbable(row: PhoneRow): boolean {
  if (!row.disabled) return true
  warn(
    `"${row.id}" asks for a bar slot but is disabled; a disabled destination never becomes a tab. It still renders, disabled, in the More surface.`,
  )
  return false
}

/** Rules 3 to 6: the candidate list, in bar order. `tabs` replaces the declarative pass. */
function buildCandidates(
  groups: readonly Group[],
  rowsOf: Map<Group, PhoneRow[]>,
  tabs: ReadonlyArray<unknown> | undefined,
  maxTabs: number,
  menuMax: number,
): Candidate[] {
  const visible = groups.filter((group) => !isHiddenGroup(group))
  const flat: PhoneRow[] = []
  for (const group of visible) flatten(rowsOf.get(group) ?? [], flat)

  if (tabs !== undefined) {
    // `tabs` is free text: it can name an id twice, or an item and the section holding it. The
    // first slot to cover a destination keeps it (exclusivity by coverage, invariant 14).
    const candidates: Candidate[] = []
    const claimed = new Set<string>()
    const push = (candidate: Candidate): void => {
      candidates.push(candidate)
      for (const covered of candidate.covered) claimed.add(covered)
    }
    for (const id of tabs) {
      const row = flat.find((candidate) => candidate.id === id)
      if (row !== undefined) {
        if (claimed.has(row.id)) {
          warn(`mobile.tabs names "${row.id}", which an earlier slot already covers; ignoring it.`)
          continue
        }
        if (tabbable(row)) push(itemCandidate(row))
        continue
      }
      const group = visible.find((g) => g.id === id && g.id !== PINNED_GROUP_ID)
      if (group !== undefined) {
        const candidate = sectionCandidate(group, rowsOf.get(group) ?? [], menuMax, claimed)
        // A section an earlier slot already covers (named twice, or every item named before it)
        // would render no slot yet still take a place in the `maxTabs` slice.
        if (candidate.covered.size === 0) {
          warn(
            `mobile.tabs names section "${group.id}", which earlier slots already cover; ignoring it.`,
          )
          continue
        }
        push(candidate)
        continue
      }
      warn(
        `mobile.tabs names "${String(id)}", which is neither a destination id nor a visible section id; ignoring it.`,
      )
    }
    return candidates
  }

  const candidates: Candidate[] = []
  for (const group of visible) {
    const rows = rowsOf.get(group) ?? []
    if (isSectionTab(group)) {
      // Every item hidden: no slot, so no place in the slice either.
      const candidate = sectionCandidate(group, rows, menuMax)
      if (candidate.covered.size > 0) candidates.push(candidate)
      continue
    }
    const groupFlat: PhoneRow[] = []
    flatten(rows, groupFlat)
    for (const row of groupFlat) {
      if (placementOf(row.item) === 'tab' && tabbable(row)) candidates.push(itemCandidate(row))
    }
  }
  if (candidates.length > 0) return candidates

  // Rule 6: nothing configured. The first top-level destinations become slots.
  const fallback: Candidate[] = []
  for (const group of visible) {
    for (const row of rowsOf.get(group) ?? []) {
      if (fallback.length >= maxTabs - 1) return fallback
      if (row.disabled || placementOf(row.item) === 'hidden') continue
      fallback.push(itemCandidate(row))
    }
  }
  return fallback
}

/** Rule 7: the leftovers, grouped by source section, tree intact. */
function buildOverflow(
  groups: readonly Group[],
  rowsOf: Map<Group, PhoneRow[]>,
  covered: Set<string>,
): PhoneGroup[] {
  const out: PhoneGroup[] = []
  for (const group of groups) {
    if (isHiddenGroup(group)) continue
    const rows = pruneOverflowTree(
      rowsOf.get(group) ?? [],
      (row) => placementOf(row.item) === 'hidden',
      (row) => covered.has(row.id),
    )
    if (rows.length === 0) continue
    out.push(
      group.label === undefined
        ? { id: group.id, rows }
        : { id: group.id, label: group.label, rows },
    )
  }
  return out
}

function accountRows(account: Account | undefined): PhoneExtraRow[] {
  if (account === undefined || account.status === 'loading') return []
  if (account.status === 'signed-out')
    return [{ kind: 'account', id: 'account:sign-in', role: 'sign-in' }]
  const rows: PhoneExtraRow[] = [{ kind: 'account', id: 'account:identity', role: 'identity' }]
  for (const [index, row] of (account.rows ?? []).entries()) {
    rows.push({ kind: 'account', id: `account:row:${index}`, role: 'row', row })
  }
  if (account.onSignOut !== undefined)
    rows.push({ kind: 'account', id: 'account:sign-out', role: 'sign-out' })
  return rows
}

/**
 * The More rows that are not destinations, in surface order: blocks, settings, then the account.
 * They count toward `needsMore` and the menu-against-sheet threshold like any row.
 */
export function phoneExtraRows(
  input: Pick<PhoneProjectionInput, 'blocks' | 'settings' | 'account'>,
): PhoneExtraRow[] {
  return [
    ...blockMoreRows(input.blocks).map((block): PhoneExtraRow => ({
      kind: 'block',
      id: `block:${block.id}`,
      block,
    })),
    ...(input.settings?.items ?? []).map((item): PhoneExtraRow => ({
      kind: 'settings',
      id: `settings:${item.id}`,
      item,
    })),
    ...accountRows(input.account),
  ]
}

/**
 * Projects the nav onto the bar. The ONLY place slot selection happens: the tab bar part receives a
 * finished model and paints it.
 */
export function projectMobileNav(input: PhoneProjectionInput): PhoneModel {
  const { nav, state, badges } = input
  const config = nav.mobile
  const maxTabs = Math.max(1, config?.maxTabs ?? MOBILE_MAX_TABS_DEFAULT)
  const menuMax = Math.max(1, config?.menuMax ?? MOBILE_MENU_MAX_DEFAULT)
  const extras = phoneExtraRows(input)
  const ctx: Context = { activeId: state.activeId, badges }

  const groups: Group[] = nav.sections.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    mobile: section.mobile,
    items: section.items,
  }))
  if (nav.pinned !== undefined && nav.pinned.length > 0) {
    groups.push({
      id: PINNED_GROUP_ID,
      label: undefined,
      icon: undefined,
      mobile: undefined,
      items: nav.pinned,
    })
  }
  const rowsOf = new Map(
    groups.map((group) => [group, group.items.map((item) => toRow(item, ctx))]),
  )

  const candidates = buildCandidates(groups, rowsOf, config?.tabs, maxTabs, menuMax)

  // Rules 8 and 9: a candidate list longer than the bar always needs More, because the slice is
  // what pushes the remainder into overflow.
  const coveredByAll = new Set<string>()
  for (const candidate of candidates) for (const id of candidate.covered) coveredByAll.add(id)
  const overflowIfNoneDropped = buildOverflow(groups, rowsOf, coveredByAll)
  const needsMore =
    countRows(overflowIfNoneDropped.flatMap((group) => group.rows)) > 0 ||
    extras.length > 0 ||
    candidates.length > maxTabs

  const limit = needsMore ? maxTabs - 1 : maxTabs
  const kept = candidates.slice(0, limit)
  const dropped = candidates.slice(limit)
  if (dropped.length > 0) {
    warn(
      `${candidates.length} slot candidates for ${limit} available slot(s); the last ${dropped.length} moved into the More surface: ${dropped.map((c) => `"${c.id}"`).join(', ')}. Raise mobile.maxTabs or drop a mobile: 'tab'.`,
    )
  }

  const covered = new Set<string>()
  for (const candidate of kept) for (const id of candidate.covered) covered.add(id)

  const slots: PhoneSlot[] = []
  for (const candidate of kept) {
    const slot = candidate.toSlot()
    if (slot !== undefined) slots.push(slot)
  }
  if (!needsMore) return { slots }

  // Rule 10: the More slot, over everything the bar could not reach.
  const overflow = buildOverflow(groups, rowsOf, covered)
  const overflowRows = overflow.flatMap((group) => group.rows)
  const rows = countRows(overflowRows) + extras.length
  if (rows === 0) return { slots }

  const only = overflowRows[0]
  if (rows === 1 && extras.length === 0 && only !== undefined && !only.disabled) {
    // A More surface holding one destination IS that destination.
    slots.push(linkSlot(only))
    return { slots }
  }

  const label = config?.moreLabel ?? 'More'
  slots.push({
    kind: rows <= menuMax ? 'menu' : 'sheet',
    id: MOBILE_MORE_ID,
    label,
    short: label,
    // The More glyph is chrome the part owns.
    icon: undefined,
    active: overflowRows.some(hasActiveDestination),
    badge: rollupBadges(allBadges(overflowRows)),
    groups: overflow,
    extras,
    isMore: true,
  })
  return { slots }
}
