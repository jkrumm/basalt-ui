/**
 * The `table-toolbar` fixture (docs/v3/issues/g3/v3-table-t3-toolbar.json): `TableToolbar` over a
 * `DataTable` with long labels everywhere a label can be long: column headers, status options,
 * filter values on the chips, view names. No shell. Each probe is a `data-testid` box:
 * - `tt-main`: toolbar, two active filters (long values), the table;
 * - `tt-cell`: a table whose payee column is a `CellFilter` (a custom cell closes over the instance).
 */
import { createContext, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { useMemoryHandle } from '../../src/table/core/state'
import { CellFilter } from '../../src/table/parts/cell-filter'
import { DataTable } from '../../src/table/parts/data-table'
import { TableToolbar } from '../../src/table/parts/toolbar'
import { useDataTable } from '../../src/table/use-data-table'
import type { DataTableInstance } from '../../src/table/contract'

type Row = { id: string; payee: string; note: string; state: string; amount: number }

const LONG_PAYEE = 'Counterparty Holdings International Limited (Registered Office)'
const STATES = [
  'Awaiting counterparty confirmation',
  'Settled and reconciled',
  'Disputed by the customer',
] as const

const ROWS: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  payee: i % 2 === 0 ? LONG_PAYEE : `Acme ${i}`,
  note: `Note ${i}`,
  state: STATES[i % STATES.length] ?? STATES[0],
  amount: 100 + i * 17,
}))

const c = col<Row>()
/** The table the custom cell belongs to; the cell renders under `DataTable`, so it reads it here. */
const Self = createContext<DataTableInstance<Row> | undefined>(undefined)

function TagCell({ payee }: { payee: string }): ReactElement {
  const table = useContext(Self)
  return table === undefined ? (
    <>{payee}</>
  ) : (
    <CellFilter table={table} column="payee" value={payee} />
  )
}

function Probe({ id, cell }: { id: string; cell?: boolean }): ReactElement {
  const state = useMemoryHandle({
    filters: [
      { id: 'payee', op: 'contains', values: ['Counterparty Holdings International'] },
      { id: 'state', op: 'anyOf', values: [...STATES] },
    ],
  })
  const t = useDataTable<Row>({
    id,
    label: `${id} rows`,
    state,
    columns: [
      c.entity('payee', { header: 'Counterparty with a long header label', filter: 'text' }),
      ...(cell
        ? [
            c.custom('tag', {
              header: 'Tag',
              card: 'meta',
              priority: 1,
              width: 22,
              sortValue: (row) => row.payee,
              render: (row) => <TagCell payee={row.payee} />,
            }),
          ]
        : []),
      c.status('state', {
        header: 'Settlement state of the booking',
        options: [...STATES],
        filter: 'multi',
      }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.text('note', { header: 'Note', priority: 3 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <>
      <TableToolbar table={t} />
      <Self value={t}>
        <DataTable table={t} />
      </Self>
    </>
  )
}

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="tt-main" className="min-w-0">
        <Probe id="tt-main" />
      </div>
      <div data-testid="tt-cell" className="min-w-0">
        <Probe id="tt-cell" cell />
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
