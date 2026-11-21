/**
 * `shotState`: forces a phase only when the shot runner marked the page and the URL asks for one.
 */
import { afterEach, describe, expect, test } from 'bun:test'

import { shotState, SHOT_FLAG } from './shot-state'

const ready = { isPending: false, isError: false, error: null, data: [1, 2], refetch: () => 0 }
const at = (search: string): void => window.history.replaceState(null, '', `/page${search}`)
const mark = (on: boolean): void => {
  ;(window as unknown as Record<string, unknown>)[SHOT_FLAG] = on ? true : undefined
}

afterEach(() => {
  mark(false)
  at('')
})

describe('shotState', () => {
  test('under the runner, loading, error and empty replace the phase and keep the rest', () => {
    mark(true)
    at('?shot-state=loading')
    expect(shotState(ready)).toMatchObject({ isPending: true, isError: false, data: undefined })
    at('?shot-state=error')
    const failed = shotState(ready)
    expect(failed).toMatchObject({ isPending: false, isError: true, data: undefined })
    expect(failed.error).toBeInstanceOf(Error)
    expect(failed.refetch).toBe(ready.refetch)
    at('?x=1&shot-state=empty')
    expect(shotState(ready)).toMatchObject({ isPending: false, isError: false, data: [] })
  })

  test('empty carries the shape the caller names', () => {
    mark(true)
    at('?shot-state=empty')
    expect(shotState({ ...ready, data: { rows: [1] } }, { empty: { rows: [] } }).data).toEqual({
      rows: [],
    })
    expect(shotState({ ...ready, data: 1 }, { empty: undefined }).data).toBeUndefined()
  })

  test('without the runner flag the same URL returns the very same result', () => {
    at('?shot-state=empty')
    expect(shotState(ready)).toBe(ready)
  })

  test('under the runner a missing or unknown parameter returns the result itself', () => {
    mark(true)
    expect(shotState(ready)).toBe(ready)
    at('?shot-state=full')
    expect(shotState(ready)).toBe(ready)
  })
})
