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
import { ActionIcon, Stack } from '@mantine/core'
import { PageBar, Section, StatCard, StatGroup, WidgetGrid } from 'basalt-ui'
import type { QueryStateLike } from 'basalt-ui'
import {
  CompareFilter,
  FilterSet,
  MultiSelectFilter,
  RangeFilter,
  SelectFilter,
  ViewTabs,
} from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'
import { BarSparkline, ChartCard, MultiLine, VX } from 'basalt-ui/charts'
import { alpha } from 'basalt-ui/tokens'
import { BasaltDataTable } from 'basalt-ui/data/table'
import { field } from 'basalt-ui/router-tanstack'
import { createLocalStore } from 'basalt-ui/state'
import { useCallback, useMemo, useState } from 'react'
import {
  bucketByGrain,
  buildAnalytics,
  CHANNEL_KEYS,
  CHANNEL_LABEL,
  deltaPeriodLabel,
  downsample,
  integer,
  sparklineBars,
  topPageColumns,
} from './analytics-data'
import type { Analytics } from './analytics-data'
import { BreakdownList, LiveChip } from './analytics-widgets'
import { dashboardFilters } from './dashboard-range-store'
import {
  IconActivity,
  IconChart,
  IconChevronLeft,
  IconChevronRight,
  IconCurrency,
  IconDots,
  IconExport,
  IconReport,
  IconSettings,
  IconUser,
} from './icons'

/**
 * The three CARD- and SECTION-level view axes, on the LOCAL lane (`url: false`).
 *
 * They are the half of `docs/CONTROLS-SPEC.md` §2.2 the page was missing entirely: every control on
 * it lived in the `PageBar`, so a reader saw page filters and concluded that was all a home could
 * be. A chart's own bucketing, a list's own metric and a section's own view are not page state —
 * they do not belong in the URL, they do not belong in a deep link, and a `createLocalStore` field
 * gives them the same `FieldHandle` a URL field has, so the controls that read them are the SAME
 * controls (law C3: no `useState`, no `onChange`, on any lane).
 */
const KPI_QUERY_VARIANTS = ['pending', 'error', 'empty', 'data'] as const
type KpiQueryVariant = (typeof KPI_QUERY_VARIANTS)[number]

const KPI_QUERY_OPTIONS: { value: KpiQueryVariant; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
  { value: 'data', label: 'Data' },
]

const cardViews = createLocalStore({
  key: 'dashboard-card-views',
  fields: {
    /** `Total sales over time` — day or week buckets. */
    grain: field.enum(['day', 'week'], 'day'),
    /** `Sales by channel` — which figure the rows state. */
    metric: field.enum(['revenue', 'orders'], 'revenue'),
    /** The `Funnel & retention` section's shared axis, over all three cards below it. */
    funnelView: field.enum(['absolute', 'rate'], 'absolute'),
    /** The `Orders` KPI's breakdown — drives a demo `QueryStateLike` through all four branches. */
    kpiQuery: field.enum(KPI_QUERY_VARIANTS, 'data'),
  },
}).labels({
  grain: { day: 'Day', week: 'Week' },
  metric: { revenue: 'Revenue', orders: 'Orders' },
  funnelView: { absolute: 'Absolute', rate: 'Rate' },
  kpiQuery: { pending: 'Pending', error: 'Error', empty: 'Empty', data: 'Data' },
})

/**
 * The `Orders` KPI's breakdown as a `QueryStateLike` through pending / error / empty / data —
 * `StatCard.query` resolves it through `QueryState` at the section tier, same four-way branch
 * `StatesPage`'s chart drives.
 */
function buildBreakdownQuery(variant: KpiQueryVariant): QueryStateLike<unknown> {
  const base = { isError: false, error: null, refetch: () => {} } as const
  switch (variant) {
    case 'data':
      return { ...base, data: true, fetchStatus: 'idle' }
    case 'empty':
      return { ...base, data: [], fetchStatus: 'idle' }
    case 'pending':
      return { ...base, data: undefined, fetchStatus: 'fetching' }
    case 'error':
      return {
        ...base,
        isError: true,
        error: { status: 500, value: { message: 'the breakdown service did not answer' } },
        data: undefined,
        fetchStatus: 'idle',
      }
  }
}

