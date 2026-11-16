/**
 * The `table-age` fixture (docs/v3/issues/cycles/v3-dogfood-2-visual.json, dogfood-2.3): the
 * Issues table of dogfood cycle 2, flexible text columns beside a `relativeTime` Age column whose
 * phrases are the longest English ones. No shell. Probe: `ta-main`.
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
  project: string
  kind: string
  origin: string
  since: number
}

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)
const MINUTE = 60_000
const AGES = [30, 42, 7, 59, 11 * 60 * 24 * 30, 23 * 60] as const

const ROWS: Row[] = AGES.map((age, i) => ({
  id: `r${i}`,
  ref: `#${650 + i}`,
  title: `Issue ${i}`,
  project: 'basalt-ui',
  kind: 'bug',
  origin: 'factory',
  since: NOW - age * MINUTE,
}))

const c = col<Row>()

function Fixture(): ReactElement {
  const t = useDataTable<Row>({
    id: 'ta-main',
    label: 'Issues',
    columns: [
      c.text('ref', { header: 'Issue', priority: 1 }),
      c.entity('title', { header: 'Title', priority: 1 }),
      c.text('project', { header: 'Project', priority: 2 }),
      c.text('kind', { header: 'Kind', priority: 3 }),
      c.text('origin', { header: 'Origin', priority: 3 }),
      c.relativeTime('since', { header: 'Age', priority: 2 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    now: NOW,
  })
  return (
    // theme-allow -- the wrapper is the probe's payload
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="ta-main" className="min-w-0">
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
