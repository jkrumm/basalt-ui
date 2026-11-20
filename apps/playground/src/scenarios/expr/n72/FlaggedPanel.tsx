import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import type { ChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { Submission } from './fixture'
import { CASE_LABEL } from './AgreementCard'

const c = col<Submission>()

const COLUMNS = [
  c.entity('id', { header: 'Message', mono: true, priority: 1, sortable: false }),
  c.status('kind', {
    header: 'Case',
    options: ['delivered', 'sure', 'other'],
    labels: CASE_LABEL,
    tone: (v) => (v === 'delivered' ? 'bad' : v === 'sure' ? 'accent' : 'neutral'),
    priority: 1,
    sortable: false,
  }),
  c.text('pair', { header: 'First / second, %', priority: 2, sortable: false }),
  c.text('form', { header: 'Form', priority: 3, sortable: false }),
  c.text('outcome', { header: 'Outcome', priority: 2, sortable: false }),
  c.date('at', { header: 'Received', priority: 3, sortable: false }),
]

const VISIBLE_ROWS = 8

export function FlaggedPanel({
  phase,
  rows,
  focus,
  failed,
}: {
  phase: Phase
  rows: readonly Submission[]
  focus: ChartFocus<Submission>
  failed: boolean
}) {
  const shownRows = rows.length === 0 ? VISIBLE_ROWS : Math.min(VISIBLE_ROWS, rows.length)
  const table = useDataTable({
    id: 'n72-flagged',
    label: 'Rows to check',
    columns: COLUMNS,
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: shownRows,
  })
  return (
    <DataPanel
      title="Flagged messages"
      subtitle="Worst first, then every disagreement"
      phase={phase}
      empty={
        rows.length === 0 && !failed
          ? { cause: 'Nothing to flag until submissions are scored.' }
          : null
      }
      bodySize={{ rows: shownRows + 1 }}
      body={() => <DataTable table={table} focus={focus} height="fill" />}
    />
  )
}
