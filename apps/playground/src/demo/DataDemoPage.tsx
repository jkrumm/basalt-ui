/**
 * DataDemoPage — exercises basalt-ui/data:
 * BasaltDataTable (sortable, filterable, paginated, isLoading, skeletonRows), a second
 * BasaltDataTable demonstrating `enablePinning` over a wider column set, + BasaltVirtualList
 * (1 000 rows).
 *
 * Edge states:
 *   • Clear data → the real `EmptyState` (variant="section") renders via `emptyState`.
 *   • Toggle isLoading → skeletonRows (5) render instead of real rows.
 *   • Search / department / role filters narrow the row set; the pagination bar tracks the
 *     filtered count.
 *
 * The table uses a small typed dataset with ColumnDef<T>[] columns (createColumnHelper).
 * The virtual list renders 1 000 items in a fixed-height 300px box to prove windowing.
 */
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import { BasaltDataTable, BasaltVirtualList, createColumnHelper } from 'basalt-ui/data'
import type { DataTableFacet, SortingState } from 'basalt-ui/data'
import { VX } from 'basalt-ui/tokens'
import { useMemo, useState } from 'react'
import { IconSearch } from './icons'

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
// ColumnDef<Employee, any>[] so each accessor keeps its own inferred value type.
const TABLE_COLUMNS = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('department', { header: 'Department' }),
  col.accessor('role', { header: 'Role' }),
  col.accessor('salary', {
    header: 'Salary',
    cell: (ctx) => `$${ctx.getValue().toLocaleString()}`,
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

const TABLE_FACETS: DataTableFacet[] = [
  { columnId: 'department', label: 'Department', options: DEPARTMENT_OPTIONS },
  { columnId: 'role', label: 'Role', multiple: true, options: ROLE_OPTIONS },
]

function TableSection() {
  const [isLoading, setIsLoading] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [lastSorting, setLastSorting] = useState<SortingState | null>(null)
  const data = cleared ? [] : EMPLOYEES

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          BasaltDataTable — sortable, filterable, paginated employee table
        </Text>
        <Group gap="xs">
          <Switch
            size="sm"
            label="isLoading"
            checked={isLoading}
            onChange={(e) => setIsLoading(e.currentTarget.checked)}
          />
          <Button
            size="compact-xs"
            variant={cleared ? 'filled' : 'default'}
            color={cleared ? 'teal' : 'gray'}
            onClick={() => setCleared((v) => !v)}
          >
            {cleared ? 'Restore data' : 'Clear data'}
          </Button>
        </Group>
      </Group>
      <Text size="sm">
        Search, filter by department or role, and page through the results (10 rows/page). Toggle{' '}
        <em>isLoading</em> → skeleton rows appear (5). Click <em>Clear data</em> → the real{' '}
        <code>EmptyState</code> renders below. <code>onSortingChange</code> is the search-param-sync
        seam — click any header and observe the state update below (mirror:{' '}
        <code>navigate({'{ search: { sorting } }'})</code>
        in a real TanStack Router app).
      </Text>
      <BasaltDataTable
        data={data}
        columns={TABLE_COLUMNS}
        enableSorting
        striped
        highlightOnHover
        isLoading={isLoading}
        skeletonRows={5}
        enableGlobalFilter
        searchIcon={<IconSearch />}
        facets={TABLE_FACETS}
        enablePagination
        emptyState={
          <EmptyState
            icon={<IconSearch />}
            title="No employees found"
            description="Try adjusting your filters or search terms."
            variant="section"
          />
        }
        onSortingChange={setLastSorting}
      />
      {lastSorting !== null && (
        <Text size="xs" c="dimmed" ff="monospace">
          onSortingChange → {JSON.stringify(lastSorting)}
        </Text>
      )}
    </Stack>
  )
}

// ── Column-pinning demo ───────────────────────────────────────────────────────

const LOCATIONS = ['Berlin', 'Remote', 'Munich', 'Amsterdam']
const LEVELS = ['L3', 'L4', 'L5', 'L6']

type PinnedEmployee = Employee & {
  level: string
  location: string
  startDate: string
  projects: number
  utilization: number
}

// Extends the first 8 employees with enough extra columns (9 total) to force horizontal
// overflow — the point of this table is proving `enablePinning`, not a fresh dataset.
const PINNED_EMPLOYEES: PinnedEmployee[] = EMPLOYEES.slice(0, 8).map((employee, i) => ({
  ...employee,
  level: LEVELS[i % LEVELS.length]!,
  location: LOCATIONS[i % LOCATIONS.length]!,
  startDate: `202${i % 4}-0${(i % 9) + 1}-15`,
  projects: 2 + (i % 5),
  utilization: 60 + i * 4,
}))

const pinnedCol = createColumnHelper<PinnedEmployee>()

const PINNED_COLUMNS = [
  pinnedCol.accessor('name', { header: 'Name' }),
  pinnedCol.accessor('department', { header: 'Department' }),
  pinnedCol.accessor('role', { header: 'Role' }),
  pinnedCol.accessor('level', { header: 'Level' }),
  pinnedCol.accessor('location', { header: 'Location' }),
  pinnedCol.accessor('startDate', { header: 'Start date' }),
  pinnedCol.accessor('projects', { header: 'Projects' }),
  pinnedCol.accessor('utilization', {
    header: 'Utilization',
    cell: (ctx) => `${ctx.getValue()}%`,
  }),
  pinnedCol.accessor('salary', {
    header: 'Salary',
    cell: (ctx) => `$${ctx.getValue().toLocaleString()}`,
  }),
]

function PinnedTableSection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        BasaltDataTable — enablePinning (9 columns, name pinned left)
      </Text>
      <Text size="sm">
        Scroll horizontally — the <em>Name</em> column stays pinned to the left edge with a hairline
        shadow marking the seam, via <code>initialColumnPinning</code>.
      </Text>
      <BasaltDataTable
        data={PINNED_EMPLOYEES}
        columns={PINNED_COLUMNS}
        enablePinning
        initialColumnPinning={{ left: ['name'] }}
        striped
      />
    </Stack>
  )
}

