/** Shared render helper for the invariant tests: public DOM only, through `api.ts`. */
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { DataTableProps, UseDataTable } from '../contract'
import { api } from './api'

export type Row = { id: string; name: string; amount: number; state: string }

export const ROWS: readonly Row[] = [
  { id: 'a', name: 'Project 10', amount: 12, state: 'Engineering' },
  { id: 'b', name: 'Project 2', amount: 3, state: 'Eng' },
  { id: 'c', name: 'Project 1', amount: 7, state: 'Engineering' },
]

export const STATES = ['Engineering', 'Eng'] as const

export type TableOptions = Omit<
  UseDataTable<Row>,
  'id' | 'label' | 'columns' | 'getRowId' | 'data' | 'mode'
> &
  Partial<Pick<UseDataTable<Row>, 'columns' | 'data' | 'mode'>>

/** Mounts `useDataTable` + `DataTable` the way an app does; columns default to a name/amount/state set. */
export function renderTable(
  options: TableOptions = {},
  props: Partial<DataTableProps<Row>> = {},
): RenderResult {
  function Subject(): ReactNode {
    const c = api.col<Row>()
    const t = api.useDataTable<Row>({
      id: 'rows',
      label: 'Rows',
      columns: [
        c.text('name', { header: 'Name' }),
        c.money('amount', { currency: 'EUR', header: 'Amount (EUR)' }),
        c.status('state', { options: STATES, filter: 'multi', header: 'State' }),
      ],
      data: ROWS,
      getRowId: (r) => r.id,
      mode: { kind: 'client' },
      ...options,
    } as UseDataTable<Row>)
    return <api.DataTable {...({ table: t, ...props } as DataTableProps<Row>)} />
  }
  return render(<Subject />)
}
