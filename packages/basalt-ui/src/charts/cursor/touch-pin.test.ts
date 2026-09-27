/**
 * `useTouchPin` — the provisional-press machine shared by `useChartCursor`/`useDiscreteCursor`.
 * Exercises the state machine directly (no DOM pointer events; those are covered end-to-end by the
 * two consumers' own test files) plus the two round-3 fixes: a committed `undefined` still
 * restores on `cancel` (rather than silently restoring nothing), and the returned object keeps a
 * stable identity across renders so a consumer's own effect deps don't churn.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useTouchPin } from './touch-pin'

/** A stub store: `committed` is read/written exactly like `useChartCursor`'s `store.get`/`.set` or
 * `useDiscreteCursor`'s `pinned ? active : null`, and every `setCommitted` call is recorded so a
 * test can tell a genuine restore from a no-op. */
function makeStore<V>(initial: V) {
  let committed = initial
  const restoreCalls: V[] = []
  return {
    get: () => committed,
    /** Overwrite directly — mirrors a caller's own PROVISIONAL write between `begin` and the press
     * resolving, which never goes through `setCommitted`. */
    set: (v: V) => {
      committed = v
    },
    setCommitted: (v: V) => {
      restoreCalls.push(v)
      committed = v
    },
    restoreCalls,
    current: () => committed,
  }
}

describe('useTouchPin', () => {
  test('begin then commit leaves the committed value untouched and reports the tracked pointer', () => {
    const store = makeStore<string | null>('a')
    const { result } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    act(() => result.current.begin(1))
    let committed = false
    act(() => {
      committed = result.current.commit(1)
    })
    expect(committed).toBe(true)
    expect(store.current()).toBe('a')
    expect(store.restoreCalls).toEqual([])
  })

  test('commit ignores an untracked pointer', () => {
    const store = makeStore<string | null>('a')
    const { result } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    act(() => result.current.begin(1))
    let committed = true
    act(() => {
      committed = result.current.commit(2)
    })
    expect(committed).toBe(false)
  })

  test('cancel restores the value committed before the press began, undoing a provisional overwrite', () => {
    const store = makeStore<string | null>('a')
    const { result } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    act(() => result.current.begin(1))
    store.set('b') // the provisional overwrite a real caller makes between begin() and commit/cancel
    let cancelled = false
    act(() => {
      cancelled = result.current.cancel(1)
    })
    expect(cancelled).toBe(true)
    expect(store.current()).toBe('a')
    expect(store.restoreCalls).toEqual(['a'])
  })

  test('cancel with nothing committed before the press restores that "nothing" rather than the provisional value', () => {
    const store = makeStore<string | null>(null)
    const { result } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    act(() => result.current.begin(1))
    store.set('provisional')
    act(() => result.current.cancel(1))
    expect(store.current()).toBe(null)
  })

  test('cancel on an untracked pointer (no prior begin) is a no-op and reports false', () => {
    const store = makeStore<string | null>('a')
    const { result } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    let cancelled = true
    act(() => {
      cancelled = result.current.cancel(1)
    })
    expect(cancelled).toBe(false)
    expect(store.restoreCalls).toEqual([])
  })

  test('a committed `undefined` still restores — the hasBackup flag, not `!== undefined`, gates it', () => {
    const store = makeStore<string | undefined>(undefined)
    const { result } = renderHook(() =>
      useTouchPin<string | undefined>({
        getCommitted: store.get,
        setCommitted: store.setCommitted,
      }),
    )
    act(() => result.current.begin(1))
    store.set('provisional')
    act(() => result.current.cancel(1))
    // The old `backup !== undefined` guard would have skipped this call entirely, leaving the
    // provisional value committed instead of restoring the (legitimately undefined) prior state.
    expect(store.restoreCalls).toEqual([undefined])
    expect(store.current()).toBe(undefined)
  })

  test('reset drops in-flight bookkeeping with no restore call, and the dropped pointer no longer commits or cancels', () => {
    const store = makeStore<string | null>('a')
    const { result } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    act(() => result.current.begin(1))
    act(() => result.current.reset())
    expect(store.restoreCalls).toEqual([])
    let commitResult = true
    let cancelResult = true
    act(() => {
      commitResult = result.current.commit(1)
      cancelResult = result.current.cancel(1)
    })
    expect(commitResult).toBe(false)
    expect(cancelResult).toBe(false)
  })

  test('the returned object keeps a stable identity across renders', () => {
    const store = makeStore<string | null>(null)
    const { result, rerender } = renderHook(() =>
      useTouchPin<string | null>({ getCommitted: store.get, setCommitted: store.setCommitted }),
    )
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
