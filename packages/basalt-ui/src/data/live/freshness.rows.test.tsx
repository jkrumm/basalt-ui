/**
 * P6 (live-realtime 4.4): a refetch with equal data keeps row identity, so memoised unchanged rows
 * do not re-render. Per-response stamps are stripped by `select`; structural sharing does the rest.
 */
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render } from '@testing-library/react'
import { memo } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { makeQueryClient } from '../query-client'
import { liveQuery } from './live-query'

type Row = { id: number; name: string; fetchedAt?: number }
type Stamped = { rows: Row[] }

let client: QueryClient
let served: () => Stamped
const renders = new Map<number, number>()

beforeEach(() => {
  client = makeQueryClient()
  renders.clear()
})
afterEach(cleanup)

const RowView = memo(function RowView({ row }: { row: Row }) {
  renders.set(row.id, (renders.get(row.id) ?? 0) + 1)
  return <li>{row.name}</li>
})

const stripStamp = (data: Stamped): Row[] => data.rows.map(({ id, name }) => ({ id, name }))

const rowsQuery = () =>
  liveQuery(
    { queryKey: ['rows'], queryFn: async () => served(), select: stripStamp },
    { class: 'ticker', every: 60_000 },
  )

function List() {
  const { data } = useQuery(rowsQuery())
  return (
    <ul>
      {data?.map((row) => (
        <RowView key={row.id} row={row} />
      ))}
    </ul>
  )
}

/** Query batches its notifications on a timer: refetch, then let the batch land inside `act`. */
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const refetch = async () => {
  await act(async () => void (await client.refetchQueries({ queryKey: ['rows'] })))
  await tick()
}

describe('live list row identity (P6)', () => {
  test('an equal-data refetch re-renders no row, even with a fresh per-response stamp', async () => {
    let stamp = 1
    served = () => ({
      rows: [1, 2, 3].map((id) => ({ id, name: `row ${id}`, fetchedAt: stamp })),
    })
    render(
      <QueryClientProvider client={client}>
        <List />
      </QueryClientProvider>,
    )
    await tick()
    expect([...renders.values()]).toEqual([1, 1, 1])
    stamp = 2
    await refetch()
    expect([...renders.values()]).toEqual([1, 1, 1])
  })

  test('a changed row re-renders alone', async () => {
    let name = 'row 2'
    served = () => ({ rows: [1, 2, 3].map((id) => ({ id, name: id === 2 ? name : `row ${id}` })) })
    render(
      <QueryClientProvider client={client}>
        <List />
      </QueryClientProvider>,
    )
    await tick()
    name = 'row 2 edited'
    await refetch()
    expect(renders.get(1)).toBe(1)
    expect(renders.get(3)).toBe(1)
    expect(renders.get(2)).toBe(2)
  })
})
