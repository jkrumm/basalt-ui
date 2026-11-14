/**
 * Shell cycle 1 (docs/v3/cycles/shell-1.md): the v3 `CommandPalette`, which lists every `defineNav`
 * item, so each fleet page has a palette entry. Each page renders it under the shell.
 *
 * cycle-shell-1: shell-1.9 — the playground root wires `AppShell search` to the provider's 2.x
 * Spotlight, which lists `basalt-ui/commands` entries and no nav destination, and that Spotlight
 * takes Mod+K before this palette sees it (its Mod+B chord does fire). It stays mounted as the build
 * an app author would write; the fix row decides who owns Mod+K.
 *
 * cycle-shell-1: shell-1.20 — a layout route (`routes/cycle/shell/route.tsx`) would mount it once,
 * and the package's playground route-file budget counts `routes/cycle/**`, so each page mounts it.
 */
import { CommandPalette, defineCommands } from 'basalt-ui/shell'
import type { ReactElement } from 'react'
import { fleetApi } from './fleet-api'

const FLEET_COMMANDS = defineCommands({
  'fleet:outage': {
    label: 'Simulate a fleet outage',
    group: 'Fleet',
    run: () => fleetApi.breakNextLoad(),
  },
})

export function FleetPalette(): ReactElement {
  return <CommandPalette commands={FLEET_COMMANDS} />
}
