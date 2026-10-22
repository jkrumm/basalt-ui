/**
 * "Open on the newest end" keeps re-applying while the layout settles, and stops for good on the
 * first touch, a count change, or the timeout — a late `fonts.ready` must not scroll a list the
 * user already moved. `ResizeObserver` and `document.fonts` are stubbed (happy-dom has neither).
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { EventList } from './event-list'

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
