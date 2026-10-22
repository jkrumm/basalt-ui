/**
 * `VirtualRows` under happy-dom: the sticky range extractor, the peer-absent degrade, the
 * `scroll: 'parent'` windowing. happy-dom has no layout engine, so real geometry (a header that
 * stays on screen after a 2000 px scroll, a prepend that holds the first visible row still) lives
 * in `tests/layout/virtual-rows.layout.test.ts`.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  activeStickyIndex,
  applyInitialScroll,
  extractRangeWithSticky,
  isListAtEnd,
  MAX_INITIAL_SCROLL_ATTEMPTS,
  NonVirtualizedRows,
  resolveGuardedMeasurement,
  resolveInitialScrollAction,
  VirtualRows,
} from './virtual-rows'
import type { InitialScrollState, VirtualRow } from './virtual-rows'

afterEach(cleanup)

const baseExtractor = ({
  startIndex,
  endIndex,
  overscan,
  count,
}: Parameters<typeof extractRangeWithSticky>[0]): number[] => {
  const start = Math.max(startIndex - overscan, 0)
  const end = Math.min(endIndex + overscan, count - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function makeRows(count: number, stickyEvery = 0): VirtualRow[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `row-${i}`,
    sticky: stickyEvery > 0 && i % stickyEvery === 0,
    node: <div data-testid={`row-${i}`}>{`row ${i}`}</div>,
  }))
}

describe('sticky range extractor', () => {
  test('the active header is the last sticky index at or before the first visible row', () => {
    expect(activeStickyIndex([0, 10, 20], 14)).toBe(10)
    expect(activeStickyIndex([0, 10, 20], 10)).toBe(10)
    expect(activeStickyIndex([5, 10], 3)).toBeUndefined()
    expect(activeStickyIndex([], 3)).toBeUndefined()
    expect(activeStickyIndex([0], undefined)).toBeUndefined()
  })

  test('a header scrolled past stays in the rendered set, ascending', () => {
    const range = { startIndex: 33, endIndex: 40, overscan: 2, count: 100 }
    const indexes = extractRangeWithSticky(range, [0, 10, 30], baseExtractor)
    expect(indexes[0]).toBe(30)
    expect(indexes).toContain(31)
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
    expect(new Set(indexes).size).toBe(indexes.length)
  })

  test('a header already inside the range is not duplicated', () => {
    const range = { startIndex: 10, endIndex: 20, overscan: 2, count: 100 }
    const indexes = extractRangeWithSticky(range, [10], baseExtractor)
    expect(indexes).toEqual(baseExtractor(range))
  })

  test('no sticky rows leaves the base range untouched', () => {
    const range = { startIndex: 10, endIndex: 20, overscan: 2, count: 100 }
    expect(extractRangeWithSticky(range, [], baseExtractor)).toEqual(baseExtractor(range))
  })
})

// The `.catch()` target is proven through its export, not a mocked `import()`: `lazy` resolves once
// per module instance and `mock.module` cannot unload a peer another test file already loaded.
describe('peer-absent degrade', () => {
  test('every row renders unwindowed, and a sticky header stays position: sticky', () => {
    const { container } = render(
      <NonVirtualizedRows rows={makeRows(40, 10)} height={300} overscan={2} estimateSize={40} />,
    )
    expect(container.querySelectorAll('[data-testid^="row-"]').length).toBe(40)
    const header = container.querySelector('[data-testid="row-10"]')?.parentElement
    expect(header?.style.position).toBe('sticky')
  })

  test('fallbackGap sets the plain path row gap; it defaults to gap', () => {
    const list = (props: { gap?: number; fallbackGap?: number | string }) =>
      render(
        <NonVirtualizedRows
          rows={makeRows(3)}
          height={300}
          overscan={2}
          estimateSize={40}
          {...props}
        />,
      ).container.querySelector<HTMLElement>('[data-testid="row-0"]')?.parentElement
    expect(list({ gap: 8 })?.style.gap).toBe('8px')
    cleanup()
    expect(list({ gap: 8, fallbackGap: 'var(--mantine-spacing-sm)' })?.style.gap).toBe(
      'var(--mantine-spacing-sm)',
    )
  })
})

const VIEWPORT = 400
const ESTIMATE = 40
const OVERSCAN = 2
/** Rows that fit the viewport, plus overscan each side (+1 for a partially visible edge row). */
const MAX_RENDERED = Math.ceil(VIEWPORT / ESTIMATE) + 2 * OVERSCAN + 1

