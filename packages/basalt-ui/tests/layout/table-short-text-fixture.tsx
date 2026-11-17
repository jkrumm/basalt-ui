/**
 * The `table-short-text` fixture (docs/v3/issues/cycles/v3-dogfood-3-visual.json, dogfood-3.3): the
 * Issues table of dogfood cycle 3 - short `text` columns (Issue, Project, Origin) beside an
 * `entity` Title with a long sub line. No shell. Probe: `ts-main`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'

type Row = {
  id: string
  ref: string
  title: string
  reason: string
  project: string
  origin: string
}

const REASONS = [
  'Waiting for the answer to a Decision: which spend cap applies to the nightly research run',
  'Review round two found one open finding in the table width plan; a fix is in progress',
  'Queued behind issue 640 for the browser lane because the layout suite holds it',
  'Working on the sparkline band; the heatmap size budget is the last open item',
  'Shipped and deployed; the watch window is open for the production probe to finish',
  'Deferred until the owner returns the Spec verdict on the new chart legend design',
]

const ROWS: Row[] = REASONS.map((reason, i) => ({
  id: `r${i}`,
  ref: `#${650 + i}`,
  title: `Issue ${i}`,
  reason,
  project: ['pearl', 'basalt-ui', 'argo'][i % 3]!,
  origin: 'factory',
}))

const c = col<Row>()

function Fixture(): ReactElement {
  const t = useDataTable<Row>({
    id: 'ts-main',
    label: 'Issues',
    columns: [
      c.text('ref', { header: 'Issue', priority: 1 }),
      c.entity('title', { header: 'Title', priority: 1, sub: (row) => row.reason }),
      c.text('project', { header: 'Project', priority: 2 }),
      c.text('origin', { header: 'Origin', priority: 3, labels: { factory: 'Factory' } }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    // theme-allow -- the wrapper is the probe's payload
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="ts-main" className="min-w-0">
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
