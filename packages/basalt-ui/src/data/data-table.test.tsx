/**
 * The three body-chrome props argo's round-6/7 feedback kept 341 hand-rolled lines for, asserted
 * against real markup rather than against props:
 *
 *  1. `maxHeight` renders Mantine's NATIVE scroll container — the same node the docs sanction as
 *     the raw escape. `type="scrollarea"` would silently break a sticky header (ScrollArea's
 *     viewport becomes the positioning context), so the emitted `--table-max-height` var and the
 *     absence of a ScrollArea root are both asserted.
 *  2. `stickyHeader` reaches the `<table>`.
 *  3. `meta.align` reaches BOTH the `<th>` and the `<td>` — a right-aligned header over
 *     left-aligned money is the defect this replaces.
 *  4. A misspelled alignment VALUE throws. The key is a compile error
 *     (`apps/playground/src/data-table-align.type-guard.ts`); the value can only be caught here,
 *     and a silent fallback to left-aligned would look correct in review.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { BasaltDataTable } from './data-table'
import { createColumnHelper } from './table'
import type { BasaltDataTableProps } from './data-table'

type Row = { project: string; cost: number }
const col = createColumnHelper<Row>()

const ROWS: Row[] = [
  { project: 'argo', cost: 12 },
  { project: 'linewatch', cost: 3 },
]

const COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('cost', { header: 'Cost', meta: { align: 'right' } }),
]

function renderTable(props: Partial<BasaltDataTableProps<Row>> = {}) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={COLUMNS} {...props} />
    </MantineProvider>,
  )
}

describe('maxHeight — the capped body', () => {
  test('no maxHeight renders no scroll container at all', () => {
    const { container } = renderTable()
    expect(container.querySelector('.mantine-TableScrollContainer-scrollContainer')).toBeNull()
  })

  test('maxHeight renders a native scroll container carrying the cap', () => {
    const { container } = renderTable({ maxHeight: 480 })
    const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
    if (!scroller) throw new Error('expected a Table.ScrollContainer')
    // Mantine converts px → rem against --mantine-scale; 480 / 16 = 30rem.
    expect(scroller.getAttribute('style') ?? '').toContain('--table-max-height: calc(30rem')
    // type="native" — a ScrollArea viewport would be the wrong positioning context for a
    // sticky <thead>, which is exactly why argo's hand-rolled version spelled the type out.
    expect(container.querySelector('.mantine-ScrollArea-root')).toBeNull()
  })

  test('minWidth alone also opens the scroll container', () => {
    const { container } = renderTable({ minWidth: 640 })
    const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
    if (!scroller) throw new Error('expected a Table.ScrollContainer')
    expect(scroller.getAttribute('style') ?? '').toContain('--table-min-width: calc(40rem')
  })
})

describe('stickyHeader and table chrome', () => {
  test('stickyHeader reaches the table element', () => {
    const { container } = renderTable({ maxHeight: 480, stickyHeader: true })
    expect(container.querySelector('thead')?.getAttribute('data-sticky')).toBe('true')
    expect(renderTable().container.querySelector('thead')?.getAttribute('data-sticky')).toBeNull()
  })

  test('withTableBorder defaults on and can be turned off for a table inside a card', () => {
    expect(
      renderTable().container.querySelector('table')?.getAttribute('data-with-table-border'),
    ).toBe('true')
    expect(
      renderTable({ withTableBorder: false })
        .container.querySelector('table')
        ?.getAttribute('data-with-table-border'),
    ).toBeNull()
  })
})

describe('per-column alignment', () => {
  test('meta.align lands on the header AND every cell of that column', () => {
    const { container } = renderTable()
    const headers = [...container.querySelectorAll('th')]
    const costHeader = headers.find((th) => th.textContent?.includes('Cost'))
    expect(costHeader?.getAttribute('style') ?? '').toContain('text-align: right')

    const costCells = [...container.querySelectorAll('tbody tr')].map((tr) => tr.children[1])
    expect(costCells).toHaveLength(2)
    for (const cell of costCells) {
      expect(cell?.getAttribute('style') ?? '').toContain('text-align: right')
    }
  })

  test('an unaligned column stays unstyled — the prop is opt-in, not a default', () => {
    const { container } = renderTable()
    const projectCell = container.querySelector('tbody tr')?.children[0]
    expect(projectCell?.getAttribute('style') ?? '').not.toContain('text-align')
  })

  test('a misspelled alignment value throws rather than quietly left-aligning', () => {
    const bad = [
      col.accessor('project', { header: 'Project' }),
      // The key is compile-checked; the VALUE can only fail here.
      col.accessor('cost', { header: 'Cost', meta: { align: 'end' as 'right' } }),
    ]
    expect(() =>
      render(
        <MantineProvider>
          <BasaltDataTable data={ROWS} columns={bad} />
        </MantineProvider>,
      ),
    ).toThrow(/meta\.align="end"/)
  })
})

describe('the auto mono-numeral style has an opt-out', () => {
  const styled = [
    col.accessor('project', { header: 'Project' }),
    col.accessor('cost', { header: 'Cost' }),
  ]
  const opted = [
    col.accessor('project', { header: 'Project' }),
    col.accessor('cost', { header: 'Cost', meta: { numeral: false } }),
  ]

  const costStyle = (columns: typeof styled) =>
    render(
      <MantineProvider>
        <BasaltDataTable data={ROWS} columns={columns} />
      </MantineProvider>,
    )
      .container.querySelector('tbody tr')
      ?.children[1]?.getAttribute('style') ?? ''

  test('a numeric cell is mono by default', () => {
    expect(costStyle(styled)).toContain('font-family: var(--mantine-font-family-monospace)')
  })

  test('meta.numeral=false leaves a bespoke cell renderer in charge of its own font', () => {
    expect(costStyle(opted)).not.toContain('font-family')
  })
})

describe('regression — the bare table is unchanged', () => {
  test('renders rows with no new chrome', () => {
    renderTable()
    expect(screen.getByText('argo')).toBeTruthy()
    expect(screen.getByText('linewatch')).toBeTruthy()
  })
})
