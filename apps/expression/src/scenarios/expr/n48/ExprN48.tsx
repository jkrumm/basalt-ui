import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import type { Delta, Phase } from 'basalt-ui/cards'
import { BarList, DataPanel } from 'basalt-ui/cards'
import { ChartCard, IntervalTrack, useChartFocus } from 'basalt-ui/charts'
import type { IntervalSeries } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import { TRAINING_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  DAY_MS,
  DAYS,
  MONTHS,
  SPORTS,
  START,
  WINTER_DAYS,
  buildYear,
  dateOf,
  isFixture,
  isWinterDay,
  longestBreak,
  monthOf,
  trainedDays,
} from './model'
import type { Activity } from './model'

const BREAK_ROW = 'Break'
const ROWS = [...SPORTS, BREAK_ROW]

type Kind = 'winter' | 'rest' | 'pause'
/** One mark of the track: a training day on its sport's row, or the longest break on its own row. */
type Span = {
  id: string
  row: string
  kind: Kind
  start: Date
  end: Date
  month: number
  activity: Activity | null
  breakDays: number
}

const SERIES: readonly IntervalSeries<Kind>[] = [
  { key: 'winter', label: 'Winter day (Dec to Feb)', color: TRAINING_SERIES.winter },
  { key: 'rest', label: 'Other day', color: TRAINING_SERIES.rest },
  { key: 'pause', label: 'Longest break', color: TRAINING_SERIES.pause, fill: 'outline' },
]

const EMPTY = {
  cause: 'No activities between Dec 1, 2024 and Nov 30, 2025. Sync your watch to see the year.',
}
const MONTH_TICKS = Array.from({ length: MONTHS }, (_, m) => {
  const d = dateOf(0)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1))
})
type Session = { id: string; date: string; sport: string; minutes: number; km: number | null }
const c = col<Session>()
const noop = (): void => undefined
const MINUS = '\u2212'

const spansOf = (acts: readonly Activity[]): Span[] => {
  const gap = longestBreak(acts)
  const spans = acts.map((a): Span => ({
    id: a.id,
    row: a.sport,
    kind: isWinterDay(a.day) ? 'winter' : 'rest',
    start: dateOf(a.day),
    end: dateOf(a.day + 1),
    month: monthOf(a.day),
    activity: a,
    breakDays: 0,
  }))
  if (gap === null || acts.length === 0) return spans
  const days = gap.to - gap.from + 1
  return [
    ...spans,
    {
      id: 'break',
      row: BREAK_ROW,
      kind: 'pause',
      start: dateOf(gap.from),
      end: dateOf(gap.to + 1),
      month: monthOf(gap.from),
      activity: null,
      breakDays: days,
    },
  ]
}

const length = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const monthName = (f: Format, m: number): string =>
  f.date(new Date(Date.UTC(2024, 11 + m, 1)), 'month')

function longest(acts: readonly Activity[]): string {
  const top = acts.reduce<Activity | null>(
    (a, b) => (a === null || b.minutes > a.minutes ? b : a),
    null,
  )
  return top === null ? '' : `${top.sport}, ${length(top.minutes)}`
}

const dayText = (f: Format, day: number): string => f.date(dateOf(day), 'short')

function detail(a: Activity): string {
  const km = a.km === null ? '' : `, ${a.km} km`
  return `${a.sport} ${length(a.minutes)}${km}`
}

function announce(f: Format, s: Span): string {
  if (s.activity === null)
    return `Break: ${s.breakDays} days, ${f.date(s.start, 'short')} to ${f.date(new Date(s.end.getTime() - DAY_MS), 'short')}`
  return `${dayText(f, s.activity.day)}, ${detail(s.activity)}`
}

/** The hero while an item or a month is held: the session, or the month's hours. */
function readout(f: Format, held: readonly Span[], s: Span): string {
  if (held.length > 1) {
    const acts = held.flatMap((h) => (h.activity === null ? [] : [h.activity]))
    return `${f.number(Math.round(acts.reduce((sum, a) => sum + a.minutes, 0) / 6) / 10, { maximumFractionDigits: 1 })} h in ${monthName(f, s.month)}`
  }
  return s.activity === null ? `${s.breakDays} days off` : detail(s.activity)
}

function when(f: Format, held: readonly Span[], s: Span): string {
  if (held.length > 1) return `${held.filter((h) => h.activity !== null).length} sessions`
  return s.activity === null ? 'longest break' : dayText(f, s.activity.day)
}

