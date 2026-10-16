/**
 * `unwrap` — its runtime branches (a `Promise` of the envelope, or the already-resolved envelope
 * itself, one generic signature since 1.29.1 — see `unwrap.type-guard.test.ts` for the
 * compile-time proof) and the null/undefined absence guard (C5 consolidation: `undefined` joined
 * `null`). `makeQueryClient` is covered in `provider/create-router.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { makeQueryClient } from './query-client'
import { unwrap } from './unwrap'

describe('unwrap — Promise-of-envelope overload', () => {
  test('resolves data through a Promise envelope', async () => {
    const rows = await unwrap(Promise.resolve({ data: [1, 2, 3], error: null }))
    expect(rows).toEqual([1, 2, 3])
  })

  test('throws the error branch', async () => {
    await expect(unwrap(Promise.resolve({ data: null, error: new Error('boom') }))).rejects.toThrow(
      'boom',
    )
  })

  test('throws on null data with no error', async () => {
    await expect(unwrap(Promise.resolve({ data: null, error: null }))).rejects.toThrow(
      /null\/undefined data/,
    )
  })

  test('throws on undefined data with no error', async () => {
    await expect(unwrap(Promise.resolve({ data: undefined, error: null }))).rejects.toThrow(
      /null\/undefined data/,
    )
  })
})

describe('unwrap — resolved-envelope overload', () => {
  test('returns data synchronously from an already-resolved envelope', () => {
    expect(unwrap({ data: 'ok', error: null })).toBe('ok')
  })

  test('throws the error branch synchronously', () => {
    expect(() => unwrap({ data: null, error: new Error('boom') })).toThrow('boom')
  })

  test('throws on null data with no error', () => {
    expect(() => unwrap({ data: null, error: null })).toThrow(/null\/undefined data/)
  })

  test('throws on undefined data with no error', () => {
    expect(() => unwrap({ data: undefined, error: null })).toThrow(/null\/undefined data/)
  })

  test("works as a direct .then(unwrap) callback — argo's other call-site shape", async () => {
    const rows = await Promise.resolve({ data: [1, 2], error: null }).then(unwrap)
    expect(rows).toEqual([1, 2])
  })

  test('a falsy, non-nullish data value (0, "", false) is NOT treated as absent', () => {
    expect(unwrap({ data: 0, error: null })).toBe(0)
    expect(unwrap({ data: '', error: null })).toBe('')
    expect(unwrap({ data: false, error: null })).toBe(false)
  })
})

describe('unwrap — Eden Treaty union envelope', () => {
  test('returns data from the success member', () => {
    expect(unwrap({ data: { id: 'a' }, error: null })).toEqual({ id: 'a' })
  })

  test('throws the error member', () => {
    expect(() => unwrap({ data: null, error: { status: 500 } })).toThrow()
  })
})

describe('unwrap — guards', () => {
  test('null and undefined are not envelopes: they throw a TypeError', () => {
    expect(() => unwrap(null as never)).toThrow(TypeError)
    expect(() => unwrap(undefined as never)).toThrow(TypeError)
  })

  test('a non-native thenable is awaited, not treated as an envelope', async () => {
    const thenable: PromiseLike<{ data: number; error: null }> = {
      // oxlint-disable-next-line unicorn/no-thenable -- a non-native thenable is the case under test
      then: (resolve) => Promise.resolve({ data: 7, error: null }).then(resolve),
    }
    expect(await unwrap(thenable)).toBe(7)
  })

  test('a falsy-but-present error throws it (only null/undefined mean no error)', () => {
    for (const error of [false, 0, '']) {
      expect(() => unwrap({ data: 'ok', error })).toThrow()
      let thrown: unknown = 'unset'
      try {
        unwrap({ data: 'ok', error })
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBe(error)
    }
  })

  test('null and undefined error with data resolve', () => {
    expect(unwrap({ data: 'ok', error: null })).toBe('ok')
    expect(unwrap({ data: 'ok', error: undefined })).toBe('ok')
  })
})

describe('makeQueryClient — a numeric retry replaces the predicate', () => {
  test("retry: 0 and retry: 5 are the consumer's, 4xx included", () => {
    const queries = (retry: number) =>
      makeQueryClient({ defaultOptions: { queries: { retry } } }).getDefaultOptions().queries
    expect(queries(0)?.retry).toBe(0)
    expect(queries(5)?.retry).toBe(5)
  })
})

describe('makeQueryClient — retry default', () => {
  const retry = makeQueryClient().getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown,
  ) => boolean

  test('retries twice, then stops', () => {
    expect([retry(0, new Error('x')), retry(1, new Error('x')), retry(2, new Error('x'))]).toEqual([
      true,
      true,
      false,
    ])
  })

  test('never retries a 4xx, except the transient 408, 425 and 429', () => {
    for (const status of [400, 401, 403, 404, 422, 499]) expect(retry(0, { status })).toBe(false)
    for (const status of [408, 425, 429]) expect(retry(0, { status })).toBe(true)
    expect(retry(2, { status: 429 })).toBe(false)
  })

  test('retries a 5xx, and an error without a numeric status', () => {
    expect(retry(0, { status: 503 })).toBe(true)
    expect(retry(0, { status: '404' })).toBe(true)
    expect(retry(0, null)).toBe(true)
    expect(retry(0, 'weird')).toBe(true)
  })
})
