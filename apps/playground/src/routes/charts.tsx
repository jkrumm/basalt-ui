import { rect } from '@tanstack/charts/rect'
import { createFileRoute } from '@tanstack/react-router'
import { Section } from 'basalt-ui'
import type { ReactElement, ReactNode } from 'react'
import { CartesianChart } from '../../../../packages/basalt-ui/dist/charts/parts/cartesian'
import type { Series } from '../../../../packages/basalt-ui/dist/charts/contract'
import { pixelExtent } from '../../../../packages/basalt-ui/dist/charts/seams/pixel-extent'
import { useV3Tokens } from '../demo/v3-tokens'

// The v3 `CartesianChart` is not on the public `basalt-ui/charts` barrel yet (it still exports the
// 2.x rung), so this route reaches the built module by path until the barrel switch lands. Dist, not
// src: the playground's strict index-signature check would otherwise judge the package's sources.

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
  light: `var(--vx-chart-${n})`,
  dark: `var(--vx-chart-${n})`,
})
const x = { value: (d: Day): Date => d.t }
const kg = (v: number): string => `${v.toFixed(1)} kg`

function Panel({
  seam,
  consumer,
  children,
}: {
  seam: string
  consumer: string
  children: ReactNode
}): ReactElement {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2 rounded-card bg-card p-4 shadow-card">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{seam}</span>
        <span className="text-xs text-muted-foreground">{consumer}</span>
      </figcaption>
      {children}
    </figure>
  )
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

const weightChart = (
  <CartesianChart
    ariaLabel="Body weight with its 7-day mean"
    data={DATA}
    x={x}
    height={220}
    series={weightSeries}
    y={{ domain: { floor: 78, ceil: 84, pad: 0.05 } }}
  />
)
// #endregion

// #region domain-chart
const loadChart = (
  <CartesianChart
    ariaLabel="Training load with the envelope in the domain"
    data={DATA}
    x={x}
    height={220}
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
        getMarker: () => ({ color: 'var(--vx-chart-3)' }),
      },
    ]}
    y={{ domain: ([, hi]) => [0, Math.ceil((hi * 1.25) / 10) * 10], gutter: 44 }}
  />
)
// #endregion

const shortWindow = DATA.slice(0, 14)
const longWindow = DATA

// #region shared-x
const sharedX = (data: readonly Day[]): ReactElement => (
  <CartesianChart
    ariaLabel={`Load, first ${data.length} days`}
    data={data}
    x={{ value: (d) => d.t, domain: [day(0), day(DAYS - 1)] }}
    height={120}
    series={[{ mark: 'line', key: 'load', label: 'Load', color: pair(2), y: (d) => d.load }]}
    cursor="shared-x"
  />
)
// #endregion

const bars = (
  <CartesianChart
    ariaLabel="Spikes, older bars fade"
    data={DATA}
    x={x}
    height={180}
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

// #region plot-marks
const RAIL_PX = 4
const railed = (
  <CartesianChart
    ariaLabel="Load with absent days on a 4 px rail"
    data={DATA}
    x={x}
    height={200}
    y={{ domain: [0, 100] }}
    series={[
      {
        mark: 'line',
        key: 'weight',
        label: 'Weight',
        color: pair(1),
        y: (d) => (d.weight === null ? null : d.weight - 20),
      },
    ]}
    marks={CartesianChart.custom<Day>((plot) => {
      // `plot.data` is every datum whatever the legend hides: the slot grid. `pixelExtent` keeps the
      // rail `RAIL_PX` tall at any y domain.
      const absent = plot.data.filter((d) => d.weight === null)
      const { y1, y2 } = pixelExtent(
        { plotWidth: 0, plotHeight: plot.plotHeight, yDomain: [0, 100] },
        { edge: 'bottom', px: RAIL_PX },
      )
      return [
        rect(absent, {
          id: 'absent',
          x1: (d: Day) => new Date(d.t.getTime() - 43_200_000),
          x2: (d: Day) => new Date(d.t.getTime() + 43_200_000),
          y1: () => y1,
          y2: () => y2,
          fill: 'var(--vx-warn)',
        }),
      ]
    })}
  />
)
// #endregion

const lone = (
  <CartesianChart
    ariaLabel="A lift logged on three days, one of them alone"
    data={DATA}
    x={x}
    height={180}
    series={[{ mark: 'line', key: 'lift', label: 'Top set', color: pair(3), y: (d) => d.lift }]}
  />
)

function ChartsRoute(): ReactElement {
  useV3Tokens()
  return (
    <Section title="Chart seams">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))] items-start gap-4">
        <Panel
          seam="format, weight, dash, parent, legend and tooltip false, gaps, note, role, y.domain"
          consumer="argo body-composition/charts/weight-chart.tsx:60-72"
        >
          {weightChart}
        </Panel>
        <Panel
          seam="y.domain function, y.gutter, axis, getMarker"
          consumer="linewatch charts/latency-band-chart.tsx:328-337, 254"
        >
          {loadChart}
        </Panel>
        <Panel
          seam="x.domain: one instant, one pixel column"
          consumer="linewatch charts/bufferbloat-chart.tsx:90,118"
        >
          <div className="flex flex-col gap-2">
            {sharedX(shortWindow)}
            {sharedX(longWindow)}
          </div>
        </Panel>
        <Panel
          seam="per-datum opacity"
          consumer="argo bars that fade with the datum they stand for (5 sites)"
        >
          {bars}
        </Panel>
        <Panel
          seam="plot.data, pixel-extent rule, plot.pxToY"
          consumer="linewatch charts/latency-band-chart.tsx:407-435"
        >
          {railed}
        </Panel>
        <Panel
          seam="lone point drawn"
          consumer="argo strength-tracker/charts/one-rm-trend-chart.tsx:49"
        >
          {lone}
        </Panel>
      </div>
    </Section>
  )
}

export const Route = createFileRoute('/charts')({
  staticData: { title: 'Charts' },
  component: ChartsRoute,
})
