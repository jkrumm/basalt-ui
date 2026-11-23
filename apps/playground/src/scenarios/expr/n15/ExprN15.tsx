/**
 * Desk walks. Viewer: someone who walks at a desk pad and opens this once a week.
 * Question: did I walk enough this week, and is my pace getting better?
 * Design tables: design.md.
 */
import { useFormat } from 'basalt-ui'
import type { Delta, Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { DataPanel } from 'basalt-ui/cards'
import { Bars, CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { WALK_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { buildPad, isFixtureName, medianPace } from './fixture'
import type { Walk, Week } from './fixture'

const MINUS = '\u2212'
const DAY_MS = 86_400_000
/** The minutes axis stops here; a longer week is the kit's off-scale caret with its true value. */
const MINUTES_CAP = 300
/** The pace axis stops here (8:30 per km); a stroll is the kit's off-scale caret. */
const PACE_CAP = 510
const PACE_STEP = 30
const RECENT_FROM = 4

const NO_WALKS: Empty = { cause: 'No walks logged yet. Log a walk and the week fills in.' }

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '0')

const c = col<Walk>()

export function ExprN15Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const pad = buildPad(isFixtureName(fixture) ? fixture : undefined)
  const walks = shotState === 'empty' ? [] : pad.walks
  const weeks = shotState === 'empty' ? [] : pad.weeks
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The pad did not answer.', retry: () => undefined }
        : 'ready'
  const ready = phase === 'ready' && walks.length > 0
  const empty = walks.length === 0 ? NO_WALKS : null

  const pace = (sec: number): string => f.duration(sec * 1000)
  const slotName = (w: Walk): string => (w.slot === 'am' ? 'morning' : 'evening')

  const weekFocus = useChartFocus(weeks, {
    announce: (w) =>
      `${w.key}${w.partial ? ' so far' : ''}: ${w.minutes} min, ${w.walks} walks, ${f.number(w.km)} km`,
  })
  const paceFocus = useChartFocus(walks, {
    announce: (w) =>
      `${f.date(w.at, 'weekday')} ${f.date(w.at, 'short')}, ${slotName(w)}: ${pace(w.paceSec)} per km, ${w.minutes} min, ${f.number(w.km)} km, ${w.kcal} kcal`,
  })

  const table = useDataTable({
    id: 'n15-walks',
    label: 'Walks',
    columns: [
      c.date('at', { header: 'Date', priority: 1 }),
      c.text('slot', { header: 'Walk', labels: { am: 'Morning', pm: 'Evening' }, priority: 3 }),
      c.number('minutes', { header: 'Duration', unit: 'min', priority: 2 }),
      c.number('km', { header: 'Distance', unit: 'km', digits: 1, priority: 3 }),
      // owner-review-1: no kind column prints a pace as min:ss per km, so the one counted escape draws it
      c.custom('pace', {
        header: 'Pace, min/km',
        render: (w) => pace(w.paceSec),
        sortValue: (w) => w.paceSec,
        card: 'value',
        priority: 1,
      }),
      c.number('kcal', { header: 'Energy', unit: 'kcal', priority: 3 }),
    ],
    data: [...walks].reverse(),
    getRowId: (w) => w.id,
    mode: { kind: 'client' },
    phase,
    empty,
    bodyRows: 8,
  })

  const current = weeks.at(-1)
  const recent = walks.filter((w) => w.week >= RECENT_FROM)
  const before = walks.filter((w) => w.week < RECENT_FROM)
  const recentPace = recent.length > 0 ? medianPace(recent) : null
  const beforePace = before.length > 0 ? medianPace(before) : null

  const minutesDelta = (w: Week): Delta => {
    const base = w.partial ? pad.due : pad.target
    const diff = w.minutes - base
    return {
      value: `${signed(diff)} min`,
      polarity: w.minutes === 0 || diff === 0 ? 'neutral' : 'up-good',
      label: w.partial
        ? `vs ${pad.due} due by ${f.date(pad.until - DAY_MS / 2, 'weekday')}`
        : `vs ${pad.target} target`,
    }
  }
  const paceDelta: Delta | undefined =
    recentPace === null || beforePace === null
      ? undefined
      : {
          value: `${signed(recentPace - beforePace)} s`,
          polarity: recentPace === beforePace ? 'neutral' : 'up-bad',
          label: `vs ${weeks[0]?.key}\u2013${weeks[RECENT_FROM - 1]?.key}`,
        }
  const sessionDelta = (w: Walk): Delta => ({
    value: `${signed(w.paceSec - w.weekPace)} s`,
    polarity: w.paceSec === w.weekPace ? 'neutral' : 'up-bad',
    label: 'vs its week',
  })

  const completeWeeks = weeks.filter((w) => !w.partial)
  const onTarget = completeWeeks.filter((w) => w.minutes >= pad.target).length
  const minutesFooter: FootFacts = [
    { label: 'Weeks on target', value: ready ? `${onTarget} of ${completeWeeks.length}` : '' },
    { label: 'Two-walk days', value: ready ? weeks.reduce((sum, w) => sum + w.doubles, 0) : '' },
  ]
  const km = recent.reduce((sum, w) => sum + w.km, 0)
  const kcal = recent.reduce((sum, w) => sum + w.kcal, 0)
  const paceFooter: FootFacts = [
    {
      label: 'Distance',
      value: ready
        ? paceFocus.readout(
            `${f.number(km, { maximumFractionDigits: 1 })} km`,
            (w) => `${f.number(w.km)} km`,
          )
        : '',
    },
    {
      label: 'Energy',
      value: ready
        ? paceFocus.readout(`${f.number(kcal)} kcal`, (w) => `${f.number(w.kcal)} kcal`)
        : '',
    },
  ]

  return (
    <Page area="expr-n15">
      <PageBar title="Walking, last 8 weeks" />
      <div className="grid gap-4 @wide:grid-cols-2">
        <ChartCard
          title="Minutes per week"
          subtitle="Time on foot, Monday to Sunday"
          phase={phase}
          empty={empty}
          height="tall"
          figure={
            ready && current
              ? {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n15, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: weekFocus.readout(current.minutes, (w) => w.minutes),
                  unit: 'min',
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n15, kept as its builder left it: its figure follows focus, built before figure-readout
                  delta: weekFocus.readout(minutesDelta(current), minutesDelta),
                  period: weekFocus.readout(`${current.key} so far`, (w) =>
                    w.partial ? `${w.key} so far` : w.key,
                  ),
                }
              : { value: null }
          }
          footer={minutesFooter}
          chart={() => (
            <Bars
              label="Minutes walked in each of the last 8 weeks against the weekly target"
              data={weeks}
              focus={weekFocus}
              tooltip={false}
              cursor="n15-weeks"
              x={{ value: (w) => w.key }}
              y={{
                title: 'Minutes',
                domain: ([, hi]) => [
                  0,
                  Math.min(Math.max(hi * 1.1, pad.target * 1.2), MINUTES_CAP),
                ],
              }}
              refLines={[
                {
                  value: pad.target,
                  color: WALK_SERIES.target,
                  dashed: true,
                  label: `Target ${pad.target} min`,
                },
              ]}
              series={[
                {
                  mark: 'bar',
                  key: 'minutes',
                  label: 'Minutes',
                  color: WALK_SERIES.minutes,
                  legend: false,
                  y: (w) => w.minutes,
                  values: true,
                  highlight: (w) => w.current,
                  opacity: (w) => (w.partial ? 0.6 : 1),
                },
              ]}
            />
          )}
        />
        <ChartCard
          title="Pace per walk"
          subtitle="Each walk, lower is faster"
          phase={phase}
          empty={empty}
          height="tall"
          figure={
            ready && recentPace !== null
              ? {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n15, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: paceFocus.readout(pace(recentPace), (w) => pace(w.paceSec)),
                  unit: '/km',
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n15, kept as its builder left it: its figure follows focus, built before figure-readout
                  delta: paceFocus.readout(paceDelta, sessionDelta),
                  period: paceFocus.readout(
                    'last 4 weeks',
                    (w) => `${f.date(w.at, 'weekday')} ${f.date(w.at, 'short')}, ${slotName(w)}`,
                  ),
                }
              : { value: null }
          }
          footer={paceFooter}
          chart={() => (
            <CartesianChart
              label="Pace of each walk in the last 8 weeks, with the weekly median"
              data={walks}
              focus={paceFocus}
              tooltip={false}
              cursor="n15-pace"
              x={{
                value: (w) => w.at,
                domain: [pad.from, pad.until],
                ticks: weeks.map((w) => w.start),
                format: (x) =>
                  typeof x === 'string' ? x : f.date(x, 'short', { year: undefined }),
              }}
              y={{
                title: 'Pace, min/km',
                domain: ([lo, hi]) => [
                  Math.floor(lo / PACE_STEP) * PACE_STEP,
                  Math.min(Math.ceil(hi / PACE_STEP) * PACE_STEP, PACE_CAP),
                ],
                format: pace,
              }}
              series={[
                {
                  mark: 'dot',
                  key: 'earlier',
                  label: 'Earlier walks',
                  color: WALK_SERIES.earlier,
                  y: (w) => (w.current ? null : w.paceSec),
                  format: pace,
                },
                {
                  mark: 'dot',
                  key: 'now',
                  label: 'This week',
                  color: WALK_SERIES.now,
                  y: (w) => (w.current ? w.paceSec : null),
                  format: pace,
                },
                {
                  mark: 'line',
                  key: 'median',
                  label: 'Weekly median',
                  color: WALK_SERIES.median,
                  y: (w) => (w.anchor ? w.weekPace : null),
                  gaps: 'connect',
                  format: pace,
                },
              ]}
            />
          )}
        />
      </div>
      <DataPanel
        title="Walks"
        subtitle="Newest first, joined to the pace chart"
        phase={phase}
        empty={empty}
        bodySize={{ height: 320 }}
        body={() => <DataTable table={table} focus={paceFocus} height="fill" />}
      />
    </Page>
  )
}
