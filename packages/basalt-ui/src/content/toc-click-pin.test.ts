/** `ClickPin` — every transition of the TOC click machine (`toc-click-pin.ts`), with fake timers. */
import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from 'bun:test'
import { ClickPin, HOLD_EPSILON_PX, INTENT_EVENTS, QUIET_MS, isScrollIntent } from './toc-click-pin'

let port: HTMLElement
let link: HTMLAnchorElement
let field: HTMLInputElement
let other: HTMLButtonElement
let scrollPosition: number
let idled: number
let pin: ClickPin

beforeEach(() => {
  jest.useFakeTimers()
  port = document.createElement('div')
  link = document.createElement('a')
  field = document.createElement('input')
  other = document.createElement('button')
  port.append(link, field, other)
  document.body.append(port)
  scrollPosition = 0
  Object.defineProperty(port, 'scrollTop', { get: () => scrollPosition, configurable: true })
  idled = 0
  pin = new ClickPin(() => void idled++)
})

afterEach(() => {
  mock.restore()
  pin.dispose()
  port.remove()
  jest.useRealTimers()
})

/** `getTimerCount` does not drop on `clearTimeout`, so track the handles themselves. */
function trackTimers() {
  const made: unknown[] = []
  const cleared: unknown[] = []
  const set = globalThis.setTimeout
  const clear = globalThis.clearTimeout
  spyOn(globalThis, 'setTimeout').mockImplementation(((...args: Parameters<typeof set>) => {
    const handle = set(...args)
    made.push(handle)
    return handle
  }) as typeof set)
  spyOn(globalThis, 'clearTimeout').mockImplementation(((handle?: Parameters<typeof clear>[0]) => {
    cleared.push(handle)
    return clear(handle)
  }) as typeof clear)
  return { leaked: () => made.filter((handle) => !cleared.includes(handle)) }
}

const key = (name: string) => new KeyboardEvent('keydown', { key: name, bubbles: true })
const fire = (target: EventTarget, event: Event) => target.dispatchEvent(event)
const scrollend = () => fire(port, new Event('scrollend'))
/** The scroller moves for a reason that is not the reader's input. */
const moveTo = (to: number) => {
  scrollPosition = to
  fire(port, new Event('scroll'))
}

describe('click → pinned → held', () => {
  test('a click pins its entry at once; a second click replaces it', () => {
    pin.click('a', link, port)
    expect(pin.state).toEqual({ kind: 'pinned', id: 'a' })
    pin.click('b', link, port)
    expect(pin.state).toEqual({ kind: 'pinned', id: 'b' })
    expect(pin.activeId).toBe('b')
    expect(idled).toBe(0)
  })

  test('the first scrollend holds the entry where the scroll settled', () => {
    pin.click('a', link, port)
    scrollPosition = 1234
    scrollend()
    expect(pin.state).toEqual({ kind: 'held', id: 'a', top: 1234 })
  })

  test('scrollend clears the quiet timer', () => {
    const timers = trackTimers()
    pin.click('a', link, port)
    scrollend()
    expect(timers.leaked()).toEqual([])
  })

  test('a click that needs no scroll is held after the quiet window', () => {
    scrollPosition = 40
    pin.click('a', link, port)
    jest.advanceTimersByTime(QUIET_MS - 1)
    expect(pin.state.kind).toBe('pinned')
    jest.advanceTimersByTime(1)
    expect(pin.state).toEqual({ kind: 'held', id: 'a', top: 40 })
    expect(idled).toBe(0)
  })

  test('a scroll still in flight past any fixed deadline stays pinned; held where it finally stops', () => {
    pin.click('a', link, port)
    for (let at = 100; at <= 4000; at += 100) {
      scrollPosition = at
      fire(port, new Event('scroll'))
      jest.advanceTimersByTime(100)
      expect(pin.state).toEqual({ kind: 'pinned', id: 'a' })
    }
    jest.advanceTimersByTime(QUIET_MS)
    expect(pin.state).toEqual({ kind: 'held', id: 'a', top: 4000 })
    expect(idled).toBe(0)
  })

  test.each([
    ['held', () => scrollend()],
    ['idle', () => fire(other, key('PageDown'))],
    ['replaced', () => pin.click('b', link, port)],
    ['disposed', () => pin.dispose()],
  ])('leaving pinned (%s) clears the quiet timer', (_name, leave) => {
    const timers = trackTimers()
    pin.click('a', link, port)
    moveTo(10) // re-arms: the first handle must be cleared too
    leave()
    pin.dispose()
    expect(timers.leaked()).toEqual([])
  })

  test('a replaced click does not leak the first click’s listeners or timer', () => {
    pin.click('a', link, port)
    pin.click('b', link, port)
    expect(jest.getTimerCount()).toBe(1)
    fire(document.body, key('PageDown'))
    expect(idled).toBe(1)
  })
})

