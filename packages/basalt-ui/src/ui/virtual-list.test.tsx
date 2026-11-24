import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { VirtualList, virtualListParts } from './virtual-list'

const ROW = 20
const VIEWPORT = 200

// happy-dom measures every box as 0, which virtual-core reads as "nothing visible".
// virtual-core reads offsetHeight up to 3.19.5 and clientHeight from 3.19.6 on.
const sizeProps = ['offsetHeight', 'clientHeight'] as const
const originals = sizeProps.map(
  (p) => [p, Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)] as const,
)
beforeEach(() => {
  for (const p of sizeProps) {
    Object.defineProperty(HTMLElement.prototype, p, {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset['slot'] === 'virtual-list' ? VIEWPORT : 0
      },
    })
  }
})
afterEach(() => {
  cleanup()
  for (const [p, original] of originals) {
    if (original) Object.defineProperty(HTMLElement.prototype, p, original)
    else Reflect.deleteProperty(HTMLElement.prototype, p)
  }
})

type Item = { id: string }
const make = (n: number, from = 0): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }))

function List(props: { rows: Item[]; keep?: string; spacer?: 'div' | 'tr' }): React.ReactElement {
  const { rows, keep, spacer } = props
  const keepIndex = keep === undefined ? undefined : rows.findIndex((r) => r.id === keep)
  return (
    <VirtualList
      count={rows.length}
      estimateSize={() => ROW}
      getItemKey={(i) => rows[i]!.id}
      keepIndex={keepIndex}
      spacer={spacer}
      overscan={2}
      data-testid="list"
    >
      {([item]) =>
        spacer === 'tr' ? (
          <tr data-row={rows[item!.index]!.id}>
            <td>{rows[item!.index]!.id}</td>
          </tr>
        ) : (
          <button type="button" data-row={rows[item!.index]!.id}>
            {rows[item!.index]!.id}
          </button>
        )
      }
    </VirtualList>
  )
}

const rendered = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-row]')].map((el) => el.getAttribute('data-row') ?? '')

