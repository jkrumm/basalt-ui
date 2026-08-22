/**
 * `toErrorMessage`'s job is to never hand a human a string that says nothing. The decode ladder
 * was already right; what was missing is the floor under it — an opaque envelope decoded to the
 * literal `"{}"`, and `toErrorMessage(undefined)` returned `JSON.stringify(undefined)`, which is
 * not a string at all despite the `string` return type. Both are the shape a page renders straight
 * into an Alert, so both are asserted here.
 */
import { describe, expect, test } from 'bun:test'
import { errorStatus, toErrorMessage } from './error-message'

describe('toErrorMessage — decode ladder', () => {
  test('Error instance → message', () => {
    expect(toErrorMessage(new Error('slug already in use'))).toBe('slug already in use')
  })

  test('{ message } → message', () => {
    expect(toErrorMessage({ message: 'recursive is rejected' })).toBe('recursive is rejected')
  })

  test('Eden { status, value } envelope → one level down', () => {
    expect(toErrorMessage({ status: 409, value: { message: 'slug taken' } })).toBe('slug taken')
  })

  test('plain string → itself', () => {
    expect(toErrorMessage('boom')).toBe('boom')
  })
})

describe('toErrorMessage — the unusable floor', () => {
  test('an opaque object falls back instead of rendering "{}"', () => {
    expect(toErrorMessage({}, 'Could not create share')).toBe('Could not create share')
  })

  test('undefined returns a real string, not the undefined value', () => {
    const message = toErrorMessage(undefined)
    expect(typeof message).toBe('string')
    expect(message).toBe('The request failed.')
  })

  test('an opaque envelope WITH a status folds the status into the fallback', () => {
    expect(toErrorMessage({ status: 502, value: {} }, 'Could not load images')).toBe(
      'Could not load images (HTTP 502)',
    )
  })

  test('a readable body wins over the status — the server message is never replaced', () => {
    expect(toErrorMessage({ status: 403, value: { message: 'forbidden' } }, 'Nope')).toBe(
      'forbidden',
    )
  })

  test('whitespace-only decodes as unusable', () => {
    expect(toErrorMessage({ message: '   ' }, 'Fallback')).toBe('Fallback')
  })
})

describe('errorStatus', () => {
  test('reads a numeric status off an envelope', () => {
    expect(errorStatus({ status: 404, value: null })).toBe(404)
  })

  test('is undefined for anything else', () => {
    expect(errorStatus(new Error('x'))).toBeUndefined()
    expect(errorStatus(null)).toBeUndefined()
    expect(errorStatus({ status: '404' })).toBeUndefined()
  })
})
