/**
 * `c.select` (docs/v3/issues/g3/v3-table-t4-virtual.json): the cell is disabled while `commit` is
 * pending and usable again after a rejection, and neither Enter nor a tap in the control activates
 * the row (I10).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { specOf } from '../core/kinds-spec'
import { DataTable } from './data-table'
import { SELECT_MAX_OPTIONS } from './select-cell'
import { useDataTable } from '../use-data-table'

type Row = { id: string; payee: string; category: string }

const ROWS: Row[] = [
  { id: 'a', payee: 'Rent', category: 'Housing' },
  { id: 'b', payee: 'Bakery', category: 'Food' },
]
const CATEGORIES = ['Housing', 'Food', 'Travel']

function Subject({
  commit,
  onRowActivate,
  options = CATEGORIES,
}: {
  commit: (row: Row, next: string) => unknown
  onRowActivate?: (row: Row) => void
  options?: readonly string[]
}): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 's',
    label: 'Bookings',
    columns: [
      c.entity('payee'),
      c.select('category', { label: (r) => `Category of ${r.payee}`, options, commit }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(onRowActivate !== undefined && { onRowActivate }),
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

function deferred(): { promise: Promise<void>; resolve(): void; reject(e: Error): void } {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const trigger = (name: string): HTMLElement => screen.getByRole('combobox', { name })

async function choose(name: string, option: string): Promise<void> {
  await act(async () => {
    fireEvent.click(trigger(name))
  })
  const item = await screen.findByRole('option', { name: option })
  // Base UI selects on pointer up after a pointer down on the item.
  await act(async () => {
    fireEvent.pointerDown(item)
    fireEvent.pointerUp(item)
    fireEvent.click(item)
  })
}

const isDisabled = (el: HTMLElement): boolean =>
  el.hasAttribute('disabled') ||
  el.hasAttribute('data-disabled') ||
  el.getAttribute('aria-disabled') === 'true'

afterEach(cleanup)

describe('SelectCell', () => {
  test('shows the row value and names the control per row', () => {
    render(<Subject commit={() => undefined} />)
    expect(trigger('Category of Rent').textContent).toContain('Housing')
    expect(trigger('Category of Bakery').textContent).toContain('Food')
  })

  test('pending disables the cell; a resolved commit re-enables it', async () => {
    const pending = deferred()
    const commit = mock((_row: Row, _next: string) => pending.promise)
    const { container } = render(<Subject commit={commit} />)
    await choose('Category of Rent', 'Travel')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith(ROWS[0]!, 'Travel')
    expect(isDisabled(trigger('Category of Rent'))).toBe(true)
    expect(
      container.querySelector('[data-slot="table-select-cell"][aria-busy="true"]'),
    ).not.toBeNull()
    // The other row's cell is not affected.
    expect(isDisabled(trigger('Category of Bakery'))).toBe(false)
    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    expect(isDisabled(trigger('Category of Rent'))).toBe(false)
  })

  test('a rejected commit re-enables the cell', async () => {
    const pending = deferred()
    render(<Subject commit={() => pending.promise} />)
    await choose('Category of Rent', 'Food')
    expect(isDisabled(trigger('Category of Rent'))).toBe(true)
    await act(async () => {
      pending.reject(new Error('offline'))
      await pending.promise.catch(() => undefined)
    })
    expect(isDisabled(trigger('Category of Rent'))).toBe(false)
  })

  test('Enter and a tap in the control never call onRowActivate', async () => {
    const onRowActivate = mock(() => undefined)
    const commit = mock((_row: Row, _next: string) => Promise.resolve())
    render(<Subject commit={commit} onRowActivate={onRowActivate} />)
    const control = trigger('Category of Rent')
    fireEvent.keyDown(control, { key: 'Enter' })
    expect(onRowActivate).not.toHaveBeenCalled()
    // A tap on the trigger and on an option (portalled, bubbling through the React tree).
    await choose('Category of Rent', 'Travel')
    expect(commit).toHaveBeenCalledTimes(1)
    // Enter on the open popup's option commits, never activates.
    await act(async () => {
      fireEvent.click(trigger('Category of Bakery'))
    })
    const option = await screen.findByRole('option', { name: 'Travel' })
    await act(async () => {
      fireEvent.keyDown(option, { key: 'Enter' })
    })
    expect(commit).toHaveBeenCalledTimes(2)
    expect(onRowActivate).not.toHaveBeenCalled()
    // The row itself still activates.
    const row = control.closest('tr')
    if (row === null) throw new Error('no row')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowActivate).toHaveBeenCalledTimes(1)
  })

  test('the control is a tab stop only in the roving row', () => {
    render(<Subject commit={() => undefined} onRowActivate={() => undefined} />)
    expect(trigger('Category of Rent').getAttribute('tabindex')).not.toBe('-1')
    expect(trigger('Category of Bakery').getAttribute('tabindex')).toBe('-1')
  })

  test('picking the current value commits nothing', async () => {
    const commit = mock((_row: Row, _next: string) => Promise.resolve())
    render(<Subject commit={commit} />)
    await choose('Category of Rent', 'Housing')
    expect(commit).not.toHaveBeenCalled()
  })

  test(`above ${SELECT_MAX_OPTIONS} options the cell searches`, () => {
    const many = Array.from({ length: SELECT_MAX_OPTIONS + 1 }, (_, i) => `Option ${i}`)
    const { container } = render(
      <Subject commit={() => undefined} options={['Housing', 'Food', ...many]} />,
    )
    expect(
      container.querySelectorAll('[data-slot="table-select-cell"] [data-slot="combobox"]'),
    ).toHaveLength(2)
    expect(container.querySelector('[data-slot="table-select-cell"] input')).not.toBeNull()
  })

  test('the card plan places the select in the `edit` slot', () => {
    const c = col<Row>()
    const column = c.select('category', {
      label: () => 'x',
      options: CATEGORIES,
      commit: () => undefined,
    })
    expect(specOf(column).card[0]).toBe('edit')
  })
})
