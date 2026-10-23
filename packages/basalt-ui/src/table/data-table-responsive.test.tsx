/**
 * Compact tables (SPEC § 6.6 / § 9.1): the ARIA column positions a fold must keep honest, the
 * pin-and-scroll the floor-folded table falls back to, and the keyboard-reachable scroller.
 *
 * Same stubbed-layout idiom as `data-table-containment.test.tsx` (happy-dom lays nothing out):
 * every element's width is what the test wrote to `data-test-width`. Geometry — the sticky cell's
 * real position and background — is `tests/layout/table-responsive-w42.layout.test.ts`'s.
 */
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltDataTable, planColumnFold } from './data-table'
import { createColumnHelper } from './index'

type Row = { a: string; b: string; c: string; d: string }
const col = createColumnHelper<Row>()
const ROWS: Row[] = [{ a: 'A1', b: 'B1', c: 'C1', d: 'D1' }]
const COLUMNS = (['a', 'b', 'c', 'd'] as const).map((id) =>
  col.accessor(id, { header: id.toUpperCase() }),
)

const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
const nativeResizeObserver = window.ResizeObserver
let observers: (() => void)[] = []

function widthFromData(this: HTMLElement): number {
  return Number(this.dataset['testWidth'] ?? '0')
}

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

function mount(props: Record<string, unknown> = {}, columns = COLUMNS) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={columns} {...props} />
    </MantineProvider>,
  )
}

/** Writes the container's room, the table's width and each header's width, then fires every observer. */
async function resize(
  container: HTMLElement,
  room: number,
  tableWidth: number,
  columnWidths: Record<string, number>,
) {
  const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
  const wrapper = scroller?.parentElement
  const table = container.querySelector('table')
  if (!(wrapper instanceof HTMLElement) || !(table instanceof HTMLElement)) {
    throw new Error('expected the fold wrapper and the table')
  }
  wrapper.dataset['testWidth'] = String(room)
  table.dataset['testWidth'] = String(tableWidth)
  for (const [id, width] of Object.entries(columnWidths)) {
    const cell = wrapper.querySelector(
      `[data-basalt-fold-id="${id}"], [data-basalt-fixed-id="${id}"]`,
    )
    if (cell instanceof HTMLElement) cell.dataset['testWidth'] = String(width)
  }
  await act(async () => {
    for (const notify of observers) notify()
  })
}

const WIDE = { a: 60, b: 60, c: 60, d: 60 }

function colIndexes(row: Element | null): (string | null)[] {
  return [...(row?.querySelectorAll('th, td') ?? [])].map((cell) =>
    cell.getAttribute('aria-colindex'),
  )
}

describe('aria-colcount / aria-colindex', () => {
  test('an unfolded table numbers every column 1..n', () => {
    const { container } = mount()
    expect(container.querySelector('table')?.getAttribute('aria-colcount')).toBe('4')
    expect(colIndexes(container.querySelector('thead tr'))).toEqual(['1', '2', '3', '4'])
    expect(colIndexes(container.querySelector('tbody tr'))).toEqual(['1', '2', '3', '4'])
  })

  test('a fold keeps the full count and leaves a gap the reader can hear', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    // a, b stay (the floor); c, d fold. The toggle column is a real leading cell, so it takes slot 1.
    expect(container.querySelector('table')?.getAttribute('aria-colcount')).toBe('5')
    expect(colIndexes(container.querySelector('thead tr'))).toEqual(['1', '2', '3'])
    expect(colIndexes(container.querySelector('tbody tr'))).toEqual(['1', '2', '3'])
  })

  test('selection + actions columns take their own slots, folded or not', async () => {
    stubLayout()
    const rowActions = [{ key: 'e', label: 'Edit', icon: <i />, onClick: () => undefined }]
    const { container } = mount({ enableRowSelection: true, rowActions })
    expect(container.querySelector('table')?.getAttribute('aria-colcount')).toBe('6')
    expect(colIndexes(container.querySelector('thead tr'))).toEqual(['1', '2', '3', '4', '5', '6'])

    await resize(container, 100, 240, WIDE)
    // toggle(1) select(2) a(3) b(4) · c(5) d(6) folded · actions(7): seven slots in all.
    expect(container.querySelector('table')?.getAttribute('aria-colcount')).toBe('7')
    expect(colIndexes(container.querySelector('thead tr'))).toEqual(['1', '2', '3', '4', '7'])
  })
})

