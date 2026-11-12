/**
 * `FilterChips`: one chip per active filter, `subject operator value` and a remove control. The
 * same chips render in the toolbar and inside the `Filters (n)` sheet, so they hold no state.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { col } from '../core/kinds'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { FilterChips } from './chips'

afterEach(cleanup)

type Row = { id: string; name: string; state: string }
const c = col<Row>()
let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject(): ReactElement {
  const t = useDataTable<Row>({
    id: 'chips',
    label: 'Rows',
    columns: [
      c.entity('name', { header: 'Name', filter: 'text' }),
      c.status('state', { header: 'State', options: ['Open', 'Done'], filter: 'multi' }),
    ],
    data: [{ id: 'a', name: 'Acme', state: 'Open' }],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return <FilterChips table={t} />
}

describe('FilterChips', () => {
  test('renders nothing while no filter is active', () => {
    const { container } = render(<Subject />)
    expect(container.querySelector('[data-slot="table-chips"]')).toBeNull()
  })

  test('a chip names subject, operator and value', () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({
        filters: [
          { id: 'name', op: 'contains', values: ['Ac'] },
          { id: 'state', op: 'anyOf', values: ['Open', 'Done'] },
        ],
      }),
    )
    const chips = screen.getAllByRole('listitem')
    expect(chips.map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Name contains Ac',
      'State is Open, Done',
    ])
    expect(screen.getByRole('list', { name: 'Active filters' })).toBeTruthy()
  })

  test('remove drops that filter only', () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({
        filters: [
          { id: 'name', op: 'contains', values: ['Ac'] },
          { id: 'state', op: 'anyOf', values: ['Open'] },
        ],
      }),
    )
    fireEvent.click(within(screen.getAllByRole('listitem')[0]!).getByRole('button'))
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['Open'] }])
  })

  test('the remove control is named by its subject and meets the 44 px coarse floor', () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({ filters: [{ id: 'name', op: 'contains', values: ['Ac'] }] }),
    )
    const button = screen.getByRole('button', { name: 'Remove filter Name' })
    expect(button.className).toContain('pointer-coarse:after:min-h-11')
  })
})
