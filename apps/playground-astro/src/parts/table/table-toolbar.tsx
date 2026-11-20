import { BulkBar, col, TablePager, TableToolbar, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/data'
import type { Run } from '../../demo/data'

const c = col<Run>()

export function Demo(): ReactElement {
  const table = useDataTable({
    id: 'runs-toolbar',
    label: 'Runs',
    columns: [c.entity('name', { header: 'Run' }), c.number('km', { header: 'Distance' })],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    pager: 'pages',
    selection: { bulk: [{ id: 'export', label: 'Export', onClick: () => {} }] },
  })
  return (
    <div className="flex flex-col gap-3">
      <TableToolbar table={table} />
      <BulkBar table={table} />
      <TablePager table={table} />
    </div>
  )
}
