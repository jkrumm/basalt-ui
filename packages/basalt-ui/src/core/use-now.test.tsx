/** `useNow`: one shared interval per period, started with the first subscriber and cleared with the last. */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { useNow } from './use-now'

beforeEach(() => jest.useFakeTimers({ now: 1_000_000 }))
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('useNow', () => {
  test('ticks every period with the current time', () => {
    const { result } = renderHook(() => useNow(1_000))
    expect(result.current).toBe(1_000_000)
    act(() => void jest.advanceTimersByTime(1_000))
    expect(result.current).toBe(1_001_000)
    act(() => void jest.advanceTimersByTime(2_000))
    expect(result.current).toBe(1_003_000)
  })

  test('a re-render keeps the subscription: no teardown, no new timer', () => {
    const setInterval = jest.spyOn(globalThis, 'setInterval')
    const clearInterval = jest.spyOn(globalThis, 'clearInterval')
    const { rerender } = renderHook(() => useNow(1_000))
    rerender()
    rerender()
    expect(setInterval).toHaveBeenCalledTimes(1)
    expect(clearInterval).not.toHaveBeenCalled()
  })

  test('two hooks on one period share one timer; the last unmount clears it', () => {
    const setInterval = jest.spyOn(globalThis, 'setInterval')
    const clearInterval = jest.spyOn(globalThis, 'clearInterval')
    const a = renderHook(() => useNow(5_000))
    const b = renderHook(() => useNow(5_000))
    expect(setInterval).toHaveBeenCalledTimes(1)
    a.unmount()
    expect(clearInterval).not.toHaveBeenCalled()
    b.unmount()
    expect(clearInterval).toHaveBeenCalledTimes(1)
  })
})
