/**
 * The inner-nav scenario's declaration: pure data, so the test process can import the registry.
 *
 * It provides the slots `InnerNav` and `SplitPage` stamp, and matches its own `innerNav` field. The
 * render lives in `inner-nav-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

/**
 * `standalone`: an `InnerNav` above a tall body, inside a shell-less `Page`. `split`: the same nav
 * as the list of a `SplitPage` whose pane is tall. Both drive a test-local push field over the
 * address bar (`?section=`).
 */
export type InnerNavSpec = FixtureSpec & {
  innerNav?: { mode: 'standalone' | 'split' }
}

export const innerNavScenario: Scenario = {
  slots: [
    'inner-nav',
    'inner-nav-group',
    'inner-nav-item',
    'inner-nav-filter',
    'split-page',
    'split-page-list',
    'split-page-detail',
  ],
  matches: (spec) => (spec as InnerNavSpec).innerNav !== undefined,
  async mount(spec, container) {
    const { mount } = await import('./inner-nav-mount')
    await mount(spec, container)
  },
}
