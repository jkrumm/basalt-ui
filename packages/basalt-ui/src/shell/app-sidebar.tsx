/**
 * Presentational app sidebar — a collapsible icon-rail with grouped nav sections, a brand header
 * (logo + collapse toggle), and a footer settings menu (consumer-supplied entries + an
 * optional version label). Desktop only — below `sm` the sidebar doesn't render at all; mobile
 * navigation is `MobileNav`'s tab bar / More menu, not this component.
 *
 * Router-agnostic by design: active detection, typed navigation and the collapse store stay in the
 * consumer (or in `BasaltShell`), which feeds resolved `sections` + `collapsed`/`onToggleCollapse`
 * here. Each destination renders through its own `SidebarItem.Anchor` when supplied (the
 * consumer's router `Link`), else a plain `<a href>` with `item.onClick` — never a router
 * primitive. Active state arrives as `item.active`.
 *
 * DESKTOP ONLY. There is no mobile sidebar drawer any more: below the `sm` breakpoint the navbar
 * is permanently collapsed and the bottom bar (`app-mobile-nav.tsx`) is the whole nav. The rail
 * styling is still gated behind a `min-width: sm` media query, and the collapse chevron is
 * `visibleFrom="sm"`. Originally extracted from argo's
 * `apps/dashboard/src/components/app-shell/app-sidebar.tsx`; argo has since deleted that file in
 * favor of this package.
 */
import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  Menu,
  NavLink,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { BrandConfig, SettingsMenuItem } from './index'
import type { SidebarBlock, SidebarItem, SidebarSection } from '../nav/types'
import { NavCountBadge } from './nav-count-badge'
import { SidebarAccount } from './app-sidebar-account'
import type { AccountMenuItem, BasaltAccountProps } from './account-types'
import { SidebarSearch } from './sidebar-search'
import type { SidebarSearchActions, SidebarSearchConfig } from './sidebar-search'
import {
  IconChevron,
  SidebarBlockView,
  SidebarProgressRing,
  usePersistedFold,
} from './sidebar-blocks'
import {
  sidebarBlockPlacement,
  sidebarBlockRail,
  sidebarSectionFoldKey,
} from './sidebar-block-model'
import { VX } from '../tokens'
import { useBasaltSpacing } from '../theme'
import classes from './app-sidebar.module.css'

export type AppSidebarProps = BasaltProps & {
  /**
   * Brand identity. Supplying `menu` turns the brand row into a `Name ▾` workspace switcher —
   * the entries are the existing `AccountMenuItem` shape, so a consumer already mapping account
   * actions needs no second vocabulary.
   */
  brand: BrandConfig & { menu?: AccountMenuItem[] }
  sections: SidebarSection[]
  collapsed: boolean
  onToggleCollapse: () => void
  /**
   * Footer settings-menu entries (theme switcher, devtools, …) — supplied by the consumer.
   * The pinned footer row renders ONLY when this is a non-empty list — apps that put Settings in a
   * nav section (the common case) omit this and get no duplicate footer row.
   *
   * **Three entries or fewer render FLAT**, as one link row each (Settings · Integrations · Invite
   * teammates), and four or more collapse into the single gear "Settings" menu. A menu that opens
   * to show two rows costs a click for nothing; a footer of eight rows costs the nav its height.
   * That threshold is basalt's — `docs/CONTROLS-SPEC.md` §2.3 — and `settingsMenu` is the override
   * for the cases the count cannot see. `brand.version` renders as a faint label under the flat
   * rows, and inside the dropdown in the menu form.
   */
  settingsMenuItems?: SettingsMenuItem[]
  /**
   * Which footer form `settingsMenuItems` takes. `'auto'` (the default) is the count rule above;
   * `'flat'` and `'menu'` force one regardless of how many entries there are.
   *
   * The override exists because the COUNT is not the whole question. Three rows that are each a
   * theme radio group, a devtools switch and a density slider are three CONTROLS, not three
   * destinations — flat they fill the footer with widgets and push the account row off the fold,
   * and the count rule cannot tell them from three links. Equally, four short destinations may be
   * worth their height on a tall sidebar. `'auto'` stays the default so nothing moves for a
   * consumer that never had an opinion.
   *
   * DESKTOP FOOTER ONLY. Below `sm` there is no sidebar at all and the same entries are flat rows
   * in the bottom bar's More surface either way — a dropdown inside that sheet would be a menu
   * inside a menu.
   *
   * @default 'auto'
   */
  settingsMenu?: 'auto' | 'flat' | 'menu'
  /**
   * Optional account row rendered below the settings menu in the sidebar footer (see
   * `SidebarAccount` / `BasaltAccountProps`) — no separating hairline, the row's own top padding
   * supplies the separation. Omitting it reproduces today's footer unchanged.
   */
  account?: BasaltAccountProps
  /**
   * Optional search field rendered directly below the brand and ABOVE the nav scroll region — a
   * fixed, non-scrolling row. Pair with basalt-ui/commands' openSpotlight. `actions` adds up to two
   * icon-only buttons to the right of that row.
   */
  search?: SidebarSearchConfig & { actions?: SidebarSearchActions }
  /**
   * Declared blocks (`docs/CONTROLS-SPEC.md` §2.3, law C13) — an "Awaiting action" list, a
   * "Recents" list, a "Getting started" progress row, or a `kind: 'custom'` node for a tree or
   * filter panel no set of rows can express (`kind: 'custom'` is what replaced `navExtra`).
   *
   * `placement: 'nav'` appends after `sections` INSIDE the nav scroll region, so a long list
   * scrolls with the nav instead of fighting it for height; `'bottom'` pins above the settings
   * footer. Because these are data and not a `ReactNode` slot, basalt owns both projections a slot
   * could never express: the collapsed rail (a count dot on the icon, a ring on the settings row)
   * and the mobile More sheet — see `sidebarBlockRail` / `sidebarBlockMobile`.
   */
  blocks?: SidebarBlock[]
}

