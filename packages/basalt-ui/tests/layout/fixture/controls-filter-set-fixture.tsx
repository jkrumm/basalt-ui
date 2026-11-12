/**
 * The `controls-filter-set` fixture's client entry: the probes on their own markup, no shell and no
 * provider. The harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 */
import { createRoot } from 'react-dom/client'
import { Probe } from './controls-filter-set-probe'

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Probe />)
