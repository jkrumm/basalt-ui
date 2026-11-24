import type { ReactElement } from 'react'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { FileWarning, Trash2 } from 'lucide-react'
import type { Waiting, WaitingKind } from './fixture'

const c = col<Waiting>()

const KIND_LABEL: Record<WaitingKind, string> = { trash: 'Trash', sidecar: 'Sidecar' }

/** The trash entries past retention and the listed unreadable sidecars, one table. */
export function WaitingPanel({
  rows,
  oldest,
  phase,
  cause,
}: {
  rows: readonly Waiting[]
  /** The longest stay in the trash: the meter's full bar. */
  oldest: number
  phase: Phase
  cause: string
}): ReactElement {
  const t = useDataTable({
    id: 'waiting',
    label: 'Waiting to be dealt with',
    columns: [
      c.entity('name', { header: 'File', mono: true, priority: 1 }),
      c.status('kind', {
        header: 'Kind',
        options: ['trash', 'sidecar'],
        labels: KIND_LABEL,
        icon: (row) => (row.kind === 'trash' ? Trash2 : FileWarning),
        tone: () => 'neutral',
        filter: 'multi',
        priority: 1,
        card: 'detail',
      }),
      c.text('detail', { header: 'Detail', priority: 3, card: 'detail' }),
      c.meter('days', {
        header: 'Days kept',
        max: Math.max(oldest, 1),
        priority: 2,
        card: 'value',
      }),
    ],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase,
    phone: 'columns',
    bodyRows: 8,
  })
  return (
    <DataPanel
      title="Waiting to be dealt with"
      subtitle="Entries to empty and files to repair"
      phase={phase}
      empty={rows.length === 0 ? { cause } : null}
      // An empty panel is short and draws no table, so the kit's own arm keeps its cause in view.
      bodySize={{ rows: rows.length === 0 ? 4 : 19, cardHeight: 33 }}
      body={() => (rows.length === 0 ? null : <DataTable table={t} height="fill" />)}
    />
  )
}
