/**
 * The row menu opens from a right click, a long press and Shift+F10 on the row, with the entries of its
 * "..." button (one `c.actions` list, drawn twice).
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { settled } from '../../testing/settled'
import { api } from '../invariants/api'
import { renderTable } from '../invariants/harness'
import type { Row } from '../invariants/harness'

afterEach(cleanup)

const c = api.col<Row>()
const actions = [
  { id: 'rename', label: 'Rename', onClick: () => undefined },
  { id: 'archive', label: 'Archive', onClick: () => undefined, disabled: () => true },
]
const names = (): string[] => screen.queryAllByRole('menuitem').map((el) => el.textContent ?? '')
const firstRow = (container: HTMLElement): HTMLElement =>
  container.querySelector('tbody tr') as HTMLElement

describe('DataTable row context menu', () => {
  test('a right click lists what the "..." button lists, and the row reads as open', async () => {
    const { container } = renderTable({ columns: [c.text('name'), c.actions(actions)] })
    fireEvent.click(
      container.querySelector('tbody [data-slot="table-actions"] button') as HTMLElement,
    )
    await settled()
    const fromButton = names()
    expect(fromButton).toEqual(['Rename', 'Archive'])
    cleanup()

    const again = renderTable({ columns: [c.text('name'), c.actions(actions)] })
    const row = firstRow(again.container)
    expect(row.hasAttribute('data-popup-open')).toBe(false)
    expect(fireEvent.contextMenu(row, { clientX: 30, clientY: 40 })).toBe(false)
    await settled()
    expect(names()).toEqual(fromButton)
    expect(screen.getByRole('menuitem', { name: 'Archive' }).hasAttribute('data-disabled')).toBe(
      true,
    )
    expect(firstRow(again.container).hasAttribute('data-popup-open')).toBe(true)
  })

  test('Shift+F10 on the focused row opens it', async () => {
    const { container } = renderTable({ columns: [c.text('name'), c.actions(actions)] })
    const row = firstRow(container)
    fireEvent.keyDown(row, { key: 'F10', shiftKey: true })
    await settled()
    expect(names()).toEqual(['Rename', 'Archive'])
  })

  test('picking an item runs the row action and never activates the row', async () => {
    let seen: string | undefined
    let activated = 0
    const { container } = renderTable({
      onRowActivate: () => void (activated += 1),
      columns: [
        c.text('name'),
        c.actions([{ id: 'go', label: 'Go', onClick: (r: Row) => void (seen = r.name) }]),
      ],
    })
    fireEvent.contextMenu(firstRow(container))
    await settled()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Go' }))
    await settled()
    expect(seen).toBeDefined()
    expect(activated).toBe(0)
  })

  test('contextMenu: false, and a table with no actions column, leave the browser menu', () => {
    const off = renderTable({ contextMenu: false, columns: [c.text('name'), c.actions(actions)] })
    expect(fireEvent.contextMenu(firstRow(off.container))).toBe(true)
    cleanup()
    const none = renderTable({ columns: [c.text('name')] })
    expect(fireEvent.contextMenu(firstRow(none.container))).toBe(true)
    expect(names()).toEqual([])
  })
})
