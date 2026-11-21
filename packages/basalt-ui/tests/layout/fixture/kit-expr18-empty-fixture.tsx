/**
 * Expression cycle 18, an empty `DataPanel` over a table (`v3-expr-18-kit-fixes` 4, n87): the table keeps
 * its columns across the panel and the cause stays in view. `data-testid` `k18-panel` boxes the panel; the
 * `?phase=error` query draws the failed arm instead. Entry of `kit-expr18-empty.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Waiting = { id: string; name: string; kind: string; detail: string; days: number }
const c = col<Waiting>()

function Fixture(): ReactElement {
  const failed = new URLSearchParams(location.search).get('phase') === 'error'
  const phase = failed
    ? ({ tag: 'error', message: 'The index is unreachable', retry: () => {} } as const)
    : 'ready'
  const table = useDataTable<Waiting>({
    id: 'k18-waiting',
    label: 'Waiting to be dealt with',
    columns: [
      c.entity('name', { header: 'File', mono: true, priority: 1 }),
      c.status('kind', {
        header: 'Kind',
        options: ['trash', 'sidecar'],
        tone: () => 'neutral',
        priority: 1,
        card: 'detail',
      }),
      c.text('detail', { header: 'Detail', priority: 3, card: 'detail' }),
      c.meter('days', { header: 'Days kept', max: 60, priority: 2, card: 'value' }),
    ],
    data: [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone: 'columns',
    bodyRows: 8,
  })
  return (
    <main className="grid content-start gap-4 p-4 text-foreground">
      <div data-testid="k18-panel" className="min-w-0">
        <DataPanel
          title="Waiting to be dealt with"
          subtitle="Entries to empty and files to repair"
          phase={phase}
          empty={
            failed ? null : { cause: 'A new collection holds none yet. Import a card to start.' }
          }
          bodySize={{ rows: 19, cardHeight: 33 }}
          body={() => <DataTable table={table} height="fill" />}
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
