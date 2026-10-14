/**
 * `StatCard.query` → the `sparkline` render prop's `size.state`: the same precedence `QueryState`
 * gives the breakdown (error with no data → error; no data and not idle → pending; otherwise none).
 * The slot only renders its render prop once measured, so the box is stubbed to a real width.
 */
import { MantineProvider } from '@mantine/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StatCard } from './stat-card'
import type { StatCardSparklineSize } from './stat-card'
import type { QueryStateLike } from './query-state'

// Stubbed on Element.prototype, where the method lives: assigning it back onto a subclass would
// leave an own property that shadows every later file's stub of the real one.
const original = Element.prototype.getBoundingClientRect
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () => ({ width: 120 }) as DOMRect
})

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  Element.prototype.getBoundingClientRect = original
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

const query = (over: Partial<QueryStateLike<number[]>>): QueryStateLike<number[]> => ({
  data: undefined,
  isError: false,
  error: null,
  fetchStatus: 'idle',
  refetch: () => undefined,
  ...over,
})

async function sizeSeenBy(q: QueryStateLike<number[]> | undefined): Promise<StatCardSparklineSize> {
  let seen: StatCardSparklineSize | undefined
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(
      <MantineProvider>
        <StatCard
          title="Active"
          value="—"
          {...(q !== undefined && { query: q })}
          sparkline={(size) => {
            seen = size
            return <span />
          }}
        />
      </MantineProvider>,
    )
  })
  if (seen === undefined) throw new Error('the sparkline render prop never ran')
  return seen
}

describe('StatCard sparkline state', () => {
  test('a fetching query with no data is pending', async () => {
    expect((await sizeSeenBy(query({ fetchStatus: 'fetching' }))).state).toEqual({ pending: true })
  })

  test('an error with no data carries the error', async () => {
    const error = new Error('boom')
    expect((await sizeSeenBy(query({ isError: true, error }))).state).toEqual({ error })
  })

  test('data wins over a stale error and a refetch: nothing to show', async () => {
    const q = query({ data: [1, 2], isError: true, error: new Error('x'), fetchStatus: 'fetching' })
    expect('state' in (await sizeSeenBy(q))).toBe(false)
  })

  test('no query, or an idle one with no data, adds no state', async () => {
    expect('state' in (await sizeSeenBy(undefined))).toBe(false)
    expect('state' in (await sizeSeenBy(query({})))).toBe(false)
  })
})
