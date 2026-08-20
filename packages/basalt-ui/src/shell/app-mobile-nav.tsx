/**
 * The mobile bottom bar. Rendered inside an `AppShell.Footer` (`hiddenFrom="sm"`, height collapsed
 * to 0 on desktop) so it only exists below the navbar breakpoint.
 *
 * A SLOT IS A DESTINATION. Tapping one navigates through the consumer's router anchor — no
 * overlay, no animation, nothing to dismiss — which is the whole point of the rewrite: reaching a
 * page used to cost a tap to open a sheet plus a tap to pick a row. An overlay now exists only
 * where a slot genuinely holds more than one destination (the trailing "More" slot, or an opt-in
 * group slot), and its surface is INFERRED from the row count rather than configured: a content-
 * sized `Menu` that pops out of the tab up to `menuMax` rows, a bottom `Drawer` past it.
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
import type {
  MobileNavConfig,
  MobileNavGroup,
  MobileNavModel,
  MobileNavSlot,
  SidebarItem,
} from '../nav/types'
import type { BasaltAccountProps } from './account-types'
import type { SettingsMenuItem } from './index'
import { NavCountBadge } from './nav-count-badge'
import { useBasaltSpacing } from '../theme'
import classes from './app-mobile-nav.module.css'

/**
 * Floating-ui middlewares for a tab menu. `flip: false` is correct, not lazy: flipping a
 * bottom-anchored menu puts it UNDER the footer, off-screen — `menuMax` is what guarantees it fits
 * above the bar (§2.2). `shift.padding` is a viewport inset in px, not a layout spacing token.
 */
const MENU_MIDDLEWARES = { flip: false, shift: { padding: 8 } } // theme-allow

/** A slot that navigates on tap. */
type LinkSlot = Extract<MobileNavSlot, { kind: 'link' }>
/** A slot that raises a surface. `menu` and `sheet` share one shape — only the renderer differs. */
type SurfaceSlot = Exclude<MobileNavSlot, LinkSlot>

export type MobileNavProps = {
  /** The projection from `projectMobileNav` — `BasaltShell` builds it, memoized. */
  model: MobileNavModel
  config?: MobileNavConfig | undefined
  /** Rendered as FLAT ROWS in the More surface, never by mounting `SidebarAccount` (which opens
   *  its own `Menu` — a menu inside a menu). This is what makes the mobile sidebar drawer
   *  deletable: everything it used to hold is reachable from More. */
  account?: BasaltAccountProps | undefined
  settingsMenuItems?: SettingsMenuItem[] | undefined
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

/** A row the More surface derives from `account`/`settingsMenuItems` — never a destination. */
type ActionRow = {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick?: ((e: MouseEvent<HTMLElement>) => void) | undefined
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
  }))
}

