---
name: DataTable
use when: 'a page lists records that sort, filter, page, select or open in a detail'
never when: 'the rows are static with no behaviour (use `ui/table`) or a chart says it better'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: [table-root, table-rows-shown, table-scroller]
---

# DataTable

The data table: head, body and the phase arms of one `useDataTable` instance.

## Signature

```ts
DataTable<T>({ table, detail, height, virtual, focus, focusSeries, }: DataTableProps<T>): ReactElement
  // either focus, height + virtual, focusSeries or focusSeries + height + virtual
  table: DataTableInstance<T>
  detail?: DetailHost
  focus?: ListFocus<T>  // A chart's focus over the same rows (`useChartFocus(rows, …)`): a row maps to its item by `getRowId`, so sort and filter keep the link
  focusSeries?: { focus: { readonly setSeries: (key: string | null) => void; readonly seriesItem: (key: string) => ListFocusItem; }; key: (row: T) => string; }  // A chart's focus whose series the rows stand for (one row per line): `key` maps a row to its series key
  height?: "auto" | Scrollport
  virtual?: VirtualLike
```

## Example

```tsx
<DataTable table={t} height="fill" />
```
