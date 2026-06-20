/**
 * ./commands — command bus, overlay controller, Spotlight projection, shortcuts display,
 * and composable overlay mount for basalt-ui apps.
 *
 * Optional peers: @mantine/modals ^9.3.0, @mantine/spotlight ^9.3.0, @mantine/notifications ^9.3.0.
 *
 * Install with: bun add @mantine/modals @mantine/spotlight @mantine/notifications
 * Also import the Spotlight styles in main.tsx: import '@mantine/spotlight/styles.css'
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
 * import '@mantine/spotlight/styles.css'
 * <BasaltProvider><BasaltOverlays><App /></BasaltOverlays></BasaltProvider>
 *
 * // usage.ts — run a command:
 * import { runCommand } from 'basalt-ui/commands'
 * runCommand('file:save')
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

// ── defineOverlays + overlays controller ─────────────────────────────────────
export {
  defineOverlays,
  overlays,
  type Overlay,
  type OverlayMap,
  type OverlayKey,
} from './define-overlays'

// ── Projectors ────────────────────────────────────────────────────────────────
export { toSpotlightActions, toShortcutList, type ShortcutEntry } from './projectors'

// ── ShortcutsHelp ─────────────────────────────────────────────────────────────
export { ShortcutsHelp, type ShortcutsHelpProps } from './ShortcutsHelp'

// ── BasaltOverlays mount ──────────────────────────────────────────────────────
export { BasaltOverlays, type BasaltOverlaysProps } from './overlays-mount'
