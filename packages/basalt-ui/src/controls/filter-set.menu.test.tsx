/**
 * The page bar's `Filter` trigger (`filter-set-menu.tsx`): three filters or more in the page bar are
 * one trigger with the active count; its popover groups an enum as chips and a multi as checkboxes,
 * says how many rows the filters keep, and resets them. Two filters stay pills.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { SlotHomeContext } from '../core/slot-home'
import { memoryHandle } from './control-view.handles'
import { FilterSet } from './filter-set'
import { spec } from './spec'

afterEach(cleanup)

const status = () =>
  memoryHandle<string>('status', 'all', {
    kind: 'enum',
    options: [
      { value: 'all', label: 'All' },
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  })
const tags = () =>
  memoryHandle<readonly string[]>('tags', [], {
    kind: 'multi',
    options: [
      { value: 'b2b', label: 'B2B' },
      { value: 'b2c', label: 'B2C' },
    ] as never,
  })
const owner = () =>
  memoryHandle<string>('owner', 'any', {
    kind: 'enum',
    options: [
      { value: 'any', label: 'Anyone' },
      { value: 'me', label: 'Me' },
    ],
  })

const inBar = (node: ReactNode) => <SlotHomeContext value="page-bar">{node}</SlotHomeContext>

const trigger = (): HTMLElement => document.querySelector<HTMLElement>('[data-filter-trigger]')!

describe('FilterSet in the page bar', () => {
  test('two filters stay pills; three are one Filter trigger', () => {
    const { rerender } = render(
      inBar(<FilterSet specs={[spec(status(), 'Status'), spec(owner(), 'Owner')]} />),
    )
    expect(document.querySelector('[data-slot="filter-pills"]')).not.toBeNull()
    expect(document.querySelector('[data-filter-trigger]')).toBeNull()
    rerender(
      inBar(
        <FilterSet
          specs={[spec(status(), 'Status'), spec(tags(), 'Tags'), spec(owner(), 'Owner')]}
        />,
      ),
    )
    expect(document.querySelector('[data-slot="filter-pills"]')).toBeNull()
    expect(trigger().textContent).toContain('Filter')
  })

  test('outside the page bar three filters stay pills', () => {
    render(
      <FilterSet
        specs={[spec(status(), 'Status'), spec(tags(), 'Tags'), spec(owner(), 'Owner')]}
      />,
    )
    expect(document.querySelector('[data-filter-trigger]')).toBeNull()
  })

  test('the trigger counts the active filters, chips and checkboxes write them, reset unsets', () => {
    const s = status()
    const t = tags()
    const o = owner()
    const bar = (shown: number) =>
      inBar(
        <FilterSet
          specs={[spec(s, 'Status'), spec(t, 'Tags'), spec(o, 'Owner')]}
          match={{ shown, total: 50 }}
        />,
      )
    const { rerender } = render(bar(50))
    expect(trigger().getAttribute('aria-label')).toBe('Filters')
    expect(trigger().querySelector('[data-slot="count-badge"]')).toBeNull()
    act(() => {
      trigger().click()
    })
    const chip = screen.getByRole('button', { name: 'Open' })
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(chip)
    expect(s.writes).toEqual(['open'])
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('aria-pressed')).toBe('true')
    // The row's label is the hit target, as a pointer on the row is.
    fireEvent.click(screen.getByText('B2B'))
    expect(t.writes).toEqual([['b2b']])
    rerender(bar(21))
    expect(document.querySelector('[data-slot="filter-match"]')?.textContent).toBe(
      'Showing 21 of 50',
    )
    const triggers = [...document.querySelectorAll('[data-filter-trigger]')]
    for (const el of triggers) {
      expect(el.getAttribute('aria-label')).toBe('Filters (2)')
      expect(el.querySelector('[data-slot="count-badge"]')?.textContent).toBe('2')
    }
    const menu = document.querySelector('[data-slot="filter-menu"]')!
    fireEvent.click(menu.querySelector<HTMLElement>('[data-slot="filter-reset"]')!)
    expect(s.isDefault && t.isDefault && o.isDefault).toBe(true)
    expect(trigger().getAttribute('aria-label')).toBe('Filters')
  })
})
