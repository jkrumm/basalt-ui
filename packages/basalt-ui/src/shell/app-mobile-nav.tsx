/**
 * The mobile bottom bar. Rendered inside an `AppShell.Footer` (`hiddenFrom="sm"`, height collapsed
 * to 0 on desktop) so it only exists below the navbar breakpoint.
 *
 * A SLOT IS A DESTINATION. Tapping one navigates through the consumer's router anchor — no
 * overlay, no animation, nothing to dismiss — which is the whole point of the rewrite: reaching a
 * page used to cost a tap to open a sheet plus a tap to pick a row. An overlay now exists only
 * where a slot genuinely holds more than one destination (the trailing "More" slot, or an opt-in
 * group slot), and its surface is INFERRED from the row count rather than configured: a content-
 * sized `Menu` that pops out of the tab up to `menuMax` rows, a bottom `Drawer` past it. The menu
 * is bounded by its own `max-height`, so `menuMax` decides taste, never whether it fits.
 *
 * This component paints a finished `MobileNavModel` and owns exactly one piece of state — which
 * slot's surface is open. Every selection decision lives in `mobile-nav-model.ts`, which is pure.
 *
 * Router-agnostic: each slot and row renders through `SidebarItem.Anchor` when supplied (the
 * consumer's router `Link`), else a plain `<a href>` + `item.onClick`. Active state arrives
 * precomputed as `item.active`.
 */
import { Drawer, Menu, NavLink, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { Fragment, useState } from 'react'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { SCROLLPORT_ATTRIBUTE } from '../common/scroll-parent'
import type {
  MobileNavConfig,
  MobileNavGroup,
  MobileNavModel,
  MobileNavSlot,
  SidebarBlock,
  SidebarBlockItem,
  SidebarItem,
  SidebarListBlock,
  SidebarProgressBlock,
} from './nav-types'
import type { BasaltAccountProps } from './account-types'
import type { SettingsMenuItem } from './index'
import { NavCountBadge } from './nav-count-badge'
import { SidebarBlockToneDot } from './sidebar-blocks'
import { sidebarBlockMobile } from './sidebar-block-model'
import { useBasaltSpacing } from '../theme'
import classes from './app-mobile-nav.module.css'

/**
 * Floating-ui middlewares for a tab menu. `flip: false` is correct, not lazy: flipping a
 * bottom-anchored menu puts it UNDER the footer, off-screen. What guarantees it fits above the bar
 * is `.menuDropdown`'s own `max-height` (see the CSS module) — NOT `menuMax`, which is only the
 * menu-vs-sheet threshold. `shift.padding` is a viewport inset in px, not a layout spacing token.
 */
const MENU_MIDDLEWARES = { flip: false, shift: { padding: 8 } }

/** A slot that navigates on tap. */
type LinkSlot = Extract<MobileNavSlot, { kind: 'link' }>
/** A slot that raises a surface. `menu` and `sheet` share one shape — only the renderer differs. */
type SurfaceSlot = Exclude<MobileNavSlot, LinkSlot>

export type MobileNavProps = BasaltProps & {
  /** The projection from `projectMobileNav` — `BasaltShell` builds it, memoized. */
  model: MobileNavModel
  config?: MobileNavConfig | undefined
  /** Rendered as FLAT ROWS in the More surface, never by mounting `SidebarAccount` (which opens
   *  its own `Menu` — a menu inside a menu). This is what makes the mobile sidebar drawer
   *  deletable: everything it used to hold is reachable from More. */
  account?: BasaltAccountProps | undefined
  settingsMenuItems?: SettingsMenuItem[] | undefined
  /**
   * The sidebar's blocks, projected. A block with `mobile: 'more'` becomes ONE row in the More
   * surface (`Awaiting action · 3`) that opens a nested 44px-row sheet of its items — the sidebar
   * itself does not exist below `sm`, so this is the only way its blocks are reachable at all.
   * Counted for the menu-vs-sheet threshold by `blockRowCount`, never re-counted here.
   */
  blocks?: SidebarBlock[] | undefined
}

/** Inline "More" glyph — keeps the shell icon-dependency-free. */
function IconMore() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  )
}

/** The `ActionRow.active` glyph — same shape as `app-sidebar.tsx`'s own copy (no icon dependency
 * to import between the two render trees). */
function IconCheck() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l5 5l10 -10" />
    </svg>
  )
}

