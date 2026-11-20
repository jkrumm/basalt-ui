/**
 * Expression cycle 14, a DataPanel body with fewer rows than its `rows` count (`v3-expr-14-kit-fixes` 7b, n57 and
 * n60): a short table in a six-row body beside a long one. `data-testid` `k14-short`, `k14-long` and `k14-full`
 * wrap the three panels. Entry of `kit-expr14-panel.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Site = { id: string; name: string; value: number }
const rowsOf = (n: number): Site[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Site ${i + 1}`, value: 10 + i }))
const c = col<Site>()
const COLUMNS = [c.text('name', { header: 'Site' }), c.number('value', { header: 'Value' })]

function Panel({
  id,
  title,
  count,
  rows,
}: {
  id: string
  title: string
  count: number
  rows: number
}): ReactElement {
  const table = useDataTable<Site>({
    id,
    label: title,
    columns: COLUMNS,
    data: rowsOf(count),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <DataPanel
      title={title}
      phase="ready"
      bodySize={{ rows }}
      body={() => <DataTable table={table} />}
    />
  )
}

function Fixture(): ReactElement {
  return (
    <main className="grid grid-cols-2 items-start gap-4 p-4 text-foreground">
      <div data-testid="k14-short" className="min-w-0">
        <Panel id="k14-short" title="Short" count={4} rows={6} />
      </div>
      <div data-testid="k14-long" className="min-w-0">
        <Panel id="k14-long" title="Long" count={9} rows={6} />
      </div>
      <div data-testid="k14-full" className="min-w-0">
        <Panel id="k14-full" title="Full" count={5} rows={6} />
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
