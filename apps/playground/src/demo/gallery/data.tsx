/**
 * The gallery's data block: `BasaltDataTable` in its toolbar, directory, pinned and capped forms,
 * plus `unwrap` against the router's QueryClient. The `data-shot*` attributes are the targets of
 * `basalt-ui shot`; a shot state swaps the rows for the component's own empty / loading / error
 * branch instead of faking it.
 */
import { Alert, Badge, Button, Group, Stack, Switch, Text } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Section, unwrap } from 'basalt-ui'
import { date } from 'basalt-ui/format'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { queryFor, retryCopy } from '../../scenarios/shot-state'
import type { ShotState } from '../../scenarios/shot-state'
import { IconSearch } from '../icons'
import { RELOAD_STEP } from '../table-copy'
import { tableEmptyState, useFilterReset } from '../table-empty-state'

type Facets = NonNullable<ComponentProps<typeof BasaltDataTable>['facets']>
type Props = { shotState: ShotState | undefined }

const options = (values: string[]) => values.map((value) => ({ value, label: value }))

// ── Toolbar table: title, search, two facets and an action on one row ───────────────────────────

type Lift = { id: number; exercise: string; block: string; load: number }

const LIFTS: Lift[] = [
  { id: 1, exercise: 'Squat', block: 'Strength', load: 140 },
  { id: 2, exercise: 'Bench press', block: 'Strength', load: 100 },
  { id: 3, exercise: 'Deadlift', block: 'Strength', load: 180 },
  { id: 4, exercise: 'Squat', block: 'Volume', load: 110 },
  { id: 5, exercise: 'Bench press', block: 'Volume', load: 80 },
  { id: 6, exercise: 'Overhead press', block: 'Volume', load: 60 },
]

// A facet the Exercise column does not repeat: every kept row still names a different lift.
const PRESET_FILTERS = [{ id: 'block', value: 'Strength' }]
const PRESET_ROWS = LIFTS.filter((l) => l.block === 'Strength').length

const lift = createColumnHelper<Lift>()
const LIFT_COLUMNS = [
  lift.accessor('exercise', { header: 'Exercise', meta: { kind: 'entity' } }),
  lift.accessor('block', { header: 'Block', meta: { kind: 'text' } }),
  lift.accessor('load', { header: 'Load (kg)', meta: { kind: 'number' } }),
]

const LIFT_FACETS: Facets = [
  {
    columnId: 'exercise',
    label: 'Exercise',
    options: options(['Squat', 'Bench press', 'Deadlift', 'Overhead press']),
  },
  { columnId: 'block', label: 'Block', options: options(['Strength', 'Volume']) },
]

function ToolbarTable({ shotState }: Props) {
  const query = queryFor(shotState, retryCopy('workout log'))
  const atRest = shotState === undefined
  const reset = useFilterReset(atRest ? PRESET_FILTERS : [], atRest)
  return (
    <div data-shot="table-toolbar" data-shot-states="empty loading error">
      <BasaltDataTable
        key={reset.tableKey}
        title="Workouts, last 30 days"
        skeletonRows={PRESET_ROWS}
        // Rows only at rest: the empty branch needs `data` empty, the others have no rows yet.
        data={atRest ? LIFTS : []}
        initialColumnFilters={reset.initialColumnFilters}
        onGlobalFilterChange={reset.onGlobalFilterChange}
        onColumnFiltersChange={reset.onColumnFiltersChange}
        {...(query !== undefined && { query })}
        emptyState={tableEmptyState({
          noun: 'workouts',
          total: LIFTS.length,
          cause: 'No workout was logged in the last 30 days. Log one to see it here.',
          filtered: reset.filtered,
          onClear: reset.clear,
        })}
        columns={LIFT_COLUMNS}
        enableGlobalFilter
        facets={LIFT_FACETS}
        actions={[{ key: 'export', label: 'Export CSV', onClick: () => undefined }]}
      />
    </div>
  )
}

// ── Directory table (sort, search, facets, pagination) and the pinned roster ────────────────────

type Employee = {
  id: number
  name: string
  department: string
  role: string
  salary: number
  level: string
  location: string
  startDate: Date
  projects: number
  utilization: number
}

const PEOPLE: [string, string, string, number][] = [
  ['Alice Müller', 'Engineering', 'Senior Engineer', 95_000],
  ['Bob Schmidt', 'Design', 'UX Designer', 78_000],
  ['Clara Bauer', 'Engineering', 'Tech Lead', 115_000],
  ['David Hoffmann', 'Product', 'Product Manager', 105_000],
  ['Eva Koch', 'Engineering', 'Junior Engineer', 62_000],
  ['Frank Weber', 'Design', 'Design Lead', 90_000],
  ['Grace Fischer', 'Product', 'Product Analyst', 72_000],
  ['Hans Meyer', 'Engineering', 'Staff Engineer', 130_000],
  ['Ines Wagner', 'Design', 'UX Designer', 76_000],
  ['Jonas Becker', 'Product', 'Product Manager', 108_000],
  ['Klara Schulz', 'Engineering', 'Senior Engineer', 98_000],
  ['Lukas Hofmann', 'Engineering', 'Junior Engineer', 60_000],
]

