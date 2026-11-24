import type { Phase } from 'basalt-ui/cards'
import { DataPanel } from 'basalt-ui/cards'
import type { ChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { LIMIT, NEXT_HOURS, type Hour } from './fixture'

const c = col<Hour>()
const COLUMNS = [
  c.entity('clock', { header: 'Hour', mono: true, sortable: false, priority: 1 }),
  c.text('seaText', { header: 'Height, period', sortable: false, priority: 1 }),
  c.status('sea', {
    header: 'Limit',
    options: ['over', 'under'],
    labels: { over: 'Over', under: 'Under' },
    tone: (v) => (v === 'over' ? 'bad' : 'neutral'),
    sortable: false,
    priority: 2,
  }),
  c.text('windText', { header: 'Wind', sortable: false, priority: 2 }),
]

export function HoursPanel({
  rows,
  phase,
  focus,
}: {
  rows: readonly Hour[]
  phase: Phase
  focus: ChartFocus<Hour>
}) {
  const table = useDataTable({
    id: 'expr-n56-hours',
    label: 'Hourly forecast',
    columns: COLUMNS,
    data: rows.slice(0, NEXT_HOURS),
    getRowId: (h) => h.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: NEXT_HOURS,
    phone: 'scroll',
  })
  return (
    <DataPanel
      title="Next 12 hours"
      subtitle={`Over means above ${LIMIT} m`}
      phase={phase}
      bodySize={{ height: 454 }}
      body={() => <DataTable table={table} focus={focus} height="fill" />}
    />
  )
}
