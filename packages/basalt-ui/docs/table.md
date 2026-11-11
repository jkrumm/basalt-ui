---
name: Table
use when: ''
never when: ''
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

- `size`: `md`, `compact` (default `md`)

## Slots

- `table`
- `table-header`
- `table-body`
- `table-row`
- `table-head`
- `table-cell`
- `table-caption`
