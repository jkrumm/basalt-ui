/**
 * The `lists-focus-n42` fixture: the router-health shape of expression scenario n42. One chart's
 * `useChartFocus` over the minutes, shared by a `DataPanel` whose `DataTable` holds one event per
 * item (`focusItems`, the events of a line), in two arms: `cards` (the default phone arm, a card per
 * row at 390) and `scroll` (the arm n42 pins with `phone: 'scroll'`). `data-focus-index` carries
 * `focus.index` per arm. Entry of `lists-focus-n42.layout.test.ts`, which bundles it in memory.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Minute = { id: string; at: number }
type Event = { id: string; at: number; time: string; label: string; memory: number; cpu: number }

const MINUTES: readonly Minute[] = Array.from({ length: 24 }, (_, i) => ({ id: `m${i}`, at: i }))
const EVENTS: readonly Event[] = [
  { id: 'e0', at: 4, time: '04:18', label: 'Line drop', memory: 47, cpu: 8 },
  { id: 'e1', at: 9, time: '09:21', label: 'Resync', memory: 52, cpu: 88 },
  { id: 'e2', at: 16, time: '16:42', label: 'Line drop', memory: 82, cpu: 40 },
  { id: 'e3', at: 20, time: '20:46', label: 'Resync', memory: 61, cpu: 96 },
]
const c = col<Event>()
const COLUMNS = [
  c.entity('time', {
    header: 'Event',
    mono: true,
    sub: (r) => r.label,
    sortable: false,
    priority: 1,
  }),
  c.number('memory', { header: 'Memory', unit: '%', sortable: false, priority: 2 }),
  c.number('cpu', { header: 'CPU', unit: '%', sortable: false, priority: 2 }),
]

function Arm({ id, phone }: { id: string; phone: 'cards' | 'scroll' }): ReactElement {
  const focus = useChartFocus(MINUTES, { announce: (d) => `minute ${d.at}` })
  const table = useDataTable<Event>({
    id,
    label: 'Line events',
    columns: COLUMNS,
    data: EVENTS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: 4,
    phone,
  })
  return (
    <div data-testid={id} data-focus-index={focus.index ?? ''}>
      <DataPanel
        title="Line events"
        phase="ready"
        bodySize={{ rows: 6 }}
        body={() => (
          <DataTable
            table={table}
            focusItems={{ focus, holds: (row, item) => item.at === row.at }}
          />
        )}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-4 p-4">
      <Arm id="n42-cards" phone="cards" />
      <Arm id="n42-scroll" phone="scroll" />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
