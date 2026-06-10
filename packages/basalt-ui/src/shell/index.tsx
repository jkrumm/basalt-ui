/**
 * BasaltShell — the application shell (collapsible sidebar rail + slim top bar + mobile bottom
 * nav). Grounded in argo's app-shell: the `SidebarItem`/`SidebarSection` types come verbatim
 * from `apps/dashboard/src/components/app-shell/app-sidebar.tsx`, and the layout mirrors the
 * `AppShell` composition in `apps/dashboard/src/routes/__root.tsx`.
 *
 * S0: a placeholder Mantine `AppShell` skeleton with a stable public prop surface. Route
 * coupling (active detection, collapse store, mobile groups) and the full sidebar/breadcrumb/
 * page-header wiring land in S3-S4. Mantine usage is allowed here.
 */
import { AppShell, Badge, Group, Stack, Text } from '@mantine/core'
import type { MouseEvent, ReactNode } from 'react'

export { AppSidebar, type AppSidebarProps } from './app-sidebar'
export { MobileNav, type MobileNavItem, type MobileNavSection } from './app-mobile-nav'
export { AppBreadcrumbs } from './app-breadcrumbs'
export { PageHeaderProvider, PageActions, PageActionsOutlet } from './page-header'

/** A single sidebar destination. Grounded verbatim in argo's `SidebarItem`. */
export type SidebarItem = {
  key: string
  label: string
  /** Short label for the mobile bottom-nav; falls back to `label`. */
  short?: string
  /** Whether this destination appears in the mobile bottom-nav. */
  mobile?: boolean
  icon: ReactNode
  href?: string
  active?: boolean
  disabled?: boolean
  onClick?: (e: MouseEvent) => void
  badge?: ReactNode
}

/** A labelled group of sidebar items. Grounded verbatim in argo's `SidebarSection`. */
export type SidebarSection = {
  label: string
  items: SidebarItem[]
  /** Group icon, used by the mobile tabs. */
  icon?: ReactNode
  /** Desktop: render a clickable group header that collapses its items. */
  collapsible?: boolean
  /** Initial collapsed state when `collapsible`. */
  defaultCollapsed?: boolean
  /** `false` excludes the section from the primary mobile group tabs. */
  mobileTab?: boolean
}

/** Brand identity shown in the sidebar header (logo + name). */
export type BrandConfig = {
  /** Display name (e.g. "Argo"). */
  name: string
  /** Logo source URL (e.g. "/favicon.svg"). */
  logoSrc?: string
  /** Logo alt text; falls back to `name`. */
  logoAlt?: string
  /** App version string surfaced in the settings menu (e.g. from `__APP_VERSION__`). */
  version?: string
}

/** A settings-menu entry (e.g. theme switcher, devtools). */
export type SettingsMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  onClick?: (e: MouseEvent) => void
}

export type BasaltShellProps = {
  /** Brand identity for the sidebar header. */
  brand: BrandConfig
  /** Grouped nav sections rendered in the sidebar (and projected to the mobile bottom nav). */
  sections: SidebarSection[]
  /** Persistent, shell-owned top-bar slot (timer, refresh, notifications). */
  globalActions?: ReactNode
  /** Extra content appended to the sidebar footer, beside the settings menu. */
  sidebarFooterExtra?: ReactNode
  /** Entries appended to the sidebar settings menu. */
  settingsMenuItems?: SettingsMenuItem[]
  /** localStorage key for the persisted sidebar-collapsed flag. */
  storageKey?: string
  /** Page content. */
  children?: ReactNode
}

/**
 * Sidebar nav count badge — a neutral transparent pill. Grounded in argo's `navBadge` helper
 * (`<Badge size="sm" variant="transparent" color="gray" radius="sm">`). Returns `null` for a
 * zero/empty count so the badge slot stays clean.
 */
export function NavCountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <Badge size="sm" variant="transparent" color="gray" radius="sm">
      {count}
    </Badge>
  )
}

export function BasaltShell({
  brand,
  sections,
  globalActions,
  sidebarFooterExtra,
  settingsMenuItems: _settingsMenuItems,
  storageKey: _storageKey,
  children,
}: BasaltShellProps) {
  return (
    <AppShell
      h="100dvh"
      layout="alt"
      header={{ height: { base: 108, sm: 56 } }}
      navbar={{ width: { base: 240, sm: 240 }, breakpoint: 'sm', collapsed: { mobile: true } }}
      footer={{ height: { base: 56, sm: 0 } }}
      padding="md"
    >
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Text size="sm" fw={600} truncate>
            {brand.name}
          </Text>
          {globalActions}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="lg" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {sections.map((section) => (
            <Stack key={section.label} gap={2}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {section.label}
              </Text>
            </Stack>
          ))}
        </Stack>
        {sidebarFooterExtra}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
