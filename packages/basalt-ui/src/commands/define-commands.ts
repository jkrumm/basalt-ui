/**
 * define-commands — const-generic factory for typed command registries.
 *
 * Consumer defines their commands with defineCommands and augments BasaltRegister.commands.
 * `BasaltProvider` reads the module-level stash for its Spotlight actions and hotkeys (type
 * augmentation is erased at runtime; the stash is the live source).
 *
 * @example
 * // commands.ts (app-side)
 * import { defineCommands } from 'basalt-ui/commands'
 * export const COMMANDS = defineCommands({
 *   'file:save':  { label: 'Save file',    group: 'File',  shortcut: 'Mod+S', run: () => save() },
 *   'file:open':  { label: 'Open file',    group: 'File',  shortcut: 'Mod+O', run: () => open() },
 *   'help:docs':  { label: 'Open docs',    group: 'Help',                     run: () => window.open('/docs') },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { commands: typeof COMMANDS }
 * }
 */
import type { Hotkey } from '@tanstack/react-hotkeys'
import type { ReactNode } from 'react'
import { HotkeyBinder } from '../provider/hotkeys'
import { registerSlot } from '../provider/slots'
import { SpotlightMount } from '../provider/spotlight-mount'
import type { Slot } from '../register'
import { getActiveCommands, setActiveCommands } from './command-stash'

// ── Context ───────────────────────────────────────────────────────────────────

/**
 * Context passed to a command's run function. Minimal for 1.0; extend via BasaltRegister in 1.x.
 *
 * @example
 * defineCommands({
 *   'palette:close': { label: 'Close palette', run: ({ close }) => close?.() },
 * })
 */
export type CommandRunContext = {
  /** Close the command palette (if open) before executing. Injected by the palette. */
  close?: () => void
}

// ── Command + CommandMap ──────────────────────────────────────────────────────

/**
 * A single registered command. All fields except `label` and `run` are optional.
 *
 * @example
 * const cmd: Command = {
 *   label: 'Save file',
 *   group: 'File',
 *   shortcut: 'Mod+S',
 *   when: () => document.hasFocus(),
 *   run: () => save(),
 * }
 */
export type Command = {
  /** Display label shown in the command palette and shortcuts-help. */
  label: string
  /** Optional group name for grouping in the palette and shortcuts display. */
  group?: string
  /** Optional icon (ReactNode — no @tabler/icons dependency per house rules). */
  icon?: ReactNode
  /**
   * Optional keyboard shortcut, typed as the peer's `Hotkey` so a typo (`'Cmd+B'`) is a compile
   * error. Drives BOTH the ShortcutsHelp display AND live key
   * binding by `BasaltProvider` (through the @tanstack/react-hotkeys optional peer).
   * Convention: 'Mod+S' (Mod = Cmd on mac, Ctrl elsewhere), 'Mod+Shift+P', etc.
   */
  shortcut?: Hotkey
  /**
   * Optional predicate — when() returning false hides the command from the palette.
   * Useful for context-sensitive commands (e.g. "save" only when a form is dirty).
   */
  when?: () => boolean
  /** The command handler. May be async. */
  run: (ctx?: CommandRunContext) => void | Promise<void>
}

/**
 * The map of command id → Command that a consumer registers.
 *
 * @example
 * const map: CommandMap = {
 *   'file:save': { label: 'Save', run: () => save() },
 * }
 */
export type CommandMap = Record<string, Command>

// ── Slot extraction (mirror of SeriesKey pattern in register.ts) ──────────────

/** The consumer's registered command map, or `{}` when un-augmented. */
type Commands = Slot<'commands', CommandMap>

/**
 * The legal command id keys.
 * Extract<…, string> drops symbol/number members that `keyof` always includes.
 * Un-augmented: `never` (slot is `{}`, keyof is never).
 * Augmented: the exact string literal union of the registered command ids.
 *
 * @example
 * // After augmenting BasaltRegister.commands:
 * const id: CommandId = 'file:save'  // ✓
 * const bad: CommandId = 'bad-id'    // ✗ tsc error
 */
export type CommandId = Extract<keyof Commands, string>

// ── Runtime stash ─────────────────────────────────────────────────────────────

// ── defineCommands ────────────────────────────────────────────────────────────

/**
 * Define a typed command map. Const-generic identity passthrough — preserves the exact literal
 * keys so the id union is exact after augmenting BasaltRegister.
 *
 * Stashes the runtime map so the provider resolves commands at runtime (type augmentation is
 * erased; the stash is the live source), and registers the provider mounts that need it: Spotlight,
 * plus the hotkey binder when any command has a `shortcut`. Nothing else pulls those into a bundle.
 *
 * @example
 * export const COMMANDS = defineCommands({
 *   'file:save': { label: 'Save file', group: 'File', shortcut: 'Mod+S', run: () => save() },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { commands: typeof COMMANDS }
 * }
 */
export function defineCommands<const T extends CommandMap>(spec: T): T {
  setActiveCommands(spec)
  registerSlot('spotlight', SpotlightMount)
  if (Object.values(spec).some((c) => c.shortcut !== undefined))
    registerSlot('hotkeys', HotkeyBinder)
  return spec
}

// ── defineCommand (single-command helper) ─────────────────────────────────────

/**
 * Convenience helper to type a single Command object with full inference.
 * Useful when splitting commands across files before merging into defineCommands.
 *
 * WARNING: defineCommand only TYPES a command — it does NOT register it into the runtime stash.
 * Only defineCommands(map) registers commands. Calling defineCommand alone means the command will
 * never appear in the palette or bind its shortcut.
 *
 * @example
 * const saveCmd = defineCommand({ label: 'Save', shortcut: 'Mod+S', run: () => save() })
 * // Then include saveCmd in a defineCommands({ 'file:save': saveCmd }) call to register it.
 */
export function defineCommand(cmd: Command): Command {
  return cmd
}

export { getActiveCommands }
