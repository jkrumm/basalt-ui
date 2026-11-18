/**
 * The `lists-focus-gap` fixture: one `useChartFocus` shared by a `DataTable` whose rows hold runs of
 * items (`focusItems`) inside a `DataPanel`, and a `RowList`. `data-focus-index` carries
 * `focus.index`. Entry of `lists-focus-gap.layout.test.ts`, which bundles it in memory.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { RowList } from '../../../src/cards/row-list'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Hour = { id: string; at: number }
type Run = { id: string; name: string; from: number; to: number; note: string }
const HOURS: readonly Hour[] = Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, at: i }))
const RUNS: readonly Run[] = [
  { id: 'a', name: 'Night', from: 0, to: 1, note: 'quiet' },
  { id: 'b', name: 'Morning', from: 2, to: 3, note: 'busy' },
  { id: 'c', name: 'Noon', from: 4, to: 5, note: 'steady' },
  { id: 'd', name: 'Evening', from: 6, to: 7, note: 'busy' },
]
const c = col<Run>()

function Fixture(): ReactElement {
  const focus = useChartFocus(HOURS, { announce: (d) => `hour ${d.at}` })
  const table = useDataTable<Run>({
    id: 'lists-focus-gap',
    label: 'Runs',
    columns: [c.text('name', { header: 'Name' }), c.text('note', { header: 'Note' })],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <main
      data-testid="lg-root"
      data-focus-index={focus.index ?? ''}
      className="flex flex-col gap-4 p-4"
    >
      <div data-testid="lg-table">
        <DataPanel
          title="Runs"
          phase="ready"
          bodySize={{ rows: 8 }}
          body={() => (
            <DataTable
              table={table}
              focusItems={{ focus, holds: (row, item) => item.at >= row.from && item.at <= row.to }}
            />
          )}
        />
      </div>
      <div data-testid="lg-list">
        <RowList
          title="Hours"
          items={HOURS.map((h) => ({ label: `Hour ${h.at}`, value: String(h.at) }))}
          focus={focus}
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
