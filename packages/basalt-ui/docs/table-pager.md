---
name: TablePager
use when: 'a bespoke layout draws the pager apart from the `DataTable` scroller'
never when: 'the full `DataTable` fits (it already renders the pager)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: [table-pager, table-pager-range]
---

# TablePager

The pager of a table. Pass the instance `useDataTable` returned; `DataTable` composes it when
`pager` is not `'none'`.

## Signature

```ts
TablePager<T>({ table: instance, }: { table: DataTableInstance<T>; }): ReactElement | null
  table: DataTableInstance<T>
```

## Example

```tsx
<TablePager table={t} />
```
