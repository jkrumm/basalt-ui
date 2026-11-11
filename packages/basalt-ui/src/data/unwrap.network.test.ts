/** `unwrap` and the `NetworkError` marker the live channel classifies on (live-realtime 4.3). */
import { describe, expect, test } from 'bun:test'
import { NetworkError, unwrap } from './unwrap'

const fetchFailure = () => new TypeError('Failed to fetch')

describe('unwrap — NetworkError', () => {
  test('a promised envelope that rejects with a fetch TypeError throws NetworkError', async () => {
    const failure = fetchFailure()
    const error = await unwrap(Promise.reject(failure)).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(NetworkError)
    expect((error as NetworkError).cause).toBe(failure)
    expect((error as NetworkError).name).toBe('NetworkError')
  })

  test('a TypeError in the envelope error branch is a NetworkError too', () => {
    expect(() => unwrap({ data: null, error: fetchFailure() })).toThrow(NetworkError)
  })

  test('a NetworkError carries no numeric status, so the retry predicate retries it', () => {
    expect('status' in new NetworkError(fetchFailure())).toBe(false)
  })

  test('null data is not a network failure', async () => {
    const error = await unwrap(Promise.resolve({ data: null, error: null })).catch(
      (e: unknown) => e,
    )
    expect(error).not.toBeInstanceOf(NetworkError)
    expect(error).toBeInstanceOf(Error)
  })

  test('an application error with a status passes through untouched', async () => {
    const apiError = { status: 503 }
    const error = await unwrap(Promise.resolve({ data: null, error: apiError })).catch(
      (e: unknown) => e,
    )
    expect(error).toBe(apiError)
  })

  test('other rejections (a ZodError-like) pass through untouched', async () => {
    const shape = new Error('shape')
    await expect(unwrap(Promise.reject(shape))).rejects.toBe(shape)
  })
})
