/**
 * The anti-FOUC test's host: Mantine's scheme attribute under basalt's `styles.css` (which declares
 * `@layer mantine, basalt` and imports Mantine's layered core bundle), and nothing else. The cascade
 * outcome that file measures is Mantine's `color-scheme` layer against the plugin's boot rule, so the
 * page needs exactly those two and no scenario.
 */
import '../../../../src/styles.css'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { FixtureSpec } from '../spec'

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

let root: Root | null = null

const component = () => <p>boot scheme probe</p>

window.basaltNavigations = []
window.basaltAsideMounts = { total: 0, live: 0 }

window.basaltMountFixture = async (spec: FixtureSpec) => {
  root?.unmount()
  root = createRoot(container)
  // What `MantineProvider` stamps on <html>; Mantine's layered core bundle keys `color-scheme` on it.
  document.documentElement.setAttribute('data-mantine-color-scheme', spec.colorScheme ?? 'dark')
  root.render(component())
  await frame()
  await frame()
}
