/**
 * Expression cycle 13 kit fixes, the chart focus over a table: a row that holds no item dims with the
 * rest (`k13-dim`), and a held run reveals its first row in a fill table (`k13-run`). Buttons set the
 * focus, so the test drives the same handle a chart or a list does. Entry of
 * `kit-expr13-hold.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Hour = { id: string; at: number }
type Row = { id: string; name: string; from: number; to: number }

const DIM_HOURS: readonly Hour[] = Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, at: i }))
const DIM_ROWS: readonly Row[] = [
  { id: 'mon', name: 'Mon 16 Nov', from: 0, to: 1 },
  { id: 'tue', name: 'Tue 17 Nov', from: 99, to: 99 },
  { id: 'wed', name: 'Wed 18 Nov', from: 4, to: 5 },
]
const RUN_HOURS: readonly Hour[] = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, at: i }))
const RUN_ROWS: readonly Row[] = RUN_HOURS.map((h) => ({
  id: `row${h.at}`,
  name: `Hour ${h.at}`,
  from: h.at,
  to: h.at,
}))
const c = col<Row>()

function DimPanel(): ReactElement {
  const focus = useChartFocus(DIM_HOURS, { announce: (d) => `hour ${d.at}` })
  const table = useDataTable<Row>({
    id: 'k13-dim',
    label: 'Days',
    columns: [c.entity('name', { header: 'Day', priority: 1 })],
    data: DIM_ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <div data-testid="k13-dim" className="min-w-0">
      <button type="button" data-testid="k13-dim-set" onClick={() => focus.set(1)}>
        Focus hour 1
      </button>
      <DataPanel
        title="Days"
        phase="ready"
        bodySize={{ rows: 4 }}
        body={() => (
          <DataTable
            table={table}
            focusItems={{ focus, holds: (row, item) => item.at >= row.from && item.at <= row.to }}
          />
        )}
      />
    </div>
  )
}

function RunPanel(): ReactElement {
  const focus = useChartFocus(RUN_HOURS, { announce: (d) => `hour ${d.at}` })
  const table = useDataTable<Row>({
    id: 'k13-run',
    label: 'Hours',
    columns: [c.entity('name', { header: 'Hour', priority: 1 })],
    data: RUN_ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <div data-testid="k13-run" className="min-w-0">
      <button type="button" data-testid="k13-run-far" onClick={() => focus.hold([12, 13, 14])}>
        Hold hours 12 to 14
      </button>
      <button type="button" data-testid="k13-run-near" onClick={() => focus.hold([1, 2])}>
        Hold hours 1 and 2
      </button>
      <DataPanel
        title="Hours"
        phase="ready"
        bodySize={{ height: 160 }}
        body={() => (
          <DataTable
            table={table}
            focusItems={{ focus, holds: (row, item) => item.at >= row.from && item.at <= row.to }}
            height="fill"
          />
        )}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <DimPanel />
      <RunPanel />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
