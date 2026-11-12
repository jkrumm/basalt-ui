/**
 * Root route: the persistent app shell for the playground.
 *
 * The whole navigation is ONE typed definition (`demo/nav-model.tsx`), handed to `AppShell nav={NAV}`.
 * The shell matches every destination against the live router for `active` and projects the one
 * declaration onto the rail, the phone tab bar, the breadcrumb and the document title.
 *
 * Page content renders through `<Outlet />`; each destination is a file route under `routes/`.
 */
import { spotlight } from '@mantine/spotlight'
import { Outlet, createRootRouteWithContext, useNavigate } from '@tanstack/react-router'
import type { BasaltRouterContext } from 'basalt-ui'
import { AppShell } from 'basalt-ui/shell'
import type { ComponentProps } from 'react'
import { NAV } from '../demo/nav-model'
import { useUserScenario } from '../demo/user-scenario-store'
import type { UserScenario } from '../demo/user-scenario-store'

type ShellProps = ComponentProps<typeof AppShell>
type Account = NonNullable<ShellProps['account']>
type Blocks = NonNullable<ShellProps['blocks']>

/**
 * Live per-destination badges. Static here, so it is hoisted: a fresh literal per render would be a
 * new identity into the shell on every commit. A real app memoizes its query result.
 */
const BADGES = { cards: { count: 4 } }

/** Rail blocks, declared once: a progress row pinned at the bottom of the rail. */
const BLOCKS: Blocks = [
  { kind: 'progress', id: 'getting-started', label: 'Getting started', value: 0.2 },
]

const noop = (): void => {}

function accountOf(scenario: UserScenario, setScenario: (next: UserScenario) => void): Account {
  if (scenario.auth === 'loading') return { status: 'loading' }
  if (scenario.auth === 'signed-out') {
    return { status: 'signed-out', onSignIn: () => setScenario({ ...scenario, auth: 'signed-in' }) }
  }
  return {
    status: 'signed-in',
    name: scenario.name,
    detail: scenario.email,
    ...(scenario.image !== '' && { avatar: scenario.image }),
    rows: [{ label: 'Manage account', onClick: noop }],
    onSignOut: () => setScenario({ ...scenario, auth: 'signed-out' }),
  }
}

function RootLayout() {
  const navigate = useNavigate()
  const [scenario, setScenario] = useUserScenario()

  return (
    <AppShell
      nav={NAV}
      brand={{ name: 'Basalt' }}
      badges={BADGES}
      blocks={BLOCKS}
      search={{ onOpen: () => spotlight.open() }}
      settings={{
        mode: 'menu',
        items: [
          {
            id: 'preferences',
            label: 'Preferences',
            onClick: () => void navigate({ to: '/settings' }),
          },
          {
            id: 'billing',
            label: 'Billing',
            onClick: () => void navigate({ to: '/settings', hash: 'billing' }),
          },
        ],
      }}
      account={accountOf(scenario, setScenario)}
    >
      <Outlet />
    </AppShell>
  )
}

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  staticData: { title: 'Home' },
  component: RootLayout,
})
