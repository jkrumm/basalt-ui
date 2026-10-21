import { Box } from '@mantine/core'
import type { ReactElement } from 'react'
import { BasaltDataTable, createColumnHelper } from '../../../src/table'

type Row = { name: string; start: string; duration: number; state: string }
const col = createColumnHelper<Row>()

const ROWS: Row[] = Array.from({ length: 12 }, (_, index) => ({
  name: `Core router ${index + 1}`,
  start: '2026-10-20T08:00:00Z',
  duration: 40 + index * 13,
  state: index % 3 === 0 ? 'Resolved' : 'Open',
}))

const COLUMNS = [
  col.accessor('name', { header: 'Service', meta: { kind: 'entity' } }),
  col.accessor('start', { header: 'Started', meta: { kind: 'relative-time' } }),
  col.accessor('duration', { header: 'Duration (min)', meta: { kind: 'number' } }),
  col.accessor('state', { header: 'State', meta: { kind: 'status' } }),
]

/** Wave 42 sizing and state chrome: a 4-column kinded table spanning its container, with an active facet pill and a pager (`w42-states`). */
export function W42StatesFixture({ loading }: { loading?: true }): ReactElement {
  return (
    <Box data-testid="w42-states">
      <BasaltDataTable
        title="Outages"
        data={loading === true ? [] : ROWS}
        columns={COLUMNS}
        isLoading={loading === true}
        enablePagination
        initialPagination={{ pageIndex: 0, pageSize: 5 }}
        initialColumnFilters={[{ id: 'state', value: 'Open' }]}
        facets={[
          {
            columnId: 'state',
            label: 'State',
            options: [
              { value: 'Open', label: 'Open' },
              { value: 'Resolved', label: 'Resolved' },
            ],
          },
        ]}
      />
    </Box>
  )
}
