/**
 * `VirtualRows` under happy-dom: the sticky range extractor, the peer-absent degrade, the
 * `scroll: 'parent'` windowing. happy-dom has no layout engine, so real geometry (a header that
 * stays on screen after a 2000 px scroll, a prepend that holds the first visible row still) lives
 * in `tests/layout/virtual-rows.layout.test.ts`.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import {
  activeStickyIndex,
  extractRangeWithSticky,
  NonVirtualizedRows,
  VirtualRows,
} from './virtual-rows'
import type { VirtualRow } from './virtual-rows'

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
})

describe("scroll: 'parent'", () => {
  afterAll(() => {
    document.body.innerHTML = ''
  })

  test('virtualises inside a scrolling ancestor: fewer rows rendered than supplied', async () => {
    // happy-dom measures every box as 0, which virtual-core reads as "nothing visible".
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 400,
    })
    const { container } = render(
      // theme-allow raw-scroll-container — the test's own scrollport stands in for AppShell.Main.
      <div data-basalt-scrollport style={{ height: 400, overflow: 'auto' }}>
        <VirtualRows scroll="parent" rows={makeRows(500)} overscan={2} estimateSize={40} />
      </div>,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid^="row-"]').length).toBeGreaterThan(0)
    })
    expect(container.querySelectorAll('[data-testid^="row-"]').length).toBeLessThan(500)
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
  })

  test('with no scrolling ancestor it virtualises against the window', async () => {
    const { container } = render(
      <VirtualRows scroll="parent" rows={makeRows(500)} overscan={2} estimateSize={40} />,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid^="row-"]').length).toBeGreaterThan(0)
    })
    expect(container.querySelectorAll('[data-testid^="row-"]').length).toBeLessThan(500)
  })
})
