/**
 * The three body-chrome props argo's round-6/7 feedback kept 341 hand-rolled lines for, asserted
 * against real markup rather than against props:
 *
 *  1. `maxHeight` renders Mantine's NATIVE scroll container — the same node the docs sanction as
 *     the raw escape. `type="scrollarea"` would silently break a sticky header (ScrollArea's
 *     viewport becomes the positioning context), so the emitted `--table-max-height` var and the
 *     absence of a ScrollArea root are both asserted.
 *  2. `stickyHeader` reaches the `<table>`, and `stickyHeaderOffset` reaches it ONLY when the page
 *     is the scrollport — inside the scroll container the header's anchor is that box's own top
 *     edge, and the offset parked the header mid-body.
 *  3. `meta.align` reaches BOTH the `<th>` and the `<td>` — a right-aligned header over
 *     left-aligned money is the defect this replaces.
 *  4. A misspelled alignment VALUE throws. The key is a compile error
 *     (`apps/playground/src/data-table-align.type-guard.ts`); the value can only be caught here,
 *     and a silent fallback to left-aligned would look correct in review.
 */
import { MantineProvider, Text } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, mock, spyOn, test } from 'bun:test'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { resetValidatedProps } from '../common/validate'
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

/** The row a checked box belongs to — the assertion that survives a reorder, unlike an index. */
function checkedRowText(container: HTMLElement): string {
  const box = container.querySelector('tbody input[type="checkbox"]:checked')
  return box?.closest('tr')?.textContent ?? ''
}

function renderTable(props: Partial<BasaltDataTableProps<Row>> = {}) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={COLUMNS} {...props} />
    </MantineProvider>,
  )
}