/** Inline collapse/expand chevrons — keeps the shell icon-dependency-free. */
function IconCollapse({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h16v16H4z" />
      <path d="M9 4v16" />
      {collapsed ? <path d="M14 9l3 3l-3 3" /> : <path d="M16 9l-3 3l3 3" />}
    </svg>
  )
}

function IconGear() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </svg>
  )
}

const HOVER_OPEN_DELAY = 150
const HOVER_CLOSE_DELAY = 200

/** `settingsMenuItems` at or under this count render as flat rows — see the prop's JSDoc. */
const FLAT_SETTINGS_MAX = 3

/**
 * The brand name, and — when `brand.menu` is supplied — the workspace switcher it becomes.
 *
 * The entries are `AccountMenuItem`s: the shell already had exactly this row shape (label, icon,
 * onClick, danger) for the account menu, and a second vocabulary for the same dropdown would be
 * two things to keep in step for no gain. The chevron is inline text, not an icon dependency.
 */
function BrandName({
  brand,
  menuWidth,
}: {
  brand: BrandConfig & { menu?: AccountMenuItem[] }
  menuWidth: number
}) {
  const label = (
    <Text className={classes.brandName} fz={VX.text.xl} fw={550}>
      {brand.name}
    </Text>
  )
  const menu = brand.menu
  if (menu === undefined || menu.length === 0) return label

  return (
    <Menu position="bottom-start" withArrow width={menuWidth} zIndex={500}>
      <Menu.Target>
        <UnstyledButton className={classes.brandButton} aria-label={`${brand.name} workspace`}>
          {label}
          {/* `open` is the DOWN glyph — a switcher's affordance points at its dropdown, and this is
              the same chevron every fold in the sidebar uses rather than a second one. */}
          <IconChevron open />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {menu.map((entry) => (
          <Menu.Item
            key={entry.key}
            leftSection={entry.icon}
            {...(entry.danger === true && { color: 'red' })}
            onClick={entry.onClick}
          >
            {entry.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

/** True when the item or any descendant is active — drives inline child expansion. */
function hasActiveDescendant(item: SidebarItem): boolean {
  if (item.active) return true
  return item.children?.some((c) => hasActiveDescendant(c)) ?? false
}

/**
 * Renders a nav link body without the Tooltip/Box wrapper.
 *
 * `item.Anchor` is the router seam and the ONLY one: basalt owns every pixel of the row (the
 * `.link` class, the label, the icon, the badge) and merely hosts the consumer's `Link` as the
 * element. That is what replaced the old render callback — a callback had to re-derive basalt's
 * own styling to look right, and every consumer got it subtly wrong.
 */
function NavLinkBody({ item, active }: { item: SidebarItem; active: boolean }) {
  const Anchor = item.Anchor
  const shared = {
    classNames: { root: classes.link },
    label: item.label,
    leftSection: item.icon,
    rightSection: item.badge ?? (item.count ? <NavCountBadge count={item.count} /> : undefined),
    active,
    // Basalt is the one that stamps `aria-current`, not the theme and not a router `<Link>`'s own
    // default (which a consumer's `SidebarItem.Anchor` may compute independently) — mirrors
    // `app-mobile-nav.tsx`'s identical pattern so both surfaces agree on what "active" means.
    'aria-current': active ? ('page' as const) : undefined,
    // `item.ancestor` (a parent on the winner's path — `useNav`'s exclusivity pass) is NEVER
    // active and never carries `aria-current`; it only earns a `data-ancestor` hook for CSS. A
    // leaf item never has `ancestor` set, so this is a no-op there — shared here rather than
    // duplicated per render path.
    ...(item.ancestor === true && { 'data-ancestor': true }),
    ...(item.onClick !== undefined && { onClick: item.onClick }),
  }
  if (Anchor) {
    return <NavLink component={Anchor} {...shared} />
  }
  return <NavLink component="a" {...(item.href !== undefined && { href: item.href })} {...shared} />
}

/**
 * Group label — a micro-label (docs/DESIGN-SPEC.md §3: mono, uppercase, tracked, faint). Typography
 * lives entirely in `.sectionLabel` (app-sidebar.module.css), not Mantine `Text` props, since the
 * treatment is a shell-specific micro-label rather than a themed primitive. Flush (no intrinsic
 * inset/margin) at every call site, so the collapsible `sectionHeader` owns the padding instead
 * (otherwise the button's hover box would double-inset and hug the text).
 */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text component="div" px={0} mb={0} className={classes.sectionLabel}>
      {children}
    </Text>
  )
}

/**
 * One nav section, owning its own PERSISTED fold.
 *
 * A component per section rather than one state object in `AppSidebar`, because the fold moved from
 * a `useState` keyed by label to `createPersistedState` at `basalt:sidebar-section:<label-slug>` —
 * one hook per section, which can only have a stable hook count inside a component of its own.
 * `defaultCollapsed` is the SEED for that key, so it stops overriding what the user last chose.
 */
function NavSection({ section, collapsed }: { section: SidebarSection; collapsed: boolean }) {
  const [folded, setFolded] = usePersistedFold(
    sidebarSectionFoldKey(section.label),
    Boolean(section.defaultCollapsed),
  )
  const items = section.items.map((item) => (
    <NavItemRow key={item.key} item={item} collapsed={collapsed} />
  ))

  if (!section.collapsible) {
    return (
      <div>
        <div className={classes.sectionBand}>
          <SectionLabel>{section.label}</SectionLabel>
        </div>
        <Stack gap={1}>{items}</Stack>
      </div>
    )
  }

  return (
    <div>
      <UnstyledButton
        className={`${classes.sectionBand} ${classes.sectionHeader}`}
        onClick={() => setFolded(!folded)}
        aria-expanded={!folded}
      >
        <SectionLabel>{section.label}</SectionLabel>
        <IconChevron open={!folded} />
      </UnstyledButton>
      <Collapse expanded={!folded}>
        <Stack gap={1}>{items}</Stack>
      </Collapse>
    </div>
  )
}

function NavItemRow({ item, collapsed }: { item: SidebarItem; collapsed: boolean }) {
  const [opened, { open, close }] = useDisclosure(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // The hover-popover timers outlive the row when a nav re-render unmounts it mid-delay, and a
  // fired `open()` on an unmounted component is a React warning plus a leaked timer.
  useEffect(() => () => clearTimeout(timer.current), [])

  const scheduleOpen = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => open(), HOVER_OPEN_DELAY)
  }
  const scheduleClose = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => close(), HOVER_CLOSE_DELAY)
  }

  const hasChildren = item.children && item.children.length > 0
  const isExpanded = hasChildren && hasActiveDescendant(item)

  // --- Leaf item (no children) ---
  if (!hasChildren) {
    if (item.disabled) {
      return (
        <Tooltip key={item.key} label="Coming soon" position="right" withArrow>
          <Box className={classes.navItem}>
            <NavLink
              classNames={{ root: classes.link }}
              label={item.label}
              leftSection={item.icon}
              data-disabled
            />
          </Box>
        </Tooltip>
      )
    }

    const active = Boolean(item.active)
    return (
      <Tooltip key={item.key} label={item.label} position="right" withArrow disabled={!collapsed}>
        <Box className={classes.navItem}>
          <NavLinkBody item={item} active={active} />
        </Box>
      </Tooltip>
    )
  }

  // --- Parent item with children ---
  const active = Boolean(item.active)

  // When children are already visible inline (active descendant), suppress the hover popover.
  if (isExpanded) {
    return (
      <Box key={item.key}>
        <Tooltip label={item.label} position="right" withArrow disabled={!collapsed}>
          <Box className={classes.navItem}>
            <NavLinkBody item={item} active={active} />
          </Box>
        </Tooltip>
        <Stack gap={0} className={classes.childList}>
          {item.children!.map((child) => {
            if (child.disabled) {
              return (
                <Tooltip key={child.key} label="Coming soon" position="right" withArrow>
                  <Box>
                    <NavLink
                      classNames={{ root: classes.link }}
                      label={child.label}
                      leftSection={child.icon}
                      data-disabled
                    />
                  </Box>
                </Tooltip>
              )
            }
            const childActive = Boolean(child.active)
            return (
              <Box key={child.key}>
                <NavLinkBody item={child} active={childActive} />
              </Box>
            )
          })}
        </Stack>
      </Box>
    )
  }

  return (
    <Popover
      key={item.key}
      opened={opened}
      onClose={close}
      position="right-start"
      offset={4}
      withArrow={false}
      withinPortal
      keepMounted
      zIndex={400}
    >
      <Popover.Target>
        <Tooltip label={item.label} position="right" withArrow disabled={!collapsed}>
          <Box
            className={classes.navItem}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
            onFocus={scheduleOpen}
            onBlur={scheduleClose}
          >
            <NavLinkBody item={item} active={active} />
          </Box>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown
        p={4}
        className={classes.subnavDropdown}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        <Stack gap={0}>
          {item.children!.map((child) => {
            if (child.disabled) {
              return (
                <Tooltip key={child.key} label="Coming soon" position="right" withArrow>
                  <Box>
                    <NavLink
                      classNames={{ root: classes.link }}
                      label={child.label}
                      leftSection={child.icon}
                      data-disabled
                    />
                  </Box>
                </Tooltip>
              )
            }
            const childActive = Boolean(child.active)
            return (
              <Box key={child.key}>
                <NavLinkBody item={child} active={childActive} />
              </Box>
            )
          })}
        </Stack>
      </Popover.Dropdown>

      {/* No inline child list here: `isExpanded` early-returns above, so this branch is only ever
       * reached when the children are NOT visible inline — that is what the popover is for. */}
    </Popover>
  )
}

export function AppSidebar(props: AppSidebarProps) {
  assertRequiredProps('AppSidebar', props, ['brand'])
  const {
    brand,
    sections,
    collapsed,
    onToggleCollapse,
    settingsMenuItems,
    settingsMenu = 'auto',
    account,
    search,
    blocks,
    className,
    style,
  } = props
  // Density-tracking Menu dropdown width (`SPACE_STEP.sidebarSettingsMenuWidth`) — read the ACTIVE
  // resolved level, not the frozen level-0 constant (see that constant's own doc in
  // `tokens/palette.ts`).
  const { step } = useBasaltSpacing()

  const navBlocks = (blocks ?? []).filter((block) => sidebarBlockPlacement(block) === 'nav')
  const bottomBlocks = (blocks ?? []).filter((block) => sidebarBlockPlacement(block) === 'bottom')
  // The rail's stand-in for a progress block: the first one asking for a ring gets one, on the
  // settings row. JS-gated on `collapsed` rather than CSS (unlike every other rail rule) because
  // the mark moves to a DIFFERENT node — nothing in the block's own subtree can express it. With no
  // settings row there is nowhere to put it, and the block simply has no rail form.
  const railRing = bottomBlocks.find(
    (block) => block.kind === 'progress' && sidebarBlockRail(block) === 'ring',
  )

  // The pinned footer row is OPT-IN: it renders only when the consumer supplies settings-menu
  // entries. Most apps put Settings in a nav section instead — rendering the row unconditionally
  // produced a duplicate "Settings" the consumer couldn't remove. On mobile the same entries are
  // reachable as flat rows in the bottom bar's More surface.
  const settingsItems = settingsMenuItems ?? []
  const versionLabel = brand.version !== undefined ? `${brand.name} v${brand.version}` : undefined
  const ringMark =
    collapsed && railRing !== undefined && railRing.kind === 'progress' ? (
      <SidebarProgressRing value={railRing.value} total={railRing.total} />
    ) : null

  // Three or fewer render as flat link rows; four or more keep the gear menu — unless the consumer
  // forced one form, which is the only thing `settingsMenu` does. See both props' docs.
  const flatSettings =
    settingsMenu === 'flat' ||
    (settingsMenu === 'auto' && settingsItems.length <= FLAT_SETTINGS_MAX)
  const settingsRow =
    settingsItems.length === 0 ? null : flatSettings ? (
      <div className={classes.footerLinks}>
        {settingsItems.map((entry, index) => (
          <UnstyledButton
            key={entry.key}
            className={classes.footerBtn}
            onClick={entry.onClick}
            aria-label={entry.label}
          >
            {/* A FIXED slot, so rows align on one icon column whether or not each ships an icon —
                and the gear fallback is functional, not decorative: in the collapsed rail the label
                is hidden and the glyph IS the row, so an icon-less row would be an empty hover
                target. `SettingsMenuItem.icon` stays optional; supply one per row in the flat form
                and the gear never appears. */}
            <span className={classes.footerIconSlot}>{entry.icon ?? <IconGear />}</span>
            <Text className={classes.footerText} fz={VX.text.md}>
              {entry.label}
            </Text>
            {/* The rail ring rides the FIRST row only — one progress block is one mark. */}
            {index === 0 ? ringMark : null}
          </UnstyledButton>
        ))}
        {versionLabel !== undefined && (
          <Text component="div" className={classes.footerVersion}>
            {versionLabel}
          </Text>
        )}
      </div>
    ) : (
      <Group gap="xs" wrap="nowrap">
        <Menu position="right-start" withArrow width={step.sidebarSettingsMenuWidth} zIndex={500}>
          <Menu.Target>
            <UnstyledButton className={classes.footerBtn} aria-label="Settings">
              <IconGear />
              <Text className={classes.footerText} fz={VX.text.md}>
                Settings
              </Text>
              {ringMark}
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            {settingsItems.map((entry) => (
              <Menu.Item key={entry.key} leftSection={entry.icon} onClick={entry.onClick}>
                {entry.label}
              </Menu.Item>
            ))}
            {versionLabel !== undefined && (
              <>
                <Menu.Divider />
                <Menu.Label>{versionLabel}</Menu.Label>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    )

  return (
    <Stack
      gap={0}
      h="100%"
      className={cx(classes.root, className)}
      data-collapsed={collapsed || undefined}
      {...(style !== undefined && { style })}
    >
      <Group className={classes.brand} gap="sm" wrap="nowrap">
        <Group className={classes.brandLead} gap="sm" wrap="nowrap">
          {brand.logoSrc && (
            <img
              src={brand.logoSrc}
              alt={brand.logoAlt ?? brand.name}
              width={26}
              height={26}
              style={{ display: 'block' }}
            />
          )}
          <BrandName brand={brand} menuWidth={step.sidebarAccountMenuWidth} />
        </Group>
        <ActionIcon
          variant="subtle"
          // A numeric size, not the named `"md"` — same opt-out as `connectivity-indicator.tsx`'s
          // toolbar icon (see that comment): this is a plain collapse-toggle icon, not a control meant
          // to match a `size="md"` Input/Button, so it must not pick up the theme's `ActionIcon.extend`
          // control-height override. Reproduces Mantine's own static `--ai-size-md` (28px).
          size={28}
          visibleFrom="sm"
          className={classes.ghostIcon}
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconCollapse collapsed={collapsed} />
        </ActionIcon>
      </Group>

      {search && (
        <div className={classes.searchSlot}>
          <SidebarSearch {...search} collapsed={collapsed} />
        </div>
      )}

      <ScrollArea
        type="hover"
        scrollbars="y"
        scrollbarSize={9}
        className={classes.navScroll}
        classNames={{ viewport: classes.navViewport }}
      >
        <Stack gap={0} className={classes.nav}>
          {sections.map((section) => (
            <NavSection key={section.label} section={section} collapsed={collapsed} />
          ))}
          {navBlocks.map((block) => (
            <SidebarBlockView key={block.key} block={block} />
          ))}
        </Stack>
      </ScrollArea>

      {(bottomBlocks.length > 0 || settingsRow !== null || account !== undefined) && (
        <Stack gap={0} className={classes.footer}>
          {bottomBlocks.map((block) => (
            <SidebarBlockView key={block.key} block={block} />
          ))}
          {settingsRow}
          {account !== undefined && (
            <SidebarAccount
              state={account.state}
              {...(account.actions !== undefined && { actions: account.actions })}
              {...(account.showEmail !== undefined && { showEmail: account.showEmail })}
            />
          )}
        </Stack>
      )}
    </Stack>
  )
}
