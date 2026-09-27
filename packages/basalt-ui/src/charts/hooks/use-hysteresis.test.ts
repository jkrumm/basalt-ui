/**
 * `useHysteresis` — the shared ref+layout-effect idiom `ChartCard`'s short-card flag (P0-1) and
 * `Donut`'s side/stacked layout (P2-10) both needed independently: `compute` runs against the
 * PREVIOUS COMMITTED value (never mutated during render), which only updates in a layout effect
 * after the value has actually painted.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useHysteresis } from './use-hysteresis'

describe('useHysteresis', () => {
  test('the first render computes from the initial value', () => {
    const { result } = renderHook(() => useHysteresis((prev: boolean) => !prev, false))
    expect(result.current).toBe(true)
  })

  test('each render reads the PREVIOUS committed value, not the one just computed', () => {
    const { result, rerender } = renderHook(() => useHysteresis((prev: boolean) => !prev, false))
    expect(result.current).toBe(true) // prev=false -> true, committed
    rerender()
    expect(result.current).toBe(false) // prev=true -> false
    rerender()
    expect(result.current).toBe(true)
  })

  test('a value that never changes settles instead of oscillating (the P0-1 fix itself)', () => {
    // The hysteresis law: enter below 10, leave only at/above 20. A measurement of 15 is bistable
    // under a naive "always re-derive from the raw input" rule; hysteresis must settle it.
    const compute = (wasHigh: boolean) => (wasHigh ? 15 >= 20 : 15 < 10)
    const { result, rerender } = renderHook(() => useHysteresis(compute, false))
    for (let i = 0; i < 5; i += 1) {
      expect(result.current).toBe(false)
      rerender()
    }
  })

  test('crosses the enter threshold, then holds through the bistable band until the exit threshold', () => {
    const ENTER = 280
    const EXIT = 304
    let height = 300
    const compute = (wasShort: boolean) => height > 0 && height < (wasShort ? EXIT : ENTER)
    const { result, rerender } = renderHook(() => useHysteresis(compute, false))
    expect(result.current).toBe(false) // 300 >= ENTER

    height = 277 // below ENTER: becomes short
    rerender()
    expect(result.current).toBe(true)

    height = 284 // inside [ENTER, EXIT): stays short — this is exactly the old oscillation band
    rerender()
    expect(result.current).toBe(true)
    height = 277
    rerender()
    expect(result.current).toBe(true)

    height = 310 // past EXIT: leaves short
    rerender()
    expect(result.current).toBe(false)
  })
})
