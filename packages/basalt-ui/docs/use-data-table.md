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
name and scrolls sideways; `'columns'` keeps a table of the name, the card's `value` and its first
`meta`, the rest in the row's details) and `cardsBelow` to `'regular'` (480 px of the table's own width, 700 or
800 px when its priority 1 and 2 columns need more; `'wide'` is always 800, `'always'` never shows a
table). The tiers live in `basalt-ui/table.css`, which `basalt()` imports for any module that imports
`basalt-ui/table`; an app without the plugin imports it beside `basalt-ui/table`. The column plan's rules, and
what `shot detect` reports of a column it hides, are in `col`.

## Signature

```ts
useDataTable<T, const F extends readonly unknown[] = readonly any[]>(options: UseDataTable<T, F>): DataTableInstance<T>
  // either detail, detailById or onRowActivate + activeRowId
  id: string
  label: string
  columns: readonly KindColumn<T>[]
  data?: readonly T[]  // Optional while `phase` is a pending query: the table shows its loading phase until rows arrive
  getRowId: (row: T) => string
  mode: Mode
  state?: StateHandle<TableState>
  phase?: Phase | QueryStateLike
  bodyRows?: number  // The rows the page expects: a table that mounts loading draws this many skeleton rows, so the frame does not jump when they arrive; default 6
  now?: number  // A fixed clock in epoch ms for the relative-time cells (a fixture, a test)
  empty?: Empty | null  // Why the table has no rows, and what to do about it: its `cause` replaces the default sentence and its `action` renders beside it
  filters?: PageFilters<T, F>  // Page fields that narrow a client table's rows (a Section's filters over it): each is a field handle with a row predicate, `match(row, value)` typed by that field's value
  resetOn?: readonly unknown[]
  phone?: "cards" | "scroll" | "columns"  // What a narrow table becomes: `cards`; `scroll`, the table scrolling sideways with its first column pinned; or `columns`, the table keeping its header and three columns (the name, the column placed in the card's `value` and the first placed in its `meta` that draws a meter, a delta or a status, else the first placed in it) while the rest move to the row's details: a long numeric table that must keep its answer in view at 390; default 'cards'
  look?: "reading" | "grid"  // How the table draws its rules; default 'reading'
  headerIcons?: boolean  // Whether a header draws its column icon (each kind's default or the `headerIcon` a column names); default false in the reading look, true in the grid look
  cardsBelow?: "regular" | "wide" | "always"  // The width below which the table becomes cards (`regular` is 480 px, `wide` 800 px, `always` never a table); default 'regular'
  pager?: "none" | "pages" | "more"  // The pager: `pages` steps through numbered pages, `more` is a Load more button, `none` shows every row; default 'none' on a client table, 'more' on a cursor table, 'pages' on any other server table
  rowHeight?: RowHeight  // The body's row height until a reader picks one in a view: the density row of `dense` (2rem), `normal` (2.5rem) or `comfortable` (3rem); the head keeps its height
  rowNumbers?: boolean  // A row-number column after the tick: the row's place in the request (it runs on across groups and pages)
  group?: { by: string; summary?: (rows: readonly T[], box: Box) => ReactNode; fold?: boolean; }  // The rows grouped by a column, until a reader picks another column or none in a view
  nested?: { parentOf: (row: T) => string | null | undefined; }  // Nested rows (client mode only, never with `group`): each row is drawn under the row `parentOf` names, one level deeper, with the indent and the expander the table draws in its first column; a row whose parent is absent, itself or below it is a root
  selection?: { bulk: BulkAction<T>[]; selectAll?: boolean; }
  views?: { store?: ViewStore; }
  layouts?: readonly TableLayout[]  // The layouts a reader may pick in the view row, in toggle order; the view saves the pick; default ['table']
  detailTitle?: (row: T) => string  [with detail]  // The title of a row's detail entry (the aside or sheet header); the table label when absent
  detailTitleById?: (id: string) => string  [with detail]  // The title of a record opened by id (see `detailById`): a page that titles a record by its id passes the same function as `detailTitle` reads, so one record has one title however it opened
  detailState?: ControlHandle<string>  [with detail]  // A string field of row ids that holds the open row: activating a row writes its id, closing the sheet calls `clear()` (on a `history: 'push'` field the close is an entry of its own, so Back after it returns to the open record; a name that matches no row is cleared as a replace), and a value that names a loaded row opens its detail on load, on a share link and on Back
  detailById?: (id: string, box: Box) => ReactNode  [with detail]  // The body of a record the page fetches by id: without `detail` it is every row's body (an activation opens `detailById(getRowId(row), box)`, so the body is written once), with `detail` it is the body of a record no loaded row has, for a `detailState` field that names an unloaded id (a share link after the record left the filters, a row on another page of a server table)
  onRowActivate?: (row: T) => void
  activeRowId?: string  // The id of the row the page has open (a detail the page draws itself): that row is drawn as the selected row and carries `aria-current`
  detail?: (row: T, box: Box) => ReactNode
```

`Empty`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Empty, Phase, QueryStateLike } from 'basalt-ui/cards'`.

`ControlHandle` import from `basalt-ui/router`: `import type { ControlHandle } from 'basalt-ui/router'`.

`BulkAction`, `DataTableInstance`, `KindColumn`, `Mode`, `PageFilters`, `RowHeight`, `StateHandle`, `TableLayout`, `TableState`, `UseDataTable`, `ViewStore` import from `basalt-ui/table`: `import type { BulkAction, DataTableInstance, KindColumn, Mode, PageFilters, RowHeight, StateHandle, TableLayout, TableState, UseDataTable, ViewStore } from 'basalt-ui/table'`.

`Box` import from `basalt-ui`: `import type { Box } from 'basalt-ui'`.

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