// happy-dom measures every box as 0, which virtual-core reads as "nothing visible".
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

function renderedIndexes(container: HTMLElement): number[] {
  return [...container.querySelectorAll<HTMLElement>('[data-index]')].map((el) =>
    Number(el.dataset['index']),
  )
}

describe("scroll: 'parent'", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      // Only the scrollport has a size; rows stay unmeasured (0 → the guard keeps the estimate).
      get(this: HTMLElement) {
        return this.hasAttribute('data-basalt-scrollport') ? VIEWPORT : 0
      },
    })
  })
  afterEach(() => {
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    }
  })

  function renderInScrollport(rows: VirtualRow[], extra: { gap?: number } = {}) {
    return render(
      // theme-allow raw-scroll-container — the test's own scrollport stands in for AppShell.Main.
      <div data-basalt-scrollport style={{ height: VIEWPORT, overflow: 'auto' }}>
        <VirtualRows
          scroll="parent"
          rows={rows}
          overscan={OVERSCAN}
          estimateSize={ESTIMATE}
          {...extra}
        />
      </div>,
    )
  }

  test('virtualises inside a scrolling ancestor: a bounded window starting at row 0', async () => {
    const { container } = renderInScrollport(makeRows(500))
    await waitFor(() => {
      expect(renderedIndexes(container).length).toBeGreaterThan(0)
    })
    const indexes = renderedIndexes(container)
    expect(indexes.length).toBeLessThanOrEqual(MAX_RENDERED)
    expect(Math.min(...indexes)).toBe(0)
  })

  test('with no scrolling ancestor it virtualises against the window', async () => {
    const { container } = render(
      <VirtualRows
        scroll="parent"
        rows={makeRows(500)}
        overscan={OVERSCAN}
        estimateSize={ESTIMATE}
      />,
    )
    await waitFor(() => {
      expect(renderedIndexes(container).length).toBeGreaterThan(0)
    })
    const indexes = renderedIndexes(container)
    expect(indexes.length).toBeLessThanOrEqual(
      Math.ceil(window.innerHeight / ESTIMATE) + 2 * OVERSCAN + 1,
    )
    expect(Math.min(...indexes)).toBe(0)
  })

  test('the active sticky header is drawn sticky, with no translateY', async () => {
    const { container } = renderInScrollport(makeRows(500, 10))
    await waitFor(() => {
      expect(container.querySelector('[data-index="0"]')).not.toBeNull()
    })
    const header = container.querySelector<HTMLElement>('[data-index="0"]')
    expect(header?.style.position).toBe('sticky')
    expect(header?.style.top).toBe('0px')
    expect(header?.style.transform).toBe('')
    // A non-active row stays absolute and translated.
    expect(container.querySelector<HTMLElement>('[data-index="1"]')?.style.position).toBe(
      'absolute',
    )
  })

  test('gap puts each row start at index * (estimate + gap)', async () => {
    const { container } = renderInScrollport(makeRows(500), { gap: 10 })
    await waitFor(() => {
      expect(container.querySelector('[data-index="3"]')).not.toBeNull()
    })
    expect(container.querySelector<HTMLElement>('[data-index="3"]')?.style.transform).toBe(
      `translateY(${3 * (ESTIMATE + 10)}px)`,
    )
  })
})

describe('isListAtEnd — the list edge, not the whole scrollport', () => {
  const rectOf = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect
  function scroller(top: number, clientHeight: number): HTMLElement {
    const el = document.createElement('div')
    el.getBoundingClientRect = rectOf(top, top + clientHeight)
    Object.defineProperty(el, 'clientHeight', { value: clientHeight })
    return el
  }
  function list(bottom: number): HTMLElement {
    const el = document.createElement('div')
    el.getBoundingClientRect = rectOf(0, bottom)
    return el
  }

  test('true when the list bottom is within the threshold of the visible bottom, trailing content or not', () => {
    // Scrollport 100..500; list ends at 520 (20px below the fold) — 1500px of trailing content
    // below it makes no difference.
    expect(isListAtEnd(list(520), scroller(100, 400), 64)).toBe(true)
    expect(isListAtEnd(list(900), scroller(100, 400), 64)).toBe(false)
  })

  test('a missing list reads as not at end; a null scroller measures the window', () => {
    expect(isListAtEnd(null, scroller(0, 400), 64)).toBe(false)
    expect(isListAtEnd(list(window.innerHeight + 10), null, 64)).toBe(true)
  })
})

