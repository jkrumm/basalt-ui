/**
 * The virtual body (docs/v3/issues/g3/v3-table-t4-virtual.json) with the real `VirtualList` as the
 * port, in jsdom: a 10k table mounts a window, not the rows; the table carries the row count and
 * each mounted row its index; items are keyed by row id; the roving stop is the kept index; a new
 * request scrolls to the first row. Geometry (header offset, focus across a sort) is the layout
 * test's, in Chrome.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { VirtualLike } from '../../core/ports'
import { VirtualList } from '../../ui/virtual-list'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { DataTable } from './data-table'
import { useDataTable } from '../use-data-table'

type Row = { id: string; name: string; team: string; amount: number }

const TEAMS = ['Eng', 'Ops', 'Sales'] as const
const ROWS: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${String(i).padStart(5, '0')}`,
  team: TEAMS[i % 3] ?? 'Eng',
  amount: i,
}))

type Seen = { keys: (string | number)[]; keep: (number | undefined)[]; counts: number[] }

/** The real port, recording what the table asks of it. */
function spyPort(seen: Seen): VirtualLike {
  return (props) => {
    seen.counts.push(props.count)
    seen.keep.push(props.keepIndex)
    seen.keys = [0, 1, 2].map((i) => props.getItemKey(i))
    return <VirtualList {...(props as Parameters<typeof VirtualList>[0])} />
  }
}

function Subject({
  virtual,
  options = {},
}: {
  virtual: VirtualLike
  options?: Partial<UseDataTable<Row>>
}): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: `v-${options.label ?? 'x'}`,
    label: 'Ledger',
    columns: [c.entity('name'), c.text('team'), c.number('amount')],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
    ...options,
  } as UseDataTable<Row>)
  return <DataTable table={t} height="fill" virtual={virtual} />
}

const newSeen = (): Seen => ({ keys: [], keep: [], counts: [] })
const bodyRows = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('tbody tr[role="row"]'),
]

// happy-dom measures every box as 0, which virtual-core reads as "nothing visible": give the port
// a 600 px viewport (15 rows of the 40 px fallback row).
const VIEWPORT = 600
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset['slot'] === 'virtual-list' ? VIEWPORT : 0
    },
  })
})
afterEach(() => {
  cleanup()
  if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
  else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
})

