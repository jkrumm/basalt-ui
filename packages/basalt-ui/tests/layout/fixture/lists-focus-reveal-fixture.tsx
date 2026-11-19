/**
 * The `lists-focus-reveal` fixture: two charts' worth of focus, each a set of buttons that call `focus.set(i)`
 * (the path a chart's pointer takes), over a `DataTable` in a bounded `fill` region. A: one row per item
 * (`focus`), with chart marks spread on the same indexes after the table (`fr-marks`). B: each row holds a
 * run of items (`focusItems`). `data-testid` names each part. Entry of `lists-focus-reveal.layout.test.ts`,
 * which bundles it in memory.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { useChartFocus } from '../../../src/charts/focus'
import type { ChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Hour = { id: string; at: number }
type Row = { id: string; name: string; note: string }
type Run = { id: string; name: string; from: number; to: number; note: string }
const HOURS: readonly Hour[] = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, at: i }))
const ROWS: readonly Row[] = HOURS.map((h) => ({ id: h.id, name: `Hour ${h.at}`, note: 'reading' }))
const RUNS: readonly Run[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Run ${i}`,
  from: i * 2,
  to: i * 2 + 1,
  note: 'span',
}))
const c = col<Row>()
const cr = col<Run>()

function Hours<D>({ id, focus }: { id: string; focus: ChartFocus<D> }): ReactElement {
  return (
    <div data-testid={id} className="flex flex-wrap gap-1">
      {HOURS.map((h, i) => (
        <button key={h.id} type="button" data-testid={`${id}-${i}`} onClick={() => focus.set(i)}>
          {h.at}
        </button>
      ))}
    </div>
  )
}

function Fixture(): ReactElement {
  const focusA = useChartFocus(ROWS, { announce: (d) => d.name })
  const focusB = useChartFocus(HOURS, { announce: (d) => `hour ${d.at}` })
  const single = useDataTable<Row>({
    id: 'lists-focus-reveal-single',
    label: 'Hours',
    columns: [c.text('name', { header: 'Name' }), c.text('note', { header: 'Note' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  const runs = useDataTable<Run>({
    id: 'lists-focus-reveal-runs',
    label: 'Runs',
    columns: [cr.text('name', { header: 'Name' }), cr.text('note', { header: 'Note' })],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <main data-testid="fr-root" className="flex flex-col gap-4 p-4">
      <Hours id="fr-a" focus={focusA} />
      <div data-testid="fr-single" className="flex h-48 flex-col">
        <DataTable table={single} focus={focusA} height="fill" />
      </div>
      <div data-testid="fr-marks" className="flex flex-wrap gap-1">
        {HOURS.map((h, i) => (
          <span
            key={h.id}
            {...focusA.item(i)}
            data-testid={`fr-mark-${i}`}
            className="inline-block size-2"
          />
        ))}
      </div>

      <Hours id="fr-b" focus={focusB} />
      <div data-testid="fr-runs" className="flex h-48 flex-col">
        <DataTable
          table={runs}
          height="fill"
          focusItems={{
            focus: focusB,
            holds: (row, item) => item.at >= row.from && item.at <= row.to,
          }}
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
