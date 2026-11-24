/**
 * Expression cycle 15, a StatCell empty cause wraps at 390 (`v3-expr-15-kit-fixes` 4, n73 .41): a strip whose
 * first cell has a long cause and no other track, beside a figure. `data-testid="ex-strip"` frames the
 * group. Entry of `kit-expr15-empty.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { StatCell } from '../../../src/cards/stat-cell'
import { StatGroup } from '../../../src/cards/stat-group'

function Fixture(): ReactElement {
  return (
    <main className="p-4">
      <div data-testid="ex-strip">
        <StatGroup variant="strip" label="Headline figures">
          <StatCell
            title="Due now"
            value={null}
            phase="ready"
            empty={{ cause: 'Nothing is waiting. Add one to start.' }}
          />
          <StatCell title="Last session" value={3} unit="days ago" phase="ready" />
        </StatGroup>
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
