/**
 * The mobile-bar projection — `SidebarSection[]` + `MobileNavConfig` → `MobileNavModel`.
 *
 * PURE BY CONTRACT: no React, no Mantine, no DOM, no JSX. Everything the bottom bar decides —
 * which destinations get a slot, which slot is a plain navigation link and which raises a surface,
 * whether that surface is a menu or a sheet, what falls into the overflow "More" slot — is decided
 * here and unit-testable with no renderer. `app-mobile-nav.tsx` only paints the result.
 *
 * The law it implements is the interaction model, not a heuristic: a slot is a DESTINATION, so a
 * tap navigates with no overlay to dismiss. An overlay exists only where a slot genuinely holds
 * more than one destination, and its surface is INFERRED from how many rows it holds rather than
 * configured — six rows is the arithmetic ceiling for a menu that pops out of a 56px bar without
 * ever rendering below the fold (6 x 44px + 8px padding = 272px against 415px of headroom on the
 * smallest supported viewport), so past that the surface becomes a bottom sheet.
 */
import type {
  MobileNavConfig,
  MobileNavGroup,
  MobileNavModel,
  MobileNavSlot,
  NavMobilePlacement,
  SidebarBlock,
  SidebarItem,
  SidebarSection,
} from '../nav/types'
import { sidebarBlockMobile } from './sidebar-block-model'

/** Hard cap on bar slots, INCLUDING More. Five 72px slots is the widest a 360px viewport holds. */
export const MOBILE_MAX_TABS_DEFAULT = 5

/**
 * Rows a slot may hold before it becomes a sheet instead of a menu. Arithmetic, not taste — see
 * the module doc: six rows is the last count a bottom-anchored, non-flipping menu fits above the
 * bar on the smallest supported viewport.
 */
export const MOBILE_MENU_MAX_DEFAULT = 6

/** The overflow slot's reserved key. A slot like any other — it just exists only when needed. */
export const MOBILE_MORE_KEY = '__more'

export type ProjectMobileNavOptions = {
  config?: MobileNavConfig | undefined
  /**
   * Extra rows the More surface will hold — account + settings + sidebar blocks. Drives both
   * `needsMore` and the menu-vs-sheet threshold. The model cannot see those rows (they are
   * Mantine-rendered chrome, not `SidebarItem`s), so the shell counts them and passes the total.
   */
  extraMoreRows?: number
}

/**
 * How many More-surface rows `blocks` contribute — the `accountRowCount` sibling for sidebar
 * blocks, and for the same reason: `BasaltShell` needs the number BEFORE the projection runs (it
 * feeds `extraMoreRows`, which picks `menu` vs `sheet` against `menuMax`) while the renderer is
 * what decides how many rows a block actually becomes.
 *
 * ONE row per block, never one per item: a list block projects to a single `Awaiting action · 3`
 * row that opens a nested sheet of its items. Counting the items instead would push a 12-item
 * block's More surface to a sheet on the strength of rows that surface never paints.
 */
export function blockRowCount(blocks: readonly SidebarBlock[] | undefined): number {
  if (blocks === undefined) return 0
  return blocks.filter((block) => {
    if (sidebarBlockMobile(block) !== 'more') return false
    // An empty list block would open a sheet with nothing in it — same failure as the `loading`
    // account that used to conjure a More slot (`accountRowCount`).
    return block.kind !== 'list' || block.items.length > 0
  }).length
}

const DEV = process.env['NODE_ENV'] !== 'production'

/**
 * §2.3 rule 1. A section's `mobile: false` wins over every item inside it; otherwise the item's own
 * field decides, with the shorthand booleans normalized and `undefined` meaning "reachable, but not
 * from the bar" — the default that makes a nav work with nothing configured.
 */
function placementOf(item: SidebarItem, sectionHidden: boolean): NavMobilePlacement {
  if (sectionHidden) return 'hidden'
  const mobile = item.mobile
  if (mobile === undefined) return 'more'
  if (mobile === true) return 'tab'
  if (mobile === false) return 'hidden'
  return mobile
}