describe('maxHeight — the capped body', () => {
  test('no maxHeight still renders a scroll container — uncapped, with a zero floor', () => {
    // Containment is the DEFAULT now, not an opt-in: a bare `<table>` sizes to its own min-content
    // and a five-column table is ~450px wide, which widened the whole page at 390px. `minWidth: 0`
    // means "no floor, just contain me"; the cap stays absent.
    const { container } = renderTable()
    const scroller = container.querySelector('.mantine-TableScrollContainer-scrollContainer')
    if (!scroller) throw new Error('expected a Table.ScrollContainer')
    expect(scroller.getAttribute('style') ?? '').not.toContain('--table-max-height')
  })

  test('a page-scrolled sticky header takes the MEASURED wrapper, not a scroll container', () => {
    // An `overflow-x: auto` box computes `overflow-y` to `auto` and becomes the header's scrollport;
    // with no cap that box has no scroll range, so a static container would make `stickyHeader`
    // inert rather than contained. The wrapper decides by measurement instead, and its unmeasured
    // default is bare. See `useMeasuredContainment` in `data-table.tsx`.
    const { container } = renderTable({ stickyHeader: true })
    expect(container.querySelector('.mantine-TableScrollContainer-scrollContainer')).toBeNull()
    const wrapper = container.querySelector('[data-contained]')
    if (!wrapper) throw new Error('expected the measured containment wrapper')
    expect(wrapper.getAttribute('data-contained')).toBe('false')
    expect(wrapper.querySelector('table')).not.toBeNull()
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

  test('stickyHeaderOffset reaches a page-scrolled table and is DROPPED inside the scroller', () => {
    // The offset is the height of the page's fixed chrome (app header + `PageBar` row 2), so it is
    // only meaningful while the WINDOW is the scrollport. A `maxHeight`/`minWidth` table owns its
    // own, and the offset then parked the `<thead>` that many pixels down INSIDE the body, over the
    // first rows — `tests/layout/data-table.layout.test.ts` measures the geometry in a real browser.
    const paged = renderTable({ stickyHeader: true, stickyHeaderOffset: 94 })
    expect(paged.container.querySelector('table')?.getAttribute('style') ?? '').toContain(
      '--table-sticky-header-offset',
    )
    for (const scrolling of [{ maxHeight: 480 }, { minWidth: 640 }]) {
      const { container } = renderTable({
        stickyHeader: true,
        stickyHeaderOffset: 94,
        ...scrolling,
      })
      expect(container.querySelector('table')?.getAttribute('style') ?? '').not.toContain(
        '--table-sticky-header-offset',
      )
      expect(container.querySelector('thead')?.getAttribute('data-sticky')).toBe('true')
    }
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

  /**
   * THE CAUSE, pinned in the cheap lane. happy-dom evaluates no layout, so the OUTCOME belongs to
   * `tests/layout/no-horizontal-overflow.layout.test.ts` — what belongs here is the two declarations
   * that produced it. The toolbar `Group` is the header row's flex item (`CtlSlot` between them is
   * `display: contents`) and carried `flex: 0 0 auto` with flex's default `min-width: auto`, so a
   * 220px search beside a 230px pill row was an unshrinkable 461px box in a 302px column and
   * `AppShell.Main` measured `scrollWidth` 505 against `clientWidth` 390 at 390x844.
   */
  test('the toolbar is a SHRINKABLE flex item, and the search states a basis not a width', () => {
    const { container } = renderTable({ enableGlobalFilter: true })
    const toolbar = container.querySelector('[data-basalt-tier="ctl"] > .mantine-Group-root')
    const toolbarStyle = toolbar?.getAttribute('style') ?? ''
    // Asserted as LONGHANDS: the DOM expands the `flex` shorthand, so matching the shorthand
    // string would pass or fail on the serializer rather than on the declaration.
    // `flex-shrink: 0` here is the whole defect — it is what let the item outgrow its column.
    expect(toolbarStyle).toContain('flex-shrink: 1')
    expect(toolbarStyle).toContain('flex-grow: 0')
    expect(toolbarStyle).toContain('min-width: 0')

    const search = container.querySelector('.mantine-TextInput-root')
    const searchStyle = search?.getAttribute('style') ?? ''
    expect(searchStyle).toContain('flex-basis: 220px')
    expect(searchStyle).toContain('flex-shrink: 1')
    expect(searchStyle).toContain('flex-grow: 0')
    expect(searchStyle).toContain('max-width: 100%')
    // A literal `width` would reinstate the floor the basis exists to remove.
    expect(searchStyle).not.toContain('width: 220px')
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

describe('className and classNames (common/props.ts)', () => {
  test('className reaches the root; classNames.table reaches the table element', () => {
    const { container } = renderTable({
      className: 'my-table',
      classNames: { table: 'my-thead' },
    })
    expect(container.querySelector('.my-table')).not.toBeNull()
    expect(container.querySelector('table.my-thead')).not.toBeNull()
  })

  /**
   * The ROOT SHAPE, pinned — because it moved. A className home needs a root, so the component now
   * always renders a wrapper `<div>` where it used to return a Fragment, and the table and the
   * pagination bar were the caller's own direct children before that. Any `:first-child` /
   * `> table` selector a consumer wrote against the old flat structure now has to target the
   * wrapper (`MIGRATING.md` § Unreleased). This test is what makes a silent revert impossible.
   */
  test('the root is one div carrying classNames.root, wrapping the table and the pagination bar', () => {
    const { container } = renderTable({
      className: 'my-table',
      classNames: { root: 'slot-root', footer: 'slot-footer' },
      maxHeight: 480,
      enablePagination: true,
    })
    const root = container.querySelector('.slot-root')
    if (!(root instanceof HTMLElement)) throw new Error('expected a root element')
    expect(root.tagName).toBe('DIV')
    expect(root.classList.contains('my-table')).toBe(true)
    // Direct children, in order: the scroll container holding the table, then the pagination bar.
    const children = [...root.children]
    expect(children).toHaveLength(2)
    expect(children[0]?.className).toContain('mantine-TableScrollContainer-scrollContainer')
    expect(children[0]?.querySelector('table')).not.toBeNull()
    expect(children[1]?.className).toContain('slot-footer')
    // The table is no longer a child of whatever the caller rendered this into.
    expect(container.querySelector('table')?.parentElement).not.toBe(container)
  })

  test('style reaches the root, and no style attribute is written without one', () => {
    expect(
      renderTable({ style: { marginTop: '3px' }, classNames: { root: 'slot-root' } })
        .container.querySelector('.slot-root')
        ?.getAttribute('style') ?? '',
    ).toContain('margin-top: 3px')
    expect(
      renderTable({ classNames: { root: 'slot-bare' } })
        .container.querySelector('.slot-bare')
        ?.getAttribute('style'),
    ).toBeNull()
  })
})

/**
 * The two `common/validate.ts` lanes, and the split is the point: `data`/`columns` would crash
 * inside `useReactTable` either way, so they THROW; a `stickyHeaderOffset` that gets dropped still
 * renders a correct-looking table, so it warns once in dev and renders on.
 */
describe('prop validation', () => {
  for (const missing of ['data', 'columns'] as const) {
    test(`a missing \`${missing}\` throws a message naming the component and the prop`, () => {
      const props = { data: ROWS, columns: COLUMNS } as Record<string, unknown>
      delete props[missing]
      expect(() =>
        render(
          <MantineProvider>
            <BasaltDataTable {...(props as unknown as BasaltDataTableProps<Row>)} />
          </MantineProvider>,
        ),
      ).toThrow(`[basalt] BasaltDataTable: prop "${missing}" is required.`)
    })
  }

  test('stickyHeaderOffset beside a scroll container warns once, and renders on', () => {
    resetValidatedProps()
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderTable({
      stickyHeader: true,
      stickyHeaderOffset: 94,
      maxHeight: 480,
    })
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('"stickyHeaderOffset" is ignored beside')
    // Rendered on — the warning is about a dropped prop, not a broken table.
    expect(container.querySelector('thead')?.getAttribute('data-sticky')).toBe('true')
    error.mockRestore()
  })

  test('stickyHeaderOffset on a page-scrolled table says nothing ABOUT THE OFFSET', () => {
    resetValidatedProps()
    const error = spyOn(console, 'error').mockImplementation(() => {})
    renderTable({ stickyHeader: true, stickyHeaderOffset: 94 })
    // One message, and it is the containment one: `stickyHeader` with neither cap nor floor is the
    // shape that cannot be wrapped. The offset itself is honoured and says nothing.
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('"stickyHeader" with neither "maxHeight"')
    error.mockRestore()
  })
})

// ── The uniform query contract (law C3, components audit #3) ──────────────────

function query(over: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined as unknown,
    isError: false,
    error: null as unknown,
    fetchStatus: 'idle' as 'fetching' | 'paused' | 'idle',
    refetch: () => undefined,
    ...over,
  }
}

/**
 * The table had NO error branch: a 500 rendered *No data to display.* — the exact false claim
 * `QueryState` exists to delete, one container over. All four branches are asserted against the
 * `<tbody>`, and against the invariant that the `<thead>` survives every one of them: the table's
 * chrome is what says WHICH data failed.
 */
describe('query — the four container states', () => {
  test('pending renders the skeleton rows, header intact', () => {
    const { container } = renderTable({ data: [], query: query({ fetchStatus: 'fetching' }) })
    expect(container.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0)
    expect(screen.getByRole('columnheader', { name: /Project/ })).toBeDefined()
    expect(screen.queryByText('No data to display.')).toBeNull()
  })

  test('error renders an ErrorState row spanning every column, with a working Retry', () => {
    const refetch = mock(() => undefined)
    renderTable({
      data: [],
      query: query({ isError: true, error: new Error('upstream exploded'), refetch }),
    })
    expect(screen.getByText('upstream exploded')).toBeDefined()
    // The row spans the table rather than sitting in the first column.
    const cell = screen.getByText('upstream exploded').closest('td')
    expect(cell?.getAttribute('colspan')).toBe(String(COLUMNS.length))
    // Never the empty branch — that is the misreport this replaces.
    expect(screen.queryByText('No data to display.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('a resolved but empty result renders the existing emptyState', () => {
    renderTable({
      data: [],
      query: query({ data: [] }),
      emptyState: <Text>Nothing matched</Text>,
    })
    expect(screen.getByText('Nothing matched')).toBeDefined()
  })

  test('data renders the rows', () => {
    renderTable({ query: query({ data: ROWS }) })
    expect(screen.getByText('argo')).toBeDefined()
  })

  test('query beats isLoading, and says so once in dev', () => {
    resetValidatedProps()
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    renderTable({ isLoading: true, query: query({ data: ROWS }) })
    expect(screen.getByText('argo')).toBeDefined()
    expect(spy.mock.calls.flat().join(' ')).toContain('"query" and "isLoading" are both set')
    spy.mockRestore()
  })

  /**
   * The branch that differs from `QueryState` on purpose (`query-branch.ts`): an error arriving
   * OVER cached rows keeps the rows, with no error row and no banner. `QueryState` draws a "showing
   * cached data" banner in the same case; a container swaps only its `<tbody>`, so it has nowhere
   * to put one. Compose `QueryState` AROUND the table when the banner is wanted.
   */
  test('an error over cached data keeps the rows — no error row, no banner', () => {
    renderTable({ query: query({ data: ROWS, isError: true, error: new Error('refetch failed') }) })
    expect(screen.getByText('argo')).toBeDefined()
    expect(screen.queryByText('refetch failed')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  test('a query missing `isError` throws rather than painting the empty state over a 500', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      renderTable({
        // oxlint-disable-next-line typescript/no-explicit-any -- the whole point is a bad shape
        query: { data: undefined, fetchStatus: 'idle', refetch: () => undefined } as any,
      }),
    ).toThrow(/must carry \{ data, isError/)
    spy.mockRestore()
  })
})

// ── onRowActivate (law C11, components audit #11) ─────────────────────────────

describe('onRowActivate', () => {
  test('a click on the row hands back the ROW datum, not the cell', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    renderTable({ onRowActivate })
    fireEvent.click(screen.getByText('linewatch'))
    expect(onRowActivate).toHaveBeenCalledTimes(1)
    expect(onRowActivate.mock.calls[0]?.[0]).toEqual(ROWS[1] as Row)
  })

  test('Enter on a focused row activates it; the row is focusable and marked', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    const { container } = renderTable({ onRowActivate })
    const row = container.querySelector('tbody tr[data-activatable]')
    if (!row) throw new Error('expected an activatable row')
    expect(row.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowActivate).toHaveBeenCalledTimes(1)
  })

  test('Enter on a nested control does not ALSO open the row', () => {
    // keydown bubbles, so a row-level Enter handler fires for every focused descendant. Without the
    // `target === currentTarget` guard the cell's own button ran and the detail opened behind it.
    const onRowActivate = mock((_row: Row) => undefined)
    const columns = [
      ...COLUMNS,
      col.display({
        id: 'act',
        header: 'Act',
        cell: () => (
          <button type="button" onClick={() => undefined}>
            Rerun
          </button>
        ),
      }),
    ]
    render(
      <MantineProvider>
        <BasaltDataTable data={ROWS} columns={columns} onRowActivate={onRowActivate} />
      </MantineProvider>,
    )
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'Rerun' })[0] as HTMLElement, {
      key: 'Enter',
    })
    expect(onRowActivate).not.toHaveBeenCalled()
  })

  test('the row keeps its <tr> semantics — no role="button"', () => {
    const { container } = renderTable({ onRowActivate: () => undefined })
    const row = container.querySelector('tbody tr[data-activatable]')
    expect(row?.getAttribute('role')).toBeNull()
  })

  test('without the prop no row is focusable or marked', () => {
    const { container } = renderTable()
    expect(container.querySelector('tbody tr[data-activatable]')).toBeNull()
  })
})

// ── Row selection + the bulk bar ──────────────────────────────────────────────

describe('enableRowSelection + bulkActions', () => {
  test('no bar while nothing is selected; selecting a row raises it with the count', () => {
    renderTable({ enableRowSelection: true, bulkActions: () => [{ key: 'x', label: 'Archive' }] })
    expect(screen.queryByText('1 selected')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }))
    expect(screen.getByText('1 selected')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Archive' }).length).toBeGreaterThan(0)
  })

  test('select-all counts every row on the page', () => {
    renderTable({ enableRowSelection: true, bulkActions: () => [] })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    expect(screen.getByText('2 selected')).toBeDefined()
  })

  test('an action receives the SELECTED rows', () => {
    const act = mock((_rows: Row[]) => undefined)
    renderTable({
      enableRowSelection: true,
      bulkActions: (rows) => [{ key: 'del', label: 'Delete', onClick: () => act(rows) }],
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 2' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0] as HTMLElement)
    expect(act).toHaveBeenCalledTimes(1)
    expect(act.mock.calls[0]?.[0]).toEqual([ROWS[1] as Row])
  })

  test('onRowSelectionChange reports the next selection map', () => {
    const onRowSelectionChange = mock((_selection: Record<string, boolean>) => undefined)
    renderTable({ enableRowSelection: true, onRowSelectionChange })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }))
    expect(onRowSelectionChange).toHaveBeenCalledTimes(1)
    expect(onRowSelectionChange.mock.calls[0]?.[0]).toEqual({ '0': true })
  })

  test('ticking the box does NOT activate the row', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    renderTable({ enableRowSelection: true, onRowActivate })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }))
    expect(onRowActivate).not.toHaveBeenCalled()
  })

  test('the empty row spans the checkbox column too', () => {
    renderTable({ data: [], enableRowSelection: true })
    const cell = screen.getByText('No data to display.').closest('td')
    expect(cell?.getAttribute('colspan')).toBe(String(COLUMNS.length + 1))
  })

  test('no checkbox column at all without the flag', () => {
    renderTable()
    expect(screen.queryByRole('checkbox', { name: 'Select all rows' })).toBeNull()
  })

  test('getRowId pins the selection to the RECORD, so a re-sort carries it along', () => {
    // The default id is the row INDEX: without `getRowId`, sorting leaves "row 0" selected and a
    // different project moves into it.
    const { container } = renderTable({ enableRowSelection: true, getRowId: (row) => row.project })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }))
    expect(checkedRowText(container)).toContain('argo')

    fireEvent.click(screen.getByRole('columnheader', { name: /Project/ }))
    fireEvent.click(screen.getByRole('columnheader', { name: /Project/ }))
    expect(container.querySelector('tbody tr')?.textContent).toContain('linewatch')
    expect(checkedRowText(container)).toContain('argo')
  })

  test('controlled rowSelection is rendered from the prop and never from internal state', () => {
    const onRowSelectionChange = mock((_selection: Record<string, boolean>) => undefined)
    const { container } = renderTable({
      enableRowSelection: true,
      getRowId: (row) => row.project,
      rowSelection: { argo: true },
      onRowSelectionChange,
    })
    expect(checkedRowText(container)).toContain('argo')

    // The external store owns it: the table reports the NEXT map and renders nothing new until the
    // caller passes it back. A mirrored internal copy would tick the box here anyway.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 2' }))
    expect(onRowSelectionChange).toHaveBeenCalledTimes(1)
    expect(onRowSelectionChange.mock.calls[0]?.[0]).toEqual({ argo: true, linewatch: true })
    expect(checkedRowText(container)).toContain('argo')
    expect(container.querySelectorAll('tbody input[type="checkbox"]:checked')).toHaveLength(1)
  })

  test('a controlled selection re-rendered from the prop drives the bulk bar', () => {
    const { rerender } = render(
      <MantineProvider>
        <BasaltDataTable
          data={ROWS}
          columns={COLUMNS}
          enableRowSelection
          getRowId={(row) => row.project}
          rowSelection={{ argo: true }}
          bulkActions={(rows) => [{ key: 'x', label: `Archive ${rows.length}` }]}
        />
      </MantineProvider>,
    )
    expect(screen.getByText('1 selected')).toBeDefined()

    rerender(
      <MantineProvider>
        <BasaltDataTable
          data={ROWS}
          columns={COLUMNS}
          enableRowSelection
          getRowId={(row) => row.project}
          rowSelection={{ argo: true, linewatch: true }}
          bulkActions={(rows) => [{ key: 'x', label: `Archive ${rows.length}` }]}
        />
      </MantineProvider>,
    )
    expect(screen.getByText('2 selected')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Archive 2' }).length).toBeGreaterThan(0)
  })
})

// ── actions: BarAction[] | ReactNode (law C15) ────────────────────────────────

describe('actions — the widened toolbar slot', () => {
  test('a BarAction[] gets the C7 fold instead of a clipped row', () => {
    renderTable({
      actions: [
        { key: 'a', label: 'Alpha' },
        { key: 'b', label: 'Bravo' },
        { key: 'c', label: 'Charlie' },
        { key: 'd', label: 'Delta' },
      ],
    })
    const desktop = document.querySelector('.mantine-visible-from-sm')
    if (!desktop) throw new Error('expected the desktop action group')
    expect(desktop.textContent).toContain('Alpha')
    expect(desktop.textContent).not.toContain('Delta')
    expect(desktop.textContent).toContain('More')
  })

  test('a ReactNode slot is unchanged', () => {
    renderTable({ actions: <Text>Export</Text> })
    expect(screen.getByText('Export')).toBeDefined()
    expect(document.querySelector('.mantine-visible-from-sm')).toBeNull()
  })
})
