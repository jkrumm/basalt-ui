/**
 * Expression cycle 14, the phone card's mono id (`v3-expr-14-kit-fixes` 7e, n61): a title and a mono entity id
 * at 390 px, the rows as cards. `data-testid="k14-phone"` is the table. Entry of `kit-expr14-phone.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Issue = { id: string; title: string; sub: string; attempts: number }
const ISSUES: readonly Issue[] = [
  { id: '#2417', title: 'Rebase conflicts stall the merge queue', sub: 'argo', attempts: 3 },
  { id: '#2397', title: 'Gate flake on retries', sub: 'basalt', attempts: 1 },
]
const c = col<Issue>()

function Table(): ReactElement {
  const table = useDataTable<Issue>({
    id: 'k14-phone',
    label: 'Issues',
    columns: [
      c.entity('title', { header: 'Issue', sub: (r) => r.sub, priority: 1 }),
      c.entity('id', { header: 'Id', mono: true, priority: 3, width: 'content', card: 'meta' }),
      c.number('attempts', { header: 'Attempts', digits: 0 }),
    ],
    data: ISSUES,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone: 'cards',
  })
  return <DataTable table={table} />
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="k14-phone" className="min-w-0">
        <DataPanel title="Issues" phase="ready" bodySize={{ rows: 3 }} body={() => <Table />} />
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
