import { Outlet, createFileRoute } from '@tanstack/react-router'
import { CommandPalette, defineCommands } from 'basalt-ui/shell'
import type { ReactElement } from 'react'
import { fleetApi } from '../../../cycle/shell-1/fleet-api'

// Shell cycle 1 (docs/v3/cycles/shell-1.md): the fleet app's layout. It mounts the v3
// `CommandPalette`, which lists every `defineNav` item, so each fleet page has a palette entry.
// cycle-shell-1: shell-1.9 — the playground root wires `AppShell search` to the provider's 2.x
// Spotlight, which lists `basalt-ui/commands` entries and no nav destination, and that Spotlight
// takes Mod+K before this palette sees it (its Mod+B chord does fire). It stays mounted here, under
// the shell, as the build an app author would write; the fix row decides who owns Mod+K.
const FLEET_COMMANDS = defineCommands({
  'fleet:outage': {
    label: 'Simulate a fleet outage',
    group: 'Fleet',
    run: () => fleetApi.breakNextLoad(),
  },
})

function FleetLayout(): ReactElement {
  return (
    <>
      <Outlet />
      <CommandPalette commands={FLEET_COMMANDS} />
    </>
  )
}

export const Route = createFileRoute('/cycle/shell')({
  component: FleetLayout,
})
