/**
 * Expression cycle 16 cards kit fixes, kit-drawn text at 390 (`v3-expr-16-kit-fixes` 1b, n73 and n78 round 0):
 * a StatGroup of cards whose cells each fail with their own cause, a strip whose cells fail with theirs, and a
 * StatCell whose delta pill and base label are wider than the cell. `data-testid="k16-errors"`,
 * `"k16-strip"` and `"k16-delta"` frame the three. Entry of `kit-expr16-cards-text.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { StatCell } from '../../../src/cards/stat-cell'
import { StatGroup } from '../../../src/cards/stat-group'

const retry = (): void => undefined

const rows = [
  { label: 'Longest silence', value: '77 h' },
  { label: 'Check interval', value: '15 min' },
] as const

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-6 p-4 text-foreground">
      <div data-testid="k16-errors">
        <StatGroup variant="cards" label="Summary">
          <StatCell
            title="Mailboxes syncing"
            value={4}
            meter={{ label: 'Share', value: 4, max: 6 }}
            rows={rows}
            phase={{ tag: 'error', message: 'Gateway timed out', retry }}
          />
          <StatCell
            title="Messages in and out"
            value={6400}
            rows={rows}
            phase={{ tag: 'error', message: 'Counter unreachable', retry }}
          />
          <StatCell
            title="Backlog"
            value={101}
            rows={rows}
            phase={{ tag: 'error', message: 'Gateway timed out', retry }}
          />
          <StatCell
            title="Failures"
            value={23}
            rows={rows}
            phase={{ tag: 'error', message: 'Gateway timed out', retry }}
          />
        </StatGroup>
      </div>
      <div data-testid="k16-strip">
        <StatGroup variant="strip" label="Review">
          <StatCell
            title="Due now"
            phase={{ tag: 'error', message: 'The server did not answer.', retry }}
          />
          <StatCell
            title="Slipped share of learned"
            phase={{ tag: 'error', message: 'The server did not answer.' }}
          />
          <StatCell
            title="Last session"
            phase={{ tag: 'error', message: 'The log did not answer.', retry }}
          />
        </StatGroup>
      </div>
      <div data-testid="k16-delta">
        <StatGroup variant="cards" label="Volume">
          <StatCell
            title="Messages in and out"
            value="166,228"
            delta={{ value: '+2,258%', polarity: 'neutral', label: 'vs prior 30 d' }}
            rows={rows}
            phase="ready"
          />
          <StatCell
            title="Messages"
            value="6,400"
            delta={{ value: '-9%', polarity: 'neutral', label: 'vs prior 30 d' }}
            rows={rows}
            phase="ready"
          />
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
