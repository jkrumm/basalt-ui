/**
 * CBBI — the playground's one REAL-data page, and the evidence page that produced the right-hand
 * "aside / inspector" shell region (Foundry filter panels, Lightroom inspectors).
 *
 * What it was for: `BasaltShell` owned a sidebar, a header, a `PageBar` and a body, so every
 * consumer wanting a persistent inspector column built it out of a `Flex` and its own judgement.
 * This page was that build, done once, in the open, on data that does not cooperate — 5,541 daily
 * points, nine metrics with leading nulls, and a price series spanning four orders of magnitude.
 * The panel is now the shipped region (`PageAside`); the panel's own module doc (`CbbiPanel.tsx`)
 * carries the findings still open against it.
 *
 * Structurally it mirrors `demo/DashboardPage.tsx`: one `PageBar` (tabs · a range filter · sync),
 * one store for every interactive field (`cbbi-store.ts`, laws C2–C4), `StatCard`/`ChartCard`/
 * `Section` for the tiers, and `QueryState` for the four data branches. The panel is the SHELL
 * ASIDE now (`PageAside`, `docs/ASIDE-SPEC.md` §0): the page owns no width, no `flexShrink` and no
 * responsive `align` — it writes the panel after the main column and the region takes it from there
 * (G12/G13 closed). Below `sm` that same one node stacks under the body, no twin (C9).
 */
import { SimpleGrid, Stack, Text } from '@mantine/core'
import { PageAside, PageBar, QueryState, Section, StatCard } from 'basalt-ui'
import type { StatCardTone } from 'basalt-ui'
import { ChartCard, Heatmap, LineSparkline, MultiLine, VX, ZonedLine } from 'basalt-ui/charts'
import type { AxisConfig, ChartSeries, ZoneSpec } from 'basalt-ui/charts'
import { FilterSet, RangeFilter, ViewTabs } from 'basalt-ui/controls'
import { BasaltDataTable } from 'basalt-ui/data'
import { createBasaltQueryClient, QueryClientProvider } from 'basalt-ui/query'
import { alpha } from 'basalt-ui/tokens'
import { useMemo, useState } from 'react'
import { IconActivity, IconChart, IconComponents, IconCurrency } from '../icons'
import { CbbiDistributionBars, CbbiPanel } from './CbbiPanel'
import {
  bucketRows,
  CBBI_METRICS,
  fmtMonthTick,
  histogram,
  money,
  pct,
  ratio,
  rowsInRange,
} from './cbbi-data'
import type { CbbiMetricKey, CbbiRow, CbbiZone, HistogramBin } from './cbbi-data'
import { useCbbi } from './cbbi-query'
import { cbbiFilters, useCbbiWeights } from './cbbi-store'
import {
  buildPoints,
  buildSummary,
  CBBI_HEAT_COLS,
  cbbiMonthColumns,
  heatYears,
  hotMetricNames,
  isDefaultComposition,
  monthlyHeat,
  monthlyTable,
} from './cbbi-view'
import type { CbbiPoint, CbbiScale } from './cbbi-view'

/** 20 bins is the brief's; `Bars` renders 20 categories legibly at main width and not at 260px. */
const HISTOGRAM_BINS = 20

/** The history table's window — two years of monthly rows is what fits without pagination. */
const TABLE_MONTHS = 24

const HEAT_HEIGHT = 300
const MAIN_CHART_HEIGHT = 260
const METRIC_CHART_HEIGHT = 150
/** The combined price+confidence chart's height — one tall plot in place of two 260px ones. */
const COMBINED_CHART_HEIGHT = 520

/**
 * `StatCard.tone` is a three-value vocabulary (`good | warn | bad`) and the index is read the other
 * way round from a KPI: a HIGH reading is the dangerous one. `peak` is therefore `bad` and
 * `bottom` is `good`; the mid band asserts nothing and carries no rail.
 */
const ZONE_TONE: Partial<Record<CbbiZone, StatCardTone>> = {
  peak: 'bad',
  bottom: 'good',
}

const ZONE_LABEL: Record<CbbiZone, string> = {
  peak: 'Top zone — above 0.9',
  bottom: 'Bottom zone — below 0.1',
  mid: 'Between the bands',
}

/**
 * The 0.1 / 0.9 overlays. `-Infinity`/`Infinity` clamp to the resolved domain (`ZoneRects`), so the
 * bands reach the axis ends without restating `[0, 1]` here.
 */
const CONFIDENCE_ZONES: ZoneSpec[] = [
  { from: 0.9, to: Infinity, fill: alpha(VX.badSolid, 0.14) },
  { from: -Infinity, to: 0.1, fill: alpha(VX.goodSolid, 0.14) },
]