describe('the fold toggle', () => {
  test('is a real button that names what folded and controls its disclosure row', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    const toggle = container.querySelector('tbody button[aria-expanded]')
    if (!(toggle instanceof HTMLElement)) throw new Error('expected the fold toggle')
    expect(toggle.getAttribute('aria-label')).toBe('Show C, D')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-label')).toBe('Hide C, D')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const controlled = container.ownerDocument.getElementById(
      toggle.getAttribute('aria-controls') ?? '',
    )
    expect(controlled).toBe(
      (container.querySelectorAll('tbody tr')[1] as HTMLElement | undefined) ?? null,
    )
    expect(controlled?.textContent).toContain('C1')
    expect(controlled?.textContent).toContain('D1')
  })
})

describe('pin and scroll', () => {
  function firstTh(container: HTMLElement): HTMLElement {
    const th = container.querySelector('thead th[data-basalt-fold-id]')
    if (!(th instanceof HTMLElement)) throw new Error('expected a header cell')
    return th
  }

  test('a floor-folded table that still overflows pins its first column and tab-stops the scroller', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    // Two columns left (120) + the toggle (44) over a 100px room.
    expect(firstTh(container).style.position).toBe('sticky')
    const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
    expect(scroller?.getAttribute('tabindex')).toBe('0')
    expect(scroller?.getAttribute('role')).toBe('region')
    expect(scroller?.getAttribute('aria-label')).toBe('Table, scrolls horizontally')
  })

  test('the scroller names itself from the title', async () => {
    stubLayout()
    const { container } = mount({ title: 'Sessions' })
    await resize(container, 100, 240, WIDE)
    const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
    expect(scroller?.getAttribute('aria-label')).toBe('Sessions, scrolls horizontally')
  })

  test('a table that fits pins nothing and is no tab stop', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 400, 240, WIDE)
    expect(firstTh(container).style.position).toBe('')
    const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
    expect(scroller?.getAttribute('tabindex')).toBeNull()
    expect(scroller?.getAttribute('role')).toBeNull()
  })

  test('unpins when the room returns', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    expect(firstTh(container).style.position).toBe('sticky')
    await resize(container, 400, 240, {})
    expect(firstTh(container).style.position).toBe('')
  })

  test('the pinned column honours columnDef.minSize', async () => {
    stubLayout()
    const columns = [col.accessor('a', { header: 'A', minSize: 200 }), ...COLUMNS.slice(1)]
    const { container } = mount({}, columns)
    await resize(container, 100, 240, WIDE)
    expect(firstTh(container).style.minWidth).toBe('200px')
  })

  test('the pinned data cell carries its full text in `title`', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    expect(container.querySelector('tbody td[title]')?.getAttribute('title')).toBe('A1')
  })

  test('checkbox column pins ahead of the identifier and the toggle leads both', async () => {
    stubLayout()
    const { container } = mount({ enableRowSelection: true })
    await resize(container, 100, 300, WIDE)
    const cells = [...container.querySelectorAll('tbody tr:first-child td')] as HTMLElement[]
    // toggle, select and a stick through the same helper; b scrolls
    expect(cells.map((cell) => cell.style.position)).toEqual(['sticky', 'sticky', 'sticky', ''])
    expect(cells[0]?.style.insetInlineStart).toBe('0')
    expect(cells[1]?.style.insetInlineStart).toBe('44px')
    expect(cells[2]?.style.insetInlineStart).toBe('88px')
  })

  test('an explicit caller start pin wins — no second, implicit one', async () => {
    stubLayout()
    const { container } = mount({ enablePinning: true, initialColumnPinning: { start: ['c'] } })
    await resize(container, 100, 240, WIDE)
    const sticky = [...container.querySelectorAll('thead th[data-basalt-fold-id]')].filter(
      (th) => (th as HTMLElement).style.position === 'sticky',
    )
    expect(sticky.map((th) => th.textContent)).toEqual(['C'])
  })
})

describe('the walking-pad shape does not regress', () => {
  test('enablePinning + a start pin + maxHeight + all-priority columns', async () => {
    stubLayout()
    type PadRow = { started_at: string; x: string; y: string; z: string }
    const pad = createColumnHelper<PadRow>()
    const columns = [
      pad.accessor('started_at', { header: 'Started' }),
      pad.accessor('x', { header: 'X', meta: { priority: 1 } }),
      pad.accessor('y', { header: 'Y', meta: { priority: 2 } }),
      pad.accessor('z', { header: 'Z', meta: { priority: 3 } }),
    ]
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable
          data={[{ started_at: 'S1', x: 'X1', y: 'Y1', z: 'Z1' }]}
          columns={columns}
          enablePinning
          initialColumnPinning={{ start: ['started_at'] }}
          maxHeight={400}
        />
      </MantineProvider>,
    )
    await resize(container, 100, 240, { started_at: 60, x: 60, y: 60, z: 60 })
    const headers = [...container.querySelectorAll('thead th[data-basalt-fold-id]')]
    expect(headers.map((th) => th.getAttribute('data-basalt-fold-id'))).toEqual(['started_at', 'x'])
    const sticky = headers.filter((th) => (th as HTMLElement).style.position === 'sticky')
    expect(sticky.map((th) => th.textContent)).toEqual(['Started'])
  })
})

