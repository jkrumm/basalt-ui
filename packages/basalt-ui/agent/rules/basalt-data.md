---
source: basalt-ui
description: Data table and virtual list adapter battery from basalt-ui/data — BasaltDataTable (sortable TanStack Table + Mantine Table) and BasaltVirtualList (TanStack Virtual + Mantine Box). Both packages are optional peers.
paths:
  - 'src/**'
  - 'apps/**/src/**'
---

# Basalt Data

basalt-ui ships `./data` — a Mantine-coupled data adapter battery providing `BasaltDataTable` and
`BasaltVirtualList` backed by headless TanStack Table and TanStack Virtual respectively. Both
optional peers must be installed before use:

```bash
bun add @tanstack/react-table @tanstack/react-virtual
```

## BasaltDataTable

A generic sortable data table over `@tanstack/react-table`, rendered with Mantine `Table`
primitives (`Table.Thead/Tbody/Tr/Th/Td`). Client-side sorting is built in via `useState`; no
server-side wiring required.

```tsx
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data'

type User = { name: string; email: string; age: number }

const col = createColumnHelper<User>()
const columns = [
  col.accessor('name',  { header: 'Name'  }),
  col.accessor('email', { header: 'Email' }),
  col.accessor('age',   { header: 'Age'   }),
]

<BasaltDataTable
  data={users}
  columns={columns}
  enableSorting         // default true — clickable sort headers with ↑/↓ indicators
  striped
  highlightOnHover
  emptyState={<Text c="dimmed">No users found.</Text>}
/>
```

### Props

| Prop               | Type                        | Default  | Notes                                                  |
| ------------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `data`             | `T[]`                       | required | Row data array                                         |
| `columns`          | `ColumnDef<T>[]`            | required | TanStack column definitions                            |
| `enableSorting`    | `boolean`                   | `true`   | Clickable headers, asc/desc toggle                     |
| `striped`          | `boolean`                   | —        | Forwarded to Mantine `Table`                           |
| `highlightOnHover` | `boolean`                   | —        | Forwarded to Mantine `Table`                           |
| `emptyState`       | `ReactNode`                 | —        | Shown when `data` is empty and not loading             |
| `isLoading`        | `boolean`                   | `false`  | Shows skeleton rows instead of empty-state/data        |
| `skeletonRows`     | `number`                    | `5`      | Number of skeleton rows when `isLoading` is true       |
| `initialSorting`   | `SortingState`              | `[]`     | Initial sort state; drives `useState` initializer      |
| `onSortingChange`  | `(s: SortingState) => void` | —        | Called whenever sorting changes; omit for uncontrolled |

### Controlled sorting and URL sync

`initialSorting` seeds the internal `useState` and `onSortingChange` is called on every sort
change — the table stays internally managed (uncontrolled) when `onSortingChange` is omitted.

To sync sort state with TanStack Router search params:

```tsx
import { type SortingState } from 'basalt-ui/data'

// In the route definition (validated search params):
// sortBy: z.string().optional(), sortDir: z.enum(['asc','desc']).optional()

function UsersTable() {
  const { sortBy, sortDir } = Route.useSearch()
  const navigate = Route.useNavigate()

  const initialSorting: SortingState = sortBy ? [{ id: sortBy, desc: sortDir === 'desc' }] : []

  return (
    <BasaltDataTable
      data={users}
      columns={columns}
      initialSorting={initialSorting}
      onSortingChange={(s) => {
        const col = s[0]
        navigate({
          search: (prev) => ({
            ...prev,
            sortBy: col?.id,
            sortDir: col?.desc ? 'desc' : 'asc',
          }),
        })
      }}
    />
  )
}
```

### Column definitions

Use `createColumnHelper<T>()` (re-exported from `basalt-ui/data`) for a typed accessor builder.
`ColumnDef<T>` is generic over the row type only — `TValue` defaults to `unknown`, so no `any`
is needed.

```ts
import { createColumnHelper, type ColumnDef } from 'basalt-ui/data'

type Row = { id: number; label: string }
const col = createColumnHelper<Row>()

// Accessor column — infers the value type from the key
col.accessor('label', { header: 'Label' })

// Display column — custom renderer, no accessor
col.display({ id: 'actions', header: 'Actions', cell: (ctx) => <Button>Delete {ctx.row.original.id}</Button> })
```

### No `any`

`ColumnDef<T>` defaults `TValue` to `unknown`, not `any`. Never cast column defs to `any` — use
the correct `ColumnDef<T>` type or `ColumnDef<T, unknown>`.

### Deferred for later versions

The 1.0 table ships sorting only. Natural extensions are **not** in scope yet:

- Filtering (column or global search)
- Pagination (client-side or server-side)
- Row selection (checkboxes)
- Row expansion / sub-rows

Add them when a concrete consumer need arises; keep the API additive.

## BasaltVirtualList

A windowed virtual list backed by TanStack Virtual, rendered inside a Mantine `Box` scroll
container. Only the visible rows plus `overscan` are in the DOM at any time — suitable for lists
of 1 000+ items.

```tsx
import { BasaltVirtualList } from 'basalt-ui/data'

const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, name: `Row ${i}` }))

<BasaltVirtualList
  items={items}
  height={400}
  estimateSize={40}
  overscan={5}
  renderItem={(item, index) => (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>
      {index + 1}. {item.name}
    </div>
  )}
  getItemKey={(item) => item.id}
/>
```

### Props

| Prop           | Type                                           | Default  | Notes                                             |
| -------------- | ---------------------------------------------- | -------- | ------------------------------------------------- |
| `items`        | `T[]`                                          | required | Full unsliced item list                           |
| `height`       | `number \| string`                             | required | Scroll container height (px number or CSS string) |
| `estimateSize` | `number`                                       | `40`     | Estimated row height for layout (px)              |
| `overscan`     | `number`                                       | `5`      | Extra rows rendered beyond visible viewport       |
| `renderItem`   | `(item: T, index: number) => ReactNode`        | required | Row render function                               |
| `getItemKey`   | `(item: T, index: number) => string \| number` | —        | Stable key (defaults to index)                    |
| `isLoading`    | `boolean`                                      | `false`  | Shows skeleton rows at `estimateSize` height      |
| `skeletonRows` | `number`                                       | `5`      | Number of skeleton rows when `isLoading` is true  |

### useFlushSync: false (React 19)

Always pass `useFlushSync: false` to `useVirtualizer`. TanStack Virtual internally calls the
deprecated `flushSync` on scroll events; this opt-out disables that path and is required for React
19+ apps (silences a runtime warning). `BasaltVirtualList` sets this automatically — do not
override it.

### Absolute-position transform pattern

The virtual list uses the canonical TanStack Virtual render pattern:

1. **Scroll container** — fixed height, `overflow: auto`, holds a `ref` passed to `getScrollElement`.
2. **Inner sizer div** — height equals `getTotalSize()`, position `relative` — defines the total
   scrollable area without rendering all rows.
3. **Virtual rows** — absolutely positioned (`position: absolute`, `top: 0`, `left: 0`) with
   `transform: translateY(vi.start)` — each row "jumps" to its virtual position without relayout.

Never use `margin-top` or `top: vi.start` for positioning — the `transform` approach avoids
layout reflow and is the canonical pattern for TanStack Virtual.

### When to virtualize

Use `BasaltVirtualList` when the list exceeds ~200 rows. Below that, a plain Mantine `Stack` or
`Table` is cheaper (no virtualizer overhead, simpler DOM, easier accessibility). Above ~1 000
rows, virtualization is essential for scroll performance.
