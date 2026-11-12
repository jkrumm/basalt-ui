/**
 * The rail's persisted collapse: stored under `basalt:<storageKey>` as the `{ v, value }` envelope
 * the 2.x consumers already hold (golden key `basalt:argo-sidebar`), so a reload keeps the choice
 * and a consumer's stored state survives the upgrade.
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useRailState } from './grid'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('rail collapse persistence', () => {
  test('nothing stored: the rail follows the size class (auto)', () => {
    const { result } = renderHook(() => useRailState('argo-sidebar', 'expanded'))
    expect(result.current.state).toBe('auto')
    expect(localStorage.getItem('basalt:argo-sidebar')).toBeNull()
  })

  test('toggling writes the {v, value} envelope under basalt:<storageKey>', () => {
    const { result } = renderHook(() => useRailState('argo-sidebar', 'expanded'))
    act(() => result.current.toggle())
    expect(JSON.parse(localStorage.getItem('basalt:argo-sidebar') ?? 'null')).toEqual({
      v: 1,
      value: true,
    })
    expect(result.current.state).toBe('collapsed')
  })

  test('a reload (fresh mount) keeps the collapsed state', () => {
    localStorage.setItem('basalt:argo-sidebar', JSON.stringify({ v: 1, value: true }))
    const { result } = renderHook(() => useRailState('argo-sidebar', 'expanded'))
    expect(result.current.state).toBe('collapsed')
    expect(result.current.collapsed).toBe(true)
  })

  test('a stored false is an explicit expanded, not auto', () => {
    localStorage.setItem('basalt:rb-sidebar-collapsed', JSON.stringify({ v: 1, value: false }))
    const { result } = renderHook(() => useRailState('rb-sidebar-collapsed', 'medium'))
    expect(result.current.state).toBe('expanded')
  })

  test('two storage keys are two rails', () => {
    localStorage.setItem('basalt:one', JSON.stringify({ v: 1, value: true }))
    const one = renderHook(() => useRailState('one', 'expanded'))
    const two = renderHook(() => useRailState('two', 'expanded'))
    expect(one.result.current.state).toBe('collapsed')
    expect(two.result.current.state).toBe('auto')
  })
})
