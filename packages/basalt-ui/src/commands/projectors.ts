/**
 * projectors — project the active command registry into the shortcut reference list that
 * `ShortcutsHelp` renders. Reads the runtime stash (populated by `defineCommands`), not the
 * type-erased `BasaltRegister` slot; safe to call before any commands are registered.
 */
import { getActiveCommands } from './define-commands'

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
 * rendering `ShortcutsHelp`.
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
