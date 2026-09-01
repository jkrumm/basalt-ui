/**
 * DataStressPage — audit-c-charts.md top-15 #6 and #14: `BasaltDataTable` with `manualPagination`
 * inside a `Section` under a sticky `PageBar` toolbar (store-bound `RangeFilter` + `SearchFilter`),
 * `stickyHeader` clearing the measured `--basalt-page-bar-h`, and `minWidth` forcing horizontal
 * scroll at phone width — plus `BasaltVirtualList` (imported from the narrow `basalt-ui/data/virtual`
 * subpath, audit-b-components.md #17) with a `LineSparkline` per row and the ref handle
 * (`scrollToIndex`/`scrollToEnd`).
 */
import { useMemo, useRef, useState } from 'react'
import { Button, Group, Stack, Text } from '@mantine/core'
import { PageBar, Section } from 'basalt-ui'
import { FilterSet, RangeFilter, SearchFilter } from 'basalt-ui/controls'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
import type { PaginationState } from 'basalt-ui/data/table'
import { BasaltVirtualList } from 'basalt-ui/data/virtual'
import type { BasaltVirtualListHandle } from 'basalt-ui/data/virtual'
import { LineSparkline, VX } from 'basalt-ui/charts'
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

function ManualPaginationTable() {
  const [range] = dataStressFilters.field.range.use()
  const [query] = dataStressFilters.field.query.use()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const filtered = useMemo(() => {
    const maxAge = RANGE_DAYS[range.preset] ?? 90
    const q = query.trim().toLowerCase()
    return ALL_SESSIONS.filter(
      (row) => row.daysAgo <= maxAge && (q === '' || row.session.toLowerCase().includes(q)),
    )
  }, [range, query])

  // Filtering can shrink the row set below the current page — clamp rather than render an empty
  // page with a live "next" control pointing nowhere.
  const pageCount = Math.max(Math.ceil(filtered.length / pagination.pageSize), 1)
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1)
  const page = filtered.slice(
    pageIndex * pagination.pageSize,
    (pageIndex + 1) * pagination.pageSize,
  )

  return (
    <Section
      title="Sessions"
      subtitle="manualPagination — the table renders exactly one page; the pager bar reads 'of N' from rowCount, not from data.length"
      count={filtered.length}
    >
      <BasaltDataTable
        data={page}
        columns={COLUMNS}
        enableSorting={false}
        striped
        highlightOnHover
        verticalSpacing="xs"
        stickyHeader
        stickyHeaderOffset="calc(var(--app-shell-header-height, 0px) + var(--basalt-page-bar-h, 0px))"
        minWidth={720}
        enablePagination
        manualPagination
        rowCount={filtered.length}
        pageCount={pageCount}
        initialPagination={pagination}
        onPaginationChange={setPagination}
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
      <ManualPaginationTable />
      <VirtualListBlock />
    </Stack>
  )
}
