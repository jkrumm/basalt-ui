/**
 * n01 — the household internet line, last 30 days.
 *
 *   Question: How often did the line drop, for how long, and does speed hold the contracted rate?
 *
 * One strip says the three answers, each against a baseline (the previous 30 days, the availability
 * target, the contract); the evidence under it is downtime per day (bars), the outages as lengths on
 * one scale (bar list) and hourly speed as a share of the contracted rate (lines against a 100 %
 * rule, outages as rules, the degraded stretch shaded and named).
 * `?fixture=clean` shows zero outages; the default has eight, the longest crossing midnight.
 */
import { SimpleGrid, Stack } from '@mantine/core'
import { useRouterState } from '@tanstack/react-router'
import { BarList, DeltaBadge, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Bars, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX, alpha } from 'basalt-ui/tokens'
import { demoColors } from '../../../demo/series'
import { cardStateProps, chartStateFor, noop, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import {
  AVAILABILITY_TARGET,
  CONTRACT_DOWN,
  CONTRACT_UP,
  FIXTURES,
  HOLD_SHARE,
  WINDOW_LABEL,
  fmtClock,
  fmtDuration,
  fmtStamp,
  isFixtureName,
} from './fixture'
import type { DayDowntime, DaySpeed, LineFixture } from './fixture'
import { fmtDay } from '../../fixture-utils'

const HOLD_PCT = HOLD_SHARE * 100
/** The one full empty message; every other card carries a short cue. */
const EMPTY_COPY = `No readings from the line monitor ${WINDOW_LABEL}. Check that it is connected.`
const retry = (): string => retryCopy('line monitor')
/** The share of hours that must hold the rate for the contract to count as kept. */
const HOLD_TARGET = 0.95
const signed = (v: number, text: string): string => `${v < 0 ? '-' : '+'}${text}`
/** What the target availability allows a day, in minutes. */
const ALLOWED_MIN_PER_DAY = Math.round(1440 * (1 - AVAILABILITY_TARGET / 100) * 10) / 10
const DOWNTIME_NOUN = 'Minutes down per UTC day'

/** `?fixture=` name from the router; unknown or absent is the default `line`. */
function useFixture(): LineFixture {
  // cycle-expression-2: the route's validateSearch drops `fixture`, so the raw href is parsed here
  const href = useRouterState({ select: (s) => s.location.href })
  const name = new URL(href, 'http://localhost').searchParams.get('fixture')
  return FIXTURES[isFixtureName(name) ? name : 'line']
}

const mbit = (v: number, rate: number): string => `${Math.round((v / 100) * rate * 10) / 10} Mbit/s`

const cardError = (shotState: ScenarioProps['shotState']) =>
  shotState === 'error' ? { onRetry: noop } : {}

function LineStats({ shotState, fx }: ScenarioProps & { fx: LineFixture }) {
  const loading = shotState === 'loading'
  const hidden = shotState === 'empty' || shotState === 'error'
  const cellState = (reason: string): Pick<StatStripCell, 'state'> =>
    shotState === 'error'
      ? { state: { kind: 'error', error: new Error(retry()), onRetry: noop } }
      : shotState === 'empty'
        ? { state: { kind: 'empty', reason } }
        : {}
  const count = fx.outages.length
  const hoursTotal = fx.samples.length
  // One rule per cell, against its own baseline or target; one hue ("bad") says it failed.
  const live = !hidden && !loading
  const failing = {
    drops: count > fx.previous.outages,
    down: fx.availability * 100 < AVAILABILITY_TARGET,
    speed: fx.holdShare < HOLD_TARGET,
  }
  const cells: StatStripCell[] = [
    {
      key: 'drops',
      caption: 'Drops',
      qualifier: 'last 30 days',
      info: `Times the line was down, ${WINDOW_LABEL}. Each is one interval from the line monitor. Over the previous 30 days there were ${fx.previous.outages}.`,
      value: String(count),
      unit: count === 1 ? 'outage' : 'outages',
      loading,
      ...cellState('No readings.'),
      ...(live && failing.drops && { tone: 'bad' as const }),
      ...(!hidden && {
        delta: (
          <DeltaBadge
            value={count - fx.previous.outages}
            polarity="neutral"
            period="vs prior 30 d"
            format={(v) => signed(v, String(Math.abs(v)))}
          />
        ),
        footer:
          fx.longest === undefined
            ? 'The line did not drop.'
            : `Longest ${fmtDuration(fx.longest.minutes)}, ${fmtStamp(fx.longest.start)}`,
      }),
    },
    {
      key: 'down',
      caption: 'Time down',
      qualifier: 'last 30 days',
      info: 'Minutes of every outage added together. Availability is the share of the 30 days the line was up.',
      value: fmtDuration(fx.totalMinutes),
      loading,
      ...cellState('No readings.'),
      ...(live && failing.down && { tone: 'bad' as const }),
      ...(!hidden && {
        delta: (
          <DeltaBadge
            value={fx.totalMinutes - fx.previous.minutes}
            polarity="neutral"
            period="vs prior 30 d"
            format={(v) => signed(v, fmtDuration(Math.abs(v)))}
          />
        ),
        footer: `${(fx.availability * 100).toFixed(2)}% available, target ${AVAILABILITY_TARGET}%`,
      }),
    },
    {
      key: 'speed',
      caption: 'Speed holds',
      qualifier: 'share of hours',
      info: `An hour holds the rate when its download is at least ${HOLD_PCT}% of the ${CONTRACT_DOWN} Mbit/s contract. The contract is kept when ${HOLD_TARGET * 100}% of hours hold; an outage hour counts as below.`,
      value: String(Math.round(fx.holdShare * 100)),
      unit: '% of hours hold the rate',
      loading,
      ...cellState('No readings.'),
      ...(live && failing.speed && { tone: 'bad' as const }),
      ...(!hidden && {
        footer: `${fx.hoursBelow} of ${hoursTotal} hours under ${HOLD_PCT}% of ${CONTRACT_DOWN} Mbit/s, target ${HOLD_TARGET * 100}% hold`,
      }),
    },
  ]
  return <StatGroup variant="strip" label="Internet line, last 30 days" cols={3} cells={cells} />
}

function DowntimeByDay({ shotState, fx }: ScenarioProps & { fx: LineFixture }) {
  const focus = useChartFocus(fx.days, {
    announce: (d) =>
      `${d.label}: ${d.minutes === 0 ? 'line up all day' : `${fmtDuration(d.minutes)} down`}`,
  })
  const ticks = fx.days.filter((_, i) => i % 5 === 0).map((d) => d.label)
  const axis = Array.from({ length: fx.dayAxisMax / 60 + 1 }, (_, h) => h * 60)
  const { longest, worstDay } = fx
  const guides = [
    ...(longest === undefined
      ? []
      : [
          {
            x: fmtDay(longest.start),
            color: VX.faint,
            dashed: true,
            // The times, not only the length: the bars of the two days each show their own share.
            label: `Outage ${fmtClock(longest.start)} to ${fmtClock(longest.end)} (${fmtDuration(longest.minutes)})`,
          },
        ]),
    ...(focus.datum === null ? [] : [{ x: focus.datum.label, color: VX.line }]),
  ]
  const allowed = `Allowed at ${AVAILABILITY_TARGET}%: ${ALLOWED_MIN_PER_DAY} min a day`
  return (
    <ChartCard
      title="Downtime per day"
      ghost="bars"
      facts={{
        value: focus.readout(
          worstDay === undefined ? 'Up all 30 days' : fmtDuration(worstDay.minutes),
          (d) => (d.minutes === 0 ? 'Up all day' : fmtDuration(d.minutes)),
        ),
        period: focus.readout(
          worstDay === undefined ? 'no downtime' : `worst day, ${worstDay.label}`,
          (d) => d.label,
        ),
        comparison: allowed,
      }}
      info="Minutes the line was down on each UTC day. An outage across midnight counts on both days."
      state={chartStateFor(shotState, { empty: 'No daily totals.', error: retry() })}
      {...cardError(shotState)}
    >
      <Bars<DayDowntime, string>
        data={fx.days}
        ariaLabel={`Minutes of downtime per day, ${WINDOW_LABEL}`}
        x={(d) => d.label}
        xTicks={ticks}
        y={{ domain: [0, fx.dayAxisMax], ticks: axis, title: DOWNTIME_NOUN }}
        bars={[
          {
            key: 'down',
            label: 'Down',
            color: demoColors.churn,
            getValue: (d) => d.minutes,
            formatValue: (v) => (v === 0 ? 'Up all day' : fmtDuration(v)),
          },
        ]}
        barOpacity={(d) => (focus.dimmed(d) ? 0.3 : 1)}
        xRefLines={guides}
        // cycle-expression-2: a chart with nothing to plot cannot collapse; the height is cut by hand
        height={fx.totalMinutes === 0 ? 120 : undefined}
        refLines={
          fx.totalMinutes === 0
            ? [
                {
                  value: 0,
                  color: VX.goodRef,
                  label: 'Up all 30 days',
                  labelPosition: 'start-above',
                },
              ]
            : []
        }
        focus={focus}
      />
    </ChartCard>
  )
}

function OutageList({ shotState, fx }: ScenarioProps & { fx: LineFixture }) {
  const newestFirst = fx.outages.toReversed()
  const items = shotState === 'empty' ? [] : newestFirst
  return (
    <ChartCard
      title="Outages"
      info="Every outage the line monitor recorded, newest first, as one bar per outage on one scale. Times are UTC."
      facts={[
        { value: String(fx.outages.length), unit: fx.outages.length === 1 ? 'outage' : 'outages' },
        ...(fx.longest === undefined
          ? []
          : [
              {
                value: fmtDuration(fx.longest.minutes),
                period: 'longest',
                comparison: `median ${fmtDuration(fx.medianOutage)}`,
              },
            ]),
      ]}
      {...cardStateProps(shotState, retry(), 'content', 'No outage log.')}
    >
      <BarList
        label={`Outages, ${WINDOW_LABEL}, length of each`}
        items={items.map((o) => ({
          key: o.id,
          label: fmtStamp(o.start),
          value: o.minutes,
          secondary: `to ${fmtClock(o.end)}`,
        }))}
        format={(v) => fmtDuration(v)}
        loading={shotState === 'loading'}
        loadingRows={fx.outages.length || 1}
        emptyText={
          shotState === 'empty'
            ? 'No outage log.'
            : `No outages. The line stayed up ${WINDOW_LABEL}.`
        }
      />
    </ChartCard>
  )
}

function SpeedAgainstContract({ shotState, fx }: ScenarioProps & { fx: LineFixture }) {
  const focus = useChartFocus(fx.speedDays, {
    announce: (d) =>
      `${fmtDay(d.day)}: median hour ${d.down} Mbit/s down, ${d.up} Mbit/s up, ${Math.round(d.downPct)}% of the contract`,
  })
  const { degraded, longest } = fx
  const [lo, hi] = fx.speedDomain
  const ticks = Array.from({ length: (100 - lo) / 10 + 1 }, (_, i) => lo + i * 10)
  // An outage is a rule at its start, so a four-minute drop shows where a daily median cannot.
  const guides = [
    ...fx.outages.map((o) => ({
      x: o.start,
      color: alpha(VX.status.bad, 0.5),
      ...(o === longest && { label: `${fmtDuration(o.minutes)} down` }),
    })),
    ...(degraded === undefined
      ? []
      : [
          {
            x: degraded.from,
            color: VX.muted,
            dashed: true,
            label: `3 days at ~${Math.round(degraded.meanPct)}% of contract`,
          },
        ]),
    ...(focus.datum === null ? [] : [{ x: focus.datum.day, color: VX.line }]),
  ]
  return (
    <ChartCard
      title="Median hour per day against the contracted rate"
      ghost="line"
      facts={[
        {
          value: focus.readout(`${Math.round(fx.medianDown)} Mbit/s`, (d) => `${d.down} Mbit/s`),
          period: focus.readout(`median download, ${CONTRACT_DOWN} contracted`, (d) =>
            fmtDay(d.day),
          ),
        },
        {
          value: focus.readout(`${Math.round(fx.medianUp)} Mbit/s`, (d) => `${d.up} Mbit/s`),
          period: focus.readout(
            `median upload, ${CONTRACT_UP} contracted`,
            (d) => `${Math.round(d.upPct)}% of it`,
          ),
        },
      ]}
      info={`The median hour of each UTC day as a share of the ${CONTRACT_DOWN} Mbit/s download contract. Below the ${HOLD_PCT}% line the rate does not hold. Red rules mark each outage start; outage hours do not move a daily median.`}
      state={chartStateFor(shotState, { empty: EMPTY_COPY, error: retry() })}
      {...cardError(shotState)}
    >
      <Lines<DaySpeed, Date>
        data={fx.speedDays}
        ariaLabel={`Median hourly download speed per day as a share of the contracted rate, ${WINDOW_LABEL}`}
        x={(d) => d.day}
        formatX={(at) => fmtDay(at as Date)}
        y={{ domain: [lo, hi], ticks, format: (v) => `${v}%`, title: '% of contracted rate' }}
        series={[
          {
            key: 'down',
            label: 'Download',
            color: demoColors.sessions,
            getValue: (d) => d.downPct,
            formatValue: (v) => `${mbit(v, CONTRACT_DOWN)} (${Math.round(v)}%)`,
          },
        ]}
        xZones={
          degraded === undefined
            ? []
            : [{ from: degraded.from, to: degraded.to, fill: alpha(VX.status.neutral, 0.12) }]
        }
        refLines={[
          {
            value: 100,
            color: VX.faint,
            dashed: true,
            label: 'Contracted rate',
            labelPosition: 'start-above',
          },
          {
            value: HOLD_PCT,
            color: VX.faint,
            label: `Holds from ${HOLD_PCT}%`,
            labelPosition: 'start-below',
          },
        ]}
        xRefLines={guides}
        legend={false}
        focus={focus}
      />
    </ChartCard>
  )
}

export function ExprN01Scenario({ shotState }: ScenarioProps) {
  const fx = useFixture()
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <LineStats shotState={shotState} fx={fx} />
      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <DowntimeByDay shotState={shotState} fx={fx} />
        <OutageList shotState={shotState} fx={fx} />
      </SimpleGrid>
      <SpeedAgainstContract shotState={shotState} fx={fx} />
    </Stack>
  )
}
