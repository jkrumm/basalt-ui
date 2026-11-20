import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/data'
import type { Run } from '../../demo/data'

const c = col<Run>()

export function Demo(): ReactElement {
  const table = useDataTable({
    id: 'runs',
    label: 'Runs',
    columns: [c.entity('name', { header: 'Run' }), c.number('km', { header: 'Distance' })],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}
