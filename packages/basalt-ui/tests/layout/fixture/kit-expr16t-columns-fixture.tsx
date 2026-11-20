/**
 * Expression cycle 16 (`v3-expr-16-kit-fixes` 1): the n77 round-0 deploy table as `phone: 'columns'` in a
 * `DataPanel` (`e16-columns`). Entry of `kit-expr16-table.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type AppRow = { app: string; landedPct: number; failed: number }
const APPS: readonly AppRow[] = ['web', 'api', 'billing', 'search', 'worker', 'docs'].map(
  (app, i) => ({ app, landedPct: 100 - i * 7, failed: i }),
)
const c = col<AppRow>()
const COLUMNS = [
  c.entity('app', { header: 'App', mono: true, sortable: false, priority: 1 }),
  c.meter('landedPct', {
    header: 'Landed, %',
    max: 100,
    sortable: false,
    priority: 2,
    card: 'value',
  }),
  c.number('failed', { header: 'Failed', sortable: false, priority: 2, card: 'meta' }),
]

function Panel(): ReactElement {
  const table = useDataTable<AppRow>({
    id: 'e16-columns',
    label: 'Per app',
    columns: COLUMNS,
    data: APPS,
    getRowId: (r) => r.app,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: APPS.length,
    phone: 'columns',
  })
  return (
    <div data-testid="e16-columns">
      <DataPanel
        title="Apps"
        phase="ready"
        bodySize={{ rows: APPS.length + 2 }}
        body={() => <DataTable table={table} height="fill" />}
      />
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="flex flex-col gap-8 p-4 text-foreground">
    <Panel />
  </main>,
)
