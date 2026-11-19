/**
 * The `chain-view` fixture: one dependency dataset drawn twice, as a `ChainView` and as a
 * `DataTable` with nested rows, sharing one `useChartFocus`. The data holds a fan-out (a opens
 * four), fan-ins (f waits on three, h on two) and blocked nodes (waiting on open work). No shell.
 * Probes: `cv-chain`, `cv-table`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { ChainView } from '../../src/cards/chain-view'
import { useChartFocus } from '../../src/charts/focus'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'

type Task = { id: string; title: string; done: boolean; waitsOn: string[] }

const TASKS: Task[] = [
  { id: 'a', title: 'Provision the cluster', done: true, waitsOn: [] },
  { id: 'b', title: 'Network policy', done: false, waitsOn: ['a'] },
  { id: 'c', title: 'Schema export', done: false, waitsOn: ['a'] },
  { id: 'd', title: 'Secrets cutover', done: false, waitsOn: ['a'] },
  { id: 'e', title: 'Snapshot the warehouse', done: true, waitsOn: ['a'] },
  { id: 'f', title: 'Point billing at the cluster', done: false, waitsOn: ['b', 'd', 'c'] },
  { id: 'g', title: 'Backfill events', done: false, waitsOn: ['c', 'e'] },
  { id: 'h', title: 'Dual-write window', done: false, waitsOn: ['f', 'g'] },
]

const c = col<Task>()

function Fixture(): ReactElement {
  const focus = useChartFocus(TASKS, { announce: (t) => t.title })
  const t = useDataTable<Task>({
    id: 'cv-table',
    label: 'Tasks',
    columns: [c.entity('title', { header: 'Task' })],
    data: TASKS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
    nested: { parentOf: (r) => r.waitsOn[0] },
  })
  return (
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="cv-chain" className="min-w-0">
        <ChainView
          label="Plan"
          nodes={TASKS}
          getId={(t) => t.id}
          waitsOn={(t) => t.waitsOn}
          face={(t) => ({ title: t.title, sub: t.id, done: t.done })}
          focus={focus}
        />
      </div>
      <div data-testid="cv-table" className="min-w-0">
        <DataTable table={t} focus={focus} />
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
