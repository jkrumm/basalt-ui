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
import { Box, SimpleGrid, Stack } from '@mantine/core'
import type { CSSProperties } from 'react'
import { BarList, DeltaBadge, Meter, PageBar, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Bars, ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import type { ChartSeries, ChartTooltipRow } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  BUDGET_EUR,
  CUMULATIVE,
  DAYS_ELAPSED,
  DISTRIBUTION,
  DISTRIBUTION_BARS,
  DISTRIBUTION_Y_MAX,
  DRIVERS,
  FORECAST_EUR,
  MEDIAN_DAY_EUR,
  MONTH_DAYS,
  MONTH_LABEL,
  MONTH_NAME,
  MTD_CHANGE_PCT,
  MTD_EUR,
  MTD_POINTS,
  PRIOR_WINDOW_LABEL,
  PROJECTS_MTD,
  REMAINING_PER_DAY_EUR,
  WINDOW_LABEL,
  YEAR,
  daysTick,
  spendBand,
} from './spend-data'
import type { CumulativeRow } from './spend-data'
import { fmtEur, fmtEurCompact, fmtShare, fmtSignedEur } from './fixture-utils'
import { cardStateProps, chartStateFor, noop, retryCopy } from './shot-state'
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
  },
]

/** The band holding the median day: the last band that starts at or below it. */
const MEDIAN_BIN = DISTRIBUTION.findLast((b) => b.from <= MEDIAN_DAY_EUR)
const MEDIAN_FACT =
  MEDIAN_BIN === undefined
    ? 'median'
    : `median · ${MEDIAN_BIN.days} days in ${spendBand(MEDIAN_BIN)}`

