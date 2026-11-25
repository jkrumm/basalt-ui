import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Delta, Empty } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, Lines, RangeNavigator, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure, ChartWindowSpans, Series } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { shotState } from 'basalt-ui/data'
import { CardGrid, Page, PageBar, useSizeClass } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { useMemo } from 'react'
import type { ReactElement } from 'react'
import {
  BOTTOM,
  DEFAULT_METRICS,
  HALVINGS,
  METRICS,
  NO_SNAPSHOT,
  TOP,
  buildDays,
  cbbiQuery,
  cyclesOf,
  verdictOf,
} from '../../demo/cbbi'
import type { Cycle, Day, MetricKey } from '../../demo/cbbi'

const pair = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})
const PRICE = pair(1)
const SCORE = pair(5)

const WINDOWS = ['3m', '1y', '4y', 'all'] as const
const SPANS: ChartWindowSpans<(typeof WINDOWS)[number]> = {
  '3m': 91,
  '1y': 365,
  '4y': 1461,
  all: 'all',
}

/** The window, the metrics behind the confidence and the diminishing-returns variant: all in the URL. */
const page = defineControls({
  id: 'dashboard',
  scope: 'page',
  fields: {
    window: field
      .range({ presets: WINDOWS, fallback: 'all', custom: true })
      .labels({ '3m': '3M', '1y': '1Y', '4y': '4Y', all: 'All', custom: 'Custom' }),
    metrics: field
      .multi(
        METRICS.map((m) => m.key),
        DEFAULT_METRICS,
      )
      .labels(Object.fromEntries(METRICS.map((m) => [m.key, m.label]))),
    diminishing: field.boolean(true),
    metricsView: field
      .enum(['charts', 'table'], 'charts')
      .labels({ charts: 'Metric charts', table: 'Metric table' }),
  },
})

const ALL_METRICS: readonly MetricKey[] = METRICS.map((m) => m.key)

const MINUS = '\u2212'
const signed = (v: number): string => `${v < 0 ? MINUS : '+'}${Math.abs(Math.round(v))}`

const NO_DATA: Empty = {
  cause: 'The CBBI snapshot has no readings. Regenerate it with scripts/cbbi-snapshot.ts.',
  // The cards take it only while the snapshot has no days, so a card holding an object result says so.
  when: () => true,
}

/** The parts after the first hold their height with a short caption: the hero states the cause once. */
const NO_READINGS: Empty = { cause: 'No readings.', when: () => true }

/** One metric as a table row: where it stands and where it was three months ago. */
type MetricRow = { id: string; label: string; now: number; change: number; verdict: string }
const m = col<MetricRow>()

/** Where the index calls a top and a bottom, drawn on every chart that reads the score. */
const ZONES = [
  { from: TOP, to: 100, fill: alpha(BASALT.bad, 0.08) },
  { from: 0, to: BOTTOM, fill: alpha(BASALT.good, 0.08) },
]

const c = col<Cycle>()

