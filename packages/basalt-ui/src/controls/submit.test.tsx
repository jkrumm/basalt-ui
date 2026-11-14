/** `toSubmitErrors`: a resolved save is no error; a thrown one becomes field and form errors. */
import { describe, expect, test } from 'bun:test'
import { NetworkError, unwrap } from '../data/unwrap'
import { toSubmitErrors } from './submit'

describe('toSubmitErrors', () => {
  test('a resolved save returns undefined and receives the value', async () => {
    let seen: unknown
    const validate = toSubmitErrors<{ a: number }>(async (v) => void (seen = v))
    expect(await validate({ value: { a: 1 } })).toBeUndefined()
    expect(seen).toEqual({ a: 1 })
  })

  test('a thrown ApiError-shaped value becomes field and form errors', async () => {
    const validate = toSubmitErrors(() =>
      unwrap(
        Promise.resolve({
          data: null,
          error: {
            message: 'Could not save',
            fieldErrors: { title: ['Too short', 'x'], n: 'Bad' },
          },
        }),
      ),
    )
    expect(await validate({ value: {} })).toEqual({
      form: 'Could not save',
      fields: { title: 'Too short', n: 'Bad' },
    })
  })

  test('an Eden { status, value } wrapper is read through its value', async () => {
    const validate = toSubmitErrors(() =>
      Promise.reject({ status: 422, value: { fieldErrors: { email: 'Taken' } } }),
    )
    expect(await validate({ value: {} })).toEqual({ fields: { email: 'Taken' } })
  })

  test('an Error and a network failure become the form message', async () => {
    expect(await toSubmitErrors(() => Promise.reject(new Error('Boom')))({ value: 1 })).toEqual({
      form: 'Boom',
    })
    expect(
      await toSubmitErrors(() => Promise.reject(new NetworkError(new TypeError('x'))))({
        value: 1,
      }),
    ).toEqual({ form: 'Network request failed' })
  })

  test('an unreadable throw falls back to a generic message', async () => {
    expect(await toSubmitErrors(() => Promise.reject(42))({ value: 1 })).toEqual({
      form: 'The request failed. Try again.',
    })
  })
})
