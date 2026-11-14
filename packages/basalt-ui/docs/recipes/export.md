---
name: export
use-when: a table needs a CSV of its rows, because the table itself has no export
file: apps/playground/src/recipes/export.tsx
---

Export is the app's: the table ships no file format, so a CSV is a function over the rows and the columns you already own.
Pass the rows you gave `useDataTable`, and a key list in the order of the columns, so the file reads like the table.
Quote a value that holds a comma, a quote or a newline, and double the quotes inside it.
A table that pages on the server exports from the server: send `state.request` to an endpoint that returns the whole match.
The page is never part of a request you export, and a selection of ids is a filter the endpoint takes.

```tsx
import { Button } from 'basalt-ui/ui/button'

type Run = { id: string; name: string; km: number }

const quote = (value: unknown): string => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<T extends object>(rows: readonly T[], keys: readonly (keyof T & string)[]) {
  const line = (row: T) => keys.map((key) => quote(row[key])).join(',')
  return [keys.join(','), ...rows.map(line)].join('\n')
}

export function ExportCsv({ rows }: { rows: readonly Run[] }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows, ['name', 'km'])], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'runs.csv' }).click()
    URL.revokeObjectURL(url)
  }
  return <Button onClick={save}>Export CSV</Button>
}
```
