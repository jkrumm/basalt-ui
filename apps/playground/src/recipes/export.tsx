// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:export
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
// #endregion
