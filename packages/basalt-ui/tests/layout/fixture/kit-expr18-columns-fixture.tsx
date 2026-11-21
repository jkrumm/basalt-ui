/**
 * Expression cycle 18, a `phone: 'columns'` table in a DataPanel at 390 (`v3-expr-18-kit-fixes` 9, n91 .33 and .36,
 * probe n86): the table fits its card with its headers whole, and the loading frame ends at the ready rows.
 * `?phase=loading` draws the loading frame. `data-testid` `k18-columns` boxes the panel. Entry of
 * `kit-expr18-columns.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Entry = { id: string; title: string; kind: string; reason: string; bill: number; at: number }
const KINDS = ['waiting', 'failed', 'older'] as const
const ROWS: readonly Entry[] = Array.from({ length: 9 }, (_, i) => ({
  id: `img-${1200 + i * 37}`,
  title: [
    'Faded harbour on ferry timetables',
    'Quiet nets on lock repairs',
    'Brass orchard on wool prices',
  ][i % 3]!,
  kind: KINDS[i % 3]!,
  reason: 'Transport error',
  bill: 0.33 + i * 0.11,
  at: 1_700_000_000_000 - i * 3_600_000,
}))
const c = col<Entry>()

function Fixture(): ReactElement {
  const loading = new URLSearchParams(location.search).get('phase') === 'loading'
  const phase = loading ? 'loading' : 'ready'
  const table = useDataTable<Entry>({
    id: 'k18-entries',
    label: 'Unfinished entries',
    columns: [
      c.entity('title', { header: 'Entry', priority: 1, sub: (e) => e.id, subMono: true }),
      c.status('kind', {
        header: 'State',
        priority: 1,
        card: 'value',
        options: KINDS,
        labels: { waiting: 'Waiting to bill', failed: 'Transport error', older: 'Older schema' },
        tone: () => 'neutral',
      }),
      c.text('reason', { header: 'Reason', priority: 2, card: 'detail' }),
      c.money('bill', { header: 'Bill (USD)', currency: 'USD', priority: 2, card: 'meta' }),
      c.relativeTime('at', { header: 'Last attempt', priority: 3, mono: true, card: 'detail' }),
    ],
    data: loading ? undefined : [...ROWS],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 9,
    phone: 'columns',
  })
  return (
    <main className="grid content-start gap-4 p-4 text-foreground">
      <div data-testid="k18-columns" className="min-w-0">
        <DataPanel
          title="Work left"
          phase={phase}
          bodySize={{ rows: 10, cardHeight: 33 }}
          body={() => <DataTable table={table} />}
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