/** One destination row, in a `Menu` dropdown. `depth` indents a nested child. */
const menuRow = (item: SidebarItem, depth: number): ReactElement => {
  // `.menuItem[data-disabled] { pointer-events: none }` is the primary guard, but it cannot be the
  // only one: Mantine's `MenuItem` composes the CALLER's `onClick` first and only then checks
  // `data-disabled` itself, so anything that reaches the node without a pointer — a keyboard
  // activation, a synthetic click, a consumer stylesheet resetting `pointer-events` — would still
  // fire the destination's handler on a row the projection deliberately rendered dead (§2.9).
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (item.disabled) {
      event.preventDefault()
      return
    }
    item.onClick?.(event)
  }
  const shared = {
    className: depth > 0 ? `${classes.menuItem} ${classes.menuItemNested}` : classes.menuItem,
    leftSection: item.icon,
    disabled: Boolean(item.disabled),
    // Mantine emits `data-disabled` (a STYLING hook) and nothing else, so the ARIA state is ours
    // to set — a disabled destination still renders (§2.3 rule 11), so it has to announce itself.
    'aria-disabled': item.disabled || undefined,
    'aria-current': item.active ? ('page' as const) : undefined,
    rightSection: item.count ? <NavCountBadge count={item.count} /> : undefined,
    onClick,
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

/** Depth-first: parent, then its children as indented rows — nesting survives to mobile. */
const rows = (
  items: readonly SidebarItem[],
  depth: number,
  render: (item: SidebarItem, depth: number) => ReactElement,
): ReactElement[] =>
  items.flatMap((item) => [render(item, depth), ...rows(item.children ?? [], depth + 1, render)])

/** An account/settings row, in a `Menu` dropdown. */
const menuActionRow = (row: ActionRow) => (
  <Menu.Item
    key={row.key}
    className={classes.menuItem}
    leftSection={row.icon}
    {...(row.danger ? { color: 'red' } : {})}
    onClick={(event: MouseEvent<HTMLElement>) => row.onClick?.(event)}
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
}: MobileNavProps): ReactElement {
  // `openKey` is the ONLY state here, and it is keyed by slot rather than holding a slot object:
  // `sections` identity churning on every consumer render must not close an open menu.
  const [openKey, setOpenKey] = useState<string | null>(null)
  // `DEFAULT_THEME.respectReducedMotion` is false in Mantine 9.3 and `createBasaltTheme` does not
  // set it, so the preference has to be read explicitly at the call site.
  const reduceMotion = useReducedMotion()
  const { step } = useBasaltSpacing()

  const close = () => setOpenKey(null)

  /** §2.5 — re-tapping the ACTIVE slot scrolls to top instead of pushing a redundant history entry. */
  const scrollToTop = () => {
    const target =
      config?.getScrollElement?.() ?? document.scrollingElement ?? document.documentElement
    target.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const extraRows = [...accountRows(account), ...settingsRows(settingsMenuItems)]

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
   * The trigger for a `menu`/`sheet` slot. A plain button: Mantine's `Menu.Target` clones
   * `aria-haspopup`/`aria-expanded`/`aria-controls` onto it (`withRoles` default), so hand-setting
   * them here would double them up (§2.9).
   */
  const surfaceTab = (slot: SurfaceSlot, onClick?: () => void) => (
    <UnstyledButton
      className={classes.tab}
      data-active={slot.active || undefined}
      aria-current={slot.active ? 'page' : undefined}
      aria-label={slot.label}
      {...(onClick ? { onClick } : {})}
    >
      {tabInner(slot)}
    </UnstyledButton>
  )

  /** A `link` slot: the consumer's router anchor IS the tab, so preload/back/middle-click all work. */
  const linkTab = (slot: LinkSlot) => {
    const onClick = (e: MouseEvent<HTMLElement>) => {
      // VERIFIED in @tanstack/react-router: `Link` composes the caller's handler FIRST and returns
      // early when `defaultPrevented`, so this suppresses navigation without touching preload.
      if (slot.active) {
        e.preventDefault()
        scrollToTop()
      }
      slot.item.onClick?.(e)
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

  /** One destination row, in the sheet. 44px minimum, per the touch-target floor. */
  const sheetRow = (item: SidebarItem, depth: number): ReactElement => {
    const onClick = (e: MouseEvent<HTMLElement>) => {
      item.onClick?.(e)
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
      {...(row.danger ? { color: 'red' } : {})}
      onClick={(event: MouseEvent<HTMLElement>) => {
        row.onClick?.(event)
        close()
      }}
    />
  )

  const menuSlot = (slot: SurfaceSlot) => (
    <Menu
      key={slot.key}
      opened={openKey === slot.key}
      onChange={(opened) => setOpenKey(opened ? slot.key : null)}
      position={slot.isMore ? 'top-end' : 'top'}
      offset={8}
      width={step.mobileNavMenuWidth}
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
        {/* A separator separates. With nothing above it — a More slot raised purely by the account
            and settings rows — it would render as the dropdown's first child, a rule under the
            top edge. Both sides have to exist. */}
        {slot.isMore && extraRows.length > 0 && slotHasRows(slot) ? <Menu.Divider /> : null}
        {slot.isMore ? extraRows.map(menuActionRow) : null}
        {slot.isMore ? config?.moreExtra : null}
      </Menu.Dropdown>
    </Menu>
  )

  const sheetSlot = (slot: SurfaceSlot) => (
    <Fragment key={slot.key}>
      {surfaceTab(slot, () => setOpenKey(slot.key))}
      <Drawer
        opened={openKey === slot.key}
        onClose={close}
        position="bottom"
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
          timingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <ScrollArea.Autosize mah="62dvh" type="scroll">
          <Stack gap="xs">
            {slot.groups.map((group) => (
              <Stack key={group.key} gap={2}>
                {sheetGroupLabel(group)}
                {rows(group.items, 0, sheetRow)}
              </Stack>
            ))}
            {slot.isMore && extraRows.length > 0 ? (
              <Stack gap={2}>{extraRows.map(sheetActionRow)}</Stack>
            ) : null}
            {slot.isMore ? config?.moreExtra : null}
          </Stack>
        </ScrollArea.Autosize>
      </Drawer>
    </Fragment>
  )

  return (
    <nav className={classes.bar} aria-label="Primary">
      {model.slots.map((slot) => {
        if (slot.kind === 'link') return linkTab(slot)
        if (slot.kind === 'menu') return menuSlot(slot)
        return sheetSlot(slot)
      })}
    </nav>
  )
}

/** Whether a surface slot paints any destination row at all (as opposed to only derived rows). */
function slotHasRows(slot: SurfaceSlot): boolean {
  return slot.groups.some((group) => group.items.length > 0)
}

/** Any destination in the tree carrying a non-zero count. */
function groupHasCount(items: readonly SidebarItem[]): boolean {
  return items.some((item) => Boolean(item.count) || groupHasCount(item.children ?? []))
}
