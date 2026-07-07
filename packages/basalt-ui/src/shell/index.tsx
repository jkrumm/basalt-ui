/**
 * BasaltShell — the application shell (collapsible sidebar rail + slim top bar + mobile bottom
 * nav). Grounded in argo's app-shell: the `SidebarItem`/`SidebarSection` types come verbatim from
 * `apps/dashboard/src/components/app-shell/app-sidebar.tsx`, and the layout mirrors the `AppShell`
 * composition in `apps/dashboard/src/routes/__root.tsx`.
 *
 * Router-agnostic: argo's router coupling (typed `navigate`, `useMatchRoute` active detection, the
 * sidebar-collapse zustand store) stays consumer-side. The consumer resolves `item.active`,
 * `item.onClick`, `item.badge` and (optionally) passes a `renderNavLink` so its router `<Link>`
 * renders each nav row. The breadcrumb is derived from the active item across `sections`, not from a
 * router hook. Collapse is persisted via `@mantine/hooks` `useLocalStorage` keyed by `storageKey`.
 */
import { AppShell, Badge, Divider } from '@mantine/core'
import { useDisclosure, useLocalStorage } from '@mantine/hooks'
import type { MouseEvent, ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import type { NavLinkRenderer } from './app-sidebar'
import { MobileNav } from './app-mobile-nav'
import type { MobileNavItem, MobileNavSection } from './app-mobile-nav'
import { AppBreadcrumbs } from './app-breadcrumbs'
import type { BreadcrumbLinkRenderer } from './app-breadcrumbs'
import { PageActionsOutlet, PageHeaderProvider } from './page-header'
import type { BasaltAccountProps } from './account-types'
import headerClasses from './app-header.module.css'

export { AppSidebar, type AppSidebarProps, type NavLinkRenderer } from './app-sidebar'
export { SidebarAccount } from './app-sidebar-account'
export type {
  AccountBadgeTone,
  BasaltIdentity,
  BasaltRole,
  BasaltPlan,
  AccountMenuItem,
  BasaltAccountState,
  BasaltAccountActions,
  BasaltAccountProps,
} from './account-types'
export {
  MobileNav,
  type MobileNavItem,
  type MobileNavSection,
  type MobileNavLinkRenderer,
} from './app-mobile-nav'
export { AppBreadcrumbs, type BreadcrumbLinkRenderer } from './app-breadcrumbs'
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
  /** Nested sub-navigation items — surfaced in a hover popover and inline when active. */
  children?: SidebarItem[]
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
  /** App version string surfaced in the settings menu (e.g. from a build-time constant). */
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
  /**
   * Optional consumer link renderer (e.g. a router `<Link>`). Receives the precomputed `active`
   * flag. When omitted, items fall back to a plain `<a href>` + `item.onClick`. This is the router
   * seam — no router primitive is imported by the shell.
   */
  renderNavLink?: NavLinkRenderer
  /** Persistent, shell-owned top-bar slot (timer, refresh, notifications). */
  globalActions?: ReactNode
  /** Extra content appended to the sidebar footer, beside the settings menu (mobile close, etc.). */
  sidebarFooterExtra?: ReactNode
  /** Entries appended to the sidebar settings menu. */
  settingsMenuItems?: SettingsMenuItem[]
  /**
   * Optional account row rendered above the settings menu in the sidebar footer (see
   * `SidebarAccount` / `BasaltAccountProps`). Omitting it reproduces today's footer unchanged.
   */
  account?: BasaltAccountProps
  /** localStorage key for the persisted sidebar-collapsed flag. */
  storageKey?: string
  /**
   * Optional router link renderer for the breadcrumb parent segment. When provided, the parent
   * breadcrumb label is rendered through this callback (e.g. a TanStack `<Link>`) instead of a
   * plain `<a href>`, enabling client-side navigation.
   */
  renderBreadcrumbLink?: BreadcrumbLinkRenderer | undefined
  /** Page content. */
  children?: ReactNode
}

/**
 * Sidebar nav count badge — a neutral transparent pill. Grounded in argo's `navBadge` helper
 * (`<Badge size="sm" variant="transparent" color="gray" radius="sm">`). Returns `null` for a
 * zero/empty count so the badge slot stays clean ("ink earns its color", DESIGN.md).
 */
export function NavCountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <Badge size="sm" variant="transparent" color="gray" radius="sm">
      {count}
    </Badge>
  )
}

