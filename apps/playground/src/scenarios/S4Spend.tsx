/**
 * S4 — Spend and usage (stands for argo usage-tracking). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Am I within budget, and what is driving it?
 *   Decision: Cut a project or raise the budget.
 *
 * Forecast and budget are `Meter`s, spend by project and top drivers are `BarList`s (Wave 34).
 * Actions ("Raise budget") are inert in fixtures.
 *
 * Anchors for `basalt-ui shot`: every scored component carries `data-shot`; `StatCard`, `ChartCard`
 * and `Section` do not forward `data-*`, so the anchor is the wrapping `Box`.
 */
import { Box, SimpleGrid, Stack } from '@mantine/core'
import { BarList, Meter, PageBar, Section, StatCard, StatGroup } from 'basalt-ui'
import { Bars, ChartCard, Sparkline } from 'basalt-ui/charts'
import type { BarsBar, ChartState } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  BUDGET_EUR,
  DAILY,
  DAYS_ELAPSED,
  DISTRIBUTION,
  DRIVERS,
  FORECAST_EUR,
  MODEL_KEYS,
  MODEL_LABEL,
  MONTH_DAYS,
  MONTH_LABEL,
  MONTH_NAME,
  MTD_CHANGE_PCT,
  MTD_EUR,
  MTD_TOTALS,
  PRIOR_WINDOW_LABEL,
  PROJECTS_MTD,
  WINDOW_LABEL,
  YEAR,
  fmtEur,
  fmtShare,
  spendBand,
  fmtSignedEur,
  fmtSignedShare,
} from './spend-data'
import type { DayRow, DistributionBin, ModelKey } from './spend-data'
import { RETRY_ACTION } from './retry-action'
import { chartStateFor, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const MODEL_COLOR: Record<ModelKey, string> = {
  large: demoColors.sessions,
  mid: demoColors.signups,
  small: demoColors.revenue,
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
/** Spend by project: label, month-to-date EUR, share as the muted secondary. */
const PROJECT_ITEMS = PROJECTS_MTD.map((p) => ({
  key: p.key,
  label: p.label,
  value: p.spend,
  secondary: fmtShare(p.share),
}))
/** Top drivers: the € added against the prior window, the relative change as the secondary. */
const DRIVER_ITEMS = DRIVERS.map((p) => ({
  key: p.key,
  label: p.label,
  value: p.delta,
  secondary: fmtSignedShare(p.change),
}))
/** The forecast track runs past both the budget and the forecast so an overage stays on the track. */
const TRACK_END_EUR = Math.ceil((Math.max(BUDGET_EUR, FORECAST_EUR) * 1.1) / 100) * 100
const PACE_LINES = [
  { value: PACE_EUR_PER_DAY, color: VX.faint, dashed: true, legend: { label: 'Budget pace' } },
]

const USAGE_ERROR = 'The usage export did not answer. Retry, or reconnect it in Settings.'
const USAGE_EMPTY = 'No spend recorded in the window. Check that the usage export is connected.'

const retry = (what: string): string => retryCopy(what, 'usage export')

/** A Meter or BarList draws its own loading and empty states; the card only takes the error. */
const errorOnly = (state: ScenarioProps['shotState'], copy: string): ChartState | undefined =>
  state === 'error' ? { error: new Error(copy) } : undefined

function SpendStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  const query = queryFor(shotState, USAGE_ERROR)
  // The empty branch says why and what to do in one muted line; error needs none (the `QueryState`
  // alert already says it). Computed once for all three cards.
  const shared = {
    emptyText: USAGE_EMPTY,
    ...(query !== undefined && { query }),
  }
  const left = BUDGET_EUR - MTD_EUR
  const overBudget = isAtRest && FORECAST_EUR > BUDGET_EUR

  return (
    <StatGroup cols={3}>
      <Box data-shot="month-to-date" h="100%">
        <StatCard
          title="Spend"
          qualifier="month to date"
          value={fmtEur(MTD_EUR)}
          info={`All projects and models, ${WINDOW_LABEL} ${YEAR}, in EUR.`}
          {...(isAtRest && {
            delta: MTD_CHANGE_PCT,
            deltaPeriod: `vs ${PRIOR_WINDOW_LABEL}`,
            deltaPolarity: 'up-bad' as const,
          })}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
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
          title="Forecast"
          // The verdict in words beside the rail: the rail alone carries it in colour only.
          qualifier={
            overBudget
              ? `end of ${MONTH_NAME} · over budget by ${fmtEur(FORECAST_EUR - BUDGET_EUR)}`
              : `end of ${MONTH_NAME}`
          }
          value={fmtEur(FORECAST_EUR)}
          info={`Average per day so far (${fmtEur(MTD_EUR / DAYS_ELAPSED)}) held flat for all ${MONTH_DAYS} days. Ignores weekends and bursts.`}
          {...shared}
          sparkline={() => (
            <Meter
              label={`Forecast against the ${fmtEur(BUDGET_EUR)} budget`}
              max={TRACK_END_EUR}
              target={BUDGET_EUR}
              format={fmtEur}
              segments={[
                { value: MTD_EUR, label: 'Spent' },
                { value: FORECAST_EUR - MTD_EUR, label: 'Forecast', forecast: true },
              ]}
              forecastCaption={`Forecast ${fmtEur(FORECAST_EUR)}`}
              startCaption={`Spent ${fmtEur(MTD_EUR)}`}
            />
          )}
        />
      </Box>
      <Box data-shot="budget" h="100%">
        <StatCard
          title="Budget"
          qualifier={MONTH_LABEL}
          value={fmtEur(BUDGET_EUR)}
          info={`Monthly cap in EUR. ${fmtEur(PACE_EUR_PER_DAY)} a day keeps spend on pace.`}
          {...shared}
          sparkline={() => (
            <Meter
              label={`Spent against the ${fmtEur(BUDGET_EUR)} budget`}
              max={BUDGET_EUR}
              value={MTD_EUR}
              format={fmtEur}
              // A verdict colour only once the cap is passed.
              {...(left < 0 && { color: VX.status.bad })}
              startCaption={`Spent ${fmtEur(MTD_EUR)}`}
              endCaption={left < 0 ? `${fmtEur(-left)} over` : `${fmtEur(left)} left`}
            />
          )}
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
            error: retry('Daily spend'),
          })}
          {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
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
        {/* A BarList, not a segmented Meter (SPEC § 3): six parts is the top of the "2–6 parts" row,
            and six near-identical hues with captions under 5 % segments do not survive 390 px; the
            question is also "which project", a ranking, which length on a shared scale answers. */}
        <ChartCard
          title={`Spend by project, ${WINDOW_LABEL} (€)`}
          info="Each project's share of month-to-date spend across all models."
          state={errorOnly(shotState, retry('Spend by project'))}
          {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
        >
          <Box data-shot-hover>
            <BarList
              label={`Spend by project, ${WINDOW_LABEL}, EUR`}
              items={shotState === 'empty' ? [] : PROJECT_ITEMS}
              format={fmtEur}
              accentLeader
              loading={shotState === 'loading'}
              loadingRows={PROJECT_ITEMS.length}
              emptyText={`No project spent anything ${WINDOW_LABEL}. Connect one to the usage export.`}
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function SpendDrivers({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retry('Top drivers'))
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="top-drivers" h="100%">
        <Section
          title={`Top drivers, ${WINDOW_LABEL} vs ${PRIOR_WINDOW_LABEL}`}
          {...(query !== undefined && shotState === 'error' && { query })}
        >
          <Box data-shot-hover>
            <BarList
              label={`Spend added against ${PRIOR_WINDOW_LABEL} by project, EUR`}
              items={shotState === 'empty' ? [] : DRIVER_ITEMS}
              format={fmtSignedEur}
              loading={shotState === 'loading'}
              loadingRows={DRIVER_ITEMS.length}
              emptyText={`No project spent more than ${PRIOR_WINDOW_LABEL}. Spend is flat or falling.`}
            />
          </Box>
        </Section>
      </Box>
      <Box data-shot="spend-distribution" h="100%">
        <ChartCard
          title="Days by total spend, last 90 days"
          info="How many of the last 90 days landed in each €10 band of total daily spend."
          state={chartStateFor(shotState, {
            empty: 'No days to bin yet. The histogram needs at least one day of spend.',
            error: retry('The distribution'),
          })}
          {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Bars
              data={DISTRIBUTION_DATA}
              ariaLabel="Days by total daily spend, €10 bands, last 90 days"
              x={(d) => d.label}
              bars={DISTRIBUTION_BARS}
              tooltip={{ formatHeader: (_, d) => spendBand(d) }}
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
