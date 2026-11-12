// The S5 timing fixture: 10k synthetic rows on the table's own 10-feature engine, a windowed body
// (`VirtualList`, tr spacer), three columns. `?cell=direct|app` picks how a cell is drawn,
// `?cols=stable|render` whether the column array keeps its identity across renders.
//   direct  `flexRender(columnDef.cell, cell.getContext())` in a `TableCell`, as the parts do
//   app     the same cell inside `<table.AppCell>` and drawn by its `FlexRender`
import { flexRender } from '@tanstack/react-table'
import { useState } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { tableEngine } from '../../../../packages/basalt-ui/src/table/core/features'
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../packages/basalt-ui/src/ui/table'
import { VirtualList } from '../../../../packages/basalt-ui/src/ui/virtual-list'

type Row = { id: string; name: string; amount: number; state: string }

const STATES = ['Engineering', 'Design', 'Sales', 'Support'] as const
const ROWS: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Project ${(i * 7919) % 10_000}`,
  amount: (i * 104_729) % 99_991,
  state: STATES[i % STATES.length] ?? 'Sales',
}))

const helper = tableEngine.createAppColumnHelper<Row>()
const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' })

const makeColumns = () => [
  helper.accessor('name', {
    id: 'name',
    header: 'Name',
    sortFn: 'alphanumeric',
    cell: (ctx) => ctx.getValue(),
  }),
  helper.accessor('amount', {
    id: 'amount',
    header: 'Amount',
    sortFn: 'basic',
    cell: (ctx) => money.format(ctx.getValue()),
  }),
  helper.accessor('state', {
    id: 'state',
    header: 'State',
    sortFn: 'alphanumeric',
    cell: (ctx) => ctx.getValue(),
  }),
]
const STABLE = makeColumns()

const params = new URLSearchParams(location.search)
const cellArm = params.get('cell') === 'app' ? 'app' : 'direct'
const perRender = params.get('cols') === 'render'

function App() {
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const table = tableEngine.useAppTable({
    columns: perRender ? makeColumns() : STABLE,
    data: ROWS,
    getRowId: (r) => r.id,
    state: { sorting },
    onSortingChange: setSorting as never,
  } as never)
  const rows = table.getRowModel().rows
  const headers = table.getHeaderGroups()[0]?.headers ?? []
  return (
    <VirtualList
      className="scroller"
      spacer="tr"
      columns={3}
      count={rows.length}
      estimateSize={() => 32}
      getItemKey={(index) => rows[index]?.id ?? index}
      head={
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h.id}>
                <button
                  type="button"
                  onClick={() => setSorting([{ id: h.column.id, desc: false }])}
                >
                  {String(h.column.columnDef.header)}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      }
    >
      {([item]) => {
        const row = rows[item?.index ?? 0]
        if (row === undefined) return null
        return (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) =>
              cellArm === 'app' ? (
                <table.AppCell key={cell.id} cell={cell as never}>
                  {(c: { FlexRender: ComponentType }) => (
                    <TableCell>
                      <c.FlexRender />
                    </TableCell>
                  )}
                </table.AppCell>
              ) : (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext() as never)}
                </TableCell>
              ),
            )}
          </TableRow>
        )
      }}
    </VirtualList>
  )
}

createRoot(document.getElementById('app') as HTMLElement).render(<App />)

const raf = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))

/** Click a sort header, wait two animation frames, return the elapsed ms. */
;(window as unknown as { sortOnce: (header: string) => Promise<number> }).sortOnce = async (
  header,
) => {
  const button = Array.from(document.querySelectorAll<HTMLElement>('th button')).find(
    (el) => el.textContent?.trim() === header,
  )
  if (button === undefined) throw new Error(`no sort header ${header}`)
  const start = performance.now()
  button.click()
  await raf()
  await raf()
  return performance.now() - start
}
