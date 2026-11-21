/**
 * Expression cycle 17, a mono id in a phone row (`v3-expr-17-kit-fixes` 8, n84 and n86): a `phone: 'columns'`
 * table whose identity column is a mono id with hyphens, in a DataPanel (`k17-ids`). Entry of
 * `kit-expr17-ids.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Check = { id: string; found: number; share: number }
const CHECKS: readonly Check[] = [
  { id: 'unused-exports', found: 12, share: 53 },
  { id: 'atlas-fast', found: 7, share: 31 },
  { id: 'circular-imports', found: 2, share: 9 },
  { id: 'dead-code', found: 1, share: 4 },
]
const c = col<Check>()
const COLUMNS = [
  c.entity('id', { header: 'Check', mono: true, sortable: false, priority: 1 }),
  c.number('found', { header: 'Found', sortable: false, priority: 2, card: 'value' }),
  c.number('share', { header: 'Share', sortable: false, priority: 2, card: 'meta' }),
]

type When = { at: string; found: number }
const WHENS: readonly When[] = [
  { at: '2026-11-18T10:00:00Z', found: 4 },
  { at: '2026-11-19T08:30:00Z', found: 7 },
]
const cw = col<When>()
const WHEN_COLUMNS = [
  cw.date('at', { header: 'When', mono: true, sortable: false, priority: 1, style: 'long' }),
  cw.number('found', { header: 'Found', sortable: false, priority: 2, card: 'value' }),
]

function WhenPanel(): ReactElement {
  const table = useDataTable<When>({
    id: 'k17-when',
    label: 'Runs',
    columns: WHEN_COLUMNS,
    data: WHENS,
    getRowId: (r) => r.at,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: WHENS.length,
    phone: 'columns',
  })
  return (
    <div data-testid="k17-when" className="w-56">
      <DataPanel
        title="Runs"
        phase="ready"
        bodySize={{ rows: WHENS.length + 1 }}
        body={() => <DataTable table={table} height="fill" />}
      />
    </div>
  )
}

function Panel(): ReactElement {
  const table = useDataTable<Check>({
    id: 'k17-ids',
    label: 'Checks',
    columns: COLUMNS,
    data: CHECKS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: CHECKS.length,
    phone: 'columns',
  })
  return (
    <div data-testid="k17-ids">
      <DataPanel
        title="Checks"
        phase="ready"
        bodySize={{ rows: CHECKS.length + 1 }}
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
  <main className="grid gap-4 p-4 text-foreground">
    <Panel />
    <WhenPanel />
  </main>,
)
