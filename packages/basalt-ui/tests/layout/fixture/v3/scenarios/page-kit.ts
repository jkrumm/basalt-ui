/**
 * The page-kit scenario's declaration: pure data, so the test process can import the registry.
 *
 * It provides the slots `PageSummary`, `CardGrid` and `Facts` stamp, which is what un-skips the shell suite's
 * facts case on v3. It matches the 2.x spec shape (`w37.summary`) so that case runs unchanged, and
 * its own `pageKit` field for the grid. The render lives in `page-kit-mount.tsx`, loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

/** The grid's tier and how many cards it holds; or a `Facts` list in a host of `factsWidth` px. */
export type PageKitSpec = FixtureSpec & {
  pageKit?: { grid: 'narrow' | 'regular' | 'wide'; cards?: number }
  pageKitFacts?: { width: number; rows?: number }
}

export const pageKitScenario: Scenario = {
  slots: [
    'page-summary',
    'page-summary-facts',
    'page-summary-fact',
    'page-summary-aside',
    'card-grid',
    'facts',
    'facts-row',
  ],
  matches: (spec) =>
    (spec as PageKitSpec).pageKit !== undefined ||
    (spec as PageKitSpec).pageKitFacts !== undefined ||
    spec.w37?.summary === true,
  async mount(spec, container) {
    const { mount } = await import('./page-kit-mount')
    await mount(spec, container)
  },
}
