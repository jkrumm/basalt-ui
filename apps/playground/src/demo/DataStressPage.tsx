/**
 * DataStressPage — audit-c-charts.md top-15 #6 and #14: `BasaltDataTable` with `manualPagination`
 * inside a `Section` under a sticky `PageBar` toolbar (store-bound `RangeFilter` + `SearchFilter`),
 * `stickyHeader` clearing the measured `--basalt-page-bar-h`, and `minWidth` forcing horizontal
 * scroll at phone width — plus `BasaltVirtualList` (imported from the narrow `basalt-ui/data/virtual`
 * subpath, audit-b-components.md #17) with a `LineSparkline` per row and the ref handle
 * (`scrollToIndex`/`scrollToEnd`).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Group, Stack, Text } from '@mantine/core'
import { PageAside, PageBar, Section } from 'basalt-ui'
import type { QueryStateLike } from 'basalt-ui'
import { overlays } from 'basalt-ui/commands'
import { FilterSet, RangeFilter, SearchFilter, ViewTabs } from 'basalt-ui/controls'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
import { BasaltVirtualList } from 'basalt-ui/data/virtual'
import type { BasaltVirtualListHandle } from 'basalt-ui/data/virtual'
import { LineSparkline, VX } from 'basalt-ui/charts'
import { notifySuccess, notifyUndo } from 'basalt-ui/notifications'
import type { PaginationState } from '@tanstack/react-table'
import { createLocalStore, field } from 'basalt-ui/state'
import { dataStressFilters } from './data-stress-store'

// ── The manually-paginated table ─────────────────────────────────────────────────────────────────

type Session = {
  id: number
  session: string
  region: string
  device: string
  browser: string
  durationMin: number
  revenueUsd: number
  daysAgo: number
}

const REGIONS = ['us-east', 'eu-west', 'ap-south', 'sa-east']
const DEVICES = ['Desktop', 'Mobile', 'Tablet']
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge']

const ALL_SESSIONS: Session[] = Array.from({ length: 240 }, (_, i) => ({
  id: i,
  session: `fuji/2026-session-${String(i + 1).padStart(4, '0')}`,
  region: REGIONS[i % REGIONS.length]!,
  device: DEVICES[i % DEVICES.length]!,
  browser: BROWSERS[i % BROWSERS.length]!,
  durationMin: 2 + ((i * 7) % 58),
  revenueUsd: (i * 13) % 400,
  daysAgo: i % 90,
}))

const col = createColumnHelper<Session>()

const COLUMNS = [
  col.accessor('session', { header: 'Session' }),
  col.accessor('region', { header: 'Region' }),
  col.accessor('device', { header: 'Device' }),
  col.accessor('browser', { header: 'Browser' }),
  col.accessor('durationMin', { header: 'Duration (min)', meta: { align: 'right' } }),
  col.accessor('revenueUsd', {
    header: 'Revenue',
    meta: { align: 'right' },
    cell: (ctx) => `$${ctx.getValue()}`,
  }),
]

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
const PAGE_SIZE = 10

// The table's own view axis (law C3, local lane) — a demo `QueryStateLike` through all four
// branches, same pattern `StatesPage`'s chart drives.
const TABLE_QUERY_VARIANTS = ['pending', 'error', 'empty', 'data'] as const
type TableQueryVariant = (typeof TABLE_QUERY_VARIANTS)[number]

const TABLE_QUERY_OPTIONS: { value: TableQueryVariant; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
  { value: 'data', label: 'Data' },
]

const tableViews = createLocalStore({
  key: 'data-stress-table-query',
  fields: { queryVariant: field.enum(TABLE_QUERY_VARIANTS, 'data') },
}).labels({
  queryVariant: { pending: 'Pending', error: 'Error', empty: 'Empty', data: 'Data' },
})

function buildTableQuery(
  variant: TableQueryVariant,
  page: Session[],
  refetch: () => void,
): QueryStateLike<Session[]> {
  const base = { isError: false, error: null, refetch } as const
  switch (variant) {
    case 'data':
      return { ...base, data: page, fetchStatus: 'idle' }
    case 'empty':
      return { ...base, data: [], fetchStatus: 'idle' }
    case 'pending':
      return { ...base, data: undefined, fetchStatus: 'fetching' }
    case 'error':
      return {
        ...base,
        isError: true,
        error: { status: 500, value: { message: 'the sessions index is rebuilding' } },
        data: undefined,
        fetchStatus: 'idle',
      }
  }
}

type ManualPaginationTableProps = {
  /** The live row set, derived one level up — the aside reads the same array (see `DataStressPage`). */
  filtered: Session[]
  setRemovedIds: (update: (prev: ReadonlySet<number>) => ReadonlySet<number>) => void
  onRowActivate: (row: Session) => void
}

