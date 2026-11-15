---
name: TableToolbar
use when: 'a data table needs search, filters or saved views above it'
never when: 'the table is small and fixed (omit the toolbar), or the page owns the filters in a `FilterSet`'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: [table-filter-add, table-toolbar]
---

# TableToolbar

The toolbar of a table: search, filters, chips, display and saved views.

## Signature

```ts
TableToolbar<T>({ table: instance, view, }: { table: DataTableInstance<T>; view?: ViewParam; }): ReactElement
  table: DataTableInstance<T>
  view?: ViewParam  // Binds the applied view's id to the route's own search; the address bar's `?view=` when omitted
```

## Example

```tsx
<TableToolbar table={t} />
<DataTable table={t} />
```
