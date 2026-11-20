/**
 * Expression cycle 16 cards kit fixes, the phone card id (`v3-expr-16-kit-fixes` 10, n61): one DataTable with the
 * n61 columns (an identity title, a mono id as a card meta value) at 390 px, where the id rides on the card's
 * title line. `data-testid="k16-phone"` is the table. Entry of `kit-expr16-cards-phone.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Issue = { id: string; title: string; kind: string }
const ISSUES: readonly Issue[] = [
  { id: '#2417', title: 'Rebase conflicts stall the merge queue', kind: 'Fix' },
  { id: '#2405', title: 'Chart label clips', kind: 'Feature' },
]
const c = col<Issue>()

function Table(): ReactElement {
  const table = useDataTable<Issue>({
    id: 'k16-phone',
    label: 'Issues',
    columns: [
      c.entity('title', { header: 'Issue', priority: 1 }),
      c.entity('id', { header: 'Id', mono: true, priority: 3, width: 'content', card: 'meta' }),
      c.text('kind', { header: 'Kind' }),
    ],
    data: ISSUES,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}

function Fixture(): ReactElement {
  return (
    <main className="p-4 text-foreground">
      <div data-testid="k16-phone" className="min-w-0">
        <DataPanel
          title="Open Issues"
          phase="ready"
          bodySize={{ rows: 3 }}
          body={() => <Table />}
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
