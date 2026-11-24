/**
 * The `table-states` document fixture: one DataTable per phase in a 1013 px box, and a card list.
 * - `ts-empty`, `ts-error`, `ts-ready`: the same columns in an empty, a failed and a loaded table;
 * - `ts-cards`: a `phone: 'fields'` table with a title, a headed value, a headerless badge and a headerless meta;
 * - `ts-clipped`: the same columns over 20 rows in a `maxRows: 2` scrollport.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import type { UseDataTable } from '../../src/table/contract'

type Row = { id: string; name: string; total: number; state: string; owner: string; seen: string }

const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: `r${i}`,
  name: `eval-${i}`,
  total: 10 + i,
  state: i % 2 === 0 ? 'Passed' : 'Failed',
  owner: i % 2 === 0 ? 'You' : 'Them',
  seen: '2026-11-0' + String((i % 9) + 1),
}))

const c = col<Row>()

function columns(): UseDataTable<Row>['columns'] {
  return [
    c.entity('name', { header: 'Case' }),
    c.number('total', { header: 'Total' }),
    c.status('state', { header: 'Result', options: ['Passed', 'Failed'] }),
    c.text('owner', { header: 'Owner' }),
    c.date('seen', { header: 'Last seen' }),
  ]
}

function States({ id, kind }: { id: string; kind: 'empty' | 'error' | 'ready' }): ReactElement {
  const t = useDataTable<Row>({
    id,
    label: id,
    columns: columns(),
    data: kind === 'ready' ? rows : [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(kind === 'empty' && { empty: { cause: 'Nothing yet' } }),
    ...(kind === 'error' && { phase: { tag: 'error' as const, retry: () => undefined } }),
  })
  return <DataTable table={t} />
}

function Cards({ maxRows }: { maxRows?: number }): ReactElement {
  const t = useDataTable<Row>({
    id: maxRows === undefined ? 'ts-cards' : 'ts-clipped',
    label: 'Cards',
    columns: [
      c.entity('name', { header: 'Case' }),
      c.number('total', { header: 'Total', card: 'value' }),
      c.status('state', { header: '', options: ['Passed', 'Failed'], card: 'badge' }),
      c.text('owner', { header: '', card: 'meta' }),
      c.date('seen', { header: 'Last seen', card: 'subtitle' }),
    ],
    data: maxRows === undefined ? rows.slice(0, 3) : rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    // the clipped list is the default list row; `ts-cards` keeps the labelled field grid
    ...(maxRows === undefined && { phone: 'fields' as const }),
  })
  return <DataTable table={t} {...(maxRows !== undefined && { height: { maxRows } })} />
}

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      {(['empty', 'error', 'ready'] as const).map((kind) => (
        // a flex row shrink-wraps its item, as a panel or a grid cell does
        <div key={kind} data-testid={`ts-${kind}`} className="flex" style={{ width: 1013 }}>
          <States id={`ts-${kind}`} kind={kind} />
        </div>
      ))}
      <div data-testid="ts-cards" className="min-w-0">
        <Cards />
      </div>
      <div data-testid="ts-clipped" className="min-w-0">
        <Cards maxRows={2} />
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
