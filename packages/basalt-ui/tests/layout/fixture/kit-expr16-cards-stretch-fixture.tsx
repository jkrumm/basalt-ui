/**
 * Expression cycle 16 cards kit fixes, a short column (`v3-expr-16-kit-fixes` 5, n76 `?fixture=finished`): a
 * right-hand column of two cards (a BarList and a DataPanel) beside a taller card, and the BarList's stacked
 * parts (9d, n76 failures as slivers). `data-testid="k16-column"` frames the grid. Entry of
 * `kit-expr16-cards-stretch.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'
import { BASALT } from '../../../src/tokens'

type Row = { id: string; name: string }
const ROWS: readonly Row[] = []
const c = col<Row>()

function Failed(): ReactElement {
  const table = useDataTable<Row>({
    id: 'k16-failed',
    label: 'Failed',
    columns: [c.entity('name')],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    empty: { cause: 'No item failed.' },
  })
  return (
    <DataPanel
      title="Failed items"
      phase="ready"
      empty={{ cause: 'No item failed.' }}
      bodySize={{ rows: 6 }}
      body={() => <DataTable table={table} height="fill" />}
    />
  )
}

const ITEMS = ['Tutorials', 'Courses', 'Lessons', 'Other'].map((label, i) => ({
  key: label,
  label,
  value: 500 - i * 100,
  parts: { done: 499 - i * 100, failed: 1 },
}))
const STATES = [
  { key: 'done', label: 'Done', color: { light: BASALT.ink, dark: BASALT.ink } },
  { key: 'failed', label: 'Failed', color: { light: BASALT.bad, dark: BASALT.bad } },
]

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <div className="@container">
        <div data-testid="k16-column" className="grid gap-3 @wide:grid-cols-2">
          <div className="h-[640px] rounded-card bg-card" />
          <div className="grid gap-3">
            <BarList
              title="Items by type"
              subtitle="Split by state"
              phase="ready"
              bodyRows={4}
              series={STATES}
              items={ITEMS}
            />
            <Failed />
          </div>
        </div>
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
