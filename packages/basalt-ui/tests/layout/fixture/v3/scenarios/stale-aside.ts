/**
 * The stale-aside scenario's declaration: pure data, so the test process can import the registry.
 *
 * It matches its own `staleAside` field and provides no slot of its own. The render lives in
 * `stale-aside-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

/** A shell-less `SplitPage` whose detail pane holds a table that opens its rows in a bound `PageAside`. */
export type StaleAsideSpec = FixtureSpec & { staleAside?: Record<string, never> }

export const staleAsideScenario: Scenario = {
  slots: [],
  matches: (spec) => (spec as StaleAsideSpec).staleAside !== undefined,
  async mount(spec, container) {
    const { mount } = await import('./stale-aside-mount')
    await mount(spec, container)
  },
}
