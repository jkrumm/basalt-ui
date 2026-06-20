/**
 * DataDemoPage — exercises basalt-ui/data:
 * BasaltDataTable (sortable, striped) + BasaltVirtualList (1 000 generated rows, 300px height).
 *
 * The table uses a small typed dataset with ColumnDef<T>[] columns (createColumnHelper).
 * The virtual list renders 1 000 items in a fixed-height 300px box to prove windowing.
 */
import { Badge, Divider, Paper, Stack, Text, Title } from '@mantine/core'
import { BasaltDataTable, BasaltVirtualList, createColumnHelper } from 'basalt-ui/data'
import { useMemo } from 'react'

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

function TableSection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        BasaltDataTable — sortable employee table
      </Text>
      <Text size="sm">
        Click any column header to sort ascending / descending. A ↑/↓ indicator shows the active
        sort direction. Powered by <code>@tanstack/react-table</code> (headless logic) and Mantine{' '}
        <code>Table</code> (markup + styles).
      </Text>
      <BasaltDataTable
        data={EMPLOYEES}
        columns={TABLE_COLUMNS}
        enableSorting
        striped
        highlightOnHover
        emptyState={<Text c="dimmed">No employees found.</Text>}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              height: '100%',
              borderBottom: '1px solid var(--mantine-color-default-border)',
              background:
                index % 2 === 0
                  ? 'var(--mantine-color-body)'
                  : 'var(--mantine-color-default-hover)',
            }}
          >
            <Text size="sm">{item.label}</Text>
            <Badge size="xs" variant="light">
              {item.category}
            </Badge>
          </div>
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

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            About
          </Text>
          <Text size="sm">
            The <code>./data</code> battery provides two headless-backed, Mantine-rendered
            primitives: a sortable data table and a windowed virtual list. Both optional peers (
            <code>@tanstack/react-table</code> + <code>@tanstack/react-virtual</code>) must be
            installed by the consumer. No filtering, pagination, or row selection in 1.0.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="md">
          <TableSection />
          <Divider />
          <VirtualListSection />
        </Stack>
      </Paper>
    </Stack>
  )
}
