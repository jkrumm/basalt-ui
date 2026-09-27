/**
 * MEASURED CONTAINMENT — `stickyHeader` with neither `maxHeight` nor `minWidth`, the one table
 * shape whose overflow mode is a measurement rather than a declaration
 * (`useMeasuredContainment` in `data-table.tsx`).
 *
 * happy-dom evaluates no layout and ships no `ResizeObserver`, so both are replaced here (the
 * width descriptors are restored in `afterEach`): every element's width is whatever the test wrote
 * to `data-test-width`, and the stub observer's callbacks are fired by hand. That is what lets the
 * FLIP be tested at all rather than only in `tests/layout/data-table.layout.test.ts` — this file
 * owns the decision, that one owns the geometry it produces.
 *
 * The reversion half is the point. `useTrackFits` (`controls/panel-row.tsx`) latches one way on
 * purpose; this hook must not, because the wrapper has to go back to bare when the space returns —
 * the window widened, the sidebar collapsed, the aside closed.
 */
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { resetValidatedProps } from '../common/validate'
import { BasaltDataTable } from './data-table'
import { createColumnHelper } from './table'

type Row = { project: string; cost: number }
const col = createColumnHelper<Row>()

const ROWS: Row[] = [
  { project: 'argo', cost: 12 },
  { project: 'linewatch', cost: 3 },
]

const COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('cost', { header: 'Cost' }),
]

/** The stubbed layout: every element's width is whatever the test wrote to `data-test-width`. */
function widthFromData(this: HTMLElement): number {
  return Number(this.dataset['testWidth'] ?? '0')
}

const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
const nativeResizeObserver = window.ResizeObserver

let observers: (() => void)[] = []

function stubLayout(): void {
  observers = []
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: widthFromData,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: widthFromData,
  })
  class ResizeObserverStub {
    constructor(callback: () => void) {
      observers.push(callback)
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

afterEach(() => {
  if (offsetWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
  }
  if (clientWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
  }
  window.ResizeObserver = nativeResizeObserver
})

function mount(props: Record<string, unknown> = {}) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={COLUMNS} stickyHeader {...props} />
    </MantineProvider>,
  )
}

function wrapperOf(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector('[data-contained]')
  if (!(wrapper instanceof HTMLElement)) {
    throw new Error('expected the measured containment wrapper')
  }
  return wrapper
}

/** Writes both measured widths and fires every stub observer, the way a real resize would. */
async function resizeTo(container: HTMLElement, wrapperWidth: number, tableWidth: number) {
  const wrapper = wrapperOf(container)
  const table = container.querySelector('table')
  if (!(table instanceof HTMLElement)) throw new Error('expected a table')
  wrapper.dataset['testWidth'] = String(wrapperWidth)
  table.dataset['testWidth'] = String(tableWidth)
  await act(async () => {
    for (const notify of observers) notify()
  })
}

