/**
 * Root route: the persistent app shell for the playground.
 *
 * The whole navigation is ONE typed definition (`demo/nav-model.tsx`), handed to `AppShell nav={NAV}`.
 * The shell matches every destination against the live router for `active` and projects the one
 * declaration onto the rail, the phone tab bar, the breadcrumb and the document title.
 *
 * Page content renders through `<Outlet />`; each destination is a file route under `routes/`.
 * The app's one `CommandPalette` sits inside the shell: it lists every nav destination and the
 * commands of `demo/commands.ts`, takes `Mod+K`, and the rail's search row opens it.
 */
import { Outlet, createRootRouteWithContext, useNavigate } from '@tanstack/react-router'
import type { BasaltRouterContext } from 'basalt-ui'
import { AppShell, CommandPalette } from 'basalt-ui/shell'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { COMMANDS } from '../demo/commands'
import { NAV } from '../demo/nav-model'

type ShellProps = ComponentProps<typeof AppShell>
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

/** `?chrome=native-overlay` shows the desktop window chrome in the browser: a 52 header with the lead strip and drag region. */
const CHROME: NonNullable<ShellProps['chrome']> =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('chrome') === 'native-overlay'
    ? 'native-overlay'
    : 'web'

/** The shell's account row, signed out: the playground has no auth. */
const ACCOUNT: NonNullable<ShellProps['account']> = { status: 'signed-out', onSignIn: noop }

function RootLayout() {
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <AppShell
      nav={NAV}
      brand={{ name: 'Basalt' }}
      badges={BADGES}
      blocks={BLOCKS}
      search={{ onOpen: () => setPaletteOpen(true) }}
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
      account={ACCOUNT}
      chrome={CHROME}
    >
      <Outlet />
      <CommandPalette commands={COMMANDS} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </AppShell>
  )
}

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  staticData: { title: 'Home' },
  component: RootLayout,
})
