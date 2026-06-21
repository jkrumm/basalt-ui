/**
 * projectors — project the active command registry into Mantine Spotlight actions, a shortcut list,
 * and a @tanstack/react-hotkeys bindings array.
 *
 * All functions read the runtime stash (populated by defineCommands) — they do NOT read the
 * type-erased BasaltRegister slot. They are safe to call before any commands are registered
 * (returns empty array).
 *
 * @example
 * // In BasaltOverlays, pass toSpotlightActions() to Spotlight:
 * <Spotlight store={basaltSpotlight[0]} actions={toSpotlightActions()} shortcut="mod + K" />
 *
 * // Render a shortcut reference list:
 * const shortcuts = toShortcutList()  // [{ id, label, shortcut, group? }, ...]
 *
 * // Opt-in: drive your own useHotkeys() call (useCommandHotkeys uses the imperative manager API instead):
 * const bindings = toHotkeyBindings()
 * useHotkeys(bindings)
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import { getActiveCommands, runCommand } from './define-commands'
import type { CommandId } from './define-commands'
import { formatShortcutDisplay, detectMac } from './shortcut-format'

// ── UseHotkeyDefinition (re-typed locally to avoid peer import at module level) ──

/**
 * Shape of a single entry in the array passed to useHotkeys().
 * Mirrors UseHotkeyDefinition from @tanstack/react-hotkeys — typed locally so
 * projectors.ts has no hard import on the optional peer.
 */
export type HotkeyBinding = {
  hotkey: string
  /**
   * Callback invoked when the hotkey fires. Widened to match @tanstack/react-hotkeys'
   * HotkeyCallback signature — `(event: KeyboardEvent, context?: unknown) => void` — so
   * consumers can pass toHotkeyBindings() directly to useHotkeys() without a tsc error.
   * The implementations produced by toHotkeyBindings() only use the zero-arg form internally.
   */
  callback: (event: KeyboardEvent, context?: unknown) => void
}

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
    if (cmd.shortcut !== undefined) {
      // detectMac() is SSR-safe (returns false when navigator is unavailable)
      action.description = formatShortcutDisplay(cmd.shortcut, detectMac())
    }
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

// ── toHotkeyBindings ──────────────────────────────────────────────────────────

/**
 * Project the active command registry into a `UseHotkeyDefinition[]` bindings array — the exact
 * shape accepted by `useHotkeys` from `@tanstack/react-hotkeys`.
 *
 * Commands without a `shortcut` field are skipped. Commands where `when()` returns false are
 * included in the bindings but their callback is a no-op (the command is gated at call time, not
 * at registration time — this avoids hook-count churn when `when()` toggles).
 *
 * Reads a one-time snapshot of the runtime command stash.
 *
 * NOTE: the built-in useCommandHotkeys() does NOT call this function. It uses the imperative
 * getHotkeyManager() API from @tanstack/react-hotkeys directly (register/unregister per
 * mount/unmount cycle). toHotkeyBindings() is an opt-in convenience projector for consumers
 * who want to drive their own useHotkeys([...]) call — it is not on the path that
 * useCommandHotkeys() takes.
 *
 * @example
 * import { useHotkeys } from '@tanstack/react-hotkeys'
 * import { toHotkeyBindings } from 'basalt-ui/commands'
 *
 * function MyHotkeys() {
 *   useHotkeys(toHotkeyBindings())
 * }
 */
export function toHotkeyBindings(): HotkeyBinding[] {
  const cmds = getActiveCommands()
  const bindings: HotkeyBinding[] = []

  for (const [id, cmd] of Object.entries(cmds)) {
    if (cmd.shortcut === undefined) continue

    bindings.push({
      hotkey: cmd.shortcut,
      callback: () => {
        // Respect the when() gate at execution time (not registration time)
        if (cmd.when !== undefined && !cmd.when()) return
        void runCommand(id as CommandId)
      },
    })
  }

  return bindings
}
