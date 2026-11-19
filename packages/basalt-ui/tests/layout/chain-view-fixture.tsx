/**
 * The `chain-view` fixture: one dependency dataset drawn twice, as a `ChainView` and as a
 * `DataTable` with nested rows, sharing one `useChartFocus`. The data holds a fan-out (a opens
 * four), fan-ins (f waits on three, h on two) and blocked nodes (waiting on open work). No shell.
 * A second, generated chain of 12 columns by 10 nodes (seeded, no clock) is wider than its frame
 * and takes the pan, zoom and focus probes. Probes: `cv-chain`, `cv-table`, `cv-large`.
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

/** 12 columns of 10, each node waiting on one node of the column before and sometimes an older one. */
function large(): Task[] {
  let seed = 7
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const out: Task[] = []
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 10; row++) {
      const waits: string[] = []
      if (col > 0) {
        waits.push(`n${col - 1}-${Math.floor(rnd() * 10)}`)
        if (rnd() < 0.35) {
          waits.push(`n${Math.max(0, col - 1 - Math.floor(rnd() * 3))}-${Math.floor(rnd() * 10)}`)
        }
      }
      out.push({
        id: `n${col}-${row}`,
        title: `Task ${col + 1}.${row + 1}`,
        done: rnd() < 0.3,
        waitsOn: [...new Set(waits)],
      })
    }
  }
  return out
}

const LARGE = large()

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
      <div data-testid="cv-large" className="min-w-0">
        <ChainView
          label="Large plan"
          nodes={LARGE}
          getId={(t) => t.id}
          waitsOn={(t) => t.waitsOn}
          face={(t) => ({ title: t.title, sub: t.id, done: t.done })}
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
