/**
 * The shell-frame scenario's declaration: pure data, so the test process can import the registry.
 *
 * It mounts `AppShell` under a memory router with a `Page` inside, and provides the slots the frame
 * stamps. The rail and the tab bar are stubs until their Issues land, so the rail's inner slots
 * (`shell-rail-row`, `shell-rail-footer`) are NOT declared and the 2.x chrome cases stay skipped.
 * The render lives in `shell-frame-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

export type ShellFrameSpec = FixtureSpec & {
  shellFrame?: {
    /** Table rows in the page body (default 12). */
    rows?: number
    /** Mounts a `PageAside` (default false). */
    aside?: boolean | { dock?: 'always' | 'auto'; width?: number }
    /** Mounts a `PageBar` with a title, a control and an action (default true). */
    bar?: boolean
    /** Mounts `compactHeader: 'hidden'`. */
    compactHeader?: 'hidden'
    /** The persisted rail state to start from. */
    rail?: 'collapsed' | 'expanded'
  }
}

export const shellFrameScenario: Scenario = {
  slots: [
    'shell-skip',
    'shell-header',
    'shell-lead',
    'shell-trail',
    'shell-breadcrumb',
    'shell-rail',
    'shell-main',
    'page',
    'page-bar',
    'shell-aside',
    'page-aside',
    'shell-tab-bar',
  ],
  matches: (spec) => (spec as ShellFrameSpec).shellFrame !== undefined,
  async mount(spec, container) {
    const { mount } = await import('./shell-frame-mount')
    await mount(spec, container)
  },
}