function DashboardRoute(): ReactElement {
  const f = useFormat()
  // The captions that name the lowest and highest price need a wide plot to clear the lines.
  const wide = useSizeClass() === 'expanded'
  const usd = (v: number): string =>
    f.number(v, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: v >= 10_000 ? 1 : 0,
      ...(v >= 10_000 && { notation: 'compact' }),
    })
  // The store's values are stable while the URL holds, so they key the derivations below.
  const { window: range, metrics: picked, diminishing, metricsView } = page.useValues()
  // An empty pick reads as every metric, the multi field's own meaning of "all".
  const selected = useMemo(() => (picked.length === 0 ? ALL_METRICS : picked), [picked])
  const query = shotState(useQuery(cbbiQuery), { empty: NO_SNAPSHOT })

  const days = useMemo(
    () => (query.data === undefined ? undefined : buildDays(query.data, { selected, diminishing })),
    [query.data, selected, diminishing],
  )
  const view = useMemo(
    () => (days === undefined ? undefined : RangeNavigator.window(days, (d) => d.t, range, SPANS)),
    [days, range],
  )
  const cycles = useMemo(() => (days === undefined ? undefined : cyclesOf(days)), [days])

  const month = (at: Date | number): string => f.date(at, 'month', { month: 'short' })
  const dayText = (d: Day): string =>
    `${f.date(d.t)}: ${usd(d.price)}${d.score === null ? '' : `, ${Math.round(d.score)}`}`
  const focus = useChartFocus(view?.data, {
    announce: dayText,
    announceSpan: (run) =>
      `${f.date(run[0]?.t ?? 0)} to ${f.date(run.at(-1)?.t ?? 0)}: ${run.length} readings`,
  })

  const table = useDataTable({
    id: 'dashboard-cycles',
    label: 'Cycles',
    columns: [
      c.entity('label', {
        header: 'Cycle',
        sub: (r) => `${month(r.from)} to ${month(r.to)}`,
        sortable: false,
      }),
      c.money('bottom', {
        header: 'Bottom',
        currency: 'USD',
        digits: 0,
        priority: 2,
        sortable: false,
      }),
      c.money('top', { header: 'Top', currency: 'USD', digits: 0, priority: 2, sortable: false }),
      c.number('multiple', { header: 'Multiple', unit: '×', digits: 0, sortable: false }),
      c.number('days', { header: 'Days', digits: 0, priority: 2, sortable: false }),
    ],
    data: cycles,
    phase: query,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    bodyRows: HALVINGS.length,
    phone: 'fields',
  })

  const empty = query.data?.price.length === 0
  const noData = empty ? NO_DATA : null
  const noReadings = empty ? NO_READINGS : null
  const last = days?.at(-1)
  const metricRows: MetricRow[] | undefined =
    last === undefined
      ? undefined
      : selected.flatMap((key) => {
          const now = last.metrics[key]
          const before = days?.at(-31)?.metrics[key]
          const meta = METRICS.find((x) => x.key === key)
          return now == null || before == null || meta === undefined
            ? []
            : [
                {
                  id: key,
                  label: meta.label,
                  now,
                  change: now - before,
                  verdict: verdictOf(now).label,
                },
              ]
        })
  const metricTable = useDataTable({
    id: 'dashboard-metrics',
    label: 'Metrics',
    columns: [
      m.entity('label', { header: 'Metric', sortable: false }),
      m.meter('now', { header: 'Score', max: 100, sortable: false }),
      m.delta('change', {
        header: 'In 3 months',
        polarity: 'up-bad',
        unit: 'pts',
        sortable: false,
      }),
      m.text('verdict', { header: 'Reading', sortable: false }),
    ],
    data: metricRows,
    phase: query,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    bodyRows: DEFAULT_METRICS.length,
  })
  const yearAgo =
    last === undefined
      ? undefined
      : days?.findLast((d) => d.t.getTime() <= last.t.getTime() - 365 * 86_400_000)
  const yearChange =
    last === undefined || yearAgo === undefined
      ? undefined
      : ((last.price - yearAgo.price) / yearAgo.price) * 100
  const status = last?.score == null ? undefined : verdictOf(last.score)
  const figure: ChartFigure | undefined =
    last === undefined
      ? undefined
      : {
          value: usd(last.price),
          delta:
            yearChange === undefined
              ? undefined
              : {
                  value: `${yearChange < 0 ? MINUS : '+'}${Math.abs(yearChange).toFixed(0)}%`,
                  polarity: 'up-good',
                  label: 'in a year',
                },
          status:
            status === undefined || last.score == null
              ? undefined
              : {
                  tone: status.tone,
                  label: `CBBI ${Math.round(last.score)}, ${status.label.toLowerCase()}`,
                },
        }

  const priceSeries: Series<Day>[] = [
    {
      mark: 'line',
      key: 'score',
      label: 'Confidence',
      color: SCORE,
      y: (d) => d.score,
      weight: 'quiet',
      area: 'fade',
      tooltip: false,
    },
    {
      mark: 'line',
      key: 'price',
      label: 'Price',
      color: PRICE,
      y: (d) => d.price,
      axis: 'right',
      weight: 'strong',
      format: usd,
      extremes: wide,
      colorBy: {
        value: (d) => d.score,
        domain: [0, 100],
        label: 'Confidence',
        format: (v) => v.toFixed(0),
      },
      status: (_, d) => (d.score === null ? undefined : verdictOf(d.score)),
    },
  ]

  return (
    <Page area="dashboard">
      <PageBar
        tabs={{ state: page.field.metricsView, label: 'Metrics view' }}
        controls={filterSlot([
          spec(page.field.metrics, 'Metrics'),
          spec(page.field.diminishing, 'Diminishing returns'),
        ])}
      />
      <div className="grid h-120 shrink-0 grid-rows-1">
        <ChartCard
          phase={query}
          empty={noData}
          title="Bitcoin price against the CBBI"
          subtitle="daily since 2011, log scale, colored by the confidence"
          info="The CBBI averages the selected on-chain metrics into one 0 to 100 reading: 0 is a cycle bottom, 100 a top. Pick a window, or drag the strip under the plot."
          figure={figure}
          height="fill"
          panes={[
            {
              weight: 3,
              chart: () =>
                view === undefined || view.data.length === 0 ? null : (
                  <CartesianChart
                    label="Bitcoin price on a log scale with the CBBI confidence"
                    data={view.data}
                    x={{ value: (d) => d.t, domain: view.domain }}
                    y={{ domain: [0, 100], title: 'CBBI' }}
                    y2={{ scale: 'log', title: 'USD', format: usd }}
                    series={priceSeries}
                    zones={ZONES}
                    events={HALVINGS}
                    tooltip={{ change: 'start' }}
                    focus={focus}
                    height="fill"
                  />
                ),
            },
            {
              chart: () =>
                days === undefined || days.length === 0 ? null : (
                  <RangeNavigator
                    label="Price history window"
                    data={days}
                    x={(d) => d.t}
                    y={(d) => d.price}
                    color={PRICE}
                    scale="log"
                    window={page.field.window}
                    spans={SPANS}
                    height="fill"
                  />
                ),
            },
          ]}
        />
      </div>
      <DataPanel
        phase={query}
        empty={noReadings}
        title="Cycle returns"
        subtitle="lowest close before a halving to the highest after it"
        bodySize={{ rows: HALVINGS.length + 1 }}
        body={() => (
          <DataTable
            table={table}
            height="fill"
            focusItems={{ focus, holds: (row: Cycle, d: Day) => d.t >= row.from && d.t <= row.to }}
          />
        )}
      />
      {metricsView === 'table' ? (
        <DataPanel
          phase={query}
          empty={noReadings}
          title="Where each metric stands"
          subtitle="score now and its change since three months ago"
          bodySize={{ rows: selected.length + 1 }}
          body={() => <DataTable table={metricTable} height="fill" />}
        />
      ) : (
        <CardGrid min="narrow">
          {selected.map((key) => {
            const meta = METRICS.find((x) => x.key === key)
            const label = meta?.label ?? key
            const now = last?.metrics[key]
            const before = days?.at(-31)?.metrics[key]
            const delta: Delta | undefined =
              now == null || before == null
                ? undefined
                : {
                    value: `${signed(now - before)} pts`,
                    polarity: 'up-bad',
                    label: 'in 3 months',
                  }
            return (
              <ChartCard
                key={key}
                phase={query}
                empty={noReadings}
                title={label}
                subtitle="0 is a bottom, 100 a top"
                info={`${meta?.about ?? ''} Scored 0 to 100: higher is nearer a top.`}
                height="short"
                figure={{
                  value: now == null ? null : Math.round(now),
                  unit: 'of 100',
                  delta,
                  status: now == null ? undefined : verdictOf(now),
                }}
                chart={(box) =>
                  view === undefined ? null : (
                    <Lines
                      label={`${label} score`}
                      data={view.data}
                      x={{ value: (d) => d.t, domain: view.domain, ticks: [] }}
                      y={{ domain: [0, 100] }}
                      series={[
                        {
                          mark: 'line',
                          key,
                          label,
                          color: SCORE,
                          y: (d) => d.metrics[key],
                          weight: 'quiet',
                          area: 'fade',
                          legend: false,
                          format: (v) => `${v.toFixed(0)} of 100`,
                          status: (v) => verdictOf(v),
                        },
                      ]}
                      zones={ZONES}
                      naming="legend"
                      focus={focus}
                      height={box.height}
                    />
                  )
                }
              />
            )
          })}
        </CardGrid>
      )}
    </Page>
  )
}

export const Route = createFileRoute('/kit/dashboard')({
  staticData: { title: 'Dashboard' },
  validateSearch: page.validateSearch,
  search: { middlewares: page.middlewares },
  component: DashboardRoute,
})
