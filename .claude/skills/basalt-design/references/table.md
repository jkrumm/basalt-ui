# Table

A table is one `useDataTable` and one `<DataTable>`; the kinds, the tiers and the phone cards are decided for you. Props are in the generated docs: [DataTable](docs/data-table.md), [useDataTable](docs/use-data-table.md). The composed exemplar is `apps/playground/src/routes/table.tsx`: server mode with chips, facets and bulk actions, 10k virtual rows with `c.select`, and one grouped table.

Requires TanStack Table's own `table-state` skill for anything under `t.table`: this file does not restate v9.

## Pick the mode first

- Fewer than about 200 rows and all in hand: `mode: { kind: 'client' }`. Above 500 client rows add `virtual` and a fixed `height`; above that the rows belong on a server.
- The server pages and filters: `mode: { kind: 'server', rowCount }`. Pass `rowCount` as `undefined` until it is known; the table never prints "of 0". A cursor API passes `cursor` instead, never both.
- Rows that never sort, filter or select are `ui/table`, not this.

```tsx
// @check
import { col, DataTable, useDataTable } from 'basalt-ui/table'

type Booking = { id: string; payee: string; amount: number; state: string }
const c = col<Booking>()

export function Bookings({ rows }: { rows: readonly Booking[] }) {
  const t = useDataTable({
    id: 'bookings',
    label: 'Bookings',
    columns: [
      c.entity('payee', { filter: 'text' }),
      c.money('amount', { currency: 'EUR', footer: 'sum' }),
      c.status('state', { options: ['Open', 'Settled'], filter: 'multi' }),
    ],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    detail: (row) => <p>{row.payee}</p>,
  })
  return <DataTable table={t} />
}
```

## Kinds and priority

- A column is a kind (`c.entity`, `c.money`, `c.status`, `c.date`, ...); the kind sets alignment, numerals, width, sort, filter and card slot. A raw column or a free `cell` does not exist. `c.custom` is the one counted escape and must declare `sortValue`, `card` and `priority`.
- `priority` says what survives a narrow table: 1 always, 2 at reduced width, 3 at full width only. Give an identity column 1; at most two columns are 1, the rest demote in declaration order.
- Absent values print a dash; a zero is a zero.

## Where state lives

- `request` (search, filters, sort, page) is the query key and belongs in the URL; `display` (hidden columns) is the device's. Bind `state` to a `field.composite` of a `defineControls` store, or omit it for a table that holds its own memory.
- A filter the page shares with other widgets stays a page control and reaches the table through `resetOn`; a filter that is a chip on this table stays in `request`. A second table on a page needs a `prefix` on its codec.
- A presentation switch (table or cards) is its own param, never `view`: see the `view-switch` recipe.

## Phone and the 390 px check

- Below 480 px the same rows become cards: sort moves to the toolbar, selection to an explicit Select mode, the row's actions to a kebab. `phone: 'scroll'` keeps a numeric matrix a table.
- Every column's data must be reachable on a phone. With `detail`, tapping a row opens it; with `onRowActivate`, the row navigates and a Details door opens the sheet; with neither, tapping opens the auto sheet of every column.
- Render the page at 390 wide before you stop and count the cards: a column that appears nowhere is a defect.

## Selection

- `selection: { bulk }` adds the tick column and a bar that shows only while a row is ticked. A bulk action is `{ key, label, onClick(rows, selection) }`, at most five, one primary. `getRowId` is required.
- A selection of every matching row (`selectAll`) is a snapshot of the request: it clears when the request changes.

```tsx
// @check
import { col, DataTable, useDataTable } from 'basalt-ui/table'

type Order = { id: string; customer: string; total: number }
const c = col<Order>()

export function Orders({ rows, total }: { rows: readonly Order[]; total: number | undefined }) {
  const t = useDataTable({
    id: 'orders',
    label: 'Orders',
    columns: [c.entity('customer'), c.money('total', { currency: 'EUR' })],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'server', rowCount: total },
    selection: { bulk: [{ key: 'archive', label: 'Archive', onClick: (picked) => picked.length }] },
    onRowActivate: (row) => row.id,
  })
  return <DataTable table={t} />
}
```

not guarded:

- Never hand-roll a table, a CSS-grid list that reads as one, or a card twin of a table; a gap in the kinds is reported, not rebuilt.
- Never mix `detail` with `onRowActivate`; one is the row's action.
- A table in a card or a section takes its title from that frame, not from a heading above it.
