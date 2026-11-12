/** The row keyboard, through the public DOM: a tiny table that spreads `rootProps` and `rowProps`. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { nextIndex, useRowKeyboard } from './keyboard'
import type { RowKeyboardOptions } from './keyboard'

afterEach(cleanup)

const IDS = ['a', 'b', 'c', 'd', 'e']

type Handlers = Pick<RowKeyboardOptions, 'onActivate' | 'onToggle' | 'onClear'>

function Fixture({
  ids = IDS,
  pageStep,
  ...handlers
}: Handlers & { ids?: string[]; pageStep?: number }): ReactNode {
  const searchRef = useRef<HTMLInputElement>(null)
  const kb = useRowKeyboard({ rowIds: ids, searchRef, pageStep, ...handlers })
  return (
    <div data-testid="root" {...kb.rootProps}>
      <input ref={searchRef} role="searchbox" aria-label="Search" />
      <table>
        <tbody>
          {ids.map((id) => (
            <tr key={id} data-testid={`row-${id}`} {...kb.rowProps(id)}>
              <td>
                {id}
                <button type="button">act-{id}</button>
                <input type="checkbox" aria-label={`tick-${id}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span data-testid="keep">{String(kb.activeIndex)}</span>
    </div>
  )
}

const row = (id: string) => screen.getByTestId(`row-${id}`)
const tabStops = () =>
  [...document.querySelectorAll<HTMLElement>('tr[tabindex="0"]')].map((el) =>
    (el.getAttribute('data-testid') ?? '').replace('row-', ''),
  )

describe('nextIndex', () => {
  test('clamps at both ends and steps pages', () => {
    expect(nextIndex('ArrowUp', 0, 5)).toBe(0)
    expect(nextIndex('ArrowDown', 4, 5)).toBe(4)
    expect(nextIndex('ArrowDown', 1, 5)).toBe(2)
    expect(nextIndex('Home', 3, 5)).toBe(0)
    expect(nextIndex('End', 1, 5)).toBe(4)
    expect(nextIndex('PageDown', 1, 30, 10)).toBe(11)
    expect(nextIndex('PageUp', 3, 30, 10)).toBe(0)
    expect(nextIndex('x', 1, 5)).toBeUndefined()
    expect(nextIndex('Home', 0, 0)).toBeUndefined()
  })
})

describe('useRowKeyboard', () => {
  test('exactly one row is a tab stop, the first until focus moves', () => {
    render(<Fixture onActivate={() => undefined} />)
    expect(tabStops()).toEqual(['a'])
    expect(row('b').getAttribute('tabindex')).toBe('-1')
    expect(row('a').getAttribute('role')).toBeNull()
    expect(row('a').hasAttribute('data-activatable')).toBe(true)
  })

  test('arrows, Home, End and paging move the stop and the focus', () => {
    render(<Fixture onActivate={() => undefined} pageStep={2} />)
    act(() => row('a').focus())
    fireEvent.keyDown(row('a'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(row('b'))
    expect(tabStops()).toEqual(['b'])
    fireEvent.keyDown(row('b'), { key: 'PageDown' })
    expect(document.activeElement).toBe(row('d'))
    fireEvent.keyDown(row('d'), { key: 'End' })
    expect(document.activeElement).toBe(row('e'))
    fireEvent.keyDown(row('e'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(row('e'))
    fireEvent.keyDown(row('e'), { key: 'PageUp' })
    expect(document.activeElement).toBe(row('c'))
    fireEvent.keyDown(row('c'), { key: 'Home' })
    expect(document.activeElement).toBe(row('a'))
    expect(screen.getByTestId('keep').textContent).toBe('0')
  })

  test('Enter on the row activates; Space never does', () => {
    const onActivate = mock((_id: string) => undefined)
    render(<Fixture onActivate={onActivate} onToggle={() => undefined} />)
    fireEvent.keyDown(row('b'), { key: ' ' })
    expect(onActivate).not.toHaveBeenCalled()
    fireEvent.keyDown(row('b'), { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith('b')
  })

  test('Enter on a nested control does not activate the row', () => {
    const onActivate = mock((_id: string) => undefined)
    render(<Fixture onActivate={onActivate} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'act-b' }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'tick-b' }), { key: 'Enter' })
    expect(onActivate).not.toHaveBeenCalled()
  })

  test('an arrow in a nested control does not move rows', () => {
    render(<Fixture onActivate={() => undefined} />)
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'tick-a' }), { key: 'ArrowDown' })
    expect(tabStops()).toEqual(['a'])
  })

  test('Space toggles when rows are selectable, and keeps the page from scrolling', () => {
    const onToggle = mock((_id: string) => undefined)
    render(<Fixture onToggle={onToggle} />)
    const notPrevented = fireEvent.keyDown(row('c'), { key: ' ' })
    expect(notPrevented).toBe(false)
    expect(onToggle).toHaveBeenCalledWith('c')
  })

  test('without selection Space is left to the browser', () => {
    render(<Fixture onActivate={() => undefined} />)
    expect(fireEvent.keyDown(row('c'), { key: ' ' })).toBe(true)
  })

  test('a click activates, a click on a nested control does not', () => {
    const onActivate = mock((_id: string) => undefined)
    render(<Fixture onActivate={onActivate} />)
    fireEvent.click(screen.getByRole('button', { name: 'act-b' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'tick-b' }))
    expect(onActivate).not.toHaveBeenCalled()
    fireEvent.click(row('b'))
    expect(onActivate).toHaveBeenCalledWith('b')
  })

  test('/ focuses the table search, and only from outside a text field', () => {
    render(<Fixture onActivate={() => undefined} />)
    const search = screen.getByRole('searchbox')
    const notPrevented = fireEvent.keyDown(row('a'), { key: '/' })
    expect(notPrevented).toBe(false)
    expect(document.activeElement).toBe(search)
    // typing a slash in the box is typing
    expect(fireEvent.keyDown(search, { key: '/' })).toBe(true)
    // and a slash in a cell editor is typing too
    const cell = screen.getByRole('checkbox', { name: 'tick-a' })
    act(() => cell.focus())
    fireEvent.keyDown(cell, { key: '/' })
    expect(document.activeElement).toBe(search)
  })

  test('/ outside the table is not captured', () => {
    render(
      <>
        <Fixture onActivate={() => undefined} />
        <button type="button">outside</button>
      </>,
    )
    const outside = screen.getByRole('button', { name: 'outside' })
    act(() => outside.focus())
    fireEvent.keyDown(outside, { key: '/', bubbles: true })
    expect(document.activeElement).toBe(outside)
  })

  test('Escape clears, except from the search box', () => {
    const onClear = mock(() => undefined)
    render(<Fixture onToggle={() => undefined} onClear={onClear} />)
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(onClear).not.toHaveBeenCalled()
    fireEvent.keyDown(row('a'), { key: 'Escape' })
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test('a table with neither activation nor selection has no tab stops', () => {
    render(<Fixture />)
    expect(tabStops()).toEqual([])
    expect(row('a').hasAttribute('tabindex')).toBe(false)
  })

  test('the stop falls back to the first row when its row leaves the set', () => {
    const { rerender } = render(<Fixture onActivate={() => undefined} />)
    fireEvent.focus(row('c'))
    expect(tabStops()).toEqual(['c'])
    rerender(<Fixture ids={['a', 'b']} onActivate={() => undefined} />)
    expect(tabStops()).toEqual(['a'])
    rerender(<Fixture ids={[]} onActivate={() => undefined} />)
    expect(screen.getByTestId('keep').textContent).toBe('undefined')
  })

  test('focus on a row (a click or a Tab) becomes the stop', () => {
    render(<Fixture onActivate={() => undefined} />)
    act(() => row('d').focus())
    expect(tabStops()).toEqual(['d'])
    expect(row('d').hasAttribute('data-active')).toBe(true)
  })
})
