/**
 * The shell-native scenario's declaration: pure data, so the test process can import the registry.
 *
 * It mounts `AppShell` under a memory router with `chrome` set from the spec, a few header
 * actions, a `CommandPalette` over a small `defineCommands` set, and optionally a dialog open
 * underneath. The render lives in `shell-native-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

export type ShellNativeSpec = FixtureSpec & {
  shellNative?: {
    /** The shell's `chrome` (default `native-overlay`). */
    chrome?: 'web' | 'native-overlay'
    /** A dialog already open under the palette, for the Escape-closes-the-top-layer case. */
    dialogUnder?: boolean
    /** The persisted rail state to start from. */
    rail?: 'collapsed' | 'expanded'
  }
}

export const shellNativeScenario: Scenario = {
  slots: ['shell-header', 'shell-lead', 'shell-brand-zone', 'shell-titlebar', 'command-palette'],
  matches: (spec) => (spec as ShellNativeSpec).shellNative !== undefined,
  async mount(spec, container) {
    const { mount } = await import('./shell-native-mount')
    await mount(spec, container)
  },
}