function ManualPaginationTable({
  filtered,
  setRemovedIds,
  onRowActivate,
}: ManualPaginationTableProps) {
  const [queryVariant] = tableViews.field.queryVariant.use()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  // Filtering can shrink the row set below the current page — clamp rather than render an empty
  // page with a live "next" control pointing nowhere.
  const pageCount = Math.max(Math.ceil(filtered.length / pagination.pageSize), 1)
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1)
  const page = filtered.slice(
    pageIndex * pagination.pageSize,
    (pageIndex + 1) * pagination.pageSize,
  )
  const tableQuery = useMemo(
    () => buildTableQuery(queryVariant, page, () => {}),
    [queryVariant, page],
  )

  return (
    <Section
      title="Sessions"
      subtitle="manualPagination — the table renders exactly one page; the pager bar reads 'of N' from rowCount, not from data.length"
      count={filtered.length}
      actions={
        <ViewTabs
          field={tableViews.field.queryVariant}
          label="Query"
          options={TABLE_QUERY_OPTIONS}
        />
      }
    >
      <BasaltDataTable
        data={tableQuery.data ?? []}
        columns={COLUMNS}
        query={tableQuery}
        enableSorting={false}
        striped
        highlightOnHover
        verticalSpacing="xs"
        // `minWidth` makes the table its own scrollport, so the header sticks to that edge and a
        // page-chrome offset would only warn (and used to park the thead mid-body — P1).
        stickyHeader
        minWidth={720}
        enablePagination
        manualPagination
        rowCount={filtered.length}
        pageCount={pageCount}
        initialPagination={pagination}
        onPaginationChange={setPagination}
        enableRowSelection
        bulkActions={(rows) => [
          {
            key: 'export',
            label: `Export ${rows.length}`,
            onClick: () =>
              notifySuccess(`Exported ${rows.length} session${rows.length === 1 ? '' : 's'}`),
          },
          {
            key: 'delete',
            label: 'Delete',
            danger: true,
            onClick: () => {
              void overlays.confirmDelete({
                subject: 'session',
                count: rows.length,
                onConfirm: () => {
                  const ids = rows.map((row) => row.id)
                  setRemovedIds((prev) => new Set([...prev, ...ids]))
                  notifyUndo({
                    message: `${rows.length} session${rows.length === 1 ? '' : 's'} deleted`,
                    onUndo: () =>
                      setRemovedIds((prev) => {
                        const next = new Set(prev)
                        for (const id of ids) next.delete(id)
                        return next
                      }),
                  })
                },
              })
            },
          },
        ]}
        onRowActivate={onRowActivate}
      />
    </Section>
  )
}

// ── The virtualized list, narrow subpath + a sparkline per row + the imperative handle ──────────

type ListRow = { id: number; label: string; trend: number[] }

function trendFor(seed: number): number[] {
  return Array.from(
    { length: 12 },
    (_, i) => 4 + Math.round(Math.sin((seed + i) / 2) * 3 + i * 0.4),
  )
}

