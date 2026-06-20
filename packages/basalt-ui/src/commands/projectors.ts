/**
 * projectors — project the active command registry into Mantine Spotlight actions and a shortcut list.
 *
 * Both functions read the runtime stash (populated by defineCommands) — they do NOT read the
 * type-erased BasaltRegister slot. They are safe to call before any commands are registered
 * (returns empty array).
 *
 * @example
 * // In BasaltOverlays, pass toSpotlightActions() to Spotlight:
 * <Spotlight actions={toSpotlightActions()} shortcut="mod + K" />
 *
 * // Render a shortcut reference list:
 * const shortcuts = toShortcutList()  // [{ id, label, shortcut, group? }, ...]
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import { getActiveCommands, runCommand } from './define-commands'
import type { CommandId } from './define-commands'

// ── toSpotlightActions ────────────────────────────────────────────────────────

/**
 * Project the active command registry into a Mantine Spotlight `SpotlightActionData[]` array.
 * Commands where `when()` returns false are excluded from the list.
 *
 * Reads a one-time snapshot of the runtime command stash at call time — commands registered AFTER
 * this is called (lazy/code-split) won't appear. Register all commands at module load before
 * mounting <BasaltOverlays>.
 *
 * When onTrigger is provided it is called INSTEAD OF runCommand (put runCommand(id) inside your
 * onTrigger if you want it to fire); without onTrigger, runCommand(id) fires directly.
 *
 * @example
 * // Close the palette then run the command:
 * const actions = toSpotlightActions((id) => { spotlight.close(); runCommand(id) })
 *
 * // Default: just runs the command directly
 * const actions = toSpotlightActions()
 */
export function toSpotlightActions(onTrigger?: (id: CommandId) => void): SpotlightActionData[] {
  const cmds = getActiveCommands()
  const actions: SpotlightActionData[] = []

  for (const [id, cmd] of Object.entries(cmds)) {
    // Skip commands gated behind a false when() predicate
    if (cmd.when !== undefined && !cmd.when()) continue

    const action: SpotlightActionData = {
      id,
      label: cmd.label,
      leftSection: cmd.icon,
      keywords: [cmd.group ?? '', id].join(' ').trim(),
      onClick: () => {
        // id is the actual stash key (string from Object.entries), narrowed to CommandId for the typed callback
        if (onTrigger !== undefined) {
          onTrigger(id as CommandId)
        } else {
          runCommand(id as CommandId)
        }
      },
    }
    if (cmd.shortcut !== undefined) action.description = `Shortcut: ${cmd.shortcut}`
    if (cmd.group !== undefined) action.group = cmd.group
    actions.push(action)
  }

  return actions
}

// ── ShortcutEntry ─────────────────────────────────────────────────────────────

/** A single entry in the shortcut reference list. */
export type ShortcutEntry = {
  id: string
  label: string
  shortcut: string
  group?: string
}

// ── toShortcutList ────────────────────────────────────────────────────────────

/**
 * Project the active command registry into a flat list of commands that have a `shortcut` field.
 * Use this to render a shortcuts-help display (see `ShortcutsHelp`).
 * Commands where `when()` returns false are excluded.
 *
 * Reads a one-time snapshot of the runtime command stash at call time — commands registered AFTER
 * this is called (lazy/code-split) won't appear. Register all commands at module load before
 * mounting <BasaltOverlays>.
 *
 * @example
 * const shortcuts = toShortcutList()
 * // [{ id: 'file:save', label: 'Save file', shortcut: 'Mod+S', group: 'File' }, ...]
 */
export function toShortcutList(): ShortcutEntry[] {
  const cmds = getActiveCommands()
  const result: ShortcutEntry[] = []

  for (const [id, cmd] of Object.entries(cmds)) {
    if (cmd.shortcut === undefined) continue
    if (cmd.when !== undefined && !cmd.when()) continue

    const entry: ShortcutEntry = { id, label: cmd.label, shortcut: cmd.shortcut }
    if (cmd.group !== undefined) entry.group = cmd.group
    result.push(entry)
  }

  return result
}
