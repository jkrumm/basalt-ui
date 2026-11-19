/**
 * Expression cycle 11 (framed header, row 10a): a `DataTable` in a `DataPanel` body keeps its column
 * header row when the panel is empty or failed, and draws the arm under it (n33, n47, n48, n49).
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import { DataPanel } from '../cards/data-panel'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Row = { id: string; name: string; total: number }

const c = col<Row>()

function Table(): ReactElement {
  const t = useDataTable<Row>({
    id: 'frame-head',
    label: 'Runs',
    columns: [c.entity('name', { header: 'Run' }), c.number('total', { header: 'Total' })],
    data: [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

const headers = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll('thead th')].map((th) => th.textContent)

describe('a table in a DataPanel without rows', () => {
  test('an error panel keeps the column header row and draws the arm under it, once', () => {
    const retry = mock(() => undefined)
    const { container, getAllByRole, getByText } = render(
      <DataPanel
        title="Runs"
        phase={{ tag: 'error', retry }}
        bodySize={{ rows: 3 }}
        body={() => <Table />}
      />,
    )
    expect(headers(container)).toEqual(['Run', 'Total'])
    expect(getAllByRole('alert')).toHaveLength(1)
    expect(container.querySelector('tbody [role="alert"]')).not.toBeNull()
    getByText('Retry').click()
    expect(retry).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'error',
    )
  })

  test('an empty panel keeps the column header row and its cause under it, once', () => {
    const { container, getAllByText } = render(
      <DataPanel
        title="Runs"
        phase="ready"
        empty={{ cause: 'No runs yet' }}
        bodySize={{ rows: 3 }}
        body={() => <Table />}
      />,
    )
    expect(headers(container)).toEqual(['Run', 'Total'])
    expect(getAllByText('No runs yet')).toHaveLength(1)
    expect(container.querySelector('tbody [data-slot="table-empty"]')).not.toBeNull()
  })

  test('the box keeps the declared height', () => {
    const { container } = render(
      <DataPanel
        title="Runs"
        phase={{ tag: 'error' }}
        bodySize={{ height: 240 }}
        body={() => <Table />}
      />,
    )
    expect(container.querySelector<HTMLElement>('[data-slot="card-phase"]')?.style.height).toBe(
      '240px',
    )
  })

  test('a ready panel draws the table as before and its arm is gone', () => {
    const { container, queryByRole } = render(
      <DataPanel title="Runs" phase="ready" bodySize={{ rows: 3 }} body={() => <Table />} />,
    )
    expect(headers(container)).toEqual(['Run', 'Total'])
    expect(queryByRole('alert')).toBeNull()
    expect(container.querySelector('[data-phase="error"]')).toBeNull()
  })
})

describe('a body that draws no table in an empty or failed panel', () => {
  test('the panel keeps its own arm and the body stays hidden', () => {
    const { container, getAllByText } = render(
      <DataPanel
        title="Board"
        phase="ready"
        empty={{ cause: 'Nothing here' }}
        bodySize={{ rows: 3 }}
        body={() => <p>cards</p>}
      />,
    )
    expect(getAllByText('Nothing here')).toHaveLength(1)
    expect(container.querySelector('[data-slot="card-phase"]')?.textContent).toContain(
      'Nothing here',
    )
    expect(container.querySelector('thead')).toBeNull()
    expect(container.querySelector<HTMLElement>('[hidden]')?.textContent).toBe('cards')
  })

  test('a body that throws without its data leaves the panel arm in place', () => {
    const original = console.error
    console.error = () => undefined
    const { getByRole } = render(
      <DataPanel
        title="Board"
        phase={{ tag: 'error' }}
        bodySize={{ rows: 3 }}
        body={() => {
          throw new Error('no data')
        }}
      />,
    )
    console.error = original
    expect(getByRole('alert').textContent).toContain('Could not load board.')
  })
})