/** The window the histogram bins, stated on the surface (the info tooltip says it too). */
const DISTRIBUTION_WINDOW = 'last 90 days'
const CUMULATIVE_DATA = [...CUMULATIVE]
const DISTRIBUTION_DATA = [...DISTRIBUTION]
/** Every other band is named on the axis: a range label is wide, and the bars still carry the rest. */
const DISTRIBUTION_TICKS = DISTRIBUTION.filter((_, i) => i % 2 === 0).map((b) => b.label)
/** How concentrated the spend is: what the two largest projects carry together. */
const TOP_PROJECTS = 2
const TOP_PCT = PROJECTS_MTD.slice(0, TOP_PROJECTS).reduce((a, p) => a + p.pct, 0)
/** Spend by project: label, month-to-date EUR, share as the muted secondary. */
const PROJECT_ITEMS = PROJECTS_MTD.map((p) => ({
  key: p.key,
  label: p.label,
  value: p.spend,
  secondary: `${p.pct}%`,
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

const USAGE_EMPTY = `No spend recorded ${WINDOW_LABEL}. Check that the usage export is connected.`

/** One card height for a row pair: the grid cell sets it, the card fills it. */
const FILL: CSSProperties = { height: '100%' }

const retry = (what: string): string => retryCopy(what, 'usage export')

function SpendStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  const left = BUDGET_EUR - MTD_EUR
  const overBudget = isAtRest && FORECAST_EUR > BUDGET_EUR

  const loading = shotState === 'loading'
  // Loading shows the hero skeleton alone: a visual over placeholder data would contradict it.
  const hidden = shotState !== undefined
  // Empty and error say why in the cell itself, with the Retry on a failure.
  const cellState = (what: string, reason: string): Pick<StatStripCell, 'state'> =>
    shotState === 'error'
      ? { state: { kind: 'error', error: new Error(retry(what)), onRetry: noop } }
      : shotState === 'empty'
        ? { state: { kind: 'empty', reason } }
        : {}

  // One reading split three ways — spent, where it lands, the cap — so one strip, not three cards.
  const cells: StatStripCell[] = [
    {
      key: 'month-to-date',
      caption: 'Spend',
      qualifier: 'month to date',
      info: `All projects and models, ${WINDOW_LABEL} ${YEAR}, in EUR. The dashed line is the daily mean.`,
      value: fmtEur(MTD_EUR),
      loading,
      ...cellState('Spend', USAGE_EMPTY),
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
          <Box data-shot-hover>
            <Sparkline
              ariaLabel={`Daily spend, ${WINDOW_LABEL}, EUR`}
              data={MTD_POINTS}
              height={28}
              reference="mean"
              format={fmtEur}
            />
          </Box>
        ),
      }),
    },
    {
      key: 'forecast',
      caption: 'Forecast',
      // `tone` inks the amount and the footer says the verdict in words, once; the qualifier names the date.
      qualifier: `end of ${MONTH_NAME}`,
      info: `Average per day so far (${fmtEur(MTD_EUR / DAYS_ELAPSED)}) held flat for all ${MONTH_DAYS} days. Ignores weekends and bursts.`,
      value: fmtEur(FORECAST_EUR),
      ...cellState(
        'The forecast',
        `No forecast without spend ${WINDOW_LABEL}. It appears after the first day of spend.`,
      ),
      ...(overBudget && { tone: 'bad' as const }),
      loading,
      ...(overBudget && {
        footer: `${fmtEur(FORECAST_EUR - BUDGET_EUR)} over budget`,
      }),
      ...(!hidden && {
        visual: (
          <Meter
            label={`Forecast against the ${fmtEur(BUDGET_EUR)} budget`}
            max={TRACK_END_EUR}
            ticks={[{ at: BUDGET_EUR, label: 'Budget' }]}
            format={fmtEur}
            segments={[
              { value: MTD_EUR, label: 'Spent' },
              { value: FORECAST_EUR - MTD_EUR, label: 'Forecast', forecast: true },
            ]}
            forecastCaption="Forecast"
            startCaption="Spent"
          />
        ),
      }),
    },
    {
      key: 'budget',
      caption: 'Budget',
      qualifier: MONTH_LABEL,
      info: `Monthly cap in EUR. ${fmtEur(REMAINING_PER_DAY_EUR)} a day over the remaining ${MONTH_DAYS - DAYS_ELAPSED} days lands on the cap.`,
      value: fmtEur(BUDGET_EUR),
      loading,
      // The cap is a figure with or without spend, so an empty cell keeps it as the hero and says why
      // there is no meter in its footer; only a failure replaces the reading.
      ...(shotState === 'error' && cellState('The budget', '')),
      ...(shotState === 'empty' && { footer: `No spend ${WINDOW_LABEL} to set against it.` }),
      ...(!hidden && {
        visual: (
          <Meter
            label={`Spent against the ${fmtEur(BUDGET_EUR)} budget`}
            max={BUDGET_EUR}
            value={MTD_EUR}
            format={fmtEur}
            // A verdict colour only once the cap is passed.
            {...(left < 0 && { color: VX.status.bad })}
            startCaption={`${fmtShare(MTD_EUR / BUDGET_EUR)} used`}
            endCaption={left < 0 ? `${fmtEur(-left)} over` : `${fmtEur(left)} left`}
          />
        ),
      }),
    },
  ]

  return <StatGroup variant="strip" label="Spend against budget" cols={3} cells={cells} />
}

/**
 * Column rule: cards of one kind share a row, so natural heights match and nothing is stretched.
 * Measured at 1440: the two charts 386 each, the two 6-row BarLists 252 each. At 390 the order is
 * cumulative, distribution, by project, drivers.
 */
