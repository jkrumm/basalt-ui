import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, jest, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { Schedule } from './schedule'
import type { ScheduleEvent, ScheduleProps, ScheduleView } from './schedule'

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/** Monday 23 November 2026, 09:30 UTC: the provider-free schedule shows UTC, weeks from Sunday ('en'). */
const NOW = Date.UTC(2026, 10, 23, 9, 30)
const at = (day: number, h: number, m = 0): number => Date.UTC(2026, 10, day, h, m)

const EVENTS: ScheduleEvent[] = [
  { id: 'a', title: 'Bearing delivery', start: at(23, 10), end: at(23, 11), tone: 'info' },
  { id: 'b', title: 'Supplier call', start: at(23, 10, 30), end: at(23, 11, 30), tone: 'good' },
  { id: 'c', title: 'Seal delivery', start: at(23, 7), end: at(23, 8) },
  { id: 'd', title: 'Audit', start: at(24, 0), end: at(25, 0), allDay: true },
]

type Seen = { view: ScheduleView; date: string }

function Harness(
  props: Partial<ScheduleProps> & { initial?: Partial<Seen>; onState?: (s: Seen) => void },
): ReactElement {
  const [view, setView] = useState<ScheduleView>(props.initial?.view ?? 'week')
  const [date, setDate] = useState(props.initial?.date ?? '')
  props.onState?.({ view, date })
  return (
    <Schedule
      label="Deliveries"
      events={EVENTS}
      {...props}
      view={{ use: () => [view, setView] }}
      date={{ use: () => [date, setDate] }}
    />
  )
}

const boxOf = (el: Element): { x: string; w: string; y: string; h: string } => {
  const style = (el as HTMLElement).getAttribute('style') ?? ''
  const read = (name: string): string =>
    new RegExp(`--${name}:\\s*([^;]+)`).exec(style)?.[1]?.trim() ?? ''
  return { x: read('x'), w: read('w'), y: read('y'), h: read('h') }
}

describe('Schedule week', () => {
  test('draws seven days from the locale week start, each event on its day', () => {
    const { container } = render(<Harness now={NOW} />)
    const days = [...container.querySelectorAll('[data-slot="schedule-day"]')]
    expect(days.map((d) => d.getAttribute('data-day'))).toEqual([
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ])
    const monday = days[1] as Element
    expect(monday.querySelectorAll('[data-slot="schedule-event"]')).toHaveLength(3)
    expect(container.querySelector('[data-slot="schedule-range"]')?.textContent).toBe(
      'Nov 22 – 28, 2026',
    )
  })

  test('overlapping events stand side by side; a lone one keeps the column', () => {
    const { getByLabelText } = render(<Harness now={NOW} />)
    const a = boxOf(getByLabelText(/^Bearing delivery/))
    const b = boxOf(getByLabelText(/^Supplier call/))
    const c = boxOf(getByLabelText(/^Seal delivery/))
    expect(a.w).toBe('calc(50% - 4px)')
    expect(b.w).toBe('calc(50% - 4px)')
    expect(a.x).not.toBe(b.x)
    expect(c.w).toBe('calc(100% - 4px)')
    // An hour is 64 px with a 3 px gap under it: 10:00 sits at 640.
    expect(a.y).toBe('640px')
    expect(a.h).toBe('61px')
  })

  test('a past event dims; the all-day row holds the all-day event', () => {
    const { getByLabelText, container } = render(<Harness now={NOW} />)
    expect(getByLabelText(/^Seal delivery/).className).toContain('opacity-60')
    expect(getByLabelText(/^Bearing delivery/).className).not.toContain('opacity-60')
    const allDay = container.querySelector('[data-slot="schedule-all-day"]')
    expect(allDay?.textContent).toContain('Audit')
  })

  test('the now line sits at the current minute on today and moves with the clock', () => {
    jest.useFakeTimers({ now: NOW })
    const { container } = render(<Harness />)
    const line = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('[data-slot="schedule-now"]')
    expect(line()?.closest('[data-slot="schedule-day"]')?.getAttribute('data-day')).toBe(
      '2026-11-23',
    )
    expect(line()?.getAttribute('data-minute')).toBe('570')
    expect(boxOf(line() as Element).y).toBe('608px')
    act(() => void jest.advanceTimersByTime(30 * 60_000))
    expect(line()?.getAttribute('data-minute')).toBe('600')
    expect(boxOf(line() as Element).y).toBe('640px')
  })

  test('previous and next step a week; Today clears the day field', () => {
    const seen: Seen[] = []
    const { getByRole } = render(<Harness now={NOW} onState={(s) => seen.push(s)} />)
    fireEvent.click(getByRole('button', { name: 'Next' }))
    expect(seen.at(-1)).toEqual({ view: 'week', date: '2026-11-30' })
    fireEvent.click(getByRole('button', { name: 'Today' }))
    expect(seen.at(-1)).toEqual({ view: 'week', date: '' })
  })

  test('an event with href is a link and still reports onOpen', () => {
    const opened: string[] = []
    const { getByLabelText } = render(
      <Harness now={NOW} href={(e) => `/deliveries/${e.id}`} onOpen={(id) => opened.push(id)} />,
    )
    const link = getByLabelText(/^Bearing delivery/)
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/deliveries/a')
    link.addEventListener('click', (e) => e.preventDefault())
    fireEvent.click(link)
    expect(opened).toEqual(['a'])
  })

  test('an empty hour reports its start instant', () => {
    const starts: number[] = []
    const { getByLabelText } = render(<Harness now={NOW} onSlot={(s) => starts.push(s)} />)
    const slots = getByLabelText(/^Bearing delivery/)
      .closest('[data-slot="schedule-day"]')
      ?.querySelectorAll('[data-slot="schedule-slot"]')
    fireEvent.click(slots?.[14] as Element)
    expect(starts).toEqual([at(23, 14)])
  })

  test('the phone strip picks a day', () => {
    const seen: Seen[] = []
    const { getByRole } = render(<Harness now={NOW} onState={(s) => seen.push(s)} />)
    const strip = getByRole('group', { name: 'Days of the week' })
    const wednesday = [...strip.querySelectorAll('button')][3] as HTMLButtonElement
    fireEvent.click(wednesday)
    expect(seen.at(-1)?.date).toBe('2026-11-25')
  })
})

