import { Box, Card } from '@mantine/core'
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

const LONG_ERROR_QUERY = {
  data: undefined,
  isError: true,
  error: new Error(
    'The upstream service did not answer the request within its window, so nothing could be loaded here.',
  ),
  fetchStatus: 'idle',
  refetch: () => undefined,
} as const

/** Wave 42 sizing and state chrome: a 4-column kinded table spanning its container, with an active facet pill and a pager (`w42-states`). */
export function W42StatesFixture({
  loading,
  pinned,
  longError,
}: {
  loading?: true
  pinned?: true | 'striped-page'
  longError?: true
}): ReactElement {
  const Wrap = pinned === true ? Card : Box
  return (
    <Wrap data-testid="w42-states">
      <BasaltDataTable
        title="Outages"
        data={loading === true ? [] : ROWS}
        columns={COLUMNS}
        isLoading={loading === true}
        {...(longError === true && { data: [], query: LONG_ERROR_QUERY })}
        {...(pinned === true && {
          stickyHeader: true,
          enablePinning: true,
          initialColumnPinning: { start: ['name'] },
        })}
        {...(pinned === 'striped-page' && {
          enablePinning: true,
          initialColumnPinning: { start: ['name'] },
          striped: true,
        })}
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
    </Wrap>
  )
}
