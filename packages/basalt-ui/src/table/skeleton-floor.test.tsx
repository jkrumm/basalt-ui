/**
 * A loading table's skeleton floors a cell by its column kind, but the synthetic checkbox and
 * actions columns have none: they keep their own fixed width, never the kindless floor.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltDataTable } from './data-table'
import { createColumnHelper } from './index'

afterEach(cleanup)

type Row = { name: string; note: string }
const col = createColumnHelper<Row>()
const COLUMNS = [
  col.accessor('name', { header: 'Name', meta: { kind: 'entity' } }),
  col.accessor('note', { header: 'Note' }),
]

describe('skeleton cell floors', () => {
  test('a kindless column floors at 8rem; the select and actions columns take no floor', () => {
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable
          data={[]}
          columns={COLUMNS}
          title="Rows"
          isLoading
          skeletonRows={1}
          enableRowSelection
          rowActions={[{ key: 'open', label: 'Open', onClick: () => undefined }]}
        />
      </MantineProvider>,
    )
    const floors = [...container.querySelectorAll<HTMLElement>('tbody tr:first-child td')].map(
      (td) => td.style.minWidth,
    )
    expect(floors).toContain('8rem')
    expect(floors.filter((floor) => floor === '8rem')).toHaveLength(1)
  })
})