function SpendCharts({ shotState }: ScenarioProps) {
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="spend-over-time" h="100%">
        <ChartCard
          title="Cumulative spend"
          facts={{
            value: fmtEur(MTD_EUR / DAYS_ELAPSED),
            unit: 'a day',
            period: `average, ${WINDOW_LABEL}`,
          }}
          info={`Month-to-date spend per day against the ${fmtEur(BUDGET_EUR)} budget. The dashed line holds the ${fmtEur(MTD_EUR / DAYS_ELAPSED)} daily average flat to the last day.`}
          state={chartStateFor(shotState, {
            empty: `No spend recorded ${WINDOW_LABEL}. Connect a project to the usage export.`,
            error: retry('Cumulative spend'),
          })}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Lines<CumulativeRow, Date>
              data={CUMULATIVE_DATA}
              ariaLabel={`Cumulative spend, ${MONTH_LABEL}, EUR, against the ${fmtEur(BUDGET_EUR)} budget`}
              x={(d) => d.date}
              y={{ format: fmtEurCompact, domain: [0, TRACK_END_EUR] }}
              series={CUMULATIVE_SERIES}
              refLines={BUDGET_LINES}
              tooltip={{ rows: forecastRow }}
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="spend-distribution" h="100%">
        <ChartCard
          style={FILL}
          title="Daily spend, distribution"
          facts={{
            value: fmtEur(MEDIAN_DAY_EUR),
            unit: 'a day',
            period: [DISTRIBUTION_WINDOW, MEDIAN_FACT],
          }}
          info="Each bar counts the days, of the last 90, whose total spend across all projects landed in that €10 band (€ a day). The headline is the median day and the band it falls in."
          state={chartStateFor(shotState, {
            empty:
              'No days to bin in the last 90 days. The histogram needs at least one day of spend.',
            error: retry('The distribution'),
          })}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Bars
              data={DISTRIBUTION_DATA}
              ariaLabel="Days by total daily spend, €10 bands, last 90 days"
              x={(d) => d.label}
              xTicks={DISTRIBUTION_TICKS}
              y={{ domain: [0, DISTRIBUTION_Y_MAX], format: daysTick }}
              bars={DISTRIBUTION_BARS}
              tooltip={{ formatHeader: (_, d) => spendBand(d) }}
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function SpendBreakdown({ shotState }: ScenarioProps) {
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="spend-by-project" h="100%">
        {/* A BarList, not a segmented Meter (SPEC § 3): six parts is the top of the "2–6 parts" row,
            and six near-identical hues with captions under 5 % segments do not survive 390 px; the
            question is also "which project", a ranking, which length on a shared scale answers. */}
        <ChartCard
          title="Spend by project"
          {...(shotState === undefined && {
            facts: {
              value: `${TOP_PCT}%`,
              unit: `of spend in ${TOP_PROJECTS} of ${PROJECTS_MTD.length} projects`,
              period: `· ${WINDOW_LABEL}`,
            },
          })}
          info={`Each project's share of the ${fmtEur(MTD_EUR)} month-to-date spend across all models, in whole percent that sum to 100.`}
          {...cardStateProps(shotState, retry('Spend by project'), PROJECT_PLACEHOLDER)}
        >
          <Box data-shot-hover>
            <BarList
              label={`Spend by project, ${WINDOW_LABEL}, EUR`}
              items={shotState === 'empty' ? [] : PROJECT_ITEMS}
              format={fmtEur}
              loading={shotState === 'loading'}
              emptyText={`No project spent anything ${WINDOW_LABEL}. Connect one to the usage export.`}
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="top-drivers" h="100%">
        <ChartCard
          title="Spend change by project"
          {...(shotState === undefined && {
            facts: {
              value: fmtEur(DRIVERS.reduce((a, p) => a + p.delta, 0)),
              period: `added by ${DRIVERS.length} projects, ${WINDOW_LABEL} vs ${PRIOR_WINDOW_LABEL}`,
            },
          })}
          info={`The € each project added against ${PRIOR_WINDOW_LABEL}, with the relative change.`}
          {...cardStateProps(shotState, retry('Spend change by project'), PROJECT_PLACEHOLDER)}
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
      <SpendBreakdown shotState={shotState} />
    </Stack>
  )
}
