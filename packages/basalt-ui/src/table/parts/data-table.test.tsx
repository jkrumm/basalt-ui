/**
 * `DataTable` at the full tier: the server HTML is the hydrated tree, axe finds nothing serious,
 * and the table keeps its geometry (colgroup, head, root attributes) across ready, loading and
 * error. Fixtures: 8 and 14 columns, 0 rows, loading, error.
 */
import axe from 'axe-core'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { Phase, QueryStateLike } from '../../core/ports'
import { settled } from '../../testing/settled'
import { col } from '../core/kinds'
import { DataTable } from './data-table'
import { useDataTable } from '../use-data-table'
import type { KindColumn } from '../contract'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

type Row = Record<string, string | number> & { id: string }

const KEYS = Array.from({ length: 14 }, (_, i) => `c${i}`)

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, r) => ({
    id: `r${r}`,
    ...Object.fromEntries(KEYS.map((key, i) => [key, i % 2 === 0 ? `Cell ${r}-${i}` : r * 10 + i])),
  }))
}

function columnsOf(count: number): KindColumn<Row>[] {
  const c = col<Row>()
  return KEYS.slice(0, count).map((key, i) =>
    i % 2 === 0
      ? c.text(key as never, { header: `Column ${i}` })
      : c.number(key as never, { header: `Column ${i}` }),
  )
}

function Subject({
  columns = 8,
  count = 5,
  phase,
  data,
}: {
  columns?: number
  count?: number
  phase?: Phase | QueryStateLike
  data?: Row[] | undefined
}): ReactElement {
  const t = useDataTable<Row>({
    id: `fixture-${columns}`,
    label: 'Fixture rows',
    columns: columnsOf(columns),
    data: data === undefined && phase === undefined ? rows(count) : data,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    ...(phase !== undefined && { phase }),
  })
  return <DataTable table={t} />
}

async function hydrate(
  element: ReactElement,
): Promise<{ errors: number; container: HTMLElement; html: string }> {
  const html = renderToString(element)
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  // The DOM's own serialisation of the server HTML, so `<col/>` and `colSpan` compare as parsed.
  const parsed = container.innerHTML
  let errors = 0
  const spy = spyOn(console, 'error').mockImplementation(() => undefined)
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: () => void (errors += 1) })
  })
  errors += spy.mock.calls.length
  spy.mockRestore()
  return { errors, container, html: parsed }
}

const FIXTURES: [string, ReactElement][] = [
  ['8 columns', <Subject key="8" columns={8} />],
  ['14 columns', <Subject key="14" columns={14} />],
  ['0 rows', <Subject key="0" count={0} />],
  ['loading', <Subject key="l" phase="loading" />],
  ['error', <Subject key="e" phase={{ tag: 'error', retry: () => undefined }} />],
]

describe('SSR', () => {
  for (const [name, element] of FIXTURES) {
    test(`${name}: server HTML equals the hydrated tree, no recoverable error`, async () => {
      const { errors, container, html } = await hydrate(element)
      expect(errors).toBe(0)
      expect(container.innerHTML).toBe(html)
    })
  }

  test('the full tier is in the server HTML: every column and row', () => {
    const html = renderToString(<Subject columns={14} count={5} />)
    expect(html.match(/role="columnheader"/g)).toHaveLength(14)
    expect(html.match(/<tr[^>]*data-slot="table-row"/g)?.length).toBe(6)
    expect(html).toContain('aria-colcount="14"')
  })
})

describe('axe', () => {
  for (const [name, element] of FIXTURES) {
    test(`${name}: no serious or critical violation`, async () => {
      const { container } = render(element)
      await settled()
      const result = await axe.run(container, {
        // jsdom-class DOMs have no layout or paint, so these rules cannot answer there.
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
      })
      const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(
        bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([])
    })
  }
})

describe('geometry across phases', () => {
  const shape = (container: HTMLElement) => ({
    colgroup: container.querySelector('colgroup')?.outerHTML,
    // Generated ids differ per mount; the markup around them is what must not move.
    head: container.querySelector('thead')?.outerHTML.replaceAll(/id="[^"]*"/g, 'id'),
    table: container.querySelector('table')?.className,
    colcount: container.querySelector('table')?.getAttribute('aria-colcount'),
    fullAt: container.querySelector('[data-slot="table-root"]')?.getAttribute('data-full-at'),
  })

  test('ready, loading and error share one colgroup, head and table', () => {
    const ready = shape(render(<Subject columns={8} />).container)
    cleanup()
    const loading = shape(render(<Subject columns={8} phase="loading" />).container)
    cleanup()
    const error = shape(
      render(<Subject columns={8} phase={{ tag: 'error', message: 'boom' }} />).container,
    )
    expect(ready.colgroup).toContain('<col')
    expect(loading).toEqual(ready)
    expect(error).toEqual(ready)
    expect(ready.table).toContain('table-fixed')
  })

  test('each phase marks the root and draws inside the one tbody', () => {
    const phases: [Phase | undefined, string, string][] = [
      [undefined, 'ready', 'tbody [data-slot="table-row"]'],
      ['loading', 'loading', 'tbody [data-skeleton]'],
      [{ tag: 'error', retry: () => undefined }, 'error', 'tbody [data-slot="table-error"]'],
    ]
    for (const [phase, tag, selector] of phases) {
      const { container } = render(<Subject {...(phase !== undefined && { phase })} />)
      expect(container.querySelector('[data-slot="table-root"]')?.getAttribute('data-phase')).toBe(
        tag,
      )
      expect(container.querySelectorAll('tbody')).toHaveLength(1)
      expect(container.querySelector(selector)).not.toBeNull()
      cleanup()
    }
  })

  test('a table that showed 14 rows loads as 14 skeleton rows; a first load draws 6', () => {
    const skeletons = (el: HTMLElement): number =>
      el.querySelectorAll('tbody [data-skeleton]').length
    const first = render(<Subject phase="loading" />)
    expect(skeletons(first.container)).toBe(6)
    cleanup()
    const { container, rerender } = render(<Subject count={14} />)
    expect(container.querySelectorAll('tbody [data-slot="table-row"]')).toHaveLength(14)
    rerender(<Subject phase="loading" />)
    expect(skeletons(container)).toBe(14)
    rerender(<Subject count={17} />)
    rerender(<Subject phase="loading" />)
    expect(skeletons(container)).toBe(17)
  })

  test('error shows Retry and calls it; forbidden has none', () => {
    let retried = 0
    const { container, getByRole, rerender } = render(
      <Subject phase={{ tag: 'error', retry: () => void (retried += 1) }} />,
    )
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    expect(retried).toBe(1)
    rerender(<Subject phase={{ tag: 'error', kind: 'forbidden', retry: () => undefined }} />)
    expect(container.querySelector('[data-slot="table-error"] button')).toBeNull()
  })

  test('a failed refetch keeps the rows and marks the root (I20)', () => {
    const { container } = render(
      <Subject
        data={rows(3)}
        phase={{ isPending: false, isError: true, isRefetchError: true, error: new Error('x') }}
      />,
    )
    const root = container.querySelector('[data-slot="table-root"]')
    expect(root?.getAttribute('data-phase')).toBe('stale')
    expect(root?.hasAttribute('data-refresh-failed')).toBe(true)
    expect(container.querySelectorAll('tbody [data-slot="table-row"]')).toHaveLength(3)
  })
})