/** A section opts its whole subtree out of mobile with `mobile: false`. */
function isSectionHidden(section: SidebarSection): boolean {
  return section.mobile === false
}

/**
 * §2.3 rule 12 — a slot is active when the active destination is one the slot COVERS.
 *
 * "Covers" is the load-bearing word, and it is what makes exclusivity structural: a slot's `covered`
 * set is exactly the destinations it can navigate to, and activeness now reads that same set. Two
 * slots therefore cannot both be lit for one location, because no destination is in two `covered`
 * sets — the overflow is built by removing everything the bar already covers.
 *
 * It used to roll up unconditionally over `children`, and `itemCandidate.covered` was
 * `new Set([item.key])` — the item's own key ONLY. The two disagreed, and the disagreement was the
 * bug: at `/dashboard/sessions` the `Dashboard` link slot lit through the rollup while `Sessions`
 * itself, uncovered, sat in the overflow and lit the `More` slot as well. Measured in Chrome: two
 * `aria-current="page"` tabs in a five-slot bar.
 *
 * The rollup itself survives where coverage backs it — a SECTION slot covers its whole pruned tree
 * (`collectKeys` recurses), so a nested destination inside a section tab still lights that tab, which
 * is the "you are nowhere" case rule 12 was written for. What changed is an ITEM tab with children:
 * it covers only itself, its children stay reachable in the overflow, and the slot that can actually
 * reach the open route is the one that lights. That is strictly better than the alternative — folding
 * the children into the parent's coverage would light the parent and make the child unreachable from
 * the bar at all.
 */
function hasActiveDestination(item: SidebarItem): boolean {
  if (item.active) return true
  return item.children?.some(hasActiveDestination) ?? false
}

/** The half of rule 12 an ITEM slot reads: only the destination the tap actually navigates to. */
function isActiveDestination(item: SidebarItem): boolean {
  return item.active === true
}

/** Rows a group tree will render. Nesting costs a row per node — children are indented rows. */
function countRows(items: readonly SidebarItem[]): number {
  return items.reduce((total, item) => total + 1 + countRows(item.children ?? []), 0)
}

/** Every destination key in a tree — the reachability set a slot contributes. */
function collectKeys(items: readonly SidebarItem[], out: Set<string>): void {
  for (const item of items) {
    out.add(item.key)
    collectKeys(item.children ?? [], out)
  }
}

/**
 * Depth-first flatten, parent before children — the order every candidate list and the zero-config
 * fallback read. Nesting is NOT lost: this is the lookup/selection view only (deciding which
 * destinations are eligible for a bar slot), while the overflow and group rendering below keep the
 * tree — `pruneOverflowTree` even preserves it across a covered parent, so a nested destination
 * renders indented under its parent (or its parent's group anchor) rather than as a flat sibling.
 */
function flattenItems(items: readonly SidebarItem[], out: SidebarItem[]): void {
  for (const item of items) {
    out.push(item)
    flattenItems(item.children ?? [], out)
  }
}

/**
 * Attaches `children` to a shallow copy of `item` — or omits `children` from it entirely when
 * there are none, rather than leaving a stale empty array — and pushes the result onto `out`.
 * Shared tail of `pruneTree`/`pruneOverflowTree`'s keep branches.
 */
function pushWithChildren(out: SidebarItem[], item: SidebarItem, children: SidebarItem[]): void {
  const next: SidebarItem = { ...item }
  if (children.length > 0) next.children = children
  else delete next.children
  out.push(next)
}

/**
 * Drops every destination `keep` rejects, HOISTING a rejected parent's surviving children into its
 * place rather than discarding the subtree — placement is normalized per destination (rule 1), so a
 * visible child of a hidden parent is still a visible destination and must stay reachable.
 */
function pruneTree(
  items: readonly SidebarItem[],
  keep: (item: SidebarItem) => boolean,
): SidebarItem[] {
  const out: SidebarItem[] = []
  for (const item of items) {
    const children = pruneTree(item.children ?? [], keep)
    if (!keep(item)) {
      out.push(...children)
      continue
    }
    pushWithChildren(out, item, children)
  }
  return out
}