/** A row the More surface derives from `account`/`settingsMenuItems` — never a destination. */
type ActionRow = {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick?: ((e: MouseEvent<HTMLElement>) => void) | undefined
  /** Mirrors `SettingsMenuItem.active` — a trailing check + `aria-current` in every row form. */
  active?: boolean
}

/**
 * Flattens `BasaltAccountProps` into rows. `SidebarAccount`'s own dropdown cannot be reused here —
 * it is a `Menu`, and the More surface is already one.
 */
function accountRows(account: BasaltAccountProps | undefined): ActionRow[] {
  if (!account || account.state.status === 'loading') return []
  const actions = account.actions
  if (account.state.status === 'unauthenticated') {
    return [{ key: 'basalt-account-sign-in', label: 'Sign in', onClick: actions?.onSignIn }]
  }
  const rows: ActionRow[] = []
  if (actions?.onManageAccount) {
    rows.push({
      key: 'basalt-account-manage',
      label: 'Account settings',
      onClick: actions.onManageAccount,
    })
  }
  if (actions?.onManageBilling) {
    rows.push({
      key: 'basalt-account-billing',
      label: 'Billing & payment',
      onClick: actions.onManageBilling,
    })
  }
  if (account.state.plan?.isFree && actions?.onUpgrade) {
    rows.push({ key: 'basalt-account-upgrade', label: 'Upgrade', onClick: actions.onUpgrade })
  }
  for (const item of actions?.extraMenuItems ?? []) {
    rows.push({
      key: item.key,
      label: item.label,
      icon: item.icon,
      ...(item.danger !== undefined && { danger: item.danger }),
      onClick: item.onClick,
    })
  }
  if (actions?.onSignOut) {
    const onSignOut = actions.onSignOut
    rows.push({
      key: 'basalt-account-sign-out',
      label: 'Sign out',
      danger: true,
      onClick: () => void onSignOut(),
    })
  }
  return rows
}

/**
 * How many rows `account` contributes to the More surface — DELEGATED to `accountRows` rather than
 * re-derived, because `BasaltShell` needs this number BEFORE the projection runs (it feeds
 * `extraMoreRows`, which picks `menu` vs `sheet` against `menuMax`) while only this module knows
 * how many rows an account actually expands into. Two independent counts is how a "1 row" account
 * shipped a 9-row menu into headroom sized for 6, and how a `loading` account — which renders NO
 * rows — still conjured a More slot that opened empty.
 */
export function accountRowCount(account: BasaltAccountProps | undefined): number {
  return accountRows(account).length
}

/** Settings entries already carry the row shape — they just lose the sidebar's `Menu` wrapper. */
function settingsRows(items: SettingsMenuItem[] | undefined): ActionRow[] {
  return (items ?? []).map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    onClick: item.onClick,
    ...(item.active !== undefined && { active: item.active }),
  }))
}

/**
 * The deepest element inside `root` that is CURRENTLY scrolled, or `null`.
 *
 * `common/scroll-parent.ts`'s `scrollParentOf` asks the opposite question — which ANCESTOR scrolls
 * a given element — and this twin deliberately stays local rather than joining it there. That
 * module is a shared vocabulary with several consumers and one meaning ("which box scrolls this");
 * this is a scroll-to-top TARGET search with exactly one call site, a visibility rule and a
 * deepest-wins tiebreak that only make sense for it. Per the consolidation doctrine a new shared
 * export needs a named consumer outside the module that wanted it; this one does not have a second.
 *
 * Deepest wins because nested scrollers nest by specificity: a page scroller holding a thread pane
 * means the pane is the surface the user is looking at. Visibility is part of "actually scrolled" —
 * a hidden box keeps its `scrollTop` forever — but `getClientRects()` is only asked of the handful
 * of nodes that pass the cheap `scrollTop` test, never of the whole tree.
 */
function deepestScrolledDescendant(root: ParentNode | null): HTMLElement | null {
  if (root === null) return null
  let best: HTMLElement | null = null
  let bestDepth = -1
  for (const node of root.querySelectorAll<HTMLElement>('*')) {
    if (node.scrollTop <= 0) continue
    if (node.getClientRects().length === 0) continue
    let depth = 0
    for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) depth += 1
    if (depth > bestDepth) {
      best = node
      bestDepth = depth
    }
  }
  return best
}

