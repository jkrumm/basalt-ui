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
 * `docs/CONTROLS-SPEC.md` §2). Same stubbed-layout idiom as the suite above: widths come
 * from `data-test-width`, fired by hand through the stub `ResizeObserver`. Column header cells
 * carry `data-basalt-fold-id`, read once while visible and cached, so re-measuring a table that
 * has already folded a column never needs it back on screen.
 */
type FoldRow = { a: string; b: string; c: string }
const foldCol = createColumnHelper<FoldRow>()
const FOLD_ROWS: FoldRow[] = [{ a: 'A1', b: 'B1', c: 'C1' }]

/** A fourth column so the enableHiding/pinning exclusion test has two ELIGIBLE fold candidates to
 * work with, rather than the "never fold the last remaining candidate" floor alone deciding it. */
type ExclusionRow = FoldRow & { d: string }
const exclusionCol = createColumnHelper<ExclusionRow>()
const EXCLUSION_ROWS: ExclusionRow[] = [{ a: 'A1', b: 'B1', c: 'C1', d: 'D1' }]

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

describe('column fold — meta.priority (docs/CONTROLS-SPEC.md §2)', () => {
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

  test('expanded rows survive a non-memoized `data` array carrying the same rows', async () => {
    stubLayout()
    const { container, rerender } = render(
      <MantineProvider>
        <BasaltDataTable data={[...FOLD_ROWS]} columns={FOLD_COLUMNS_DEFAULT} />
      </MantineProvider>,
    )
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])

    const toggle = container.querySelector('tbody button[aria-label="Show row details"]')
    if (!(toggle instanceof HTMLElement)) throw new Error('expected the fold toggle button')
    fireEvent.click(toggle)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)

    // A BRAND-NEW array holding the SAME row objects at the SAME indices — the shape an inline
    // `.map()` or an unstable query result hands down on every parent re-render. With no `getRowId`
    // the expanded id IS the array index, so pruning has to ask a narrower question than "is this
    // id still present": is the object AT this index still the same reference as before? Here it
    // is, so the disclosure survives.
    rerender(
      <MantineProvider>
        <BasaltDataTable data={[...FOLD_ROWS]} columns={FOLD_COLUMNS_DEFAULT} />
      </MantineProvider>,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  /**
   * Regression: pruning an index id purely by "is this index still present" (the getRowId-shaped
   * check) is unsafe once there is no `getRowId` — an index trivially survives a page turn or a
   * refetch, so the SAME index would silently keep the OLD disclosure attached to a completely
   * different record now sitting at that position. Only a reference check catches this: a NEW
   * object at the same index means the row identity actually changed, and the expanded state must
   * drop with it.
   */
  test('expanded rows collapse when a refetch seats a DIFFERENT object at the same index', async () => {
    stubLayout()
    const { container, rerender } = render(
      <MantineProvider>
        <BasaltDataTable data={FOLD_ROWS} columns={FOLD_COLUMNS_DEFAULT} />
      </MantineProvider>,
    )
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])

    const toggle = container.querySelector('tbody button[aria-label="Show row details"]')
    if (!(toggle instanceof HTMLElement)) throw new Error('expected the fold toggle button')
    fireEvent.click(toggle)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)

    // A refetch/page-turn: index 0 is still index 0, but the OBJECT behind it is a different
    // record now — a brand-new object, not a shallow copy of the same one.
    rerender(
      <MantineProvider>
        <BasaltDataTable data={[{ a: 'A2', b: 'B2', c: 'C2' }]} columns={FOLD_COLUMNS_DEFAULT} />
      </MantineProvider>,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  /**
   * With `getRowId`, pruning STAYS id-based — a caller-declared identity is exactly what the index
   * lane above has no equivalent of, so a row keeps its expanded disclosure across a re-sort/
   * refetch as long as the SAME id is still present, whatever object or position it now occupies.
   */
  test('with getRowId, expanded rows survive a refetch that reuses the same ids on new objects', async () => {
    stubLayout()
    const getRowId = (row: FoldRow) => row.a
    const { container, rerender } = render(
      <MantineProvider>
        <BasaltDataTable data={FOLD_ROWS} columns={FOLD_COLUMNS_DEFAULT} getRowId={getRowId} />
      </MantineProvider>,
    )
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])

    const toggle = container.querySelector('tbody button[aria-label="Show row details"]')
    if (!(toggle instanceof HTMLElement)) throw new Error('expected the fold toggle button')
    fireEvent.click(toggle)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)

    // A brand-new object, but the SAME id ("A1") — getRowId says this is still the same row.
    rerender(
      <MantineProvider>
        <BasaltDataTable
          data={[{ a: 'A1', b: 'B2', c: 'C2' }]}
          columns={FOLD_COLUMNS_DEFAULT}
          getRowId={getRowId}
        />
      </MantineProvider>,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)

    // A refetch that drops the id entirely collapses it, same as the index lane's "no longer
    // present" case.
    rerender(
      <MantineProvider>
        <BasaltDataTable
          data={[{ a: 'A3', b: 'B3', c: 'C3' }]}
          columns={FOLD_COLUMNS_DEFAULT}
          getRowId={getRowId}
        />
      </MantineProvider>,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  /**
   * `enableHiding: false` and a pinned column are excluded outright from fold candidacy
   * (`useColumnFold`'s `excluded` set) — a caller stating a column must stay visible has no way to
   * override that by folding it anyway, however narrow the wrapper measures.
   */
  test('enableHiding:false and a pinned column never fold — an ordinary eligible column folds first', async () => {
    stubLayout()
    // Four columns so the "never fold the last remaining CANDIDATE" floor (`planColumnFold`) has
    // two eligible columns to work with ('b' and 'd') rather than one — with only one eligible
    // column left, that floor alone would keep it visible and the test would pass whether or not
    // the exclusion itself worked. Here 'd' (declared last among the eligible pair) folds while
    // 'a' (enableHiding:false) and 'c' (pinned) stay up regardless of how little room is measured.
    const exclusionColumns = [
      exclusionCol.accessor('a', { header: 'A', enableHiding: false }),
      exclusionCol.accessor('b', { header: 'B' }),
      exclusionCol.accessor('c', { header: 'C' }),
      exclusionCol.accessor('d', { header: 'D' }),
    ]
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable
          data={EXCLUSION_ROWS}
          columns={exclusionColumns}
          enablePinning
          initialColumnPinning={{ left: ['c'] }}
        />
      </MantineProvider>,
    )
    await resizeFold(container, 1, { a: 50, b: 50, c: 50, d: 50 })
    // 'c' renders FIRST — pinned-left columns render ahead of the center group
    // (`getOrderedHeaderGroups`: left → center → right).
    expect(headerIds(container)).toEqual(['c', 'a', 'b'])
  })

  test('row selection composes with column folding — selection cell, fold toggle, and colSpan all agree', async () => {
    stubLayout()
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable data={FOLD_ROWS} columns={FOLD_COLUMNS_DEFAULT} enableRowSelection />
      </MantineProvider>,
    )
    await resizeFold(container, 100, { a: 50, b: 50, c: 50 })
    expect(headerIds(container)).toEqual(['a'])

    const bodyRow = container.querySelector('tbody tr')
    if (!bodyRow) throw new Error('expected a body row')
    // The fold-toggle cell, the selection checkbox cell, and the one column that stayed visible.
    expect(bodyRow.querySelectorAll('td')).toHaveLength(3)
    expect(bodyRow.querySelector('input[type="checkbox"]')).not.toBeNull()

    const toggle = bodyRow.querySelector('button[aria-label="Show row details"]')
    if (!(toggle instanceof HTMLElement)) throw new Error('expected the fold toggle button')
    fireEvent.click(toggle)

    const disclosure = container.querySelectorAll('tbody tr')[1]
    // colSpan = columns(3) + selection(1) + fold-toggle(1) - folded(2) = 3, the same width a real
    // row renders at above — the count the selection column and the fold toggle both feed.
    expect(disclosure?.querySelector('td')?.getAttribute('colspan')).toBe('3')
    expect(disclosure?.textContent).toContain('B1')
    expect(disclosure?.textContent).toContain('C1')
  })
})

