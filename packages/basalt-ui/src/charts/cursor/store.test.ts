import { describe, expect, test } from 'bun:test'
import { createCursorStore, globalCursorStore } from './store'

describe('cursor store', () => {
  test('notifies subscribers on change', () => {
    const store = createCursorStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls++
    })

    store.set('2026-08-18', 'chart-a')
    expect(calls).toBe(1)
    expect(store.get()).toEqual({ key: '2026-08-18', source: 'chart-a', kind: null })

    unsubscribe()
    store.set('2026-08-19', 'chart-a')
    expect(calls).toBe(1)
  })

  test('a redundant set does not notify — a re-hover of the same point costs no render', () => {
    const store = createCursorStore()
    let calls = 0
    store.subscribe(() => {
      calls++
    })

    store.set('2026-08-18', 'chart-a')
    store.set('2026-08-18', 'chart-a')
    expect(calls).toBe(1)
  })

  test('clearing returns the stable empty identity', () => {
    const store = createCursorStore()
    const before = store.get()
    store.set('2026-08-18', 'chart-a')
    store.set(null, null)
    expect(store.get()).toBe(before)
  })

  test('scoped stores are independent of the global one', () => {
    const scoped = createCursorStore()
    scoped.set('2026-08-18', 'chart-a')
    expect(globalCursorStore.get().key).toBeNull()
  })

  test('a set carrying a different kind notifies — the partition is state, not a filter on the store', () => {
    // The store is dumb: it broadcasts whatever kind it's handed and never compares it against
    // anything. Policing "does this kind match mine" is `useChartCursor`'s job, on read.
    const store = createCursorStore()
    let calls = 0
    store.subscribe(() => {
      calls++
    })

    store.set('2026-08-18', 'chart-a', 'time')
    expect(calls).toBe(1)
    expect(store.get()).toEqual({ key: '2026-08-18', source: 'chart-a', kind: 'time' })

    store.set('2026-08-18', 'chart-a', 'band')
    expect(calls).toBe(2)
    expect(store.get()).toEqual({ key: '2026-08-18', source: 'chart-a', kind: 'band' })
  })
})
