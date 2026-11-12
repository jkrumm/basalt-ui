/**
 * The `table-group` fixture (docs/v3/issues/g3/v3-table-t4-virtual.json): the owner's x-reference
 * shape, rooms grouped by floor, each group row with its count and a `summary` box (`ui/progress`,
 * rooms done of rooms), a `footer` sum on a number column, long labels where a label can be long.
 * No shell. Probe: `tg-main`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import { Progress } from '../../src/ui/progress'

type Row = { id: string; room: string; floor: string; state: string; tasks: number }

const STATES = ['Done', 'Open'] as const
const FLOORS = ['Floor 2 (bedrooms and the long landing)', 'Floor 1', 'Basement'] as const

const ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  room: i % 4 === 0 ? `Guest bedroom with a long descriptive name ${i}` : `Room ${i}`,
  floor: FLOORS[i % FLOORS.length] ?? FLOORS[0],
  state: i % 5 === 4 ? 'Open' : 'Done',
  tasks: 3 + (i % 4),
}))

const c = col<Row>()

function Fixture(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tg-main',
    label: 'Rooms',
    columns: [
      c.entity('room', { header: 'Room' }),
      c.status('state', { header: 'State', options: [...STATES] }),
      c.number('tasks', { header: 'Open tasks', footer: 'sum' }),
      c.text('floor', { header: 'Floor', priority: 3 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
    group: {
      by: 'floor',
      summary: (rows) => {
        const done = rows.filter((r) => r.state === 'Done').length
        return (
          <Progress
            value={(done / rows.length) * 100}
            aria-label={`${done} of ${rows.length} rooms done`}
            className="w-24"
          />
        )
      },
    },
  })
  return (
    // theme-allow -- the wrapper is the probe's payload
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="tg-main" className="min-w-0">
        <DataTable table={t} />
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