/**
 * `pruneTree`'s overflow-only sibling — the More surface has TWO independent reasons a destination
 * drops out, and they no longer resolve the same way. `hidden` (a consumer opted the destination
 * fully out via rule 1) still hoists exactly like `pruneTree`: nothing should hint a hidden node
 * exists, so its visible children rise to fill its place. `covered` (the destination already has
 * its OWN slot elsewhere in the bar — a tab, or another section's slot) used to hoist identically,
 * which is the bug this function fixes: hoisting discards the tree edge between a covered PARENT
 * and its still-overflowing children, so `Sessions`/`Traffic`/`Revenue` rendered as flat siblings
 * with no indication they belong under `Dashboard` at all — depth information the renderer has no
 * way to reconstruct once it is gone. A covered parent with surviving children is kept instead, as
 * the GROUP ANCHOR those children nest under (same row shape and same destination it already is on
 * the bar — tapping it in the sheet does exactly what tapping its tab does); a covered LEAF (no
 * surviving children) still drops entirely, since rule 7's original reasoning — a destination with
 * nowhere new to add is not worth a second, redundant row — still holds for that case unchanged.
 */
function pruneOverflowTree(
  items: readonly SidebarItem[],
  isHidden: (item: SidebarItem) => boolean,
  isCovered: (item: SidebarItem) => boolean,
): SidebarItem[] {
  const out: SidebarItem[] = []
  for (const item of items) {
    const children = pruneOverflowTree(item.children ?? [], isHidden, isCovered)
    if (isHidden(item)) {
      out.push(...children)
      continue
    }
    if (isCovered(item)) {
      // A covered leaf contributes nothing new — drop it, exactly like `pruneTree` would.
      if (children.length === 0) continue
      // Rule 12 (`hasActiveDestination`'s doc): this destination is covered, so its REAL slot is
      // what lights when it is the active route — its own tab, or another section's slot. The
      // anchor copied here is not that slot, so its own `active` is forced false; only a
      // surviving CHILD's activeness may roll up and light the surface this anchor sits inside.
      // Without this a route at the covered parent lit BOTH its own tab and the anchor's
      // enclosing More/section surface — two `aria-current="page"` tabs for one location.
      out.push({ ...item, active: false, children })
      continue
    }
    pushWithChildren(out, item, children)
  }
  return out
}

/** A slot candidate before the `maxTabs` slice decides which ones survive. */
type Candidate = {
  /** What the candidate is CALLED — a destination key, or a section's label. Only rule 13's warn
   *  reads it, and that warn exists to name the slots that lost the slice. */
  key: string
  /** Destination keys this slot makes reachable — everything else falls to overflow (rule 7). */
  covered: Set<string>
  /** Built after the slice, since a dropped candidate never becomes a slot. */
  toSlot: () => MobileNavSlot | undefined
}

/** A destination becomes a `link` slot: one tap, one navigation, nothing to dismiss. */
function itemCandidate(item: SidebarItem): Candidate {
  return {
    key: item.key,
    covered: new Set([item.key]),
    // `isActiveDestination`, not the rollup: this slot COVERS one key, so it reads one key
    // (`hasActiveDestination`'s doc has the whole accounting).
    toSlot: () => ({
      kind: 'link',
      key: item.key,
      label: item.label,
      short: item.short ?? item.label,
      icon: item.icon,
      active: isActiveDestination(item),
      item,
    }),
  }
}

/**
 * A SECTION becomes one slot (`mobile: { tab: true }`), holding its destinations. Cardinality picks
 * the surface (§2.2): an empty section is not a slot at all, and a section of ONE destination IS
 * that destination — collapsing to a `link` rather than raising a full surface for a single row,
 * which is exactly what today's projection gets wrong.
 */
