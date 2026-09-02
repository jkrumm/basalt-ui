// The compile-time regression guard for `runCommand` / `CommandId` (`basalt-ui/commands`) — the
// same slot mechanism `overlays.ts`/`notifications.ts` pin, unproven for commands until now. The
// `commands` slot is already augmented globally by `demo/commands.ts` (`COMMANDS`, ids including
// `'nav:search'`); re-declaring it here would conflict, so this reads the real registration.
import { runCommand } from 'basalt-ui/commands'
import type { CommandId } from 'basalt-ui/commands'

export function openSearch(): void {
  runCommand('nav:search')
}

// @ts-expect-error 'nope:nope' is not a registered command id
runCommand('nope:nope')

export const id: CommandId = 'nav:search'
// @ts-expect-error 'nope:nope' is not a CommandId
export const badId: CommandId = 'nope:nope'

// PROVES: after defineCommands registers the app's ids, runCommand(id)/CommandId reject anything
// outside that exact set — the same slot mechanism as `series`/`overlays`/`notifications`.
