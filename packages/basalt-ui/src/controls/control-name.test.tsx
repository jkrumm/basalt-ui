/**
 * `useControlName` — the one helper that names a control with no visible Mantine label: it points
 * at the visible heading on the sheet/panel surfaces, and carries the filter's own name on the pill.
 */
import { describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useControlName } from './control-name'

describe('useControlName', () => {
  test('a surface with a visible heading points at it by id', () => {
    const { result } = renderHook(() => useControlName('Currency', true))
    expect(result.current.nameProps).toEqual({ 'aria-labelledby': result.current.labelId })
  })

  test('the pill surface carries the filter name as aria-label', () => {
    const { result } = renderHook(() => useControlName('Currency', false))
    expect(result.current.nameProps).toEqual({ 'aria-label': 'Currency' })
  })

  test('the id is stable across renders and unique per call', () => {
    const first = renderHook(() => useControlName('A', true))
    const id = first.result.current.labelId
    first.rerender()
    expect(first.result.current.labelId).toBe(id)
    const second = renderHook(() => useControlName('A', true))
    expect(second.result.current.labelId).not.toBe(id)
  })
})
