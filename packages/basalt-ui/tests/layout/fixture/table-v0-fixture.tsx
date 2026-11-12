/**
 * The `table-v0` fixture (docs/v3/issues/g1/v3-table-t2b-tiers.json): `DataTable` on its own markup,
 * no shell. Each probe is a `data-testid` box around one table:
 * - `tv0-8-<ready|loading|error>`: eight columns, one set of columns across three phases;
 * - `tv0-14`: fourteen columns, priority 3 on the tail; `tv0-long`: long unbroken text;
 * - `tv0-empty`: zero rows; `tv0-pages`: a paged table (the pager);
 * - `tv0-detail`, `tv0-activate`, `tv0-none`: one table per way to reach a hidden column;
 * - `tv0-scroll`: `phone: 'scroll'`; `tv0-always`: `cardsBelow: 'always'`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'
import type { UseDataTable } from '../../../src/table/contract'

type Row = {
  id: string
  name: string
  note: string
  state: string
  amount: number
  qty: number
  at: string
  seen: string
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

const LONG = 'an-unbroken-identifier-that-would-widen-any-column-it-is-put-in-'.repeat(2)

const ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  name: i === 1 ? LONG : `Project ${i}`,
  note: i === 2 ? `${LONG} and a long sentence of free text that wraps` : `Note ${i}`,
  state: i % 2 === 0 ? 'Open' : 'Done',
  amount: 1200 + i * 37,
  qty: i * 3,
  at: '2026-09-03',
  seen: '2026-09-02T10:00:00Z',
  a: i,
  b: i * 2,
  c: i * 3,
  d: i * 4,
  e: i * 5,
  f: i * 6,
}))

const c = col<Row>()

function columns8(): UseDataTable<Row>['columns'] {
  return [
    c.entity('name', { header: 'Name' }),
    c.text('note', { header: 'Note' }),
    c.status('state', { options: ['Open', 'Done'], header: 'State' }),
    c.money('amount', { currency: 'EUR', header: 'Amount' }),
    c.number('qty', { header: 'Quantity', priority: 3 }),
    c.date('at', { header: 'Created', priority: 3 }),
    c.relativeTime('seen', { header: 'Seen', priority: 3 }),
    c.number('a', { header: 'Score', priority: 3 }),
  ]
}

function columns14(): UseDataTable<Row>['columns'] {
  return [
    ...columns8(),
    c.number('b', { header: 'B', priority: 3 }),
    c.number('c', { header: 'C', priority: 3 }),
    c.number('d', { header: 'D', priority: 3 }),
    c.number('e', { header: 'E', priority: 3 }),
    c.number('f', { header: 'F', priority: 3 }),
    c.number('qty', { header: 'Qty again', id: 'qty2', priority: 3 }),
  ]
}

type Variant = Partial<UseDataTable<Row>> & {
  cols?: 8 | 14
  height?: 'auto' | 'fill'
}

function Probe({ id, ...variant }: Variant & { id: string }): ReactElement {
  const { cols = 8, height: _height, ...rest } = variant
  const t = useDataTable<Row>({
    id,
    label: id,
    columns: cols === 14 ? columns14() : columns8(),
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...rest,
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const PROBES: [string, Variant][] = [
  ['tv0-8-ready', {}],
  ['tv0-8-loading', { data: undefined, phase: 'loading' }],
  ['tv0-8-error', { data: undefined, phase: { tag: 'error', message: 'boom' } }],
  ['tv0-14', { cols: 14 }],
  ['tv0-long', {}],
  ['tv0-empty', { data: [] }],
  ['tv0-pages', { pager: 'pages', mode: { kind: 'server', rowCount: 120 } }],
  ['tv0-detail', { detail: (row: Row) => row.name }],
  ['tv0-activate', { onRowActivate: () => undefined }],
  ['tv0-none', {}],
  ['tv0-scroll', { phone: 'scroll' }],
  ['tv0-always', { cardsBelow: 'always' }],
]

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      {PROBES.map(([id, variant]) => (
        <div key={id} data-testid={id} className="min-w-0">
          <Probe id={id} {...variant} />
        </div>
      ))}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