/** Depth-first: parent, then its children as indented rows — nesting survives to mobile. */
const rows = (
  items: readonly SidebarItem[],
  depth: number,
  render: (item: SidebarItem, depth: number) => ReactElement,
): ReactElement[] =>
  items.flatMap((item) => [render(item, depth), ...rows(item.children ?? [], depth + 1, render)])

/** An account/settings row, in a `Menu` dropdown. `sectionStart` draws the tail's own top rule
 *  (see `tailRule` and `menuSlot`) when this is the first row of the unlabelled tail. */
const menuActionRow = (row: ActionRow, sectionStart = false) => (
  <Menu.Item
    key={row.key}
    className={sectionStart ? `${classes.menuItem} ${classes.menuSectionStart}` : classes.menuItem}
    leftSection={row.icon}
    rightSection={row.active ? <IconCheck /> : undefined}
    {...(row.danger ? { color: 'red' } : {})}
    onClick={(event: MouseEvent<HTMLElement>) => row.onClick?.(event)}
    aria-current={row.active ? 'true' : undefined}
  >
    {row.label}
  </Menu.Item>
)

/** The sheet has no `Menu.Label` equivalent, so the section heading is a plain micro-label. */
const sheetGroupLabel = (group: MobileNavGroup) =>
  group.label ? (
    <Text component="div" className={classes.menuLabel}>
      {group.label}
    </Text>
  ) : null

