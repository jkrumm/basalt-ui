/**
 * Root route — the persistent app shell for the playground.
 *
 * This is the mature counterpart to the old `useState` page-switcher: the playground is now a real
 * TanStack Router app on browser history, so the URL is the single source of truth for "where am
 * I". The shell stays exactly as router-agnostic as it ships — we drive it through the documented
 * seams:
 *   - `active` comes from the shipped `useBasaltNav().isActive(href)` adapter (reactive to the URL),
 *   - `renderNavLink` renders a real TanStack `<Link>` so clicks update the URL + enable
 *     intent-preloading + back/forward,
 *   - the shell's own breadcrumb (`findActiveCrumb`) follows `active`, so it tracks the route for
 *     free.
 * Page content renders through `<Outlet />`; each destination is a file route under `routes/`.
 */
import { Kbd, NavLink as MantineNavLink, Text, UnstyledButton } from '@mantine/core'
import { Link, Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { BasaltShell, ConnectivityIndicator, NavCountBadge, ThemeToggle } from 'basalt-ui'
import type {
  BasaltAccountActions,
  BreadcrumbLinkRenderer,
  NavLinkRenderer,
  SidebarSection,
} from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { NotificationBell } from 'basalt-ui/notifications'
import { openSpotlight } from 'basalt-ui/commands'
import { VX } from 'basalt-ui/tokens'
import { useCallback, useMemo } from 'react'
import { DashboardDateFilter } from '../demo/DashboardDateFilter'
import {
  IconActivity,
  IconChart,
  IconComponents,
  IconDashboard,
  IconSearch,
  IconSettings,
  IconUser,
} from '../demo/icons'
import { scenarioToAccountState, useUserScenario } from '../demo/user-scenario-store'

/**
 * Header search trigger (docs/DESIGN-SPEC.md §5 "Header"): panel + shadow-card, radius 8, faint
 * label, mono ⌘K chip. Opens the same Spotlight the `./commands` battery wires up in main.tsx
 * (`CommandsDemoPage` registers the demo command palette while it's mounted).
 */
function SearchTrigger() {
  return (
    <UnstyledButton
      onClick={() => openSpotlight()}
      aria-label="Search (Mod+K)"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 30,
        minWidth: 220,
        padding: '0 10px',
        borderRadius: VX.radiusCtrl,
        backgroundColor: VX.surface.panel,
        boxShadow: VX.shadowCard,
        color: VX.faint,
      }}
    >
      <IconSearch />
      <Text size="sm" style={{ color: VX.faint, flex: 1, textAlign: 'left' }}>
        Search
      </Text>
      <Kbd size="xs">⌘K</Kbd>
    </UnstyledButton>
  )
}

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

