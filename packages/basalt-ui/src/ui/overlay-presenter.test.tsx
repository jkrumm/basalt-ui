import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useOverlayRoot, useSheetPresent } from './overlay-presenter'

afterEach(cleanup)

type Details = { reason: string; isCanceled: boolean }

describe('useOverlayRoot', () => {
  test('an uncontrolled root follows its changes', () => {
    const { result } = renderHook(() => useOverlayRoot<Details>({}))
    expect(result.current.root.open).toBe(false)
    act(() =>
      result.current.root.onOpenChange(true, { reason: 'trigger-press', isCanceled: false }),
    )
    expect(result.current.root.open).toBe(true)
  })

  test('a canceled change leaves an uncontrolled root as it was', () => {
    const seen = mock((open: boolean, details: Details) => {
      void open
      void details
    })
    const { result } = renderHook(() =>
      useOverlayRoot<Details>({ defaultOpen: true, onOpenChange: seen }),
    )
    act(() =>
      result.current.root.onOpenChange(false, { reason: 'outside-press', isCanceled: true }),
    )
    expect(seen).toHaveBeenCalledTimes(1)
    expect(result.current.root.open).toBe(true)
  })

  test('a close the sheet starts gives the handler event details, never undefined', () => {
    const reasons: string[] = []
    const { result } = renderHook(() =>
      useOverlayRoot<Details>({
        defaultOpen: true,
        onOpenChange: (_open, details) => reasons.push(details.reason),
      }),
    )
    act(() => result.current.overlay.setOpen(false))
    expect(reasons).toEqual(['close-press'])
    expect(result.current.root.open).toBe(false)
  })

  test('a close the sheet starts can be canceled like any other', () => {
    const { result } = renderHook(() =>
      useOverlayRoot<Details & { cancel: () => void }>({
        defaultOpen: true,
        onOpenChange: (_open, details) => details.cancel(),
      }),
    )
    act(() => result.current.overlay.setOpen(false))
    expect(result.current.root.open).toBe(true)
  })

  test('a controlled root never moves on its own', () => {
    const { result } = renderHook(() => useOverlayRoot<Details>({ open: true }))
    act(() => result.current.overlay.setOpen(false))
    expect(result.current.root.open).toBe(true)
  })
})

describe('useSheetPresent', () => {
  test('present wins; a bare test DOM with no matchMedia is never a phone', () => {
    expect(renderHook(() => useSheetPresent('sheet')).result.current).toBe(true)
    expect(renderHook(() => useSheetPresent('popup')).result.current).toBe(false)
    expect(renderHook(() => useSheetPresent()).result.current).toBe(false)
  })
})
