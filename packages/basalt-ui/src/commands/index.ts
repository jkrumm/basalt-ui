/**
 * ./commands — the command bus, overlay controller, shortcuts help and the notification registry.
 *
 * `BasaltProvider` mounts modals, Spotlight, hotkeys and notifications; this barrel is only what
 * an app declares and calls.
 *
 * @example
 * import { defineCommands, defineNotifications, emit } from 'basalt-ui/commands'
 * export const COMMANDS = defineCommands({
 *   'file:save': { label: 'Save', group: 'File', shortcut: 'Mod+S', run: () => save() },
 * })
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { commands: typeof COMMANDS }
 * }
 */

export { defineCommands, type Command } from './define-commands'
export { defineOverlays, overlays } from './define-overlays'
export { setColorScheme, toggleSidebar } from './shell-bridge'
export { ShortcutsHelp } from './ShortcutsHelp'

// ── Notifications (folded in from `./notifications`) ──────────────────────────
export { defineNotifications, emit } from './notifications/define-notifications'
export { NotificationBell } from './notifications/bell'