export function MobileNav({
  model,
  config,
  account,
  settingsMenuItems,
  blocks,
  className,
  style,
}: MobileNavProps): ReactElement {
  assertRequiredProps('MobileNav', { model }, ['model'], { model: '`model.slots`' })
  // `openKey` is the ONLY slot state here, and it is keyed by slot rather than holding a slot
  // object: `sections` identity churning on every consumer render must not close an open menu.
  const [openKey, setOpenKey] = useState<string | null>(null)
  // The nested block sheet, keyed the same way and for the same reason.
  const [openBlockKey, setOpenBlockKey] = useState<string | null>(null)
  // `DEFAULT_THEME.respectReducedMotion` is false in Mantine 9.3 and `createBasaltTheme` does not
  // set it, so the preference has to be read explicitly at the call site.
  const reduceMotion = useReducedMotion()
  const { step } = useBasaltSpacing()

  const close = () => setOpenKey(null)

  /** Scrolls `target` only if it has somewhere to go. The return value is the whole point — see
   *  `scrollToTop`: "I asked it to scroll" and "it scrolled" are different facts. */
  const scrollElementToTop = (target: Element | null | undefined): boolean => {
    if (!target || target.scrollTop <= 0) return false
    target.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
    return true
  }

  /**
   * §2.5 — re-tapping the ACTIVE slot scrolls to top instead of pushing a redundant history entry.
   *
   * RETURNS WHETHER ANYTHING ACTUALLY SCROLLED, and that is the fix for the reported dead tap. The
   * old version resolved `[data-basalt-scrollport]` (= `AppShell.Main`) and scrolled it
   * unconditionally, while the caller had ALREADY suppressed the navigation. On any page whose
   * real scroller is an INNER element — `/agent`'s thread panes, `/data`'s
   * `Table.ScrollContainer`, `/content`'s article body — Main's own `scrollTop` is 0, so the scroll
   * moved nothing and the navigation was gone too: a 100% dead tap, on exactly the pages that have
   * the most to scroll.
   *
   * So the search widens and the answer is honest. The consumer's handle wins, then the declared
   * scrollport, then the deepest inner scroller that is genuinely scrolled, then the document for a
   * shell-less app. A `false` here means the caller must let the navigation through — a redundant
   * same-route navigation is strictly better than silence.
   */
  const scrollToTop = (): boolean => {
    const declared =
      config?.getScrollElement?.() ?? document.querySelector(`[${SCROLLPORT_ATTRIBUTE}]`)
    if (scrollElementToTop(declared)) return true
    if (scrollElementToTop(deepestScrolledDescendant(declared ?? document.body))) return true
    return scrollElementToTop(document.scrollingElement ?? document.documentElement)
  }

  /**
   * §2.5 + §2.9 in ONE place, because the three row builders used to disagree about what a tap on
   * a row MEANS. `linkTab` implemented the active-retap rule and `menuRow`/`sheetRow` did not, so
   * a row inside the More surface rendered `aria-current="page"` and then navigated to the route
   * it was already on — the router no-ops, the surface closes, nothing moves. Since More is where
   * most destinations live the moment the bar is full, that was the MORE common dead tap of the
   * two. `sheetRow` was also missing the disabled guard `menuRow` carries.
   *
   * Order is load-bearing: the scroll is ATTEMPTED FIRST and the navigation is suppressed only if
   * something really moved (`scrollToTop`'s doc). Returns `false` when the tap was swallowed by
   * the disabled guard, so a caller owning a surface knows not to dismiss it.
   */
  const onActivate = (item: SidebarItem, event: MouseEvent<HTMLElement>): boolean => {
    // Mantine emits `data-disabled` as a STYLING hook and the rows are polymorphic
    // (`component="a"`/the consumer's Anchor), so the native `disabled` attribute never applies —
    // and `MenuItem` composes the CALLER's `onClick` before checking `data-disabled` itself. The
    // CSS no longer sets `pointer-events: none` (a row that swallows a tap with no press state is
    // indistinguishable from a broken one), which makes this the ONLY guard, on every path.
    if (item.disabled) {
      event.preventDefault()
      return false
    }
    if (item.active === true && scrollToTop()) event.preventDefault()
    item.onClick?.(event)
    return true
  }

  const extraRows = [...accountRows(account), ...settingsRows(settingsMenuItems)]

  /**
   * The blocks that reach More, in sidebar order and with the same emptiness rule `blockRowCount`
   * applies — the count that picked `menu` vs `sheet` and the rows that render must agree.
   */
  const moreBlocks = (blocks ?? []).filter(
    (block): block is SidebarListBlock | SidebarProgressBlock =>
      block.kind !== 'custom' &&
      sidebarBlockMobile(block) === 'more' &&
      (block.kind !== 'list' || block.items.length > 0),
  )
  const listBlocks = moreBlocks.filter((block): block is SidebarListBlock => block.kind === 'list')

  /**
   * Whether the More surface's UNLABELLED tail (blocks + account + settings) opens its own band —
   * the guard the deleted `Menu.Divider` used to carry inline. A separator separates: with no
   * destination rows above it, a More slot raised purely by those rows would open a band under the
   * dropdown's top edge with nothing on the other side of it.
   */
  const tailRule = (slot: SurfaceSlot): boolean =>
    moreBlocks.length + extraRows.length > 0 && slotHasRows(slot)

  /** A list block raises its nested sheet; a progress block just fires its own handler. */
  const activateBlock = (block: (typeof moreBlocks)[number]) => {
    close()
    if (block.kind === 'list') {
      // ONE FRAME, deliberately. `close()` starts the Menu's `returnFocus` (it restores focus to
      // the More tab) while the nested Drawer traps focus on mount — in the same handler the two
      // race, and focus lands wherever the loser wrote last, which is how a tap on a block row
      // could leave the sheet open with focus back on the bar behind it. Deferring the open by one
      // rAF lets the return finish before the trap starts.
      requestAnimationFrame(() => setOpenBlockKey(block.key))
      return
    }
    block.onClick?.()
  }

  const menuBlockRow = (block: (typeof moreBlocks)[number], sectionStart = false) => (
    <Menu.Item
      key={block.key}
      className={
        sectionStart ? `${classes.menuItem} ${classes.menuSectionStart}` : classes.menuItem
      }
      onClick={() => activateBlock(block)}
    >
      {blockRowLabel(block)}
    </Menu.Item>
  )

  const sheetBlockRow = (block: (typeof moreBlocks)[number]) => (
    <NavLink
      key={block.key}
      classNames={{ root: classes.row }}
      label={blockRowLabel(block)}
      onClick={() => activateBlock(block)}
    />
  )

  /** One block ITEM, inside the nested sheet. A row with nowhere to go stays plain text. */
  const blockItemRow = (item: SidebarBlockItem): ReactElement => {
    const lead =
      item.icon ?? (item.tone !== undefined ? <SidebarBlockToneDot tone={item.tone} /> : undefined)
    const meta =
      item.meta !== undefined ? (
        <Text component="span" className={classes.rowMeta}>
          {item.meta}
        </Text>
      ) : undefined
    const interactive =
      item.Anchor !== undefined || item.href !== undefined || item.onClick !== undefined
    if (!interactive) {
      return (
        <div key={item.key} className={classes.row}>
          {lead}
          <Text component="span">{item.label}</Text>
          {meta}
        </div>
      )
    }
    const shared = {
      classNames: { root: classes.row },
      label: item.label,
      ...(lead !== undefined && { leftSection: lead }),
      ...(meta !== undefined && { rightSection: meta }),
      onClick: () => {
        item.onClick?.()
        setOpenBlockKey(null)
      },
    }
    const Anchor = item.Anchor
    if (Anchor) return <NavLink key={item.key} component={Anchor} {...shared} />
    return (
      <NavLink
        key={item.key}
        component="a"
        {...(item.href !== undefined && { href: item.href })}
        {...shared}
      />
    )
  }

  /** True when any destination in the slot carries an unread count — the icon dot (§2.4). */
  const hasCount = (slot: MobileNavSlot): boolean =>
    slot.kind === 'link'
      ? Boolean(slot.item.count)
      : slot.groups.some((g) => groupHasCount(g.items))

  const tabInner = (slot: MobileNavSlot) => (
    <>
      <span className={classes.tabIcon}>
        {slot.icon ?? (slot.kind !== 'link' && slot.isMore ? <IconMore /> : null)}
        {hasCount(slot) ? <span className={classes.tabDot} aria-hidden /> : null}
      </span>
      <Text className={classes.label}>{slot.short}</Text>
    </>
  )

  /**
   * The trigger for a `menu`/`sheet` slot.
   *
   * The two paths differ in who owns the ARIA, and the guard below is what keeps them apart. On
   * the MENU path the button is a `Menu.Target` child, so Mantine clones
   * `aria-haspopup`/`aria-expanded`/`aria-controls` onto it (`withRoles` default) and setting them
   * here would double them up (§2.9). On the SHEET path there is no `Menu.Target` and no clone at
   * all, so the trigger announced nothing — a button that opens a dialog and says so only to
   * sighted users. `onClick` is present on exactly the sheet path, which is why it is the
   * discriminator rather than a second parameter that could disagree with reality.
   */
  const surfaceTab = (slot: SurfaceSlot, onClick?: () => void, expanded?: boolean) => (
    <UnstyledButton
      className={classes.tab}
      data-active={slot.active || undefined}
      aria-current={slot.active ? 'page' : undefined}
      aria-label={slot.label}
      {...(onClick
        ? { onClick, 'aria-haspopup': 'dialog' as const, 'aria-expanded': Boolean(expanded) }
        : {})}
    >
      {tabInner(slot)}
    </UnstyledButton>
  )

  /** A `link` slot: the consumer's router anchor IS the tab, so preload/back/middle-click all work. */
  const linkTab = (slot: LinkSlot) => {
    // VERIFIED in @tanstack/react-router: `Link` composes the caller's handler FIRST and returns
    // early when `defaultPrevented`, so `onActivate` suppresses navigation without touching
    // preload. A link slot's `active` and its item's `active` are the same fact by construction —
    // every path that builds one reads `isActiveDestination` (`mobile-nav-model.ts`).
    const onClick = (e: MouseEvent<HTMLElement>) => {
      onActivate(slot.item, e)
    }
    const shared = {
      className: classes.tab,
      'data-active': slot.active || undefined,
      'aria-current': slot.active ? ('page' as const) : undefined,
      'aria-label': slot.label,
      onClick,
    }
    const Anchor = slot.item.Anchor
    if (Anchor) {
      return (
        <UnstyledButton key={slot.key} component={Anchor} {...shared}>
          {tabInner(slot)}
        </UnstyledButton>
      )
    }
    return (
      <UnstyledButton
        key={slot.key}
        component="a"
        {...(slot.item.href !== undefined && { href: slot.item.href })}
        {...shared}
      >
        {tabInner(slot)}
      </UnstyledButton>
    )
  }

  /**
   * One destination row, in a `Menu` dropdown. `depth` indents a nested child.
   *
   * Lives INSIDE the component (it used to be a module-level const) for one reason: it needs
   * `onActivate`, which needs `scrollToTop`, which needs `config` and `reduceMotion`. Recreating
   * it per render costs what `sheetRow` already costs and buys all three row builders one handler.
   */
  const menuRow = (item: SidebarItem, depth: number): ReactElement => {
    const shared = {
      className: depth > 0 ? `${classes.menuItem} ${classes.menuItemNested}` : classes.menuItem,
      leftSection: item.icon,
      disabled: Boolean(item.disabled),
      // Mantine emits `data-disabled` (a STYLING hook) and nothing else, so the ARIA state is ours
      // to set — a disabled destination still renders (§2.3 rule 11), so it has to announce itself.
      'aria-disabled': item.disabled || undefined,
      'aria-current': item.active ? ('page' as const) : undefined,
      rightSection: item.count ? <NavCountBadge count={item.count} /> : undefined,
      onClick: (event: MouseEvent<HTMLElement>) => {
        onActivate(item, event)
      },
    }
    const Anchor = item.Anchor
    if (Anchor && !item.disabled) {
      return (
        <Menu.Item key={item.key} component={Anchor} {...shared}>
          {item.label}
        </Menu.Item>
      )
    }
    return (
      <Menu.Item
        key={item.key}
        component="a"
        {...(item.href !== undefined && !item.disabled && { href: item.href })}
        {...shared}
      >
        {item.label}
      </Menu.Item>
    )
  }

  /** One destination row, in the sheet. 44px minimum, per the touch-target floor. */
  const sheetRow = (item: SidebarItem, depth: number): ReactElement => {
    const onClick = (e: MouseEvent<HTMLElement>) => {
      // The disabled guard `menuRow` always had, now shared — a dead row must not dismiss the
      // sheet either, or the tap reads as "it did something" while going nowhere.
      if (!onActivate(item, e)) return
      close()
    }
    const shared = {
      classNames: {
        root: depth > 0 ? `${classes.row} ${classes.rowNested}` : classes.row,
      },
      label: item.label,
      leftSection: item.icon,
      rightSection: item.count ? <NavCountBadge count={item.count} /> : undefined,
      active: Boolean(item.active),
      disabled: Boolean(item.disabled),
      // Same as the menu row above: `NavLink`'s `disabled` is a `mod`, i.e. `data-disabled` only.
      'aria-disabled': item.disabled || undefined,
      'aria-current': item.active ? ('page' as const) : undefined,
      onClick,
    }
    const Anchor = item.Anchor
    if (Anchor && !item.disabled) {
      return <NavLink key={item.key} component={Anchor} {...shared} />
    }
    return (
      <NavLink
        key={item.key}
        component="a"
        {...(item.href !== undefined && !item.disabled && { href: item.href })}
        {...shared}
      />
    )
  }

  const sheetActionRow = (row: ActionRow) => (
    <NavLink
      key={row.key}
      classNames={{ root: classes.row }}
      label={row.label}
      leftSection={row.icon}
      rightSection={row.active ? <IconCheck /> : undefined}
      {...(row.danger ? { color: 'red' } : {})}
      onClick={(event: MouseEvent<HTMLElement>) => {
        row.onClick?.(event)
        close()
      }}
      aria-current={row.active ? 'true' : undefined}
    />
  )

  const menuSlot = (slot: SurfaceSlot) => (
    <Menu
      key={slot.key}
      opened={openKey === slot.key}
      onChange={(opened) => setOpenKey(opened ? slot.key : null)}
      position={slot.isMore ? 'top-end' : 'top'}
      offset={8}
      // Only the More dropdown widens. `mobileNavMenuWidth` (232px) is sized for a section slot's
      // short destination labels; More also carries block rows like `Awaiting action · 3` and
      // account rows like `Billing & payment`, which wrap or clip at that width. A viewport-
      // relative cap rather than a second token: it is a fraction of the phone it opens on, and it
      // is the only surface in the bar whose contents are not the consumer's nav labels.
      width={slot.isMore ? 'min(78vw, 300px)' : step.mobileNavMenuWidth}
      withinPortal
      // AppShell itself sits at z-index 100 (`getDefaultZIndex('app')`), so the menu must clear it.
      zIndex={400}
      middlewares={MENU_MIDDLEWARES}
      trapFocus
      returnFocus
      closeOnItemClick
      closeOnClickOutside
      closeOnEscape
      // Required for a navigation menu following the WAI-ARIA disclosure pattern — Mantine's own
      // note on the prop. Without it every row is `tabindex="-1"`.
      menuItemTabIndex={0}
      transitionProps={{
        transition: slot.isMore ? 'pop-bottom-right' : 'pop',
        duration: reduceMotion ? 0 : 140,
        exitDuration: reduceMotion ? 0 : 100,
      }}
      classNames={{ dropdown: classes.menuDropdown, label: classes.menuLabel }}
    >
      <Menu.Target>{surfaceTab(slot)}</Menu.Target>
      <Menu.Dropdown>
        {slot.groups.flatMap((group) => [
          ...(group.label
            ? [<Menu.Label key={`${group.key}-label`}>{group.label}</Menu.Label>]
            : []),
          ...rows(group.items, 0, menuRow),
        ])}
        {/* The `Menu.Divider` node that used to sit here is gone: section rhythm is SPACE opened
            by each group's own heading (`.menuDropdown .menuLabel:not(:first-child)` in the CSS
            module, which explains why it is space and not a line — `theme/divider-law.test.ts`
            bans a hairline under a heading in the chrome lane). That is what makes the popover
            read as sections instead of as one long list, which is the structure the More surface
            needed a whole Drawer to get. The unlabelled tail (blocks + account + settings) has no
            heading to open its band, so its FIRST row carries `.menuSectionStart` instead. The old
            guard survives verbatim in `tailRule`: a separator separates, so with nothing above it
            — a More slot raised purely by those rows — no band opens at all. */}
        {slot.isMore
          ? moreBlocks.map((block, index) => menuBlockRow(block, tailRule(slot) && index === 0))
          : null}
        {slot.isMore
          ? extraRows.map((row, index) =>
              menuActionRow(row, tailRule(slot) && moreBlocks.length === 0 && index === 0),
            )
          : null}
      </Menu.Dropdown>
    </Menu>
  )

  const sheetSlot = (slot: SurfaceSlot) => (
    <Fragment key={slot.key}>
      {/* A real TOGGLE, not a setter. It used to be `() => setOpenKey(slot.key)`, so re-tapping an
          open sheet's own tab did nothing at all — while the menu path, which gets Mantine's
          disclosure behaviour for free, closed on the second tap. Same trigger, same gesture, two
          different answers. */}
      {surfaceTab(
        slot,
        () => setOpenKey(openKey === slot.key ? null : slot.key),
        openKey === slot.key,
      )}
      <Drawer
        opened={openKey === slot.key}
        onClose={close}
        position="bottom"
        // The bar is inside `AppShell.Footer` at z-index 100 and Mantine's modal default is 200, so
        // the Drawer's OVERLAY covered the bar. Combined with `lockScroll` and a 220ms exit, that
        // overlay stayed hit-testable after `onClose`: with a sheet open, a tap on another tab
        // dismissed the sheet and did nothing else, and a quick second tap was eaten by the exiting
        // overlay. Matching the Menu's 400 puts the bar and its surfaces on one layer, and a
        // shorter exit shrinks the window in which a closing overlay can still swallow a tap.
        zIndex={400}
        overlayProps={{ zIndex: 400 }}
        // NO `size` prop — `size="auto"` used to be here, but it is a no-op on a bottom Drawer in
        // Mantine 9.3.0 (see the `.sheet` rule in the CSS module for the full trap). The sheet's
        // actual height/max-height comes entirely from that unlayered CSS rule, which overrides
        // Mantine's own regardless of what `size` resolves to.
        padding="md"
        // `title` is both the sheet's accessible name (Mantine wires `aria-labelledby` to it
        // automatically) and what makes the header render at all — dropping it would need an
        // explicit `aria-label` on the Drawer instead. `classNames.header` slims Mantine's 60px
        // title bar down to this bar's touch-target row height; its close button is the sheet's
        // ONLY dismiss affordance now (see `.sheetHeader` in the CSS module for why the grabber
        // that used to sit here is gone rather than the header).
        title={slot.label}
        classNames={{
          content: classes.sheet,
          title: classes.sheetTitle,
          header: classes.sheetHeader,
        }}
        transitionProps={{
          transition: 'slide-up',
          duration: reduceMotion ? 0 : 220,
          // Asymmetric on purpose: the entrance may take its time, the EXIT is a hit-test window.
          // Mantine's default exit equals the duration, so a dismissed sheet left 220ms of live
          // overlay over the bar — long enough to eat the next tab tap.
          exitDuration: reduceMotion ? 0 : 120,
          timingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* `offsetScrollbars="present"` reserves the overlay bar's own gutter (Mantine's
            `data-offset-scrollbars`) instead of floating it over the rows' trailing edge — the
            sheet has no spare right inset the way the sidebar's `.navScroll` bleed does. The outer
            Stack's gap and the group Stack's `gap={2}` both reuse the sidebar's section rhythm
            (`--vx-space-sidebar-section-gap`/`-section-label-gap`); the inner `gap={1}` is the
            sidebar's own row-to-row gap (`app-sidebar.tsx`'s nav `Stack gap={1}`).
            `scrollbarSize={8}` (down from Mantine's 12px default) is the tightest gutter that still
            clears a touch-sized thumb without the row overlap the M4 fix was written against; the
            `.sheet :global(.mantine-Drawer-body)` rule in the CSS module trims the body's own
            RIGHT padding by that same 8px, so the reserved gutter fills the gap it opened instead
            of stacking on top of the (symmetric) Drawer `padding="md"` — measured 18/18, not the
            18/30 the untrimmed body produced. */}
        <ScrollArea.Autosize mah="62dvh" type="scroll" offsetScrollbars="present" scrollbarSize={8}>
          <Stack gap="var(--vx-space-sidebar-section-gap)">
            {slot.groups.map((group) => (
              <Stack key={group.key} gap={2}>
                {sheetGroupLabel(group)}
                <Stack gap={1}>{rows(group.items, 0, sheetRow)}</Stack>
              </Stack>
            ))}
            {slot.isMore && moreBlocks.length > 0 ? (
              <Stack gap={1}>{moreBlocks.map(sheetBlockRow)}</Stack>
            ) : null}
            {slot.isMore && extraRows.length > 0 ? (
              <Stack gap={1}>{extraRows.map(sheetActionRow)}</Stack>
            ) : null}
          </Stack>
        </ScrollArea.Autosize>
      </Drawer>
    </Fragment>
  )

  /**
   * The nested block sheet — one Drawer instance PER block rather than one shared instance fed the
   * open block. A shared one would empty its own body the moment `onClose` cleared the key, so the
   * exit transition would play against a blank sheet; a closed Mantine Drawer renders nothing, so N
   * instances cost N nothings.
   */
  const blockSheet = (block: SidebarListBlock) => (
    <Drawer
      key={`block-${block.key}`}
      opened={openBlockKey === block.key}
      onClose={() => setOpenBlockKey(null)}
      position="bottom"
      // Same layer as `sheetSlot`'s Drawer and the Menu — see that one's note. This sheet is
      // reached FROM the More surface, so it inherits the same overlay-over-the-bar problem.
      zIndex={400}
      overlayProps={{ zIndex: 400 }}
      padding="md"
      title={block.label}
      classNames={{
        content: classes.sheet,
        title: classes.sheetTitle,
        header: classes.sheetHeader,
      }}
      transitionProps={{
        transition: 'slide-up',
        duration: reduceMotion ? 0 : 220,
        // Same reasoning as `sheetSlot`'s Drawer — a long exit leaves a live overlay over the bar.
        exitDuration: reduceMotion ? 0 : 120,
        timingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <ScrollArea.Autosize mah="62dvh" type="scroll" offsetScrollbars="present" scrollbarSize={8}>
        <Stack gap={1}>{block.items.map(blockItemRow)}</Stack>
      </ScrollArea.Autosize>
    </Drawer>
  )

  return (
    <nav
      className={cx(classes.bar, className)}
      aria-label="Primary"
      {...(style !== undefined && { style })}
    >
      {model.slots.map((slot) => {
        if (slot.kind === 'link') return linkTab(slot)
        if (slot.kind === 'menu') return menuSlot(slot)
        return sheetSlot(slot)
      })}
      {listBlocks.map(blockSheet)}
    </nav>
  )
}

/** `Awaiting action · 3` — the row's whole job is to say how much is behind it. */
function blockRowLabel(block: SidebarListBlock | SidebarProgressBlock): string {
  return block.kind === 'list'
    ? `${block.label} · ${block.count ?? block.items.length}`
    : `${block.label} · ${block.value} of ${block.total}`
}

/** Whether a surface slot paints any destination row at all (as opposed to only derived rows). */
function slotHasRows(slot: SurfaceSlot): boolean {
  return slot.groups.some((group) => group.items.length > 0)
}

/** Any destination in the tree carrying a non-zero count. */
function groupHasCount(items: readonly SidebarItem[]): boolean {
  return items.some((item) => Boolean(item.count) || groupHasCount(item.children ?? []))
}