describe('the wrapper flips on the measurement, in both directions', () => {
  test('a table wider than its wrapper contains itself, and reverts when the space returns', async () => {
    stubLayout()
    const { container } = mount()
    // Unmeasured is BARE — the SSR-safe default, and the state the first paint renders.
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')

    await resizeTo(container, 390, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')

    // The reversion, and the reason the observer is never latched: a contained table's
    // `offsetWidth` is still its min-content width, so the same comparison keeps answering.
    await resizeTo(container, 1440, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')
  })

  test('equality counts as FITS — the boundary that stops the two states oscillating', async () => {
    stubLayout()
    const { container } = mount()
    await resizeTo(container, 448, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')
    await resizeTo(container, 447, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
  })

  test('a zero-width wrapper is UNKNOWN, not overflow — the un-laid-out ancestor chain', async () => {
    stubLayout()
    const { container } = mount()
    await resizeTo(container, 390, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
    // A `clientWidth` of 0 is evidence the chain has not been laid out (the aside animating its
    // width in from 0), not evidence the table now fits. The state must not move on it.
    await resizeTo(container, 0, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
  })

  test('a capped table never takes the wrapper at all — it has a real scroll container', () => {
    stubLayout()
    const { container } = mount({ maxHeight: 480 })
    expect(container.querySelector('[data-contained]')).toBeNull()
    expect(container.querySelector('.mantine-TableScrollContainer-scrollContainer')).not.toBeNull()
  })
})

describe('pinning takes the same wrapper — there is no third overflow box', () => {
  test('pinned + sticky + uncapped renders no inline overflow-x anywhere', () => {
    stubLayout()
    const { container } = mount({
      enablePinning: true,
      initialColumnPinning: { left: ['project'] },
    })
    // The defect this replaces: an `overflow-x: auto` Box around a page-sticky table is the exact
    // inert-sticky shape the measurement exists to avoid. A pinned column's offsets are
    // `position: sticky` on the cells and need no overflow box of their own.
    for (const element of container.querySelectorAll('[style]')) {
      expect(element.getAttribute('style') ?? '').not.toContain('overflow-x')
    }
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')
  })

  test('a pinned table still contains itself once measured too wide', async () => {
    stubLayout()
    const { container } = mount({
      enablePinning: true,
      initialColumnPinning: { left: ['project'] },
    })
    await resizeTo(container, 390, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
  })
})

describe('the dev warning names the trade, not a defect', () => {
  test('it states that the header sticks while the table fits, and points at maxHeight', () => {
    resetValidatedProps()
    const error = spyOn(console, 'error').mockImplementation(() => {})
    mount()
    expect(error).toHaveBeenCalledTimes(1)
    const message = String(error.mock.calls[0]?.[0])
    expect(message).toContain('"stickyHeader" with neither "maxHeight" nor "minWidth" sticks only')
    expect(message).toContain('FITS its container')
    expect(message).toContain('must both scroll and stick')
    // It no longer claims the shape widens the page — measurement is what stops that.
    expect(message).not.toContain('widens the whole page')
    error.mockRestore()
  })
})

/**
 * COLUMN FOLD — `meta.priority` (`useColumnFold`/`planColumnFold` in `data-table.tsx`,
 * `docs/waves/RESPONSIVE-SPEC.md` §6). Same stubbed-layout idiom as the suite above: widths come
 * from `data-test-width`, fired by hand through the stub `ResizeObserver`. Column header cells
 * carry `data-basalt-fold-id`, read once while visible and cached, so re-measuring a table that
 * has already folded a column never needs it back on screen.
 */
type FoldRow = { a: string; b: string; c: string }
const foldCol = createColumnHelper<FoldRow>()
const FOLD_ROWS: FoldRow[] = [{ a: 'A1', b: 'B1', c: 'C1' }]

const FOLD_COLUMNS_DEFAULT = [
  foldCol.accessor('a', { header: 'A' }),
  foldCol.accessor('b', { header: 'B' }),
  foldCol.accessor('c', { header: 'C' }),
]

const FOLD_COLUMNS_PRIORITY = [
  foldCol.accessor('a', { header: 'A', meta: { priority: 5 } }),
  foldCol.accessor('b', { header: 'B', meta: { priority: 1 } }),
  foldCol.accessor('c', { header: 'C', meta: { priority: 3 } }),
]

function mountFold(props: Record<string, unknown> = {}, columns = FOLD_COLUMNS_DEFAULT) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={FOLD_ROWS} columns={columns} {...props} />
    </MantineProvider>,
  )
}

function foldWrapperOf(container: HTMLElement): HTMLElement {
  const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
  const wrapper = scroller?.parentElement
  if (!(wrapper instanceof HTMLElement)) throw new Error('expected the fold measuring wrapper')
  return wrapper
}

/** Writes the wrapper's room and every named column's header width, then fires every stub
 * observer — a column already folded (removed from the DOM) is simply not found, and keeps
 * whatever width was cached from the last time it was visible. */
async function resizeFold(
  container: HTMLElement,
  wrapperWidth: number,
  columnWidths: Record<string, number>,
) {
  const wrapper = foldWrapperOf(container)
  wrapper.dataset['testWidth'] = String(wrapperWidth)
  for (const [id, width] of Object.entries(columnWidths)) {
    const cell = wrapper.querySelector(`[data-basalt-fold-id="${id}"]`)
    if (cell instanceof HTMLElement) cell.dataset['testWidth'] = String(width)
  }
  await act(async () => {
    for (const notify of observers) notify()
  })
}

function headerIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-basalt-fold-id]')].map(
    (th) => th.getAttribute('data-basalt-fold-id') ?? '',
  )
}

describe('column fold — meta.priority (docs/waves/RESPONSIVE-SPEC.md §6)', () => {
  test('no priority anywhere: declared order folds LAST column first', async () => {
    stubLayout()
    const { container } = mountFold()
    // Nothing measured yet — every column stays, the zero-config default.
    expect(headerIds(container)).toEqual(['a', 'b', 'c'])

    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    // 150 total over a 100 room: 'c' (last declared) folds first, then 'b' — 'a' plus the 44px
    // toggle column (50 + 44 = 94) fits, so it stays a real column.
    expect(headerIds(container)).toEqual(['a'])
    expect(container.querySelector('[data-basalt-fold-id="b"]')).toBeNull()
    expect(container.querySelector('[data-basalt-fold-id="c"]')).toBeNull()
  })

  test('reverts when the space returns — the cache survives the columns being hidden', async () => {
    stubLayout()
    const { container } = mountFold()
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])

    await resizeFold(container, 1000, {})
    expect(headerIds(container)).toEqual(['a', 'b', 'c'])
  })

  test('explicit meta.priority overrides the declared order', async () => {
    stubLayout()
    const { container } = mountFold({}, FOLD_COLUMNS_PRIORITY)
    // priority a=5, c=3, b=1 — 'a' (declared FIRST) folds before 'b' (declared LAST) because its
    // priority number is higher.
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['b'])
    expect(container.querySelector('[data-basalt-fold-id="a"]')).toBeNull()
    expect(container.querySelector('[data-basalt-fold-id="c"]')).toBeNull()
  })

  test('the disclosure toggle reveals exactly the folded columns, as label/value pairs', async () => {
    stubLayout()
    const { container } = mountFold()
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])

    // Folded, so absent from the row's own cells…
    expect(container.querySelector('tbody tr')?.textContent).not.toContain('B1')
    expect(container.querySelector('tbody tr')?.textContent).not.toContain('C1')

    const toggle = container.querySelector('tbody button[aria-label="Show row details"]')
    if (!(toggle instanceof HTMLElement)) throw new Error('expected the fold toggle button')
    fireEvent.click(toggle)

    // …and present, labelled, once the row is expanded.
    const rows = container.querySelectorAll('tbody tr')
    const disclosure = rows[1]
    expect(disclosure?.textContent).toContain('B')
    expect(disclosure?.textContent).toContain('B1')
    expect(disclosure?.textContent).toContain('C')
    expect(disclosure?.textContent).toContain('C1')
    expect(disclosure?.textContent).not.toContain('A1')

    fireEvent.click(toggle)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  test('a table with `minWidth` never folds — the declared horizontal floor wins', async () => {
    stubLayout()
    const { container } = mountFold({ minWidth: 720 })
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a', 'b', 'c'])
  })

  test('a table with only `maxHeight` (no `minWidth`) still folds — the cap is purely vertical', async () => {
    stubLayout()
    const { container } = mountFold({ maxHeight: 480 })
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])
  })
})