function RootLayout() {
  const { isActive } = useBasaltNav()
  const navigate = useNavigate()
  const [scenario, setScenario] = useUserScenario()

  const accountState = scenarioToAccountState(scenario)
  const accountActions: BasaltAccountActions = {
    onSignIn: () => setScenario({ ...scenario, auth: 'signed-in' }),
    onSignOut: () => setScenario({ ...scenario, auth: 'signed-out' }),
    onUpgrade: () => setScenario({ ...scenario, plan: 'pro' }),
    onManageAccount: () => navigate({ to: '/settings', hash: 'account' }),
    onManageBilling: () => navigate({ to: '/settings', hash: 'billing' }),
  }

  /** Renders breadcrumb parent segments as client-side TanStack Links. */
  const renderBreadcrumbLink = useCallback<BreadcrumbLinkRenderer>(
    (href, label) => (
      <Text size="sm" c="dimmed" truncate component={Link} to={href as never}>
        {label}
      </Text>
    ),
    [],
  )

  /**
   * Router-agnostic link renderer wired to a real TanStack `<Link>`. Dashboard
   * links use `search={true}` to preserve the current `?range=` param across
   * sub-page switches. Non-dashboard links get no search injection — the
   * localStorage fallback in `validateSearch` restores the selection when
   * navigating back to `/dashboard/*`.
   */
  const renderNavLink = useCallback<NavLinkRenderer>((item, { active }) => {
    const href = item.href ?? '/'
    const isDashboard = href === '/dashboard' || href.startsWith('/dashboard/')
    return (
      <MantineNavLink
        component={Link}
        to={href as never}
        {...(isDashboard ? { search: true as never } : {})}
        label={item.label}
        leftSection={item.icon}
        rightSection={item.badge}
        active={active}
      />
    )
  }, [])

  const sections = useMemo<SidebarSection[]>(
    () => [
      {
        label: 'Overview',
        icon: <IconDashboard />,
        items: [
          {
            key: 'dashboard',
            label: 'Dashboard',
            short: 'Home',
            mobile: true,
            icon: <IconDashboard />,
            href: '/dashboard',
            active: isActive('/dashboard'),
            badge: <NavCountBadge count={4} />,
            // Child items render text-only against the left rail (no icon) — SidebarItem.icon is
            // a required ReactNode slot, so `undefined` opts out of rendering a left section
            // (see AppSidebar's `leftSection={child.icon}`) rather than omitting the key.
            children: [
              {
                key: 'dashboard-sessions',
                label: 'Sessions',
                icon: undefined,
                href: '/dashboard/sessions',
                active: isActive('/dashboard/sessions'),
              },
              {
                key: 'dashboard-traffic',
                label: 'Traffic',
                icon: undefined,
                href: '/dashboard/traffic',
                active: isActive('/dashboard/traffic'),
              },
              {
                key: 'dashboard-revenue',
                label: 'Revenue',
                icon: undefined,
                href: '/dashboard/revenue',
                active: isActive('/dashboard/revenue'),
              },
            ],
          },
          {
            key: 'activity',
            label: 'Activity',
            mobile: true,
            icon: <IconActivity />,
            href: '/activity',
            active: isActive('/activity'),
          },
        ],
      },
      {
        label: 'Insights',
        icon: <IconChart />,
        collapsible: true,
        items: [
          {
            key: 'charts',
            label: 'Charts',
            mobile: true,
            icon: <IconChart />,
            href: '/charts',
            active: isActive('/charts'),
          },
          {
            key: 'components',
            label: 'Components',
            mobile: true,
            icon: <IconComponents />,
            href: '/components',
            active: isActive('/components'),
          },
          {
            key: 'reports',
            label: 'Reports',
            icon: <IconActivity />,
            disabled: true, // renders the "Coming soon" tooltip path
          },
        ],
      },
      {
        label: 'Data',
        icon: <IconActivity />,
        items: [
          {
            key: 'query',
            label: 'Query',
            mobile: true,
            icon: <IconActivity />,
            href: '/query',
            active: isActive('/query'),
          },
          {
            key: 'router',
            label: 'Router',
            mobile: true,
            icon: <IconActivity />,
            href: '/router',
            active: isActive('/router'),
          },
          {
            key: 'forms',
            label: 'Forms',
            mobile: true,
            icon: <IconComponents />,
            href: '/forms',
            active: isActive('/forms'),
          },
          {
            key: 'notifications',
            label: 'Notifications',
            mobile: true,
            icon: <IconActivity />,
            href: '/notifications',
            active: isActive('/notifications'),
          },
          {
            key: 'commands',
            label: 'Commands',
            mobile: true,
            icon: <IconComponents />,
            href: '/commands',
            active: isActive('/commands'),
          },
          {
            key: 'data',
            label: 'Data',
            mobile: true,
            icon: <IconActivity />,
            href: '/data',
            active: isActive('/data'),
          },
          {
            key: 'agent',
            label: 'Agent',
            mobile: true,
            icon: <IconActivity />,
            href: '/agent',
            active: isActive('/agent'),
          },
          {
            key: 'agent-ai-sdk',
            label: 'Agent (AI SDK)',
            mobile: true,
            icon: <IconActivity />,
            href: '/agent-ai-sdk',
            active: isActive('/agent-ai-sdk'),
          },
          {
            key: 'threads',
            label: 'Threads',
            mobile: true,
            icon: <IconActivity />,
            href: '/threads',
            active: isActive('/threads'),
          },
          {
            key: 'user',
            label: 'User',
            icon: <IconUser />,
            href: '/user',
            active: isActive('/user'),
            mobile: true,
          },
        ],
      },
      {
        label: 'System',
        icon: <IconSettings />,
        items: [
          {
            key: 'connectivity',
            label: 'Connectivity',
            mobile: true,
            icon: <IconActivity />,
            href: '/connectivity',
            active: isActive('/connectivity'),
          },
          {
            key: 'settings',
            label: 'Settings',
            mobile: true,
            icon: <IconSettings />,
            href: '/settings',
            active: isActive('/settings'),
          },
        ],
      },
    ],
    [isActive],
  )

  return (
    <BasaltShell
      brand={{ name: 'Basalt', version: __APP_VERSION__ }}
      sections={sections}
      renderNavLink={renderNavLink}
      renderBreadcrumbLink={renderBreadcrumbLink}
      globalActions={
        <>
          <SearchTrigger />
          <DashboardDateFilter />
          <ConnectivityIndicator />
          <NotificationBell />
          <ThemeToggle />
        </>
      }
      sidebarFooterExtra={
        <Text size="xs" c="dimmed" ta="center" py={4}>
          basalt-ui playground
        </Text>
      }
      account={{ state: accountState, actions: accountActions }}
    >
      <Outlet />
    </BasaltShell>
  )
}

export const Route = createRootRoute({
  staticData: { title: 'Home' },
  component: RootLayout,
})
