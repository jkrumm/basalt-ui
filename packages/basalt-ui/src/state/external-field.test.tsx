/**
 * `externalField` — a handle over a value another store owns. The external store is a bare
 * `useSyncExternalStore` cell (what a zustand selector is underneath); rendered with NO router.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'bun:test'
import { useSyncExternalStore } from 'react'
import { externalField } from './fields'

type Mode = 'rest' | 'interval'

let mode: Mode = 'rest'
const sets: Mode[] = []
const listeners = new Set<() => void>()
const setMode = (next: Mode): void => {
  sets.push(next)
  mode = next
  for (const l of listeners) l()
}
const useMode = (): Mode =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => mode,
  )

const timerMode = externalField({
  values: ['rest', 'interval'],
  fallback: 'rest',
  labels: { rest: 'Rest Timer', interval: 'Interval Timer' },
  use: () => [useMode(), setMode],
})

beforeEach(() => {
  localStorage.clear()
  mode = 'rest'
  sets.length = 0
})

describe('externalField', () => {
  test('declares kind, fallback and labelled options at definition', () => {
    expect(timerMode.kind).toBe('enum')
    expect(timerMode.fallback).toBe('rest')
    expect(timerMode.options).toEqual([
      { value: 'rest', label: 'Rest Timer' },
      { value: 'interval', label: 'Interval Timer' },
    ])
    expect(timerMode.isDefault('rest')).toBe(true)
    expect(timerMode.isDefault('interval')).toBe(false)
  })

  test('use() reads the external value and re-renders on an external change', () => {
    const { result } = renderHook(() => timerMode.use())
    expect(result.current[0]).toBe('rest')
    act(() => setMode('interval'))
    expect(result.current[0]).toBe('interval')
  })

  test('the setter calls the external setter; clear() writes the fallback', () => {
    const { result } = renderHook(() => timerMode.use())
    act(() => result.current[1]('interval'))
    expect(sets).toEqual(['interval'])
    act(() => timerMode.clear())
    expect(mode).toBe('rest')
  })

  test('clear() before any render is a no-op', () => {
    const fresh = externalField({
      values: ['a', 'b'],
      fallback: 'a',
      use: () => ['a', setMode as never],
    })
    expect(() => fresh.clear()).not.toThrow()
  })

  test('writes nothing to localStorage or the URL', () => {
    const before = window.location.href
    const { result } = renderHook(() => timerMode.use())
    act(() => result.current[1]('interval'))
    act(() => timerMode.clear())
    expect(localStorage.length).toBe(0)
    expect(window.location.href).toBe(before)
  })
})
