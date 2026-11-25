import { createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page } from 'basalt-ui/page'
import { CartesianChart, ChartCard, Heatmap, RangeNavigator, Waterfall } from 'basalt-ui/charts'
import type { ChartFigure, ChartWindowSpans, Series } from 'basalt-ui/charts'
import { defineControls, field } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { BASALT } from 'basalt-ui/tokens'
import { createFormat } from 'basalt-ui'
import {
  DEPLOYS,
  dayContext,
  HALVINGS,
  HOURS,
  INCOME_BRIDGE,
  INCOME_Q2,
  PRICE_HISTORY,
  RHR_BASELINE,
  TRAINING,
  WEEKDAYS,
  WEIGHT_TARGET,
  WEIGH_INS,
  CUT_START,
} from '../demo/charts-gallery'
import type { DeployCell, PriceDay, TrainingDay, WeighIn } from '../demo/charts-gallery'
import { useFixture } from '../demo/fixture'

const pair = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})

/** The ink a reference rule takes: a threshold, not a series. */
const RULE = { light: BASALT.inkMuted, dark: BASALT.inkMuted }

const FORMAT = createFormat({ locale: 'en' })
const usd = (v: number): string =>
  FORMAT.number(v, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: v >= 10_000 ? 1 : 0,
    ...(v >= 10_000 && { notation: 'compact' }),
    signDisplay: 'auto',
  })
