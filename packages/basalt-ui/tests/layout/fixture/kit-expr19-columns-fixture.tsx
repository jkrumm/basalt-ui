/**
 * Expression cycle 19, a `phone: 'columns'` table with unit headers in a card (`v3-expr-19-kit-fixes` 6; n93 .9 and .5):
 * at 390 its three columns and their headers sit inside the card with no sideways scroll, and in a half-width card at
 * 1800 the empty and error frames keep the header row inside the card. `?phase=empty|error` draws the arm;
 * `data-testid` `k19-columns` boxes the panel. Entry of `kit-expr19-columns.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Day = {
  id: string
  label: string
  vigorous: number
  moderate: number
  steps: number
  score: number
}
const DAYS: readonly Day[] = Array.from({ length: 12 }, (_, i) => ({
  id: `d${i}`,
  label: `Sat ${22 + i} Aug`,
  vigorous: 11 + i,
  moderate: 33 + i,
  steps: 5000 + i * 120,
  score: 60 + i,
}))
const c = col<Day>()

function Fixture(): ReactElement {
  const arm = new URLSearchParams(location.search).get('phase')
  const empty = arm === 'empty'
  const failed = arm === 'error'
  const table = useDataTable<Day>({
    id: 'k19-days',
    label: 'Days',
    columns: [
      c.entity('label', { header: 'Day', mono: true }),
      c.number('vigorous', { header: 'Vigorous', unit: 'min' }),
      c.number('moderate', { header: 'Moderate', unit: 'min' }),
      c.number('steps', { header: 'Steps' }),
      c.number('score', { header: 'Score' }),
    ],
    data: empty || failed ? [] : [...DAYS],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: failed
      ? { tag: 'error', retry: () => undefined, message: 'The export did not answer.' }
      : 'ready',
    empty: { cause: 'Nothing to list yet.' },
    bodyRows: 12,
    phone: 'columns',
  })
  return (
    <main
      className="grid content-start gap-4 p-4 text-foreground"
      style={{
        gridTemplateColumns: window.innerWidth >= 1000 ? '1fr 1fr' : '1fr',
        maxWidth: 1500,
      }}
    >
      <div data-testid="k19-side" className="min-w-0" />
      <div data-testid="k19-columns" className="min-w-0">
        <DataPanel
          title="Days"
          phase={
            failed
              ? { tag: 'error', retry: () => undefined, message: 'The export did not answer.' }
              : 'ready'
          }
          empty={empty ? { cause: 'Nothing to list yet.' } : null}
          bodySize={{ rows: 13, cardHeight: 33 }}
          body={() => <DataTable table={table} height="fill" />}
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
