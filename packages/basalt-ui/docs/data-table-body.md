---
name: DataTableBody
use when: 'a bespoke layout draws the table body itself, inside the `DataTable` scroller'
never when: 'the full `DataTable` fits (it already renders the body)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# DataTableBody

The `<tbody>` of a table: rows, or the arm of the current phase.

## Signature

```ts
DataTableBody<T>({ table: instance, detail, }: { table: DataTableInstance<T>; detail?: DetailHost; }): ReactElement
  table: DataTableInstance<T>
  detail?: DetailHost  // Where a `detail` activation shows its entry
```

`DataTableInstance` import from `basalt-ui/table`: `import type { DataTableInstance } from 'basalt-ui/table'`.

## Example

```tsx
<DataTableBody table={t} detail={asideHost} />
```
