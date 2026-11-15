---
name: BulkBar
use when: 'a bespoke layout places the bulk bar itself, above or beside the table'
never when: 'the full `DataTable` fits (it already renders the bar)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: [table-bulk]
---

# BulkBar

The bulk bar of a table. Renders nothing while no row is ticked or the table has no `selection`.
`DataTable` composes it above the scroller.

## Signature

```ts
BulkBar<T>({ table: instance, }: { table: DataTableInstance<T>; }): ReactElement | null
  table: DataTableInstance<T>
```

## Example

```tsx
<BulkBar table={t} />
```
