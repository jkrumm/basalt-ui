import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { FoldHeaderLabel } from './data-table-fold'

afterEach(cleanup)

const wrap = (names: readonly string[]) => (
  <MantineProvider>
    <FoldHeaderLabel names={names} />
  </MantineProvider>
)
/** The popover's list item for a folded name (the button's own hint repeats the first name). */
const listed = (name: string) => screen.queryAllByText(name).find((el) => el.tagName === 'LI')
const mount = (names: readonly string[]) => render(wrap(names))

describe('FoldHeaderLabel', () => {
  test('one folded column reads "1 more column", not a plural', () => {
    mount(['X'])
    const button = screen.getByRole('button')
    expect(button.getAttribute('title')).toBe('1 more column: X')
    // The accessible name starts with the visible text (WCAG 2.5.3 Label in Name).
    expect(button.getAttribute('aria-label')).toBe('+1 col, 1 more column: X')
  })

  test('the visible header carries the word, singular for one', () => {
    const { rerender } = mount(['A', 'B', 'C', 'D'])
    expect(screen.getByRole('button').firstChild?.textContent).toBe('+4 cols')
    rerender(wrap(['A']))
    expect(screen.getByRole('button').firstChild?.textContent).toBe('+1 col')
  })

  test('the button shows the first folded name before a tap, hidden from the accessible name', () => {
    mount(['Cause', 'Owner', 'Notes'])
    const button = screen.getByRole('button')
    const hint = screen.getByText('Cause')
    expect(button.contains(hint)).toBe(true)
    expect(hint.getAttribute('aria-hidden')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('+3 cols, 3 more columns: Cause, Owner, Notes')
  })

  test('a tap lists the folded columns by name, with no hover', () => {
    mount(['Volume', 'Duration', 'Notes'])
    expect(listed('Duration')).toBeUndefined()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
    for (const name of ['Volume', 'Duration', 'Notes']) expect(listed(name)).toBeDefined()
  })

  test('Escape closes it', () => {
    mount(['Volume', 'Duration'])
    fireEvent.click(screen.getByRole('button'))
    fireEvent.keyDown(listed('Volume') as HTMLElement, { key: 'Escape' })
    expect(listed('Volume')).toBeUndefined()
  })

  test('an outside click closes it', () => {
    mount(['Volume', 'Duration'])
    fireEvent.click(screen.getByRole('button'))
    expect(listed('Volume')).toBeDefined()
    // Mantine's outside-click listener reads the pointer-down/up pair; the click completes the tap.
    fireEvent.mouseDown(document.body)
    fireEvent.mouseUp(document.body)
    fireEvent.click(document.body)
    expect(listed('Volume')).toBeUndefined()
  })
})
