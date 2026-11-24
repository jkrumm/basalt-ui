import { useFormat } from 'basalt-ui'
import { BarList, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Empty, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, Sparkline, useChartFocus } from 'basalt-ui/charts'
import type { LegendEntry } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { Pause, Server, Undo2 } from 'lucide-react'
import { N90_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { DEFAULT_BASELINE, KINDS, summarize, weekNamed } from './fixture'
import type { Kind, Sample, Step } from './fixture'

const HELD_DELTA: Delta = { value: '', polarity: 'neutral', label: '' }
const EMPTY: Empty = {
  cause: 'No step ran this week. Check back after the next test run.',
}
const KIND_LABEL: Record<Kind, string> = {
  remote: 'Remote',
  room: 'No room',
  faster: 'Faster local',
  free: 'Free local slot',
  held: 'Held',
}
const LEGEND: readonly LegendEntry[] = KINDS.map((k) => ({
  key: k,
  label: KIND_LABEL[k],
  color: N90_SERIES[k],
}))
const noop = (): void => undefined

const totalOf = (s: Step): number => KINDS.reduce((n, k) => n + s.counts[k], 0)
const shareOf = (s: Step): number => (totalOf(s) === 0 ? 1 : s.counts.remote / totalOf(s))
/** Most taken back first, a step that never ran last. */
const byTakeback = (a: Step, b: Step): number =>
  (totalOf(a) === 0 ? 2 : shareOf(a)) - (totalOf(b) === 0 ? 2 : shareOf(b))

const stateWord = (s: Step): { secondary?: string } =>
  totalOf(s) === 0 ? { secondary: 'never ran' } : s.counts.held > 0 ? { secondary: 'held' } : {}

export function ExprN90Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const week = weekNamed(fixture)
  const s = summarize(week)
  const ready = shotState === undefined
  const pending = (retry: () => void, message: string): Phase =>
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry, message }
        : 'ready'
  const runsPhase = pending(() => undefined, 'The run log is down.')
  const pressurePhase = pending(() => noop(), 'The probe is silent.')
  const holdPhase = pending(() => void 0, 'The hold record is missing.')
  const empty = shotState === 'empty' ? EMPTY : null

  const pct = (fraction: number): string => f.percent(fraction, { maximumFractionDigits: 0 })
  const stamp = (at: Date): string =>
    `${f.date(at, 'weekday')} ${f.time(at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
  const signed = (n: number, unit: string): string =>
    `${n < 0 ? '−' : '+'}${f.number(Math.abs(n))}${unit}`

  const roomText = (n: number): string => `${KIND_LABEL.room.toLowerCase()}: ${n}`
  const focus = useChartFocus(week.samples, {
    announce: (d) =>
      `${stamp(d.at)}: slots ${pct(d.pressure / 100)}, ${roomText(d.roomSteps.length)}`,
  })
  const over = week.samples.filter((d) => d.pressure > d.baseline).length
  const room36 = week.samples.reduce((n, d) => n + d.roomSteps.length, 0)
  const hold = week.hold
  const limitText = (n: number): string => `${f.number(n)} min`

  const days = week.days
  const share = days.map((d) => ({
    value: d.total === 0 ? null : (d.remote / d.total) * 100,
    at: d.at,
  }))
  const backDaily = days.map((d) => ({ value: d.back, at: d.at }))

  return (
    <Page area="expr-n90">
      <PageBar title="Remote test steps, last 7 days" />
      <StatGroup variant="cards" label="Run summary">
        <StatCell
          icon={Server}
          title="Stayed remote"
          value={ready ? pct(s.share) : null}
          unit={ready ? `of ${f.number(s.total)} runs` : ''}
          delta={
            ready
              ? {
                  value: signed(Math.round((s.share - s.priorShare) * 100), ' pts'),
                  polarity: 'neutral',
                  label: `vs ${pct(s.priorShare)} the week before`,
                }
              : HELD_DELTA
          }
          phase={runsPhase}
          empty={empty}
          chart={(box) => (
            <Sparkline
              points={share}
              height={box.height}
              label="Daily share kept"
              format={(v) => pct(v / 100)}
            />
          )}
        />
        <StatCell
          icon={Undo2}
          title="Taken back to local"
          value={ready ? s.back : null}
          unit={ready ? 'runs' : ''}
          delta={
            ready
              ? {
                  value: signed(s.back - s.priorBack, ''),
                  polarity: 'neutral',
                  label: `vs ${f.number(s.priorBack)} the week before`,
                }
              : HELD_DELTA
          }
          rows={[
            {
              label: KIND_LABEL.room,
              value: ready ? s.room : '',
              bar: { value: ready ? s.room : 0, max: Math.max(s.back, 1) },
            },
            {
              label: KIND_LABEL.faster,
              value: ready ? s.faster : '',
              bar: { value: ready ? s.faster : 0, max: Math.max(s.back, 1) },
            },
            {
              label: KIND_LABEL.free,
              value: ready ? s.free : '',
              bar: { value: ready ? s.free : 0, max: Math.max(s.back, 1) },
            },
          ]}
          phase={runsPhase}
          empty={empty}
          chart={(box) => <Sparkline points={backDaily} height={box.height} label="Daily count" />}
        />
        <StatCell
          icon={Pause}
          title="Held now"
          value={ready ? (hold?.minutes ?? 0) : null}
          unit={ready ? 'min' : ''}
          status={
            ready
              ? hold === null
                ? { tone: 'neutral', label: 'Nothing held' }
                : { tone: 'bad', label: 'Blocking' }
              : { tone: 'neutral', label: '' }
          }
          meter={{
            label: 'Time on hold',
            value: ready ? (hold?.minutes ?? 0) : null,
            max: hold?.limit ?? 60,
            format: () => `of ${limitText(hold?.limit ?? 60)} limit`,
          }}
          rows={[
            { label: 'Step', value: ready ? (hold?.step ?? '–') : '' },
            { label: 'Disagreements', value: ready ? (hold?.disagreements ?? 0) : '' },
          ]}
          phase={holdPhase}
          empty={empty}
        />
      </StatGroup>
      <CardGrid min="regular">
        <BarList
          title="Where steps ran"
          subtitle="Host and reason, lowest share first"
          phase={runsPhase}
          empty={empty}
          mono
          bodyRows={8}
          series={LEGEND}
          focusItems={{
            focus,
            holds: (row, d: Sample) => d.roomSteps.includes(row.key ?? ''),
          }}
          items={[...week.steps].sort(byTakeback).map((step) => ({
            key: step.id,
            label: step.id,
            value: totalOf(step),
            parts: step.counts,
            // cycle-expression-18: BarListItem.secondary takes no maybe-value, so an absent word is a conditional spread
            ...stateWord(step),
          }))}
        />
        <ChartCard
          title="Slot pressure"
          subtitle="240 samples over 36 hours"
          phase={pressurePhase}
          empty={empty}
          height="auto"
          figure={
            ready
              ? {
                  value: pct(s.peak / 100),
                  unit: 'at the peak',
                  delta: {
                    value: signed(s.peak - s.baseline, ' pts'),
                    polarity: 'neutral',
                    label: `vs ${pct(s.baseline / 100)} baseline`,
                  },
                  period: focus.readout(stamp(s.peakAt), (d) => stamp(d.at)),
                  periodMono: true,
                  status: focus.readout({ tone: 'neutral', label: roomText(room36) }, (d) => ({
                    tone: 'neutral',
                    label: `${pct(d.pressure / 100)} busy, ${roomText(d.roomSteps.length)}`,
                  })),
                }
              : {
                  value: null,
                  delta: HELD_DELTA,
                  period: '',
                  periodMono: true,
                  status: { tone: 'neutral', label: '' },
                }
          }
          footer={[
            {
              label: 'Over baseline',
              value: ready ? `${over} of ${week.samples.length}` : '',
            },
          ]}
          chart={(box) => (
            <CartesianChart
              label="Pressure with no-room runs"
              data={week.samples}
              height={box.height}
              focus={focus}
              tooltip={false}
              x={{ value: (d) => d.at, format: (x) => stamp(new Date(x)) }}
              y={{ title: '% of slots busy', domain: [0, 100] }}
              zones={[
                {
                  axis: 'x',
                  from: week.samples[0]?.at ?? week.defaultUntil,
                  to: week.defaultUntil,
                  fill: alpha(BASALT.inkMuted, 0.1),
                  label: `Default ${pct(DEFAULT_BASELINE / 100)}`,
                },
              ]}
              series={[
                {
                  mark: 'line',
                  key: 'pressure',
                  label: 'Pressure',
                  color: N90_SERIES.pressure,
                  y: (d) => d.pressure,
                },
                {
                  mark: 'line',
                  key: 'baseline',
                  label: 'Baseline',
                  color: N90_SERIES.baseline,
                  dash: true,
                  y: (d) => d.baseline,
                },
                {
                  mark: 'dot',
                  key: 'room',
                  label: KIND_LABEL.room,
                  color: N90_SERIES.room,
                  y: (d) => (d.roomSteps.length > 0 ? d.pressure : null),
                },
              ]}
            />
          )}
        />
      </CardGrid>
      {focus.live}
    </Page>
  )
}
