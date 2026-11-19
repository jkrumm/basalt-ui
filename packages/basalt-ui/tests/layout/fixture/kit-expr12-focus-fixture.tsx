/**
 * Expression cycle 12 kit fixes, the shared focus across a card gap: two DataPanels with a table
 * each share one chart focus, side by side with a 44 px gap at 1800 and stacked with a 32 px gap
 * at 390 (`x12-focus`). Entry of `kit-expr12-focus.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = { id: string; name: string; load: number }

const ALL: readonly Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Revision ${i + 1}`,
  load: 10 + i * 7,
}))
const c = col<Row>()

function Panel({
  title,
  rows,
  focus,
}: {
  title: string
  rows: readonly Row[]
  focus: ReturnType<typeof useChartFocus<Row>>
}): ReactElement {
  const table = useDataTable<Row>({
    id: `x12-focus-${title}`,
    label: title,
    columns: [
      c.entity('name', { header: 'Name', priority: 1 }),
      c.number('load', { header: 'Load', priority: 1 }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <DataPanel
      title={title}
      phase="ready"
      bodySize={{ rows: 5 }}
      body={() => <DataTable table={table} focus={focus} height="fill" />}
    />
  )
}

function Fixture(): ReactElement {
  const focus = useChartFocus(ALL, { announce: (d) => `${d.name}: ${d.load}` })
  return (
    <main lang="en" className="p-4 text-foreground">
      <div
        data-testid="x12-focus"
        data-focused-index={focus.index ?? ''}
        className="flex flex-col gap-8 min-[900px]:flex-row min-[900px]:gap-11"
      >
        <div className="min-w-0 flex-1">
          <Panel title="Left" rows={ALL.slice(0, 3)} focus={focus} />
        </div>
        <div className="min-w-0 flex-1">
          <Panel title="Right" rows={ALL.slice(3)} focus={focus} />
        </div>
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