/**
 * `planColumnFold`'s own floor — even a wrapper too narrow for a single data column must not fold
 * every column away: a table with no columns left has no row identifier at all, which is worse
 * than the horizontal scroll this mechanism exists to avoid.
 */
describe('column fold — never folds every data column away', () => {
  type WideFoldRow = { a: string; b: string; c: string; d: string; e: string; f: string }
  const wideFoldCol = createColumnHelper<WideFoldRow>()
  const WIDE_FOLD_ROWS: WideFoldRow[] = [{ a: 'A1', b: 'B1', c: 'C1', d: 'D1', e: 'E1', f: 'F1' }]
  const WIDE_FOLD_COLUMNS = (['a', 'b', 'c', 'd', 'e', 'f'] as const).map((id) =>
    wideFoldCol.accessor(id, { header: id.toUpperCase() }),
  )

  test('6 columns at 120px each in a 100px wrapper still leave the first data column visible', async () => {
    stubLayout()
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable data={WIDE_FOLD_ROWS} columns={WIDE_FOLD_COLUMNS} />
      </MantineProvider>,
    )
    await resizeFold(container, 100, { a: 120, b: 120, c: 120, d: 120, e: 120, f: 120 })
    // Every column's own arithmetic says fold everything (6 x 120 vastly overflows 100px even
    // one at a time) — the guard stops one short, at the declared-first column, 'a'.
    expect(headerIds(container)).toEqual(['a'])
  })
})

