/**
 * Nested rows (`useDataTable({ nested })`): three levels drawn by the table itself with the indent
 * and the expander in the first column, tree-grid roles on the table and its rows, Right and Left
 * open, close and step, and a closed row kept in `display.collapsed`.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- the queries read the explicit roles the table sets */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import type { StateHandle, TableState } from '../contract'
import { col } from '../core/kinds'
import { useDataTable } from '../use-data-table'
import { DataTable } from './data-table'

type Row = { id: string; name: string; parent?: string; days: number }

const ROWS: Row[] = [
  { id: 'a', name: 'Cluster', days: 3 },
  { id: 'b', name: 'Network', parent: 'a', days: 1 },
  { id: 'c', name: 'Billing', parent: 'b', days: 2 },
  { id: 'd', name: 'Search', parent: 'b', days: 5 },
  { id: 'e', name: 'Export', parent: 'a', days: 4 },
  { id: 'f', name: 'Access', days: 2 },
]

const STATE: TableState = {
  v: 1,
  request: { q: '', filters: [], sort: [], page: 1, pageSize: 25 },
  display: { visibility: {} },
}

const written: TableState[] = []

function handleOf(initial: TableState): StateHandle<TableState> {
  return {
    use() {
      const [value, setValue] = useState(initial)
      return [
        value,
        (next: TableState) => {
          written.push(next)
          setValue(next)
        },
      ]
    },
  }
}

const c = col<Row>()

function Subject({ state = STATE }: { state?: TableState }): ReactElement {
  const id = useId()
  const t = useDataTable<Row>({
    id,
    label: 'Tasks',
    columns: [c.entity('name', { filter: 'text' }), c.number('days')],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    state: handleOf(state),
    onRowActivate: () => undefined,
    nested: { parentOf: (r) => r.parent },
  })
  return <DataTable table={t} />
}

const rows = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('tbody tr[role="row"]'),
]
const names = (container: HTMLElement): string[] =>
  rows(container).map((tr) => tr.querySelector('[data-kind="entity"]')?.textContent ?? '')

afterEach(() => {
  cleanup()
  written.length = 0
})

describe('nested rows', () => {
  test('three levels in tree order, each row with its level, size and position', () => {
    const { container } = render(<Subject />)
    expect(container.querySelector('table')?.getAttribute('role')).toBe('treegrid')
    expect(names(container)).toEqual([
      'Cluster',
      'Network',
      'Billing',
      'Search',
      'Export',
      'Access',
    ])
    expect(rows(container).map((tr) => tr.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '3',
      '3',
      '2',
      '1',
    ])
    const network = rows(container)[1]!
    expect(network.getAttribute('aria-expanded')).toBe('true')
    expect(network.getAttribute('aria-setsize')).toBe('2')
    expect(network.getAttribute('aria-posinset')).toBe('1')
    // A row with nothing below it is not expandable.
    expect(rows(container)[2]!.hasAttribute('aria-expanded')).toBe(false)
  })

  test('the table draws the indent and the expander; the page draws neither', () => {
    const { container } = render(<Subject />)
    const levels = rows(container).map((tr) => tr.style.getPropertyValue('--table-level'))
    expect(levels).toEqual(['1', '2', '3', '3', '2', '1'])
    const leads = container.querySelectorAll('[data-slot="table-tree-lead"]')
    expect(leads).toHaveLength(6)
    // Three rows have rows below them (Cluster, Network); the rest hold the chevron's room.
    expect(
      container.querySelectorAll('[data-slot="table-tree-lead"] button[aria-expanded]'),
    ).toHaveLength(2)
    expect(container.querySelectorAll('[data-slot="table-tree-spacer"]')).toHaveLength(4)
  })

  test('the chevron closes a row and hides what is below it, without touching the request', async () => {
    const { container } = render(<Subject />)
    const before = written.length
    const chevron = rows(container)[1]!.querySelector<HTMLElement>(
      '[data-slot="table-tree-lead"] button',
    )!
    await act(async () => {
      fireEvent.click(chevron)
    })
    expect(names(container)).toEqual(['Cluster', 'Network', 'Export', 'Access'])
    expect(rows(container)[1]!.getAttribute('aria-expanded')).toBe('false')
    // display.collapsed is the device lane, as a group's collapse: it never writes the request.
    expect(written.length).toBe(before)
  })

  test('Left closes or steps to the parent, Right opens or steps in', async () => {
    const { container } = render(<Subject />)
    const at = (i: number): HTMLElement => rows(container)[i]!
    // Focus Billing (level 3), Left steps to Network.
    await act(async () => {
      at(2).focus()
      fireEvent.keyDown(at(2), { key: 'ArrowLeft' })
    })
    expect(document.activeElement).toBe(at(1))
    // Left on the open Network closes it.
    await act(async () => {
      fireEvent.keyDown(at(1), { key: 'ArrowLeft' })
    })
    expect(at(1).getAttribute('aria-expanded')).toBe('false')
    expect(names(container)).toEqual(['Cluster', 'Network', 'Export', 'Access'])
    // Right opens it again, a second Right steps to its first row.
    await act(async () => {
      fireEvent.keyDown(at(1), { key: 'ArrowRight' })
    })
    expect(at(1).getAttribute('aria-expanded')).toBe('true')
    await act(async () => {
      fireEvent.keyDown(at(1), { key: 'ArrowRight' })
    })
    expect(document.activeElement).toBe(at(2))
  })

  test('a sort orders each level and keeps every row under its parent', () => {
    const sorted: TableState = {
      ...STATE,
      request: { ...STATE.request, sort: [{ id: 'days', desc: true }] },
    }
    const { container } = render(<Subject state={sorted} />)
    expect(names(container)).toEqual([
      'Cluster',
      'Export',
      'Network',
      'Search',
      'Billing',
      'Access',
    ])
  })

  test('a search keeps the match and the rows above it, drawn as context', () => {
    const searched: TableState = { ...STATE, request: { ...STATE.request, q: 'Search' } }
    const { container } = render(<Subject state={searched} />)
    expect(names(container)).toEqual(['Cluster', 'Network', 'Search'])
    expect(rows(container).map((tr) => tr.hasAttribute('data-context'))).toEqual([
      true,
      true,
      false,
    ])
  })

  test('while a search holds the paths open, Left steps to the parent and nothing is closed', async () => {
    const searched: TableState = { ...STATE, request: { ...STATE.request, q: 'Search' } }
    const { container } = render(<Subject state={searched} />)
    const before = written.length
    const network = rows(container)[1]!
    expect(
      network.querySelector<HTMLButtonElement>('[data-slot="table-tree-lead"] button')?.disabled,
    ).toBe(true)
    await act(async () => {
      network.focus()
      fireEvent.keyDown(network, { key: 'ArrowLeft' })
    })
    expect(document.activeElement).toBe(rows(container)[0]!)
    expect(network.getAttribute('aria-expanded')).toBe('true')
    expect(written.length).toBe(before)
  })
})
