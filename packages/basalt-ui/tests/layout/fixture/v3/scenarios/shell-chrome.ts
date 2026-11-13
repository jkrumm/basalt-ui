/**
 * The shell-chrome scenario's declaration: pure data, so the test process can import the registry.
 *
 * It mounts `AppShell` from the 2.x nav-shape spec (`sections`, `sidebar`, `bar`, `globals`,
 * `aside`) so `shell-chrome.layout.test.ts` runs unchanged against the v3 rail and header, and
 * provides the slots those parts stamp. It matches a spec that carries one of those fields, or a
 * bare `sections` spec of unlabelled sections (the rail's own seam case). The render lives in `shell-chrome-mount.tsx`,
 * loaded on mount.
 */
import type { FixtureSpec } from '../../spec'
import type { Scenario } from '../registry'

/** The 2.x nav-shape spec plus the v3 header cluster (spike S6) and the persisted rail state. */
export type ShellChromeSpec = FixtureSpec & {
  /** Shutterflow's worst-case cluster: status badges, job progress, two quick actions. */
  cluster?: true
  /** `AppShell globalControls={globalControls(specs)}`: two global enum filters in the header. */
  globalControls?: true
  /** The persisted rail state to start from. */
  rail?: 'collapsed' | 'expanded'
}

const OWN_FIELDS = ['sidebar', 'bar', 'globals', 'aside', 'cluster', 'globalControls'] as const

export const shellChromeScenario: Scenario = {
  slots: [
    'shell-rail-viewport',
    'shell-rail-row',
    'shell-rail-row-icon',
    'shell-rail-dot',
    'shell-rail-footer',
    'shell-rail-block',
    'shell-rail-toggle',
    'shell-brand-zone',
    'shell-header-row',
    'shell-page-bar-host',
    'shell-kebab',
    'shell-center',
  ],
  matches: (spec: FixtureSpec) =>
    OWN_FIELDS.some((field) => (spec as Record<string, unknown>)[field] !== undefined) ||
    (Object.keys(spec).every((key) => key === 'sections') &&
      spec.sections.every((section) => section.label === '')),
  async mount(spec, container) {
    const { mount } = await import('./shell-chrome-mount')
    await mount(spec, container)
  },
}
