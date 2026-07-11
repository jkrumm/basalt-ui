/**
 * Presentational app sidebar — a collapsible icon-rail with grouped nav sections, a brand header
 * (logo + collapse/close toggle), and a footer settings menu (consumer-supplied entries + an
 * optional version label).
 *
 * Router-agnostic by design: active detection, typed navigation and the collapse store stay in the
 * consumer (or in `BasaltShell`), which feeds resolved `sections` + `collapsed`/`onToggleCollapse`/
 * `onClose` here. Each item renders through `renderNavLink` when supplied, else a plain `<a href>`
 * with `item.onClick` — never a router primitive. Active state arrives as `item.active`.
 *
 * Collapse is desktop-only: the rail styling is gated behind a `min-width: sm` media query so the
 * mobile drawer always shows full labels regardless of the persisted `collapsed` flag. The close
 * button is mobile-only (`hiddenFrom="sm"`); the collapse chevron is desktop-only (`visibleFrom`).
 * Grounded verbatim in argo `apps/dashboard/src/components/app-shell/app-sidebar.tsx`.
 */
import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  Menu,
  NavLink,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BrandConfig, SettingsMenuItem, SidebarItem, SidebarSection } from './index'
import { SidebarAccount } from './app-sidebar-account'
import type { BasaltAccountProps } from './account-types'
import { VX } from '../tokens'
import classes from './app-sidebar.module.css'

/** Renders a single nav item. The consumer's router `Link` lives here; `active` is precomputed. */
export type NavLinkRenderer = (item: SidebarItem, opts: { active: boolean }) => ReactNode

export type AppSidebarProps = {
  brand: BrandConfig
  sections: SidebarSection[]
  collapsed: boolean
  onToggleCollapse: () => void
  onClose: () => void
  /**
   * Optional consumer link renderer (e.g. a router `<Link>`). Receives the precomputed `active`
   * flag. When omitted, items fall back to a plain `<a href>` + `item.onClick`.
   */
  renderNavLink?: NavLinkRenderer
  /**
   * Footer settings-menu entries (theme switcher, devtools, …) — supplied by the consumer.
   * The pinned footer "Settings" row renders ONLY when this is a non-empty list — apps that put
   * Settings in a nav section (the common case) omit this and get no duplicate footer row. The
   * `brand.version` label renders inside this menu, so it also only shows when the row does.
   */
  settingsMenuItems?: SettingsMenuItem[]
  /** Extra content appended to the sidebar footer, beside the settings menu (mobile close, etc.). */
  footerExtra?: ReactNode
  /**
   * Optional account row rendered below the settings menu in the sidebar footer (see
   * `SidebarAccount` / `BasaltAccountProps`), separated by its own top hairline. Omitting it
   * reproduces today's footer unchanged.
   */
  account?: BasaltAccountProps
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

function IconClose() {
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
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
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

/** Renders a nav link body without the Tooltip/Box wrapper. */
function NavLinkBody({
  item,
  active,
  renderNavLink,
}: {
  item: SidebarItem
  active: boolean
  renderNavLink?: NavLinkRenderer | undefined
}) {
  if (renderNavLink) {
    return <>{renderNavLink(item, { active })}</>
  }
  return (
    <NavLink
      classNames={{ root: classes.link }}
      component="a"
      label={item.label}
      leftSection={item.icon}
      rightSection={item.badge}
      active={active}
      {...(item.href !== undefined && { href: item.href })}
      {...(item.onClick !== undefined && { onClick: item.onClick })}
    />
  )
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

function NavItemRow({
  item,
  collapsed,
  renderNavLink,
}: {
  item: SidebarItem
  collapsed: boolean
  renderNavLink?: NavLinkRenderer | undefined
}) {
  const [opened, { open, close }] = useDisclosure(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
          <NavLinkBody item={item} active={active} renderNavLink={renderNavLink} />
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
            <NavLinkBody item={item} active={active} renderNavLink={renderNavLink} />
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
                <NavLinkBody item={child} active={childActive} renderNavLink={renderNavLink} />
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
            <NavLinkBody item={item} active={active} renderNavLink={renderNavLink} />
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
                <NavLinkBody item={child} active={childActive} renderNavLink={renderNavLink} />
              </Box>
            )
          })}
        </Stack>
      </Popover.Dropdown>

      {/* Inline children when active */}
      {isExpanded && (
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
                <NavLinkBody item={child} active={childActive} renderNavLink={renderNavLink} />
              </Box>
            )
          })}
        </Stack>
      )}
    </Popover>
  )
}

export function AppSidebar({
  brand,
  sections,
  collapsed,
  onToggleCollapse,
  onClose,
  renderNavLink,
  settingsMenuItems,
  footerExtra,
  account,
}: AppSidebarProps) {
  // Desktop collapsible-section state, keyed by section label. Seeded once from each section's
  // `defaultCollapsed`; non-collapsible sections are simply never read here.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.label, Boolean(s.defaultCollapsed)])),
  )

  const renderSectionItems = (section: SidebarSection) =>
    section.items.map((item) => (
      <NavItemRow key={item.key} item={item} collapsed={collapsed} renderNavLink={renderNavLink} />
    ))

  // Mobile-only footer controls (close + consumer extras) — must render regardless of whether
  // the settings row does, or the mobile drawer loses its close affordance.
  const mobileControls = (
    <Group gap={2} wrap="nowrap" hiddenFrom="sm">
      {footerExtra}
      <ActionIcon
        variant="subtle"
        className={classes.ghostIcon}
        onClick={onClose}
        aria-label="Close navigation"
      >
        <IconClose />
      </ActionIcon>
    </Group>
  )

  // The pinned footer "Settings" row is OPT-IN: it renders only when the consumer supplies
  // settings-menu entries. Most apps put Settings in a nav section instead — rendering the row
  // unconditionally produced a duplicate "Settings" the consumer couldn't remove. Without it,
  // the mobile controls still render standalone (invisible on desktop via hiddenFrom).
  const hasSettingsMenu = (settingsMenuItems?.length ?? 0) > 0
  const settingsRow = hasSettingsMenu ? (
    <Group {...(account ? {} : { className: classes.footer })} gap="xs" wrap="nowrap">
      <Menu position="right-start" withArrow width={200} zIndex={500}>
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
      {mobileControls}
    </Group>
  ) : (
    <Group
      {...(account ? {} : { className: classes.footer })}
      gap="xs"
      wrap="nowrap"
      hiddenFrom="sm"
    >
      {mobileControls}
    </Group>
  )

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
          size="md"
          visibleFrom="sm"
          className={`${classes.collapseBtn} ${classes.ghostIcon}`}
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconCollapse collapsed={collapsed} />
        </ActionIcon>
      </Group>

      <Stack gap={0} className={classes.nav} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
      </Stack>

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
