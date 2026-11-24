---
name: useTableViews
use when: 'a list page puts a table''s saved views, search and filter in its `PageBar` view row'
never when: 'the table sits in a card with its own toolbar (`TableToolbar` draws the same views)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# useTableViews

Saved views as the view row of a page: tabs that apply a view, a per-tab menu, `+ View`, Save and
Discard for a modified view, and the manage-view panel that edits everything the view owns (name,
sharing, row height, column widths, columns, filters, sort, grouping) while the table follows.

## Signature

```ts
useTableViews<T>(instance: DataTableInstance<T>, options?: TableViewsOptions): TableViewsResult
  __brand: "DataTableInstance"
  __row?: (row: T) => void
  table: TableEscape<T>
```

`DataTableInstance`, `TableEscape`, `TableViewsOptions`, `TableViewsResult` import from `basalt-ui/table`: `import type { DataTableInstance, TableEscape, TableViewsOptions, TableViewsResult } from 'basalt-ui/table'`.

## Example

```tsx
const t = useDataTable({ id: 'invoices', label: 'Invoices', columns, data, getRowId, mode: { kind: 'client' } })
const views = useTableViews(t)
<Page area="invoices" fill>
  <PageBar tabs={views.tabs} search={views.search} controls={views.controls} layout={views.layout} settings={views.settings} />
  {views.chips}
  <DataTable table={t} />
  {views.panel}
</Page>
```
