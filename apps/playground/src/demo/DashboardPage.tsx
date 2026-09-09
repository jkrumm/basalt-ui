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
 * It is also the page that demonstrates the ASIDE region on a landing route (`PageAside` at the
 * bottom of this file, `docs/ASIDE-SPEC.md`), and the bar/aside split is the one-home law in
 * practice: the bar holds what the page is read FROM, the aside how its main chart is DRAWN.
 *
 * The data is a pure function of the filter state (`demo/analytics-data.ts`): a re-render caused by
 * opening the `Filters (n)` sheet must not reshuffle the numbers behind it.
 */
import { ActionIcon, Stack } from '@mantine/core'
import { PageAside, PageBar, Section, StatCard, StatGroup, WidgetGrid } from 'basalt-ui'
import type { QueryStateLike } from 'basalt-ui'
import {
  CompareFilter,
  FilterSet,
  MultiSelectFilter,
  RangeFilter,
  SelectFilter,
  SliderControl,
  ToggleFilter,
  ViewTabs,
} from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'
import { BarSparkline, ChartCard, MultiLine, VX } from 'basalt-ui/charts'
import type { ZoneSpec } from 'basalt-ui/charts'
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
import type { Analytics, SalesPoint } from './analytics-data'
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

/**
 * A CENTERED rolling mean over both plotted series, `span` points wide — what the aside's
 * `Smoothing` row does to the chart.
 *
 * CENTERED, not trailing: a trailing mean shifts every feature half a window to the right, which on
 * a 30-point series is a visible lie about WHEN sales moved. The window shrinks at the edges instead
 * of dropping points, so the line still spans the whole calendar rather than starting three days in.
 *
 * `span <= 1` returns the input BY IDENTITY, so "smoothing off" allocates nothing and `MultiLine`
 * sees the same `data` reference it saw before — a memoized chart must not re-lay-out because a
 * slider the reader never touched produced a fresh array.
 *
 * The parameter is `span` rather than `window` deliberately: `window` shadows the global this file
 * already uses for `setTimeout`.
 */
function smoothSeries(points: SalesPoint[], span: number): SalesPoint[] {
  if (span <= 1) return points
  const half = Math.floor(span / 2)
  return points.map((point, index) => {
    const slice = points.slice(Math.max(0, index - half), index + half + 1)
    const mean = (pick: (p: SalesPoint) => number): number =>
      Math.round(slice.reduce((total, p) => total + pick(p), 0) / slice.length)
    return { date: point.date, sales: mean((p) => p.sales), previous: mean((p) => p.previous) }
  })
}

/** The target corridor's spread around the window's own mean — ±10%, one constant, not two. */
const TARGET_TOLERANCE = 0.1

/**
 * The three bands the aside's `Target band` switch draws behind the sales line, derived from the
 * VISIBLE window's mean rather than from a pinned number: a fixture that reshapes with the range,
 * the currency and the bucket has no fixed target to hardcode, and a band that ignored those would
 * sit off-plot the moment the reader switched to weeks.
 *
 * `alpha()` over a token, never a hex — the fills re-resolve per color scheme.
 */
function targetBands(points: readonly SalesPoint[]): ZoneSpec[] | undefined {
  if (points.length === 0) return undefined
  const mean = points.reduce((total, point) => total + point.sales, 0) / points.length
  return [
    { from: -Infinity, to: mean * (1 - TARGET_TOLERANCE), fill: alpha(VX.warnSolid, 0.07) },
    {
      from: mean * (1 - TARGET_TOLERANCE),
      to: mean * (1 + TARGET_TOLERANCE),
      fill: alpha(VX.accent, 0.1),
    },
    { from: mean * (1 + TARGET_TOLERANCE), to: Infinity, fill: alpha(VX.goodSolid, 0.07) },
  ]
}

