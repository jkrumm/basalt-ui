import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { CheckboxMatrix, checkboxMatrixParts } from './checkbox-matrix'
import type { MatrixValue } from './checkbox-matrix'

afterEach(cleanup)

const rows = [
  { id: 'billing', label: 'Billing', description: 'Invoices and plans' },
  { id: 'members', label: 'Members' },
]
const columns = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'guest', label: 'Guest' },
]

function Grid(props: {
  initial?: MatrixValue
  onChange?: (v: MatrixValue) => void
  locked?: boolean
  toggles?: boolean
}): ReactElement {
  const [value, setValue] = useState<MatrixValue>(props.initial ?? {})
  return (
    <CheckboxMatrix
      aria-label="Permissions"
      rows={rows}
      columns={columns}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        props.onChange?.(next)
      }}
      rowToggles={props.toggles ?? false}
      columnToggles={props.toggles ?? false}
      cellState={(row, column) =>
        props.locked === true && row.id === 'billing' && column.id === 'owner'
          ? 'locked'
          : undefined
      }
    />
  )
}

describe('checkbox-matrix', () => {
  test('is a real table: scoped column and row headings, one checkbox per cell named by both', () => {
    const { container, getByRole } = render(<Grid />)
    const heads = [...container.querySelectorAll('th')]
    expect(heads.filter((h) => h.getAttribute('scope') === 'col')).toHaveLength(4)
    expect(heads.filter((h) => h.getAttribute('scope') === 'row')).toHaveLength(2)
    expect(container.querySelector('table')?.getAttribute('aria-label')).toBe('Permissions')
    expect(getByRole('checkbox', { name: 'Billing Admin' })).toBeDefined()
    expect(container.querySelectorAll('[role="checkbox"]')).toHaveLength(6)
  })

  test('toggling a cell reports the checked columns per row in column order', () => {
    let last: MatrixValue = {}
    const { getByRole } = render(<Grid onChange={(v) => (last = v)} />)
    fireEvent.click(getByRole('checkbox', { name: 'Billing Guest' }))
    fireEvent.click(getByRole('checkbox', { name: 'Billing Owner' }))
    expect(last['billing']).toEqual(['owner', 'guest'])
    expect(last['members']).toEqual([])
  })

  test('the row and column toggles are tri-state and skip locked cells', () => {
    let last: MatrixValue = {}
    const { getByRole } = render(
      <Grid locked toggles initial={{ billing: ['owner'] }} onChange={(v) => (last = v)} />,
    )
    const all = getByRole('checkbox', { name: 'All for Billing' })
    // The locked Owner cell counts toward what the toggle shows, so one of three reads mixed.
    expect(all.getAttribute('aria-checked')).toBe('mixed')
    fireEvent.click(all)
    expect(last['billing']).toEqual(['owner', 'admin', 'guest'])
    expect(getByRole('checkbox', { name: 'All for Billing' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    fireEvent.click(getByRole('checkbox', { name: 'Admin for every row' }))
    expect(last['members']).toContain('admin')
    // The locked Owner cell of Billing never changes, however it is reached.
    fireEvent.click(getByRole('checkbox', { name: 'All for Billing' }))
    expect(last['billing']).toEqual(['owner'])
  })

  test('a locked cell is read-only and a disabled column cannot change', () => {
    const { getByRole } = render(
      <CheckboxMatrix
        aria-label="P"
        rows={rows}
        columns={[
          { id: 'a', label: 'A', disabled: true },
          { id: 'b', label: 'B' },
        ]}
        defaultValue={{ billing: ['a'] }}
        cellState={(row, column) =>
          row.id === 'members' && column.id === 'b' ? 'locked' : undefined
        }
      />,
    )
    expect(getByRole('checkbox', { name: 'Billing A' }).hasAttribute('data-disabled')).toBe(true)
    expect(getByRole('checkbox', { name: 'Members B' }).hasAttribute('data-readonly')).toBe(true)
  })

  test('arrow keys move focus cell by cell and skip disabled cells', () => {
    const { getByRole } = render(
      <CheckboxMatrix
        aria-label="P"
        rows={rows}
        columns={[...columns.slice(0, 2), { id: 'guest', label: 'Guest', disabled: true }]}
      />,
    )
    const first = getByRole('checkbox', { name: 'Billing Owner' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(getByRole('checkbox', { name: 'Billing Admin' }))
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(getByRole('checkbox', { name: 'Billing Admin' }))
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(getByRole('checkbox', { name: 'Members Admin' }))
  })

  test('invalid marks every cell and onBlur fires once when focus leaves the matrix', () => {
    let blurs = 0
    const { getAllByRole, getByRole } = render(
      <CheckboxMatrix
        aria-label="P"
        rows={rows}
        columns={columns}
        aria-invalid
        onBlur={() => blurs++}
      />,
    )
    expect(getAllByRole('checkbox').every((c) => c.getAttribute('aria-invalid') === 'true')).toBe(
      true,
    )
    const a = getByRole('checkbox', { name: 'Billing Owner' })
    const b = getByRole('checkbox', { name: 'Billing Admin' })
    fireEvent.blur(a, { relatedTarget: b })
    expect(blurs).toBe(0)
    fireEvent.blur(b, { relatedTarget: document.body })
    expect(blurs).toBe(1)
  })

  test('server render keeps the slot', () => {
    const html = renderToString(<Grid />)
    for (const part of checkboxMatrixParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