const LOCATIONS = ['Berlin', 'Remote', 'Munich', 'Amsterdam']
const LEVELS = ['L3', 'L4', 'L5', 'L6']

const EMPLOYEES: Employee[] = PEOPLE.map(([name, department, role, salary], i) => ({
  id: i + 1,
  name,
  department,
  role,
  salary,
  level: LEVELS[i % LEVELS.length] ?? '',
  location: LOCATIONS[i % LOCATIONS.length] ?? '',
  startDate: new Date(Date.UTC(2020 + (i % 4), i % 9, 15)),
  projects: 2 + (i % 5),
  utilization: 60 + i * 4,
}))

const emp = createColumnHelper<Employee>()
const grouped = (value: number): string => value.toLocaleString('en-US')
const salary = emp.accessor('salary', {
  header: 'Salary (USD / yr)',
  cell: (ctx) => grouped(ctx.getValue()),
  meta: { kind: 'money' },
})
const name = emp.accessor('name', { header: 'Name', meta: { kind: 'entity' } })
const department = emp.accessor('department', { header: 'Department', meta: { kind: 'text' } })

const DIRECTORY_COLUMNS = [name, department, emp.accessor('role', { header: 'Role' }), salary]
const ROSTER_COLUMNS = [
  name,
  department,
  emp.accessor('level', { header: 'Level', meta: { kind: 'text' } }),
  emp.accessor('location', { header: 'Location', meta: { kind: 'text' } }),
  emp.accessor('startDate', {
    header: 'Start date',
    cell: (ctx) => date(ctx.getValue(), { timeZone: 'UTC' }),
    meta: { kind: 'text' },
  }),
  emp.accessor('projects', { header: 'Projects', meta: { kind: 'number' } }),
  emp.accessor('utilization', { header: 'Utilization (%)', meta: { kind: 'number' } }),
  salary,
]

const DIRECTORY_FACETS: Facets = [
  {
    columnId: 'department',
    label: 'Department',
    options: options(['Engineering', 'Design', 'Product']),
  },
  {
    columnId: 'role',
    label: 'Any role',
    multiple: true,
    options: options([...new Set(PEOPLE.map(([, , role]) => role))]),
  },
]

function DirectoryTable({ shotState }: Props) {
  const query = queryFor(shotState, retryCopy('employee directory'))
  const reset = useFilterReset([], shotState === undefined)
  return (
    <div data-compare="table" data-shot="employees-table" data-shot-states="empty loading error">
      <BasaltDataTable
        key={reset.tableKey}
        title="Employees, 3 departments"
        data={shotState === undefined ? EMPLOYEES : []}
        columns={DIRECTORY_COLUMNS}
        enableSorting
        striped
        highlightOnHover
        skeletonRows={5}
        enableGlobalFilter
        searchIcon={<IconSearch />}
        facets={DIRECTORY_FACETS}
        enablePagination
        initialColumnFilters={reset.initialColumnFilters}
        onGlobalFilterChange={reset.onGlobalFilterChange}
        onColumnFiltersChange={reset.onColumnFiltersChange}
        {...(query !== undefined && { query })}
        emptyState={tableEmptyState({
          noun: 'employees',
          total: EMPLOYEES.length,
          cause: `No employee records were returned by the directory service. ${RELOAD_STEP}`,
          filtered: reset.filtered,
          onClear: reset.clear,
        })}
      />
    </div>
  )
}

function RosterTable({ shotState }: Props) {
  const query = queryFor(shotState, retryCopy('roster'))
  const rows = EMPLOYEES.slice(0, 8)
  return (
    <div data-shot="roster-table" data-shot-states="empty loading error">
      <BasaltDataTable
        title={`Employee roster, ${LOCATIONS.length} locations`}
        data={shotState === undefined ? rows : []}
        columns={ROSTER_COLUMNS}
        enablePinning
        initialColumnPinning={{ start: ['name'] }}
        striped
        skeletonRows={rows.length}
        {...(query !== undefined && { query })}
        emptyState={tableEmptyState({
          noun: 'staff',
          total: rows.length,
          cause: `No staff records were returned by the roster feed. ${RELOAD_STEP}`,
          filtered: false,
        })}
      />
    </div>
  )
}

// ── Body chrome: capped body, sticky header, per-column alignment ───────────────────────────────

type Session = { when: string; distanceKm: number; durationMin: number; steps: number }

