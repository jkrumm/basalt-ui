/**
 * Root route — the persistent app shell for the playground.
 *
 * The whole navigation is ONE typed definition (`demo/nav-model.tsx`), resolved here by
 * `useNav(NAV)`. That hook does everything this file used to do by hand: it matches every
 * destination against the live router for `active`, builds each one's TanStack `<Link>` anchor
 * (so intent-preloading, middle-click and back/forward all keep working), and returns the two
 * props `BasaltShell` needs — `sections` for the desktop sidebar and `mobileNav` for the bottom
 * bar. The shell stays exactly as router-agnostic as it ships; the router coupling lives in that
 * one hook rather than in a pair of render callbacks.
 *
 * The shell's breadcrumb follows `active` across `sections`, and its parent crumb navigates
 * through the same anchor every nav row uses — so it tracks the route for free, with no second
 * seam to wire.
 *
 * Page content renders through `<Outlet />`; each destination is a file route under `routes/`.
 */
import { Text, useMantineColorScheme } from '@mantine/core'
import { Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { BasaltShell, ConnectivityIndicator, ThemeToggle } from 'basalt-ui'
import type { BasaltAccountActions } from 'basalt-ui'
import { useNav } from 'basalt-ui/router-tanstack'
import { NotificationBell } from 'basalt-ui/notifications'
import { openSpotlight } from 'basalt-ui/commands'
import { useEffect } from 'react'
import { DashboardDateFilter } from '../demo/DashboardDateFilter'
import { registerColorSchemeControl } from '../demo/commands'
import { NAV } from '../demo/nav-model'
import { scenarioToAccountState, useUserScenario } from '../demo/user-scenario-store'

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

/**
 * Pinned to the bottom of the mobile More surface. It replaces the old desktop-only sidebar
 * footer slot: below the `sm` breakpoint there is no sidebar at all, so anything that used to
 * live in its footer has to be reachable from the bar or it is not reachable at all.
 */
const moreExtra = (
  <Text size="xs" c="dimmed" ta="center" py={4}>
    basalt-ui playground
  </Text>
)

/**
 * Live per-destination badges. Static here, so it is hoisted: `useNav`'s memo deps include this
 * object, and a fresh literal per render would defeat it. A real app memoizes its query result.
 */
const navBadges = { dashboard: 4 }

function RootLayout() {
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

  // `badges` keys autocomplete from the definition's id union — a typo is a compile error, not a
  // silently missing badge. A `number` becomes `item.count`: a NavCountBadge on the desktop row
  // and an accent dot on the mobile slot icon (a count glyph is unreadable in a 56px slot).
  const nav = useNav(NAV, { badges: navBadges, moreExtra })

  return (
    <BasaltShell
      brand={{ name: 'Basalt', version: __APP_VERSION__ }}
      {...nav}
      search={{ onOpen: () => openSpotlight() }}
      globalActions={
        <>
          <DashboardDateFilter />
          <ConnectivityIndicator />
          <NotificationBell />
          <ThemeToggle />
        </>
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
