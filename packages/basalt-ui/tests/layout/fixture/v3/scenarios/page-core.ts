/**
 * The page-core scenario's declaration: pure data, so the test process can import the registry.
 *
 * It provides the slots `Page`, `PageBar`, `PageAside` and `Section` stamp, and matches its own
 * `pageCore` field. The render lives in `page-core-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

/** One shell-less page: a bar, three tall sections (the middle one holds a table) and an optional aside. */
export type PageCoreSpec = FixtureSpec & {
  pageCore?: { aside?: boolean; bar?: boolean }
}

export const pageCoreScenario: Scenario = {
  slots: ['page', 'page-main', 'page-bar', 'page-aside', 'page-aside-slot', 'section'],
  matches: (spec) => (spec as PageCoreSpec).pageCore !== undefined,
  async mount(spec, container) {
    const { mount } = await import('./page-core-mount')
    await mount(spec, container)
  },
}
