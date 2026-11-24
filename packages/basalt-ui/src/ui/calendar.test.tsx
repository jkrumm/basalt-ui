/**
 * `Calendar` on a fixed month and a fixed `today`, so no test depends on the clock. The day cells are
 * read through DayPicker's own `data-day` attribute; the keyboard tests move focus the way a user does.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Calendar } from './calendar'
import type { CalendarRange } from './calendar'
import type { CalendarDate } from '../core/format'

afterEach(() => {
  cleanup()
})

const TODAY = '2026-11-12' as CalendarDate

const dayCell = (iso: string): HTMLElement => {
  const cell = document.querySelector(`[data-day="${iso}"]`)
  if (!(cell instanceof HTMLElement)) throw new Error(`no day cell for ${iso}`)
  return cell
}

const dayButton = (iso: string): HTMLButtonElement => {
  const button = dayCell(iso).querySelector('button')
  if (!(button instanceof HTMLButtonElement)) throw new Error(`no day button for ${iso}`)
  return button
}

const focusedDay = (): string | null =>
  document.activeElement?.closest('[data-day]')?.getAttribute('data-day') ?? null

// Focus moves outside React's event system, so it runs in act to flush the grid's focus state.
const focusDay = (iso: string): void => {
  act(() => {
    dayButton(iso).focus()
  })
}

const press = (key: string): void => {
  const focused = document.activeElement
  if (!(focused instanceof HTMLElement)) throw new Error('nothing has focus')
  fireEvent.keyDown(focused, { key })
}

describe('calendar', () => {
  test('renders the month of `month` and names the group', () => {
    render(<Calendar aria-label="November" month="2026-11-01" today={TODAY} />)
    expect(dayCell('2026-11-01')).toBeDefined()
    expect(dayCell('2026-11-30')).toBeDefined()
    const root = document.querySelector('[data-slot="calendar"]')
    expect(root?.getAttribute('aria-label')).toBe('November')
  })

  test('the day given as today carries data-today, no other day does', () => {
    render(<Calendar aria-label="November" month="2026-11-01" today={TODAY} />)
    expect(dayCell(TODAY).hasAttribute('data-today')).toBe(true)
    expect(dayCell('2026-11-13').hasAttribute('data-today')).toBe(false)
  })

  test('a marked day draws one dot per tone, at most three, and its name says busy', () => {
    render(
      <Calendar
        aria-label="November"
        month="2026-11-01"
        today={TODAY}
        marks={{ '2026-11-24': ['good', 'warn', 'bad', 'info'], '2026-11-26': 'accent' }}
      />,
    )
    expect(dayCell('2026-11-24').querySelectorAll('[data-tone]')).toHaveLength(3)
    expect(dayCell('2026-11-26').querySelectorAll('[data-tone]')).toHaveLength(1)
    expect(dayCell('2026-11-25').querySelectorAll('[data-tone]')).toHaveLength(0)
    expect(dayButton('2026-11-24').getAttribute('aria-label')).toBe('November 24, 2026, busy')
    expect(dayButton('2026-11-25').getAttribute('aria-label')).not.toContain('busy')
  })

  test('a single click calls onChange with the day as YYYY-MM-DD', () => {
    const picked: CalendarDate[] = []
    render(
      <Calendar
        aria-label="November"
        month="2026-11-01"
        today={TODAY}
        onValueChange={(day) => picked.push(day)}
      />,
    )
    fireEvent.click(dayButton('2026-11-20'))
    expect(picked).toEqual(['2026-11-20'])
  })

  test('range mode reports only after the second click', () => {
    const picked: CalendarRange[] = []
    render(
      <Calendar
        aria-label="Window"
        mode="range"
        month="2026-11-01"
        today={TODAY}
        onValueChange={(range) => picked.push(range)}
      />,
    )
    fireEvent.click(dayButton('2026-11-10'))
    expect(picked).toEqual([])
    fireEvent.click(dayButton('2026-11-14'))
    expect(picked).toEqual([{ from: '2026-11-10', to: '2026-11-14' }])
  })

  test('onMonthChange reports the first day of the month the user moves to', () => {
    const months: CalendarDate[] = []
    render(
      <Calendar
        aria-label="November"
        month="2026-11-01"
        today={TODAY}
        onMonthChange={(month) => months.push(month)}
      />,
    )
    const next = document.querySelector('button[aria-label="Next month"]')
    if (!(next instanceof HTMLButtonElement)) throw new Error('no next-month button')
    fireEvent.click(next)
    expect(months).toEqual(['2026-12-01'])
  })

  test('ArrowRight and ArrowDown move focus by one day and by one week', () => {
    render(<Calendar aria-label="November" today={TODAY} weekStart={1} />)
    focusDay(TODAY)
    press('ArrowRight')
    expect(focusedDay()).toBe('2026-11-13')
    press('ArrowDown')
    expect(focusedDay()).toBe('2026-11-20')
  })

  test('PageDown moves focus to the same day of the next month', () => {
    render(<Calendar aria-label="November" today={TODAY} weekStart={1} />)
    focusDay(TODAY)
    press('PageDown')
    expect(focusedDay()).toBe('2026-12-12')
  })

  test('Home and End move focus to the first and last day of the week', () => {
    render(<Calendar aria-label="November" today={TODAY} weekStart={1} />)
    focusDay(TODAY)
    press('Home')
    expect(focusedDay()).toBe('2026-11-09')
    press('End')
    expect(focusedDay()).toBe('2026-11-15')
  })
})