const SESSIONS: Session[] = Array.from({ length: 40 }, (_, i) => ({
  when: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
  distanceKm: Number((2 + (i % 7) * 0.63).toFixed(2)),
  durationMin: 24 + (i % 11) * 3,
  steps: 3200 + i * 137,
}))

const session = createColumnHelper<Session>()
const chromeColumns = (align: 'left' | 'right') => [
  session.accessor('when', { header: 'When' }),
  session.accessor('distanceKm', { header: 'Distance (km)', meta: { align } }),
  session.accessor('durationMin', { header: 'Duration (min)', meta: { align } }),
  session.accessor('steps', { header: 'Steps', meta: { align } }),
]

function ChromeTable() {
  const [capped, setCapped] = useState(true)
  const [sticky, setSticky] = useState(true)
  const [aligned, setAligned] = useState(true)
  return (
    <Section
      title="Capped body, sticky header, column alignment"
      subtitle="40 rows in a table that must not grow past 320px."
      actions={[
        {
          key: 'flags',
          kind: 'custom',
          node: (
            <Group gap="sm" wrap="wrap">
              <Switch
                label="maxHeight 320"
                checked={capped}
                onChange={(e) => setCapped(e.currentTarget.checked)}
              />
              <Switch
                label="stickyHeader"
                checked={sticky}
                onChange={(e) => setSticky(e.currentTarget.checked)}
              />
              <Switch
                label="Right-aligned"
                checked={aligned}
                onChange={(e) => setAligned(e.currentTarget.checked)}
              />
            </Group>
          ),
        },
      ]}
    >
      <BasaltDataTable
        title="Session history"
        data={SESSIONS}
        columns={chromeColumns(aligned ? 'right' : 'left')}
        striped
        highlightOnHover
        verticalSpacing="xs"
        minWidth={640}
        stickyHeader={sticky}
        {...(capped && { maxHeight: 320 })}
      />
    </Section>
  )
}

// ── Query: `unwrap` over a mock Eden-shaped envelope ────────────────────────────────────────────

type Metric = { id: number; label: string; value: number; unit: string }

const METRICS: Metric[] = [
  { id: 1, label: 'Active users', value: 1_284, unit: 'users' },
  { id: 2, label: 'Avg session', value: 4.7, unit: 'min' },
  { id: 3, label: 'P95 latency', value: 212, unit: 'ms' },
]

/** An Eden Treaty `.get()` stand-in: a `{ data, error }` envelope, no backend. */
const mockFetchMetrics = (forceError: boolean) =>
  Promise.resolve(
    forceError
      ? { data: null, error: { message: 'Simulated server error (500)' } }
      : { data: METRICS, error: null },
  )

const metric = createColumnHelper<Metric>()
const METRIC_COLUMNS = [
  metric.accessor('label', { header: 'Metric' }),
  metric.accessor('value', { header: 'Value', meta: { kind: 'number' } }),
  metric.accessor('unit', {
    header: 'Unit',
    cell: (ctx) => (
      <Badge size="sm" variant="light">
        {ctx.getValue()}
      </Badge>
    ),
  }),
]

function QueryBlock() {
  const client = useQueryClient()
  const [forceError, setForceError] = useState(false)
  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['demo', 'metrics', forceError],
    queryFn: () => unwrap(mockFetchMetrics(forceError)),
    retry: false,
  })
  return (
    <Section
      title="Query"
      subtitle="createBasaltRouter owns the client; unwrap throws on the error envelope and drives the query into its error state."
      actions={[
        {
          key: 'error',
          kind: 'custom',
          node: (
            <Switch
              label="Force error envelope"
              checked={forceError}
              onChange={(e) => setForceError(e.currentTarget.checked)}
            />
          ),
        },
      ]}
    >
      {isError ? (
        <Stack gap="xs">
          <Alert color="red" title="Query error">
            {error instanceof Error ? error.message : String(error)}
          </Alert>
          <Button
            size="compact-sm"
            variant="default"
            onClick={() => void client.invalidateQueries({ queryKey: ['demo', 'metrics'] })}
          >
            Retry
          </Button>
        </Stack>
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {isFetching ? 'Fetching…' : `${data?.length ?? 0} rows loaded via unwrap()`}
          </Text>
          <BasaltDataTable data={data ?? []} columns={METRIC_COLUMNS} striped />
        </Stack>
      )}
    </Section>
  )
}

/** The gallery's data block: every table form once, then the query client. */
export function DataSection({ shotState }: Props) {
  return (
    <Stack gap="md">
      <Section title="Data tables" subtitle="Toolbar, directory and pinned roster.">
        <Stack gap="md">
          <ToolbarTable key={shotState ?? 'rest'} shotState={shotState} />
          <DirectoryTable shotState={shotState} />
          <RosterTable shotState={shotState} />
        </Stack>
      </Section>
      <ChromeTable />
      <QueryBlock />
    </Stack>
  )
}