function cardsBody(container: HTMLElement): HTMLElement {
  const body = container.querySelector('.cards-body')
  if (!(body instanceof HTMLElement)) throw new Error('expected the body slot')
  return body
}

function cardTexts(container: HTMLElement) {
  return [...container.querySelectorAll('[data-card]')].map((card) => card.textContent)
}

describe('renderCard swaps the body on the TABLE’s own container class, not the viewport', () => {
  function cardsTree(props: Record<string, unknown> = {}) {
    return (
      <MantineProvider>
        <BasaltDataTable
          data={ROWS}
          columns={COLUMNS}
          title="Projects"
          className="cards-root"
          classNames={{ table: 'cards-body' }}
          initialSorting={[{ id: 'cost', desc: false }]}
          renderCard={(row: Row) => <span data-card>{row.project}</span>}
          {...props}
        />
      </MantineProvider>
    )
  }

  function mountCards(props: Record<string, unknown> = {}) {
    return render(cardsTree(props))
  }

  async function rootTo(container: HTMLElement, width: number) {
    const root = container.querySelector('.cards-root')
    if (!(root instanceof HTMLElement)) throw new Error('expected the table root')
    root.dataset['testWidth'] = String(width)
    await act(async () => {
      for (const notify of observers) notify()
    })
  }

  test('unmeasured is the table — the SSR answer and the first paint', () => {
    stubLayout()
    const { container } = mountCards()
    expect(container.querySelector('table')).not.toBeNull()
    expect(cardTexts(container)).toEqual([])
  })

  test('below `regular` it renders the processed rows as cards, and reverts when space returns', async () => {
    stubLayout()
    const { container, getByText } = mountCards()
    await rootTo(container, 479)
    expect(container.querySelector('table')).toBeNull()
    // The table's own sort, not `data` order — a card list cannot disagree with its table.
    expect(cardTexts(container)).toEqual(['linewatch', 'argo'])
    // The header (title · count) stays.
    expect(getByText('Projects')).toBeDefined()

    await rootTo(container, 480)
    expect(container.querySelector('table')).not.toBeNull()
    expect(cardTexts(container)).toEqual([])
  })

  test('a zero width is unknown and moves nothing', async () => {
    stubLayout()
    const { container } = mountCards()
    await rootTo(container, 300)
    await rootTo(container, 0)
    expect(container.querySelector('table')).toBeNull()
  })

  test('onRowActivate activates a card on click and on its own Enter', async () => {
    stubLayout()
    const activated: string[] = []
    const { container } = mountCards({ onRowActivate: (row: Row) => activated.push(row.project) })
    await rootTo(container, 300)
    const cards = [...container.querySelectorAll('[data-activatable]')]
    expect(cards).toHaveLength(2)
    fireEvent.click(cards[0] as Element)
    fireEvent.keyDown(cards[1] as Element, { key: 'Enter' })
    fireEvent.keyDown(cards[1]?.querySelector('[data-card]') as Element, { key: 'Enter' })
    expect(activated).toEqual(['linewatch', 'argo'])
  })

  test('emptyState renders in place of the card list', async () => {
    stubLayout()
    const { container, getByText } = mountCards({ data: [], emptyState: 'Nothing here' })
    await rootTo(container, 300)
    expect(getByText('Nothing here')).toBeDefined()
  })
  test('pending renders skeleton cards inside the card list, not table rows', async () => {
    stubLayout()
    const { container } = mountCards({ isLoading: true, skeletonRows: 3 })
    await rootTo(container, 300)
    expect(container.querySelector('table')).toBeNull()
    expect(cardsBody(container).querySelectorAll('.mantine-Skeleton-root')).toHaveLength(3)
    expect(cardTexts(container)).toEqual([])
  })

  test('a query error renders the ErrorState in the card list', async () => {
    stubLayout()
    const { container, getByText } = mountCards({
      query: {
        data: undefined,
        isError: true,
        error: new Error('upstream exploded'),
        fetchStatus: 'idle',
        refetch: () => undefined,
      },
    })
    await rootTo(container, 300)
    expect(container.querySelector('table')).toBeNull()
    expect(cardsBody(container).contains(getByText('upstream exploded'))).toBe(true)
    expect(cardTexts(container)).toEqual([])
  })

  test('maxHeight caps the card list in a ScrollArea; without it there is none', async () => {
    stubLayout()
    const capped = mountCards({ maxHeight: 200 })
    await rootTo(capped.container, 300)
    expect(cardsBody(capped.container).closest('.mantine-ScrollArea-root')).not.toBeNull()
    capped.unmount()

    const uncapped = mountCards()
    await rootTo(uncapped.container, 300)
    expect(cardsBody(uncapped.container).closest('.mantine-ScrollArea-root')).toBeNull()
  })

  test('selection: no checkbox in cards; the bulk bar keeps a tick made before narrowing', async () => {
    stubLayout()
    const { container, getByText } = mountCards({
      enableRowSelection: true,
      getRowId: (row: Row) => row.project,
      bulkActions: (rows: Row[]) => [{ key: 'x', label: `Archive ${rows.length}` }],
    })
    const argoBox = [...container.querySelectorAll('tbody tr')]
      .find((tr) => tr.textContent?.includes('argo'))
      ?.querySelector('input[type="checkbox"]')
    if (!argoBox) throw new Error('expected the argo row checkbox')
    fireEvent.click(argoBox)
    await rootTo(container, 300)
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(getByText('1 selected')).toBeDefined()
  })

  test('selection: a controlled selection changed while narrow drives the bulk bar', async () => {
    stubLayout()
    const selectionProps = (rowSelection: Record<string, boolean>) => ({
      enableRowSelection: true,
      getRowId: (row: Row) => row.project,
      rowSelection,
      bulkActions: (rows: Row[]) => [{ key: 'x', label: `Archive ${rows.length}` }],
    })
    const { container, getByText, rerender } = mountCards(selectionProps({ argo: true }))
    await rootTo(container, 300)
    expect(getByText('1 selected')).toBeDefined()
    rerender(cardsTree(selectionProps({ argo: true, linewatch: true })))
    expect(container.querySelector('table')).toBeNull()
    expect(getByText('2 selected')).toBeDefined()
  })
})
