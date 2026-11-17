/**
 * The `info-hint` fixture: one glossary hint at each horizontal edge of the page and a stand-alone
 * hint in running text, no shell and no provider. Probes carry a `data-testid` on their wrapper:
 * `hint-left`, `hint-right` (the panel must flip and stay in view) and `hint-text`.
 */
import { createRoot } from 'react-dom/client'
import { defineGlossary, InfoHint } from '../../../src/ui/info-hint'

const { InfoHint: Glossed } = defineGlossary({
  errand:
    'A step only a person can do: a device, a portal or a physical action. It carries the command that checks whether it is still needed.',
})

function Fixture() {
  return (
    <main className="flex flex-col gap-6 p-4 text-sm text-foreground">
      <div data-testid="hint-left" className="flex items-center">
        Errand <Glossed term="Errand" />
      </div>
      <div data-testid="hint-right" className="flex items-center justify-end">
        Errand <Glossed term="errand" />
      </div>
      <p data-testid="hint-text">
        Net revenue{' '}
        <InfoHint label="Net revenue">Revenue after refunds, per calendar month.</InfoHint> by
        month.
      </p>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
