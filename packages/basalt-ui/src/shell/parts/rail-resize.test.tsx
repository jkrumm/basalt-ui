/**
 * The rail's width: persisted under `basalt:<storageKey>-width`, clamped to its bounds, moved by the
 * pointer and the keyboard of the separator, reset by a double click. Geometry is
 * `tests/layout`'s; this pins the value, the keys and the stored envelope.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  RAIL_EXPANDED_PX,
  RAIL_MAX_PX,
  RAIL_MIN_PX,
  RailWidthProvider,
  useRailWidthState,
} from './grid'
import { RailResizeHandle } from './rail-resize'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const KEY = 'basalt:argo-sidebar-width'

function Harness(): ReturnType<typeof RailResizeHandle> {
  const control = useRailWidthState('argo-sidebar')
  return (
    <RailWidthProvider value={control}>
      <RailResizeHandle />
    </RailWidthProvider>
  )
}

const handle = (): HTMLElement => screen.getByRole('separator')

describe('the stored width', () => {
  test('nothing stored: the default, nothing written', () => {
    const { result } = renderHook(() => useRailWidthState('argo-sidebar'))
    expect(result.current.width).toBe(RAIL_EXPANDED_PX)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  test('a set width is stored as the {v, value} envelope and survives a reload', () => {
    const first = renderHook(() => useRailWidthState('argo-sidebar'))
    act(() => first.result.current.setWidth(300))
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ v: 1, value: 300 })
    const reload = renderHook(() => useRailWidthState('argo-sidebar'))
    expect(reload.result.current.width).toBe(300)
  })

  test('outside the bounds is brought inside, on write and on read', () => {
    const { result } = renderHook(() => useRailWidthState('argo-sidebar'))
    act(() => result.current.setWidth(9999))
    expect(result.current.width).toBe(RAIL_MAX_PX)
    act(() => result.current.setWidth(1))
    expect(result.current.width).toBe(RAIL_MIN_PX)
    localStorage.setItem(KEY, JSON.stringify({ v: 1, value: 5000 }))
    expect(renderHook(() => useRailWidthState('argo-sidebar')).result.current.width).toBe(
      RAIL_MAX_PX,
    )
  })

  test('something that is not a number is the default', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, value: 'wide' }))
    expect(renderHook(() => useRailWidthState('argo-sidebar')).result.current.width).toBe(
      RAIL_EXPANDED_PX,
    )
  })

  test('reset forgets the stored value', () => {
    const { result } = renderHook(() => useRailWidthState('argo-sidebar'))
    act(() => result.current.setWidth(320))
    act(() => result.current.reset())
    expect(result.current.width).toBe(RAIL_EXPANDED_PX)
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('the separator', () => {
  test('is a vertical separator with the width as its value and the bounds as its range', () => {
    render(<Harness />)
    const el = handle()
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
    expect(el.getAttribute('aria-valuenow')).toBe('240')
    expect(el.getAttribute('aria-valuemin')).toBe(String(RAIL_MIN_PX))
    expect(el.getAttribute('aria-valuemax')).toBe(String(RAIL_MAX_PX))
    expect(el.tabIndex).toBe(0)
  })

  test('draws nothing without a width control', () => {
    render(<RailResizeHandle />)
    expect(screen.queryByRole('separator')).toBeNull()
  })

  test('arrow keys move it 16 px, 64 with Shift; Home and End go to the bounds', () => {
    render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(handle().getAttribute('aria-valuenow')).toBe('256')
    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true })
    expect(handle().getAttribute('aria-valuenow')).toBe(String(RAIL_MIN_PX))
    fireEvent.keyDown(handle(), { key: 'End' })
    expect(handle().getAttribute('aria-valuenow')).toBe(String(RAIL_MAX_PX))
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(handle().getAttribute('aria-valuenow')).toBe(String(RAIL_MAX_PX))
    fireEvent.keyDown(handle(), { key: 'Home' })
    expect(handle().getAttribute('aria-valuenow')).toBe(String(RAIL_MIN_PX))
  })

  test('a double click and Enter return to the default and forget the stored width', () => {
    render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'End' })
    expect(localStorage.getItem(KEY)).not.toBeNull()
    fireEvent.doubleClick(handle())
    expect(handle().getAttribute('aria-valuenow')).toBe('240')
    expect(localStorage.getItem(KEY)).toBeNull()
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    fireEvent.keyDown(handle(), { key: 'Enter' })
    expect(handle().getAttribute('aria-valuenow')).toBe('240')
  })

  test('the pointer follows the edge while it is captured', () => {
    render(<Harness />)
    const el = handle()
    el.setPointerCapture = () => {}
    el.releasePointerCapture = () => {}
    el.hasPointerCapture = () => true
    fireEvent.pointerDown(el, { button: 0, clientX: 240, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 290, pointerId: 1 })
    expect(el.getAttribute('aria-valuenow')).toBe('290')
    fireEvent.pointerMove(el, { clientX: 900, pointerId: 1 })
    expect(el.getAttribute('aria-valuenow')).toBe(String(RAIL_MAX_PX))
    fireEvent.pointerUp(el, { pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 250, pointerId: 1 })
    expect(el.getAttribute('aria-valuenow')).toBe(String(RAIL_MAX_PX))
  })
})
