/**
 * S4 — Spend and usage (stands for argo usage-tracking). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Am I within budget, and what is driving it?
 *   Decision: Cut a project or raise the budget.
 *
 * Built with today's basalt exports and nothing else: this is the honest baseline the design track
 * improves, so a gap here (no Meter, no BarList, a spinner instead of a StatCard skeleton) is left
 * visible and marked `W34:` rather than patched locally. Actions ("Raise budget") are inert in
 * fixtures.
 *
 * Anchors for `basalt-ui shot`: every scored component carries `data-shot`; `StatCard`, `ChartCard`
 * and `Section` do not forward `data-*`, so the anchor is the wrapping `Box`.
 */
import { Box, SimpleGrid, Stack } from '@mantine/core'
import { PageBar, Section, StatCard, StatGroup } from 'basalt-ui'
import { Bars, ChartCard, Donut, Sparkline } from 'basalt-ui/charts'
import type { BarsBar } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  BUDGET_EUR,
  DAILY,
  DAYS_ELAPSED,
  DISTRIBUTION,
  FORECAST_EUR,
  MODEL_KEYS,
  MODEL_LABEL,
  MONTH_DAYS,
  MONTH_LABEL,
  MONTH_NAME,
  MTD_EUR,
  MTD_TOTALS,
  PRIOR_MTD_EUR,
  PRIOR_WINDOW_LABEL,
  PROJECT_LABEL,
  PROJECTS_MTD,
  WINDOW_LABEL,
  YEAR,
  fmtEur,
  fmtShare,
  fmtSignedShare,
} from './spend-data'
import type { DayRow, DistributionBin, ModelKey, ProjectKey, ProjectRow } from './spend-data'
import { chartStateFor, queryFor } from './shot-state'
import type { ScenarioProps } from './shot-state'

const MODEL_COLOR: Record<ModelKey, string> = {
  large: demoColors.sessions,
  mid: demoColors.signups,
  small: demoColors.revenue,
}

const PROJECT_COLOR: Record<ProjectKey, string> = {
  search: demoColors.sessions,
  support: demoColors.signups,
  summaries: demoColors.revenue,
  ingest: demoColors.churn,
  evals: VX.accent,
  sandbox: VX.line2,
}

const MODEL_BARS: BarsBar<DayRow>[] = MODEL_KEYS.map((key) => ({
  key,
  label: MODEL_LABEL[key],
  color: MODEL_COLOR[key],
  getValue: (d) => d[key],
  formatValue: fmtEur,
}))

const DISTRIBUTION_BARS: BarsBar<DistributionBin>[] = [
  { key: 'days', label: 'Days', color: VX.neutral, getValue: (d) => d.days },
]

const PACE_EUR_PER_DAY = BUDGET_EUR / MONTH_DAYS
const DAILY_DATA = [...DAILY]
const DISTRIBUTION_DATA = [...DISTRIBUTION]
const DONUT_DATA = PROJECTS_MTD.map((p) => ({ key: p.key, value: p.spend }))
const PROJECT_ROWS = [...PROJECTS_MTD]
const NO_ROWS: ProjectRow[] = []
const PACE_LINES = [
  { value: PACE_EUR_PER_DAY, color: VX.faint, dashed: true, legend: { label: 'Budget pace' } },
]

const USAGE_ERROR = 'The usage export did not answer. Retry, or reconnect it in Settings.'
const USAGE_EMPTY = 'No spend recorded in the window. Check that the usage export is connected.'

const retryCopy = (what: string): string =>
  `${what} failed to load. Retry, or check the usage export connection.`

const columns = (() => {
  const col = createColumnHelper<ProjectRow>()
  return [
    col.accessor('label', { header: 'Project' }),
    col.accessor('spend', {
      header: `Spend, ${WINDOW_LABEL} (€)`,
      cell: (c) => fmtEur(c.getValue()),
      meta: { align: 'right', numeral: true },
    }),
    col.accessor('share', {
      header: 'Share of total',
      cell: (c) => fmtShare(c.getValue()),
      meta: { align: 'right', numeral: true },
    }),
    col.accessor('change', {
      header: `vs ${PRIOR_WINDOW_LABEL}`,
      cell: (c) => fmtSignedShare(c.getValue()),
      meta: { align: 'right', numeral: true },
    }),
  ]
})()

function SpendStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  const query = queryFor(shotState, USAGE_ERROR)
  // `StatCard` has no empty branch: `query` drives the sparkline and breakdown only, so the reason
  // and the next step ride the subtitle. Error needs none (the `QueryState` alert already says it).
  // Computed once for all three cards.
  const shared = {
    ...(shotState === 'empty' && { subtitle: USAGE_EMPTY }),
    ...(query !== undefined && { query }),
  }
  const value = (v: number): string => (isAtRest ? fmtEur(v) : '—')
  const left = BUDGET_EUR - MTD_EUR

  return (
    <StatGroup cols={3}>
      <Box data-shot="month-to-date" h="100%">
        <StatCard
          title="Spend, month to date"
          value={value(MTD_EUR)}
          info={`All projects and models, ${WINDOW_LABEL} ${YEAR}, in EUR.`}
          {...(isAtRest && {
            delta: MTD_EUR / PRIOR_MTD_EUR - 1,
            deltaPeriod: `vs ${PRIOR_WINDOW_LABEL}`,
            deltaPolarity: 'up-bad' as const,
          })}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover data-shot-tooltip>
              <Sparkline
                ariaLabel={`Daily spend, ${WINDOW_LABEL}, EUR`}
                data={MTD_TOTALS}
                {...size}
              />
            </Box>
          )}
        />
      </Box>
      <Box data-shot="forecast" h="100%">
        <StatCard
          title={`Forecast, end of ${MONTH_NAME}`}
          value={value(FORECAST_EUR)}
          info={`Average per day so far (${fmtEur(MTD_EUR / DAYS_ELAPSED)}) held flat for all ${MONTH_DAYS} days. Ignores weekends and bursts.`}
          {...(isAtRest && FORECAST_EUR > BUDGET_EUR && { tone: 'bad' as const })}
          {...shared}
        />
      </Box>
      <Box data-shot="budget" h="100%">
        <StatCard
          title={`Budget, ${MONTH_LABEL}`}
          value={value(BUDGET_EUR)}
          info={`Monthly cap in EUR. ${fmtEur(PACE_EUR_PER_DAY)} a day keeps spend on pace.`}
          // W34: meter — the spent share against the cap belongs in a Meter; two rows is the nearest.
          {...(isAtRest && {
            breakdown: [
              { label: `Spent, ${WINDOW_LABEL}`, value: fmtEur(MTD_EUR) },
              {
                label: `Left, ${MONTH_DAYS - DAYS_ELAPSED} days`,
                value: fmtEur(left),
                tone: left < 0 ? ('bad' as const) : ('good' as const),
              },
            ],
          })}
          {...shared}
        />
      </Box>
    </StatGroup>
  )
}

function SpendCharts({ shotState }: ScenarioProps) {
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="spend-over-time" h="100%">
        <ChartCard
          title="Spend by model, last 90 days (€ a day)"
          info="Stacked daily spend per model. The dashed line is the daily pace that lands exactly on the monthly budget."
          state={chartStateFor(shotState, {
            empty: 'No spend in the last 90 days. Connect a project to the usage export.',
            error: retryCopy('Daily spend'),
          })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Bars
              data={DAILY_DATA}
              ariaLabel="Daily spend by model, last 90 days, EUR"
              x={(d) => d.date}
              y={{ format: fmtEur }}
              bars={MODEL_BARS}
              refLines={PACE_LINES}
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="spend-by-project" h="100%">
        <ChartCard
          title={`Spend by project, ${WINDOW_LABEL} (€)`}
          info="Each project's share of month-to-date spend across all models."
          state={chartStateFor(shotState, {
            empty: `No project spent anything ${WINDOW_LABEL}. Connect one to the usage export.`,
            error: retryCopy('Spend by project'),
          })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Donut
              ariaLabel={`Spend by project, ${WINDOW_LABEL}, EUR`}
              data={DONUT_DATA}
              colorForKey={(key) => PROJECT_COLOR[key]}
              seriesLabel={(key) => PROJECT_LABEL[key]}
              formatValue={fmtEur}
              centerLabel={fmtEur(MTD_EUR)}
              centerSubLabel="Month to date"
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function SpendDrivers({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retryCopy('Top drivers'))
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="top-drivers" h="100%">
        <Section title={`Top drivers, ${WINDOW_LABEL} vs ${PRIOR_WINDOW_LABEL}`}>
          {/* W34: bar-list — a ranked list with an inline bar per row; the table is the nearest. */}
          <BasaltDataTable
            // Rows only at rest: the empty branch needs `data` empty, the others have no rows yet.
            data={shotState === undefined ? PROJECT_ROWS : NO_ROWS}
            columns={columns}
            enableSorting={false}
            {...(query !== undefined && { query })}
            emptyState={
              <span>
                No project spent anything {WINDOW_LABEL}. Connect one to the usage export.
              </span>
            }
          />
        </Section>
      </Box>
      <Box data-shot="spend-distribution" h="100%">
        <ChartCard
          title="Days by total spend, last 90 days"
          info="How many of the last 90 days landed in each €10 band of total daily spend."
          state={chartStateFor(shotState, {
            empty: 'No days to bin yet. The histogram needs at least one day of spend.',
            error: retryCopy('The distribution'),
          })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Bars
              data={DISTRIBUTION_DATA}
              ariaLabel="Days by total daily spend, €10 bands, last 90 days"
              x={(d) => d.label}
              bars={DISTRIBUTION_BARS}
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

export function SpendScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar
        actions={[{ key: 'raise', label: 'Raise budget', onClick: () => {}, primary: true }]}
      />
      <SpendStats shotState={shotState} />
      <SpendCharts shotState={shotState} />
      <SpendDrivers shotState={shotState} />
    </Stack>
  )
}
