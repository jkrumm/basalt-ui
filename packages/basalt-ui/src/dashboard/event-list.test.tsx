import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { EventList } from './event-list'
import type { EventListProps } from './event-list'

afterEach(cleanup)

const local = (y: number, m: number, d: number, h = 12, mi = 0): Date =>
  new Date(y, m - 1, d, h, mi)
const NOW = local(2026, 3, 10, 18)

const mount = (props: Partial<EventListProps> & Pick<EventListProps, 'items'>) =>
  render(
    <MantineProvider>
      <EventList label="Activity" now={NOW} {...props} />
    </MantineProvider>,
  )

const frame = (c: HTMLElement): Element => c.querySelector('[data-density]') ?? c

const ITEMS = [
  { id: 'a', at: local(2026, 3, 10, 17, 5), actor: 'Ada', title: 'merged a change' },
  { id: 'b', at: local(2026, 3, 10, 9, 30), title: 'opened a change', body: 'two files' },
  { id: 'c', at: local(2026, 3, 9, 22, 0), actor: 'Bo', title: 'closed a change' },
  { id: 'd', at: local(2026, 3, 2, 8, 0), actor: 'Cy', title: 'older' },
]

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    at: new Date(2026, 2, 10, 12, 0, 0, 0).getTime() - i * 60_000,
    title: `event ${i}`,
  }))

