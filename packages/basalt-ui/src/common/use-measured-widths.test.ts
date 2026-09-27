/**
 * `useMeasuredWidths` — the disabled/detached guard. Every fold planner (`data-table.tsx`'s
 * `useColumnFold`, `controls/actions.tsx`'s measured fold) shares this core, and both call
 * `remeasure()` from OUTSIDE the effect (a settled web font, a post-reset commit) through a ref the
 * hook keeps pointed at the CURRENT `onMeasure`/root pairing. Disabling the hook (or the root going
 * detached) has to clear that ref to a no-op — otherwise a `remeasure()` call arriving after the
 * disable would still fire the STALE closure over the previous root, measuring (or crashing on) a
 * box that is no longer the live one.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useMeasuredWidths } from './use-measured-widths'

describe('useMeasuredWidths — the disabled/detached guard', () => {
  test('disabled from the start: onMeasure never runs, and remeasure() is a no-op', () => {
    const root = document.createElement('div')
    let calls = 0
    const { result } = renderHook(() =>
      useMeasuredWidths({
        resolveRoot: () => root,
        signature: 's',
        enabled: false,
        onMeasure: () => {
          calls += 1
        },
      }),
    )
    expect(calls).toBe(0)
    result.current.remeasure()
    expect(calls).toBe(0)
  })

  /** The exact regression this guard exists for: a `remeasure` captured while the hook was live,
   * invoked AFTER a later render disabled it, must not reach back into the stale measurement. */
  test('a remeasure captured while enabled, called after the hook disables, is a no-op', () => {
    const root = document.createElement('div')
    let calls = 0
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useMeasuredWidths({
          resolveRoot: () => root,
          signature: 's',
          enabled,
          onMeasure: () => {
            calls += 1
          },
        }),
      { initialProps: { enabled: true } },
    )
    // Measured once, synchronously, on mount.
    expect(calls).toBe(1)
    const remeasure = result.current.remeasure

    rerender({ enabled: false })
    remeasure()
    expect(calls).toBe(1)

    // The hook's OWN (freshly re-read) remeasure is the same no-op — not just the captured closure.
    result.current.remeasure()
    expect(calls).toBe(1)
  })

  test('a detached root (resolveRoot returns null): onMeasure never runs, and remeasure() is a no-op', () => {
    let calls = 0
    const { result } = renderHook(() =>
      useMeasuredWidths({
        resolveRoot: () => null,
        signature: 's',
        onMeasure: () => {
          calls += 1
        },
      }),
    )
    expect(calls).toBe(0)
    result.current.remeasure()
    expect(calls).toBe(0)
  })

  /** Re-enabling on a live root restores real measurement — the guard only silences the STALE
   * closure, it doesn't wedge the hook shut permanently. */
  test('re-enabling after a disable resumes real measurement', () => {
    const root = document.createElement('div')
    let calls = 0
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useMeasuredWidths({
          resolveRoot: () => root,
          signature: 's',
          enabled,
          onMeasure: () => {
            calls += 1
          },
        }),
      { initialProps: { enabled: true } },
    )
    expect(calls).toBe(1)

    rerender({ enabled: false })
    expect(calls).toBe(1)

    rerender({ enabled: true })
    expect(calls).toBe(2)
    result.current.remeasure()
    expect(calls).toBe(3)
  })
})
