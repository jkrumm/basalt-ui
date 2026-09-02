/**
 * `dataQueryBranch` — the precedence `BasaltDataTable` and `BasaltVirtualList` paint their bodies
 * from (law C3). The containers assert the RENDERING; this asserts the decision, because three of
 * the four inputs differ only in fields no markup shows and one of them (`isError` over cached data)
 * resolves the opposite way to what its name suggests.
 */
import { describe, expect, test } from 'bun:test'
import { dataQueryBranch } from './query-branch'
import type { QueryStateLike } from '../common/query-state-like'

function query(over: Partial<QueryStateLike<unknown>> = {}): QueryStateLike<unknown> {
  return {
    data: undefined,
    isError: false,
    error: null,
    fetchStatus: 'idle',
    refetch: () => undefined,
    ...over,
  }
}

describe('dataQueryBranch', () => {
  test('a malformed envelope throws, naming the container it was handed to', () => {
    const cases: [string, unknown][] = [
      ['missing isError', { data: undefined, error: null, fetchStatus: 'idle', refetch: () => 0 }],
      [
        'misspelled fetchStatus',
        { data: undefined, isError: false, error: null, fetchStatus: 'pending', refetch: () => 0 },
      ],
      // Both of these passed the narrower copy this function used to carry: a Retry button wired to
      // nothing, and an envelope with no `data` key at all.
      ['missing refetch', { data: undefined, isError: false, error: null, fetchStatus: 'idle' }],
      ['no data key', { isError: false, error: null, fetchStatus: 'idle', refetch: () => 0 }],
      ['not an object at all', ['a', 'b']],
    ]
    for (const [, bad] of cases) {
      expect(() => dataQueryBranch('BasaltDataTable', bad as QueryStateLike<unknown>)).toThrow(
        /^BasaltDataTable: `query` /,
      )
    }
  })

  test('an error with no data is the error branch', () => {
    expect(
      dataQueryBranch('BasaltDataTable', query({ isError: true, error: new Error('x') })),
    ).toBe('error')
  })

  test('no data and an IDLE fetch is ready — an `enabled: false` query, not a pending one', () => {
    expect(dataQueryBranch('BasaltDataTable', query())).toBe('ready')
  })

  test('no data while fetching or paused is pending', () => {
    expect(dataQueryBranch('BasaltDataTable', query({ fetchStatus: 'fetching' }))).toBe('pending')
    expect(dataQueryBranch('BasaltDataTable', query({ fetchStatus: 'paused' }))).toBe('pending')
  })

  test('an error OVER cached data is ready — the stale rows stay, with no banner', () => {
    // Deliberately not `'error'`, and deliberately different from `QueryState`, which renders the
    // same case as children PLUS a "showing cached data" banner. A container swaps only its body,
    // so it has nowhere to draw one; compose `QueryState` around it when the banner is wanted.
    expect(
      dataQueryBranch(
        'BasaltDataTable',
        query({ isError: true, error: new Error('x'), data: [1] }),
      ),
    ).toBe('ready')
  })
})
