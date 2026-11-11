import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test'
import { NOTIFY_DEDUP_MS, NOTIFY_QUEUE_CAP, connectNotifyHost, notify, resetNotify } from './notify'
import type { NotifyEntry } from './notify'

function host(): { entries: NotifyEntry[]; closed: string[]; off: () => void } {
  const entries: NotifyEntry[] = []
  const closed: string[] = []
  const off = connectNotifyHost({ add: (e) => entries.push(e), close: (id) => closed.push(id) })
  return { entries, closed, off }
}

beforeEach(resetNotify)
afterEach(() => {
  resetNotify()
  jest.useRealTimers()
})

describe('intent to priority', () => {
  test('error is persistent and urgent; the others close after 5 s', () => {
    const h = host()
    notify('error', { message: 'a' })
    notify('success', { message: 'b' })
    notify('info', { message: 'c' })
    notify('warning', { message: 'd' })
    expect(h.entries.map((e) => [e.kind, e.timeout, e.priority])).toEqual([
      ['error', 0, 'high'],
      ['success', 5000, 'low'],
      ['info', 5000, 'low'],
      ['warning', 5000, 'low'],
    ])
  })

  test('an explicit autoClose is floored at 5000, kept above it, and false is persistent', () => {
    const h = host()
    notify('info', { message: 'a', autoClose: 2000 })
    notify('info', { message: 'b', autoClose: 9000 })
    notify('info', { message: 'c', autoClose: false })
    notify('error', { message: 'd', autoClose: 1000 })
    expect(h.entries.map((e) => e.timeout)).toEqual([5000, 9000, 0, 5000])
  })
})

describe('dedup', () => {
  test('an identical payload within 1,500 ms shows one toast and returns its id', () => {
    jest.useFakeTimers()
    const h = host()
    const first = notify('error', { message: 'Upload failed' })
    jest.setSystemTime(Date.now() + NOTIFY_DEDUP_MS - 1)
    expect(notify('error', { message: 'Upload failed' })).toBe(first)
    expect(h.entries).toHaveLength(1)
    jest.setSystemTime(Date.now() + 2)
    expect(notify('error', { message: 'Upload failed' })).not.toBe(first)
    expect(h.entries).toHaveLength(2)
  })

  test('two undoable notifications with the same text each keep their own revert', () => {
    const h = host()
    const calls: string[] = []
    const a = notify('success', {
      message: 'Deleted',
      undo: { revert: () => void calls.push('a') },
    })
    const b = notify('success', {
      message: 'Deleted',
      undo: { revert: () => void calls.push('b') },
    })
    expect(b).not.toBe(a)
    expect(h.entries).toHaveLength(2)
    notify.undo(b)
    expect(calls).toEqual(['b'])
  })

  test('a different kind or message is not a duplicate', () => {
    const h = host()
    notify('error', { message: 'a' })
    notify('info', { message: 'a' })
    notify('error', { message: 'b' })
    expect(h.entries).toHaveLength(3)
  })
})

describe('queue (S5)', () => {
  test('notifications sent before the host mounts are delivered in order after it', () => {
    notify('success', { message: 'one' })
    notify('error', { message: 'two' })
    const h = host()
    expect(h.entries.map((e) => e.message)).toEqual(['one', 'two'])
    notify('info', { message: 'three' })
    expect(h.entries.map((e) => e.message)).toEqual(['one', 'two', 'three'])
  })

  test('the queue never exceeds 50 and drops the oldest', () => {
    for (let i = 0; i < NOTIFY_QUEUE_CAP + 10; i += 1) notify('info', { message: `m${i}` })
    const h = host()
    expect(h.entries).toHaveLength(NOTIFY_QUEUE_CAP)
    expect(h.entries[0]?.message).toBe('m10')
    expect(h.entries.at(-1)?.message).toBe(`m${NOTIFY_QUEUE_CAP + 9}`)
  })

  test('a disconnected host queues again', () => {
    const h = host()
    h.off()
    notify('info', { message: 'late' })
    expect(h.entries).toHaveLength(0)
    expect(host().entries.map((e) => e.message)).toEqual(['late'])
  })
})

describe('undo', () => {
  test('revert runs exactly once across the toast action and notify.undo', () => {
    const h = host()
    let runs = 0
    const id = notify('success', { message: 'Deleted', undo: { revert: () => void (runs += 1) } })
    const entry = h.entries[0]
    expect(entry?.undo?.windowMs).toBe(8000)
    entry?.undo?.revert()
    expect(notify.undo(id)).toBe(false)
    entry?.undo?.revert()
    expect(runs).toBe(1)
  })

  test('notify.undo reverts once and closes the toast', () => {
    const h = host()
    let runs = 0
    const id = notify('success', { message: 'Moved', undo: { revert: () => void (runs += 1) } })
    expect(notify.undo(id)).toBe(true)
    expect(notify.undo(id)).toBe(false)
    expect(runs).toBe(1)
    expect(h.closed).toEqual([id])
  })

  test('notify.undo on a notification still queued reverts it and never shows it', () => {
    let runs = 0
    const id = notify('info', { message: 'x', undo: { revert: () => void (runs += 1) } })
    expect(notify.undo(id)).toBe(true)
    expect(runs).toBe(1)
    expect(host().entries).toHaveLength(0)
  })

  test('a notification without undo has nothing to revert', () => {
    const id = notify('info', { message: 'x' })
    expect(notify.undo(id)).toBe(false)
  })
})

describe('onShow', () => {
  test('runs as each notification of the kind is delivered, queued ones included', () => {
    const seen: string[] = []
    notify.onShow('error', (p) => seen.push(p.message))
    notify('error', { message: 'early' })
    expect(seen).toEqual([])
    host()
    notify('error', { message: 'late' })
    notify('info', { message: 'other' })
    expect(seen).toEqual(['early', 'late'])
  })
})

describe('no host', () => {
  test('warns in dev once a notification has waited 3 s with no host', () => {
    jest.useFakeTimers()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    notify('info', { message: 'x' })
    jest.advanceTimersByTime(2999)
    expect(warn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(2)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  test('does not warn when a host mounts in time', () => {
    jest.useFakeTimers()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    notify('info', { message: 'x' })
    host()
    jest.advanceTimersByTime(10_000)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
