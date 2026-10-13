/**
 * `notify` history + dedup contract: only string / number text is recorded, an explicit id already
 * in the history is not recorded twice, and a `dedupKey` hit returns the id of the first call.
 */
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { notify } from './notify'
import { clear, useNotificationHistory } from './store'

beforeEach(() => clear())
afterEach(cleanup)

function history() {
  return renderHook(() => useNotificationHistory()).result.current.items
}

describe('notify history text', () => {
  test('records string and number text', () => {
    notify({ message: 'Saved', title: 'Done' })
    notify({ message: 42 })
    const items = history()
    expect(items.map((i) => i.message)).toEqual([String(42), 'Saved'])
    expect(items.find((i) => i.message === 'Saved')?.title).toBe('Done')
  })

  test('a non-text node records an empty message and no title', () => {
    notify({ message: <b>Failed</b>, title: <i>Oops</i> })
    const [item] = history()
    expect(item?.message).toBe('')
    expect(item).not.toHaveProperty('title')
  })
})

describe('notify dedup', () => {
  test('an explicit id already in the history is recorded once', () => {
    notify({ id: 'same-id', message: 'First' })
    notify({ id: 'same-id', message: 'Second' })
    const items = history().filter((i) => i.id === 'same-id')
    expect(items).toHaveLength(1)
    expect(items[0]?.message).toBe('First')
  })

  test('a dedupKey hit returns the originally recorded id and records nothing new', () => {
    const first = notify({ message: 'Once', dedupKey: 'notify-test-key' })
    const second = notify({ id: 'other-id', message: 'Again', dedupKey: 'notify-test-key' })
    expect(second).toBe(first)
    expect(history()).toHaveLength(1)
  })
})