describe('EventList', () => {
  test('groups by day with Today / Yesterday labels, counts and list semantics', () => {
    const { container } = mount({ items: ITEMS })
    const headers = [...container.querySelectorAll('h3')]
    expect(headers.map((h) => h.firstChild?.textContent)).toEqual([
      'Today',
      'Yesterday',
      expect.stringContaining('Mon'),
    ])
    expect(headers.map((h) => h.lastElementChild?.textContent)).toEqual([
      '· 2 events',
      '· 1 event',
      '· 1 event',
    ])
    const lists = container.querySelectorAll('ol')
    expect(lists).toHaveLength(3)
    expect(lists[0]?.getAttribute('aria-labelledby')).toBe(headers[0]?.id)
    expect(container.querySelectorAll('li')).toHaveLength(4)
  })

  test('group none is one flat list with date-time stamps', () => {
    const { container } = mount({ items: ITEMS, group: 'none' })
    expect(container.querySelectorAll('h3')).toHaveLength(0)
    expect(container.querySelectorAll('ol')).toHaveLength(1)
    expect(container.querySelector('ol')?.getAttribute('aria-label')).toBe('Activity')
  })

  test('dayLabel overrides the header text', () => {
    const { container } = mount({ items: ITEMS, dayLabel: (d) => `D${d.getDate()}` })
    expect(container.querySelector('h3')?.firstChild?.textContent).toBe('D10')
  })

  test('time is a <time dateTime> and takes the mode', () => {
    const { container } = mount({ items: ITEMS, time: 'relative' })
    const t = container.querySelector('time')
    expect(t?.getAttribute('dateTime')).toBe(local(2026, 3, 10, 17, 5).toISOString())
    expect(t?.textContent).toBe('55 minutes ago')
    const custom = mount({ items: ITEMS, time: () => 'T' })
    expect(custom.container.querySelector('time')?.textContent).toBe('T')
  })

  test('keeps the caller order (never sorts)', () => {
    const { container } = mount({ items: ITEMS.toReversed(), group: 'none' })
    const ids = [...container.querySelectorAll('li')].map((li) => li.textContent)
    expect(ids[0]).toContain('older')
  })

  test('rail defaults on in timeline only', () => {
    expect(mount({ items: ITEMS }).container.querySelector('[data-rail]')).toBeNull()
    cleanup()
    expect(
      mount({ items: ITEMS, density: 'timeline' }).container.querySelector('[data-rail]'),
    ).not.toBeNull()
    cleanup()
    expect(
      mount({ items: ITEMS, density: 'timeline', rail: false }).container.querySelector(
        '[data-rail]',
      ),
    ).toBeNull()
  })

  test('empty and loading', () => {
    const empty = mount({ items: [] })
    expect(empty.container.textContent).toContain('Nothing has happened yet')
    cleanup()
    const loading = mount({ items: [], loading: true, loadingRows: 3 })
    expect(loading.container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(loading.container.querySelectorAll('[aria-hidden]').length).toBeGreaterThanOrEqual(3)
  })

  test('earlier sits at the bottom for newest-first and the top for oldest-first', () => {
    const onLoad = mock(() => {})
    const newest = mount({ items: ITEMS, earlier: { onLoad, remaining: 12 } })
    const button = newest.getByText('Show earlier (12)')
    expect(button.closest('[data-end]')?.getAttribute('data-end')).toBe('bottom')
    expect(button.closest('[data-end]')).toBe(frame(newest.container).lastElementChild)
    fireEvent.click(button)
    expect(onLoad).toHaveBeenCalledTimes(1)
    cleanup()
    const oldest = mount({ items: ITEMS, order: 'oldest-first', earlier: { onLoad } })
    const top = oldest.getByText('Show earlier')
    expect(top.closest('[data-end]')?.getAttribute('data-end')).toBe('top')
    expect(top.closest('[data-end]')).toBe(frame(oldest.container).firstElementChild)
  })

  test('at the threshold the list is plain DOM and never mounts the seam', () => {
    const { container } = mount({ items: many(200), group: 'none' })
    expect(container.querySelectorAll('li')).toHaveLength(200)
    expect(container.querySelector('[data-index]')).toBeNull()
  })

  test('above the threshold the plain <ol> is gone (the seam owns the rows; windowing is proven in Chrome)', () => {
    const { container } = mount({ items: many(201), group: 'none', height: 400 })
    expect(container.querySelector('ol')).toBeNull()
    expect(container.querySelector('[role="list"]')).not.toBeNull()
  })

  test('the mode is a pure function of the count: windowed iff more than 200, same root node', () => {
    const ui = (n: number) => (
      <MantineProvider>
        <EventList label="Activity" now={NOW} items={many(n)} group="none" height={400} />
      </MantineProvider>
    )
    const { container, rerender } = render(ui(200))
    const root = container.querySelector('[data-density] > div')
    expect(container.querySelectorAll('li')).toHaveLength(200)
    rerender(ui(201))
    expect(container.querySelector('ol')).toBeNull()
    expect(container.querySelector('[data-density] > div')).toBe(root)
    rerender(ui(200))
    expect(container.querySelectorAll('li')).toHaveLength(200)
  })

  test('two runs of the same day get distinct header ids, each naming its own list', () => {
    const { container } = mount({
      items: [
        { id: 'a', at: local(2026, 3, 10, 9), title: 'one' },
        { id: 'b', at: local(2026, 3, 9, 9), title: 'two' },
        { id: 'c', at: local(2026, 3, 10, 8), title: 'three' },
      ],
    })
    const headers = [...container.querySelectorAll('h3')]
    expect(headers).toHaveLength(3)
    expect(new Set(headers.map((h) => h.id)).size).toBe(3)
    const lists = [...container.querySelectorAll('ol')]
    expect(lists.map((l) => l.getAttribute('aria-labelledby'))).toEqual(headers.map((h) => h.id))
  })

  test('an invalid at renders a dash without a dateTime, and the other rows survive', () => {
    const { container } = mount({
      items: [
        { id: 'a', at: local(2026, 3, 10, 9), title: 'good' },
        { id: 'b', at: Number.NaN, title: 'bad' },
      ],
    })
    const times = [...container.querySelectorAll('time')]
    expect(times).toHaveLength(2)
    expect(times[1]?.textContent).toBe('—')
    expect(times[1]?.hasAttribute('datetime')).toBe(false)
    expect(times[0]?.getAttribute('datetime')).not.toBeNull()
  })

  test('a caller dayLabel is never called with an invalid day, and an all-invalid list has no header', () => {
    const dayLabel = mock((d: Date): string => {
      if (!Number.isFinite(d.getTime())) throw new Error('dayLabel got an invalid day')
      return 'D'
    })
    const { container } = mount({
      dayLabel,
      items: [
        { id: 'a', at: Number.NaN, title: 'one' },
        { id: 'b', at: new Date('nope'), title: 'two' },
      ],
    })
    expect(container.querySelectorAll('h3')).toHaveLength(0)
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(dayLabel).not.toHaveBeenCalled()
    cleanup()
    const mixed = mount({
      dayLabel,
      items: [
        { id: 'a', at: Number.NaN, title: 'one' },
        { id: 'b', at: local(2026, 3, 10, 9), title: 'two' },
      ],
    })
    expect(mixed.container.querySelectorAll('h3')).toHaveLength(1)
    expect(mixed.container.querySelectorAll('li')).toHaveLength(2)
  })

  test('the empty list is an EmptyState with the caller action', () => {
    const { getByText } = mount({
      items: [],
      empty: {
        title: 'No sessions yet',
        description: 'Log one to start the record.',
        action: <button type="button">Log a session</button>,
      },
    })
    expect(getByText('No sessions yet')).toBeTruthy()
    expect(getByText('Log one to start the record.')).toBeTruthy()
    expect(getByText('Log a session')).toBeTruthy()
  })

  test('the plain <ol> carries an explicit list role', () => {
    const { container } = mount({ items: ITEMS })
    expect(container.querySelector('ol')?.getAttribute('role')).toBe('list')
  })

  test('loading keeps the declared height box; an empty list sizes to its content', () => {
    const box = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-density] > div')
    const loading = mount({ items: [], loading: true, height: 240 })
    expect(box(loading.container)?.style.height).toBe('calc(240px - var(--event-list-trim, 0px))')
    loading.rerender(
      <MantineProvider>
        <EventList label="Activity" now={NOW} items={[]} height={240} />
      </MantineProvider>,
    )
    expect(box(loading.container)?.style.height).toBe('')
  })

  test('empty strings for body and chips render no meta line; an empty time renders no time', () => {
    const { container } = mount({
      time: () => '',
      items: [{ id: 'a', at: local(2026, 3, 10, 9), title: 't', body: '', chips: '' }],
    })
    expect(container.querySelector('li > div')).toBeNull()
    expect(container.querySelector('time')).toBeNull()
  })

  test('chips are their own element, a sibling of the time and the note, whatever the row holds', () => {
    const { container } = mount({
      items: [
        { id: 'a', at: local(2026, 3, 10, 9), title: 't', body: 'two files', chips: <i>c</i> },
        { id: 'b', at: local(2026, 3, 10, 9), title: 't', chips: <i>c</i> },
      ],
    })
    for (const id of ['a', 'b']) {
      const chip = container.querySelector(`[data-event-id="${id}"] i`)
      // The chips' wrapper is a direct child of the row: never nested in the time's or the note's element.
      expect(chip?.parentElement?.parentElement?.getAttribute('data-event-id')).toBe(id)
    }
    // The note holds its text alone: no chip is inside the note.
    const notes = container.querySelectorAll('[data-event-id="a"] i, [data-event-id="a"] time')
    expect(notes).toHaveLength(2)
    expect(container.querySelector('[data-event-id="a"] i')?.closest('time')).toBeNull()
    expect(container.querySelector('[data-event-id="a"]')?.textContent).toContain('two files')
    expect(container.querySelectorAll('[data-event-id="b"] > div')).toHaveLength(1)
  })

  test('an empty chips array renders no chips row, like an absent one', () => {
    const { container } = mount({
      items: [{ id: 'a', at: local(2026, 3, 10, 9), title: 't', chips: [], body: 'b' }],
    })
    expect(container.querySelectorAll('[data-event-id="a"] > div')).toHaveLength(1)
  })

  test('a skeleton keeps the loaded row count while refetching, else loadingRows or 5', () => {
    const rows = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `r${i}`,
        at: local(2026, 3, 10, 9, i),
        title: `r${i}`,
      }))
    const count = (props: Pick<EventListProps, 'items'> & Partial<EventListProps>) =>
      mount({ loading: true, group: 'none', ...props }).container.querySelectorAll(
        '[aria-busy="true"] [aria-hidden]',
      ).length
    expect(count({ items: rows(12) })).toBe(12)
    expect(count({ items: rows(12), loadingRows: 4 })).toBe(4)
    expect(count({ items: [] })).toBe(5)
    expect(count({ items: rows(80) })).toBe(30)
  })
})