const percent = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '\u2212' : ''}${Math.abs(v).toFixed(1)}%`

/** The window of the price history: a span back from the last close, or two days the brush set. */
const gallery = defineControls({
  id: 'charts',
  scope: 'page',
  fields: {
    window: field
      .range({ presets: ['6m', '1y', '4y', '10y', 'all'], fallback: 'all', custom: true })
      .labels({ '6m': '6M', '1y': '1Y', '4y': '4Y', '10y': '10Y', all: 'All', custom: 'Custom' }),
  },
})

const SPANS: ChartWindowSpans<'6m' | '1y' | '4y' | '10y' | 'all'> = {
  '6m': 182,
  '1y': 365,
  '4y': 1461,
  '10y': 3652,
  all: 'all',
}

/** Where the score puts the price: a bottom, a top, or neither. */
function verdictOf(score: number): ChartFigure['status'] {
  if (score >= 75) return { tone: 'bad', label: 'Overheated' }
  if (score <= 25) return { tone: 'good', label: 'Undervalued' }
  return { tone: 'warn', label: 'Mid-cycle' }
}

// #region price-cycle
const priceSeries: Series<PriceDay>[] = [
  {
    mark: 'line',
    key: 'score',
    label: 'Cycle score',
    color: pair(5),
    y: (d) => d.score,
    weight: 'quiet',
    area: 'fade',
    tooltip: false,
  },
  {
    mark: 'line',
    key: 'price',
    label: 'Price',
    color: pair(1),
    y: (d) => d.price,
    axis: 'right',
    weight: 'strong',
    format: usd,
    extremes: true,
    colorBy: {
      value: (d) => d.score,
      domain: [0, 100],
      label: 'Cycle score',
      format: (v) => v.toFixed(0),
    },
    status: (_, d) => verdictOf(d.score),
  },
]

function PriceCycle(): ReactElement {
  const history = useFixture(['charts', 'price'], PRICE_HISTORY)
  const [range] = gallery.field.window.use()
  const rows = history.data
  const view =
    rows === undefined ? undefined : RangeNavigator.window(rows, (d) => d.t, range, SPANS)
  const last = rows?.at(-1)
  // The headline is today's close against a year ago, whatever window the plot shows.
  const yearAgo =
    last === undefined
      ? undefined
      : rows?.findLast((d) => d.t.getTime() <= last.t.getTime() - 365 * 86_400_000)
  const figure: ChartFigure | undefined =
    yearAgo === undefined || last === undefined
      ? undefined
      : {
          value: usd(last.price),
          delta: {
            value: percent(((last.price - yearAgo.price) / yearAgo.price) * 100),
            polarity: 'up-good',
            label: 'in a year',
          },
          status: verdictOf(last.score),
        }
  return (
    <ChartCard
      phase={history}
      title="Is Bitcoin cheap or expensive right now?"
      subtitle="price on a log scale, colored by its cycle score"
      info="The score places the price against its long-run trend: 0 is a cycle bottom, 100 a top. Pick a window, or drag the strip under the plot."
      figure={figure}
      height="tall"
      panes={[
        {
          weight: 3,
          chart: () =>
            rows === undefined || view === undefined ? null : (
              <CartesianChart
                label="Bitcoin price on a log scale with its cycle score"
                data={view.data}
                x={{ value: (d) => d.t, domain: view.domain }}
                y={{ domain: [0, 100], title: 'Score' }}
                y2={{ scale: 'log', title: 'USD', format: usd }}
                series={priceSeries}
                events={HALVINGS}
                tooltip={{ change: 'start' }}
                height="fill"
              />
            ),
        },
        {
          chart: () =>
            rows === undefined ? null : (
              <RangeNavigator
                label="Price history window"
                data={rows}
                x={(d) => d.t}
                y={(d) => d.price}
                color={pair(1)}
                scale="log"
                window={gallery.field.window}
                spans={SPANS}
                height="fill"
              />
            ),
        },
      ]}
    />
  )
}
// #endregion

// #region linked-readout
const loadSeries: Series<TrainingDay>[] = [
  { mark: 'bar', key: 'load', label: 'Load', color: pair(2), y: (d) => d.load },
  {
    mark: 'line',
    key: 'loadMean',
    label: '7-day mean',
    color: pair(3),
    y: (d) => d.loadMean,
    weight: 'strong',
  },
]

const rhrSeries: Series<TrainingDay>[] = [
  {
    mark: 'line',
    key: 'rhr',
    label: 'Resting HR',
    color: pair(4),
    y: (d) => d.rhr,
    weight: 'strong',
    format: (v) => `${v.toFixed(1)} bpm`,
    compare: { label: '7-day mean', y: (d) => d.rhrMean },
    status: (v) =>
      v >= RHR_BASELINE + 4
        ? { tone: 'warn', label: 'Strained' }
        : { tone: 'good', label: 'Rested' },
  },
]

function LinkedReadout(): ReactElement {
  const block = useFixture(['charts', 'training'], TRAINING)
  const rows = block.data
  return (
    <CardGrid min="regular">
      <ChartCard
        phase={block}
        title="How hard did I train?"
        subtitle="daily load, 12 weeks"
        chart={(box) =>
          rows === undefined ? null : (
            <CartesianChart
              label="Daily training load with its 7-day mean"
              data={rows}
              x={{ value: (d) => d.t }}
              series={loadSeries}
              tooltip={{ follow: true }}
              height={box.height}
            />
          )
        }
      />
      <ChartCard
        phase={block}
        title="Did my resting heart rate follow?"
        subtitle="beats per minute, the same days"
        chart={(box) =>
          rows === undefined ? null : (
            <CartesianChart
              label="Resting heart rate against its baseline"
              data={rows}
              x={{ value: (d) => d.t }}
              y={{ domain: { floor: 44, ceil: 56 } }}
              series={rhrSeries}
              refLines={[
                { value: RHR_BASELINE, axis: 'left', color: RULE, dashed: true, label: 'Baseline' },
              ]}
              tooltip={{ follow: true, change: 'previous' }}
              height={box.height}
            />
          )
        }
      />
    </CardGrid>
  )
}
// #endregion

// #region waterfall
function IncomeBridge(): ReactElement {
  const bridge = useFixture(['charts', 'income'], INCOME_BRIDGE)
  const items = bridge.data
  const q3 = items?.reduce((sum, d) => sum + d.amount, INCOME_Q2)
  const k = (v: number): string => `$${(v / 1000).toFixed(2)}M`
  return (
    <ChartCard
      phase={bridge}
      title="Where did Q3's operating income come from?"
      subtitle="thousands of USD, Q2 to Q3"
      figure={
        q3 === undefined
          ? undefined
          : {
              value: k(q3),
              delta: {
                value: percent(((q3 - INCOME_Q2) / INCOME_Q2) * 100),
                polarity: 'up-good',
                label: 'vs Q2',
              },
            }
      }
      chart={(box) =>
        items === undefined ? null : (
          <Waterfall
            label="Operating income bridge from Q2 to Q3"
            data={items}
            step={(d) => d.name}
            value={(d) => d.amount}
            ticks="all"
            start={{ label: 'Q2', value: INCOME_Q2 }}
            total="Q3"
            format={(v) => `${Math.round(v)}k`}
            height={box.height}
          />
        )
      }
    />
  )
}
// #endregion

// #region heatmap
function DeployFailures(): ReactElement {
  const grid = useFixture(['charts', 'deploys'], DEPLOYS)
  const cells = grid.data
  return (
    <ChartCard
      phase={grid}
      title="When do deploys fail?"
      subtitle="failure rate by weekday and hour, last 90 days"
      chart={(box) =>
        cells === undefined ? null : (
          <Heatmap<DeployCell>
            label="Deploy failure rate by weekday and hour"
            data={cells}
            getRow={(d) => d.day}
            getCol={(d) => d.hour}
            getValue={(d) => d.rate}
            rows={WEEKDAYS}
            cols={HOURS}
            color="var(--basalt-bad)"
            formatValue={(v) => `${v.toFixed(1)}%`}
            formatLegend={(v) => `${v.toFixed(0)}%`}
            legend={{ label: 'Failure rate' }}
            tickCols={['00', '06', '12', '18']}
            tooltip={{
              valueLabel: 'Failure rate',
              rows: (d) => [{ label: 'Deploys', value: String(d.deploys) }, ...dayContext(d)],
            }}
            height={box.height === 'fill' ? 'fill' : box.height}
          />
        )
      }
    />
  )
}
// #endregion

// #region weight
const weightSeries: Series<WeighIn>[] = [
  {
    mark: 'line',
    key: 'weight',
    label: 'Weight',
    color: pair(1),
    y: (d) => d.weight,
    weight: 'strong',
    gaps: 'connect',
    format: (v) => `${v.toFixed(1)} kg`,
    compare: { label: '7-day mean', y: (d) => d.mean },
    status: (v) =>
      v <= WEIGHT_TARGET + 0.5
        ? { tone: 'good', label: 'At target' }
        : { tone: 'neutral', label: `${(v - WEIGHT_TARGET).toFixed(1)} kg to go` },
    extremes: true,
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

function WeightToTarget(): ReactElement {
  const log = useFixture(['charts', 'weight'], WEIGH_INS)
  const rows = log.data
  const last = rows?.findLast((d) => d.weight !== null)?.weight
  const first = rows?.find((d) => d.weight !== null)?.weight
  return (
    <ChartCard
      phase={log}
      title={`Am I on track for ${WEIGHT_TARGET} kg?`}
      subtitle="daily weigh-ins and the 7-day mean"
      figure={
        last == null || first == null
          ? undefined
          : {
              value: `${last.toFixed(1)} kg`,
              delta: {
                value: `${(last - first).toFixed(1)} kg`,
                polarity: 'up-bad',
                label: 'since the start',
              },
            }
      }
      chart={(box) =>
        rows === undefined ? null : (
          <CartesianChart
            label="Body weight against the target"
            data={rows}
            x={{ value: (d) => d.t }}
            y={{ domain: { floor: 79, ceil: 85 } }}
            series={weightSeries}
            refLines={[{ value: WEIGHT_TARGET, color: RULE, dashed: true, label: 'Target' }]}
            events={[{ at: CUT_START, label: 'Cut' }]}
            tooltip={{ change: 'start' }}
            height={box.height}
          />
        )
      }
    />
  )
}
// #endregion

/**
 * A gallery of chart patterns on `basalt-ui/charts`, each card titled by the question it answers: a
 * long history on a log axis colored by a second value with a range navigator, two charts that share
 * one cursor and readout, a waterfall, a heat grid and a line against its target with events.
 */
function ChartsRoute(): ReactElement {
  return (
    <Page area="charts">
      <PriceCycle />
      <LinkedReadout />
      <CardGrid min="regular">
        <IncomeBridge />
        <WeightToTarget />
      </CardGrid>
      <DeployFailures />
    </Page>
  )
}

export const Route = createFileRoute('/charts')({
  staticData: { title: 'Charts' },
  validateSearch: gallery.validateSearch,
  search: { middlewares: gallery.middlewares },
  component: ChartsRoute,
})
