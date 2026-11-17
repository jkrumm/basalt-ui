/**
 * Expression cycle 7 (`v3-expr-7-kit-fixes` 1): a `DataTable` or `DataPanel` in error names what
 * failed, as a `ChartCard` does: the panel's title, else the table's label, else the bare sentence.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { DataPanel } from '../cards/data-panel'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Row = { id: string; name: string }

function Table({ label }: { label: string }): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'expr7-error',
    label,
    columns: [c.text('name')],
    data: [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: { tag: 'error', retry: () => undefined },
  })
  return <DataTable table={t} />
}

const alert = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[role="alert"] span, [role="alert"] p')?.textContent

describe('table error title', () => {
  test('a table in error names its label', () => {
    const { container } = render(<Table label="Open pull requests" />)
    expect(alert(container)).toBe('Could not load open pull requests.')
  })

  test('a blank label keeps the bare sentence', () => {
    const { container } = render(<Table label="  " />)
    expect(alert(container)).toBe('Could not load this.')
  })

  test('a table inside a panel names the panel title over its own label', () => {
    const { container } = render(
      <DataPanel
        title="Pipeline"
        phase="ready"
        bodySize={{ rows: 3 }}
        body={() => <Table label="Open pull requests" />}
      />,
    )
    expect(alert(container)).toBe('Could not load pipeline.')
  })
})

describe('panel error title', () => {
  test('a panel in error names its title', () => {
    const { container } = render(
      <DataPanel
        title="Open pull requests"
        phase={{ tag: 'error', retry: () => undefined }}
        bodySize={{ rows: 3 }}
        body={() => null}
      />,
    )
    expect(alert(container)).toBe('Could not load open pull requests.')
  })

  test('a kind keeps its own sentence', () => {
    const { container } = render(
      <DataPanel
        title="Open pull requests"
        phase={{ tag: 'error', kind: 'forbidden' }}
        bodySize={{ rows: 3 }}
        body={() => null}
      />,
    )
    expect(alert(container)).toBe('You do not have access to this.')
  })
})