/** `CONFIDENCE_ZONES`, anchored to the right axis — the combined chart's confidence lines read
 * against `y2`, so their zone bands have to follow. */
function withAxisSide(zones: readonly ZoneSpec[], axisSide: 'left' | 'right'): ZoneSpec[] {
  return zones.map((z) => ({ ...z, axisSide }))
}

const CONFIDENCE_ZONES_RIGHT = withAxisSide(CONFIDENCE_ZONES, 'right')

const CONFIDENCE_AXIS: AxisConfig<CbbiPoint> = { domain: [0, 1], format: pct }

/**
 * The x accessors, at module scope.
 *
 * `CartesianChart` keys its measured margins and its scales on `[data, getX]`, and every chart kind
 * here is `memo`ized — so a `(d) => d.key` written inline is a new identity on every commit and
 * re-measures and re-scales up to nine charts over as many as 5,541 points, on nothing more than a
 * `isFetching` flip. `row.day` is the same string, stamped once at parse (`cbbi-data.ts`).
 */
const pointDay = (d: CbbiPoint): string => d.key
const rowDay = (d: CbbiRow): string => d.day

/** The price line — static: it closes over nothing the page can change. `formatValue` is unneeded
 * now that `getValue` returns the raw price directly and the axis already formats it with `money`
 * (the fallback tooltip format, per `CartesianChart`'s own `tooltipSeries`). */
const PRICE_SERIES: ChartSeries<CbbiPoint>[] = [
  {
    key: 'price',
    label: 'BTC price',
    color: VX.accent,
    mark: 'line',
    getValue: (d) => d.price,
  },
]

const METRIC_AXIS: AxisConfig<CbbiRow> = { domain: [0, 1], format: pct }

/**
 * One series declaration per metric, built ONCE — it depends only on the metric's key and label,
 * both static, so a literal per card per render would defeat `memo(ZonedLine)` for no gain.
 */
const METRIC_SERIES = Object.fromEntries(
  CBBI_METRICS.map((metric) => [
    metric.key,
    [
      {
        key: metric.key,
        label: metric.label,
        color: VX.accent,
        mark: 'line' as const,
        getValue: (d: CbbiRow) => d.metrics[metric.key],
      },
    ] satisfies ChartSeries<CbbiRow>[],
  ]),
) as Record<CbbiMetricKey, ChartSeries<CbbiRow>[]>

/**
 * The price card's trend, as a render prop over the slot's MEASURED box — hoisted for the reason
 * `DashboardPage.kpiSparkline` is: a closure defined during render is a fresh component identity
 * every commit, and the render prop is what lets the sparkline follow the slot's width instead of
 * hardcoding one.
 */
function priceSparkline(history: readonly number[]) {
  return ({ width, height }: { width: number; height: number }) => (
    <LineSparkline
      data={[...history]}
      width={width}
      height={height}
      ariaLabel="BTC price, last 90 days"
    />
  )
}

const VIEW_OPTIONS = [
  { value: 'overview' as const, label: 'Overview' },
  { value: 'metrics' as const, label: 'Metrics' },
  { value: 'history' as const, label: 'History' },
]

export function CbbiPage() {
  // The playground mounts no app-wide client (`main.tsx` wires `BasaltProvider` only), so the page
  // owns one — the same page-local shape `QueryDemoPage` uses.
  const [client] = useState(() => createBasaltQueryClient())
  return (
    <QueryClientProvider client={client}>
      <CbbiPageBody />
    </QueryClientProvider>
  )
}

function CbbiPageBody() {
  const filters = cbbiFilters.useValues()
  const weights = useCbbiWeights()
  const query = useCbbi()

  return (
    <Stack gap="sm">
      <PageBar
        tabs={<ViewTabs field={cbbiFilters.field.view} label="View" options={VIEW_OPTIONS} />}
        sync={{
          syncing: query.isFetching,
          lastCompletedAt: query.dataUpdatedAt === 0 ? null : query.dataUpdatedAt,
          onSync: () => void query.refetch(),
        }}
        filters={
          <FilterSet>
            <RangeFilter field={cbbiFilters.field.range} label="Window" />
          </FilterSet>
        }
      />

      <QueryState
        query={query}
        errorTitle="Could not load the CBBI series"
        errorFallback="colintalkscrypto.com did not answer."
      >
        {(rows) => <CbbiBody rows={rows} filters={filters} weights={weights} />}
      </QueryState>
    </Stack>
  )
}

type CbbiFilters = ReturnType<typeof cbbiFilters.useValues>

