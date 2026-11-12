/**
 * The `table-virtual` fixture (docs/v3/issues/g3/v3-table-t4-virtual.json, spike S2): a 10k-row
 * `DataTable` with `virtual={VirtualList}` in a bounded box, rows that activate (so they rove and
 * take focus), and a sort the test drives from outside the table, the way a toolbar or a saved view
 * changes the request while a row keeps focus: `window.basaltSort(id, desc)`.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import type { StateHandle, TableState } from '../../src/table/contract'
import { VirtualList } from '../../src/ui/virtual-list'

type Row = { id: string; name: string; state: string; amount: number }

const STATES = ['Awaiting', 'Settled', 'Disputed'] as const
const ROWS: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Booking ${String(i).padStart(5, '0')}`,
  state: STATES[i % STATES.length] ?? STATES[0],
  amount: i,
}))

const INITIAL: TableState = {
  v: 1,
  request: { q: '', filters: [], sort: [], page: 1, pageSize: 25 },
  display: { visibility: {} },
}

type Sort = (id: string, desc: boolean) => void
const host = window as unknown as { basaltSort?: Sort; basaltMountFixture: () => Promise<void> }

function useExternalHandle(): StateHandle<TableState> {
  const [state, setState] = useState(INITIAL)
  useEffect(() => {
    host.basaltSort = (id, desc) =>
      setState((prev) => ({ ...prev, request: { ...prev.request, sort: [{ id, desc }] } }))
  }, [])
  return { use: () => [state, setState] }
}

const c = col<Row>()

function Fixture(): ReactElement {
  const state = useExternalHandle()
  const t = useDataTable<Row>({
    id: 'tv-main',
    label: 'Bookings',
    state,
    columns: [
      c.entity('name', { header: 'Booking' }),
      c.status('state', { header: 'State', options: [...STATES] }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
  })
  return (
    // theme-allow -- the bounded box is the probe's payload (a fill table needs a height)
    <main lang="en" className="flex h-[600px] flex-col p-4 text-foreground">
      <div data-testid="tv-main" className="flex min-h-0 flex-1 flex-col">
        <DataTable table={t} height="fill" virtual={VirtualList} />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
host.basaltMountFixture = async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
