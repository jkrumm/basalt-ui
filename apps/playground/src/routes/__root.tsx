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
import type { QueryClient } from '@tanstack/react-query'
import { AppearanceSwitcher } from 'basalt-ui/controls'
import { AppShell, CommandPalette } from 'basalt-ui/shell'
import { Building2, Globe, Palette, Rocket } from 'lucide-react'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { COMMANDS } from '../demo/commands'
import { globals } from '../demo/globals'
import { NAV } from '../demo/nav-model'
import { PeekLayer } from '../demo/peek-layer'
import { ACCENTS } from '../lib/accents'

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

/** The header's appearance popover: the same part the settings page's Appearance pane draws. */
const GLOBAL_ACTIONS: NonNullable<ShellProps['globalActions']> = [
  {
    id: 'appearance',
    kind: 'popover',
    label: 'Appearance',
    icon: Palette,
    mobile: 'more',
    content: () => <AppearanceSwitcher accents={ACCENTS} className="w-80" />,
  },
]

const noop = (): void => {}

/** `?chrome=native-overlay` shows the desktop window chrome in the browser: a 52 header with the lead strip and drag region. */
const CHROME: NonNullable<ShellProps['chrome']> =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('chrome') === 'native-overlay'
    ? 'native-overlay'
    : 'web'

/** The workspaces the switcher lists: the playground has no tenancy, so choosing one only changes the face. */
const WORKSPACES = [
  { id: 'basalt', label: 'Basalt', icon: Rocket },
  { id: 'acme', label: 'Acme Corp', icon: Building2 },
  { id: 'globex', label: 'Globex', icon: Globe },
] as const

/** The shell's account row, signed out: the playground has no auth. */
const ACCOUNT: NonNullable<ShellProps['account']> = { status: 'signed-out', onSignIn: noop }

function RootLayout() {
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string>(WORKSPACES[0].id)
  const current = WORKSPACES.find((w) => w.id === workspaceId) ?? WORKSPACES[0]

  return (
    <AppShell
      nav={NAV}
      brand={{ name: 'Basalt' }}
      badges={BADGES}
      blocks={BLOCKS}
      search={{ onOpen: () => setPaletteOpen(true) }}
      globalActions={GLOBAL_ACTIONS}
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
      workspace={{
        current,
        options: WORKSPACES,
        onSwitch: setWorkspaceId,
        manage: { label: 'Manage workspaces', href: '/settings' },
      }}
      chrome={CHROME}
    >
      <Outlet />
      <PeekLayer />
      <CommandPalette commands={COMMANDS} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </AppShell>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { title: 'Home' },
  validateSearch: globals.validateSearch,
  search: { middlewares: globals.middlewares },
  component: RootLayout,
})
