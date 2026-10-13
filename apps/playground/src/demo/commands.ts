/**
 * commands.ts — the playground's single global command registry.
 *
 * `defineCommands`'s own contract is "call it once — the app's single command registry; the last
 * call wins" (see its JSDoc in basalt-ui/commands). Imported eagerly by main.tsx so every command
 * below is registered at boot, before any route mounts, which is what keeps `ShortcutsHelp` (the
 * `/settings` Shortcuts card reads this same registry) populated on every route.
 */
import { spotlight } from '@mantine/spotlight'
import { defineCommands, setColorScheme } from 'basalt-ui/commands'

export const COMMANDS = defineCommands({
  'nav:search': {
    label: 'Open search',
    group: 'Navigation',
    // No `shortcut`: `BasaltProvider`'s Spotlight owns Mod+K, and a hotkey binding as well would
    // toggle it closed and straight back open.
    run: () => spotlight.open(),
  },
  'appearance:light': {
    label: 'Switch to light theme',
    group: 'Appearance',
    run: () => setColorScheme('light'),
  },
  'appearance:dark': {
    label: 'Switch to dark theme',
    group: 'Appearance',
    run: () => setColorScheme('dark'),
  },
  'appearance:system': {
    label: 'Match system theme',
    group: 'Appearance',
    run: () => setColorScheme('auto'),
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
