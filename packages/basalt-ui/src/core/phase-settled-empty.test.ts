/**
 * `settledEmpty` / `resolveFrame` (trial 2 kit defects, entries 22 and 26): a frame given a query measures
 * emptiness itself, so `empty` can be passed unconditionally; a `Phase` passes it through.
 */
import { describe, expect, test } from 'bun:test'
import { resolveFrame, settledEmpty } from './phase'
import type { Empty } from './phase'

const settled = (data: unknown) => ({ isPending: false, isError: false, error: null, data })
const empty: Empty = { cause: 'No runs yet' }

describe('a query phase', () => {
  test('rows loaded: empty does not apply', () => {
    expect(settledEmpty(settled([1, 2]), empty)).toBeNull()
    expect(resolveFrame({ phase: settled([1, 2]), empty }).tag).toBe('ready')
  })

  test('an empty array settled: empty applies', () => {
    expect(settledEmpty(settled([]), empty)).toBe(empty)
    expect(resolveFrame({ phase: settled([]), empty }).tag).toBe('empty')
  })

  test('loading and failed queries keep their own phase', () => {
    const pending = { isPending: true, isError: false, error: null, data: undefined }
    expect(resolveFrame({ phase: pending, empty }).tag).toBe('loading')
    const failed = { isPending: false, isError: true, error: new Error('x'), data: undefined }
    expect(resolveFrame({ phase: failed, empty }).tag).toBe('error')
  })

  test('an object result says when it is empty with `when`', () => {
    const none: Empty = {
      cause: 'No runs',
      when: (data) => (data as { runs: number[] }).runs.length === 0,
    }
    expect(resolveFrame({ phase: settled({ runs: [1] }), empty: none }).tag).toBe('ready')
    expect(resolveFrame({ phase: settled({ runs: [] }), empty: none }).tag).toBe('empty')
  })

  test('`when` is never called before the data arrived', () => {
    const none: Empty = {
      cause: 'No runs',
      when: () => {
        throw new Error('called on missing data')
      },
    }
    const pending = { isPending: true, isError: false, error: null, data: undefined }
    expect(resolveFrame({ phase: pending, empty: none }).tag).toBe('loading')
  })

  test('no `empty` passes through', () => {
    expect(settledEmpty(settled([]), undefined)).toBeUndefined()
    expect(settledEmpty(settled([]), null)).toBeNull()
  })
})

describe('a Phase', () => {
  test('empty applies whenever it is set, and `when` is ignored', () => {
    const none: Empty = { cause: 'No runs', when: () => false }
    expect(resolveFrame({ phase: 'ready', empty: none }).tag).toBe('empty')
    expect(resolveFrame({ empty }).tag).toBe('empty')
  })
})