describe('virtual-list module', () => {
  test('carries its data-slot and renders with no provider', () => {
    const { container } = render(<List rows={make(3)} />)
    const slots = [...container.querySelectorAll('[data-slot]')].map((e) =>
      e.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...virtualListParts])
  })

  test('10k rows mount fewer than 60 row nodes and the spacers carry the rest', () => {
    const { container } = render(<List rows={make(10_000)} />)
    const nodes = rendered(container)
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.length).toBeLessThan(60)
    expect(nodes[0]).toBe('r0')
    const end = container.querySelector<HTMLElement>('div[aria-hidden="true"]')!
    expect(Number.parseFloat(end.style.height)).toBe(10_000 * ROW - nodes.length * ROW)
  })

  test('prepending 100 rows keeps the focused row mounted, keyed by id', () => {
    const rows = make(50, 100)
    const { container, rerender } = render(<List rows={rows} keep="r105" />)
    const before = container.querySelector<HTMLElement>('[data-row="r105"]')!
    before.focus()
    expect(document.activeElement).toBe(before)
    rerender(<List rows={[...make(100), ...rows]} keep="r105" />)
    const after = container.querySelector<HTMLElement>('[data-row="r105"]')!
    expect(after).toBe(before)
    expect(document.activeElement).toBe(before)
  })

  test('keepIndex holds a row rendered far outside the window, between two spacers', () => {
    const { container } = render(<List rows={make(1000)} keep="r500" />)
    const nodes = rendered(container)
    expect(nodes).toContain('r500')
    expect(nodes.length).toBeLessThan(60)
    const kids = [...container.querySelector('[data-slot="virtual-list"]')!.children]
    const at = kids.findIndex((k) => k.getAttribute('data-row') === 'r500')
    expect(kids[at - 1]!.getAttribute('aria-hidden')).toBe('true')
    expect(kids[at + 1]!.getAttribute('aria-hidden')).toBe('true')
  })

  test('keepIndex takes several rows: each stays rendered, in order, between spacers', () => {
    const rows = make(1000)
    const { container } = render(
      <VirtualList
        count={rows.length}
        estimateSize={() => ROW}
        getItemKey={(i) => rows[i]!.id}
        keepIndex={[700, 300]}
        overscan={2}
      >
        {([item]) => <span data-row={rows[item!.index]!.id}>{rows[item!.index]!.id}</span>}
      </VirtualList>,
    )
    const nodes = rendered(container)
    expect(nodes.indexOf('r300')).toBeGreaterThan(-1)
    expect(nodes.indexOf('r700')).toBeGreaterThan(nodes.indexOf('r300'))
    expect(nodes.length).toBeLessThan(60)
  })

  test('revealIndex scrolls its row into view when it changes', async () => {
    // virtual-core clamps a scroll to scrollHeight - clientHeight, which happy-dom reports as 0.
    const lengths = { clientHeight: VIEWPORT, scrollHeight: 1000 * ROW }
    const originals = Object.keys(lengths).map(
      (prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)] as const,
    )
    for (const [prop, px] of Object.entries(lengths)) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset['slot'] === 'virtual-list' ? px : 0
        },
      })
    }
    const rows = make(1000)
    const view = (reveal?: number): React.ReactElement => (
      <VirtualList
        count={rows.length}
        estimateSize={() => ROW}
        getItemKey={(i) => rows[i]!.id}
        revealIndex={reveal}
      >
        {([item]) => <div data-row={rows[item!.index]!.id}>{rows[item!.index]!.id}</div>}
      </VirtualList>
    )
    const { container, rerender } = render(view())
    const scroller = container.querySelector('[data-slot="virtual-list"]') as HTMLElement
    expect(scroller.scrollTop).toBe(0)
    await act(async () => rerender(view(100)))
    // Aligned to the nearest edge: the row's bottom meets the viewport's.
    expect(scroller.scrollTop).toBe(101 * ROW - VIEWPORT)
    for (const [prop, descriptor] of originals) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop]
    }
  })

  test('spacer="tr" renders a table with real rows and tr spacers', () => {
    const { container } = render(<List rows={make(500)} spacer="tr" />)
    expect(container.querySelectorAll('tbody > tr[data-row]').length).toBeGreaterThan(0)
    const gap = container.querySelector('tbody > tr[aria-hidden="true"]')
    expect(gap).not.toBeNull()
    expect(gap!.querySelector('td')).not.toBeNull()
    expect(container.querySelector('[data-slot="virtual-list"] > div[aria-hidden]')).toBeNull()
  })

  test('tableProps and bodyProps render as markup on the table and tbody, server render included', () => {
    const node = (
      <VirtualList
        count={50}
        estimateSize={() => ROW}
        getItemKey={(i) => i}
        spacer="tr"
        tableProps={{
          'data-slot': 'table',
          role: 'table',
          'aria-rowcount': 51,
          'aria-busy': true,
          className: 'table-fixed',
        }}
        bodyProps={{ 'data-slot': 'table-body', role: 'rowgroup' }}
      >
        {([item]) => (
          <tr>
            <td>{item!.index}</td>
          </tr>
        )}
      </VirtualList>
    )
    const { container } = render(node)
    const table = container.querySelector('table')
    expect(table?.getAttribute('role')).toBe('table')
    expect(table?.getAttribute('aria-rowcount')).toBe('51')
    expect(table?.getAttribute('aria-busy')).toBe('true')
    expect(table?.getAttribute('data-slot')).toBe('table')
    expect(table?.className).toBe('w-full table-fixed')
    expect(container.querySelector('tbody')?.getAttribute('role')).toBe('rowgroup')
    expect(container.querySelector('tbody')?.getAttribute('data-slot')).toBe('table-body')

    const html = renderToString(node)
    expect(html).toContain('<table data-slot="table" role="table" aria-rowcount="51"')
    expect(html).toContain('<tbody data-slot="table-body" role="rowgroup">')
  })

  test('without tableProps the table keeps only its w-full class', () => {
    const { container } = render(<List rows={make(5)} spacer="tr" />)
    const table = container.querySelector('table')
    expect(table?.className).toBe('w-full')
    expect(table?.getAttributeNames()).toEqual(['class'])
  })

  test('server render keeps the slot and draws the first window for the initial height', () => {
    const html = renderToString(<List rows={make(100)} />)
    expect(html).toContain('data-slot="virtual-list"')
    expect(html).toContain('data-row="r0"')
    // 640 px default over 20 px rows is 32 rows, 2 more of overscan, the rest one spacer
    expect(html.match(/data-row=/g)).toHaveLength(34)
    expect(html).toContain('height:1320px')
  })

  test('initialHeight sets how many rows the server renders before the list is measured', () => {
    const html = renderToString(
      <VirtualList
        count={100}
        estimateSize={() => ROW}
        getItemKey={(i) => i}
        initialHeight={100}
        overscan={0}
      >
        {([item]) => <i data-row={item!.index} />}
      </VirtualList>,
    )
    expect(html.match(/data-row=/g)).toHaveLength(5)
  })

  test('only ui/virtual-list imports @tanstack/react-virtual', () => {
    const offenders = readdirSync(import.meta.dirname)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'virtual-list.tsx')
      .filter((f) => readFileSync(join(import.meta.dirname, f), 'utf8').includes('react-virtual'))
    expect(offenders).toEqual([])
  })
})
