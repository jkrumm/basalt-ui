/**
 * `DatePicker` and `DateRangePicker` under TZ=America/Los_Angeles and TZ=Asia/Tokyo: a picked day is
 * the clicked day, a stored day prints as itself, and the boundary only ever carries `YYYY-MM-DD`.
 * Zone-less means the same wall-clock day west of UTC (where `new Date('2026-11-20')` is the 19th)
 * and east of it (where a local midnight is still yesterday in UTC).
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { DatePicker, DateRangePicker, datePickerParts } from './date-picker'
import type { CalendarRange } from './date-picker'
import type { CalendarDate } from '../core/format'

const ZONES = ['America/Los_Angeles', 'Asia/Tokyo', 'UTC'] as const

const original = process.env.TZ
afterEach(() => {
  cleanup()
  if (original === undefined) delete process.env.TZ
  else process.env.TZ = original
})

const dayButton = (iso: string): HTMLButtonElement => {
  const cell = document.querySelector(`[data-day="${iso}"]`)
  const button = cell?.querySelector('button')
  if (!(button instanceof HTMLButtonElement)) throw new Error(`no day button for ${iso}`)
  return button
}

const trigger = (): HTMLElement => {
  const el = document.querySelector('[data-slot="date-picker"], [data-slot="date-range-picker"]')
  if (!(el instanceof HTMLElement)) throw new Error('no trigger')
  return el
}

for (const zone of ZONES) {
  describe(`TZ=${zone}`, () => {
    beforeEach(() => {
      process.env.TZ = zone
    })

    test('the zone is in force', () => {
      expect(new Date(2026, 10, 20, 12).getDate()).toBe(20)
      if (zone === 'America/Los_Angeles') {
        expect(new Date('2026-11-20').getDate()).toBe(19)
      }
    })

    test('picking the 20th emits the 20th, shows it, and closes the calendar', async () => {
      const picked: CalendarDate[] = []
      render(
        <DatePicker
          aria-label="Due date"
          defaultOpen
          defaultValue="2026-11-15"
          onChange={(v) => picked.push(v)}
        />,
      )
      expect(document.querySelector('[data-day="2026-11-15"]')?.getAttribute('data-selected')).toBe(
        'true',
      )
      fireEvent.click(dayButton('2026-11-20'))
      expect(picked).toEqual(['2026-11-20'])
      expect(trigger().textContent).toContain('Nov 20')
      await waitFor(() => expect(document.querySelector('[role="dialog"]') === null).toBe(true))
    })

    test('a stored day prints as itself, in UTC, wherever the reader is', () => {
      render(<DatePicker aria-label="Due date" value="2026-01-01" />)
      expect(trigger().textContent).toContain('Jan 1')
      expect(trigger().textContent).not.toContain('Dec 31')
    })

    test('the first and last day of a month survive the round trip', () => {
      const picked: CalendarDate[] = []
      render(
        <DatePicker
          aria-label="Due date"
          defaultOpen
          value="2026-03-31"
          onChange={(v) => picked.push(v)}
        />,
      )
      fireEvent.click(dayButton('2026-03-01'))
      fireEvent.click(dayButton('2026-03-31'))
      expect(picked).toEqual(['2026-03-01', '2026-03-31'])
    })

    test('half-range guard: selecting only a start fires no onChange', () => {
      const picked: CalendarRange[] = []
      render(
        <DateRangePicker
          aria-label="Window"
          defaultOpen
          value={{ from: '2026-11-02', to: '2026-11-04' }}
          onChange={(r) => picked.push(r)}
        />,
      )
      fireEvent.click(dayButton('2026-11-10'))
      expect(picked).toEqual([])
      fireEvent.click(dayButton('2026-11-20'))
      expect(picked).toEqual([{ from: '2026-11-10', to: '2026-11-20' }])
    })

    test('the same day twice is a one-day range', () => {
      const picked: CalendarRange[] = []
      render(<DateRangePicker aria-label="Window" defaultOpen onChange={(r) => picked.push(r)} />)
      fireEvent.click(dayButton('2026-11-10'))
      fireEvent.click(dayButton('2026-11-10'))
      expect(picked).toEqual([{ from: '2026-11-10', to: '2026-11-10' }])
    })

    test('a range prints both ends in UTC', () => {
      render(
        <DateRangePicker aria-label="Window" value={{ from: '2026-11-02', to: '2026-11-20' }} />,
      )
      expect(trigger().textContent).toContain('Nov 2')
      expect(trigger().textContent).toContain('Nov 20')
    })
  })
}

describe('date-picker module', () => {
  test('closed, it renders the trigger with the placeholder and no calendar', () => {
    render(<DatePicker aria-label="Due date" />)
    expect(trigger().textContent).toContain('Pick a date')
    expect(trigger().getAttribute('aria-label')).toBe('Due date: Pick a date')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  test('aria-labelledby names the trigger from the label and its own text', () => {
    render(
      <>
        <span id="lbl">Due</span>
        <DatePicker aria-labelledby="lbl" id="due" value="2026-11-20" />
      </>,
    )
    expect(trigger().getAttribute('aria-labelledby')).toBe('lbl due')
  })

  test('open, the calendar is named by the picker and uses only listed slots', () => {
    render(<DatePicker aria-label="Due date" defaultOpen />)
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Due date')
    for (const el of document.querySelectorAll('[data-slot]')) {
      const slot = el.getAttribute('data-slot') ?? ''
      expect([...datePickerParts, 'popover-content'] as string[]).toContain(slot)
    }
  })

  test('a controlled picker does not change until the caller does', async () => {
    const { rerender } = render(<DatePicker aria-label="Due" defaultOpen value="2026-11-15" />)
    fireEvent.click(dayButton('2026-11-20'))
    expect(trigger().textContent).toContain('Nov 15')
    await act(async () => {
      rerender(<DatePicker aria-label="Due" value="2026-11-20" />)
    })
    expect(trigger().textContent).toContain('Nov 20')
  })

  test('a malformed value reads as no value', () => {
    render(<DatePicker aria-label="Due" value={'2026-02-31' as CalendarDate} />)
    expect(trigger().textContent).toContain('Pick a date')
  })
})
