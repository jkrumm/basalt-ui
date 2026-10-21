/**
 * The playground tables share one empty-state pattern: the action appears only when the filters are
 * the cause, and the unfiltered copy never blames them.
 */
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { tableEmptyState, useFilterReset } from './table-empty-state'

afterEach(cleanup)

const mount = (node: ReturnType<typeof tableEmptyState>) =>
  render(createElement(MantineProvider, null, node)).container

describe('tableEmptyState', () => {
  it('offers Clear filters when the filters are the cause', () => {
    const c = mount(
      tableEmptyState({
        noun: 'employees',
        total: 20,
        cause: 'x',
        filtered: true,
        onClear: () => {},
      }),
    )
    expect(c.textContent).toContain('No employees match')
    expect([...c.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Clear filters'])
  })

  it('states the honest cause, without an action or a filter blame, when none is set', () => {
    const c = mount(
      tableEmptyState({
        noun: 'employees',
        total: 20,
        cause: 'The directory is empty.',
        filtered: false,
        onClear: () => {},
      }),
    )
    expect(c.textContent).toContain('The directory is empty.')
    expect(c.textContent).not.toMatch(/filter|search/i)
    expect(c.querySelector('button')).toBeNull()
  })
})

describe('useFilterReset', () => {
  const squat = [{ id: 'exercise', value: 'Squat' }]

  it('starts unfiltered', () => {
    expect(renderHook(() => useFilterReset()).result.current.filtered).toBe(false)
  })

  it('a search or a facet report sets it, and emptying them unsets it', () => {
    const { result } = renderHook(() => useFilterReset())
    act(() => result.current.onGlobalFilterChange('sq'))
    expect(result.current.filtered).toBe(true)
    act(() => result.current.onGlobalFilterChange(''))
    expect(result.current.filtered).toBe(false)
    act(() => result.current.onColumnFiltersChange(squat))
    expect(result.current.filtered).toBe(true)
    act(() => result.current.onColumnFiltersChange([]))
    expect(result.current.filtered).toBe(false)
  })

  it('a preset counts as filtered, and clear() drops it and bumps the key', () => {
    const { result } = renderHook(() => useFilterReset(squat))
    expect(result.current.filtered).toBe(true)
    expect(result.current.initialColumnFilters).toEqual(squat)
    act(() => result.current.clear())
    expect(result.current.filtered).toBe(false)
    expect(result.current.initialColumnFilters).toEqual([])
    expect(result.current.tableKey).toBe(1)
  })

  it('clear() also empties a search', () => {
    const { result } = renderHook(() => useFilterReset())
    act(() => result.current.onGlobalFilterChange('sq'))
    act(() => result.current.clear())
    expect(result.current.filtered).toBe(false)
  })

  it('an empty log is never filtered, whatever the preset says', () => {
    expect(renderHook(() => useFilterReset(squat, false)).result.current.filtered).toBe(false)
  })
})
