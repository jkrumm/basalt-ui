/**
 * A table whose query failed offers Retry when the query can refetch, alone and inside a `DataPanel`, as a
 * `ChartCard` does. Frames on one `refetch` share one button (`parts/data-table.test.tsx`).
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import { DataPanel } from '../cards/data-panel'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Row = { id: string; name: string }
const c = col<Row>()

const failed = (refetch: () => unknown) => ({
  isPending: false,
  isError: true,
  error: new Error('network down'),
  refetch,
})

function Table({ refetch }: { refetch: () => unknown }): ReactElement {
  const t = useDataTable<Row>({
    id: 'retry',
    label: 'Runs',
    columns: [c.entity('name', { header: 'Run' })],
    phase: failed(refetch),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

describe('the table error frame of a refetchable query', () => {
  test('a table on its own offers Retry and refetches on click', () => {
    const refetch = mock(() => undefined)
    const { getByRole } = render(<Table refetch={refetch} />)
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('a table inside a DataPanel on the same query offers Retry once', () => {
    const refetch = mock(() => undefined)
    const { getAllByRole } = render(
      <DataPanel
        title="Runs"
        phase={failed(refetch)}
        bodySize={{ rows: 3 }}
        body={() => <Table refetch={refetch} />}
      />,
    )
    const buttons = getAllByRole('button', { name: 'Retry' })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0] as HTMLElement)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('a query that cannot refetch has no Retry', () => {
    const { queryByRole } = render(
      <DataPanel
        title="Runs"
        phase={{ isPending: false, isError: true, error: new Error('x') }}
        bodySize={{ rows: 3 }}
        body={() => null}
      />,
    )
    expect(queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
