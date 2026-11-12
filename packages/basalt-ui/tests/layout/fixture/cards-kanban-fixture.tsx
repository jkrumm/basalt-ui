/**
 * The `cards-kanban` fixture (docs/v3/issues/g1/v3-cards-3-kanban.json): the board recipe region
 * from the playground, wired by `board-demo`, on its own markup with no shell and no provider.
 *
 * Probes:
 * - `kb-board`: the recipe's `Board` over todo 6, doing 4 and done 40 (so Done must virtualise);
 *   the first card of Done carries an `age`, a long title, two meta lines and four chips;
 * - `kb-solo`: one full-anatomy card on a link, to read the trail (age and menu) in isolation.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BoardDemo, seedCards } from '@recipe/board-demo'
import { KanbanCard } from '../../../src/cards/kanban-card'

const COLUMNS = [
  { id: 'todo', label: 'To do', count: 6 },
  { id: 'doing', label: 'Doing', count: 4 },
] as const

const SOLO_TITLE =
  'Rebuild the retry policy so a failed export is retried with backoff and never twice'

function Fixture(): ReactElement {
  const requested = new URLSearchParams(window.location.search).get('column')
  const active = requested === 'doing' || requested === 'done' ? requested : 'todo'
  return (
    <main className="flex flex-col gap-6 p-4">
      <div data-testid="kb-board">
        <BoardDemo initial={seedCards({ todo: 6, doing: 4, done: 40 })} active={active} />
      </div>
      <div data-testid="kb-solo" className="w-72">
        <KanbanCard
          id="solo"
          title={SOLO_TITLE}
          href="/issues/solo"
          age="2 h"
          meta={['EP-412', 'Ada Lovelace']}
          chips={[{ label: 'api' }, { label: 'p1' }, { label: 'infra' }, { label: 'retry' }]}
          reason={{ text: 'Waiting on a CI run that has been queued since yesterday' }}
          status={{ tone: 'warn', label: 'Blocked' }}
          move={{ column: COLUMNS[0], index: 1, columns: COLUMNS, onMove: () => undefined }}
        />
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
