/**
 * `c.select` (docs/v3/issues/g3/v3-table-t4-virtual.json): the cell is disabled while `commit` is
 * pending and usable again after a rejection; Enter, F2 and a tap in the control open it, and none of
 * them activates the row (I10).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { specOf } from '../core/kinds-spec'
import { settled } from '../../testing/settled'
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
  look = 'reading',
}: {
  commit: (row: Row, next: string) => unknown
  onRowActivate?: (row: Row) => void
  options?: readonly string[]
  look?: 'reading' | 'grid'
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
    look,
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

  test('a commit that throws before it returns re-enables the cell', async () => {
    render(
      <Subject
        commit={() => {
          throw new Error('invalid')
        }}
      />,
    )
    await choose('Category of Rent', 'Food')
    await act(async () => {
      await Promise.resolve()
    })
    expect(isDisabled(trigger('Category of Rent'))).toBe(false)
  })

  test('Enter and a tap in the control never call onRowActivate', async () => {
    const onRowActivate = mock(() => undefined)
    const commit = mock((_row: Row, _next: string) => Promise.resolve())
    render(<Subject commit={commit} onRowActivate={onRowActivate} />)
    const control = trigger('Category of Rent')
    // Enter on the closed trigger opens the listbox; Escape closes it again before the tap below.
    fireEvent.keyDown(control, { key: 'Enter' })
    await settled()
    expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy()
    expect(onRowActivate).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('option', { name: 'Travel' }), { key: 'Escape' })
    })
    await settled()
    expect(screen.queryByRole('option', { name: 'Travel' })).toBeNull()
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

  test('F2 on the trigger opens the listbox', async () => {
    render(<Subject commit={() => undefined} />)
    fireEvent.keyDown(trigger('Category of Rent'), { key: 'F2' })
    await settled()
    expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy()
  })

  test('a click on the trigger opens the listbox', async () => {
    render(<Subject commit={() => undefined} />)
    fireEvent.click(trigger('Category of Rent'))
    await settled()
    expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy()
  })

  test('a touch tap on the trigger opens the listbox', async () => {
    render(<Subject commit={() => undefined} />)
    const control = trigger('Category of Rent')
    // A tap: the pointer events, then the compatibility mouse events and the click a browser fires after them.
    fireEvent.pointerDown(control, { pointerType: 'touch', pointerId: 1, button: 0 })
    fireEvent.pointerUp(control, { pointerType: 'touch', pointerId: 1, button: 0 })
    fireEvent.mouseDown(control, { button: 0 })
    fireEvent.mouseUp(control, { button: 0 })
    fireEvent.click(control)
    await settled()
    expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy()
  })

  test('F2 on the focused row focuses the row select and opens it', async () => {
    render(<Subject commit={() => undefined} onRowActivate={() => undefined} />)
    const row = trigger('Category of Rent').closest('tr')
    if (row === null) throw new Error('no row')
    act(() => row.focus())
    fireEvent.keyDown(row, { key: 'F2' })
    await settled()
    expect(trigger('Category of Rent').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy()
  })

  test.each(['Enter', 'F2'])(
    'in a grid-look table %s on the select cell focuses and opens its control',
    async (key) => {
      render(<Subject commit={() => undefined} look="grid" />)
      const cell = trigger('Category of Rent').closest('td')
      if (cell === null) throw new Error('no cell')
      fireEvent.keyDown(cell, { key })
      await settled()
      expect(trigger('Category of Rent').getAttribute('aria-expanded')).toBe('true')
      expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy()
    },
  )

  test('F2 inside the open list neither commits nor reaches the row', async () => {
    const commit = mock((_row: Row, _next: string) => Promise.resolve())
    render(<Subject commit={commit} onRowActivate={() => undefined} />)
    await act(async () => {
      fireEvent.click(trigger('Category of Rent'))
    })
    const option = await screen.findByRole('option', { name: 'Travel' })
    await act(async () => {
      fireEvent.keyDown(option, { key: 'F2' })
    })
    expect(commit).not.toHaveBeenCalled()
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
