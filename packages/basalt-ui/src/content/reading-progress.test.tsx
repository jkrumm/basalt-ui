/**
 * `ReadingProgress` — the port-relative math in `computeProgress` and which box the scroll
 * listener attaches to (docs/CONTENT-SPEC.md §3/§7; `common/scroll-parent.ts`).
 *
 * `computeProgress` is not exported (by design — it is an implementation detail of the effect), so
 * every case here goes through the rendered bar: the fill div's inline `transform: scaleX(<ratio>)`
 * is the one DOM-observable proof of what the function returned. happy-dom computes no real layout,
 * so every geometry number (`getBoundingClientRect`, `clientHeight`, `scrollTop`, `offsetHeight`,
 * `scrollHeight`) is stubbed by hand — `stubProp` records the original descriptor and `afterEach`
 * restores it, so a stubbed `window.innerHeight`/`document.documentElement.scrollHeight` can never
 * leak into an unrelated test file sharing this process.
 */
import type { ReactElement, RefObject } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ReadingProgress } from './reading-progress'

// ── stubbing plumbing ───────────────────────────────────────────────────────────────────────────

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

function stubRect(el: Element, top: number): void {
  stubProp(el, 'getBoundingClientRect', () => ({ top }) as DOMRect)
}

/** Wraps `el`'s OWN `addEventListener` so calls are recorded before forwarding to the real one —
 *  installed from a `useLayoutEffect`, which the commit phase guarantees runs before ANY
 *  `useEffect` in the tree, so it is in place before `ReadingProgress` attaches its own listener. */
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

function fillTransform(container: HTMLElement): string | null {
  const bar = container.querySelector('[aria-hidden]')
  const fill = bar?.firstElementChild as HTMLElement | null
  return fill ? fill.style.transform : null
}

/** Parses `scaleX(<n>)` back to a number — for the production-anchored test below, whose ratio
 *  never lands on a clean value the way the clamp cases (`scaleX(0)`/`scaleX(1)`) do. */
function fillRatio(container: HTMLElement): number {
  const match = /scaleX\(([-\d.]+)\)/.exec(fillTransform(container) ?? '')
  if (!match?.[1]) throw new Error('no scaleX(...) transform found on the fill element')
  return Number(match[1])
}

// ── (a) no scroll parent — the window fallback ─────────────────────────────────────────────────

describe('ReadingProgress — no scroll parent (window fallback)', () => {
  test('ratio is derived from window.scrollY and documentElement.scrollHeight', () => {
    stubProp(window, 'innerHeight', 500)
    stubProp(window, 'scrollY', 500)
    stubProp(document.documentElement, 'scrollHeight', 1500)

    const { container } = render(
      <MantineProvider>
        <ReadingProgress />
      </MantineProvider>,
    )

    // total = 1500 - 500 = 1000; scrollTop = 500; start = 0 (no target) → ratio = 500 / 1000.
    expect(fillTransform(container)).toBe('scaleX(0.5)')
  })
})

// ── (b) a target inside a [data-basalt-scrollport] ─────────────────────────────────────────────

type Geometry = {
  readonly portTop: number
  readonly portClientHeight: number
  readonly portScrollTop: number
  readonly targetTop: number
  readonly targetOffsetHeight: number
}

function applyGeometry(port: HTMLElement, target: HTMLElement, geometry: Geometry): void {
  stubRect(port, geometry.portTop)
  stubProp(port, 'clientHeight', geometry.portClientHeight)
  stubProp(port, 'scrollTop', geometry.portScrollTop)
  stubRect(target, geometry.targetTop)
  stubProp(target, 'offsetHeight', geometry.targetOffsetHeight)
}

