/**
 * DataDemoPage — exercises basalt-ui/table:
 * BasaltDataTable (sortable, filterable, paginated, isLoading, skeletonRows) and a second
 * BasaltDataTable demonstrating `enablePinning` over a wider column set.
 *
 * Edge states:
 *   • Clear data → the real `EmptyState` (tier="section") renders via `emptyState`.
 *   • Toggle isLoading → skeletonRows (5) render instead of real rows.
 *   • Search / department / role filters narrow the row set; the pagination bar tracks the
 *     filtered count.
 *
 * The table uses a small typed dataset with columns built by createColumnHelper.
 */
import { Button, Divider, Paper, Stack, Tabs } from '@mantine/core'
import { EmptyState, PageBar } from 'basalt-ui'
import { FilterSet, RangeFilter, SearchFilter, ViewTabs } from 'basalt-ui/controls'
import { createLocalStore, field } from 'basalt-ui/state'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { queryFor, retryCopy } from '../scenarios/shot-state'
import type { ScenarioProps } from '../scenarios/shot-state'
import { dataStressFilters } from './data-stress-store'
import { DataStressPage } from './DataStressPage'
import { DataTableChromeDemoPage } from './DataTableChromeDemoPage'
import { QueryDemoPage } from './QueryDemoPage'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { IconSearch } from './icons'

// The route's view switch, store-bound (law C3) so a back navigation lands on the tab left behind.
const dataViews = createLocalStore({
  key: 'data-view',
  fields: { tab: field.enum(['overview', 'chrome', 'stress', 'query'], 'overview') },
}).labels({
  tab: { overview: 'Employee tables', chrome: 'Table chrome', stress: 'Stress', query: 'Query' },
})

// ── Shared empty state and filter reset ────────────────────────────────────────

type TableProps = ComponentProps<typeof BasaltDataTable>
type ColumnFilters = NonNullable<TableProps['initialColumnFilters']>

/**
 * The table's filters are uncontrolled, so "clear" is a remount with no preset: the hook watches the
 * search and facet reports to know whether the empty table is the filters' doing.
 */
export function useFilterReset(preset: ColumnFilters = []) {
  const [state, setState] = useState({ resets: 0, search: '', facets: preset.length })
  return {
    tableKey: state.resets,
    initialColumnFilters: state.resets === 0 ? preset : [],
    onGlobalFilterChange: (search: string) => setState((s) => ({ ...s, search })),
    onColumnFiltersChange: (filters: ColumnFilters) =>
      setState((s) => ({ ...s, facets: filters.length })),
    filtered: state.search !== '' || state.facets > 0,
    clear: () => setState((s) => ({ resets: s.resets + 1, search: '', facets: 0 })),
  }
}

/**
 * One wording pattern for every table here: a title naming what is absent, a description with the
 * cause and the next step, and the one action only when filters are the cause.
 */
export function tableEmptyState({
  noun,
  total,
  cause,
  filtered,
  onClear,
}: {
  noun: string
  total: number
  cause: string
  filtered: boolean
  onClear?: () => void
}) {
  if (filtered && onClear !== undefined) {
    return (
      <EmptyState
        icon={<IconSearch />}
        title={`No ${noun} match`}
        description={`The search or filters exclude all ${total}. Clear them to see every one.`}
        action={<Button onClick={onClear}>Clear filters</Button>}
        tier="section"
      />
    )
  }
  return <EmptyState title={`No ${noun} listed`} description={cause} tier="section" />
}

// ── Table demo ────────────────────────────────────────────────────────────────

type Employee = {
  id: number
  name: string
  department: string
  role: string
  salary: number
}

const EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: 'Alice Müller',
    department: 'Engineering',
    role: 'Senior Engineer',
    salary: 95_000,
  },
  { id: 2, name: 'Bob Schmidt', department: 'Design', role: 'UX Designer', salary: 78_000 },
  { id: 3, name: 'Clara Bauer', department: 'Engineering', role: 'Tech Lead', salary: 115_000 },
  {
    id: 4,
    name: 'David Hoffmann',
    department: 'Product',
    role: 'Product Manager',
    salary: 105_000,
  },
  { id: 5, name: 'Eva Koch', department: 'Engineering', role: 'Junior Engineer', salary: 62_000 },
  { id: 6, name: 'Frank Weber', department: 'Design', role: 'Design Lead', salary: 90_000 },
  { id: 7, name: 'Grace Fischer', department: 'Product', role: 'Product Analyst', salary: 72_000 },
  { id: 8, name: 'Hans Meyer', department: 'Engineering', role: 'Staff Engineer', salary: 130_000 },
  { id: 9, name: 'Ines Wagner', department: 'Design', role: 'UX Designer', salary: 76_000 },
  { id: 10, name: 'Jonas Becker', department: 'Product', role: 'Product Manager', salary: 108_000 },
  {
    id: 11,
    name: 'Klara Schulz',
    department: 'Engineering',
    role: 'Senior Engineer',
    salary: 98_000,
  },
  {
    id: 12,
    name: 'Lukas Hofmann',
    department: 'Engineering',
    role: 'Junior Engineer',
    salary: 60_000,
  },
  { id: 13, name: 'Mara Zimmermann', department: 'Design', role: 'Design Lead', salary: 92_000 },
  { id: 14, name: 'Niklas Braun', department: 'Product', role: 'Product Analyst', salary: 70_000 },
  { id: 15, name: 'Olivia Krause', department: 'Engineering', role: 'Tech Lead', salary: 118_000 },
  { id: 16, name: 'Paul Lange', department: 'Design', role: 'UX Designer', salary: 80_000 },
  {
    id: 17,
    name: 'Quentin Schaefer',
    department: 'Product',
    role: 'Product Manager',
    salary: 110_000,
  },
  {
    id: 18,
    name: 'Rosa Vogel',
    department: 'Engineering',
    role: 'Staff Engineer',
    salary: 128_000,
  },
  {
    id: 19,
    name: 'Sara Huber',
    department: 'Engineering',
    role: 'Senior Engineer',
    salary: 96_000,
  },
  { id: 20, name: 'Tobias Peters', department: 'Product', role: 'Product Analyst', salary: 74_000 },
]

const col = createColumnHelper<Employee>()

// Accessor columns sort by value — BasaltDataTable accepts the heterogeneous
// array of createColumnHelper accessors so each keeps its own inferred value type.
// The unit and period live in the header (`Salary (USD / yr)`), so the cell prints the bare figure.
const groupedFigure = (value: number): string => value.toLocaleString('en-US')

const TABLE_COLUMNS = [
  col.accessor('name', { header: 'Name', meta: { kind: 'entity' } }),
  col.accessor('department', { header: 'Department', meta: { kind: 'text' } }),
  col.accessor('role', { header: 'Role', meta: { kind: 'text' } }),
  col.accessor('salary', {
    header: 'Salary (USD / yr)',
    cell: (ctx) => groupedFigure(ctx.getValue()),
    meta: { kind: 'money' },
  }),
]

// One single-select facet (department, 3 distinct values) + one multi-select facet (role, 8
// distinct values repeated across the 20-row dataset) — enough variety to exercise both facet
// shapes without drowning the demo in options.
const DEPARTMENT_OPTIONS = [
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Design', label: 'Design' },
  { value: 'Product', label: 'Product' },
]

const ROLE_OPTIONS = [
  { value: 'Senior Engineer', label: 'Senior Engineer' },
  { value: 'Tech Lead', label: 'Tech Lead' },
  { value: 'Staff Engineer', label: 'Staff Engineer' },
  { value: 'Junior Engineer', label: 'Junior Engineer' },
  { value: 'UX Designer', label: 'UX Designer' },
  { value: 'Design Lead', label: 'Design Lead' },
  { value: 'Product Manager', label: 'Product Manager' },
  { value: 'Product Analyst', label: 'Product Analyst' },
]

const TABLE_FACETS: NonNullable<ComponentProps<typeof BasaltDataTable>['facets']> = [
  { columnId: 'department', label: 'Department', options: DEPARTMENT_OPTIONS },
  { columnId: 'role', label: 'Any role', multiple: true, options: ROLE_OPTIONS },
]

function TableSection({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retryCopy('employee directory'))
  const reset = useFilterReset()
  return (
    <div data-compare="table" data-shot="employees-table" data-shot-states="empty loading error">
      <BasaltDataTable
        key={reset.tableKey}
        title="Employees, 3 departments"
        data={shotState === undefined ? EMPLOYEES : []}
        columns={TABLE_COLUMNS}
        enableSorting
        striped
        highlightOnHover
        skeletonRows={5}
        enableGlobalFilter
        searchIcon={<IconSearch />}
        facets={TABLE_FACETS}
        enablePagination
        initialColumnFilters={reset.initialColumnFilters}
        onGlobalFilterChange={reset.onGlobalFilterChange}
        onColumnFiltersChange={reset.onColumnFiltersChange}
        {...(query !== undefined && { query })}
        emptyState={tableEmptyState({
          noun: 'employees',
          total: EMPLOYEES.length,
          cause: 'The directory is empty. Employees appear here once they are added.',
          filtered: reset.filtered,
          onClear: reset.clear,
        })}
      />
    </div>
  )
}