/** The `Smoothing` row's readout — `off` at the fallback, so the row states its own rest state. */
function smoothingReadout(value: number): string {
  return value <= 1 ? 'off' : `${value} pts`
}

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
  // The aside's two data-shaping fields, applied HERE and not inside the card: the smoothed series
  // is also what the band's mean is computed over, so a corridor drawn against the raw mean would
  // disagree with the line it sits behind by up to the smoothing's own bias.
  const plotPoints = useMemo(
    () => smoothSeries(grainPoints, filters.smoothing),
    [grainPoints, filters.smoothing],
  )
  const bands = useMemo(
    () => (filters.bands ? targetBands(plotPoints) : undefined),
    [filters.bands, plotPoints],
  )
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
          // label. This page takes the icon branch because it still shares the phone bar with a
          // sync, two shell globals and the kebab; `ControlsMobilePage`'s `Export` primary ships no
          // icon and demonstrates the labelled branch.
          primary: {
            key: 'save',
            label: 'Save as report',
            icon: <IconReport />,
            onClick: () => {},
          },
          secondary: [
            // `kind: 'custom'` — the escape hatch for a control basalt does not model (linewatch's
            // live chip, argo's timer). basalt owns only the PLACEMENT: the node renders with no
            // button chrome on desktop.
            //
            // `'more'`, not the `'bar'` it shipped with, and the reversal is a WIDTH verdict rather
            // than a change of mind about the live-state law. That law still holds and is why
            // `GlobalAction`'s doc states it: a `'more'` node is mounted a SECOND time inside the
            // kebab's dropdown, so a control that owns a subscription pays twice. This chip owns a
            // 1s interval, the second mount exists only while the dropdown is open, and against that
            // the `'bar'` form cost ~81px of a 374px content box — measured at 390x844 it left the
            // breadcrumb 101px against its own 96px floor (`app-header.module.css`), i.e. the page
            // title truncated to buy a badge counting seconds. Law C7 says row 1 below `sm` is the
            // primary plus ONE kebab; a page demonstrating the framework should not be the one place
            // that reads as four rigid entries plus a kebab.
            { key: 'live', kind: 'custom', node: <LiveChip />, mobile: 'more' },
            { key: 'accounts', label: 'Accounts', icon: <IconUser />, onClick: () => {} },
            { key: 'export', label: 'Export CSV', onClick: () => {}, mobile: 'more' },
          ],
        }}
        // Stays on the phone bar, and not because it earned the slot: `PageBar.sync` takes no
        // `mobile` placement, and law C12 says a page's refresh has exactly ONE shape — so folding
        // it into the kebab from here would mean re-declaring it as a `kind: 'custom'` action,
        // which loses the spinner, the relative age and the error tone on DESKTOP too. Its phone
        // form is already icon-only (`sync-button.tsx`, CSS, one mount), so it costs ~36px against
        // the live chip's ~81px; the rest of the ask is a package change, not a call-site one.
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
              // The one chart on this page the ASIDE governs: `plotPoints` carries its smoothing,
              // `y.scale` its axis and `zones` its target corridor. The `Bucket` tabs in this card's
              // own header stay the CARD's (law C1's third home) — the aside would be the wrong
              // reach for a control that formats exactly one widget.
              data={plotPoints}
              height={280}
              chartId="analytics-sales"
              ariaLabel="Total sales over time"
              getX={(d) => d.date}
              y={{ domain: 'auto', format: (v) => integer(v), scale: filters.scale }}
              {...(bands !== undefined && { zones: bands })}
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
                        getValue: (d: (typeof plotPoints)[number]) => d.previous,
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

      {/*
       * The right-hand aside, on the app's LANDING route (`docs/ASIDE-SPEC.md` §0). It was
       * demonstrated only on `/cbbi` and on a non-default tab of `/data` — two clicks off any path a
       * reader actually takes — so the shipped fourth shell region was invisible to anyone judging
       * the framework from the page it opens on.
       *
       * WRITTEN LAST because tree position IS reading order and nothing else: from `sm` up this
       * portals into `AppShell.Aside`, and below `sm` it projects into `PageBar` row 2 as one
       * `Display` pill opening a `FilterSheet`. That projection needs row 2 to EXIST — the bar above
       * carries a four-filter `FilterSet` plus `filtersEnd`, so it does; on a page with neither, the
       * same one node would render in flow at the bottom instead (still one mount, law C9).
       *
       * THE ONE-HOME LAW is what picks the three fields inside. The bar owns what is READ (window,
       * comparison, currency, channels); the aside owns how the sales chart is DRAWN. `range` or
       * `compare` repeated here would be a twin the bar already owns on the same viewport — the
       * bar/aside sibling of C9 — so the aside binds only fields no `FilterSet` child touches
       * (`demo/dashboard-range-store.ts` states the split at the definition).
       */}
      <PageAside title="Display" persistKey="dashboard">
        <Section
          title="Sales chart"
          info="How `Total sales over time` is drawn. The page bar owns what it is drawn FROM."
        >
          {/* Two options, so `PanelChoice` keeps the full-width track rather than folding to a
              `Select` — and the labels come off `dashboardFilters.labels()`, not a prop. */}
          <SelectFilter field={dashboardFilters.field.scale} label="Y scale" />
          <SliderControl
            field={dashboardFilters.field.smoothing}
            label="Smoothing"
            hint="A centered rolling mean over the plotted points — 0 draws the raw series."
            format={smoothingReadout}
          />
          <ToggleFilter field={dashboardFilters.field.bands} label="Target band" />
        </Section>
      </PageAside>
    </Stack>
  )
}
