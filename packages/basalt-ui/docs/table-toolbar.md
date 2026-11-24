---
name: TableToolbar
use when: 'a data table needs search, filters or saved views above it'
never when: 'the table is small and fixed (omit the toolbar), or the page owns the filters in a `FilterSet`'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: [table-filter-add, table-toolbar]
---

# TableToolbar

The toolbar of a table: the saved views as tabs with Edit view, then search, filters, chips and
display. A list page whose `PageBar` holds the views, search and filter (`useTableViews`) draws no toolbar.

## Signature

```ts
TableToolbar<T>({ table: instance, view, views, onExport, }: { table: DataTableInstance<T>; view?: ViewParam; views?: boolean; onExport?: () => void; }): ReactElement
  table: DataTableInstance<T>
  view?: ViewParam  // Binds the applied view's id to the route's own search; the address bar's `?view=` when omitted
  views?: boolean  // Draws the saved views; `false` where the page's `PageBar` holds them
  onExport?: () => void  // Draws Export in the views' menu and panel; the app writes the file
```

`DataTableInstance`, `ViewParam` import from `basalt-ui/table`: `import type { DataTableInstance, ViewParam } from 'basalt-ui/table'`.

## Example

```tsx
<TableToolbar table={t} />
<DataTable table={t} />
```