/** Active nav item across all sections → `{ section, parent?, parentHref?, page }` for the breadcrumb. */
function findActiveCrumb(
  sections: SidebarSection[],
):
  | { section: string; parent?: string | undefined; parentHref?: string | undefined; page: string }
  | undefined {
  for (const section of sections) {
    const found = findActiveWithParent(section.items)
    if (found)
      return {
        section: section.label,
        parent: found.parent,
        parentHref: found.parentHref,
        page: found.page,
      }
  }
  return undefined
}

/** Recursively search for the deepest active item, returning the parent label + href when nested. */
function findActiveWithParent(
  items: SidebarItem[],
  parentLabel?: string | undefined,
  parentHref?: string | undefined,
): { parent?: string | undefined; parentHref?: string | undefined; page: string } | undefined {
  for (const item of items) {
    // Recurse into children first — deeper active match wins over a prefix-matched parent.
    if (item.children) {
      const found = findActiveWithParent(item.children, item.label, item.href)
      if (found) return found
    }
    if (item.active) return { parent: parentLabel, parentHref, page: item.label }
  }
  return undefined
}

/**
 * Mobile bottom-nav projection: one tab per (non-`mobileTab:false`) section, each raising a bottom
 * sheet of that section's destinations. Children are flattened into the section's item list so
 * subpages appear in the mobile drawer.
 */
function toMobileSections(sections: SidebarSection[], closeMobile: () => void): MobileNavSection[] {
  return sections
    .filter((s) => s.mobileTab !== false)
    .map((s) => ({
      key: s.label,
      label: s.label,
      icon: s.icon,
      active: s.items.some((i) => i.active),
      items: flattenSidebarItems(s.items).map(
        (i): MobileNavItem => ({
          key: i.key,
          label: i.label,
          icon: i.icon,
          ...(i.href !== undefined && { href: i.href }),
          ...(i.active !== undefined && { active: i.active }),
          onClick: (e: MouseEvent) => {
            i.onClick?.(e)
            closeMobile()
          },
        }),
      ),
    }))
}

/** Flatten a tree of SidebarItems (including children) into a single-level array. */
function flattenSidebarItems(items: SidebarItem[]): SidebarItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenSidebarItems(item.children) : []),
  ])
}

export function BasaltShell({
  brand,
  sections,
  renderNavLink,
  globalActions,
  sidebarFooterExtra,
  settingsMenuItems,
  storageKey = 'basalt-sidebar-collapsed',
  renderBreadcrumbLink,
  account,
  children,
}: BasaltShellProps) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure()
  const [collapsed, setCollapsed] = useLocalStorage({
    key: storageKey,
    defaultValue: false,
    getInitialValueInEffect: false,
  })
  const toggleCollapse = () => setCollapsed((c) => !c)

  const activeCrumb = findActiveCrumb(sections)
  const mobileSections = toMobileSections(sections, closeMobile)

  return (
    <PageHeaderProvider>
      <AppShell
        h="100dvh"
        layout="alt"
        header={{ height: { base: 96, sm: 48 } }}
        navbar={{
          width: { base: 224, sm: collapsed ? 48 : 224 },
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened },
        }}
        footer={{ height: { base: 52, sm: 0 } }}
        padding="sm"
      >
        <AppShell.Header px="md">
          <div className={headerClasses.bar}>
            <div className={headerClasses.lead}>
              <AppBreadcrumbs {...activeCrumb} renderBreadcrumbLink={renderBreadcrumbLink} />
            </div>
            <PageActionsOutlet className={headerClasses.pageActions} />
            {globalActions && (
              <>
                <Divider
                  orientation="vertical"
                  visibleFrom="sm"
                  style={{ alignSelf: 'stretch', height: 'auto' }}
                />
                <div className={headerClasses.global}>{globalActions}</div>
              </>
            )}
          </div>
        </AppShell.Header>

        <AppShell.Navbar p={0}>
          <AppSidebar
            brand={brand}
            sections={sections}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onClose={closeMobile}
            footerExtra={sidebarFooterExtra}
            {...(renderNavLink !== undefined && { renderNavLink })}
            {...(settingsMenuItems !== undefined && { settingsMenuItems })}
            {...(account !== undefined && { account })}
          />
        </AppShell.Navbar>

        <AppShell.Main>{children}</AppShell.Main>

        <AppShell.Footer hiddenFrom="sm" p={0}>
          <MobileNav
            sections={mobileSections}
            onOpenMore={toggleMobile}
            {...(renderNavLink !== undefined && { renderNavLink })}
          />
        </AppShell.Footer>
      </AppShell>
    </PageHeaderProvider>
  )
}