describe('the fold plan counts every column that takes room', () => {
  test('the checkbox column is overhead: 3 x 50px + selection in a 150px wrapper folds and pins', async () => {
    stubLayout()
    const { container } = mount({ enableRowSelection: true }, COLUMNS.slice(0, 3))
    await resize(container, 150, 244, { a: 50, b: 50, c: 50, __basalt_select__: 44 })
    const ids = [...container.querySelectorAll('thead th[data-basalt-fold-id]')].map((th) =>
      th.getAttribute('data-basalt-fold-id'),
    )
    expect(ids).toEqual(['a', 'b'])
    const sticky = [...container.querySelectorAll('thead th')].filter(
      (th) => (th as HTMLElement).style.position === 'sticky',
    )
    // toggle, checkbox and the identifier
    expect(sticky).toHaveLength(3)
  })

  test('without the checkbox the same three columns fit and nothing folds', async () => {
    stubLayout()
    const { container } = mount({}, COLUMNS.slice(0, 3))
    await resize(container, 150, 150, { a: 50, b: 50, c: 50 })
    expect(container.querySelectorAll('thead th[data-basalt-fold-id]')).toHaveLength(3)
  })

  test('the actions column is overhead too', async () => {
    stubLayout()
    const rowActions = [{ key: 'e', label: 'Edit', icon: <i />, onClick: () => undefined }]
    const { container } = mount({ rowActions }, COLUMNS.slice(0, 3))
    await resize(container, 150, 206, { a: 50, b: 50, c: 50, __basalt_actions__: 56 })
    expect(container.querySelectorAll('thead th[data-basalt-fold-id]')).toHaveLength(2)
  })
})

describe('auto-pin candidates and boundaries', () => {
  test('a caller END pin is never also the start pin', async () => {
    stubLayout()
    const { container } = mount({ enablePinning: true, initialColumnPinning: { end: ['a'] } })
    await resize(container, 100, 240, WIDE)
    const byId = (id: string) =>
      container.querySelector(`thead th[data-basalt-fold-id="${id}"]`) as HTMLElement
    expect(byId('b').style.insetInlineStart).not.toBe('')
    expect(byId('a').style.insetInlineStart).toBe('')
    expect(byId('a').style.insetInlineEnd).not.toBe('')
  })

  test('a two-column table that overflows pins its first column', async () => {
    stubLayout()
    const { container } = mount({}, COLUMNS.slice(0, 2))
    await resize(container, 100, 200, { a: 100, b: 100 })
    expect(container.querySelectorAll('thead th[data-basalt-fold-id]')).toHaveLength(2)
    const first = container.querySelector('thead th[data-basalt-fold-id="a"]') as HTMLElement
    expect(first.style.position).toBe('sticky')
  })

  test('a one-column table neither folds nor pins', async () => {
    stubLayout()
    const { container } = mount({}, COLUMNS.slice(0, 1))
    await resize(container, 100, 300, { a: 300 })
    const only = container.querySelector('thead th[data-basalt-fold-id="a"]') as HTMLElement
    expect(only.style.position).toBe('')
    expect(container.querySelector('tbody button[aria-expanded]')).toBeNull()
  })

  test('measuring a pinned table again (a capped painted width) keeps the fold and the pin', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    const first = () => container.querySelector('thead th[data-basalt-fold-id]') as HTMLElement
    expect(first().style.position).toBe('sticky')
    // The pinned cell now paints at its cap; the table is narrower, but the NATURAL width is cached.
    await resize(container, 100, 160, { a: 30 })
    await resize(container, 100, 160, { a: 30 })
    expect(first().style.position).toBe('sticky')
    expect(container.querySelectorAll('thead th[data-basalt-fold-id]')).toHaveLength(2)
  })
})

