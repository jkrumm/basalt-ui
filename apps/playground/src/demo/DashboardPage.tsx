/**
 * The reference analytics page — the dogfood surface for `docs/CONTROLS-SPEC.md` §10, and the gate
 * every wave-6 guard promotion is measured against.
 *
 * Nothing on this page decides a size, a placement, a persistence lane or a mobile projection. Row
 * 1 of the `PageBar` (three actions + `sync`) portals into the 48px app-shell header; row 2 (the
 * `FilterSet` + `filtersEnd`) renders in-flow and sticks under it. Every filter takes a
 * `FieldHandle` off `dashboardFilters` and owns both its URL param and its localStorage mirror, so
 * there is no `useState`, no `navigate`, no `onChange` and no `visibleFrom` twin anywhere below —
 * laws C1–C5, C9. The page title is the breadcrumb (`staticData.title`), so there is no in-body
 * heading either (law C8).
 *
 * The data is a pure function of the filter state (`demo/analytics-data.ts`): a re-render caused by
 * opening the `Filters (n)` sheet must not reshuffle the numbers behind it.
 */
import { Grid, SimpleGrid, Stack } from '@mantine/core'
import { PageBar, StatCard } from 'basalt-ui'
import {
  CompareFilter,
  FilterSet,
  MultiSelectFilter,
  RangeFilter,
  SelectFilter,
} from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'
import { BarSparkline, ChartCard, MultiLine, VX } from 'basalt-ui/charts'
import { BasaltDataTable } from 'basalt-ui/data'
import { useCallback, useMemo, useState } from 'react'
import { buildAnalytics, deltaPeriodLabel, integer, topPageColumns } from './analytics-data'
import type { Analytics } from './analytics-data'
import { BreakdownList, LiveChip } from './analytics-widgets'
import { dashboardFilters } from './dashboard-range-store'
import { IconActivity, IconChart, IconCurrency, IconSettings, IconUser } from './icons'

/**
 * The 3-up secondary row, declared rather than repeated: three near-identical single-series cards
 * differing only in title, source, unit and hue. Written out three times it was the same 24 lines
 * three times over, and the fourth copy is where one of them silently loses its `ariaLabel`.
 */
const SMALL_CHARTS: readonly {
  key: string
  title: string
  info: string
  color: string
  format: (v: number) => string
  points: (data: Analytics) => { x: string; value: number }[]
}[] = [
  {
    key: 'funnel',
    title: 'Checkout funnel',
    info: 'Visitors surviving each step of the funnel.',
    color: VX.accent,
    format: (v) => integer(v),
    points: (data) => data.funnel.map((p) => ({ x: p.step, value: p.visitors })),
  },
  {
    key: 'retention',
    title: 'Retention',
    info: "Share of last window's buyers who bought again.",
    color: VX.accent,
    format: (v) => `${Math.round(v)}%`,
    points: (data) => data.retention.map((p) => ({ x: p.date, value: p.sales })),
  },
  {
    key: 'latency',
    title: 'Checkout latency',
    info: 'p95 checkout response time, in milliseconds.',
    color: VX.warnSolid,
    format: (v) => `${Math.round(v)}ms`,
    points: (data) => data.latency.map((p) => ({ x: p.date, value: p.sales })),
  },
]

