import { useFormat } from 'basalt-ui'
import type { Empty, Phase, Verdict } from 'basalt-ui/cards'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { useMemo } from 'react'
import { CUT_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { buildCut, knownFixture } from './cut-fixture'
import type { Day, Reading } from './cut-fixture'

const noop = (): void => {}

/** `+0.4` / `-0.4` / `0.0`: the sign is part of the figure. */
const signed = (n: number, digits = 1): string => {
  const text = Math.abs(n).toFixed(digits)
  if (Number(text) === 0) return text
  return `${n < 0 ? '-' : '+'}${text}`
}

const plain = (n: number): string => n.toFixed(1)

/** A verdict on what share of the loss was lean mass. */
function leanStatus(share: number | null): Verdict | undefined {
  if (share === null) return undefined
  if (share <= 0.25) return { tone: 'good', label: 'Mostly fat' }
  if (share <= 0.4) return { tone: 'warn', label: 'Lean slipping' }
  return { tone: 'bad', label: 'Losing lean' }
}

function paceStatus(gap: number): Verdict {
  if (gap > 0.1) return { tone: 'warn', label: 'Behind plan' }
  if (gap < -0.1) return { tone: 'neutral', label: 'Faster than plan' }
  return { tone: 'good', label: 'On plan' }
}

export function ExprN16Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const cut = useMemo(() => buildCut(knownFixture(fixture)), [fixture])

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The weigh-in log did not load.', retry: noop }
        : 'ready'
  const empty: Empty | null =
    shotState === 'empty'
      ? { cause: 'No weigh-ins yet. Log a morning weight and the cut starts here.' }
      : null
  const noReadings: Empty | null =
    shotState === 'empty' || cut.readings.length === 0
      ? { cause: 'No skinfold reading yet. Log one to split fat from lean.' }
      : null
  const fatPhase: Phase =
    shotState === 'error'
      ? { tag: 'error', message: 'The skinfold log did not load.', retry: noop }
      : phase

  const dayFocus = useChartFocus<Day>(cut.days, {
    announce: (d) =>
      `${f.date(d.at, 'long')}: ${d.weight === null ? 'no weigh-in' : `${plain(d.weight)} kg`}, 7-day mean ${d.mean === null ? 'not available' : `${plain(d.mean)} kg`}, plan ${plain(d.plan)} kg`,
  })
  const readingFocus = useChartFocus<Reading>(cut.readings, {
    announce: (r) =>
      `${f.date(r.at, 'long')}: fat ${signed(r.fatDelta)} kg, lean ${signed(r.leanDelta)} kg, body fat ${plain(r.bf)} percent`,
  })

  const first = cut.days[0]
  const lastMean = [...cut.days].reverse().find((d) => d.mean !== null)?.mean ?? first?.weight ?? 0
  const startWeight = first?.weight ?? lastMean
  const lastDay = cut.days[cut.days.length - 1]
  const lastReading = cut.readings[cut.readings.length - 1]
  const previousReading = cut.readings[cut.readings.length - 2]

  const planNow = cut.days[cut.days.length - 1]?.plan ?? lastMean
  const planGap = lastMean - planNow
  const planGapText = Math.abs(planGap) < 0.05 ? 'on plan' : `${signed(planGap)} vs plan`
  const lost = startWeight - lastMean
  const remaining = lastMean - cut.goal
  const gap = cut.rate + cut.planRate
  const reached = remaining <= 0
  const weeksLeft = cut.rate < 0 ? remaining / -cut.rate : null
  const planWeeksLeft = remaining / cut.planRate
  const dateIn = (weeks: number): string =>
    f.date(new Date((lastDay?.at.getTime() ?? 0) + weeks * 7 * 86_400_000), 'short')

  const split = lastReading === undefined ? null : lastReading.fatDelta + lastReading.leanDelta
  const leanShare =
    lastReading === undefined || split === null || split > -0.3
      ? null
      : lastReading.leanDelta / split
  const leanStatusValue = leanStatus(leanShare)
  const leanVerdict = leanStatusValue === undefined ? {} : { status: leanStatusValue }

  const live = shotState === undefined
  // loading keeps the declared rows, sub lines and figure so the skeleton holds the loaded height
  const shown = live || shotState === 'loading'
  const rateFacts = shown
    ? {
        delta: {
          value: signed(gap, 2),
          polarity: 'neutral' as const,
          label: `vs plan ${signed(-cut.planRate, 2)}`,
        },
        status: paceStatus(gap),
      }
    : {}
  const leanFacts = !shown
    ? {}
    : {
        ...leanVerdict,
        sub:
          lastReading === undefined
            ? 'No skinfold reading yet'
            : leanShare === null
              ? 'Too little loss to split'
              : `${f.percent(Math.max(0, leanShare), { maximumFractionDigits: 0 })} of ${plain(-(split ?? 0))} kg lost`,
      }
  const goalFacts = shown
    ? {
        rows: [
          {
            label: 'At this pace',
            value: reached ? 'Reached' : weeksLeft === null ? 'No end date' : dateIn(weeksLeft),
          },
          { label: 'On plan', value: reached ? 'Reached' : dateIn(planWeeksLeft) },
        ] as const,
      }
    : {}
  const weightFacts = shown
    ? {
        figure: {
          value: dayFocus.readout(plain(lastMean), (d) => {
            const v = d.weight ?? d.mean
            return v === null ? '-' : plain(v)
          }),
          unit: 'kg',
          delta: {
            value: `${signed(-lost)} kg`,
            polarity: 'up-bad' as const,
            label: 'since start',
          },
          period: dayFocus.readout(planGapText, (d) => f.date(d.at, 'short')),
        },
        footer: [
          { label: 'Weigh-ins', value: live ? `${cut.weighIns} of ${cut.days.length} days` : '-' },
          { label: 'Longest gap', value: live ? `${cut.longestGap} days` : '-' },
        ] as const,
      }
    : {}
  const fatFacts =
    shown && lastReading !== undefined
      ? {
          figure: {
            value: readingFocus.readout(signed(lastReading.fatDelta), (r) => signed(r.fatDelta)),
            unit: 'kg fat',
            ...(previousReading === undefined
              ? {}
              : {
                  delta: {
                    value: signed(lastReading.fatDelta - previousReading.fatDelta),
                    polarity: 'up-bad' as const,
                    label: 'vs prior',
                  },
                }),
            period: readingFocus.readout('latest', (r) => f.date(r.at, 'short')),
          },
          footer: [
            { label: 'Readings', value: live ? `${cut.readings.length}` : '-' },
            {
              label: 'Body fat',
              value: live
                ? readingFocus.readout(`${plain(lastReading.bf)}%`, (r) => `${plain(r.bf)}%`)
                : '-',
            },
          ] as const,
        }
      : {}

  const deltas = cut.readings.flatMap((r) => [r.fatDelta, r.leanDelta, 0])
  const deltaDigits = Math.max(...deltas) - Math.min(...deltas) < 3 ? 1 : 0

  const xAxis = {
    ticks: 5,
    format: (v: number | Date | string): string =>
      v instanceof Date ? f.date(v, 'short') : String(v),
  }

  return (
    <Page area="cut">
      <PageBar title="Cut progress: weight against plan" />
      <StatGroup variant="strip" label="Cut progress">
        <StatCell
          title="Weekly rate"
          subtitle="last 4 weeks"
          value={live ? signed(cut.rate, 2) : null}
          unit="kg/wk"
          {...rateFacts}
          phase={phase}
        />
        <StatCell
          title="Lean mass"
          subtitle="since first reading"
          value={live && lastReading !== undefined ? signed(lastReading.leanDelta) : null}
          unit="kg"
          {...leanFacts}
          phase={phase}
        />
        <StatCell
          title="To goal"
          subtitle={`${plain(cut.goal)} kg`}
          value={live ? plain(Math.max(0, remaining)) : null}
          unit="kg"
          {...goalFacts}
          phase={phase}
        />
      </StatGroup>
      <CardGrid min="regular">
        <ChartCard
          title="Weight"
          subtitle={`${f.date(first?.at ?? 0, 'short')} to ${f.date(lastDay?.at ?? 0, 'short')}`}
          phase={phase}
          empty={empty}
          {...weightFacts}
          chart={() => (
            <CartesianChart
              label={`Body weight over ${cut.days.length} days: daily weigh-ins, their 7-day mean and the planned path to ${plain(cut.goal)} kg`}
              data={cut.days}
              x={{ value: (d) => d.at, ...xAxis }}
              y={{
                domain: { floor: cut.goal - 1, pad: 0.04 },
                title: 'kg',
                format: (v) => v.toFixed(0),
              }}
              height="fill"
              focus={dayFocus}
              refLines={[
                {
                  value: cut.goal,
                  color: CUT_SERIES.plan,
                  dashed: true,
                  label: `Goal ${plain(cut.goal)}`,
                },
              ]}
              series={[
                {
                  mark: 'dot',
                  key: 'daily',
                  label: 'Weigh-in',
                  color: CUT_SERIES.daily,
                  y: (d) => d.weight,
                  format: (v) => `${plain(v)} kg`,
                },
                {
                  mark: 'line',
                  key: 'mean',
                  label: '7-day mean',
                  color: CUT_SERIES.trend,
                  y: (d) => d.mean,
                  weight: 'strong',
                  gaps: 'connect',
                  format: (v) => `${v.toFixed(2)} kg`,
                },
                {
                  mark: 'line',
                  key: 'plan',
                  label: `Plan, ${plain(cut.planRate)} kg/wk`,
                  color: CUT_SERIES.plan,
                  y: (d) => d.plan,
                  weight: 'quiet',
                  dash: true,
                  role: 'reference',
                  format: (v) => `${v.toFixed(2)} kg`,
                },
              ]}
            />
          )}
        />
        <ChartCard
          title="Fat and lean mass"
          subtitle="Skinfold readings, change since the first"
          phase={fatPhase}
          empty={noReadings}
          {...fatFacts}
          chart={() => (
            <CartesianChart
              label={`Fat mass and lean mass change across ${cut.readings.length} skinfold readings`}
              data={cut.readings}
              x={{ value: (r) => r.at, ...xAxis }}
              y={{
                domain: { ceil: 0.5, pad: 0.1 },
                format: (v) => signed(v, deltaDigits),
              }}
              height="fill"
              focus={readingFocus}
              refLines={[{ value: 0, color: CUT_SERIES.plan, dashed: true }]}
              series={[
                {
                  mark: 'line',
                  key: 'fat',
                  label: 'Fat mass',
                  color: CUT_SERIES.trend,
                  y: (r) => r.fatDelta,
                  weight: 'strong',
                  format: (v) => `${signed(v, 2)} kg`,
                },
                {
                  mark: 'dot',
                  key: 'fat-readings',
                  label: 'Fat reading',
                  color: CUT_SERIES.trend,
                  y: (r) => r.fatDelta,
                  legend: false,
                  tooltip: false,
                },
                {
                  mark: 'line',
                  key: 'lean',
                  label: 'Lean mass',
                  color: CUT_SERIES.lean,
                  y: (r) => r.leanDelta,
                  weight: 'strong',
                  format: (v) => `${signed(v, 2)} kg`,
                },
                {
                  mark: 'dot',
                  key: 'lean-readings',
                  label: 'Lean reading',
                  color: CUT_SERIES.lean,
                  y: (r) => r.leanDelta,
                  legend: false,
                  tooltip: false,
                },
              ]}
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
