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
to the parts.

## Signature

```ts
useDataTable<T>(options: UseDataTable<T>): DataTableInstance<T>
  id: string
  label: string
  columns: readonly KindColumn<T>[]
  data: readonly T[]
  getRowId: (row: T) => string
  mode: Mode
  state?: StateHandle<TableState>
  phase?: Phase | QueryStateLike
  resetOn?: readonly unknown[]
  phone?: "cards" | "scroll"
  cardsBelow?: "regular" | "wide" | "always"
  pager?: "none" | "pages" | "more"
  group?: { by: string; summary?: (rows: readonly T[], box: Box) => R…
  selection?: { bulk: BulkAction<T>[]; selectAll?: boolean; }
  views?: { store?: ViewStore; }
  detail: (row: T, box: Box) => ReactNode
  onRowActivate?: (row: T) => void
```
