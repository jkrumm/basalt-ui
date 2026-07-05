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
import { NavLink as MantineNavLink, Text } from '@mantine/core'
import { Link, Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { BasaltShell, ConnectivityIndicator, NavCountBadge, ThemeToggle } from 'basalt-ui'
import type { BreadcrumbLinkRenderer, NavLinkRenderer, SidebarSection } from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { NotificationBell } from 'basalt-ui/notifications'
import { useCallback, useMemo } from 'react'
import {
  IconActivity,
  IconChart,
  IconComponents,
  IconCurrency,
  IconDashboard,
  IconPalette,
  IconSettings,
  IconUser,
} from '../demo/icons'

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

function RootLayout() {
  const { isActive } = useBasaltNav()
  const navigate = useNavigate()

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
   * Router-agnostic link renderer wired to a real TanStack `<Link>`. Uses
   * `search={true}` on dashboard links to preserve the `range` param across
   * sub-page navigation — TanStack Router's native "carry all current params"
   * shorthand.
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
            children: [
              {
                key: 'dashboard-sessions',
                label: 'Sessions',
                icon: <IconUser />,
                href: '/dashboard/sessions',
                active: isActive('/dashboard/sessions'),
              },
              {
                key: 'dashboard-traffic',
                label: 'Traffic',
                icon: <IconChart />,
                href: '/dashboard/traffic',
                active: isActive('/dashboard/traffic'),
              },
              {
                key: 'dashboard-revenue',
                label: 'Revenue',
                icon: <IconCurrency />,
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
          <ConnectivityIndicator />
          <NotificationBell />
          <ThemeToggle />
        </>
      }
      settingsMenuItems={[
        {
          key: 'theme',
          label: 'Theme lab',
          icon: <IconPalette />,
          onClick: () => navigate({ to: '/settings' }),
        },
      ]}
      sidebarFooterExtra={
        <Text size="xs" c="dimmed" ta="center" py={4}>
          basalt-ui playground
        </Text>
      }
    >
      <Outlet />
    </BasaltShell>
  )
}

export const Route = createRootRoute({
  staticData: { title: 'Home' },
  component: RootLayout,
})
