import { Box } from '@mantine/core'
import type { ReactElement } from 'react'
import { BasaltDataTable, createColumnHelper } from '../../../src/table'

type Row = { name: string; note: string; count: number; tag: string }
const col = createColumnHelper<Row>()

const LONG = 'A long exercise name that cannot fit the column it was given'
const ROWS: Row[] = [
  { name: LONG, note: LONG, count: 4, tag: 'a tag that is long enough to wrap' },
  { name: 'Squat', note: 'Squat', count: 12, tag: 'b' },
]

const COLUMNS = [
  col.accessor('name', { header: 'Name', meta: { kind: 'entity' } }),
  col.accessor('note', { header: 'Note', meta: { kind: 'text' } }),
  col.accessor('count', { header: 'Count', meta: { kind: 'number' } }),
  col.accessor('tag', { header: 'Tag' }),
]

/** Wave 42 cell kinds: a sorted and an unsorted sortable header, and an entity beside a text cell holding the same long string in a narrow box (`w42-kinds`). */
export function W42KindsFixture(): ReactElement {
  return (
    <Box data-testid="w42-kinds" maw={420}>
      <BasaltDataTable
        data={ROWS}
        columns={COLUMNS}
        initialSorting={[{ id: 'count', desc: true }]}
        minWidth={420}
      />
    </Box>
  )
}