/** A minimal fake matching `MeasurementCacheHost`'s structural shape — no ResizeObserver, no
 * layout engine, no `@tanstack/react-virtual` import at all needed to prove the guard branch. */
function fakeMeasurementHost({
  cached,
  estimate = 999,
}: { readonly cached?: number; readonly estimate?: number } = {}) {
  const itemSizeCache = new Map<unknown, number>()
  if (cached !== undefined) itemSizeCache.set('row-key', cached)
  return {
    indexFromElement: () => 0,
    itemSizeCache,
    options: {
      getItemKey: () => 'row-key',
      estimateSize: () => estimate,
    },
  }
}

describe('resolveGuardedMeasurement — a 0 ResizeObserver reading is never a real row measurement', () => {
  const element = document.createElement('div')

  test('a genuine (non-zero) measurement passes through unchanged', () => {
    const host = fakeMeasurementHost({ cached: 40 })
    expect(resolveGuardedMeasurement(host, element, 145)).toBe(145)
  })

  test('a 0 reading with a cached size falls back to the LAST-KNOWN size, not 0 — this is the exact mechanism that stops a collapsed virtualized row from poisoning itemSizeCache', () => {
    const host = fakeMeasurementHost({ cached: 220 })
    expect(resolveGuardedMeasurement(host, element, 0)).toBe(220)
  })

  test('a 0 reading with no prior measurement (first mount) falls back to estimateSize, not 0', () => {
    const host = fakeMeasurementHost({ estimate: 160 })
    expect(resolveGuardedMeasurement(host, element, 0)).toBe(160)
  })
})

describe('resolveInitialScrollAction — the pure decision behind "a virtualized transcript opens at the newest message"', () => {
  test('"start" resolves to skip-done regardless of row count or container height', () => {
    expect(resolveInitialScrollAction('start', 50, 300)).toBe('skip-done')
    expect(resolveInitialScrollAction('start', 0, 0)).toBe('skip-done')
  })

  test('an empty transcript resolves to skip-done even when targeting "end" — nothing to scroll to', () => {
    expect(resolveInitialScrollAction('end', 0, 300)).toBe('skip-done')
  })

  test('a non-positive container height resolves to skip-retry, NOT skip-done — a hidden ancestor must not permanently strand the transcript at the top', () => {
    expect(resolveInitialScrollAction('end', 50, 0)).toBe('skip-retry')
    expect(resolveInitialScrollAction('end', 50, -1)).toBe('skip-retry')
  })

  test('a genuinely measured, non-empty, "end"-targeted mount resolves to scroll', () => {
    expect(resolveInitialScrollAction('end', 50, 300)).toBe('scroll')
  })
})

