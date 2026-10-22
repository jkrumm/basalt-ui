/** The Estimated 1RM ChartCard whose subtitle carries the line/dot key (argo UPSTREAM Wave 50). */
import { Box } from '@mantine/core'
import { ChartCard, Lines } from 'basalt-ui/charts'
import type { ChartSeries } from 'basalt-ui/charts'
import { demoColors } from '../../demo/series'
import { chartStateFor, noop } from '../shot-state'
import type { ScenarioProps } from '../shot-state'

type Row = { day: Date; e1rm: number[]; avg: number[]; pr: boolean[] }

const LIFTS = [
  { key: 'squat', label: 'Squat', color: demoColors.sessions, base: 128, step: 2.6 },
  { key: 'bench', label: 'Bench press', color: demoColors.signups, base: 92, step: 1.4 },
  { key: 'deadlift', label: 'Deadlift', color: demoColors.revenue, base: 152, step: 3.1 },
] as const

const WEEKS = 16
const START = Date.UTC(2026, 6, 6)
const WEEK_MS = 7 * 24 * 3600 * 1000

/** Invented estimates: a steady climb with a deterministic wobble; a PR is any new running best. */
const DATA: Row[] = Array.from({ length: WEEKS }, (_, w) => {
  const e1rm = LIFTS.map((l, i) => l.base + l.step * w + Math.sin(w * 1.7 + i * 2.1) * 3)
  const avg = LIFTS.map((l, i) => l.base + l.step * Math.max(0, w - 1.5) + i * 0.4)
  const pr = e1rm.map((v, i) => isNewBest(i, w, v))
  return { day: new Date(START + w * WEEK_MS), e1rm, avg, pr }
})

function isNewBest(lift: number, week: number, value: number): boolean {
  if (week === 0) return false
  for (let w = 0; w < week; w += 1) {
    const l = LIFTS[lift]
    if (l === undefined) return false
    const prior = l.base + l.step * w + Math.sin(w * 1.7 + lift * 2.1) * 3
    if (prior >= value) return false
  }
  return true
}

const SERIES: ChartSeries<Row>[] = LIFTS.flatMap((l, i) => [
  {
    key: l.key,
    label: l.label,
    color: l.color,
    getValue: (d: Row) => d.e1rm[i] ?? null,
    formatValue: (v: number) => `${Math.round(v)} kg`,
    getMarker: (d: Row) => (d.pr[i] === true ? { r: 3.5 } : null),
  },
  {
    key: `${l.key}-avg`,
    label: '30 d average',
    color: l.color,
    dash: 'dashed' as const,
    strokeOpacity: 0.5,
    legend: false,
    tooltip: false,
    parent: l.key,
    getValue: (d: Row) => d.avg[i] ?? null,
  },
])

const HEIGHT = 280
const EMPTY = 'No estimated 1RM in this window'

export function BodyE1rmCard({ shotState }: ScenarioProps) {
  return (
    <Box data-shot="e1rm">
      <ChartCard
        title="Estimated 1RM"
        info="Epley estimate from each lift's best set of the week."
        subtitle="Dashed line: 30 d average · dot: new PR"
        state={chartStateFor(shotState, {
          empty: EMPTY,
          error: 'The strength log did not answer. Retry, or reconnect it in Settings.',
        })}
        {...(shotState === 'error' && { onRetry: noop })}
        placeholderHeight={HEIGHT}
      >
        <Lines<Row, Date>
          ariaLabel="Estimated 1RM trend per lift"
          data={DATA}
          height={HEIGHT}
          x={(d) => d.day}
          series={SERIES}
          y={{ domain: [60, 220], format: (v) => `${Math.round(v)} kg` }}
        />
      </ChartCard>
    </Box>
  )
}
