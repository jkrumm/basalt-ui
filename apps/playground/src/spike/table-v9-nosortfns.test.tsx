// Spike (W1 ledger) negative control: v9 WITHOUT registered sortFns sorts strings as `basic`.
import { expect, test } from 'bun:test'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table-v9'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() })
const col = createColumnHelper<typeof features, { name: string }>()
const columns = col.columns([col.accessor('name', {})])
const data = ['Project 10', 'Project 2', 'Project 1'].map((name) => ({ name }))

function Names(): ReactNode {
  const table = useTable({
    features,
    data,
    columns,
    initialState: { sorting: [{ id: 'name', desc: false }] },
  })
  return (
    <ol>
      {table.getRowModel().rows.map((r) => (
        <li key={r.id}>{r.original.name}</li>
      ))}
    </ol>
  )
}

test('unregistered sortFns: lexicographic, not alphanumeric', () => {
  const out = [...renderToString(<Names />).matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1])
  expect(out).toEqual(['Project 1', 'Project 10', 'Project 2'])
})
