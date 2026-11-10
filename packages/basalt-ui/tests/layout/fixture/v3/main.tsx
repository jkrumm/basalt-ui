/**
 * The v3 layout fixture host — plain DOM, no React, no basalt `src` imports.
 *
 * Same contract as `../main.tsx`: the harness calls `window.basaltMountFixture(spec)` and measures
 * the page. A registered scenario does the rendering; with none registered the mount throws, which is
 * why `shell-target.ts` skips every case whose slots no scenario provides.
 */
import type { FixtureSpec } from '../spec'
import { SCENARIOS } from './registry'

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

window.basaltNavigations = []
window.basaltAsideMounts = { total: 0, live: 0 }

window.basaltMountFixture = async (spec: FixtureSpec) => {
  const scenario = Object.values(SCENARIOS).find((candidate) => candidate.matches(spec))
  if (!scenario) throw new Error('LAYOUT: no v3 scenario registered for this spec')
  window.basaltNavigations = []
  window.basaltAsideMounts = { total: 0, live: 0 }
  container.replaceChildren()
  await scenario.mount(spec, container)
  await frame()
  await frame()
}