/**
 * The KPI trend's bar fill. `alpha(VX.ink, 0.33)` over `BarSparkline`'s own 0.75 fill-opacity lands
 * the reference's ink-25% — a token expression, never a hex (`--vx-*` re-resolves per scheme).
 */
const KPI_BAR_COLOR = alpha(VX.ink, 0.33)

/**
 * The KPI sparkline, as a render prop over the slot's MEASURED box.
 *
 * This is what the render prop buys that a `ReactNode` could not: the BAR COUNT follows the width.
 * The same expression draws ~10 bars in the 72px `'right'` slot (the reference treatment) and ~33 in
 * the full-bleed slot `'right'` collapses to below `sm` — with no viewport branch, no second mount
 * and no media query at the call site (law C9). A hardcoded `width={72}` was only ever right for one
 * of the two, and a fixed bar count for neither.
 *
 * `emphasizeLast` is the reading a KPI trend actually owes: where the series ends, in accent, beside
 * the number it qualifies.
 */
function kpiSparkline(title: string, history: readonly number[]) {
  return ({ width, height }: { width: number; height: number }) => (
    <BarSparkline
      data={downsample(history, sparklineBars(width))}
      width={width}
      height={height}
      color={KPI_BAR_COLOR}
      barGap={2}
      barRadius={1}
      emphasizeLast
      ariaLabel={`${title} trend`}
    />
  )
}

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
  /** The y format under the enclosing Section's `rate` view. */
  rateFormat: (v: number) => string
  /** Each series' value re-expressed as a share of its own first point. */
  toRate: (value: number, data: Analytics) => number
  points: (data: Analytics) => { x: string; value: number }[]
}[] = [
  {
    key: 'funnel',
    title: 'Checkout funnel',
    info: 'Visitors surviving each step of the funnel.',
    color: VX.accent,
    format: (v) => integer(v),
    rateFormat: (v) => `${Math.round(v)}%`,
    toRate: (value, data) => (value / (data.funnel[0]?.visitors ?? 1)) * 100,
    points: (data) => data.funnel.map((p) => ({ x: p.step, value: p.visitors })),
  },
  {
    key: 'retention',
    title: 'Retention',
    info: "Share of last window's buyers who bought again.",
    color: VX.accent,
    format: (v) => `${Math.round(v)}%`,
    rateFormat: (v) => `${Math.round(v)}%`,
    toRate: (value, data) => (value / (data.retention[0]?.sales ?? 1)) * 100,
    points: (data) => data.retention.map((p) => ({ x: p.date, value: p.sales })),
  },
  {
    key: 'latency',
    title: 'Checkout latency',
    info: 'p95 checkout response time, in milliseconds.',
    color: VX.warnSolid,
    format: (v) => `${Math.round(v)}ms`,
    rateFormat: (v) => `${Math.round(v)}%`,
    toRate: (value, data) => (value / (data.latency[0]?.sales ?? 1)) * 100,
    points: (data) => data.latency.map((p) => ({ x: p.date, value: p.sales })),
  },
]