describe('EventList prepend anchoring (oldest-first, own scroll node)', () => {
  const rows = (ids: string[]) =>
    ids.map((id, i) => ({ id, at: local(2026, 3, 10, 9, i), title: id }))
  const ui = (items: ReturnType<typeof rows>, loading = false) => (
    <MantineProvider>
      <EventList
        label="Activity"
        now={NOW}
        items={items}
        order="oldest-first"
        height={200}
        loading={loading}
      />
    </MantineProvider>
  )
  /** happy-dom has no layout: scrollHeight is a settable stand-in. */
  function scroller(c: HTMLElement, state: { height: number }): HTMLElement {
    const el = c.querySelector<HTMLElement>('[data-density] > div') as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => state.height })
    return el
  }

  test('a prepend adds the height delta to scrollTop', () => {
    const state = { height: 100 }
    const { container, rerender } = render(ui(rows(['b', 'c'])))
    const el = scroller(container, state)
    rerender(ui(rows(['b', 'c']))) // record the baseline height
    el.scrollTop = 50
    state.height = 160
    rerender(ui(rows(['a', 'b', 'c'])))
    expect(el.scrollTop).toBe(110)
  })

  test('items → [] → items is a reload, not a prepend', () => {
    const state = { height: 100 }
    const { container, rerender } = render(ui(rows(['b', 'c'])))
    const el = scroller(container, state)
    rerender(ui(rows(['b', 'c'])))
    rerender(ui([]))
    el.scrollTop = 30
    state.height = 400
    rerender(ui(rows(['x', 'b', 'c'])))
    // A reload opens on the newest end again (400); a prepend adjustment would have read 330.
    expect(el.scrollTop).toBe(400)
  })

  test('loading → loaded is a reload, not a prepend', () => {
    const state = { height: 100 }
    const { container, rerender } = render(ui(rows(['b', 'c'])))
    const el = scroller(container, state)
    rerender(ui(rows(['b', 'c'])))
    rerender(ui(rows(['b', 'c']), true))
    el.scrollTop = 30
    state.height = 400
    rerender(ui(rows(['x', 'y', 'b', 'c'])))
    expect(el.scrollTop).toBe(400)
  })

  test('duplicate ids never read as a prepend', () => {
    const state = { height: 100 }
    const dup = (n: number) => rows(Array.from({ length: n }, () => 'a'))
    const { container, rerender } = render(ui(dup(2)))
    const el = scroller(container, state)
    rerender(ui(dup(2)))
    el.scrollTop = 30
    state.height = 160
    rerender(ui(dup(3)))
    expect(el.scrollTop).toBe(30)
  })

  test('without a height, an oldest-first list leaves the page scroll alone', () => {
    const { container } = render(
      <MantineProvider>
        <EventList label="Activity" now={NOW} items={rows(['a', 'b'])} order="oldest-first" />
      </MantineProvider>,
    )
    const el = container.querySelector<HTMLElement>('[data-density] > div') as HTMLElement
    expect(el.scrollTop).toBe(0)
  })

  test('a replaced list (old first id gone) is not a prepend', () => {
    const state = { height: 100 }
    const { container, rerender } = render(ui(rows(['b', 'c'])))
    const el = scroller(container, state)
    rerender(ui(rows(['b', 'c'])))
    el.scrollTop = 30
    state.height = 400
    rerender(ui(rows(['x', 'y', 'z'])))
    expect(el.scrollTop).toBe(30)
  })
})