// ── Virtual list demo ─────────────────────────────────────────────────────────

type ListRow = { id: number; label: string; category: string }

const CATEGORIES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']

function VirtualListSection() {
  const items = useMemo<ListRow[]>(
    () =>
      Array.from({ length: 1_000 }, (_, i) => ({
        id: i,
        label: `Item #${String(i + 1).padStart(4, '0')}`,
        category: CATEGORIES[i % CATEGORIES.length] ?? 'Alpha',
      })),
    [],
  )

  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        BasaltVirtualList — 1 000 rows (300 px height)
      </Text>
      <Text size="sm">
        Only the visible rows + <code>overscan</code> are mounted. Scroll to verify windowing.
        Powered by <code>@tanstack/react-virtual</code> with <code>useFlushSync: false</code> (React
        19 safe).
      </Text>
      <BasaltVirtualList
        items={items}
        height={300}
        estimateSize={40}
        overscan={5}
        getItemKey={(item) => item.id}
        renderItem={(item, index) => (
          <Box
            style={{
              height: '100%',
              borderBottom: '1px solid var(--vx-surface-border)',
              background: index % 2 === 0 ? VX.surface.bg : VX.surface.subtle,
            }}
          >
            <Group px="xs" h="100%" justify="space-between" align="center" wrap="nowrap">
              <Text size="sm">{item.label}</Text>
              <Badge size="xs" variant="light">
                {item.category}
              </Badge>
            </Group>
          </Box>
        )}
      />
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DataDemoPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./data adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          BasaltDataTable (TanStack Table + Mantine) + BasaltVirtualList (TanStack Virtual +
          Mantine)
        </Text>
      </div>

      <Paper p="sm">
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            About
          </Text>
          <Text size="sm">
            The <code>./data</code> battery provides two headless-backed, Mantine-rendered
            primitives: a sortable, filterable, paginated data table and a windowed virtual list.
            Both optional peers (<code>@tanstack/react-table</code> +{' '}
            <code>@tanstack/react-virtual</code>) must be installed by the consumer. The table's
            toolbar (global search + faceted Select/MultiSelect filters), its pagination bar, and
            sticky column pinning are all opt-in chrome — row selection is still out of scope for
            1.0.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm">
        <Stack gap="md">
          <TableSection />
          <Divider />
          <PinnedTableSection />
          <Divider />
          <VirtualListSection />
        </Stack>
      </Paper>
    </Stack>
  )
}
