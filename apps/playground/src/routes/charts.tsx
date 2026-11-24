import { createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page, Section } from 'basalt-ui/page'
import { CartesianChart, ChartCard } from 'basalt-ui/charts'
import type { ChartFigure, Series } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { useFixture } from '../demo/fixture'

type Day = {
  t: Date
  weight: number | null
  mean: number | null
  load: number | null
  lift: number | null
  spike: number | null
}

const DAYS = 28
const day = (i: number): Date => new Date(Date.UTC(2026, 9, 1 + i))
const wave = (i: number, period: number, amp: number): number => Math.sin(i / period) * amp

/** A month of stand-in readings: a body weight with gaps, its mean, a load, a sparse lift and spikes. */
const DATA: readonly Day[] = Array.from({ length: DAYS }, (_, i) => {
  const weight = i % 6 === 4 ? null : 82 + wave(i, 4, 1.2) - i * 0.04
  return {
    t: day(i),
    weight,
    mean: 82 - i * 0.04 + wave(i, 9, 0.3),
    load: 55 + wave(i, 3, 20) + (i % 7) * 3,
    lift: i === 9 || i === 10 ? 100 + i : i === 24 ? 108 : null,
    spike: i % 5 === 0 ? 20 + (i % 3) * 25 : null,
  }
})

const pair = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})
const x = { value: (d: Day): Date => d.t }
const kg = (v: number): string => `${v.toFixed(1)} kg`

/** The headline: the month's last reading and its change since the first, from the rows the card draws. */
function weightFigure(days: readonly Day[]): ChartFigure | undefined {
  const last = days.findLast((d) => d.weight !== null)?.weight
  const first = days.find((d) => d.weight !== null)?.weight
  if (last == null || first == null) return undefined
  const delta = last - first
  return {
    value: kg(last),
    delta: { value: `${delta.toFixed(1)} kg`, polarity: 'up-bad', label: 'since Oct 1' },
  }
}

// #region weight-chart
const weightSeries: Series<Day>[] = [
  {
    mark: 'line',
    key: 'weight',
    label: 'Weight',
    color: pair(1),
    y: (d) => d.weight,
    weight: 'strong',
    gaps: 'connect',
    format: kg,
    note: 'daily',
  },
  {
    mark: 'line',
    key: 'mean',
    label: '7-day mean',
    color: pair(1),
    y: (d) => d.mean,
    weight: 'quiet',
    dash: true,
    role: 'overlay',
    parent: 'weight',
    legend: false,
    tooltip: false,
  },
]

const weightChart = (data: readonly Day[], height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="Body weight with its 7-day mean"
    data={data}
    x={x}
    height={height}
    series={weightSeries}
    y={{ domain: { floor: 78, ceil: 84, pad: 0.05 } }}
  />
)
// #endregion

// #region domain-chart
const loadChart = (data: readonly Day[], height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="Training load with the top set on the right axis"
    data={data}
    x={x}
    height={height}
    series={[
      {
        mark: 'line',
        key: 'load',
        label: 'Load',
        color: pair(2),
        y: (d) => d.load,
        weight: 'strong',
      },
      {
        mark: 'line',
        key: 'lift',
        label: 'Top set',
        color: pair(3),
        y: (d) => d.lift,
        axis: 'right',
        format: (v) => `${v} kg`,
        getMarker: () => ({ color: 'var(--basalt-chart-3)' }),
      },
    ]}
    y={{ domain: ([, hi]) => [0, Math.ceil((hi * 1.25) / 10) * 10], gutter: 44 }}
  />
)
// #endregion

// #region shared-x
/** Two windows of one month on one x domain: the same day sits in the same pixel column in both. */
const sharedX = (data: readonly Day[], height: number | 'fill'): ReactElement => (
  <CartesianChart
    label={`Load, first ${data.length} days`}
    data={data}
    x={{ value: (d) => d.t, domain: [day(0), day(DAYS - 1)] }}
    height={height}
    series={[{ mark: 'line', key: 'load', label: 'Load', color: pair(2), y: (d) => d.load }]}
    cursor="shared-x"
  />
)
// #endregion

const bars = (data: readonly Day[], height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="Spikes per day, older bars fade"
    data={data}
    x={x}
    height={height}
    series={[
      {
        mark: 'bar',
        key: 'spike',
        label: 'Spike',
        color: pair(4),
        y: (d) => d.spike,
        opacity: (d) => 0.35 + (d.t.getTime() - day(0).getTime()) / (DAYS * 86_400_000) / 1.6,
      },
    ]}
  />
)

const lone = (data: readonly Day[], height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="A lift logged on three days, one of them alone"
    data={data}
    x={x}
    height={height}
    series={[{ mark: 'line', key: 'lift', label: 'Top set', color: pair(3), y: (d) => d.lift }]}
  />
)

/**
 * Charts on `CartesianChart` from `basalt-ui/charts`, each in its `ChartCard`: a line with its mean
 * and gaps, a second axis, two windows on one x domain, faded bars and a lone point.
 */
function ChartsRoute(): ReactElement {
  const days = useFixture(['charts', 'days'], DATA)
  const rows = days.data
  const empty = rows?.length === 0 ? { cause: 'No readings this month yet.' } : null
  const card = { phase: days, empty }
  return (
    <Page area="charts">
      <ChartCard
        {...card}
        title="Body weight"
        subtitle="daily, October"
        info="A day with no weigh-in is bridged; the dashed line is the 7-day mean."
        figure={rows === undefined ? undefined : weightFigure(rows)}
        height="tall"
        chart={(box) => (rows === undefined ? null : weightChart(rows, box.height))}
      />
      <CardGrid min="regular">
        <ChartCard
          {...card}
          title="Training load"
          subtitle="per day, top set on the right axis"
          chart={(box) => (rows === undefined ? null : loadChart(rows, box.height))}
        />
        <ChartCard
          {...card}
          title="Spikes"
          subtitle="per day, older days fade"
          chart={(box) => (rows === undefined ? null : bars(rows, box.height))}
        />
      </CardGrid>
      <Section title="One x domain">
        <CardGrid min="regular">
          <ChartCard
            {...card}
            title="First two weeks"
            subtitle="on the month's axis"
            height="short"
            chart={(box) => (rows === undefined ? null : sharedX(rows.slice(0, 14), box.height))}
          />
          <ChartCard
            {...card}
            title="Whole month"
            subtitle="the same days line up"
            height="short"
            chart={(box) => (rows === undefined ? null : sharedX(rows, box.height))}
          />
        </CardGrid>
      </Section>
      <ChartCard
        {...card}
        title="Top set"
        subtitle="three sessions, one alone"
        height="short"
        chart={(box) => (rows === undefined ? null : lone(rows, box.height))}
      />
    </Page>
  )
}

export const Route = createFileRoute('/charts')({
  staticData: { title: 'Charts' },
  component: ChartsRoute,
})