export function DashboardPage() {
  const filters = dashboardFilters.useValues()
  // A local store exposes `field` handles, not a values object — each field's own `use()` is the
  // read, which is what keeps a card re-rendering on its OWN control and not on its neighbour's.
  const [grain] = cardViews.field.grain.use()
  const [metric] = cardViews.field.metric.use()
  const [funnelView] = cardViews.field.funnelView.use()
  const [kpiQuery] = cardViews.field.kpiQuery.use()
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
  // The chart's own control CHANGES ITS DATA, which is the point of showing one at card level: a
  // `ViewTabs` in `ChartCard.actions` that only restyled the plot would not be a control worth a
  // slot.
  const grainPoints = useMemo(() => bucketByGrain(data.points, grain), [data.points, grain])
  const ordersQuery = useMemo(() => buildBreakdownQuery(kpiQuery), [kpiQuery])

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
    <Stack gap="sm">
      <PageBar
        actions={{
          // An ICON on the primary is what picks its mobile form (`docs/CONTROLS-SPEC.md` §2.1): with
          // one it becomes a filled `ActionIcon`, without one a compact filled button carrying the
          // label. This page takes the icon branch because its header is already the busiest in the
          // playground (a live chip, a sync, two shell globals and a kebab); `ControlsMobilePage`'s
          // `Export` primary ships no icon and demonstrates the labelled branch.
          primary: {
            key: 'save',
            label: 'Save as report',
            icon: <IconReport />,
            onClick: () => {},
          },
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
          // `group: true` on every member of the run — the period stepper is three affordances over
          // ONE value, so `ActionGroup` joins them into a single `ControlGroup` box (shared borders,
          // radius on the outer ends only). `Manage metrics` carries no flag and stays a separate
          // button, which is the point: adjacency alone never joins anything.
          {
            key: 'period-prev',
            label: 'Previous period',
            icon: <IconChevronLeft />,
            group: true,
            onClick: () => {},
          },
          { key: 'period-today', label: 'Today', group: true, onClick: () => {} },
          {
            key: 'period-next',
            label: 'Next period',
            icon: <IconChevronRight />,
            group: true,
            onClick: () => {},
          },
          { key: 'metrics', label: 'Manage metrics', icon: <IconSettings />, onClick: () => {} },
        ]}
      />

      <StatGroup cols={4}>
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
            // No `deltaPeriod` on a KPI card, deliberately: `vs prior` doubles the badge's width in
            // a card that also holds a 72px sparkline, and the period is already stated once for the
            // whole page by the `Compare` pill in the bar. The big chart card below, which has the
            // room, keeps it.
            sparklinePlacement="right"
            sparkline={kpiSparkline(kpi.title, kpi.history)}
            // Only the FIRST card carries one, deliberately: `docs/CONTROLS-SPEC.md` §2.2's
            // `actions` slot is a per-card affordance, and four identical kebabs across a KPI row
            // is chrome. It is a raw `ActionIcon` with no `size` — `StatCard` wraps the slot in a
            // `CtlSlot`, so the tier comes from the home (law C5).
            // `unit` + `breakdown` on ONE card, deliberately — the row is four cards wide and a
            // breakdown under every one of them turns a KPI row into four small tables. `unit` is a
            // separate channel from `value` (mono, muted, `text-sm` after the numeral) so `2,077`
            // and `orders` are not one 24px string, and the rows carry NO hairline: §2.1 puts a
            // horizontal rule between option rows and nowhere else.
            {...(kpi.key === 'orders' && {
              unit: 'orders',
              breakdown: data.breakdown.slice(0, 2).map((row) => ({
                label: row.label,
                value: row.orders,
              })),
              // The demo query the `Breakdown` switcher (below, as a real `actions` JSX attribute —
              // not the object-spread form the guard's ancestry walk cannot see through) drives,
              // through the same four branches `StatesPage`'s chart does.
              query: ordersQuery,
            })}
            // A JSX attribute, not the spread-object form above: `basalt/bound-control-outside-home`
            // walks JSX attribute ancestry to resolve a control's home, and a bound control assigned
            // inside a plain object literal (however that object later reaches `actions` via spread)
            // is invisible to that walk.
            actions={
              kpi.key === 'sales' ? (
                <ActionIcon variant="subtle" aria-label="Card actions">
                  <IconDots />
                </ActionIcon>
              ) : kpi.key === 'orders' ? (
                // `SelectFilter`, not `ViewTabs`: four options is past `ViewTabs`' desktop
                // `SegmentedControl` width (its own >3-option collapse to a plain `Select` is
                // phone-only, `view-tabs.tsx`), and this 281px card has no room for a four-segment
                // track. `SelectFilter` is the field-bound, home-slot-legal shape of the same
                // `docs/CONTROLS-SPEC.md` `ViewTabs` row's ">3 → Select" rule — a raw Mantine
                // `Select` with `value`/`onChange` here trips `basalt/hand-rolled-filter` (laws
                // C1–C3: a control in a home slot takes a `field`, never a value/onChange pair).
                <SelectFilter
                  field={cardViews.field.kpiQuery}
                  label="Breakdown"
                  options={KPI_QUERY_OPTIONS}
                />
              ) : undefined
            }
          />
        ))}
      </StatGroup>

      <WidgetGrid cols={3}>
        <WidgetGrid.Item span={2}>
          <ChartCard
            title="Total sales over time"
            icon={<IconChart />}
            value={data.total}
            {...(data.delta !== undefined && { delta: data.delta })}
            {...(period !== undefined && { deltaPeriod: period })}
            info="Net sales per point against the comparison window the Compare filter selects."
            actions={
              <ViewTabs
                field={cardViews.field.grain}
                label="Bucket"
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                ]}
              />
            }
          >
            <MultiLine
              data={grainPoints}
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
                        getValue: (d: (typeof grainPoints)[number]) => d.previous,
                      },
                    ]),
              ]}
            />
          </ChartCard>
        </WidgetGrid.Item>
        <ChartCard
          title="Sales by channel"
          info="Each channel's share of the selected window, with its own trend."
          count={data.breakdown.length}
          // A `SelectFilter` in a CARD's `actions` slot — the same control the `PageBar` holds,
          // bound to a local field instead of a URL one. `ChartCard` is inside the Mantine-free
          // chart layer so its slot carries only `data-basalt-tier="widget"`; a basalt control
          // sizes itself at `ctl`, which is why this needs no wrapper (see `ChartCard`'s doc).
          actions={<SelectFilter field={cardViews.field.metric} label="Metric" />}
        >
          <BreakdownList rows={data.breakdown} metric={metric} />
        </ChartCard>
      </WidgetGrid>

      {/*
       * A SECTION with both `tabs` and `actions` — the tier between the page bar and a card
       * (`docs/CONTROLS-SPEC.md` §2.2). The three cards under it share ONE axis, which is exactly
       * what a section-level control is for: putting the same switch on each card would have been
       * three controls saying one thing, and putting it in the `PageBar` would have made it look
       * like it governed the page.
       */}
      <Section
        title="Funnel & retention"
        count={SMALL_CHARTS.length}
        tabs={
          <ViewTabs
            field={cardViews.field.funnelView}
            label="Funnel view"
            options={[
              { value: 'absolute', label: 'Absolute' },
              { value: 'rate', label: 'Rate' },
            ]}
          />
        }
        actions={
          <ActionIcon variant="subtle" aria-label="Export funnel">
            <IconExport />
          </ActionIcon>
        }
      >
        <WidgetGrid cols={3}>
          {SMALL_CHARTS.map((chart) => (
            <ChartCard key={chart.key} title={chart.title} info={chart.info}>
              <MultiLine
                data={chart.points(data)}
                height={160}
                chartId={`analytics-${chart.key}`}
                ariaLabel={chart.title}
                getX={(d) => d.x}
                y={{
                  domain: 'auto',
                  format: funnelView === 'rate' ? chart.rateFormat : chart.format,
                }}
                series={[
                  {
                    key: 'value',
                    label: chart.title,
                    color: chart.color,
                    mark: 'line',
                    getValue: (d) =>
                      funnelView === 'rate' ? chart.toRate(d.value, data) : d.value,
                  },
                ]}
              />
            </ChartCard>
          ))}
        </WidgetGrid>
      </Section>

      {/* A SECTION wrapping the table, so the page shows both a section-level action and a
       * TABLE-level toolbar: `Export` belongs to the section, `channel` and the search belong to
       * the table's own header row. */}
      <Section
        title="Top pages"
        icon={<IconChart />}
        subtitle="Every page that took traffic in the selected window."
        actions={
          <ActionIcon variant="subtle" aria-label="Export top pages">
            <IconExport />
          </ActionIcon>
        }
      >
        <BasaltDataTable
          title="All pages"
          data={data.topPages}
          columns={topPageColumns}
          enableGlobalFilter
          facets={[
            {
              columnId: 'channel',
              label: 'Channel',
              options: CHANNEL_KEYS.map((key) => ({ value: key, label: CHANNEL_LABEL[key] })),
            },
          ]}
          enablePagination
          initialPagination={{ pageIndex: 0, pageSize: 5 }}
          highlightOnHover
        />
      </Section>
    </Stack>
  )
}
