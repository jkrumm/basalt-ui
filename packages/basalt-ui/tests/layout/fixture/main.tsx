/**
 * The fixture host. Mounts the REAL `BasaltProvider` + `BasaltShell` from `src/` with the
 * documented consumer stylesheet order — `@mantine/core/styles.layer.css` first, then basalt's
 * `styles.css`, which declares `@layer mantine, basalt`.
 *
 * That order is not decoration. The mobile sheet's height law is an UNLAYERED CSS-module rule that
 * only wins because Mantine's own rules are layered; VERIFIED in the built CSS, where
 * `.sheet_* { height: auto; max-height: min(70dvh, 100%) }` sits outside every `@layer` block. A
 * hand-authored DOM approximation reproduces the class chain and loses exactly that — which is why
 * an ad-hoc probe page is not what we commit.
 */
import '@mantine/core/styles.layer.css'
import '../../../src/styles.css'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { BasaltProvider, createBasaltTheme } from '../../../src/index'
import { ShellFixture } from './fixtures'
import type { FixtureSpec } from './spec'

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')

let root: Root | null = null
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// No <StrictMode>: its double-invoked effects make overlay/transition timing nondeterministic, and
// this app exists to be measured. Effect correctness is the happy-dom suite's job.
window.basaltMountFixture = async (spec: FixtureSpec) => {
  // Remount per call is required, not lazy: BasaltProvider injects --vx-* / --vx-space-* as a
  // <style>, so a retained provider would leave the previous density level's vars behind.
  root?.unmount()
  window.basaltNavigations = []
  root = createRoot(container)
  root.render(
    <BasaltProvider
      theme={createBasaltTheme(undefined, { density: spec.density ?? 0, radius: spec.radius ?? 0 })}
      defaultColorScheme={spec.colorScheme ?? 'dark'}
    >
      <ShellFixture spec={spec} />
    </BasaltProvider>,
  )
  await frame() // React commit
  await frame() // Mantine CSS-var + AppShell layout pass
}
