---
name: DataTable
use when: 'a page lists records that sort, filter, page, select or open in a detail'
never when: 'the rows are static with no behaviour (use `ui/table`) or a chart says it better'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: [table-root, table-scroller]
---

# DataTable

The data table: head, body and the phase arms of one `useDataTable` instance.

## Signature

```ts
DataTable<T>({ table, detail, height, virtual, }: DataTableProps<T>): ReactElement
  table: DataTableInstance<T>
  detail?: DetailHost
  height?: "auto" | Scrollport | Scrollport
  virtual: VirtualLike
```