describe('EventList on the server', () => {
  test('renders without reading the clock and without clock-relative labels', () => {
    const spy = spyOn(Date, 'now')
    const today = new Date()
    const html = renderToString(
      <MantineProvider>
        <EventList
          label="Activity"
          time="relative"
          items={[
            { id: 'a', at: today, title: 'one' },
            { id: 'b', at: new Date(today.getTime() - 86_400_000), title: 'two' },
          ]}
        />
      </MantineProvider>,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    expect(html).not.toContain('Today')
    expect(html).not.toContain('Yesterday')
    expect(html).not.toContain(' ago')
    expect(html).toContain('one')
  })
})

describe('EventList feed note, clipped-feed cue and skeleton height', () => {
  test('data-more marks a box with content below the fold, and clears at the end', () => {
    const { container } = mount({ height: 100, items: ITEMS })
    const box = container.querySelector<HTMLElement>('[data-density] > div') as HTMLElement
    const metrics = { scrollHeight: 300, clientHeight: 100, scrollTop: 0 }
    for (const key of ['scrollHeight', 'clientHeight'] as const) {
      Object.defineProperty(box, key, { configurable: true, get: () => metrics[key] })
    }
    box.dispatchEvent(new Event('scroll'))
    expect(box.hasAttribute('data-more')).toBe(true)
    box.scrollTop = 200
    box.dispatchEvent(new Event('scroll'))
    expect(box.hasAttribute('data-more')).toBe(false)
  })

  test('data-more is absent when the content fits, and a flag is not rewritten without a transition', () => {
    const { container } = mount({ height: 400, items: ITEMS })
    const box = container.querySelector<HTMLElement>('[data-density] > div') as HTMLElement
    for (const [key, value] of [
      ['scrollHeight', 200],
      ['clientHeight', 400],
    ] as const) {
      Object.defineProperty(box, key, { configurable: true, get: () => value })
    }
    const set = mock(box.setAttribute.bind(box))
    box.setAttribute = set
    box.dispatchEvent(new Event('scroll'))
    box.dispatchEvent(new Event('scroll'))
    expect(box.hasAttribute('data-more')).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  test('unmounting clears the scroll flags', () => {
    const { container, unmount } = mount({ height: 100, items: ITEMS })
    const box = container.querySelector<HTMLElement>('[data-density] > div') as HTMLElement
    box.setAttribute('data-more', '')
    box.setAttribute('data-scrolled', '')
    unmount()
    expect(box.hasAttribute('data-more')).toBe(false)
    expect(box.hasAttribute('data-scrolled')).toBe(false)
  })

  test('the held height survives a loading pass and is released when the rows go', () => {
    const { container, rerender } = render(
      <MantineProvider>
        <EventList label="Activity" now={NOW} items={ITEMS} height={100} />
      </MantineProvider>,
    )
    const box = container.querySelector<HTMLElement>('[data-density] > div') as HTMLElement
    box.style.setProperty('--event-list-held', '321px')
    const at = (props: { loading: boolean; items: typeof ITEMS }) =>
      rerender(
        <MantineProvider>
          <EventList label="Activity" now={NOW} height={100} {...props} />
        </MantineProvider>,
      )
    at({ loading: true, items: ITEMS })
    expect(box.style.getPropertyValue('--event-list-held')).toBe('321px')
    at({ loading: false, items: [] })
    expect(box.style.getPropertyValue('--event-list-held')).toBe('')
  })
})
