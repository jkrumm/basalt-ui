/**
 * Presentational app sidebar — a collapsible icon-rail with grouped nav sections, a brand header
 * (logo + collapse/close toggle), and a footer settings menu (consumer-supplied entries + an
 * optional version label).
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
 * `visibleFrom="sm"`. Grounded in argo `apps/dashboard/src/components/app-shell/app-sidebar.tsx`.
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
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BrandConfig, SettingsMenuItem } from './index'
import type { SidebarItem, SidebarSection } from '../nav/types'
import { NavCountBadge } from './nav-count-badge'
import { SidebarAccount } from './app-sidebar-account'
import type { BasaltAccountProps } from './account-types'
import { SidebarSearch } from './sidebar-search'
import type { SidebarSearchConfig } from './sidebar-search'
import { VX } from '../tokens'
import { useBasaltSpacing } from '../theme'
import classes from './app-sidebar.module.css'

export type AppSidebarProps = {
  brand: BrandConfig
  sections: SidebarSection[]
  collapsed: boolean
  onToggleCollapse: () => void
  /**
   * Footer settings-menu entries (theme switcher, devtools, …) — supplied by the consumer.
   * The pinned footer "Settings" row renders ONLY when this is a non-empty list — apps that put
   * Settings in a nav section (the common case) omit this and get no duplicate footer row. The
   * `brand.version` label renders inside this menu, so it also only shows when the row does.
   */
  settingsMenuItems?: SettingsMenuItem[]
  /**
   * Optional account row rendered below the settings menu in the sidebar footer (see
   * `SidebarAccount` / `BasaltAccountProps`), separated by its own top hairline. Omitting it
   * reproduces today's footer unchanged.
   */
  account?: BasaltAccountProps
  /**
   * Optional search field rendered directly below the brand and ABOVE the nav scroll region — a
   * fixed, non-scrolling row. Pair with basalt-ui/commands' openSpotlight.
   */
  search?: SidebarSearchConfig
  /**
   * Arbitrary content appended after `sections` inside the nav `ScrollArea` — a tree, a filter
   * panel, a project list, anything a set of `SidebarItem`s can't express. Renders as the last
   * child of the scrolling nav column, so a long list scrolls with the rest of the nav instead of
   * fighting it for height. Pass `sections={[]}` to use this slot exclusively; the section-spacing
   * rule only fires between adjacent children, so an empty `sections` produces no orphan divider or
   * dead padding above it.
   *
   * Hidden on the collapsed desktop rail; still present in the mobile drawer, which opens at full
   * width. The rail is ~56px of icon buttons with no sensible representation for arbitrary
   * consumer content, so the CSS media query that drives the rail hides this slot the same way it
   * hides `.childList` — never a JS check on `collapsed`, since that one value is shared by the
   * rail AND the drawer (only the media query tells them apart). `SidebarSearch` gets to adapt
   * itself to the rail (it takes `collapsed` and renders its own icon-only form) because the shell
   * owns that control; it cannot adapt content it knows nothing about, so this slot hides instead
   * of squashing it.
   */
  navExtra?: ReactNode
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {open ? <path d="M6 9l6 6l6 -6" /> : <path d="M9 6l6 6l-6 6" />}
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
 * treatment is a shell-specific micro-label rather than a themed primitive. `flush` drops the
 * intrinsic inset/margin so the collapsible `sectionHeader` can own the padding instead (otherwise
 * the button's hover box double-insets and hugs the text).
 */
function SectionLabel({ children, flush }: { children: ReactNode; flush?: boolean }) {
  return (
    <Text component="div" px={flush ? 0 : 'xs'} mb={flush ? 0 : 4} className={classes.sectionLabel}>
      {children}
    </Text>
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

export function AppSidebar({
  brand,
  sections,
  collapsed,
  onToggleCollapse,
  settingsMenuItems,
  account,
  search,
  navExtra,
}: AppSidebarProps) {
  // Density-tracking Menu dropdown width (`SPACE_STEP.sidebarSettingsMenuWidth`) — read the ACTIVE
  // resolved level, not the frozen level-0 constant (see that constant's own doc in
  // `tokens/palette.ts`).
  const { step } = useBasaltSpacing()

  // Desktop collapsible-section state, keyed by section label. Seeded once from each section's
  // `defaultCollapsed`; non-collapsible sections are simply never read here.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.label, Boolean(s.defaultCollapsed)])),
  )

  const renderSectionItems = (section: SidebarSection) =>
    section.items.map((item) => <NavItemRow key={item.key} item={item} collapsed={collapsed} />)

  // The pinned footer "Settings" row is OPT-IN: it renders only when the consumer supplies
  // settings-menu entries. Most apps put Settings in a nav section instead — rendering the row
  // unconditionally produced a duplicate "Settings" the consumer couldn't remove. On mobile the
  // same entries are reachable as flat rows in the bottom bar's More surface.
  const hasSettingsMenu = (settingsMenuItems?.length ?? 0) > 0
  const settingsRow = hasSettingsMenu ? (
    <Group {...(account ? {} : { className: classes.footer })} gap="xs" wrap="nowrap">
      <Menu position="right-start" withArrow width={step.sidebarSettingsMenuWidth} zIndex={500}>
        <Menu.Target>
          <UnstyledButton className={classes.footerBtn} aria-label="Settings">
            <IconGear />
            <Text className={classes.footerText} fz={VX.text.md}>
              Settings
            </Text>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {settingsMenuItems?.map((entry) => (
            <Menu.Item key={entry.key} leftSection={entry.icon} onClick={entry.onClick}>
              {entry.label}
            </Menu.Item>
          ))}
          {brand.version && (
            <>
              <Menu.Divider />
              <Menu.Label>
                {brand.name} v{brand.version}
              </Menu.Label>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  ) : null

  return (
    <Stack gap={0} h="100%" className={classes.root} data-collapsed={collapsed || undefined}>
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
          <Text className={classes.brandName} fz={VX.text.xl} fw={550}>
            {brand.name}
          </Text>
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
          {sections.map((section) => {
            if (!section.collapsible) {
              return (
                <div key={section.label}>
                  <div className={classes.sectionBand}>
                    <SectionLabel flush>{section.label}</SectionLabel>
                  </div>
                  <Stack gap={1}>{renderSectionItems(section)}</Stack>
                </div>
              )
            }

            const isOpen = !collapsedSections[section.label]
            return (
              <div key={section.label}>
                <UnstyledButton
                  className={`${classes.sectionBand} ${classes.sectionHeader}`}
                  onClick={() =>
                    setCollapsedSections((prev) => ({
                      ...prev,
                      [section.label]: !prev[section.label],
                    }))
                  }
                  aria-expanded={isOpen}
                >
                  <SectionLabel flush>{section.label}</SectionLabel>
                  <IconChevron open={isOpen} />
                </UnstyledButton>
                <Collapse expanded={isOpen}>
                  <Stack gap={1}>{renderSectionItems(section)}</Stack>
                </Collapse>
              </div>
            )
          })}
          {navExtra !== undefined && navExtra !== null && (
            <div className={classes.navExtra}>{navExtra}</div>
          )}
        </Stack>
      </ScrollArea>

      {account ? (
        <Stack gap={0} className={classes.footer}>
          {settingsRow}
          <SidebarAccount
            state={account.state}
            {...(account.actions !== undefined && { actions: account.actions })}
            {...(account.showEmail !== undefined && { showEmail: account.showEmail })}
          />
        </Stack>
      ) : (
        settingsRow
      )}
    </Stack>
  )
}
