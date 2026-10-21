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
import { BasaltDataTable } from './data-table'
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
    const cell = wrapper.querySelector(`[data-basalt-fold-id="${id}"]`)
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
    // toggle(1) select(2) a(3) b(4) … c(5) d(6) folded … actions(8)? No: 7 columns in all.
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
    // toggle (sticky by class), select, a (sticky inline), b (scrolls)
    expect(cells[0]?.dataset['sticky']).toBe('true')
    expect(cells.map((cell) => cell.style.position)).toEqual(['', 'sticky', 'sticky', ''])
    expect(cells[1]?.style.insetInlineStart).toBe('44px')
    expect(cells[2]?.style.insetInlineStart).toBe('88px')
  })

  test('an explicit caller start pin wins — no second, implicit one', async () => {
    stubLayout()
    const { container } = mount({ enablePinning: true, initialColumnPinning: { start: ['c'] } })
    await resize(container, 100, 240, WIDE)
    const sticky = [...container.querySelectorAll('thead th')].filter(
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
