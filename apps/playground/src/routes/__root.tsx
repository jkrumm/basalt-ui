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
import { NavLink as MantineNavLink, Text, useMantineColorScheme } from '@mantine/core'
import { Link, Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { BasaltShell, ConnectivityIndicator, ThemeToggle } from 'basalt-ui'
import type { BasaltAccountActions, BreadcrumbLinkRenderer, NavLinkRenderer } from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { NotificationBell } from 'basalt-ui/notifications'
import { openSpotlight } from 'basalt-ui/commands'
import { useCallback, useEffect, useMemo } from 'react'
import { DashboardDateFilter } from '../demo/DashboardDateFilter'
import { registerColorSchemeControl } from '../demo/commands'
import { NAV_MODEL, withActive } from '../demo/nav-model'
import { scenarioToAccountState, useUserScenario } from '../demo/user-scenario-store'

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

function RootLayout() {
  const { isActive } = useBasaltNav()
  const navigate = useNavigate()
  const [scenario, setScenario] = useUserScenario()
  const { setColorScheme } = useMantineColorScheme()

  useEffect(() => {
    registerColorSchemeControl({ setColorScheme })
    return () => registerColorSchemeControl(null)
  }, [setColorScheme])

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

  const sections = useMemo(() => withActive(NAV_MODEL, isActive), [isActive])

  return (
    <BasaltShell
      brand={{ name: 'Basalt', version: __APP_VERSION__ }}
      sections={sections}
      search={{ onOpen: () => openSpotlight() }}
      renderNavLink={renderNavLink}
      renderBreadcrumbLink={renderBreadcrumbLink}
      globalActions={
        <>
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
