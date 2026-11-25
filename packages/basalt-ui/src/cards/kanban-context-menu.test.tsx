/** A right click, a long press and Shift+F10 on a card open the entries of its "..." button. */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ColumnRef, KanbanCardProps } from './contract'
import { KanbanCard } from './kanban-card'

type Col = 'todo' | 'doing'
const COLUMNS: ColumnRef<Col>[] = [
  { id: 'todo', label: 'To do', count: 3 },
  { id: 'doing', label: 'Doing', count: 2 },
]
const card = (extra: Partial<KanbanCardProps<Col>> = {}): KanbanCardProps<Col> => ({
  id: 'c1',
  title: 'Fix the cache key',
  menu: [{ id: 'open', label: 'Open', onClick: () => undefined }],
  move: { column: COLUMNS[0]!, index: 1, columns: COLUMNS, onMove: () => undefined },
  ...extra,
})
const names = (): string[] =>
  [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent ?? '')
const root = (): HTMLElement => document.querySelector('[data-slot="kanban-card"]') as HTMLElement

afterEach(cleanup)

describe('KanbanCard context menu', () => {
  test('lists what the "..." button lists, and marks the card while it is open', async () => {
    render(<KanbanCard {...card()} />)
    const button = document.querySelector('[data-slot="kanban-menu"]') as HTMLElement
    fireEvent.pointerEnter(button)
    fireEvent.click(button)
    await waitFor(() => expect(names().length).toBeGreaterThan(0))
    const fromButton = names()
    cleanup()

    render(<KanbanCard {...card()} />)
    expect(fireEvent.contextMenu(root(), { clientX: 20, clientY: 20 })).toBe(false)
    await waitFor(() => expect(names().length).toBeGreaterThan(0))
    expect(names()).toEqual(fromButton)
    expect(fromButton).toContain('Open')
    expect(root().hasAttribute('data-popup-open')).toBe(true)
  })

  test('Shift+F10 on the card opens it', async () => {
    render(<KanbanCard {...card()} />)
    fireEvent.keyDown(root(), { key: 'F10', shiftKey: true })
    await waitFor(() => expect(names()).toContain('Open'))
  })

  test('contextMenu: false, and a card with one action, keep the browser menu', () => {
    render(<KanbanCard {...card({ contextMenu: false })} />)
    expect(fireEvent.contextMenu(root())).toBe(true)
    cleanup()
    render(<KanbanCard {...card({ move: 'static' })} />)
    expect(fireEvent.contextMenu(root())).toBe(true)
  })
})
