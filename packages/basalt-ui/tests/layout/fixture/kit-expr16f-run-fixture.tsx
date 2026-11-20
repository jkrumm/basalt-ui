/**
 * Expression cycle 16, a held run in a fill table (`v3-expr-16-kit-fixes` 10d, n61): a `BarList` of
 * states whose rows hold every Issue in that state, over a `DataPanel` whose `DataTable` shares the
 * focus by id (`focus`, not `focusItems`), so a table row and a list row stand on one index.
 * Entry of `kit-expr16f-run.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import { DataPanel } from '../../../src/cards/data-panel'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type State = 'held' | 'checking' | 'ready'
type Issue = { id: string; title: string; state: State }

const STATES: readonly State[] = ['held', 'ready', 'checking']
const ISSUES: readonly Issue[] = Array.from({ length: 30 }, (_, i) => ({
  id: `#${2400 + i}`,
  title: `Issue ${i}`,
  // The run sits past the fold of a 14-row body: rows 18 to 24.
  state: i >= 18 && i <= 24 ? 'checking' : i % 2 === 0 ? 'held' : 'ready',
}))

const c = col<Issue>()

function Fixture(): ReactElement {
  const focus = useChartFocus(ISSUES, { announce: (r) => `${r.id}, ${r.title}` })
  const table = useDataTable<Issue>({
    id: 'k16f-run',
    label: 'Work list',
    columns: [
      c.entity('title', { header: 'Issue', sub: (r) => r.id, priority: 1 }),
      c.text('state', { header: 'State', priority: 2 }),
    ],
    data: ISSUES,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: 14,
  })
  return (
    <main className="flex flex-col gap-4 p-4 text-foreground">
      <div data-testid="k16f-states" className="min-w-0">
        <BarList
          title="Issues by state"
          phase="ready"
          bodyRows={STATES.length}
          items={STATES.map((s) => ({
            key: s,
            label: s,
            value: ISSUES.filter((r) => r.state === s).length,
          }))}
          focusItems={{ focus, holds: (row, r) => r.state === row.key }}
        />
      </div>
      <div data-testid="k16f-table" className="min-w-0">
        <DataPanel
          title="Open Issues"
          phase="ready"
          bodySize={{ rows: 14 }}
          body={() => <DataTable table={table} height="fill" focus={focus} />}
        />
      </div>
      {focus.live}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
