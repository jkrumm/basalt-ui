---
name: useDataTable
use when: 'a page shows rows with sort, filter, paging or selection as a v3 table'
never when: 'the rows are static with no behaviour (use `ui/table`)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# useDataTable

The table's state, engine, selection and phase in one call. Hand the result to `DataTable` or
to the parts. A narrow table becomes cards: `phone` defaults to `'cards'` (`'scroll'` pins the
name and scrolls sideways) and `cardsBelow` to `'regular'` (480 px of the table's own width, 800 px
when its priority 1 and 2 columns need more; `'wide'` is always 800, `'always'` never shows a
table). The tiers live in `basalt-ui/table.css`, which `basalt()` imports for any module that imports
`basalt-ui/table`; an app without the plugin imports it beside `basalt-ui/table`.

## Signature

```ts
useDataTable<T>(options: UseDataTable<T>): DataTableInstance<T>
  // either detail or onRowActivate + activeRowId
  id: string
  label: string
  columns: readonly KindColumn<T>[]
  data?: readonly T[]  // Optional while `phase` is a pending query: the table shows its loading phase until rows arrive
  getRowId: (row: T) => string
  mode: Mode
  state?: StateHandle<TableState>
  phase?: Phase | QueryStateLike
  now?: number  // A fixed clock in epoch ms for the relative-time cells (a fixture, a test)
  empty?: Empty | null  // Why the table has no rows, and what to do about it: its `cause` replaces the default sentence and its `action` renders beside it
  resetOn?: readonly unknown[]
  phone?: "cards" | "scroll"  // What a narrow table becomes: cards, or the table scrolling sideways with its first column pinned; default 'cards'
  cardsBelow?: "regular" | "wide" | "always"  // The width below which the table becomes cards (`regular` is 480 px, `wide` 800 px, `always` never a table); default 'regular'
  pager?: "none" | "pages" | "more"  // The pager: `pages` steps through numbered pages, `more` is a Load more button, `none` shows every row; default 'none' on a client table, 'more' on a cursor table, 'pages' on any other server table
  group?: { by: string; summary?: (rows: readonly T[], box: Box) => ReactNode; }  // A type error unless `mode.kind` is `'client'` (enforced in `useDataTable` at the call site)
  selection?: { bulk: BulkAction<T>[]; selectAll?: boolean; }
  views?: { store?: ViewStore; }
  detail?: (row: T, box: Box) => ReactNode
  detailTitle?: (row: T) => string  [with detail]  // The title of a row's detail entry (the aside or sheet header); the table label when absent
  detailState?: ControlHandle<string>  [with detail]  // A string field of row ids that holds the open row: activating a row writes its id, closing the sheet calls `clear()`, and a value that names a loaded row opens its detail on load, on a share link and on Back
  detailById?: (id: string, box: Box) => ReactNode  [with detail]  // The body of a record the table has not loaded, for a `detailState` field that names an id no loaded row has (a share link after the record left the filters, a row on another page of a server table): once the query settles the detail door opens with this body under the table label, and the page fetches the record by id
  onRowActivate?: (row: T) => void
  activeRowId?: string  // The id of the row the page has open (a detail the page draws itself): that row is drawn as the selected row a…
```

`Phase`, `QueryStateLike`, `Empty` import from the root: `import type { Phase, QueryStateLike, Empty } from 'basalt-ui'`.

## Example

```tsx
const c = col<Order>()
const t = useDataTable({
  id: 'orders',
  label: 'Orders',
  columns: [c.entity('customer'), c.money('total', { currency: 'EUR' })],
  data: query.data,
  phase: query,
  getRowId: (o) => o.id,
  mode: { kind: 'client' },
})
```