describe('Schedule rail', () => {
  test('the mini month gets busy marks for every loaded day, not only the shown month', () => {
    const seen: Record<string, unknown>[] = []
    const MiniMonth = (props: Record<string, unknown>): ReactElement => {
      seen.push(props['marks'] as Record<string, unknown>)
      return <div />
    }
    const december: ScheduleEvent = {
      id: 'dec',
      title: 'Year-end count',
      start: Date.UTC(2026, 11, 14, 9),
      end: Date.UTC(2026, 11, 14, 10),
    }
    render(<Harness now={NOW} events={[...EVENTS, december]} rail={{ month: MiniMonth }} />)
    const marks = seen.at(-1) ?? {}
    expect(marks['2026-12-14']).toEqual(['neutral'])
    expect(marks['2026-11-23']).toEqual(['neutral', 'neutral', 'neutral'])
    expect(marks['2026-11-24']).toEqual(['neutral'])
  })
})

describe('Schedule day and month', () => {
  test('day view draws one column', () => {
    const { container } = render(
      <Harness now={NOW} initial={{ view: 'day', date: '2026-11-24' }} />,
    )
    const days = container.querySelectorAll('[data-slot="schedule-day"]')
    expect(days).toHaveLength(1)
    expect(days[0]?.getAttribute('data-day')).toBe('2026-11-24')
  })

  test('month view: six weeks, three rows a day, then +N more opens the day', () => {
    const busy: ScheduleEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      title: `Call ${i}`,
      start: at(25, 8 + i),
      end: at(25, 9 + i),
    }))
    const seen: Seen[] = []
    const { container, getByRole } = render(
      <Harness now={NOW} events={busy} initial={{ view: 'month' }} onState={(s) => seen.push(s)} />,
    )
    expect(container.querySelectorAll('[data-slot="schedule-month-day"]')).toHaveLength(42)
    const cell = container.querySelector('[data-day="2026-11-25"]') as Element
    expect(cell.querySelectorAll('[data-slot="schedule-event"]')).toHaveLength(3)
    fireEvent.click(getByRole('button', { name: '+2 more' }))
    expect(seen.at(-1)).toEqual({ view: 'day', date: '2026-11-25' })
  })

  test('the loading phase draws the grid with no events', () => {
    const { container } = render(<Harness now={NOW} phase="loading" />)
    expect(container.querySelectorAll('[data-slot="schedule-day"]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-slot="schedule-event"]')).toHaveLength(0)
    expect(container.querySelector('[data-slot="schedule"]')?.getAttribute('aria-busy')).toBe(
      'true',
    )
  })
})
