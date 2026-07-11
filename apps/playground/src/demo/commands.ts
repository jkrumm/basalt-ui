/**
 * commands.ts — the playground's single global command registry.
 *
 * `defineCommands`'s own contract is "call it once — the app's single command registry; the last
 * call wins" (see its JSDoc in basalt-ui/commands). Imported eagerly by main.tsx so every command
 * below — the real global one (`nav:search`) alongside CommandsDemoPage's showcase commands — is
 * registered at boot, before any route mounts. That's what makes `ShortcutsHelp`'s data source
 * (`toShortcutList()`, which reads this same registry) honest on `/settings` regardless of whether
 * `/commands` has ever been visited: previously the registry was only populated once the
 * `/commands` route lazy-loaded, so the `/settings` Shortcuts card rendered empty.
 */
import { defineCommands, openSpotlight, overlays } from 'basalt-ui/commands'

// Module-level mutable setter — CommandsDemoPage wires this to its local highlight-box state
// while mounted so the demo:toggle command (Mod+T) can flip it. Registered/cleared via
// `registerDemoToggleSetter`; a no-op when the demo page isn't mounted.
let demoToggleSetter: ((updater: (prev: boolean) => boolean) => void) | null = null

/** Called by CommandsDemoPage on mount (and with `null` on unmount) to wire demo:toggle's target. */
export function registerDemoToggleSetter(
  setter: ((updater: (prev: boolean) => boolean) => void) | null,
): void {
  demoToggleSetter = setter
}

export const COMMANDS = defineCommands({
  'nav:search': {
    label: 'Open search',
    group: 'Navigation',
    shortcut: 'Mod+K',
    run: () => openSpotlight(),
  },
  'demo:greet': {
    label: 'Greet user',
    group: 'Demo',
    shortcut: 'Mod+G',
    run: () => {
      // eslint-disable-next-line no-alert
      alert('Hello from the command bus!')
    },
  },
  'demo:log': {
    label: 'Log to console',
    group: 'Demo',
    shortcut: 'Mod+L',
    run: () => {
      // oxlint-disable-next-line no-console
      console.log('[basalt commands] runCommand demo triggered')
    },
  },
  'demo:toggle': {
    label: 'Toggle highlight box',
    group: 'Demo',
    shortcut: 'Mod+T',
    run: () => {
      demoToggleSetter?.((prev) => !prev)
    },
  },
  'demo:overlay': {
    label: 'Open demo overlay',
    group: 'Demo',
    shortcut: 'Mod+Shift+O',
    run: () => {
      overlays.open('demo:info', { message: 'Opened from the command bus!' })
    },
  },
  'demo:async': {
    label: 'Async command (1s delay)',
    group: 'Demo',
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // oxlint-disable-next-line no-console
      console.log('[basalt commands] async command finished')
    },
  },
})

declare module 'basalt-ui' {
  interface BasaltRegister {
    commands: typeof COMMANDS
  }
}
