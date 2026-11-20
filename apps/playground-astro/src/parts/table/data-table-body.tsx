import { col, DataTableBody, useDataTable } from 'basalt-ui/table'
import { Table, TableHead, TableHeader, TableRow } from 'basalt-ui/ui/table'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/data'
import type { Run } from '../../demo/data'

const c = col<Run>()

export function Demo(): ReactElement {
  const table = useDataTable({
    id: 'runs-body',
    label: 'Runs',
    columns: [c.entity('name', { header: 'Run' }), c.number('km', { header: 'Distance' })],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    pager: 'none',
  })
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead numeric>Distance</TableHead>
        </TableRow>
      </TableHeader>
      <DataTableBody table={table} />
    </Table>
  )
}