export function DashboardPage() {
  const filters = dashboardFilters.useValues()
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)

  const data = useMemo(
    () =>
      buildAnalytics({
        range: filters.range,
        currency: filters.currency,
        compare: filters.compare,
        channels: filters.channels,
      }),
    [filters.range, filters.currency, filters.compare, filters.channels],
  )

  const period = deltaPeriodLabel(filters.compare)

  // Stands in for a `refetch()`. The `SyncButton` owns the spinner, the relative age and the
  // icon-only mobile form — this only reports the two facts it reads.
  const onSync = useCallback(() => {
    setSyncing(true)
    window.setTimeout(() => {
      setSyncing(false)
      setSyncedAt(Date.now())
    }, 900)
  }, [])

  return (
    <Stack gap={14}>
      <PageBar
        actions={{
          primary: { key: 'save', label: 'Save as report', onClick: () => {} },
          secondary: [
            // `kind: 'custom'` — the escape hatch for a control basalt does not model (linewatch's
            // live chip, argo's timer). basalt owns only the PLACEMENT: the node renders with no
            // button chrome on desktop, and `mobile: 'bar'` keeps it mounted exactly ONCE, which is
            // what anything holding live state needs — a `'more'` node is mounted a second time
            // inside the kebab's dropdown.
            { key: 'live', kind: 'custom', node: <LiveChip />, mobile: 'bar' },
            { key: 'accounts', label: 'Accounts', icon: <IconUser />, onClick: () => {} },
            { key: 'export', label: 'Export CSV', onClick: () => {}, mobile: 'more' },
          ],
        }}
        sync={{ syncing, lastCompletedAt: syncedAt, onSync }}
        filters={
          <FilterSet>
            <RangeFilter field={dashboardFilters.field.range} customPicker={DateRangePicker} />
            <CompareFilter field={dashboardFilters.field.compare} />
            <SelectFilter
              field={dashboardFilters.field.currency}
              label="Currency"
              icon={<IconCurrency />}
            />
            <MultiSelectFilter
              field={dashboardFilters.field.channels}
              label="All channels"
              noun="channels"
            />
          </FilterSet>
        }
        filtersEnd={[
          { key: 'metrics', label: 'Manage metrics', icon: <IconSettings />, onClick: () => {} },
        ]}
      />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing={14}>
        {data.kpis.map((kpi) => (
          <StatCard
            key={kpi.key}
            icon={<IconActivity />}
            title={kpi.title}
            value={kpi.value}
            // Compare='none' means there is no comparison window, so there is no delta to draw —
            // omitting the prop hides the chip entirely rather than printing a stale number, and
            // the period label comes from the compare field, never from the range.
            {...(kpi.delta !== undefined && { delta: kpi.delta })}
            {...(period !== undefined && { deltaPeriod: period })}
            sparklinePlacement="right"
            sparkline={
              <BarSparkline
                data={kpi.history}
                width={72}
                height={28}
                ariaLabel={`${kpi.title} trend`}
              />
            }
          />
        ))}
      </SimpleGrid>

      <Grid gap="sm">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <ChartCard
            title="Total sales over time"
            icon={<IconChart />}
            value={data.total}
            {...(data.delta !== undefined && { delta: data.delta })}
            {...(period !== undefined && { deltaPeriod: period })}
            info="Net sales per point against the comparison window the Compare filter selects."
          >
            <MultiLine
              data={data.points}
              height={280}
              chartId="analytics-sales"
              ariaLabel="Total sales over time"
              getX={(d) => d.date}
              y={{ domain: 'auto', format: (v) => integer(v) }}
              series={[
                {
                  key: 'sales',
                  label: 'Sales',
                  color: VX.accent,
                  mark: 'line',
                  getValue: (d) => d.sales,
                },
                ...(filters.compare === 'none'
                  ? []
                  : [
                      {
                        key: 'previous',
                        label:
                          filters.compare === 'year' ? 'Same period last year' : 'Prior window',
                        color: VX.faint,
                        mark: 'line' as const,
                        dash: 'dashed' as const,
                        strokeWidth: 1.5,
                        getValue: (d: (typeof data.points)[number]) => d.previous,
                      },
                    ]),
              ]}
            />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <ChartCard
            title="Sales by channel"
            info="Each channel's share of the selected window, with its own trend."
            count={data.breakdown.length}
          >
            <BreakdownList rows={data.breakdown} />
          </ChartCard>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={14}>
        {SMALL_CHARTS.map((chart) => (
          <ChartCard key={chart.key} title={chart.title} info={chart.info}>
            <MultiLine
              data={chart.points(data)}
              height={160}
              chartId={`analytics-${chart.key}`}
              ariaLabel={chart.title}
              getX={(d) => d.x}
              y={{ domain: 'auto', format: chart.format }}
              series={[
                {
                  key: 'value',
                  label: chart.title,
                  color: chart.color,
                  mark: 'line',
                  getValue: (d) => d.value,
                },
              ]}
            />
          </ChartCard>
        ))}
      </SimpleGrid>

      <BasaltDataTable
        title="Top pages"
        icon={<IconChart />}
        subtitle="Every page that took traffic in the selected window."
        data={data.topPages}
        columns={topPageColumns}
        enableGlobalFilter
        enablePagination
        initialPagination={{ pageIndex: 0, pageSize: 5 }}
        highlightOnHover
      />
    </Stack>
  )
}
