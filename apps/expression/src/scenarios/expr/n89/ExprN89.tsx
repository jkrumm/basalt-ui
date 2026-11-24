import { useFormat } from 'basalt-ui'
import type { Delta, Phase } from 'basalt-ui/cards'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { Bars, CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { BarsSeries, Series } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N89_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { sceneFor } from './fixture'
import type { CleanDay, TestStep, WaitSource } from './fixture'

const retryWaits = (): void => undefined
const retrySteps = (): void => undefined
const retryDays = (): void => undefined

const NO_DELTA: Delta = { value: '', polarity: 'neutral', label: '' }

/** A signed whole number with a true minus. */
const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

export function ExprN89Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const scene = sceneFor(fixture)
  const ready = shotState === undefined
  const phaseOf = (retry: () => void, message: string): Phase =>
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry, message }
        : 'ready'
  const pct = (fraction: number): string => f.percent(fraction, { maximumFractionDigits: 0 })
  const dayText = (d: Date): string => f.date(d, 'day')
  const gb = (n: number): string =>
    `${f.number(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`

  const { sources, steps, days } = scene

  // Added waits by source
  const waitSeries: readonly BarsSeries<WaitSource>[] = [
    { mark: 'bar', key: 'needed', label: 'Needed', color: N89_SERIES.needed, y: (s) => s.needed },
    {
      mark: 'bar',
      key: 'notNeeded',
      label: 'Not needed',
      color: N89_SERIES.notNeeded,
      y: (s) => s.notNeeded,
    },
    {
      mark: 'bar',
      key: 'notMeasured',
      label: 'Not measured',
      color: N89_SERIES.notMeasured,
      y: (s) => s.notMeasured,
    },
    {
      mark: 'bar',
      key: 'takenBack',
      label: 'Taken back',
      color: N89_SERIES.takenBack,
      y: (s) => s.takenBack,
      values: true,
    },
  ]

  const sourceFocus = useChartFocus(sources, {
    announce: (s) =>
      `${s.name}: ${waitSeries.map((v) => `${v.y(s)} ${v.label.toLowerCase()}`).join(', ')}`,
  })
  const waitTotal = sum(sources.map((s) => s.total))
  const neededTotal = sum(sources.map((s) => s.needed))
  const neededShare = waitTotal === 0 ? 0 : neededTotal / waitTotal
  const sharePts = Math.round((neededShare - scene.priorNeededShare) * 100)
  const lostLine = (count: number, minutes: number | null): string =>
    `${count} slowed the queue ${minutes === null ? 'by an unmeasured time' : `by ${Math.round(minutes / 60)} h`}`
  const lostMinutes = sum(sources.map((s) => s.notNeededMinutes ?? 0))
  const stopped = sources.find((s) => s.stoppedOn !== null)
  const unmeasured = sources.find((s) => s.notNeededMinutes === null)

  // Test steps by peak memory
  const stepLine = (s: TestStep): string => `${s.name}: ${gb(s.peak)}, median ${gb(s.median)}`
  const stepFocus = useChartFocus(steps, {
    announce: stepLine,
  })
  const top = steps[0]
  const next = steps[1]
  const stepSeries: readonly Series<TestStep>[] = [
    {
      mark: 'bar',
      key: 'median',
      label: 'Median run',
      color: N89_SERIES.median,
      y: (s) => s.median,
      format: gb,
    },
    {
      mark: 'dot',
      key: 'peak',
      label: 'Highest run',
      color: N89_SERIES.peak,
      y: (s) => s.peak,
      format: gb,
    },
  ]

  // Clean-up counter by day
  const dayFocus = useChartFocus(days, {
    announce: (d) => `${dayText(d.day)}: ${d.released} released`,
  })
  const burst = days[days.length - 1]
  const zeroDays = days.filter((d) => d.released === 0)
  const firstZero = zeroDays[0]
  const lastZero = zeroDays[zeroDays.length - 1]
  const beforeGap = firstZero === undefined ? undefined : days[days.indexOf(firstZero) - 1]
  // cycle-expression-18: the kit clamps a domain but never picks the cap; found from the second-largest day here
  const ordered = days.map((d) => d.released).toSorted((a, b) => b - a)
  const dayCap =
    (ordered[0] ?? 0) > (ordered[1] ?? 0) * 2.5 ? Math.ceil((ordered[1] ?? 0) + 2) : Infinity
  const daySeries: readonly BarsSeries<CleanDay>[] = [
    {
      mark: 'bar',
      key: 'released',
      label: 'Holds',
      color: N89_SERIES.released,
      y: (d) => d.released,
      values: true,
    },
  ]

  return (
    <Page area="scenarios">
      <PageBar title="Factory waits, tests and clean-ups, last 30 days" />
      <CardGrid min="regular">
        <ChartCard
          title="Waits the factory adds"
          subtitle="Counted by verdict"
          info="Higher is better. Each wait is judged once it ends."
          phase={phaseOf(retryWaits, 'The queue gave no answer.')}
          empty={
            shotState === 'empty'
              ? { cause: 'No source added a wait. Check that the queue job ran.' }
              : null
          }
          height="tall"
          figure={
            ready
              ? {
                  value: pct(neededShare),
                  unit: 'judged needed',
                  delta: {
                    value: `${signed(sharePts)} pts`,
                    polarity: 'neutral',
                    label: `vs ${pct(scene.priorNeededShare)} prior period`,
                  },
                  period: sourceFocus.readout(
                    `${waitTotal} in all`,
                    (s) => `${s.name}: ${s.needed} of ${s.total}`,
                  ),
                  status: sourceFocus.readout(
                    {
                      tone: 'neutral',
                      label: lostLine(
                        sources.reduce((n, s) => n + s.notNeeded, 0),
                        lostMinutes,
                      ),
                    },
                    (s) => ({
                      tone: 'neutral',
                      label: lostLine(s.notNeeded, s.notNeededMinutes),
                    }),
                  ),
                }
              : { value: null, delta: NO_DELTA, period: '', status: { tone: 'neutral', label: '' } }
          }
          footer={[
            {
              label: 'Stopped',
              value: ready ? (stopped?.name ?? 'None') : '',
            },
            { label: 'Untimed', value: ready ? (unmeasured?.name ?? 'None') : '' },
          ]}
          chart={(box) => (
            <Bars
              label="Stacked verdicts per source"
              data={sources}
              height={box.height}
              focus={sourceFocus}
              tooltip={false}
              cursor="waits"
              x={{ value: (s) => s.name }}
              y={{ title: 'Waits' }}
              series={waitSeries}
            />
          )}
        />
        <ChartCard
          title="Heaviest test steps"
          subtitle="Ten steps, heaviest first"
          info="Memory of each step's runs. Lower is better."
          phase={phaseOf(retrySteps, 'The test runner timed out.')}
          empty={
            shotState === 'empty'
              ? { cause: 'No run reported memory. Open the log to see why.' }
              : null
          }
          height="tall"
          figure={
            ready && top !== undefined && next !== undefined
              ? {
                  value: top.peak,
                  unit: 'GB',
                  delta: {
                    value: `${signed(Math.round((top.peak - next.peak) * 10) / 10)} GB`,
                    polarity: 'neutral',
                    label: `vs ${gb(next.peak)} for ${next.name}`,
                  },
                  period: stepFocus.readout(top.name, stepLine),
                }
              : { value: null, delta: NO_DELTA, period: '' }
          }
          footer={[
            {
              label: 'Runs near the top',
              value: ready && top !== undefined ? `${top.nearPeak} of ${top.runs}` : '',
            },
            { label: 'Its median', value: ready && top !== undefined ? gb(top.median) : '' },
          ]}
          chart={(box) => (
            <CartesianChart
              label="Runs per step"
              data={steps}
              height={box.height}
              focus={stepFocus}
              tooltip={false}
              cursor="steps"
              x={{ value: (s) => s.name }}
              y={{
                title: 'Memory, GB',
                // cycle-expression-18: an auto domain ends at the largest dot, so it sits half cut at the top edge; headroom added by hand
                domain: ([lo, hi]) => [Math.min(lo, 0), Math.ceil(hi * 1.1)],
              }}
              series={stepSeries}
            />
          )}
        />
      </CardGrid>
      <CardGrid min="regular">
        <ChartCard
          title="Stale holds released per day"
          height="short"
          subtitle="Counted by the clean-up job"
          info="A day at zero means the job did not run."
          phase={phaseOf(retryDays, 'The counter did not respond.')}
          empty={
            shotState === 'empty' ? { cause: 'The counter has no reading. Restart the job.' } : null
          }
          figure={
            ready && burst !== undefined
              ? {
                  value: zeroDays.length,
                  unit: 'days at zero',
                  delta: {
                    value: signed(zeroDays.length),
                    polarity: 'neutral',
                    label: 'vs 0 in the days before',
                  },
                  period: dayFocus.readout(
                    firstZero === undefined || lastZero === undefined
                      ? 'No gap'
                      : `${dayText(firstZero.day)} to ${dayText(lastZero.day)}`,
                    (d) => `${dayText(d.day)}: ${d.released}`,
                  ),
                  periodMono: true,
                }
              : { value: null, delta: NO_DELTA, period: '', periodMono: true }
          }
          footer={[
            { label: 'Typical day', value: ready ? scene.typicalDay : '' },
            ready && beforeGap === undefined
              ? null
              : {
                  label: 'Last run before the gap',
                  value: ready && beforeGap !== undefined ? dayText(beforeGap.day) : '',
                  mono: true,
                },
          ]}
          chart={(box) => (
            <Bars
              label="Daily counter"
              data={days}
              height={box.height}
              focus={dayFocus}
              tooltip={false}
              cursor="days"
              x={{
                value: (d) => d.day,
                format: (x) => dayText(new Date(x)),
                // cycle-expression-18: no start, middle and end ticks for a day axis; the three dates are listed
                ticks: [days[0]?.day, days[14]?.day, burst?.day].flatMap((d) =>
                  d === undefined ? [] : [d],
                ),
              }}
              y={{
                title: 'Holds',
                domain: ([lo, hi]) => [Math.min(lo, 0), Math.min(Math.ceil(hi * 1.15), dayCap)],
              }}
              // cycle-expression-18: no zone from a run of zero values; the span is derived from the days at zero
              zones={
                firstZero === undefined || lastZero === undefined
                  ? []
                  : [
                      {
                        axis: 'x',
                        from: firstZero.day,
                        to: new Date(lastZero.day.getTime() + 86_400_000),
                        fill: alpha(BASALT.ink, 0.06),
                        label: 'No clean-up',
                      },
                    ]
              }
              series={daySeries}
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
