import { DataPanel } from 'basalt-ui/cards'
import type { ChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { VERDICTS, type Day, type Month } from './fixture'

const c = col<Day>()
const COLUMNS = [
  c.entity('label', { header: 'Day', mono: true, sortable: false, priority: 1 }),
  c.number('down', { header: 'Download', unit: 'Mbit/s', digits: 0, priority: 2 }),
  c.number('up', { header: 'Upload', unit: 'Mbit/s', digits: 0, priority: 2 }),
  c.status('verdict', {
    header: 'Verdict',
    options: VERDICTS,
    tone: (v) => (v.includes('below') ? 'accent' : 'neutral'),
    priority: 1,
  }),
]

/** The days as rows, joined to the page's one focus: pointing at a row focuses its bar in both charts. */
export function DaysPanel({
  month,
  focus,
  loading,
}: {
  month: Month
  focus: ChartFocus<Day>
  loading: boolean
}) {
  const table = useDataTable({
    id: 'n46-days',
    label: 'Days of April',
    columns: COLUMNS,
    data: month.days,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    phase: loading ? 'loading' : 'ready',
    bodyRows: 9,
  })
  return (
    <DataPanel
      title="Day by day"
      subtitle="Median test of each day, sortable"
      phase={loading ? 'loading' : undefined}
      bodySize={{ rows: 9 }}
      body={() => <DataTable table={table} focus={focus} height="fill" />}
    />
  )
}