// ── Column-pinning demo ───────────────────────────────────────────────────────

const LOCATIONS = ['Berlin', 'Remote', 'Munich', 'Amsterdam']
const LEVELS = ['L3', 'L4', 'L5', 'L6']

type PinnedEmployee = Employee & {
  level: string
  location: string
  startDate: Date
  projects: number
  utilization: number
}

// Extends the first 8 employees with enough extra columns (9 total) to force horizontal
// overflow — the point of this table is proving `enablePinning`, not a fresh dataset.
const PINNED_EMPLOYEES: PinnedEmployee[] = EMPLOYEES.slice(0, 8).map((employee, i) => ({
  ...employee,
  level: LEVELS[i % LEVELS.length]!,
  location: LOCATIONS[i % LOCATIONS.length]!,
  startDate: new Date(Date.UTC(2020 + (i % 4), i % 9, 15)),
  projects: 2 + (i % 5),
  utilization: 60 + i * 4,
}))

const pinnedCol = createColumnHelper<PinnedEmployee>()

const PINNED_COLUMNS = [
  pinnedCol.accessor('name', { header: 'Name', meta: { kind: 'entity' } }),
  pinnedCol.accessor('department', { header: 'Department', meta: { kind: 'text' } }),
  pinnedCol.accessor('role', { header: 'Role', meta: { kind: 'text' } }),
  pinnedCol.accessor('level', { header: 'Level', meta: { kind: 'text' } }),
  pinnedCol.accessor('location', { header: 'Location', meta: { kind: 'text' } }),
  pinnedCol.accessor('startDate', { header: 'Start date', meta: { kind: 'relative-time' } }),
  pinnedCol.accessor('projects', { header: 'Projects', meta: { kind: 'number' } }),
  pinnedCol.accessor('utilization', { header: 'Utilization (%)', meta: { kind: 'number' } }),
  pinnedCol.accessor('salary', {
    header: 'Salary (USD / yr)',
    cell: (ctx) => groupedFigure(ctx.getValue()),
    meta: { kind: 'money' },
  }),
]

function PinnedTableSection({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retryCopy('roster'))
  return (
    <div data-shot="roster-table" data-shot-states="empty loading error">
      <BasaltDataTable
        title="Employee roster, wide view"
        data={shotState === undefined ? PINNED_EMPLOYEES : []}
        columns={PINNED_COLUMNS}
        enablePinning
        initialColumnPinning={{ start: ['name'] }}
        striped
        {...(query !== undefined && { query })}
        emptyState={tableEmptyState({
          noun: 'staff',
          total: PINNED_EMPLOYEES.length,
          cause: 'The roster is empty. Staff appear here once they are added.',
          filtered: false,
        })}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DataDemoPage({ shotState }: ScenarioProps) {
  const [tab] = dataViews.field.tab.use()
  // No `p="md"` and no in-body `<Title>` — the shell pads Main and the breadcrumb names the page
  // (ComponentsPage's module doc states the wave's page-chrome rule).
  return (
    <Stack gap="md">
      {/* The route's ONE PageBar (law C6). It carries the tab set in row 2 — a raw four-item
          `Tabs.List` wraps to a two-line strip at 390px, `ViewTabs` collapses past three options to
          a phone `Select` in CSS (law C9) — and, while the Stress tab is showing, that tab's own
          store-bound toolbar. Those filters used to live in `DataStressPage`, but Mantine keeps an
          inactive `Tabs.Panel` mounted, so a bar declared down there was the route's bar on every
          tab and left no home for the tabs themselves. */}
      <PageBar
        tabs={<ViewTabs field={dataViews.field.tab} label="Demo" />}
        {...(tab === 'stress' && {
          filters: (
            <FilterSet>
              <RangeFilter field={dataStressFilters.field.range} />
              <SearchFilter field={dataStressFilters.field.query} placeholder="Find a session" />
            </FilterSet>
          ),
        })}
      />

      {/* `/data-table-chrome`, `/data-stress`, and `/query` absorbed here (audit E §7). Controlled
          off `dataViews` and rendering no `Tabs.List` of its own — the switch is the `ViewTabs` in
          the bar above. The panels stay Mantine's, so `keepMounted` behaviour is unchanged. */}
      <Tabs value={tab}>
        <Tabs.Panel value="overview">
          <Paper>
            <Stack gap="md">
              <TableSection shotState={shotState} />
              <Divider />
              <PinnedTableSection shotState={shotState} />
            </Stack>
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="chrome">
          <DataTableChromeDemoPage />
        </Tabs.Panel>
        <Tabs.Panel value="stress">
          <DataStressPage />
        </Tabs.Panel>
        <Tabs.Panel value="query">
          <QueryDemoPage />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
