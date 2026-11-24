/**
 * Issue 3162: a header keeps to its label in the reading look, so a right-aligned label ends where its figures end;
 * the grid look names each column by kind. `headerIcons` overrides either.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { col } from '../core/kinds'
import { useDataTable } from '../use-data-table'
import { DataTable } from './data-table'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

type Row = { id: string; name: string; amount: number }
const c = col<Row>()

function Subject({
  look,
  headerIcons,
}: {
  look?: 'reading' | 'grid'
  headerIcons?: boolean
}): ReactElement {
  const t = useDataTable<Row>({
    id: 'k3162-icons',
    label: 'Ledger',
    columns: [
      c.entity('name', { header: 'Name' }),
      c.money('amount', { header: 'Amount', currency: 'EUR', help: 'The booked amount.' }),
    ],
    data: [{ id: 'a', name: 'Invoice', amount: 5 }],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(look !== undefined && { look }),
    ...(headerIcons !== undefined && { headerIcons }),
  })
  return <DataTable table={t} />
}

const icons = (): number => document.querySelectorAll('th [data-slot="table-kind-icon"]').length

describe('header icons by look', () => {
  test('the reading look draws none by default, the grid look draws them', () => {
    const { unmount } = render(<Subject />)
    expect(icons()).toBe(0)
    unmount()
    render(<Subject look="grid" />)
    expect(icons()).toBeGreaterThan(0)
  })

  test('headerIcons turns them on in the reading look and off in the grid look', () => {
    const { unmount } = render(<Subject headerIcons />)
    expect(icons()).toBeGreaterThan(0)
    unmount()
    render(<Subject look="grid" headerIcons={false} />)
    expect(icons()).toBe(0)
  })
})
