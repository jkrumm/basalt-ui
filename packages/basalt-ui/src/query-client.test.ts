/**
 * `unwrap` — its runtime branches (a `Promise` of the envelope, or the already-resolved envelope
 * itself, one generic signature since 1.29.1 — see `query-client.type-guard.test.ts` for the
 * compile-time proof) and the null/undefined absence guard (C5 consolidation: `undefined` joined
 * `null`). `createBasaltQueryClient` is a thin config-merge wrapper with no branching to test here.
 */
import { describe, expect, test } from 'bun:test'
import { unwrap } from './query-client'

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
