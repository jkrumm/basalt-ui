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
import { Outlet, createRootRouteWithContext, useNavigate } from '@tanstack/react-router'
import { BasaltShell, ThemeToggle, useNav } from 'basalt-ui'
import type { BasaltRouterContext } from 'basalt-ui'
import type { GlobalAction } from 'basalt-ui/controls'
import { NotificationBell } from 'basalt-ui/commands'
import { spotlight } from '@mantine/spotlight'
import type { ComponentProps } from 'react'
import { IconPalette, IconSparkle } from '../demo/icons'
import { NAV, SIDEBAR_BLOCKS } from '../demo/nav-model'
import { scenarioToAccountState, useUserScenario } from '../demo/user-scenario-store'

type ShellProps = ComponentProps<typeof BasaltShell>
type BrandConfig = ShellProps['brand']
type AccountActions = NonNullable<ShellProps['account']>['actions']

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
 * `globalActions` is DECLARED DATA (`GlobalAction[]`), so basalt owns the mobile projection: the
 * first two default to `'bar'`, the rest fold into the header's single kebab. The bell holds LIVE
 * state and stays `'bar'` — a `'more'` node is mounted a second time inside the kebab's dropdown,
 * which for a live node means two subscriptions. `ThemeToggle` is self-contained and idempotent, so
 * it folds into `'more'`; the color scheme is also reachable from the account menu.
 */
/**
 * The workspace switcher's rows (`brand.menu`). Static and hoisted, same as `navBadges` — a fresh
 * array per render would be a new identity into the brand row on every commit.
 */
const WORKSPACE_MENU: NonNullable<BrandConfig['menu']> = [
  { key: 'switch', label: 'Switch workspace', onClick: () => {} },
  { key: 'new', label: 'New workspace', onClick: () => {} },
  { key: 'settings', label: 'Workspace settings', onClick: () => {} },
]

const GLOBAL_ACTIONS: GlobalAction[] = [
  { key: 'notifications', node: <NotificationBell />, mobile: 'bar' },
  { key: 'theme', node: <ThemeToggle />, mobile: 'more' },
]

function RootLayout() {
  const navigate = useNavigate()
  const [scenario, setScenario] = useUserScenario()

  const accountState = scenarioToAccountState(scenario)
  const accountActions: AccountActions = {
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
      // `menu` makes the brand row a `Name ▾` workspace switcher — the rows are account-menu items,
      // the same shape the account menu takes, so there is no second vocabulary for one dropdown.
      brand={{ name: 'Basalt', version: __APP_VERSION__, menu: WORKSPACE_MENU }}
      {...nav}
      // `actions` is a TUPLE of one or two — a third icon would squeeze the ⌘K trigger under the
      // width where its placeholder still reads, so the type refuses it rather than the layout.
      search={{
        onOpen: () => spotlight.open(),
        actions: [
          { key: 'new', label: 'New page', icon: <IconSparkle />, onClick: () => spotlight.open() },
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

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  staticData: { title: 'Home' },
  component: RootLayout,
})
