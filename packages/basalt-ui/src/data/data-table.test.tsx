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
import { MantineProvider, Text } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { BasaltDataTable } from './data-table'
import { createColumnHelper } from './table'
import type { BasaltDataTableProps } from './data-table'
import type { ColumnFiltersState } from './table'

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

  test('withTableBorder defaults OFF and can be turned on for a table that needs a frame', () => {
    // It defaulted ON, and the box was three faults at once — its top edge separated the table's own
    // `WidgetHeader` from its content, its bottom edge landed on the last row's hairline (two rules
    // at zero distance), and its side edges divided nothing. See the prop's JSDoc; the head rule and
    // the between-row rules are untouched, so the table still reads as a table.
    expect(
      renderTable().container.querySelector('table')?.getAttribute('data-with-table-border'),
    ).toBeNull()
    expect(
      renderTable({ withTableBorder: true })
        .container.querySelector('table')
        ?.getAttribute('data-with-table-border'),
    ).toBe('true')
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

describe('title renders a WidgetHeader with the row-model count (C11)', () => {
  test('omitting title renders no heading', () => {
    renderTable()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  test('title renders an h3 carrying the row count from getRowCount()', () => {
    renderTable({ title: 'Top pages' })
    expect(screen.getByRole('heading', { level: 3, name: 'Top pages' })).toBeDefined()
    expect(screen.getByText('2')).toBeDefined() // ROWS has 2 entries
  })
})

describe('the toolbar has no fixed-width literals and resolves controls to the ctl tier', () => {
  test('search input carries no inline width', () => {
    const { container } = renderTable({ enableGlobalFilter: true })
    const input = container.querySelector('input[placeholder="Search…"]')
    expect(input?.getAttribute('style') ?? '').not.toContain('width')
  })

  test('the toolbar renders inside a data-basalt-tier="ctl" slot', () => {
    const { container } = renderTable({
      enableGlobalFilter: true,
      actions: <button type="button">Export</button>,
    })
    const slot = container.querySelector('[data-basalt-tier="ctl"]')
    expect(slot).not.toBeNull()
    expect(slot?.querySelector('button')?.textContent).toBe('Export')
  })
})

/**
 * The manual-pagination contract (argo round 10, P1).
 *
 * `manualPagination` makes `data` one server page while the bar reads "Showing 1–25 of 412", so
 * every remaining client-side control becomes a claim about 412 rows it can only make about 25.
 * These pin the replacement for the old silence: loud where the props contradict each other, and
 * honest — never plausible-but-wrong — where a production bundle has dropped the throw.
 */

/** Run `fn` with the production dev-gate, restoring whatever the runner had set. */
function inProd(fn: () => void): void {
  const previous = process.env['NODE_ENV']
  process.env['NODE_ENV'] = 'production'
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = previous
  }
}

const SERVER_PAGE: Partial<BasaltDataTableProps<Row>> = {
  enablePagination: true,
  manualPagination: true,
  rowCount: 412,
}

describe('manualPagination — the props that would misreport must be resolved', () => {
  test('the bare adoption throws, naming the page-local sort and both ways out', () => {
    expect(() => renderTable(SERVER_PAGE)).toThrow(
      /client-side sorting is still armed[\s\S]*`manualSorting`[\s\S]*`enableSorting=\{false\}`/,
    )
  })

  test('no rowCount and no pageCount throws — "of N" would count the page', () => {
    expect(() =>
      renderTable({ enablePagination: true, manualPagination: true, manualSorting: true }),
    ).toThrow(/neither `rowCount` nor `pageCount`/)
  })

  test('manualPagination without enablePagination throws — the prop is inert, not harmless', () => {
    expect(() => renderTable({ manualPagination: true })).toThrow(
      /`enablePagination` is not set, so `manualPagination` never reaches the table/,
    )
  })

  test('client-side search over one server page throws too — the same defect, one control over', () => {
    expect(() =>
      renderTable({ ...SERVER_PAGE, manualSorting: true, enableGlobalFilter: true }),
    ).toThrow(/the search input \/ facets still filter client-side/)
  })

  test('facets trip the filtering breach even with no search input', () => {
    expect(() =>
      renderTable({
        ...SERVER_PAGE,
        manualSorting: true,
        facets: [{ columnId: 'project', label: 'Project', options: [] }],
      }),
    ).toThrow(/still filter client-side/)
  })

  test('every unresolved breach is reported at once, not one per fix-and-rerun', () => {
    expect(() => renderTable({ manualPagination: true, enablePagination: true })).toThrow(
      /neither `rowCount`[\s\S]*client-side sorting is still armed/,
    )
  })
})

describe('manualPagination — the two sanctioned resolutions', () => {
  test("enableSorting={false} renders, and no header claims to sort — argo's workaround", () => {
    const { container } = renderTable({ ...SERVER_PAGE, enableSorting: false })
    for (const th of container.querySelectorAll('th')) {
      expect(th.getAttribute('aria-sort')).toBeNull()
      expect(th.getAttribute('tabindex')).toBeNull()
    }
    expect(container.textContent).toContain('of 412')
  })

  test('manualSorting keeps the headers live but stops reordering the page locally', () => {
    // asc by cost would put linewatch (3) above argo (12) — under manualSorting the server's
    // order is what renders, because the server is the one that sorted.
    const sorted = renderTable({
      ...SERVER_PAGE,
      manualSorting: true,
      initialSorting: [{ id: 'cost', desc: false }],
    })
    expect(sorted.container.querySelector('tbody tr')?.textContent).toContain('argo')
    expect(sorted.container.querySelector('th')?.getAttribute('aria-sort')).toBe('none')

    // The control: the same initialSorting on a client-side table DOES reorder.
    const local = renderTable({ initialSorting: [{ id: 'cost', desc: false }] })
    expect(local.container.querySelector('tbody tr')?.textContent).toContain('linewatch')
  })

  test('manualFiltering hands the search to the server — the input filters nothing locally', () => {
    const { container } = renderTable({
      ...SERVER_PAGE,
      manualSorting: true,
      manualFiltering: true,
      enableGlobalFilter: true,
      initialGlobalFilter: 'zzzz',
    })
    // Client-side that term matches no row; the server page renders whole.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.querySelector('input')).toBeTruthy()
  })
})

describe('manualPagination — production degrades to the honest table, never the plausible one', () => {
  test('no sort headers, no search input, and no "of N" it cannot stand behind', () => {
    const errors: unknown[][] = []
    const previous = console.error
    console.error = (...args: unknown[]) => errors.push(args)
    try {
      inProd(() => {
        const { container } = renderTable({
          manualPagination: true,
          enablePagination: true,
          enableGlobalFilter: true,
        })
        // Sorting: the control is gone, so the table asserts nothing about the unseen rows.
        for (const th of container.querySelectorAll('th')) {
          expect(th.getAttribute('aria-sort')).toBeNull()
        }
        // Filtering: same — a control that can only narrow one page is not rendered.
        expect(container.querySelector('input[placeholder="Search…"]')).toBeNull()
        // The count: no rowCount was given, so the bar states the range and claims no total.
        expect(container.textContent).toContain('Showing 1–2')
        expect(container.textContent).not.toContain('of 2')
      })
    } finally {
      console.error = previous
    }
    // The degradation is not its own silence.
    expect(errors).toHaveLength(1)
    expect(String(errors[0]?.[0])).toContain('BasaltDataTable: `manualPagination` is set')
  })
})

/**
 * Sibling defect found by reading, not by a consumer: the empty branch keyed off `data.length`,
 * so any narrowing that left `data` non-empty but the row model empty rendered a `<tbody>` with
 * nothing in it — no rows, no message. A blank body reads as a broken table, not as no matches.
 */
describe('the empty state tracks the rendered rows, not the raw array', () => {
  test('a search matching nothing shows the empty state instead of a blank tbody', () => {
    const { container } = renderTable({
      enableGlobalFilter: true,
      initialGlobalFilter: 'no-such-project',
    })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.textContent).toContain('No data to display.')
  })

  test('a custom emptyState is honoured on a filtered-to-nothing table too', () => {
    const { container } = renderTable({
      enableGlobalFilter: true,
      initialGlobalFilter: 'no-such-project',
      emptyState: <Text>Nothing matches that search.</Text>,
    })
    expect(container.textContent).toContain('Nothing matches that search.')
  })

  test('a page index past the end shows the empty state rather than an empty body', () => {
    const { container } = renderTable({
      enablePagination: true,
      initialPagination: { pageIndex: 9, pageSize: 10 },
    })
    expect(container.textContent).toContain('No data to display.')
  })
})

describe('a mistyped facet columnId', () => {
  test('throws in dev naming the id, rather than silently rendering no pill', () => {
    expect(() =>
      renderTable({
        facets: [{ columnId: 'projekt' as 'project', label: 'Project', options: [] }],
      }),
    ).toThrow(/facet columnId "projekt" matches no column/)
  })

  test('in production `resolveFacetColumn` returns undefined and the pill is omitted, not thrown', () => {
    inProd(() => {
      const { container } = renderTable({
        facets: [
          { columnId: 'projekt' as 'project', label: 'Project', options: [] },
          {
            columnId: 'project',
            label: 'Project (real)',
            options: [{ value: 'argo', label: 'argo' }],
          },
        ],
      })
      // The mistyped facet renders no pill at all…
      expect(screen.queryByRole('button', { name: /^Any project$/ })).toBeNull()
      // …while a facet naming a real column still renders normally alongside it.
      expect(screen.getByRole('button', { name: 'Any project (real)' })).toBeTruthy()
      expect(container.querySelectorAll('table')).toHaveLength(1)
    })
  })
})

// Facets now render as FilterSet pills (EnumFilter/MultiSelectFilter, docs/CONTROLS-SPEC.md §3)
// instead of a raw Mantine Select. Mirrors `controls/controls.router.test.tsx`'s `openPill`
// harness fact: Mantine's Popover mounts its dropdown one flushed effect cycle after the click
// (needs `act`), and the dropdown's own contents read as `{ hidden: true }` to Testing Library
// while it still carries transition styles.
async function openPill(name: string | RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('onColumnFiltersChange — the seam server-side faceting needs', () => {
  test('a single-select facet reports the new columnFilters via its pill popover', async () => {
    const seen: ColumnFiltersState[] = []
    renderTable({
      facets: [
        { columnId: 'project', label: 'Project', options: [{ value: 'argo', label: 'argo' }] },
      ],
      onColumnFiltersChange: (filters) => seen.push(filters),
    })
    await openPill('Any project')
    fireEvent.click(screen.getByRole('radio', { name: 'argo', hidden: true }))
    await waitFor(() => expect(seen).toEqual([[{ id: 'project', value: 'argo' }]]))
  })

  test('picking the synthetic "Any <facet>" row clears the column filter again', async () => {
    const seen: ColumnFiltersState[] = []
    renderTable({
      facets: [
        { columnId: 'project', label: 'Project', options: [{ value: 'argo', label: 'argo' }] },
      ],
      onColumnFiltersChange: (filters) => seen.push(filters),
    })
    await openPill('Any project')
    fireEvent.click(screen.getByRole('radio', { name: 'argo', hidden: true }))
    await waitFor(() => expect(seen).toEqual([[{ id: 'project', value: 'argo' }]]))

    await openPill('argo')
    fireEvent.click(screen.getByRole('radio', { name: 'Any project', hidden: true }))
    await waitFor(() => expect(seen[seen.length - 1]).toEqual([]))
  })

  test('a multi-select facet reports every checked value', async () => {
    const seen: ColumnFiltersState[] = []
    renderTable({
      facets: [
        {
          columnId: 'project',
          label: 'Project',
          multiple: true,
          options: [
            { value: 'argo', label: 'argo' },
            { value: 'linewatch', label: 'linewatch' },
          ],
        },
      ],
      onColumnFiltersChange: (filters) => seen.push(filters),
    })
    // A MULTI facet keeps the group label while its selection carries no information — that is
    // `MultiSelectFilter`'s own law, and the reason only the single-select facet needed a readable
    // synthetic row (`facetAllLabel`).
    await openPill('Project')
    fireEvent.click(screen.getByRole('checkbox', { name: 'argo', hidden: true }))
    await waitFor(() => expect(seen).toEqual([[{ id: 'project', value: ['argo'] }]]))
  })
})

describe('initialColumnPinning', () => {
  test('a column named in `left` renders sticky; an unnamed column does not', () => {
    const { container } = renderTable({
      enablePinning: true,
      initialColumnPinning: { left: ['project'] },
    })
    const headers = [...container.querySelectorAll('th')]
    const project = headers.find((th) => th.textContent === 'Project')
    const cost = headers.find((th) => th.textContent === 'Cost')
    expect(project?.style.position).toBe('sticky')
    expect(cost?.style.position).not.toBe('sticky')
  })
})
