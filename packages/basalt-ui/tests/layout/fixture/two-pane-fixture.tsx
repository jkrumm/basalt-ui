/**
 * The `two-pane` fixture (S10): the playground recipe `apps/playground/src/recipes/two-pane.tsx`
 * mounted as written. The layout test maps `@recipe/<name>` to the playground recipe file.
 * Entry of `two-pane.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { TwoPane, seedBars } from '@recipe/two-pane'

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
