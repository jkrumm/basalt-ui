/**
 * The `step-rail` fixture: one `StepRail` in a wide box (`sr-wide`) and one in a narrow box
 * (`sr-narrow`), same steps, one with a label too long for either. It is the entry the `step-rail`
 * layout test bundles; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { StepRail } from '../../../src/cards/step-rail'
import type { StepRailRow } from '../../../src/cards/step-rail'

const AT = Date.UTC(2026, 8, 3, 14, 2, 11)

const STEPS: readonly StepRailRow[] = [
  { id: 'build', label: 'Build image', durationMs: 40_000, at: AT },
  {
    id: 'long',
    label: 'a-very-long-step-name-that-must-truncate-at-every-width-and-never-widen-the-rail',
    durationMs: 10_000,
    at: AT + 40_000,
  },
  { id: 'queued', label: 'Queued', durationMs: null, at: AT + 50_000 },
  {
    id: 'probe',
    label: 'Probe',
    durationMs: 20_000,
    at: AT + 51_000,
    tone: 'bad',
    detail: 'Timed out on /health after three attempts, the last at 14:03:02',
  },
]

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-6 p-4">
      <div data-testid="sr-wide" className="w-160 max-w-full">
        <StepRail label="Deploy steps" steps={STEPS} />
      </div>
      <div data-testid="sr-narrow" className="w-96 max-w-full">
        <StepRail label="Deploy steps" steps={STEPS} />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
