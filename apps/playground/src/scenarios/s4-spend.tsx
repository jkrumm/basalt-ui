/**
 * S4 — Spend and usage (stands for argo usage-tracking). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Am I within budget, and what is driving it?
 *   Decision: Cut a project or raise the budget.
 *
 * Built with today's basalt exports and nothing else: this is the honest baseline the design track
 * improves, so a gap here (no Meter, no BarList, a spinner instead of a StatCard skeleton) is left
 * visible and marked `W34:` rather than patched locally.
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
  LAST_30_TOTALS,
  MODEL_LABEL,
  MONTH_DAYS,
  MONTH_LABEL,
  MTD_EUR,
  PRIOR_MTD_EUR,
  PROJECTS_MTD,
  fmtEur,
  fmtShare,
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

const MODEL_BARS: BarsBar<DayRow>[] = (Object.keys(MODEL_COLOR) as ModelKey[]).map((key) => ({
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
const WINDOW = `1–${DAYS_ELAPSED} Oct`
const PRIOR_WINDOW = `1–${DAYS_ELAPSED} Sep`

const COPY = {
  stat: {
    empty: 'No spend recorded in the window. Check that the usage export is connected.',
    error: 'The usage export did not answer. Retry, or reconnect it in Settings.',
  },
  daily: {
    empty: 'No spend in the last 90 days. Connect a project to the usage export.',
    error: 'Daily spend failed to load. Retry, or check the usage export connection.',
  },
  projects: {
    empty: `No project spent anything ${WINDOW}. Connect one to the usage export.`,
    error: 'Spend by project failed to load. Retry, or check the usage export connection.',
  },
  distribution: {
    empty: 'No days to bin yet. The histogram needs at least one day of spend.',
    error: 'The distribution failed to load. Retry, or check the usage export connection.',
  },
  drivers: {
    empty: {
      title: `No project spend ${WINDOW}`,
      description: 'Connect a project to the usage export.',
    },
    error: 'Top drivers failed to load. Retry, or check the usage export connection.',
  },
} as const

const driverColumns = (() => {
  const col = createColumnHelper<ProjectRow>()
  return [
    col.accessor('label', { header: 'Project' }),
    col.accessor('spend', {
      header: `Spend, ${WINDOW} (€)`,
      cell: (c) => fmtEur(c.getValue()),
      meta: { align: 'right', numeral: true },
    }),
    col.accessor('share', {
      header: 'Share of total',
      cell: (c) => fmtShare(c.getValue()),
      meta: { align: 'right', numeral: true },
    }),
    col.accessor('change', {
      header: `vs ${PRIOR_WINDOW}`,
      cell: (c) => `${c.getValue() > 0 ? '+' : ''}${Math.round(c.getValue() * 100)} %`,
      meta: { align: 'right', numeral: true },
    }),
  ]
})()

export function SpendScenario({ shotState }: ScenarioProps) {
  const statQuery = queryFor(shotState, COPY.stat.error)
  const isAtRest = shotState === undefined
  const statValue = (value: string): string => (isAtRest ? value : '—')
  // `StatCard` has no empty branch: `query` drives the sparkline and breakdown only, so the
  // reason and the next step ride the subtitle.
  const statSubtitle =
    shotState === 'empty' ? COPY.stat.empty : shotState === 'error' ? COPY.stat.error : undefined
  const dailyState = chartStateFor(shotState, COPY.daily)
  const projectsState = chartStateFor(shotState, COPY.projects)
  const distributionState = chartStateFor(shotState, COPY.distribution)
  const driversQuery = queryFor(shotState, COPY.drivers.error)

  const spendDelta = MTD_EUR / PRIOR_MTD_EUR - 1
  const left = BUDGET_EUR - MTD_EUR

  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar
        actions={[{ key: 'raise', label: 'Raise budget', onClick: () => {}, primary: true }]}
      />

      <StatGroup cols={3}>
        <Box data-shot="daily-spend" h="100%">
          <StatCard
            title={`Spend, month to date`}
            value={statValue(fmtEur(MTD_EUR))}
            info={`All projects and models, ${WINDOW} ${MONTH_LABEL.slice(-4)}, in EUR.`}
            {...(isAtRest && {
              delta: spendDelta,
              deltaPeriod: `vs ${PRIOR_WINDOW}`,
              deltaPolarity: 'up-bad' as const,
            })}
            {...(statSubtitle !== undefined && { subtitle: statSubtitle })}
            {...(statQuery !== undefined && { query: statQuery })}
            sparkline={(size) => (
              <Box data-shot-hover data-shot-tooltip>
                <Sparkline
                  ariaLabel="Daily spend, last 30 days, EUR"
                  data={LAST_30_TOTALS}
                  {...size}
                />
              </Box>
            )}
          />
        </Box>
        <Box data-shot="forecast" h="100%">
          <StatCard
            title={`Forecast, end of ${MONTH_LABEL.split(' ')[0]}`}
            value={statValue(fmtEur(FORECAST_EUR))}
            info={`Average per day so far (${fmtEur(MTD_EUR / DAYS_ELAPSED)}) held flat for all ${MONTH_DAYS} days. Ignores weekends and bursts.`}
            {...(isAtRest && FORECAST_EUR > BUDGET_EUR && { tone: 'bad' as const })}
            {...(statSubtitle !== undefined && { subtitle: statSubtitle })}
            {...(statQuery !== undefined && { query: statQuery })}
          />
        </Box>
        <Box data-shot="budget" h="100%">
          <StatCard
            title={`Budget, ${MONTH_LABEL}`}
            value={statValue(fmtEur(BUDGET_EUR))}
            info={`Monthly cap in EUR. ${fmtEur(PACE_EUR_PER_DAY)} a day keeps spend on pace.`}
            // W34: meter — the spent share against the cap belongs in a Meter; two rows is the nearest.
            {...(isAtRest && {
              breakdown: [
                { label: `Spent, ${WINDOW}`, value: fmtEur(MTD_EUR) },
                {
                  label: `Left, ${MONTH_DAYS - DAYS_ELAPSED} days`,
                  value: fmtEur(left),
                  tone: left < 0 ? ('bad' as const) : ('good' as const),
                },
              ],
            })}
            {...(statSubtitle !== undefined && { subtitle: statSubtitle })}
            {...(statQuery !== undefined && { query: statQuery })}
          />
        </Box>
      </StatGroup>

      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <Box data-shot="spend-over-time" h="100%">
          <ChartCard
            title="Spend by model, last 90 days (€ a day)"
            info="Stacked daily spend per model. The dashed line is the daily pace that lands exactly on the monthly budget."
            {...(dailyState !== undefined && { state: dailyState })}
          >
            <Box data-shot-hover data-shot-tooltip>
              <Bars
                data={[...DAILY]}
                ariaLabel="Daily spend by model, last 90 days, EUR"
                x={(d) => d.date}
                y={{ format: fmtEur }}
                bars={MODEL_BARS}
                refLines={[
                  {
                    value: PACE_EUR_PER_DAY,
                    color: VX.faint,
                    dashed: true,
                    legend: { label: 'Budget pace' },
                  },
                ]}
              />
            </Box>
          </ChartCard>
        </Box>
        <Box data-shot="spend-by-project" h="100%">
          <ChartCard
            title={`Spend by project, ${WINDOW} (€)`}
            info="Each project's share of month-to-date spend across all models."
            {...(projectsState !== undefined && { state: projectsState })}
          >
            <Box data-shot-hover data-shot-tooltip>
              <Donut
                ariaLabel={`Spend by project, ${WINDOW}, EUR`}
                data={PROJECTS_MTD.map((p) => ({ key: p.key, value: p.spend }))}
                colorForKey={(key) => PROJECT_COLOR[key as ProjectKey] ?? VX.neutral}
                seriesLabel={(key) => PROJECTS_MTD.find((p) => p.key === key)?.label ?? key}
                formatValue={fmtEur}
                centerLabel={fmtEur(MTD_EUR)}
                centerSubLabel="Month to date"
              />
            </Box>
          </ChartCard>
        </Box>
      </SimpleGrid>

      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <Box data-shot="top-drivers" h="100%">
          <Section title={`Top drivers, ${WINDOW} vs ${PRIOR_WINDOW}`}>
            {/* W34: bar-list — a ranked list with an inline bar per row; the table is the nearest. */}
            <BasaltDataTable
              data={[...PROJECTS_MTD]}
              columns={driverColumns}
              enableSorting={false}
              {...(driversQuery !== undefined && { query: driversQuery })}
              emptyState={
                <span>
                  {COPY.drivers.empty.title}. {COPY.drivers.empty.description}
                </span>
              }
            />
          </Section>
        </Box>
        <Box data-shot="spend-distribution" h="100%">
          <ChartCard
            title="Days by total spend, last 90 days"
            info="How many of the last 90 days landed in each €10 band of total daily spend."
            {...(distributionState !== undefined && { state: distributionState })}
          >
            <Box data-shot-hover data-shot-tooltip>
              <Bars
                data={[...DISTRIBUTION]}
                ariaLabel="Days by total daily spend, €10 bands, last 90 days"
                x={(d) => d.label}
                bars={DISTRIBUTION_BARS}
              />
            </Box>
          </ChartCard>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}
