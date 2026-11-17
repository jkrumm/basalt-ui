/**
 * The `fit-labels` fixture (docs/v3/issues/cycles/v3-dogfood-4-visual.json, dogfood-4.2 and 4.4):
 * a `ChartCard` whose header holds two segmented groups, the first with four options and a
 * two-word one (`Not started`), and a table whose `status` column has the 15-character label
 * `Closed recently`. No shell. Probes: `fl-card` and `fl-table`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { memoryHandle } from '../../../src/controls/control-view.handles'
import type { MemoryHandle } from '../../../src/controls/control-view.handles'
import { filterSlot } from '../../../src/controls/filter-slot'
import { spec } from '../../../src/controls/spec'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

const COUNT = [
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'notStarted', label: 'Not started' },
  { value: 'checking', label: 'Checking' },
]
const WINDOW = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

const count = memoryHandle('fl.count', 'running', { kind: 'enum', options: COUNT })
const windowField = memoryHandle('fl.window', '7d', { kind: 'enum', options: WINDOW })
// A card slot takes widget specs; the memory handle has the shape, the brand is the type's.
const widget = (handle: MemoryHandle<string>, label: string) =>
  spec(Object.assign(handle, { scope: 'widget' as const }), label, { as: 'segmented' })

type Row = { id: string; title: string; state: 'open' | 'closedRecently' | 'done' }
const ROWS: Row[] = [
  { id: 'a', title: 'First', state: 'open' },
  { id: 'b', title: 'Second', state: 'closedRecently' },
  { id: 'c', title: 'Third', state: 'done' },
]
const c = col<Row>()

function Table(): ReactElement {
  const t = useDataTable<Row>({
    id: 'fl-table',
    label: 'Issues',
    columns: [
      c.entity('title', { header: 'Title', priority: 1 }),
      c.status('state', {
        header: 'State',
        priority: 1,
        options: ['open', 'closedRecently', 'done'],
        labels: { open: 'Open', closedRecently: 'Closed recently', done: 'Done' },
        tone: (v) => (v === 'open' ? 'accent' : 'neutral'),
      }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrapper is the probe's payload
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="fl-card" className="min-w-0">
        <ChartCard
          title="Issues over time"
          subtitle="Issues, never sessions"
          controls={filterSlot([widget(count, 'Count'), widget(windowField, 'Window')])}
          chart={() => <div className="h-24" />}
        />
      </div>
      <div data-testid="fl-table" className="min-w-0">
        <Table />
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