/**
 * The page body: the main column's own `Stack`, then the panel as the shell's aside. The layout is
 * the REGION's now — no width, no `flexShrink`, no responsive `align` here (G13), and below `sm`
 * `PageAside` renders that same one node in flow, right where it is written (C9).
 */
function CbbiBody({
  rows,
  filters,
  weights,
}: {
  rows: CbbiRow[]
  filters: CbbiFilters
  weights: Record<CbbiMetricKey, number>
}) {
  const enabled = useMemo(() => new Set<CbbiMetricKey>(filters.metrics), [filters.metrics])
  const summary = useMemo(() => buildSummary(rows, weights, enabled), [rows, weights, enabled])
  const bins = useMemo(
    () =>
      histogram(
        rows.map((row) => row.confidence),
        HISTOGRAM_BINS,
      ),
    [rows],
  )

  const bucketed = useMemo(
    () => bucketRows(rowsInRange(rows, filters.range), filters.granularity),
    [rows, filters.range, filters.granularity],
  )
  const points = useMemo(
    () => buildPoints(bucketed, weights, enabled),
    [bucketed, weights, enabled],
  )

  // `buildSummary` returns null only for an empty series, which `QueryState`'s own empty branch
  // has already caught — the guard is what lets every card below take a non-optional number
  // instead of an `x ? y : '—'` at each of the twelve places one is printed.
  if (!summary) return null

  return (
    <Stack gap="sm">
      {filters.view === 'overview' && (
        <CbbiOverview
          points={points}
          bins={bins}
          summary={summary}
          zonesOn={filters.zones}
          scale={filters.scale}
          layout={filters.layout}
          reweighted={!isDefaultComposition(weights, enabled)}
        />
      )}
      {filters.view === 'metrics' && (
        <CbbiMetricGrid
          rows={bucketed}
          latest={summary.latest}
          weights={weights}
          enabled={enabled}
          zonesOn={filters.zones}
        />
      )}
      {filters.view === 'history' && <CbbiHistory rows={rows} />}

      <PageAside title="Inspector" persistKey="cbbi">
        <CbbiPanel rows={rows} latest={summary.latest} bins={bins} weights={weights} />
      </PageAside>
    </Stack>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────────────

type Summary = NonNullable<ReturnType<typeof buildSummary>>

function CbbiOverview({
  points,
  bins,
  summary,
  zonesOn,
  scale,
  layout,
  reweighted,
}: {
  points: CbbiPoint[]
  bins: HistogramBin[]
  summary: Summary
  zonesOn: boolean
  scale: CbbiScale
  /** `'split'` renders price and confidence as two stacked cards; `'combined'` folds them into
   * one dual-axis chart — see `cbbi-store.ts`'s `layout` field. */
  layout: 'split' | 'combined'
  /** True once the panel has moved a weight or dropped a metric — see `isDefaultComposition`. */
  reweighted: boolean
}) {
  // Every chart input below is memoized on what it actually varies with: the kinds are `memo`ized
  // and `CartesianChart` re-measures on a new `getX`/`data`, so a fresh literal per commit would
  // re-lay-out three charts over up to 5,541 points each time the sync indicator blinks.
  const priceAxis = useMemo<AxisConfig<CbbiPoint>>(
    () => ({
      domain: 'auto',
      // Ignored when `scale === 'log'` — a log axis has no zero baseline (`AxisConfig.scale`
      // JSDoc). On `linear` it still pads down from the data minimum instead of forcing zero, so a
      // price that starts at $16 and ends at $80,000 doesn't draw one flat line.
      autoMinCeil: Infinity,
      scale,
      format: money,
    }),
    [scale],
  )

  // The reweighted line is drawn only once the reader has moved something: at the published
  // composition it IS the official reading, and two lines claiming to be one is a worse chart.
  const zoneTone = ZONE_TONE[summary.zone]
  const hotNames = hotMetricNames(summary.hotKeys)
  const custom = summary.custom

  const confidenceSeries = useMemo<ChartSeries<CbbiPoint>[]>(
    () => [
      {
        key: 'official',
        label: 'Official CBBI',
        color: VX.accent,
        mark: 'line',
        getValue: (d) => d.official,
      },
      ...(reweighted
        ? [
            {
              key: 'custom',
              label: 'Reweighted',
              color: VX.warnSolid,
              mark: 'line' as const,
              dash: 'dashed' as const,
              getValue: (d: CbbiPoint) => d.custom,
            },
          ]
        : []),
    ],
    [reweighted],
  )

  // The combined chart's confidence lines read against `y2` (`axis: 'right'`) and, unlike the
  // split card above, sit alongside the price line on the SAME plot — `VX.ink` keeps the official
  // reading visually distinct from `VX.accent` price rather than the two overlapping in hue.
  const combinedSeries = useMemo<ChartSeries<CbbiPoint>[]>(
    () => [
      ...PRICE_SERIES,
      {
        key: 'official',
        label: 'Official CBBI',
        color: VX.ink,
        mark: 'line',
        axis: 'right',
        getValue: (d) => d.official,
      },
      ...(reweighted
        ? [
            {
              key: 'custom',
              label: 'Reweighted',
              color: VX.warnSolid,
              mark: 'line' as const,
              dash: 'dashed' as const,
              axis: 'right' as const,
              getValue: (d: CbbiPoint) => d.custom,
            },
          ]
        : []),
    ],
    [reweighted],
  )

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <StatCard
          icon={<IconActivity />}
          title="Confidence"
          info="The published index — the arithmetic mean of today's available metrics."
          value={pct(summary.official)}
          subtitle={ZONE_LABEL[summary.zone]}
          {...(summary.officialDelta !== undefined && {
            delta: summary.officialDelta,
            // A percentage-POINT move, not a relative change — the default `%` format would read
            // a 0.32 → 0.44 move as `▲35.9%` instead of the `▲12.0 pp` it actually is.
            deltaFormat: (d: number) => `${Math.abs(d).toFixed(1)} pp`,
          })}
          deltaPeriod="30d"
          // The index climbs toward a cycle top — a rising reading is the dangerous one, the same
          // verdict the tone rail already states.
          deltaPolarity="up-bad"
          {...(zoneTone !== undefined && { tone: zoneTone })}
        />
        <StatCard
          icon={<IconComponents />}
          title="Reweighted"
          info="The same metrics under the panel's weights and selection."
          value={custom === null ? '—' : pct(custom)}
          subtitle="Weighted mean over the enabled metrics"
          {...(summary.customGap !== null && {
            delta: summary.customGap,
            deltaPeriod: 'vs off.',
            // A percentage-POINT gap, not a percentage change — the default `%` suffix would
            // claim the wrong unit on the one card whose number is a difference of two ratios.
            deltaFormat: (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pp`,
            deltaGlyph: false,
            // A gap is not a verdict either way — neither colour claims the reweighting is good
            // or bad.
            deltaPolarity: 'neutral',
          })}
        />
        <StatCard
          icon={<IconCurrency />}
          title="BTC price"
          value={money(summary.price)}
          {...(summary.priceDelta !== undefined && { delta: summary.priceDelta })}
          deltaPeriod="30d"
          sparklinePlacement="right"
          sparkline={priceSparkline(summary.priceHistory)}
        />
        <StatCard
          icon={<IconChart />}
          title="Metrics ≥ 0.9"
          info="How many of the nine sub-metrics are in their own top zone today."
          value={String(summary.hotKeys.length)}
          unit="of 9"
          {...(hotNames !== undefined && { subtitle: hotNames, tone: 'bad' as const })}
        />
      </SimpleGrid>

      {/*
       * Price and confidence are TWO cards, not one `DualPanel`, in the `split` layout.
       * `DualPanel`'s bottom pane is a signed histogram with its own symmetric domain — it cannot
       * draw a 0..1 line, take zone bands on that pane, or express a log top pane — so the shape it
       * generalizes is not this one. Two `ChartCard`s over the same `getX` keys share the page
       * cursor anyway, which is the property the dual pane was wanted for. `combined` folds both
       * into one dual-axis `MultiLine` instead — the layout filter picks between the two readings.
       */}
      {layout === 'split' ? (
        <>
          <ChartCard
            title="BTC price"
            icon={<IconCurrency />}
            info="Closing price per bucket. The scale filter switches the axis between log and linear."
            value={money(summary.price)}
            {...(summary.priceDelta !== undefined && { delta: summary.priceDelta })}
            deltaPeriod="30d"
          >
            <MultiLine
              data={points}
              height={MAIN_CHART_HEIGHT}
              chartId="cbbi-price"
              ariaLabel="Bitcoin price"
              getX={pointDay}
              formatX={fmtMonthTick}
              y={priceAxis}
              series={PRICE_SERIES}
            />
          </ChartCard>

          <ChartCard
            title="Confidence index"
            icon={<IconActivity />}
            info="0 is a cycle bottom, 1 a cycle top. The bands mark the 0.1 and 0.9 thresholds."
            value={pct(summary.official)}
          >
            <MultiLine
              data={points}
              height={MAIN_CHART_HEIGHT}
              chartId="cbbi-confidence"
              ariaLabel="CBBI confidence index"
              getX={pointDay}
              formatX={fmtMonthTick}
              y={CONFIDENCE_AXIS}
              {...(zonesOn && { zones: CONFIDENCE_ZONES })}
              series={confidenceSeries}
            />
          </ChartCard>
        </>
      ) : (
        <ChartCard
          title="Price & confidence"
          icon={<IconActivity />}
          info="Left axis is BTC price (the scale filter switches log/linear); right axis is the
            0..1 confidence index. Same bucket, same day, one plot."
          value={money(summary.price)}
          subtitle={`${pct(summary.official)} confidence`}
        >
          <MultiLine
            data={points}
            height={COMBINED_CHART_HEIGHT}
            chartId="cbbi-combined"
            ariaLabel="Bitcoin price and CBBI confidence index"
            getX={pointDay}
            formatX={fmtMonthTick}
            y={priceAxis}
            y2={CONFIDENCE_AXIS}
            {...(zonesOn && { zones: CONFIDENCE_ZONES_RIGHT })}
            series={combinedSeries}
          />
        </ChartCard>
      )}

      <ChartCard
        title="Distribution"
        icon={<IconChart />}
        info={`Every day of the series since 2011, in ${HISTOGRAM_BINS} equal bins.`}
        value={pct(summary.official)}
        subtitle="The hero value is today's reading — find it along the axis."
        count={bins.length}
      >
        <CbbiDistributionBars bins={bins} height={MAIN_CHART_HEIGHT} />
      </ChartCard>
    </Stack>
  )
}

// ── Metrics ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Small multiples, one per ENABLED metric. No cursor provider: the page-wide cursor is the default,
 * so hovering any card crosshairs every other card and both overview charts on the same day.
 */
function CbbiMetricGrid({
  rows,
  latest,
  weights,
  enabled,
  zonesOn,
}: {
  rows: CbbiRow[]
  latest: CbbiRow
  weights: Record<CbbiMetricKey, number>
  enabled: ReadonlySet<CbbiMetricKey>
  zonesOn: boolean
}) {
  const shown = CBBI_METRICS.filter((metric) => enabled.has(metric.key))

  if (shown.length === 0) {
    return (
      <Section title="Metrics">
        <Text size="sm" c="dimmed">
          Every metric is switched off in the Weights group — switch one back on to plot it.
        </Text>
      </Section>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
      {shown.map((metric) => {
        const value = latest.metrics[metric.key]
        return (
          <ChartCard
            key={metric.key}
            title={metric.label}
            info={metric.hint}
            value={value === null ? '—' : ratio(value)}
            subtitle={`Weight ×${weights[metric.key].toFixed(2)}`}
          >
            <ZonedLine
              data={rows}
              height={METRIC_CHART_HEIGHT}
              chartId={`cbbi-metric-${metric.key}`}
              ariaLabel={metric.label}
              getX={rowDay}
              formatX={fmtMonthTick}
              y={METRIC_AXIS}
              {...(zonesOn && { zones: CONFIDENCE_ZONES })}
              legend={false}
              series={METRIC_SERIES[metric.key]}
            />
          </ChartCard>
        )
      })}
    </SimpleGrid>
  )
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────

function CbbiHistory({ rows }: { rows: CbbiRow[] }) {
  const cells = useMemo(() => monthlyHeat(rows), [rows])
  const years = useMemo(() => heatYears(cells), [cells])
  const table = useMemo(() => monthlyTable(bucketRows(rows, 'month'), TABLE_MONTHS), [rows])

  return (
    <Stack gap="sm">
      <ChartCard
        title="Mean confidence by month"
        icon={<IconChart />}
        info="Every calendar month of the series, averaged — the four cycles read as four bands."
        count={cells.length}
      >
        <Heatmap
          data={cells}
          height={HEAT_HEIGHT}
          chartId="cbbi-heat"
          ariaLabel="Mean CBBI confidence by year and month"
          getRow={(d) => d.year}
          getCol={(d) => d.month}
          getValue={(d) => d.value}
          rows={years}
          cols={[...CBBI_HEAT_COLS]}
          color={VX.accent}
          formatValue={pct}
          legend={{ min: '0%', max: '100%' }}
        />
      </ChartCard>

      <Section
        title="Monthly readings"
        icon={<IconActivity />}
        subtitle="Last two years of monthly buckets — price and the official index take the last
          reading of the month, each metric its mean."
      >
        <BasaltDataTable
          title="Monthly readings"
          data={table}
          columns={cbbiMonthColumns}
          maxHeight={520}
          minWidth={980}
          highlightOnHover
        />
      </Section>
    </Stack>
  )
}
