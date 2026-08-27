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
import { useMantineColorScheme } from '@mantine/core'
import { Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { BasaltShell, ConnectivityIndicator, ThemeToggle } from 'basalt-ui'
import type { AccountMenuItem, BasaltAccountActions, GlobalAction } from 'basalt-ui'
import { useNav } from 'basalt-ui/router-tanstack'
import { NotificationBell } from 'basalt-ui/notifications'
import { openSpotlight } from 'basalt-ui/commands'
import { useEffect } from 'react'
import { registerColorSchemeControl } from '../demo/commands'
import { IconPalette, IconSparkle } from '../demo/icons'
import { NAV, SIDEBAR_BLOCKS } from '../demo/nav-model'
import { scenarioToAccountState, useUserScenario } from '../demo/user-scenario-store'

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

/**
 * Live per-destination badges. Static here, so it is hoisted: `useNav`'s memo deps include this
 * object, and a fresh literal per render would defeat it. A real app memoizes its query result.
 */
const navBadges = { dashboard: 4 }

/**
 * `globalActions` is DECLARED DATA (`GlobalAction[]`, was a `ReactNode` row), so basalt owns the
 * mobile projection rather than the caller: the first two default to `'bar'`, the rest to the
 * header's single kebab, and a page's `PageBar` shares that same kebab.
 *
 * The policy per entry is deliberate, not cosmetic. Connectivity and the notification bell hold
 * LIVE state and stay `'bar'` — a `'more'` node is mounted a second time inside the kebab's
 * dropdown, which for a live indicator means two subscriptions and two readings. `ThemeToggle` is
 * self-contained and idempotent, so it folds into `'more'`; the color scheme is also reachable
 * from the account menu's settings rows, so nothing is lost on a phone.
 *
 * The date-range filter that used to sit here is gone: a page-level filter belongs in that page's
 * `PageBar.filters` (law C1), not in a persistent header slot every route pays for.
 */
/**
 * The workspace switcher's rows (`brand.menu`). Static and hoisted, same as `navBadges` — a fresh
 * array per render would be a new identity into the brand row on every commit.
 */
const WORKSPACE_MENU: AccountMenuItem[] = [
  { key: 'switch', label: 'Switch workspace', onClick: () => {} },
  { key: 'new', label: 'New workspace', onClick: () => {} },
  { key: 'settings', label: 'Workspace settings', onClick: () => {} },
]

const GLOBAL_ACTIONS: GlobalAction[] = [
  { key: 'connectivity', node: <ConnectivityIndicator />, mobile: 'bar' },
  { key: 'notifications', node: <NotificationBell />, mobile: 'bar' },
  { key: 'theme', node: <ThemeToggle />, mobile: 'more' },
]

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
  const nav = useNav(NAV, { badges: navBadges })

  return (
    <BasaltShell
      // `menu` makes the brand row a `Name ▾` workspace switcher — the rows are `AccountMenuItem`s,
      // the same shape the account menu takes, so there is no second vocabulary for one dropdown.
      brand={{ name: 'Basalt', version: __APP_VERSION__, menu: WORKSPACE_MENU }}
      {...nav}
      // `actions` is a TUPLE of one or two — a third icon would squeeze the ⌘K trigger under the
      // width where its placeholder still reads, so the type refuses it rather than the layout.
      search={{
        onOpen: () => openSpotlight(),
        actions: [
          { key: 'new', label: 'New page', icon: <IconSparkle />, onClick: () => openSpotlight() },
          { key: 'theme-lab', label: 'Theme lab', icon: <IconPalette />, onClick: () => {} },
        ],
      }}
      // All three block kinds, declared once (`demo/nav-model.tsx`) and projected by basalt onto the
      // desktop sidebar, the collapsed rail and the mobile More sheet — the two `ReactNode` extras
      // this replaced (`sidebarNavExtra`, `mobileNav.moreExtra`) could express none of that.
      sidebarBlocks={SIDEBAR_BLOCKS}
      globalActions={GLOBAL_ACTIONS}
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