describe('virtual body', () => {
  test('server render already carries the table attributes, no effect needed', () => {
    const html = renderToString(<Subject virtual={VirtualList} />)
    expect(html).toContain('role="table"')
    expect(html).toContain('aria-rowcount="10001"')
    expect(html).toContain('aria-colcount="3"')
    expect(html).toContain('data-slot="table-body"')
    expect(html).toContain('role="rowgroup"')
    expect(html).toMatch(/<tr[^>]*aria-rowindex="1"/)
  })

  test('10k rows mount a window under 100 rows; aria-rowcount is every row', () => {
    const { container } = render(<Subject virtual={VirtualList} />)
    const mounted = bodyRows(container)
    expect(mounted.length).toBeGreaterThan(0)
    expect(mounted.length).toBeLessThan(100)
    const tableEl = container.querySelector('table')
    expect(tableEl?.getAttribute('aria-rowcount')).toBe('10001')
    expect(tableEl?.getAttribute('role')).toBe('table')
    expect(tableEl?.getAttribute('data-slot')).toBe('table')
    expect(tableEl?.className).toContain('table-fixed')
    expect(tableEl?.getAttribute('aria-colcount')).toBe('3')
    expect(container.querySelector('tbody')?.getAttribute('data-slot')).toBe('table-body')
    expect(container.querySelector('thead tr')?.getAttribute('aria-rowindex')).toBe('1')
    expect(mounted[0]?.getAttribute('aria-rowindex')).toBe('2')
    expect(mounted[0]?.textContent).toContain('Row 00000')
  })

  test('the port scrolls, holds the head and the caption, and is the named region', () => {
    const { container } = render(<Subject virtual={VirtualList} />)
    const port = container.querySelector('[data-slot="virtual-list"]')
    expect(port?.getAttribute('role')).toBe('region')
    expect(port?.getAttribute('aria-label')).toBe('Ledger')
    expect(port?.querySelector('thead')).not.toBeNull()
    expect(port?.querySelector('caption')?.textContent).toBe('Ledger')
    // The tier container stays the table scroller around it.
    expect(port?.closest('[data-slot="table-scroller"]')).not.toBeNull()
  })

  test('items are keyed by row id, in the request order', async () => {
    const seen = newSeen()
    const { getByRole } = render(<Subject virtual={spyPort(seen)} />)
    expect(seen.keys).toEqual(['r0', 'r1', 'r2'])
    expect(seen.counts.at(-1)).toBe(10_000)
    // Sort descending by amount: the keys follow the rows, not the indexes.
    const sort = getByRole('button', { name: /^Amount$/ })
    await act(async () => {
      fireEvent.click(sort)
    })
    await act(async () => {
      fireEvent.click(sort)
    })
    expect(seen.keys).toEqual(['r9999', 'r9998', 'r9997'])
  })

  test('the roving stop is the kept index', async () => {
    const seen = newSeen()
    const { container } = render(<Subject virtual={spyPort(seen)} />)
    expect(seen.keep.at(-1)).toBe(0)
    const stop = container.querySelector<HTMLElement>('tbody tr[tabindex="0"]')
    if (stop === null) throw new Error('no stop')
    await act(async () => {
      fireEvent.keyDown(stop, { key: 'End' })
    })
    expect(seen.keep.at(-1)).toBe(9_999)
  })

  test('a request change scrolls back to the first row; a display change does not', async () => {
    const { container, getByRole } = render(<Subject virtual={VirtualList} />)
    const port = container.querySelector<HTMLElement>('[data-slot="virtual-list"]')
    if (port === null) throw new Error('no port')
    port.scrollTop = 4_000
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^Name$/ }))
    })
    expect(port.scrollTop).toBe(0)
  })

  test('a footer row counts in aria-rowcount', () => {
    function WithFooter(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'v-footer',
        label: 'Ledger',
        columns: [c.entity('name'), c.number('amount', { footer: 'sum' })],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
      })
      return <DataTable table={t} height={{ maxRows: 12 }} virtual={VirtualList} />
    }
    const { container } = render(<WithFooter />)
    expect(container.querySelector('table')?.getAttribute('aria-rowcount')).toBe('10002')
    expect(container.querySelector('tfoot dd')?.textContent).toBe('49,995,000')
    // The foot sits before the body in the DOM; its index says it is the last row.
    expect(container.querySelector('tfoot tr')?.getAttribute('aria-rowindex')).toBe('10002')
  })

  test('group rows are items of the window with their own row index', () => {
    const seen = newSeen()
    const { container } = render(
      <Subject virtual={spyPort(seen)} options={{ label: 'grouped', group: { by: 'team' } }} />,
    )
    expect(seen.counts.at(-1)).toBe(10_003)
    expect(seen.keys[0]).toBe('group:Eng')
    const first = container.querySelector('tbody tr[data-group]')
    expect(first?.getAttribute('aria-rowindex')).toBe('2')
    expect(container.querySelector('table')?.getAttribute('aria-rowcount')).toBe('10004')
  })

  test('a windowed table never projects to cards and its cells hold one line', () => {
    const { container } = render(<Subject virtual={VirtualList} />)
    const root = container.querySelector('[data-slot="table-root"]')
    expect(root?.getAttribute('data-phone')).toBe('scroll')
    expect(root?.className).toContain('[&_[data-slot=table-cell]]:whitespace-nowrap')
  })

  test('a loading table draws the plain body, not the window', () => {
    const { container } = render(<Subject virtual={VirtualList} options={{ data: undefined }} />)
    expect(container.querySelector('[data-slot="virtual-list"]')).toBeNull()
    expect(container.querySelector('[data-slot="table-root"]')?.getAttribute('data-phase')).toBe(
      'loading',
    )
  })
})
