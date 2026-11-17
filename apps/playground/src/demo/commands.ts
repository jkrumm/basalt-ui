/**
 * commands.ts — the playground's one command set, read by the root's `CommandPalette`.
 *
 * `defineCommands` (basalt-ui/shell) is pure data: it binds no key and registers nothing. The palette
 * mounted inside `AppShell` (`routes/__root.tsx`) lists these beside every `defineNav` item and
 * binds their chords. `Mod+K` and `Mod+B` are the shell's own.
 */
import { setScheme } from 'basalt-ui/core/scheme'
import { defineCommands } from 'basalt-ui/shell'

export const COMMANDS = defineCommands({
  'appearance:light': {
    label: 'Switch to light theme',
    group: 'Appearance',
    run: () => setScheme('light'),
  },
  'appearance:dark': {
    label: 'Switch to dark theme',
    group: 'Appearance',
    run: () => setScheme('dark'),
  },
  'appearance:system': {
    label: 'Match system theme',
    group: 'Appearance',
    run: () => setScheme('auto'),
  },
  'demo:greet': {
    label: 'Greet user',
    group: 'Demo',
    chord: 'Mod+G',
    run: () => {
      alert('Hello from the command bus!')
    },
  },
  'demo:log': {
    label: 'Log to console',
    group: 'Demo',
    chord: 'Mod+L',
    run: () => {
      console.log('[basalt commands] command triggered')
    },
  },
  'demo:sequence': {
    label: 'Greet user (sequence)',
    group: 'Demo',
    chord: 'g h',
    run: () => {
      alert('Hello from a sequence!')
    },
  },
  'demo:async': {
    label: 'Async command (1s delay)',
    group: 'Demo',
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log('[basalt commands] async command finished')
    },
  },
})
