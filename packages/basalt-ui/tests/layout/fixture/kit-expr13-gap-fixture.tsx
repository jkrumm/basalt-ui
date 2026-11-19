/**
 * Expression cycle 13 kit fixes, the phone-card focus gap (`v3-expr-13-kit-fixes` 11): one chart focus
 * shared by two DataTable cards (`k13-a` with 16 rows clipped to 4, `k13-b`) and a BarList card
 * (`k13-c`) at 390, a 32 px gap between the cards. `data-focus-index` carries `focus.index`. Entry of
 * `kit-expr13-gap.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { BarList } from '../../../src/cards/bar-list'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Hour = { id: string; at: number }
type Run = { id: string; at: number; name: string; note: string }
const HOURS: readonly Hour[] = Array.from({ length: 16 }, (_, i) => ({ id: `h${i}`, at: i }))
const LONG: readonly Run[] = HOURS.slice(0, 16).map((h) => ({
  id: `l${h.at}`,
  at: h.at,
  name: `Long ${h.at}`,
  note: `note ${h.at}`,
}))
const RUNS: readonly Run[] = HOURS.slice(0, 8).map((h) => ({
  id: `r${h.at}`,
  at: h.at,
  name: `Run ${h.at}`,
  note: `note ${h.at}`,
}))
const c = col<Run>()

function Table({
  id,
  runs,
  focus,
  rows = 4,
}: {
  id: string
  runs: readonly Run[]
  focus: ReturnType<typeof useChartFocus<Hour>>
  rows?: number
}): ReactElement {
  const table = useDataTable<Run>({
    id,
    label: id,
    columns: [
      c.entity('name', { header: 'Run', priority: 1 }),
      c.text('note', { header: 'Note', priority: 2 }),
    ],
    data: runs,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <DataPanel
      title={id}
      phase="ready"
      bodySize={{ rows }}
      body={() => (
        <DataTable table={table} focusItems={{ focus, holds: (row, item) => item.at === row.at }} />
      )}
    />
  )
}

function Fixture(): ReactElement {
  const focus = useChartFocus(HOURS, { announce: (d) => `hour ${d.at}` })
  return (
    <main
      data-testid="k13-root"
      data-focus-index={focus.index ?? ''}
      className="flex flex-col gap-8 p-4"
    >
      <div data-testid="k13-a" className="min-w-0">
        <Table id="k13-a" runs={LONG} focus={focus} rows={4} />
      </div>
      <div data-testid="k13-b" className="min-w-0">
        <Table id="k13-b" runs={RUNS.slice(4)} focus={focus} />
      </div>
      <div data-testid="k13-c" className="min-w-0">
        <BarList
          title="Bars"
          items={HOURS.slice(8).map((h) => ({
            key: `bar${h.at}`,
            label: `Bar ${h.at}`,
            value: h.at + 1,
          }))}
          focusItems={{ focus, holds: (row, item) => row.key === `bar${item.at}` }}
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
