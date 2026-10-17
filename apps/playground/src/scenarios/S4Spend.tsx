/**
 * S4 — Spend and usage (stands for argo usage-tracking). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Am I within budget, and what is driving it?
 *   Decision: Cut a project or raise the budget.
 *
 * Forecast and budget are `Meter`s, spend by project and top drivers are `BarList`s (Wave 34).
 * Actions ("Raise budget") are inert in fixtures.
 *
 * Anchors for `basalt-ui shot`: every scored component carries `data-shot`; `ChartCard` and
 * `Section` do not forward `data-*`, so the anchor is the wrapping `Box`. The three stat cards are
 * one strip whose cells derive their own anchors: `month-to-date` → `strip-month-to-date`,
 * `forecast` → `strip-forecast`, `budget` → `strip-budget`.
 */
import { Box, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarList, DeltaBadge, Meter, PageBar, Section, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Bars, ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import type { BarsBar, ChartSeries, ChartTooltipRow } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  BUDGET_EUR,
  CUMULATIVE,
  DAYS_ELAPSED,
  DISTRIBUTION,
  DRIVERS,
  FORECAST_EUR,
  MEDIAN_DAY_EUR,
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
  spendBand,
} from './spend-data'
import type { CumulativeRow, DistributionBin } from './spend-data'
import { RETRY_ACTION } from './retry-action'
import { fmtEur, fmtShare, fmtSignedEur } from './fixture-utils'
import { cardStateProps, chartStateFor, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const CUMULATIVE_SERIES: ChartSeries<CumulativeRow>[] = [
  {
    key: 'spent',
    label: 'Spent',
    color: demoColors.sessions,
    getValue: (d) => d.spent,
    formatValue: fmtEur,
    area: true,
  },
  {
    key: 'forecast',
    label: 'Forecast',
    color: demoColors.sessions,
    dash: 'dashed',
    getValue: (d) => d.forecast,
    formatValue: fmtEur,
    // On today the forecast joins the actual line and would repeat its tooltip row; the row below
    // lists the forecast for the days after today only.
    tooltip: false,
  },
]
const forecastRow = (d: CumulativeRow): ChartTooltipRow[] =>
  d.spent === null && d.forecast !== null
    ? [
        {
          label: 'Forecast',
          value: fmtEur(d.forecast),
          color: demoColors.sessions,
          swatch: 'dashed',
        },
      ]
    : []
const BUDGET_LINES = [
  {
    value: BUDGET_EUR,
    // A verdict colour only when the forecast lands past the cap, like the Budget Meter.
    color: FORECAST_EUR > BUDGET_EUR ? VX.status.bad : VX.faint,
    dashed: true,
    label: `Budget ${fmtEur(BUDGET_EUR)}`,
    legend: { label: `Budget ${fmtEur(BUDGET_EUR)}` },
  },
]

const DISTRIBUTION_BARS: BarsBar<DistributionBin>[] = [
  { key: 'days', label: 'Days', color: VX.neutral, getValue: (d) => d.days },
]

const PACE_EUR_PER_DAY = BUDGET_EUR / MONTH_DAYS
const CUMULATIVE_DATA = [...CUMULATIVE]
const DISTRIBUTION_DATA = [...DISTRIBUTION]
/** Every other band is named on the axis: a range label is wide, and the bars still carry the rest. */
const DISTRIBUTION_TICKS = DISTRIBUTION.filter((_, i) => i % 2 === 0).map((b) => b.label)
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
  secondary: (
    <DeltaBadge
      value={p.change * 100}
      polarity="up-bad"
      format={(v) => `${Math.round(Math.abs(v))}%`}
    />
  ),
}))
/** The forecast track runs past both the budget and the forecast so an overage stays on the track. */
const TRACK_HEADROOM = 1.1
const TRACK_STEP_EUR = 100
const TRACK_END_EUR =
  Math.ceil((Math.max(BUDGET_EUR, FORECAST_EUR) * TRACK_HEADROOM) / TRACK_STEP_EUR) * TRACK_STEP_EUR

/** Body height of the error placeholder for the BarList cards, so a failed card stays near its resting size. */
const PROJECT_PLACEHOLDER = 190

const USAGE_ERROR = 'The usage export did not answer. Retry, or reconnect it in Settings.'
const USAGE_EMPTY = 'No spend recorded in the window. Check that the usage export is connected.'

const retry = (what: string): string => retryCopy(what, 'usage export')

function SpendStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  const left = BUDGET_EUR - MTD_EUR
  const overBudget = isAtRest && FORECAST_EUR > BUDGET_EUR

  const none = shotState === 'empty' || shotState === 'error'
  const loading = shotState === 'loading'
  const note = shotState === 'error' ? USAGE_ERROR : shotState === 'empty' ? USAGE_EMPTY : undefined
  // Loading shows the hero skeleton alone: a visual over placeholder data would contradict it.
  const hidden = none || loading

  // One reading split three ways — spent, where it lands, the cap — so one strip, not three cards.
  const cells: StatStripCell[] = [
    {
      key: 'month-to-date',
      caption: 'Spend',
      qualifier: 'month to date',
      info: `All projects and models, ${WINDOW_LABEL} ${YEAR}, in EUR. The dashed line is the daily mean.`,
      value: none ? null : fmtEur(MTD_EUR),
      loading,
      ...(isAtRest && {
        delta: (
          <DeltaBadge
            value={MTD_CHANGE_PCT}
            polarity="up-bad"
            period={`vs ${PRIOR_WINDOW_LABEL}`}
          />
        ),
        footer: `Daily, ${WINDOW_LABEL}`,
      }),
      ...(!hidden && {
        visual: (
          <Sparkline
            ariaLabel={`Daily spend, ${WINDOW_LABEL}, EUR`}
            data={MTD_TOTALS}
            height={28}
            reference="mean"
            format={fmtEur}
          />
        ),
      }),
    },
    {
      key: 'forecast',
      caption: 'Forecast',
      // `tone` states the verdict as a word beside the amount; the qualifier names the date.
      qualifier: overBudget ? `end of ${MONTH_NAME} · over budget` : `end of ${MONTH_NAME}`,
      info: `Average per day so far (${fmtEur(MTD_EUR / DAYS_ELAPSED)}) held flat for all ${MONTH_DAYS} days. Ignores weekends and bursts.`,
      value: none ? null : fmtEur(FORECAST_EUR),
      ...(overBudget && { tone: 'bad' as const }),
      loading,
      ...(overBudget && {
        footer: `${fmtEur(FORECAST_EUR - BUDGET_EUR)} over the ${fmtEur(BUDGET_EUR)} budget`,
      }),
      ...(!hidden && {
        visual: (
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
        ),
      }),
    },
    {
      key: 'budget',
      caption: 'Budget',
      qualifier: MONTH_LABEL,
      info: `Monthly cap in EUR. ${fmtEur(PACE_EUR_PER_DAY)} a day keeps spend on pace.`,
      value: none ? null : fmtEur(BUDGET_EUR),
      loading,
      ...(!hidden && {
        visual: (
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
        ),
      }),
    },
  ]

  // The empty / error note is one line in the footer row, not repeated in every cell.
  return (
    <StatGroup
      variant="strip"
      label="Spend against budget"
      cols={3}
      cells={cells}
      {...(note !== undefined && {
        footer: [
          {
            key: 'note',
            content: (
              <Text size="sm" c="dimmed">
                {note}
              </Text>
            ),
          },
        ],
      })}
    />
  )
}

function SpendCharts({ shotState }: ScenarioProps) {
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="spend-over-time" h="100%">
        <ChartCard
          title="Cumulative spend (€)"
          facts={{
            value: fmtEur(MTD_EUR),
            period: `spent ${WINDOW_LABEL}, of ${fmtEur(BUDGET_EUR)} budget`,
          }}
          info={`Month-to-date spend per day against the ${fmtEur(BUDGET_EUR)} budget. The dashed line holds the ${fmtEur(MTD_EUR / DAYS_ELAPSED)} daily average flat to the last day.`}
          state={chartStateFor(shotState, {
            empty: 'No spend this month. Connect a project to the usage export.',
            error: retry('Cumulative spend'),
          })}
          {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Lines<CumulativeRow, Date>
              data={CUMULATIVE_DATA}
              ariaLabel={`Cumulative spend, ${MONTH_LABEL}, EUR, against the ${fmtEur(BUDGET_EUR)} budget`}
              x={(d) => d.date}
              y={{ format: fmtEur, domain: [0, TRACK_END_EUR] }}
              series={CUMULATIVE_SERIES}
              refLines={BUDGET_LINES}
              tooltip={{ rows: forecastRow }}
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="spend-by-project" h="100%">
        {/* A BarList, not a segmented Meter (SPEC § 3): six parts is the top of the "2–6 parts" row,
            and six near-identical hues with captions under 5 % segments do not survive 390 px; the
            question is also "which project", a ranking, which length on a shared scale answers. */}
        <ChartCard
          title="Spend by project (€)"
          {...(shotState === undefined && {
            facts: { value: fmtEur(MTD_EUR), period: `all projects, ${WINDOW_LABEL}` },
          })}
          info="Each project's share of month-to-date spend across all models."
          {...cardStateProps(shotState, retry('Spend by project'), PROJECT_PLACEHOLDER)}
        >
          <Box data-shot-hover>
            <BarList
              label={`Spend by project, ${WINDOW_LABEL}, EUR`}
              items={shotState === 'empty' ? [] : PROJECT_ITEMS}
              format={fmtEur}
              accentLeader
              loading={shotState === 'loading'}
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
    <SimpleGrid
      type="container"
      cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}
      style={{ alignItems: 'start' }}
    >
      <Box data-shot="top-drivers">
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
              emptyText={
                shotState === 'empty'
                  ? USAGE_EMPTY
                  : `No project spent more than ${PRIOR_WINDOW_LABEL}. Spend is flat or falling.`
              }
            />
          </Box>
        </Section>
      </Box>
      <Box data-shot="spend-distribution">
        <ChartCard
          title="Days by total spend per day"
          facts={{ value: fmtEur(MEDIAN_DAY_EUR), unit: 'a day', period: 'median, last 90 days' }}
          info="Each bar counts the days whose total spend across all projects landed in that €10 band (€ a day)."
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
              xTicks={DISTRIBUTION_TICKS}
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
