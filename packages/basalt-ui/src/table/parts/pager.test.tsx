/**
 * `TablePager` and the tier attributes: what jsdom can hold. Server HTML equals the hydrated tree at
 * each tier (the tier is chosen by CSS from attributes in the markup, so SSR is the table at every
 * width), the pager keeps the current size, and a card is not a second tree.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { DataTable } from './data-table'
import { pageSizeOptions } from './pager'
import { useDataTable } from '../use-data-table'

type Row = { id: string; name: string; qty: number }
const ROWS: Row[] = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, qty: i }))

function Subject(options: Partial<UseDataTable<Row>>): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'p',
    label: 'Rows',
    columns: [c.entity('name'), c.number('qty', { priority: 3 })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...options,
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

/** Generated ids differ after mount: compare markup, not ids. */
const withoutIds = (markup: string): string =>
  markup.replaceAll(/ (id|for|aria-labelledby|aria-controls|aria-describedby)="[^"]*"/g, '')

afterEach(cleanup)

describe('tier attributes', () => {
  const tiers: [string, Partial<UseDataTable<Row>>, string, string][] = [
    ['full and reduced (cards, default)', {}, 'cards', '480'],
    ['card (wide)', { cardsBelow: 'wide' }, 'cards', '800'],
    ['card (always)', { cardsBelow: 'always' }, 'cards', 'always'],
    ['scroll', { phone: 'scroll' }, 'scroll', '480'],
  ]
  for (const [name, options, phone, below] of tiers) {
    test(`${name}: attributes are in the server HTML and hydration adopts it`, async () => {
      const html = renderToString(<Subject {...options} />)
      expect(html).toContain(`data-phone="${phone}"`)
      expect(html).toContain(`data-below="${below}"`)
      expect(html).not.toContain('data-slot="table-card"')
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.append(container)
      const errors: unknown[] = []
      const spy = spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
        errors.push(a.map(String).join(' '))
      })
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(container, <Subject {...options} />, {
          onRecoverableError: (e) => errors.push(e),
        })
      })
      spy.mockRestore()
      expect(errors).toEqual([])
      // Compare as parsed DOM: the server serialises void tags with a slash, innerHTML does not.
      const server = document.createElement('div')
      server.innerHTML = html
      expect(withoutIds(container.innerHTML)).toBe(withoutIds(server.innerHTML))
      await act(async () => root?.unmount())
      container.remove()
    })
  }
})

describe('TablePager', () => {
  test('the current size is always an option, ascending', () => {
    expect(pageSizeOptions(7)).toEqual([7, 10, 25, 50, 100])
    expect(pageSizeOptions(25)).toEqual([10, 25, 50, 100])
  })

  test('no pager when pager is none; a range label with pages', () => {
    const { container, rerender } = render(<Subject />)
    expect(container.querySelector('[data-slot="table-pager"]')).toBeNull()
    rerender(<Subject pager="pages" />)
    const pager = container.querySelector('[data-slot="table-pager"]') as HTMLElement
    expect(pager.textContent).toMatch(/1–5 of 5/)
  })

  test('next and previous write the page; the size select writes the size', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, qty: i }))
    render(<Subject pager="pages" data={rows} />)
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '10' } })
    expect(screen.getByLabelText('Next page')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Next page'))
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(false)
  })

  test('a cursor table shows Load more', () => {
    let fetched = 0
    render(
      <Subject
        mode={{ kind: 'server', cursor: { hasNext: true, fetchNext: () => void fetched++ } }}
      />,
    )
    fireEvent.click(screen.getByText('Load more'))
    expect(fetched).toBe(1)
  })
})