function sectionCandidate(section: SidebarSection, menuMax: number): Candidate {
  const mobile =
    section.mobile === false || section.mobile === undefined ? undefined : section.mobile
  const items = pruneTree(section.items, (item) => placementOf(item, false) !== 'hidden')
  const covered = new Set<string>()
  collectKeys(items, covered)
  const label = mobile?.label ?? section.label
  const rows = countRows(items)
  const only = items[0]

  return {
    key: section.label,
    covered,
    toSlot: () => {
      if (rows === 0) return undefined
      if (rows === 1 && only !== undefined && !only.disabled) {
        return {
          kind: 'link',
          key: only.key,
          label,
          short: label,
          // The section's own identity wins when it declares one — the consumer configured the
          // SLOT — and falls back to the single destination's icon when it does not.
          icon: mobile?.icon ?? section.icon ?? only.icon,
          active: hasActiveDestination(only),
          item: only,
        }
      }
      return {
        kind: rows <= menuMax ? 'menu' : 'sheet',
        key: section.label,
        label,
        short: label,
        icon: mobile?.icon ?? section.icon,
        active: items.some(hasActiveDestination),
        // One section, so the rows need no group heading — the tab itself names them.
        groups: [{ key: section.label, items }],
        isMore: false,
      }
    },
  }
}

/**
 * §2.3 rules 3-6 — the candidate list, in bar order.
 *
 * `config.tabs` REPLACES the declarative pass entirely (rule 5): it is the one named escape hatch
 * for "bar order != sidebar order", so it wins over every `item.mobile`. Otherwise sections are
 * walked in declaration order, which is what interleaves section slots with item slots correctly.
 */
function buildCandidates(
  sections: readonly SidebarSection[],
  config: MobileNavConfig | undefined,
  maxTabs: number,
  menuMax: number,
): Candidate[] {
  const flat: SidebarItem[] = []
  for (const section of sections) {
    if (isSectionHidden(section)) continue
    flattenItems(section.items, flat)
  }

  /** Rule 11 — `mobile: 'tab'` on a disabled destination is a configuration mistake, not a slot. */
  const tabbable = (item: SidebarItem): boolean => {
    if (!item.disabled) return true
    if (DEV) {
      console.warn(
        `[basalt] MobileNav: "${item.key}" asks for a bar slot but is disabled — a disabled destination never becomes a tab. It still renders, disabled, in the More surface.`,
      )
    }
    return false
  }

  if (config?.tabs !== undefined) {
    const candidates: Candidate[] = []
    for (const id of config.tabs) {
      const item = flat.find((candidate) => candidate.key === id)
      if (item !== undefined) {
        if (tabbable(item)) candidates.push(itemCandidate(item))
        continue
      }
      // A section is named by its `label` — `SidebarSection` carries no key of its own.
      const section = sections.find((s) => s.label === id && !isSectionHidden(s))
      if (section !== undefined) {
        candidates.push(sectionCandidate(section, menuMax))
        continue
      }
      if (DEV) {
        console.warn(
          `[basalt] MobileNav: mobileNav.tabs names "${id}", which is neither a destination key nor a visible section label — ignoring it.`,
        )
      }
    }
    return candidates
  }

  const candidates: Candidate[] = []
  for (const section of sections) {
    if (isSectionHidden(section)) continue
    // Rule 3: a section slot consumes its destinations, so they never also compete as item slots.
    if (section.mobile !== undefined && section.mobile !== false && section.mobile.tab === true) {
      candidates.push(sectionCandidate(section, menuMax))
      continue
    }
    const items: SidebarItem[] = []
    flattenItems(section.items, items)
    for (const item of items) {
      if (placementOf(item, false) !== 'tab') continue
      if (tabbable(item)) candidates.push(itemCandidate(item))
    }
  }
  if (candidates.length > 0) return candidates

  // Rule 6 — nobody configured anything. The bar still works: the first few top-level destinations
  // become slots, so a consumer gets a usable nav for free and tunes it only if it is wrong.
  const fallback: Candidate[] = []
  for (const section of sections) {
    if (isSectionHidden(section)) continue
    for (const item of section.items) {
      if (fallback.length >= maxTabs - 1) return fallback
      if (item.disabled) continue
      if (placementOf(item, false) === 'hidden') continue
      fallback.push(itemCandidate(item))
    }
  }
  return fallback
}

/** Rule 7 — the leftovers, grouped by source section, tree intact — including a covered
 *  parent kept on as its surviving children's group anchor (`pruneOverflowTree`'s doc). */
