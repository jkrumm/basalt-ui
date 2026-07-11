/**
 * ./commands — command bus, overlay controller, Spotlight projection, shortcuts display,
 * live keybindings, and composable overlay mount for basalt-ui apps.
 *
 * Optional peers: @mantine/modals ^9.3.0, @mantine/spotlight ^9.3.0,
 *   @mantine/notifications ^9.3.0, @tanstack/react-hotkeys 0.10.0.
 *
 * Install with: bun add @mantine/modals @mantine/spotlight @mantine/notifications @tanstack/react-hotkeys
 * Also import the Spotlight styles in main.tsx (the layered bundle — the unlayered one outranks
 * basalt's `@layer basalt` styles regardless of specificity): import '@mantine/spotlight/styles.layer.css'
 *
 * @example
 * // commands.ts (app-side) — define + augment:
 * import { defineCommands } from 'basalt-ui/commands'
 * export const COMMANDS = defineCommands({
 *   'file:save': { label: 'Save', group: 'File', shortcut: 'Mod+S', run: () => save() },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { commands: typeof COMMANDS }
 * }
 *
 * // main.tsx — mount composable overlays (replaces <BasaltNotifications />):
 * import { BasaltOverlays } from 'basalt-ui/commands'
 * import '@mantine/spotlight/styles.layer.css'
 * <BasaltProvider><BasaltOverlays><App /></BasaltOverlays></BasaltProvider>
 *
 * // usage.ts — run a command:
 * import { runCommand } from 'basalt-ui/commands'
 * runCommand('file:save')
 *
 * // Open/close Spotlight programmatically:
 * import { openSpotlight, closeSpotlight } from 'basalt-ui/commands'
 * openSpotlight()
 */

// ── defineCommands + runCommand ───────────────────────────────────────────────
export {
  defineCommands,
  defineCommand,
  runCommand,
  type Command,
  type CommandMap,
  type CommandId,
  type CommandRunContext,
} from './define-commands'

// ── defineOverlays + defineOverlay + overlays controller ─────────────────────
export {
  defineOverlays,
  defineOverlay,
  overlays,
  type Overlay,
  type OverlayMap,
  type OverlayKey,
} from './define-overlays'

// ── Projectors ────────────────────────────────────────────────────────────────
export {
  toSpotlightActions,
  toShortcutList,
  toHotkeyBindings,
  type ShortcutEntry,
  type HotkeyBinding,
} from './projectors'

// ── Shortcut format utils ─────────────────────────────────────────────────────
export { parseShortcut, detectMac, formatShortcutDisplay } from './shortcut-format'

// ── useCommandHotkeys hook ────────────────────────────────────────────────────
export { useCommandHotkeys } from './useCommandHotkeys'

// ── ShortcutsHelp ─────────────────────────────────────────────────────────────
export { ShortcutsHelp, type ShortcutsHelpProps } from './ShortcutsHelp'

// ── BasaltOverlays mount + Spotlight controls ─────────────────────────────────
export {
  BasaltOverlays,
  type BasaltOverlaysProps,
  basaltSpotlight,
  openSpotlight,
  closeSpotlight,
} from './overlays-mount'
