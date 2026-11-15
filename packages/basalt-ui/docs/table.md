---
name: Table
use when: 'the rows are static and need no sort, filter, paging or selection: a short list, a spec sheet, a receipt'
never when: 'the table sorts, filters, pages or selects (use `DataTable` over `useDataTable`)'
subpath: basalt-ui/ui/table
peers: ['@base-ui/react']
slots: [table, table-header, table-body, table-row, table-head, table-cell, table-caption]
---

# Table

A plain, static table: hairline rows, a sticky head and a row height from `size`. It renders the
native `<table>` and works with no provider; wrap it in a scroll container to scroll it, and the
head sticks inside that container (or to the page when there is none).

## `tableVariants`

Part `table`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `table`
- `table-header`
- `table-body`
- `table-row`
- `table-head`
- `table-cell`
- `table-caption`
