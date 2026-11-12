/**
 * `CellFilter` and `HeaderFilterMenu`: the two other doors to the one `f.<col>` field. A cell
 * filter is a control that writes the filter and never activates the row; a header `Filter...`
 * opens the same editor the toolbar does.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { settled } from '../../testing/settled'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { CellFilter } from './cell-filter'
import { HeaderFilterMenu } from './header-menu'

afterEach(cleanup)

type Row = { id: string; payee: string; state: string; amount: number }
const c = col<Row>()
let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject({
  onActivate,
  children,
}: {
  onActivate?: () => void
  children: (t: ReturnType<typeof useDataTable<Row>>) => ReactElement
}): ReactElement {
  const t = useDataTable<Row>({
    id: 'cf',
    label: 'Rows',
    columns: [
      c.entity('payee', { header: 'Payee', filter: 'text' }),
      c.status('state', { header: 'State', options: ['Open', 'Done'], filter: 'multi' }),
      c.money('amount', { header: 'Amount', currency: 'EUR' }),
    ],
    data: [{ id: 'a', payee: 'Acme', state: 'Open', amount: 1 }],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(onActivate !== undefined && { onRowActivate: onActivate }),
  } as UseDataTable<Row>)
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return children(t)
}

describe('CellFilter', () => {
  test('writes f.<col> with the cell value and the kind operator', () => {
    render(<Subject>{(t) => <CellFilter table={t} column="payee" value="Acme" />}</Subject>)
    fireEvent.click(screen.getByRole('button', { name: 'Filter Payee by Acme' }))
    expect(model().state.request.filters).toEqual([
      { id: 'payee', op: 'contains', values: ['Acme'] },
    ])
  })

  test('a status cell filter writes anyOf, and a second click on it removes the value', () => {
    render(<Subject>{(t) => <CellFilter table={t} column="state" value="Open" />}</Subject>)
    const button = screen.getByRole('button', { name: 'Filter State by Open' })
    fireEvent.click(button)
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['Open'] }])
    expect(button.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button)
    expect(model().state.request.filters).toEqual([])
  })

  test('a click never reaches the row: onRowActivate is not called', () => {
    const onActivate = mock(() => undefined)
    render(
      <Subject onActivate={onActivate}>
        {(t) => (
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stands in for the row's activation
          <div data-testid="row" onClick={onActivate}>
            <CellFilter table={t} column="payee" value="Acme" />
          </div>
        )}
      </Subject>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filter Payee by Acme' }))
    expect(onActivate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('row'))
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  test('renders only the text, no control, for a column that is not filterable', () => {
    const { container } = render(
      <Subject>{(t) => <CellFilter table={t} column="amount" value="1" />}</Subject>,
    )
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toBe('1')
  })

  test('it hides itself in the card tier by the table root, in CSS', () => {
    render(<Subject>{(t) => <CellFilter table={t} column="payee" value="Acme" />}</Subject>)
    const button = screen.getByRole('button', { name: 'Filter Payee by Acme' })
    expect(button.hasAttribute('data-cell-filter')).toBe(true)
    expect(button.className).toContain("[data-below='480'][data-phone='cards']")
    expect(button.className).toContain('@max-[479.9px]/table:hidden')
    expect(button.className).toContain('pointer-coarse:after:min-h-11')
  })
})

describe('HeaderFilterMenu', () => {
  test('Filter... opens the same editor the toolbar uses and writes the same field', async () => {
    render(<Subject>{(t) => <HeaderFilterMenu table={t} column="payee" />}</Subject>)
    fireEvent.click(screen.getByRole('button', { name: 'Payee column menu' }))
    await settled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Filter...' }))
    await settled()
    const input = screen.getByRole('textbox', { name: 'Contains' })
    fireEvent.change(input, { target: { value: 'Ac' } })
    await act(async () => void (await new Promise((r) => setTimeout(r, 320))))
    expect(model().state.request.filters).toEqual([{ id: 'payee', op: 'contains', values: ['Ac'] }])
  })

  test('renders nothing for a column with no filter', () => {
    const { container } = render(
      <Subject>{(t) => <HeaderFilterMenu table={t} column="amount" />}</Subject>,
    )
    expect(container.querySelector('button')).toBeNull()
  })
})
