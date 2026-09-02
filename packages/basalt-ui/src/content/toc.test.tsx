/**
 * `TableOfContents` — the scroll-spy's port-awareness (docs/CONTENT-SPEC.md §3/§6;
 * `common/scroll-parent.ts`): the `IntersectionObserver`'s `root`, the bottom-edge dead-zone
 * arithmetic, where the click-pin release listens for `scrollend`, and which rail item ends up
 * `aria-current="location"` — all resolve against `scrollParentOf(containerRef?.current)` instead
 * of assuming the window.
 *
 * `aria-current` (not `classes.active`) is the observable hook throughout: CSS Modules resolve to
 * `{}` under `bun test` (no bundler pass touches `.module.css` here; every sibling test file in
 * this directory notes the same gap), so `classes.active` is never assertable in this harness. The
 * bottom-edge tests additionally track WHICH object's geometry got READ (via a getter that logs
 * every access) — proof that the port branch executed, independent of and in addition to the
 * `aria-current` outcome it produces.
 */
import type { ReactElement, RefObject } from 'react'
import { useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { TableOfContents } from './toc'
import type { TocItem } from './toc'

// ── stubbing plumbing (same shape as reading-progress.test.tsx) ────────────────────────────────

const restorers: Array<() => void> = []

afterEach(() => {
  while (restorers.length > 0) restorers.pop()?.()
})

function stubProp(target: object, prop: PropertyKey, value: unknown): void {
  const original = Object.getOwnPropertyDescriptor(target, prop)
  Object.defineProperty(target, prop, { value, configurable: true })
  restorers.push(() => {
    if (original) Object.defineProperty(target, prop, original)
    else Reflect.deleteProperty(target, prop)
  })
}

/** Replaces `target[prop]` with a getter that records every read into `log` before returning
 *  `value` — proves WHICH object's property the code under test actually consulted. */
function stubGetter(target: object, prop: PropertyKey, value: unknown, log: string[]): void {
  const original = Object.getOwnPropertyDescriptor(target, prop)
  Object.defineProperty(target, prop, {
    configurable: true,
    get: () => {
      log.push(String(prop))
      return value
    },
  })
  restorers.push(() => {
    if (original) Object.defineProperty(target, prop, original)
    else Reflect.deleteProperty(target, prop)
  })
}

/** Wraps `el`'s OWN `addEventListener` so calls are recorded before forwarding to the real one. */
function recordAddEventListener(el: EventTarget, log: string[]): void {
  const original = el.addEventListener.bind(el)
  stubProp(
    el,
    'addEventListener',
    (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions,
    ) => {
      log.push(type)
      return original(type, listener, options)
    },
  )
}

/** A fabricated intersection entry — only the two fields `toc.tsx`'s callback reads. */
type FakeEntry = { readonly target: Element; readonly isIntersecting: boolean }

/** One captured `new IntersectionObserver(callback, options)` call, with a way to fire it by hand. */
type CapturedObserver = {
  readonly root: Element | Document | null
  readonly rootMargin: string
  trigger(entries: readonly FakeEntry[]): void
}

/**
 * Replaces `window.IntersectionObserver` and returns every constructed instance, each triggerable
 * by hand — the ONLY way to drive `toc.tsx`'s entries callback under happy-dom, which implements no
 * real intersection geometry at all (the preload's own shim, `tests/setup/dom.ts`, is a permanent
 * no-op for exactly that reason). Not declared `implements IntersectionObserver` for the same
 * reason the preload shim isn't — the real interface's `scrollMargin` member is irrelevant here.
 */
function installFakeIntersectionObserver(): CapturedObserver[] {
  const observers: CapturedObserver[] = []
  class Fake {
    readonly root: Element | Document | null
    readonly rootMargin: string
    readonly thresholds: ReadonlyArray<number> = []
    private readonly callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback
      this.root = (options?.root as Element | Document | null | undefined) ?? null
      this.rootMargin = options?.rootMargin ?? ''
      observers.push(this)
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
    trigger(entries: readonly FakeEntry[]): void {
      this.callback(
        entries as unknown as IntersectionObserverEntry[],
        this as unknown as IntersectionObserver,
      )
    }
  }
  stubProp(window, 'IntersectionObserver', Fake)
  return observers
}

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const ONE_ITEM: TocItem[] = [{ id: 'sec-a', label: 'Section A', level: 2 }]
const TWO_ITEMS: TocItem[] = [
  { id: 'sec-a', label: 'Section A', level: 2 },
  { id: 'sec-b', label: 'Section B', level: 2 },
]

/** Headings inside a `[data-basalt-scrollport]` ancestor — the port case. */
function PortHarness({ items }: { items: TocItem[] }): ReactElement {
  const containerRef: RefObject<HTMLDivElement | null> = useRef(null)
  return (
    <>
      <div data-basalt-scrollport data-testid="port">
        <div ref={containerRef}>
          {items.map((item) => (
            <h2 key={item.id} id={item.id}>
              {item.label}
            </h2>
          ))}
        </div>
      </div>
      <TableOfContents items={items} containerRef={containerRef} />
    </>
  )
}

/** Same headings, no scrollport ancestor anywhere — the shell-less / window case. */
function WindowHarness({ items }: { items: TocItem[] }): ReactElement {
  const containerRef: RefObject<HTMLDivElement | null> = useRef(null)
  return (
    <>
      <div ref={containerRef}>
        {items.map((item) => (
          <h2 key={item.id} id={item.id}>
            {item.label}
          </h2>
        ))}
      </div>
      <TableOfContents items={items} containerRef={containerRef} />
    </>
  )
}

function linkFor(label: string): HTMLElement {
  return screen.getByRole('link', { name: label })
}

// ── the observer root ───────────────────────────────────────────────────────────────────────────

describe('TableOfContents — the IntersectionObserver root', () => {
  test('is the resolved scrollport element when one exists', () => {
    const observers = installFakeIntersectionObserver()

    render(<PortHarness items={ONE_ITEM} />)

    expect(observers).toHaveLength(1)
    expect(observers[0]?.root).toBe(screen.getByTestId('port'))
    expect(observers[0]?.rootMargin).toBe('-80px 0px -70% 0px')
  })

  test('is null (the viewport) when there is no scrollport ancestor', () => {
    const observers = installFakeIntersectionObserver()

    render(<WindowHarness items={ONE_ITEM} />)

    expect(observers).toHaveLength(1)
    expect(observers[0]?.root).toBeNull()
  })
})

// ── which rail item is active ───────────────────────────────────────────────────────────────────

describe('TableOfContents — aria-current follows the intersection entries', () => {
  test('no link is current before anything has intersected', () => {
    installFakeIntersectionObserver()
    render(<PortHarness items={TWO_ITEMS} />)

    expect(linkFor('Section A').hasAttribute('aria-current')).toBe(false)
    expect(linkFor('Section B').hasAttribute('aria-current')).toBe(false)
  })

  test('the topmost intersecting heading becomes current, and moves as the entries move', () => {
    const observers = installFakeIntersectionObserver()
    render(<PortHarness items={TWO_ITEMS} />)
    const observer = observers[0]
    if (!observer) throw new Error('unreachable — TableOfContents always builds one observer')

    // happy-dom lays out nothing, so an unstubbed port's clientHeight/scrollTop/scrollHeight are
    // all 0 — which trivially satisfies the bottom-edge check (`0 >= 0 - 2`) and would mark the
    // LAST item current before the intersecting entries below ever get a say. Stubbed clear of that
    // dead zone so this test exercises the intersecting-entries branch it names.
    const port = screen.getByTestId('port')
    stubProp(port, 'scrollTop', 0)
    stubProp(port, 'clientHeight', 100)
    stubProp(port, 'scrollHeight', 1000)

    const sectionA = document.getElementById('sec-a')
    const sectionB = document.getElementById('sec-b')
    if (!sectionA || !sectionB) throw new Error('unreachable — both headings are in the DOM')

    act(() => {
      observer.trigger([{ target: sectionA, isIntersecting: true }])
    })
    expect(linkFor('Section A').getAttribute('aria-current')).toBe('location')
    expect(linkFor('Section B').hasAttribute('aria-current')).toBe(false)

    act(() => {
      observer.trigger([
        { target: sectionA, isIntersecting: false },
        { target: sectionB, isIntersecting: true },
      ])
    })
    expect(linkFor('Section A').hasAttribute('aria-current')).toBe(false)
    expect(linkFor('Section B').getAttribute('aria-current')).toBe('location')
  })
})

// ── the bottom-edge dead-zone arithmetic ────────────────────────────────────────────────────────

describe('TableOfContents — the bottom-edge dead-zone reads the right box', () => {
  test('inside a scrollport: reads the port’s scrollTop/clientHeight/scrollHeight, never window’s, and marks the LAST item current', () => {
    installFakeIntersectionObserver()
    render(<PortHarness items={TWO_ITEMS} />)
    const port = screen.getByTestId('port')

    const portReads: string[] = []
    const windowReads: string[] = []
    stubGetter(port, 'scrollTop', 190, portReads)
    stubGetter(port, 'clientHeight', 200, portReads)
    stubGetter(port, 'scrollHeight', 390, portReads)
    stubGetter(window, 'innerHeight', 100_000, windowReads)
    stubGetter(window, 'scrollY', 0, windowReads)
    stubGetter(document.documentElement, 'scrollHeight', 100_000, windowReads)

    fireEvent.scroll(port)

    expect(portReads.toSorted()).toEqual(['clientHeight', 'scrollHeight', 'scrollTop'])
    expect(windowReads).toHaveLength(0)
    // 190 + 200 = 390 >= 390 - 2 — bottomed out — so the LAST item wins outright, regardless of
    // which heading (if any) is intersecting.
    expect(linkFor('Section B').getAttribute('aria-current')).toBe('location')
    expect(linkFor('Section A').hasAttribute('aria-current')).toBe(false)
  })

  test('with no scrollport: falls back to window.innerHeight/scrollY and documentElement.scrollHeight', () => {
    installFakeIntersectionObserver()
    render(<WindowHarness items={TWO_ITEMS} />)

    const windowReads: string[] = []
    stubGetter(window, 'innerHeight', 500, windowReads)
    stubGetter(window, 'scrollY', 500, windowReads)
    stubGetter(document.documentElement, 'scrollHeight', 1500, windowReads)

    act(() => {
      fireEvent.scroll(window)
    })

    expect(windowReads.toSorted()).toEqual(['innerHeight', 'scrollHeight', 'scrollY'])
    // 500 + 500 = 1000 >= 1500 - 2 is FALSE here — deliberately short of the bottom, so this proves
    // the window path is live (it read the stubbed numbers) without also asserting the bottom-item
    // branch, which the scrollport test above already covers. Nothing is intersecting either (no IO
    // entries were fired), so `resolve()`'s last fallback applies: with nothing passed and nothing
    // intersecting, the FIRST heading is "where the reader actually is" (see `toc.tsx`'s own comment
    // on that branch) — not neither, and not the last.
    expect(linkFor('Section A').getAttribute('aria-current')).toBe('location')
    expect(linkFor('Section B').hasAttribute('aria-current')).toBe(false)
  })
})

// ── the click-pin release's scrollend target ────────────────────────────────────────────────────

describe('TableOfContents — the click-pin release listens on the right box', () => {
  test('inside a scrollport: scrollend is registered on the port, not window', () => {
    installFakeIntersectionObserver()
    render(<PortHarness items={ONE_ITEM} />)
    const port = screen.getByTestId('port')

    const portEvents: string[] = []
    const windowEvents: string[] = []
    recordAddEventListener(port, portEvents)
    recordAddEventListener(window, windowEvents)

    fireEvent.click(linkFor('Section A'))

    expect(portEvents).toContain('scrollend')
    expect(windowEvents).not.toContain('scrollend')
  })

  test('with no scrollport: scrollend is registered on window', () => {
    installFakeIntersectionObserver()
    render(<WindowHarness items={ONE_ITEM} />)

    const windowEvents: string[] = []
    recordAddEventListener(window, windowEvents)

    fireEvent.click(linkFor('Section A'))

    expect(windowEvents).toContain('scrollend')
  })
})
