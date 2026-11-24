import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { ChartCard, IntervalTrack, useChartFocus } from 'basalt-ui/charts'
import type { IntervalSeries } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { OUTAGE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { CYCLES_EXPECTED, CYCLES_PER_DAY, DAYS, DAY_MIN, WEEK_MIN, lineWeek } from './fixture'
import type { Scope } from './fixture'

type Kind = Scope | 'ongoing' | 'hole'

/** One span on the track: an outage cut at midnight, or the hole with no measurements. */
type Span = {
  id: string
  outageId: string | null
  day: string
  dayIndex: number
  start: Date
  end: Date
  kind: Kind
  minutes: number
}

type OutageRow = { id: string; start: string; end: string; scope: string; minutes: number }
type DayRow = { id: string; day: string; down: number; recorded: number; lossy: number }

const SERIES: readonly IntervalSeries<Kind>[] = [
  { key: 'internet', label: 'Internet', color: OUTAGE_SERIES.internet },
  { key: 'gateway', label: 'Gateway', color: OUTAGE_SERIES.gateway },
  { key: 'ongoing', label: 'Ongoing', color: OUTAGE_SERIES.ongoing },
  { key: 'hole', label: 'Not measured', color: OUTAGE_SERIES.hole, fill: 'outline' },
]

const SCOPE_LABEL: Record<Scope, string> = { gateway: 'Gateway', internet: 'Internet' }
const outageCols = col<OutageRow>()
const dayCols = col<DayRow>()
const DOWN = 'Down, min'
const noop = (): void => undefined

/** Minutes from 12 Nov 00:00 UTC as a time; a minute of the day on the track's one shared day is the same call. */
const at = (min: number): Date => new Date(Date.UTC(2026, 10, 12, 0, min))

const length = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function ExprN60Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const week = lineWeek(fixture)
  const empty = shotState === 'empty'
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The log did not answer.' }
        : 'ready'
  const ready = phase === 'ready' && !empty

  const clock = (min: number): string =>
    f.time(at(min), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
  const dayName = (index: number): string =>
    f.date(at(index * DAY_MIN), 'short', { timeZone: 'UTC', year: undefined, weekday: 'short' })

  const spans: Span[] = empty
    ? []
    : [
        ...week.outages.flatMap((o) => {
          const kind: Kind = o.end === null ? 'ongoing' : o.scope
          const to = o.end ?? WEEK_MIN
          const first = Math.floor(o.start / DAY_MIN)
          const last = Math.floor((to - 1) / DAY_MIN)
          return Array.from({ length: last - first + 1 }, (_, i): Span => {
            const dayIndex = first + i
            const from = Math.max(o.start, dayIndex * DAY_MIN)
            const until = Math.min(to, (dayIndex + 1) * DAY_MIN)
            return {
              id: `${o.id}-${dayIndex}`,
              outageId: o.id,
              day: dayName(dayIndex),
              dayIndex,
              start: at(from - dayIndex * DAY_MIN),
              end: at(until - dayIndex * DAY_MIN),
              kind,
              minutes: until - from,
            }
          })
        }),
        ...(week.hole
          ? [
              {
                id: 'hole',
                outageId: null,
                day: dayName(Math.floor(week.hole.start / DAY_MIN)),
                dayIndex: Math.floor(week.hole.start / DAY_MIN),
                start: at(week.hole.start % DAY_MIN),
                end: at(week.hole.end % DAY_MIN),
                kind: 'hole' as const,
                minutes: week.hole.end - week.hole.start,
              },
            ]
          : []),
      ].sort((a, b) => a.dayIndex - b.dayIndex || a.start.getTime() - b.start.getTime())

  const rows = Array.from({ length: DAYS }, (_, i) => dayName(i))
  const downMinutes = week.days.reduce((sum, d) => sum + d.down, 0)
  const recorded = week.days.reduce((sum, d) => sum + d.recorded, 0)
  const panelRows = Math.max(week.outages.length, DAYS) + 2
  const outageEmpty = empty
    ? { cause: 'No outage to list: the week has no cycles.' }
    : week.outages.length === 0
      ? { cause: 'No outage this week. A new one will be listed here.' }
      : null
  const ongoing = week.outages.filter((o) => o.end === null).length
  const share = (fraction: number): string => f.percent(fraction, { maximumFractionDigits: 1 })

  const spanText = (s: Span): string => {
    if (s.kind === 'hole') return `Not measured, ${length(s.minutes)}`
    const outage = week.outages.find((o) => o.id === s.outageId)
    const scope = SCOPE_LABEL[outage?.scope ?? 'internet']
    return s.kind === 'ongoing' ? `${scope}, ongoing` : `${scope}, ${length(s.minutes)}`
  }
  const spanLabel = (s: Span): string | null => (s.minutes >= 40 ? spanText(s) : null)

  const focus = useChartFocus(spans, {
    announce: (s) =>
      `${s.day}: ${spanText(s)}, ${clock(s.start.getUTCHours() * 60 + s.start.getUTCMinutes())} to ${clock(s.end.getUTCHours() * 60 + s.end.getUTCMinutes())}`,
  })

  const outageRows: OutageRow[] = empty
    ? []
    : week.outages.map((o) => ({
        id: o.id,
        start: `${f.date(at(o.start), 'short', { timeZone: 'UTC', year: undefined })} ${clock(o.start)}`,
        // cycle-expression-13: an entity column is one face for every row, so the open outage's end is the word in the time face; no kind draws "a time, or ongoing".
        end: o.end === null ? 'ongoing' : `to ${clock(o.end)}`,
        scope: SCOPE_LABEL[o.scope],
        minutes: (o.end ?? WEEK_MIN) - o.start,
      }))
  const dayRows: DayRow[] = empty
    ? []
    : week.days.map((d) => ({
        id: `d${d.index}`,
        day: dayName(d.index),
        down: d.down,
        recorded: d.recorded,
        lossy: d.lossy,
      }))

  const outageTable = useDataTable({
    id: 'expr-n60-outages',
    label: 'Each outage',
    columns: [
      outageCols.entity('start', { header: 'Start', mono: true, sub: (o) => o.end, subMono: true }),
      outageCols.text('scope', { header: 'Scope', priority: 2 }),
      outageCols.meter('minutes', {
        header: DOWN,
        card: 'value',
        max: Math.max(1, ...outageRows.map((o) => o.minutes)),
        priority: 2,
      }),
    ],
    data: outageRows,
    getRowId: (o) => o.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: week.outages.length,
  })
  const dayTable = useDataTable({
    id: 'expr-n60-days',
    label: 'Daily counts',
    columns: [
      dayCols.entity('day', { header: 'Day', mono: true }),
      dayCols.meter('recorded', {
        header: 'Recorded',
        max: CYCLES_PER_DAY,
        priority: 2,
        card: 'value',
      }),
      dayCols.number('lossy', { header: 'Lossy cycles', footer: 'sum', priority: 2 }),
    ],
    data: dayRows,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: DAYS,
  })

  return (
    <Page area="expr-n60">
      <PageBar title="Home line, 12 to 18 Nov" />
      <ChartCard
        title="Time down by day"
        subtitle="Times in UTC"
        height="tall"
        phase={phase}
        empty={
          empty ? { cause: 'No cycles recorded this week. Start the probe to measure it.' } : null
        }
        figure={
          ready
            ? {
                value: length(downMinutes),
                period: focus.readout(
                  `${share(downMinutes / WEEK_MIN)} of 168 h`,
                  (s) => `${s.day}, ${spanText(s)}`,
                ),
                status:
                  ongoing > 0
                    ? { tone: 'bad', label: `${ongoing} ongoing` }
                    : { tone: 'neutral', label: 'No outage' },
              }
            : { value: null }
        }
        footer={
          ready
            ? [
                { label: 'Outages', value: week.outages.length },
                { label: 'Measured', value: share(recorded / CYCLES_EXPECTED) },
              ]
            : [
                { label: 'Outages', value: '' },
                { label: 'Measured', value: '' },
              ]
        }
        chart={(box) => (
          <IntervalTrack
            height={box.height}
            label="Spans on a 24 hour axis, one row per day"
            data={spans}
            rows={rows}
            getRow={(s) => s.day}
            getStart={(s) => s.start}
            getEnd={(s) => s.end}
            series={SERIES}
            getSeries={(s) => s.kind}
            getLabel={spanLabel}
            getPriority={(s) => (s.kind === 'ongoing' || s.kind === 'hole' ? 2 : 1)}
            // cycle-expression-13: a track with no spans draws bare rows; the measured band behind each row is the zero cue.
            rowExtent={week.outages.length === 0 ? () => [at(0), at(DAY_MIN)] : undefined}
            xDomain={[at(0), at(DAY_MIN)]}
            xTicks={[at(0), at(360), at(720), at(1080), at(DAY_MIN)]}
            formatX={(x) =>
              f.time(x, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
            }
            focus={focus}
            tooltip={false}
            empty={null}
          />
        )}
      />
      <CardGrid min="regular">
        <DataPanel
          title="Outages"
          subtitle="Gateway is the home router, internet the provider"
          phase={phase}
          empty={outageEmpty}
          bodySize={{ rows: panelRows }}
          body={() => (
            <DataTable
              table={outageTable}
              height="fill"
              focusItems={{ focus, holds: (o, s) => s.outageId === o.id }}
            />
          )}
        />
        <DataPanel
          title="Cycles by day"
          subtitle="One cycle every 30 seconds, 2,880 a day"
          info="A lossy cycle lost 20% or more of its probes."
          phase={phase}
          empty={empty ? { cause: 'No count per day: nothing was recorded.' } : null}
          bodySize={{ rows: panelRows }}
          body={() => (
            <DataTable
              table={dayTable}
              height="fill"
              focusItems={{ focus, holds: (d, s) => s.dayIndex === Number(d.id.slice(1)) }}
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
