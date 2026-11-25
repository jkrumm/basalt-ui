/**
 * Root route: the persistent app shell for the playground.
 *
 * The whole navigation is ONE typed definition (`demo/nav-model.tsx`), handed to `AppShell nav={NAV}`.
 * The shell matches every destination against the live router for `active` and projects the one
 * declaration onto the rail, the phone tab bar, the breadcrumb and the document title.
 *
 * `/sign-in` and `/register` (`auth/stub.ts`) render bare, outside the shell.
 *
 * Page content renders through `<Outlet />`; each destination is a file route under `routes/`.
 * The app's one `CommandPalette` sits inside the shell: it lists every nav destination and the
 * commands of `demo/commands.ts`, searches the suppliers (`demo/palette-sources.ts`), takes `Mod+K`,
 * and the rail's search row opens it.
 */
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AppearanceSwitcher } from 'basalt-ui/controls'
import { OverlayHost } from 'basalt-ui/page'
import { AppShell, CommandPalette } from 'basalt-ui/shell'
import { Building2, Globe, Palette, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { COMMANDS } from '../demo/commands'
import { globals } from '../demo/globals'
import { NAV } from '../demo/nav-model'
import { OVERLAYS } from '../demo/overlays'
import { PALETTE_SOURCES } from '../demo/palette-sources'
import { PeekLayer } from '../demo/peek-layer'
import { AUTH_PATHS, signOut, useSession } from '../auth/stub'
import { ACCENTS } from '../lib/accents'
import { onPaletteRequest } from '../lib/palette-open'

type ShellProps = ComponentProps<typeof AppShell>
type Blocks = NonNullable<ShellProps['blocks']>

/**
 * Live per-destination badges. Static here, so it is hoisted: a fresh literal per render would be a
 * new identity into the shell on every commit. A real app memoizes its query result.
 */
const BADGES = { 'ref-mail': { count: 3 } }

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

function RootLayout() {
  const navigate = useNavigate()
  const session = useSession()
  const bare = useRouterState({ select: (s) => AUTH_PATHS.includes(s.location.pathname) })
  const [paletteOpen, setPaletteOpen] = useState(false)
  // a page that shows how the palette presents itself asks the one palette to open
  useEffect(() => onPaletteRequest(() => setPaletteOpen(true)), [])
  const [workspaceId, setWorkspaceId] = useState<string>(WORKSPACES[0].id)
  const current = WORKSPACES.find((w) => w.id === workspaceId) ?? WORKSPACES[0]

  // The auth pages draw outside the shell: no rail, no header, no palette.
  if (bare) return <Outlet />

  const account: NonNullable<ShellProps['account']> =
    session === null
      ? { status: 'signed-out', onSignIn: () => void navigate({ to: '/sign-in' }) }
      : { status: 'signed-in', name: session.username, detail: session.email, onSignOut: signOut }

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
      account={account}
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
      <OverlayHost overlays={OVERLAYS} />
      <CommandPalette
        commands={COMMANDS}
        sources={PALETTE_SOURCES}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </AppShell>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { title: 'Home' },
  validateSearch: globals.validateSearch,
  search: { middlewares: globals.middlewares },
  component: RootLayout,
})