export function ExprN48Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const acts = shotState === 'empty' ? [] : buildYear(isFixture(fixture) ? fixture : undefined)
  const spans = spansOf(acts)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The activity feed did not respond.' }
        : 'ready'
  const ready = phase === 'ready' && acts.length > 0
  const empty = shotState === 'empty' ? EMPTY : null
  const emptyMonths = shotState === 'empty' ? { cause: 'No hours to total yet.' } : null
  const emptySessions = shotState === 'empty' ? { cause: 'No sessions to list yet.' } : null
  const focus = useChartFocus(spans, {
    announce: (s) => announce(f, s),
    announceSpan: (run) =>
      `${monthName(f, run[0]?.month ?? 0)}: ${run.filter((s) => s.activity).length} sessions`,
  })

  const months = Array.from({ length: MONTHS }, (_, m) => {
    const inMonth = acts.filter((a) => monthOf(a.day) === m)
    return {
      key: String(m),
      label: monthName(f, m),
      value: Math.round((inMonth.reduce((sum, a) => sum + a.minutes, 0) / 60) * 10) / 10,
      secondary: `${new Set(inMonth.map((a) => a.day)).size} days`,
    }
  })

  const sessions: Session[] = acts.map((a) => ({
    id: a.id,
    date: f.date(dateOf(a.day), 'short', { weekday: 'short', year: undefined }),
    sport: a.sport,
    minutes: a.minutes,
    km: a.km,
  }))
  const table = useDataTable({
    id: 'expr-n48-sessions',
    label: 'Sessions',
    columns: [
      c.entity('date', { header: 'Day', priority: 1, sortable: false, sub: (s) => s.sport }),
      c.number('minutes', { header: 'Minutes', priority: 1 }),
      c.number('km', { header: 'Distance, km', digits: 1, priority: 1 }),
    ],
    data: sessions,
    getRowId: (s) => s.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 8,
  })
  const winter = trainedDays(acts, true)
  const rest = trainedDays(acts, false)
  const gap =
    winter.of === 0 ? 0 : Math.round((winter.days / winter.of - rest.days / rest.of) * 100)
  const restDelta: Delta = {
    value: `${gap < 0 ? MINUS : '+'}${Math.abs(gap)} pts`,
    polarity: 'neutral',
    label: 'vs Mar to Nov',
  }
  const held = focus.span
  const figure = ready
    ? {
        value: focus.readout(`${winter.days} of ${WINTER_DAYS} days`, (s) => readout(f, held, s)),
        delta: focus.readout<Delta | undefined>(restDelta, () => undefined),
        period: focus.readout('trained Dec to Feb', (s) => when(f, held, s)),
      }
    : { value: null }
  const all = new Set(acts.map((a) => a.day)).size
  const doubles = all === 0 ? 0 : acts.length - all

  return (
    <Page area="expr-n48">
      <PageBar title="Training year, Dec 2024 to Nov 2025" />
      <div className="grid items-stretch gap-3 @wide:grid-cols-3">
        <div className="grid min-h-140 @wide:col-span-2">
          <ChartCard
            title="Training days by sport"
            subtitle={ready ? `${acts.length} sessions on ${all} of ${DAYS} days` : undefined}
            info="One mark per session on its sport's row; the hollow bar is the longest stretch without one."
            phase={phase}
            empty={empty}
            height="fill"
            figure={figure}
            footer={[
              { label: 'Two-a-days', value: ready ? doubles : '' },
              { label: 'Longest', value: ready ? longest(acts) : '' },
            ]}
            chart={(box) => (
              <IntervalTrack
                height={box.height}
                label="Training sessions by sport, Dec 2024 to Nov 2025"
                data={spans}
                rows={ROWS}
                getRow={(s) => s.row}
                getStart={(s) => s.start}
                getEnd={(s) => (s.kind === 'pause' ? s.end : null)}
                series={SERIES}
                getSeries={(s) => s.kind}
                getLabel={(s) => (s.kind === 'pause' ? `${s.breakDays} days off` : null)}
                xDomain={[new Date(START), new Date(START + DAYS * DAY_MS)]}
                xTicks={MONTH_TICKS}
                formatX={(x) => f.date(x, 'month', { month: 'short', year: undefined })}
                focus={focus}
                tooltip={false}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-3">
          <BarList
            title="Hours by month"
            subtitle="Time trained, Dec 2024 to Nov 2025"
            phase={phase}
            empty={emptyMonths}
            items={months}
            bodyRows={10}
            format={(h) => `${f.number(h, { maximumFractionDigits: 1 })} h`}
            focusItems={{ focus, holds: (row, s) => String(s.month) === row.key }}
          />
          <DataPanel
            title="Sessions"
            subtitle="Every session in date order"
            phase={phase}
            empty={emptySessions}
            bodySize={{ rows: 8 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                virtual={VirtualList}
                focusItems={{ focus, holds: (row, s) => s.id === row.id }}
              />
            )}
          />
        </div>
      </div>
    </Page>
  )
}
