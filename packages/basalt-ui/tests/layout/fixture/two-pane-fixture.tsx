/**
 * The `two-pane` fixture (S10): the two-pane recipe (`two-pane-recipe.tsx`)
 * mounted as written, on the v3 parts (the public `./charts` export still carries the 2.x chart).
 * Entry of `two-pane.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { TwoPane, seedBars } from './two-pane-recipe'

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <div data-testid="two-pane" className="min-w-0">
        <TwoPane bars={seedBars()} />
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Fixture />)
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