function buildOverflow(
  sections: readonly SidebarSection[],
  covered: Set<string>,
): MobileNavGroup[] {
  const groups: MobileNavGroup[] = []
  for (const section of sections) {
    const hidden = isSectionHidden(section)
    if (hidden) continue
    const items = pruneOverflowTree(
      section.items,
      (item) => placementOf(item, hidden) === 'hidden',
      (item) => covered.has(item.key),
    )
    if (items.length === 0) continue
    groups.push({ key: section.label, label: section.label, items })
  }
  return groups
}

/**
 * Projects `sections` onto the bar. Implements §2.3's thirteen rules in order, and is the ONLY
 * place slot selection happens — `MobileNav` receives a finished model and paints it.
 */
export function projectMobileNav(
  sections: SidebarSection[],
  opts?: ProjectMobileNavOptions,
): MobileNavModel {
  const config = opts?.config
  const maxTabs = Math.max(1, config?.maxTabs ?? MOBILE_MAX_TABS_DEFAULT)
  const menuMax = Math.max(1, config?.menuMax ?? MOBILE_MENU_MAX_DEFAULT)
  const extraMoreRows = opts?.extraMoreRows ?? 0

  const candidates = buildCandidates(sections, config, maxTabs, menuMax)

  // Rules 8-9 are mutually recursive on paper — `needsMore` reads the overflow, the slice writes
  // it. The fixpoint is one line: a candidate list longer than the bar ALWAYS needs More, because
  // the slice is what pushes the remainder into overflow.
  const coveredByAll = new Set<string>()
  for (const candidate of candidates) for (const key of candidate.covered) coveredByAll.add(key)
  const overflowIfNoneDropped = buildOverflow(sections, coveredByAll)
  const needsMore =
    countRows(overflowIfNoneDropped.flatMap((group) => group.items)) > 0 ||
    extraMoreRows > 0 ||
    candidates.length > maxTabs

  const limit = needsMore ? maxTabs - 1 : maxTabs
  const kept = candidates.slice(0, limit)
  const dropped = candidates.slice(limit)
  if (DEV && dropped.length > 0) {
    // Rule 13 wants the NAMES, not a tally: "2 candidates dropped" tells a consumer their bar is
    // wrong, while the keys tell them which `mobile: 'tab'` to move or which section to reorder.
    console.warn(
      `[basalt] MobileNav: ${candidates.length} slot candidates for ${limit} available slot(s) — the last ${dropped.length} moved into the More surface: ${dropped.map((candidate) => `"${candidate.key}"`).join(', ')}. Raise mobileNav.maxTabs or drop a mobile: 'tab'.`,
    )
  }

  const covered = new Set<string>()
  for (const candidate of kept) for (const key of candidate.covered) covered.add(key)

  const slots: MobileNavSlot[] = []
  for (const candidate of kept) {
    const slot = candidate.toSlot()
    if (slot !== undefined) slots.push(slot)
  }

  if (!needsMore) return { slots }

  // Rule 10 — the More slot, inferred over everything the bar could not reach.
  const groups = buildOverflow(sections, covered)
  const overflowItems = groups.flatMap((group) => group.items)
  const rows = countRows(overflowItems) + extraMoreRows
  if (rows === 0) return { slots }

  const label = config?.moreLabel ?? 'More'
  const only = overflowItems[0]
  if (rows === 1 && extraMoreRows === 0 && only !== undefined && !only.disabled) {
    // §2.2 again: a More surface holding one destination IS that destination.
    slots.push({
      kind: 'link',
      key: only.key,
      label: only.label,
      short: only.short ?? only.label,
      icon: only.icon,
      active: hasActiveDestination(only),
      item: only,
    })
    return { slots }
  }

  slots.push({
    kind: rows <= menuMax ? 'menu' : 'sheet',
    key: MOBILE_MORE_KEY,
    label,
    short: label,
    // No icon: the More glyph is chrome the renderer owns, and this module holds no JSX.
    icon: undefined,
    active: overflowItems.some(hasActiveDestination),
    groups,
    isMore: true,
  })
  return { slots }
}