function VirtualListBlock() {
  const listRef = useRef<BasaltVirtualListHandle>(null)
  const items = useMemo<ListRow[]>(
    () =>
      Array.from({ length: 1_000 }, (_, i) => ({
        id: i,
        label: `Row #${String(i + 1).padStart(4, '0')}`,
        trend: trendFor(i),
      })),
    [],
  )

  return (
    <Section
      title="BasaltVirtualList — narrow subpath, a sparkline per row"
      subtitle="basalt-ui/data/virtual — the sub-path that never value-imports @tanstack/react-table"
    >
      <Group mb="xs" gap="xs">
        <Button
          size="compact-xs"
          onClick={() => listRef.current?.scrollToIndex(500, { align: 'center' })}
        >
          Scroll to #0500
        </Button>
        <Button size="compact-xs" variant="default" onClick={() => listRef.current?.scrollToEnd()}>
          Scroll to end
        </Button>
      </Group>
      <BasaltVirtualList
        ref={listRef}
        items={items}
        height={300}
        estimateSize={44}
        overscan={6}
        getItemKey={(item) => item.id}
        renderItem={(item, index) => (
          <Group
            px="xs"
            h="100%"
            justify="space-between"
            align="center"
            wrap="nowrap"
            style={{
              borderBottom: '1px solid var(--vx-surface-border)',
              background: index % 2 === 0 ? VX.surface.bg : VX.surface.subtle,
            }}
          >
            <Text size="sm">{item.label}</Text>
            <LineSparkline data={item.trend} width={80} height={24} color={VX.line} />
          </Group>
        )}
      />
    </Section>
  )
}

export function DataStressPage() {
  const [range] = dataStressFilters.field.range.use()
  const [query] = dataStressFilters.field.query.use()
  // The optimistic-delete lane the table's bulk action writes to; `notifyUndo`'s `onUndo` restores
  // an id, `onExpire` is where a real app would commit the mutation.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<number>>(new Set())

  // Derived at PAGE level, not inside the table, because the aside reads the same set: a detail
  // panel showing a row the table has filtered or deleted away is the defect this placement fixes.
  const filtered = useMemo(() => {
    const maxAge = RANGE_DAYS[range.preset] ?? 90
    const q = query.trim().toLowerCase()
    return ALL_SESSIONS.filter(
      (row) =>
        !removedIds.has(row.id) &&
        row.daysAgo <= maxAge &&
        (q === '' || row.session.toLowerCase().includes(q)),
    )
  }, [range, query, removedIds])

  // The row → detail hook that pairs with `PageAside` (`onRowActivate`) — lifted here because the
  // aside is a page-level region, not something the table owns. An ID rather than the row OBJECT:
  // the panel renders the row as it is NOW, so a filter change or a delete is reflected there
  // instead of leaving a snapshot taken at click time on screen.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected =
    selectedId === null ? null : (filtered.find((row) => row.id === selectedId) ?? null)

  // …and a selection that fell out of the set is DROPPED, not merely hidden — otherwise undoing the
  // delete silently repopulates a panel the user already watched empty out.
  useEffect(() => {
    if (selectedId !== null && selected === null) setSelectedId(null)
  }, [selectedId, selected])

  return (
    <Stack gap="sm">
      <PageBar
        filters={
          <FilterSet>
            <RangeFilter field={dataStressFilters.field.range} />
            <SearchFilter field={dataStressFilters.field.query} placeholder="Find a session" />
          </FilterSet>
        }
      />
      <Text size="sm" c="dimmed">
        The sticky row-2 toolbar above, a `manualPagination` table clearing it via
        `--basalt-page-bar-h`, and a horizontal scroll forced by `minWidth` at phone width — none of
        the three tested together before this route.
      </Text>
      <ManualPaginationTable
        filtered={filtered}
        setRemovedIds={setRemovedIds}
        onRowActivate={(row) => setSelectedId(row.id)}
      />
      <VirtualListBlock />

      <PageAside title="Session detail" persistKey="data-stress">
        {selected === null ? (
          <Text size="sm" c="dimmed">
            Click a row (or press Enter on a focused one) to inspect it here.
          </Text>
        ) : (
          <Stack gap="xs">
            <Text fw={600}>{selected.session}</Text>
            <Text size="sm" c="dimmed">
              {selected.region} · {selected.device} · {selected.browser}
            </Text>
            <Text size="sm">Duration: {selected.durationMin} min</Text>
            <Text size="sm">Revenue: ${selected.revenueUsd}</Text>
            <Text size="sm">{selected.daysAgo} days ago</Text>
          </Stack>
        )}
      </PageAside>
    </Stack>
  )
}
