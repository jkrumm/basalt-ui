/**
 * Root route: the persistent shell of the expression app. The whole navigation is ONE typed definition
 * (`lib/nav.ts`); the command palette inside the shell lists every scenario beside the appearance commands,
 * takes `Mod+K`, and the rail's search row opens it.
 */
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AppearanceSwitcher } from 'basalt-ui/controls'
import { AppShell, CommandPalette, defineCommands } from 'basalt-ui/shell'
import { setScheme } from 'basalt-ui'
import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { ACCENTS } from '../lib/accents'
import { NAV } from '../lib/nav'

type ShellProps = ComponentProps<typeof AppShell>

/** The header's appearance popover: the part the settings page's Appearance pane draws. */
const GLOBAL_ACTIONS: NonNullable<ShellProps['globalActions']> = [
  {
    id: 'appearance',
    kind: 'popover',
    label: 'Appearance',
    icon: Palette,
    mobile: 'more',
    content: () => <AppearanceSwitcher accents={ACCENTS} />,
  },
]

const COMMANDS = defineCommands({
  'appearance:light': {
    label: 'Switch to light theme',
    group: 'Appearance',
    icon: Sun,
    run: () => setScheme('light'),
  },
  'appearance:dark': {
    label: 'Switch to dark theme',
    group: 'Appearance',
    icon: Moon,
    run: () => setScheme('dark'),
  },
  'appearance:system': {
    label: 'Match system theme',
    group: 'Appearance',
    icon: Monitor,
    run: () => setScheme('auto'),
  },
})

function RootLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  return (
    <AppShell
      nav={NAV}
      brand={{ name: 'Expression' }}
      search={{ onOpen: () => setPaletteOpen(true) }}
      globalActions={GLOBAL_ACTIONS}
    >
      <Outlet />
      <CommandPalette commands={COMMANDS} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </AppShell>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { title: 'Scenarios' },
  component: RootLayout,
})
