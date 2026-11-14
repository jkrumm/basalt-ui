// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:export
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
// #endregion
