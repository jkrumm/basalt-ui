---
name: export
use-when: a table needs a CSV of its rows, because the table itself has no export
file: apps/playground/src/recipes/export.tsx
---

Export is the app's: the table ships no file format, so a CSV is a function over `t.table`, the read view of what the table shows.
`table.matched` holds every row matching the request, `table.columns` the visible columns in order with their raw `value`.
Quote a value that holds a comma, a quote or a newline, and double the quotes inside it.
A table that pages on the server exports from the server: send `state.request` to an endpoint that returns the whole match.
The page is never part of a request you export, and a selection of ids is a filter the endpoint takes.

```tsx
import type { DataTableInstance } from 'basalt-ui/table'
import { Button } from 'basalt-ui/ui/button'

type Run = { id: string; name: string; km: number }

const quote = (value: unknown): string => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The rows the table matched and the columns it shows, in its order: the file reads like the table. */
export function toCsv<T>({ table }: DataTableInstance<T>): string {
  const { columns, matched } = table
  const line = (row: T) => columns.map((column) => quote(column.value(row))).join(',')
  return [columns.map((column) => quote(column.header)).join(','), ...matched.map(line)].join('\n')
}

export function ExportCsv({ table }: { table: DataTableInstance<Run> }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([toCsv(table)], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'runs.csv' }).click()
    URL.revokeObjectURL(url)
  }
  return <Button onClick={save}>Export CSV</Button>
}
```
