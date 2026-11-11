import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { EventList } from './event-list'
import type { EventListProps } from './event-list'
import { resetLargeFeedWarning } from './event-list-model'

afterEach(() => {
  cleanup()
  resetLargeFeedWarning()
})

const NOW = Date.UTC(2026, 8, 3, 12, 0)
const DAY = 86_400_000

const EVENTS = [
  {
    id: 'e1',
    at: NOW - 3_600_000,
    actor: 'Ada',
    title: 'merged #482',
    chips: ['main'],
  },
  {
    id: 'e2',
    at: NOW - 7_200_000,
    title: 'opened #483',
    body: 'Fix the cache key',
  },
  { id: 'e3', at: NOW - DAY, title: 'closed #480' },
  { id: 'e4', at: NOW - 5 * DAY, title: 'tagged v1.4' },
]

const draw = (props: Partial<EventListProps> = {}): ReturnType<typeof render> =>
  render(<EventList title="Activity" items={EVENTS} now={NOW} {...props} />)

const many = (n: number): EventListProps['items'] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    at: NOW - i * 60_000,
    title: `event ${i}`,
  }))

const rowIds = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot="event-list-row"]')].map(
    (el) => el.getAttribute('data-event-id') ?? '',
  )

describe('EventList', () => {
  test('groups by day with Today, Yesterday and dated headers, counts and list semantics', () => {
    const { container, getAllByRole } = draw()
    const headers = [...container.querySelectorAll('[data-slot="event-list-header"]')].map(
      (el) => el.textContent,
    )
    expect(headers).toEqual(['Today· 2 events', 'Yesterday· 1 event', 'Sat, Aug 29, 2026· 1 event'])
    const lists = getAllByRole('list')
    expect(lists).toHaveLength(3)
    for (const list of lists) {
      expect(list.getAttribute('aria-labelledby')).not.toBeNull()
    }
  })

  test('keeps the caller order and never sorts', () => {
    const { container } = draw({ items: [EVENTS[3]!, EVENTS[0]!, EVENTS[1]!] })
    expect(rowIds(container)).toEqual(['e4', 'e1', 'e2'])
  })

  test('a time is a <time dateTime> in the provider clock', () => {
    const { container } = draw()
    const time = container.querySelector('[data-slot="event-list-time"]')
    expect(time?.tagName).toBe('TIME')
    expect(time?.getAttribute('datetime')).toBe(new Date(NOW - 3_600_000).toISOString())
    expect(time?.textContent).toBe('11:00 AM')
  })

  test('a row carries its actor, title, body and chips as text', () => {
    const { container } = draw()
    const rows = container.querySelectorAll('[data-slot="event-list-row"]')
    expect(rows[0]?.querySelector('[data-slot="event-list-line"]')?.textContent).toBe(
      'Ada merged #482',
    )
    expect(rows[0]?.querySelector('[data-slot="event-list-chip"]')?.textContent).toBe('main')
    expect(rows[1]?.querySelector('[data-slot="event-list-body"]')?.textContent).toBe(
      'Fix the cache key',
    )
  })

  test('an invalid at renders a dash without a dateTime, and the other rows survive', () => {
    const { container } = draw({
      items: [
        { id: 'a', at: NOW, title: 'real' },
        { id: 'b', at: Number.NaN, title: 'broken' },
      ],
    })
    const times = container.querySelectorAll('[data-slot="event-list-time"]')
    expect(times[1]?.textContent).toBe('—')
    expect(times[1]?.hasAttribute('datetime')).toBe(false)
    expect(rowIds(container)).toEqual(['a', 'b'])
  })

  test('a list with no real instant has no headers and is named by the card', () => {
    const { container, getByRole } = draw({
      items: [{ id: 'x', at: Number.NaN, title: 'x' }],
    })
    expect(container.querySelector('[data-slot="event-list-header"]')).toBeNull()
    expect(getByRole('list', { name: 'Activity' })).toBeTruthy()
  })

  test('an empty list says why, and the caller can name the cause', () => {
    const first = draw({ items: [] })
    expect(first.getByText('Nothing has happened yet')).toBeTruthy()
    cleanup()
    const second = draw({
      items: [],
      empty: { cause: 'No activity this week' },
    })
    expect(second.getByText('No activity this week')).toBeTruthy()
  })

  test('loading draws skeleton rows and no list', () => {
    const { container, queryByRole } = draw({ phase: 'loading' })
    expect(queryByRole('list')).toBeNull()
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'loading',
    )
  })

  test('every phase keeps the one body height', () => {
    const heights = (['ready', 'loading', 'stale'] as const).map((phase) => {
      const { container } = draw({ phase, rows: 4 })
      const cls = container.querySelector('[data-slot="inset"]')?.className ?? ''
      cleanup()
      return cls
    })
    expect(new Set(heights).size).toBe(1)
    expect(heights[0]).toContain('h-62')
  })
})

describe('EventList paging', () => {
  test('shows pageSize rows, then "Show more" adds a page and counts what is left', () => {
    const { container, getByRole } = draw({ items: many(60), pageSize: 25 })
    expect(rowIds(container)).toHaveLength(25)
    fireEvent.click(getByRole('button', { name: 'Show more (35)' }))
    expect(rowIds(container)).toHaveLength(50)
    fireEvent.click(getByRole('button', { name: 'Show more (10)' }))
    expect(rowIds(container)).toHaveLength(60)
    expect(container.querySelector('[data-slot="event-list-more"]')).toBeNull()
  })

  test('a list that fits its page has no control', () => {
    const { container } = draw()
    expect(container.querySelector('[data-slot="event-list-more"]')).toBeNull()
  })

  test('at 200 rows it stays silent', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    draw({ items: many(200) })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('201 rows warn once in dev, page with "Show more" and never window', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const { container, getByRole, rerender } = draw({ items: many(201) })
    rerender(<EventList title="Activity" items={many(201)} now={NOW} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('201')
    expect(getByRole('button', { name: 'Show more (176)' })).toBeTruthy()
    expect(rowIds(container)).toHaveLength(25)
    // Every page is real DOM: no virtualiser lands a row at a guessed offset.
    for (let i = 0; i < 8; i++) {
      const more = container.querySelector<HTMLElement>('[data-slot="event-list-more"]')
      if (more === null) break
      fireEvent.click(more)
    }
    expect(rowIds(container)).toHaveLength(201)
    warn.mockRestore()
  })
})

describe('EventList on the server', () => {
  test('renders without a clock: days read as dates and the scroller is not yet a tab stop', () => {
    const html = renderToString(<EventList title="Activity" items={EVENTS} />)
    expect(html).not.toContain('Today')
    expect(html).not.toContain('Yesterday')
    expect(html).toContain('data-slot="event-list-row"')
    expect(html).not.toContain('tabindex')
  })
})
