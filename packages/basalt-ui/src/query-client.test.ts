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
  test('a non-native thenable is awaited, not treated as an envelope', async () => {
    // oxlint-disable-next-line unicorn/no-thenable -- a non-native thenable is the case under test
    const thenable = { then: (resolve: (v: unknown) => void) => resolve({ data: 7, error: null }) }
    expect((await unwrap(thenable as never)) as unknown).toBe(7)
  })

  test('a falsy-but-present error still throws', () => {
    expect(() => unwrap({ data: 'ok', error: 0 })).toThrow()
    expect(() => unwrap({ data: 'ok', error: '' })).toThrow()
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

  test('never retries a 4xx', () => {
    expect(retry(0, { status: 401 })).toBe(false)
    expect(retry(0, { status: 404 })).toBe(false)
  })

  test('retries a 5xx and an error without a status', () => {
    expect(retry(0, { status: 503 })).toBe(true)
    expect(retry(0, 'weird')).toBe(true)
  })
})
