/**
 * "Open on the newest end" keeps re-applying while the layout settles, and stops for good on the
 * first touch, a count change, or the timeout — a late `fonts.ready` must not scroll a list the
 * user already moved. `ResizeObserver` and `document.fonts` are stubbed (happy-dom has neither).
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { EventList } from './event-list'
import { rowBoundaryTrim, rowsOutOfView } from './event-list-scroll'

let observed: (() => void)[] = []
let releaseFonts: () => void = () => {}
const scrollTo = mock(() => {})
const realScrollTo = Element.prototype.scrollTo
const realObserver = globalThis.ResizeObserver
const realFonts = Object.getOwnPropertyDescriptor(document, 'fonts')

class FakeResizeObserver {
  constructor(private readonly callback: () => void) {
    observed.push(callback)
  }
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  observed = []
  scrollTo.mockClear()
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
  const ready = new Promise<void>((resolve) => {
    releaseFonts = resolve
  })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } })
})

afterEach(() => {
  cleanup()
  Element.prototype.scrollTo = realScrollTo
  globalThis.ResizeObserver = realObserver
  if (realFonts === undefined) Reflect.deleteProperty(document, 'fonts')
  else Object.defineProperty(document, 'fonts', realFonts)
})

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    at: new Date(2026, 2, 10, 9, i),
    title: `event ${i}`,
  }))

const ui = (n: number) => (
  <MantineProvider>
    <EventList label="Activity" items={rows(n)} order="oldest-first" height={200} />
  </MantineProvider>
)

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('open on the newest end', () => {
  test('re-applies on a resize while untouched', () => {
    render(ui(5))
    const opened = scrollTo.mock.calls.length
    expect(opened).toBeGreaterThan(0)
    for (const fire of observed) fire()
    expect(scrollTo.mock.calls.length).toBeGreaterThan(opened)
  })

  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
    test(`${type} stops it for good`, async () => {
      const { container } = render(ui(5))
      const node = container.querySelector('[data-density] > div') as HTMLElement
      fireEvent(node, new Event(type))
      const stopped = scrollTo.mock.calls.length
      for (const fire of observed) fire()
      releaseFonts()
      await flush()
      expect(scrollTo.mock.calls.length).toBe(stopped)
    })
  }

  test('a late fonts.ready after a stop does not scroll', async () => {
    const { container } = render(ui(5))
    fireEvent(container.querySelector('[data-density] > div') as HTMLElement, new Event('wheel'))
    const stopped = scrollTo.mock.calls.length
    releaseFonts()
    await flush()
    expect(scrollTo.mock.calls.length).toBe(stopped)
  })

  test('a count change (an earlier load) stops it', () => {
    const { rerender } = render(ui(5))
    rerender(ui(8))
    const after = scrollTo.mock.calls.length
    for (const fire of observed) fire()
    expect(scrollTo.mock.calls.length).toBe(after)
  })
})

describe('rowBoundaryTrim', () => {
  const rect = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect
  // A box of 100 with 300 of content; the sole header's group starts at 0, 25 tall; the row at 110-150 straddles the line at max (200) + 25.
  const build = (rows: [number, number][], clientHeight = 100) => {
    const el = document.createElement('div')
    const content = document.createElement('div')
    const group = document.createElement('div')
    const header = document.createElement('div')
    header.setAttribute('data-day-header', '')
    Object.defineProperty(header, 'offsetHeight', { value: 25 })
    group.append(header)
    group.getBoundingClientRect = rect(0, 300)
    content.append(group)
    for (const [top, bottom] of rows) {
      const row = document.createElement('div')
      row.setAttribute('data-event-id', String(top))
      row.getBoundingClientRect = rect(top, bottom)
      content.append(row)
    }
    content.getBoundingClientRect = rect(0, 300)
    el.append(content)
    Object.defineProperty(el, 'scrollHeight', { value: 300 })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight })
    return { el, content }
  }
  test('trims by the remainder of the row the stuck header cuts', () => {
    const { el, content } = build([[200, 250]])
    expect(rowBoundaryTrim(el, content, 0)).toBe(25)
  })
  test('is pure of the current trim', () => {
    const { el, content } = build([[200, 250]], 75)
    expect(rowBoundaryTrim(el, content, 25)).toBe(25)
  })
  test('is 0 when no row is cut, or the cut is in the row padding', () => {
    const clean = build([[225, 250]])
    expect(rowBoundaryTrim(clean.el, clean.content, 0)).toBe(0)
    const { el, content } = build([[200, 250]])
    const real = window.getComputedStyle
    window.getComputedStyle = (() => ({ paddingTop: '30px' })) as unknown as typeof real
    try {
      expect(rowBoundaryTrim(el, content, 0)).toBe(0)
    } finally {
      window.getComputedStyle = real
    }
  })
})

describe('rowsOutOfView', () => {
  const rect = (top: number, bottom: number) => () =>
    ({ top, bottom, height: bottom - top }) as DOMRect
  function box(rows: [number, number][], header?: [number, number]): HTMLElement {
    const el = document.createElement('div')
    el.getBoundingClientRect = rect(0, 100)
    if (header !== undefined) {
      const h = document.createElement('h3')
      h.setAttribute('data-day-header', '')
      h.getBoundingClientRect = rect(...header)
      el.append(h)
    }
    for (const [top, bottom] of rows) {
      const row = document.createElement('li')
      row.setAttribute('data-event-id', 'x')
      row.getBoundingClientRect = rect(top, bottom)
      el.append(row)
    }
    return el
  }

  test('counts the rows cut or hidden above (under the stuck header) and below', () => {
    const el = box(
      [
        [-40, 0],
        [0, 30],
        [30, 60],
        [60, 90],
        [90, 120],
      ],
      [0, 20],
    )
    // Row two starts at the header's top, under it: cut. The last row runs past the floor.
    expect(rowsOutOfView(el)).toEqual({ above: 2, below: 1 })
  })

  test('under two day headers the one at the top edge sets the offset', () => {
    const el = box(
      [
        [30, 60],
        [60, 90],
      ],
      [-80, -60],
    )
    const second = document.createElement('h3')
    second.setAttribute('data-day-header', '')
    second.getBoundingClientRect = rect(0, 40)
    el.insertBefore(second, el.children[1] ?? null)
    // The first day's header is scrolled away; the second (40 high) covers the first row's top.
    expect(rowsOutOfView(el)).toEqual({ above: 1, below: 0 })
  })

  test('a box showing every row has no cue, and a windowed one has no count', () => {
    expect(
      rowsOutOfView(
        box([
          [0, 40],
          [40, 80],
        ]),
      ),
    ).toEqual({ above: 0, below: 0 })
    const windowed = box([
      [-40, 0],
      [90, 140],
    ])
    windowed.firstElementChild?.setAttribute('data-index', '0')
    expect(rowsOutOfView(windowed)).toEqual({ above: 0, below: 0 })
  })
})
