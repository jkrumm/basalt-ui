/**
 * Expression cycle 13 kit fixes, the phone card and the header controls (`v3-expr-13-kit-fixes` 10): one
 * DataTable with the n61 columns (an identity title, a mono id as a card meta value, a text origin and a
 * number attempts) at 390 px. `data-testid="k13-phone"` is the table; `k13-scroll` the same in the
 * `phone: 'scroll'` arm. Entry of `kit-expr13-phone.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Issue = { id: string; title: string; sub: string; origin: string; attempts: number }
const ISSUES: readonly Issue[] = [
  {
    id: '#2473',
    title: 'Gateway timeout on retries',
    sub: 'argo',
    origin: 'Argo sync',
    attempts: 3,
  },
  {
    id: '#2474-b1c4e9f0-7a2d',
    title: 'Chart label clips',
    sub: 'basalt',
    origin: 'Review',
    attempts: 12,
  },
  { id: '#2475', title: 'Table head wraps', sub: 'basalt', origin: 'Manual', attempts: 1 },
]
const c = col<Issue>()

function Table({ id, phone }: { id: string; phone: 'fields' | 'scroll' }): ReactElement {
  const table = useDataTable<Issue>({
    id,
    label: 'Issues',
    columns: [
      c.entity('title', { header: 'Issue', sub: (r) => r.sub, priority: 1 }),
      c.entity('id', { header: 'Id', mono: true, priority: 3, width: 'content', card: 'meta' }),
      c.text('origin', { header: 'Origin' }),
      c.number('attempts', { header: 'Attempts', digits: 0 }),
    ],
    data: ISSUES,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone,
  })
  return <DataTable table={table} />
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="k13-phone" className="min-w-0">
        <DataPanel
          title="Issues"
          phase="ready"
          bodySize={{ rows: 3 }}
          body={() => <Table id="k13-phone" phone="fields" />}
        />
      </div>
      <div data-testid="k13-scroll" className="min-w-0">
        <DataPanel
          title="Issues"
          phase="ready"
          bodySize={{ rows: 3 }}
          body={() => <Table id="k13-scroll" phone="scroll" />}
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