describe('applyInitialScroll — the ACROSS-CALLS guard that makes the jump fire once, ever', () => {
  // A fake `scrollToEnd` is the boundary here rather than a real DOM `Element.scrollTo` spy on
  // purpose: a real `Virtualizer`'s own `followOnAppend` ALSO calls `scrollTo` on a later append
  // (verified against the installed virtual-core 3.17.1 — `setOptions`'s edge-key-change branch),
  // making that call indistinguishable from this effect's own at the DOM boundary. `applyInitialScroll`
  // is the exact function `VirtualizedRowsInner`'s effect calls, so this proves the real guard, not
  // a hand-mirrored copy of it. `isAtEnd` is likewise a fake rather than a real DOM `scrollTop` read
  // — this describe block proves the STATE MACHINE (fire → verify → settle-or-retry, bounded), not
  // the real browser race the fix exists for, which happy-dom cannot observe (no layout engine —
  // see the `initialScroll` describe block below for what IS provable against the real component).

  test('fires once, stays unsettled until a later call confirms it via isAtEnd, then never fires again', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => true)

    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    // Not yet permanent: firing is not landing. Verification happens on the NEXT call.
    expect(state.hasApplied).toBe(false)

    // Simulates the effect re-running on every later streamed append (rows.length keeps growing)
    // — the exact scenario that must NOT re-trigger the jump once it has settled.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(state.hasApplied).toBe(true)

    applyInitialScroll(state, 'end', 62, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
  })

  test('re-fires when isAtEnd reports the jump was reverted before settling — the clobber-recovery path', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    let atEnd = false
    const isAtEnd = () => atEnd

    // First attempt: fires, unconfirmed.
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)

    // Next commit: the DOM reports NOT at the end (something else clobbered `scrollTop` in the
    // meantime, e.g. virtual-core's own `_willUpdate` anchor branch) — re-fires rather than
    // accepting the reverted position as final.
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
    expect(state.hasApplied).toBe(false)

    // The DOM now holds: settles on the next confirming call.
    atEnd = true
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
    expect(state.hasApplied).toBe(true)

    // A further call must not fire again.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
  })

  test('gives up after MAX_INITIAL_SCROLL_ATTEMPTS rather than retrying forever against a DOM that never confirms', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    // never confirms — the pathological case this bound exists for
    const isAtEnd = mock(() => false)

    for (let i = 0; i < 20; i += 1) {
      applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    }

    expect(state.hasApplied).toBe(true)
    expect(scrollToEnd).toHaveBeenCalledTimes(MAX_INITIAL_SCROLL_ATTEMPTS)

    // Once given up, further calls are true no-ops.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(MAX_INITIAL_SCROLL_ATTEMPTS)
  })

  test('"start" marks done WITHOUT ever calling scrollToEnd — mutation-proof for the skip-done branch not silently becoming skip-retry', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => false)

    applyInitialScroll(state, 'start', 60, () => 300, scrollToEnd, isAtEnd)

    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(isAtEnd).not.toHaveBeenCalled()
    expect(state.hasApplied).toBe(true)
  })

  test('an empty transcript marks done WITHOUT ever calling scrollToEnd', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => false)

    applyInitialScroll(state, 'end', 0, () => 300, scrollToEnd, isAtEnd)

    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(isAtEnd).not.toHaveBeenCalled()
    expect(state.hasApplied).toBe(true)
  })

  test('a hidden (0px) container retries on a later call instead of being permanently stranded, then settles once confirmed', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => true)

    // First attempt: mounted behind a `display: none` ancestor — measures 0.
    applyInitialScroll(state, 'end', 60, () => 0, scrollToEnd, isAtEnd)
    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(state.hasApplied).toBe(false)

    // Second attempt — the row was re-expanded, so the SAME row count now measures. Deliberately
    // NOT a changed count: the commit that un-hides a `ThreadFeedRow` body changes nothing the
    // effect could key a dependency array on, which is why that effect has none. Fires, unconfirmed.
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    expect(state.hasApplied).toBe(false)

    // Third attempt (next commit): confirmed settled.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    expect(state.hasApplied).toBe(true)

    // A fourth attempt must not fire again.
    applyInitialScroll(state, 'end', 62, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
  })

  test('the container-height read happens at most once per mount — verification never touches it, only isAtEnd', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const getContainerHeight = mock(() => 300)
    const isAtEnd = mock(() => true)

    applyInitialScroll(state, 'end', 60, getContainerHeight, scrollToEnd, isAtEnd)
    expect(getContainerHeight).toHaveBeenCalledTimes(1)
    expect(isAtEnd).not.toHaveBeenCalled()

    // Verification call — reads `isAtEnd`, not `getContainerHeight` (no forced `offsetHeight`
    // layout once the row count / container height have already done their one job).
    applyInitialScroll(state, 'end', 61, getContainerHeight, scrollToEnd, isAtEnd)
    expect(getContainerHeight).toHaveBeenCalledTimes(1)
    expect(isAtEnd).toHaveBeenCalledTimes(1)
    expect(state.hasApplied).toBe(true)

    // Every later commit (one per streamed chunk on a live thread) re-runs the dependency-free
    // effect — a settled transcript must touch neither thunk.
    applyInitialScroll(state, 'end', 62, getContainerHeight, scrollToEnd, isAtEnd)
    expect(getContainerHeight).toHaveBeenCalledTimes(1)
    expect(isAtEnd).toHaveBeenCalledTimes(1)
  })
})
