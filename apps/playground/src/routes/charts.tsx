import { createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page, Section } from 'basalt-ui/page'
import { CartesianChart, ChartCard } from 'basalt-ui/charts'
import type { Series } from 'basalt-ui/charts'
import type { ReactElement } from 'react'

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

/** The last reading the month has, for the headline. */
const lastWeight = DATA.findLast((d) => d.weight !== null)?.weight ?? null
const firstWeight = DATA.find((d) => d.weight !== null)?.weight ?? null
const weightDelta = lastWeight === null || firstWeight === null ? null : lastWeight - firstWeight

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

const weightChart = (height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="Body weight with its 7-day mean"
    data={DATA}
    x={x}
    height={height}
    series={weightSeries}
    y={{ domain: { floor: 78, ceil: 84, pad: 0.05 } }}
  />
)
// #endregion

// #region domain-chart
const loadChart = (height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="Training load with the top set on the right axis"
    data={DATA}
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

const shortWindow = DATA.slice(0, 14)

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

const bars = (height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="Spikes per day, older bars fade"
    data={DATA}
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

const lone = (height: number | 'fill'): ReactElement => (
  <CartesianChart
    label="A lift logged on three days, one of them alone"
    data={DATA}
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
  return (
    <Page area="charts">
      <ChartCard
        title="Body weight"
        subtitle="daily, October"
        info="A day with no weigh-in is bridged; the dashed line is the 7-day mean."
        figure={{
          value: lastWeight === null ? '–' : kg(lastWeight),
          delta:
            weightDelta === null
              ? undefined
              : { value: `${weightDelta.toFixed(1)} kg`, polarity: 'up-bad', label: 'since Oct 1' },
        }}
        height="tall"
        chart={(box) => weightChart(box.height)}
      />
      <CardGrid min="regular">
        <ChartCard
          title="Training load"
          subtitle="per day, top set on the right axis"
          chart={(box) => loadChart(box.height)}
        />
        <ChartCard
          title="Spikes"
          subtitle="per day, older days fade"
          chart={(box) => bars(box.height)}
        />
      </CardGrid>
      <Section title="One x domain">
        <CardGrid min="regular">
          <ChartCard
            title="First two weeks"
            subtitle="on the month's axis"
            height="short"
            chart={(box) => sharedX(shortWindow, box.height)}
          />
          <ChartCard
            title="Whole month"
            subtitle="the same days line up"
            height="short"
            chart={(box) => sharedX(DATA, box.height)}
          />
        </CardGrid>
      </Section>
      <ChartCard
        title="Top set"
        subtitle="three sessions, one alone"
        height="short"
        chart={(box) => lone(box.height)}
      />
    </Page>
  )
}

export const Route = createFileRoute('/charts')({
  staticData: { title: 'Charts' },
  component: ChartsRoute,
})
