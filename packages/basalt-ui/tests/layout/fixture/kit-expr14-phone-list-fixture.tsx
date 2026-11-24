/**
 * The phone list row (`phone: 'cards'`) and the label-and-value grid (`phone: 'fields'`) at 390 px: a
 * room, three figures and a load meter that answers. `data-testid="pl-list"` and `"pl-fields"` are the
 * two tables. Entry of `table-phone-list.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Room = { id: string; name: string; a: number; b: number; c: number; load: number }
const ROOMS: readonly Room[] = [
  { id: 'r1', name: 'Kitchen on the second floor of the annex', a: 1204, b: 36, c: 7, load: 40 },
  { id: 'r2', name: 'Hall', a: 980, b: 12, c: 3, load: 85 },
  { id: 'r3', name: 'Cellar', a: 410, b: 9, c: 1, load: 10 },
]
const c = col<Room>()

function Table({ phone, id }: { phone: 'cards' | 'fields'; id: string }): ReactElement {
  const table = useDataTable<Room>({
    id,
    label: 'Rooms',
    columns: [
      c.entity('name', { header: 'Room' }),
      c.number('a', { header: 'Alpha', digits: 0 }),
      c.number('b', { header: 'Beta', digits: 0 }),
      c.number('c', { header: 'Gamma', digits: 0 }),
      c.meter('load', { header: 'Load', max: 100, card: 'value' }),
    ],
    data: ROOMS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone,
  })
  return <DataTable table={table} />
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="pl-list" className="min-w-0">
        <Table id="pl-list" phone="cards" />
      </div>
      <div data-testid="pl-fields" className="min-w-0">
        <Table id="pl-fields" phone="fields" />
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