function ScrollportHarness({
  geometry,
  onPortReady,
}: {
  geometry: Geometry
  onPortReady?: (port: HTMLDivElement) => void
}): ReactElement {
  const portRef: RefObject<HTMLDivElement | null> = useRef(null)
  const targetRef: RefObject<HTMLDivElement | null> = useRef(null)
  const readyRef = useRef(false)

  // No dependency array: re-applies the geometry stub on every render (e.g. a `rerender` with new
  // geometry), and — critically — always runs before `ReadingProgress`'s own passive effect.
  useLayoutEffect(() => {
    const port = portRef.current
    const target = targetRef.current
    if (!port || !target) return
    applyGeometry(port, target, geometry)
    if (!readyRef.current) {
      readyRef.current = true
      onPortReady?.(port)
    }
  })

  // No `overflow-y: auto` here — `isScrollport` (`common/scroll-parent.ts`) keys on the
  // `data-basalt-scrollport` attribute alone, and a raw `overflow: auto/scroll` div trips the
  // `basalt/raw-scroll-container` guard (real UI wants Mantine's `ScrollArea` instead).
  return (
    <div ref={portRef} data-basalt-scrollport data-testid="port">
      <div ref={targetRef} data-testid="target">
        content
      </div>
      <ReadingProgress target={targetRef} />
    </div>
  )
}

describe('ReadingProgress — a target inside a [data-basalt-scrollport]', () => {
  test('the scroll listener attaches to the port (not window), and progress clamps to 0 while the target has not been reached', () => {
    const portEvents: string[] = []
    const windowEvents: string[] = []
    recordAddEventListener(window, windowEvents)

    const { container } = render(
      <MantineProvider>
        <ScrollportHarness
          geometry={{
            portTop: 100,
            portClientHeight: 400,
            // The target's rect top (120) sits BELOW the port's own top (100) at scrollTop 0 — the
            // reader has not reached it yet. `start` computes to +20, so a naive `(0 - 20) / total`
            // would be negative; the clamp is what keeps the bar at 0 instead of running backwards.
            portScrollTop: 0,
            targetTop: 120,
            targetOffsetHeight: 1000,
          }}
          onPortReady={(port) => recordAddEventListener(port, portEvents)}
        />
      </MantineProvider>,
    )

    expect(portEvents).toContain('scroll')
    expect(windowEvents).not.toContain('scroll')
    expect(fillTransform(container)).toBe('scaleX(0)')
  })

  test('progress reaches 1 once the port has scrolled the target fully past', async () => {
    const start: Geometry = {
      portTop: 100,
      portClientHeight: 400,
      portScrollTop: 0,
      targetTop: 120,
      targetOffsetHeight: 1000,
    }
    const { container, rerender } = render(
      <MantineProvider>
        <ScrollportHarness geometry={start} />
      </MantineProvider>,
    )
    expect(fillTransform(container)).toBe('scaleX(0)')

    // total = 1000 - 400 = 600; scrolling by 620 keeps `start` constant at +20 (target's rect top
    // moves up by exactly the scroll delta), so ratio = (620 - 20) / 600 = 1.
    rerender(
      <MantineProvider>
        <ScrollportHarness geometry={{ ...start, portScrollTop: 620, targetTop: 120 - 620 }} />
      </MantineProvider>,
    )
    fireEvent.scroll(screen.getByTestId('port'))

    await waitFor(() => {
      expect(fillTransform(container)).toBe('scaleX(1)')
    })
  })

  /**
   * Anchored to real numbers measured in Chrome against the playground's `/content` page
   * (`.claude/shots/m5/diag.mjs`/`diag4.mjs`): `AppShell.Main` at 1440×900 measures
   * `clientHeight=852`, its own `getBoundingClientRect().top=48`, and the tracked article body
   * (`ArticleLayout`'s `articleRef`) measures `offsetHeight=3106`. At a REAL `scrollTop=1000`
   * (driven by `page.mouse.wheel`, which — unlike a raw `el.scrollTop = n` assignment — dispatches
   * a genuine, browser-trusted `scroll` event) the rendered fill read `scaleX(0.336416)`. This
   * reproduces that exact geometry through `fireEvent.scroll` (RTL's dispatch is the same kind of
   * real DOM event) as a regression anchor: if `computeProgress`'s arithmetic ever drifts, this is
   * the test that catches it against production numbers rather than round test fixtures.
   */
  test('matches the ratio measured live at /content (Chrome, 1440×900, scrollTop=1000)', () => {
    const { container } = render(
      <MantineProvider>
        <ScrollportHarness
          geometry={{
            portTop: 48,
            portClientHeight: 852,
            portScrollTop: 1000,
            targetTop: -710.3,
            targetOffsetHeight: 3106,
          }}
        />
      </MantineProvider>,
    )
    fireEvent.scroll(screen.getByTestId('port'))

    expect(fillRatio(container)).toBeCloseTo(0.336416, 2)
  })
})