describe('held → idle on movement', () => {
  beforeEach(() => {
    scrollPosition = 500
    pin.click('a', link, port)
    scrollend()
  })

  test('2px of movement keeps the hold', () => {
    moveTo(500 + HOLD_EPSILON_PX)
    moveTo(500 - HOLD_EPSILON_PX)
    expect(pin.state.kind).toBe('held')
  })

  test('3px of programmatic movement releases (find-in-page, focus, layout shift, app scroll)', () => {
    moveTo(500 + HOLD_EPSILON_PX + 1)
    expect(pin.state).toEqual({ kind: 'idle' })
    expect(idled).toBe(1)
  })

  test('movement while still pinned does not release: that is the click’s own scroll', () => {
    pin.click('b', link, port)
    moveTo(900)
    expect(pin.state).toEqual({ kind: 'pinned', id: 'b' })
  })
})

describe('scroll intent releases pinned and held', () => {
  test.each([
    ['wheel', () => new Event('wheel', { bubbles: true })],
    ['touchstart', () => new Event('touchstart', { bubbles: true })],
    ['PageDown', () => key('PageDown')],
    ['End', () => key('End')],
    ['ArrowDown', () => key('ArrowDown')],
    ['Space', () => key(' ')],
    ['pointerdown on any other element', () => new Event('pointerdown', { bubbles: true })],
  ])('%s', (_name, make) => {
    pin.click('a', link, port)
    fire(other, make())
    expect(pin.state).toEqual({ kind: 'idle' })
    expect(idled).toBe(1)

    pin.click('a', link, port)
    scrollend()
    fire(other, make())
    expect(pin.state).toEqual({ kind: 'idle' })
    expect(idled).toBe(2)
  })

  test('Enter on the just-activated rail link does not release', () => {
    pin.click('a', link, port)
    fire(link, key('Enter'))
    expect(pin.state.kind).toBe('pinned')
  })

  test('pointerdown on the rail link itself does not release', () => {
    pin.click('a', link, port)
    fire(link, new Event('pointerdown', { bubbles: true }))
    expect(pin.state.kind).toBe('pinned')
  })

  test('scroll keys typed into an input do not release; other keys never do', () => {
    pin.click('a', link, port)
    fire(field, key('ArrowDown'))
    fire(field, key(' '))
    fire(document.body, key('Tab'))
    fire(document.body, key('a'))
    expect(pin.state.kind).toBe('pinned')
  })

  test('isScrollIntent is false for events it does not know', () => {
    expect(isScrollIntent(new Event('click'), link)).toBe(false)
  })
})

describe('removal and unmount', () => {
  test('an id that is no longer an item releases, pinned or held; with zero ids too', () => {
    pin.click('a', link, port)
    pin.prune(['a', 'b'])
    expect(pin.state.kind).toBe('pinned')
    pin.prune(['b'])
    expect(pin.state).toEqual({ kind: 'idle' })

    pin.click('a', link, port)
    scrollend()
    pin.prune([])
    expect(pin.state).toEqual({ kind: 'idle' })
    expect(idled).toBe(2)
  })

  test('prune while idle does nothing', () => {
    pin.prune([])
    expect(idled).toBe(0)
  })

  test('dispose mid-pin cancels the timer and removes every listener, waking nobody', () => {
    const add = spyOn(document, 'addEventListener')
    const remove = spyOn(document, 'removeEventListener')
    const portAdd = spyOn(port, 'addEventListener')
    const portRemove = spyOn(port, 'removeEventListener')
    pin.click('a', link, port)
    pin.dispose()

    const names = (spy: { mock: { calls: unknown[][] } }) =>
      spy.mock.calls.map((call) => String(call[0])).toSorted()
    expect(names(remove)).toEqual(names(add))
    expect(names(portRemove)).toEqual(names(portAdd))
    expect(names(add).length).toBeGreaterThan(0)
    for (const type of INTENT_EVENTS) {
      const added = add.mock.calls.find((call) => call[0] === type)
      const removed = remove.mock.calls.find((call) => call[0] === type)
      expect(added?.[2]).toMatchObject({ capture: true })
      expect(removed?.[2]).toMatchObject({ capture: true })
    }

    fire(document.body, key('PageDown'))
    fire(port, new Event('scrollend'))
    jest.advanceTimersByTime(QUIET_MS * 2)
    expect(pin.state).toEqual({ kind: 'idle' })
    expect(idled).toBe(0)
  })
})
