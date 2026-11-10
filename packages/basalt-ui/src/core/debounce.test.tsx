/** `debounce` and `useDebouncedCallback` — trailing edge, maxWait, flush on unmount (fake timers). */
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { debounce, useDebouncedCallback } from './debounce'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('debounce', () => {
  test('fires once on the trailing edge with the last arguments', () => {
    const calls: number[] = []
    const d = debounce((n: number) => void calls.push(n), 100)
    d.call(1)
    jest.advanceTimersByTime(60)
    d.call(2)
    jest.advanceTimersByTime(99)
    expect(calls).toEqual([])
    jest.advanceTimersByTime(1)
    expect(calls).toEqual([2])
  })

  test('pending is true between call and invocation', () => {
    const d = debounce(() => {}, 50)
    expect(d.pending()).toBe(false)
    d.call()
    expect(d.pending()).toBe(true)
    jest.advanceTimersByTime(50)
    expect(d.pending()).toBe(false)
  })

  test('flush runs the pending call now and only once', () => {
    const calls: string[] = []
    const d = debounce((s: string) => void calls.push(s), 100)
    d.call('a')
    d.flush()
    d.flush()
    jest.advanceTimersByTime(500)
    expect(calls).toEqual(['a'])
  })

  test('cancel drops the pending call', () => {
    const calls: number[] = []
    const d = debounce((n: number) => void calls.push(n), 100)
    d.call(1)
    d.cancel()
    jest.advanceTimersByTime(500)
    expect(calls).toEqual([])
    expect(d.pending()).toBe(false)
  })

  test('maxWait forces an invocation while input keeps arriving', () => {
    const calls: number[] = []
    const d = debounce((n: number) => void calls.push(n), 100, { maxWait: 250 })
    for (let t = 0; t < 250; t += 50) {
      d.call(t)
      jest.advanceTimersByTime(50)
    }
    expect(calls).toEqual([200])
  })

  test('maxWait restarts from the next un-flushed call', () => {
    const calls: number[] = []
    const d = debounce((n: number) => void calls.push(n), 100, { maxWait: 250 })
    d.call(1)
    jest.advanceTimersByTime(250)
    expect(calls).toEqual([1])
    d.call(2)
    jest.advanceTimersByTime(99)
    expect(calls).toEqual([1])
    jest.advanceTimersByTime(1)
    expect(calls).toEqual([1, 2])
  })
})

describe('useDebouncedCallback', () => {
  test('the control object is stable and runs the latest fn', () => {
    const seen: string[] = []
    const hook = renderHook(
      ({ tag }) => useDebouncedCallback((n: number) => seen.push(`${tag}${n}`), 100),
      {
        initialProps: { tag: 'a' },
      },
    )
    const first = hook.result.current
    hook.rerender({ tag: 'b' })
    expect(hook.result.current).toBe(first)
    first.call(1)
    jest.advanceTimersByTime(100)
    expect(seen).toEqual(['b1'])
  })

  test('a pending call is flushed on unmount, not dropped', () => {
    const seen: number[] = []
    const hook = renderHook(() => useDebouncedCallback((n: number) => seen.push(n), 100))
    hook.result.current.call(7)
    hook.unmount()
    expect(seen).toEqual([7])
    jest.advanceTimersByTime(500)
    expect(seen).toEqual([7])
  })

  test('unmount with nothing pending calls nothing', () => {
    const seen: number[] = []
    const hook = renderHook(() => useDebouncedCallback((n: number) => seen.push(n), 100))
    hook.unmount()
    expect(seen).toEqual([])
  })
})
