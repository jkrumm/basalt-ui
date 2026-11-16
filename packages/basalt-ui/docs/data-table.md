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
DataTable<T>({ table, detail, height, virtual, focus, }: DataTableProps<T>): ReactElement
  // either height + virtual or neither
  table: DataTableInstance<T>
  detail?: DetailHost
  focus?: ListFocus<T>  // A chart's focus over the same rows (`useChartFocus(rows, …)`): a row maps to its item by `getRowId`, so sort and filter keep the link
  height?: "auto" | Scrollport
  virtual?: VirtualLike
```

## Example

```tsx
<DataTable table={t} height="fill" />
```
