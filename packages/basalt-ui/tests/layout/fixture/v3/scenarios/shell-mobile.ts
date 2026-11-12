/**
 * The shell-mobile scenario's declaration: pure data, so the test process can import the registry.
 *
 * It mounts `AppShell` under a memory router with the nav a `FixtureSpec` describes (`sections`,
 * `nav`, `icons`, `density`, `bodyHeight`) and provides the slots the phone tab bar and its surfaces
 * stamp. It claims any spec with sections that no earlier scenario matched, so the shell-mobile-nav
 * layout file runs on v3 with the same specs it runs on 2.x. The render lives in
 * `shell-mobile-mount.tsx`, loaded on mount.
 */
import type { Scenario } from '../registry'

export const shellMobileScenario: Scenario = {
  slots: [
    'shell-tab-bar',
    'shell-footer',
    'shell-sheet',
    'shell-sheet-rows',
    'shell-sheet-body',
    'shell-menu',
  ],
  // Last in the registry: a spec an earlier scenario owns never reaches this one.
  matches: (spec) => spec.sections.length > 0,
  async mount(spec, container) {
    const { mount } = await import('./shell-mobile-mount')
    await mount(spec, container)
  },
}