describe('planColumnFold floor', () => {
  const widths = new Map([
    ['a', 100],
    ['b', 100],
    ['c', 100],
  ])
  const base = { room: 10, toggleWidth: 0, overhead: 0, widths }

  test('two candidates and nothing fixed: the floor of two holds', () => {
    expect(planColumnFold({ ...base, order: ['b', 'a'] }).size).toBe(0)
  })

  test('one fixed data column leaves room for exactly one candidate', () => {
    expect(planColumnFold({ ...base, overhead: 100, fixedCount: 1, order: ['c', 'b'] }).size).toBe(
      1,
    )
  })

  test('two fixed data columns already are the floor: every candidate folds', () => {
    expect(planColumnFold({ ...base, overhead: 200, fixedCount: 2, order: ['c', 'b'] }).size).toBe(
      2,
    )
  })

  test('a one-column table keeps its one', () => {
    expect(planColumnFold({ ...base, order: ['a'] }).size).toBe(0)
  })

  test('the checkbox and actions overhead never count toward the floor', () => {
    expect(
      planColumnFold({ ...base, overhead: 100, extraCount: 2, order: ['c', 'b', 'a'] }).size,
    ).toBe(1)
  })
})

describe('loading, empty and error keep the loaded fold', () => {
  test('a folded table in loading renders the same visible columns as loaded', async () => {
    stubLayout()
    const loaded = mount()
    await resize(loaded.container, 100, 240, WIDE)
    const loadedIds = [...loaded.container.querySelectorAll('thead th[data-basalt-fold-id]')].map(
      (th) => th.getAttribute('data-basalt-fold-id'),
    )
    loaded.unmount()

    const { container, rerender } = mount()
    await resize(container, 100, 240, WIDE)
    rerender(
      <MantineProvider>
        <BasaltDataTable data={[]} columns={COLUMNS} isLoading />
      </MantineProvider>,
    )
    // The headers are re-measured at their (narrow) header-only widths: the fold must not unfold.
    await resize(container, 100, 120, { a: 10, b: 10, c: 10, d: 10 })
    const ids = [...container.querySelectorAll('thead th[data-basalt-fold-id]')].map((th) =>
      th.getAttribute('data-basalt-fold-id'),
    )
    expect(ids).toEqual(loadedIds)
    // Skeleton rows mirror the head: toggle + the two kept columns.
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(ids.length + 1)
    // The toggle cell draws the chevron as a block, so loaded and loading share their anatomy.
    expect(
      container.querySelector('tbody tr:first-child td:first-child .mantine-Skeleton-root'),
    ).not.toBeNull()
  })
})

describe('the fold toggle says what folded', () => {
  type MixedRow = { a: string; b: string; c: string; d: string }
  const mixed = createColumnHelper<MixedRow>()
  const MIXED = [
    mixed.accessor('a', { header: 'A' }),
    mixed.accessor('b', { header: 'B' }),
    mixed.accessor('c', { header: () => 'C as a node' }),
    mixed.accessor('d', { header: '' }),
  ]

  test('a non-string or empty header falls back to the column id', async () => {
    stubLayout()
    const { container } = mount({}, MIXED)
    await resize(container, 100, 240, WIDE)
    const toggle = container.querySelector('tbody button[aria-expanded]')
    expect(toggle?.getAttribute('aria-label')).toBe('Show c, d')
  })

  test('the header above the toggles counts the folded columns and names them', async () => {
    stubLayout()
    const { container } = mount()
    await resize(container, 100, 240, WIDE)
    const hint = container.querySelector('thead th [title]')
    expect(hint?.getAttribute('title')).toBe('2 more columns: C, D')
    expect(hint?.getAttribute('aria-hidden')).toBe('true')
    expect(hint?.textContent).toBe('+2 cols')
    expect(hint?.nextElementSibling?.textContent).toBe('2 more columns: C, D')
  })
})

describe('a filter that matches nothing does not unfold the table', () => {
  test('the fold stays stable through a no-match search and back', async () => {
    stubLayout()
    const { container } = mount({ enableGlobalFilter: true })
    const ids = () =>
      [...container.querySelectorAll('thead th[data-basalt-fold-id]')].map((th) =>
        th.getAttribute('data-basalt-fold-id'),
      )
    await resize(container, 100, 240, WIDE)
    expect(ids()).toEqual(['a', 'b'])

    const search = container.querySelector('input') as HTMLInputElement
    const settle = () => act(async () => void (await new Promise((done) => setTimeout(done, 320))))
    fireEvent.change(search, { target: { value: 'no such row' } })
    await settle()
    expect(container.querySelector('tbody td[colspan]')).not.toBeNull()
    // The empty body measures header-only (narrow) widths; the loaded fold must hold.
    await resize(container, 100, 120, { a: 10, b: 10, c: 10, d: 10 })
    expect(ids()).toEqual(['a', 'b'])

    fireEvent.change(search, { target: { value: '' } })
    await settle()
    await resize(container, 100, 240, WIDE)
    expect(ids()).toEqual(['a', 'b'])
  })
})
