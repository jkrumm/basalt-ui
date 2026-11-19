import { createFileRoute } from '@tanstack/react-router'
import { useFormat } from 'basalt-ui'
import type { Phase } from 'basalt-ui/cards'
import { ChartCard, IntervalTrack, useChartFocus } from 'basalt-ui/charts'
import type { IntervalSeries } from 'basalt-ui/charts'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { CALENDAR_SERIES } from '../../demo/series'
import { AXIS, WORKDAYS, buildWeek, eventsFor } from '../../demo/calendar-week'
import { validateShotSearch } from '../../scenarios/shot-state'

/** One span of the week: an event, or a day's longest free block, as times on one shared day. */
type Span = {
  id: string
  day: string
  start: Date
  end: Date
  title: string
  kind: 'meeting' | 'focus' | 'personal' | 'declined' | 'free'
  when: string
}

const SERIES: readonly IntervalSeries<Span['kind']>[] = [
  { key: 'meeting', label: 'Meeting', color: CALENDAR_SERIES.meeting },
  { key: 'focus', label: 'Focus', color: CALENDAR_SERIES.focus },
  { key: 'personal', label: 'Personal', color: CALENDAR_SERIES.personal },
  { key: 'declined', label: 'Declined', color: CALENDAR_SERIES.declined, fill: 'outline' },
  {
    key: 'free',
    label: 'Longest free block',
    color: { light: BASALT.brand, dark: BASALT.brand },
    fill: 'outline',
    layer: 'back',
  },
]

const dayKey = (i: number): string => {
  const d = WORKDAYS[i]
  return d === undefined ? '' : `${d.name} ${d.date}`
}
const ROWS = WORKDAYS.map((_, i) => dayKey(i))
const noop = (): void => undefined
/** Minutes since midnight as a time on one shared (UTC) day, so the axis ticks whole hours. */
const at = (min: number): Date => new Date(Date.UTC(2026, 10, 23, 0, min))
const DOMAIN = [at(AXIS[0]), at(AXIS[1])] as const
const c = col<Span>()

export const Route = createFileRoute('/kit/interval-track')({
  staticData: { title: 'Interval track' },
  validateSearch: validateShotSearch,
  component: IntervalTrackRoute,
})

const length = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/**
 * The calendar week of n35's first build (its model kept in `demo/calendar-week.ts`, apart from the
 * rebuilt n35) drawn by the shipped `IntervalTrack`: no hand-drawn mark, no fixed width, no waiver.
 * The track and the table share one focus.
 */
function IntervalTrackRoute(): ReactElement {
  const search = Route.useSearch()
  const shotState = search['shot-state']
  const f = useFormat()
  const time = (d: Date): string =>
    f.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
  const clock = (min: number): string => time(at(min))
  const week = buildWeek(shotState === 'empty' ? [] : eventsFor(search.fixture))
  const spans: Span[] = week.days.flatMap((d) => [
    ...d.events.map((e): Span => ({
      id: e.id,
      day: dayKey(d.index),
      start: at(e.start),
      end: at(e.end),
      title: e.title,
      kind: e.declined ? 'declined' : e.kind,
      when: `${clock(e.start)} to ${clock(e.end)}`,
    })),
    ...(d.longest && d.events.length > 0
      ? [
          {
            id: `free-${d.index}`,
            day: dayKey(d.index),
            start: at(d.longest.from),
            end: at(d.longest.to),
            title: `${length(d.longest.to - d.longest.from)} free`,
            kind: 'free' as const,
            when: `${clock(d.longest.from)} to ${clock(d.longest.to)}`,
          },
        ]
      : []),
  ])
  const focus = useChartFocus(spans, {
    announce: (s) => `${s.day}, ${s.title}: ${s.when}`,
  })
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The calendar did not respond.' }
        : 'ready'
  const ready = phase === 'ready' && spans.length > 0
  const longest = week.longestDay?.longest
  const table = useDataTable({
    id: 'kit-interval-track',
    label: 'Events this week',
    columns: [
      c.entity('title', { header: 'Event', sub: (s) => s.day }),
      c.text('when', { header: 'When' }),
      c.text('kind', {
        header: 'Kind',
        labels: Object.fromEntries(SERIES.map((s) => [s.key, s.label])),
      }),
    ],
    data: spans,
    getRowId: (s) => s.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: spans.length,
  })
  return (
    <Page area="kit-interval-track">
      <PageBar title="Workweek, Nov 23 to 27" />
      <ChartCard
        title="Booked time by workday"
        info="Accepted events inside working hours; the outlined span is each day's longest free block."
        phase={phase}
        empty={
          shotState === 'empty'
            ? { cause: 'No events found for Nov 23 to 27. Connect a calendar to see booked time.' }
            : null
        }
        figure={
          ready
            ? {
                value: longest ? `${length(longest.to - longest.from)} free` : '0 min free',
                period: focus.readout(
                  longest && week.longestDay
                    ? `${dayKey(week.longestDay.index)} ${clock(longest.from)} to ${clock(longest.to)}, longest block`
                    : 'No block is free',
                  (s) => `${s.day} ${s.when}, ${s.title}`,
                ),
                periodMono: true,
              }
            : { value: null }
        }
        chart={(box) => (
          <IntervalTrack
            height={box.height}
            label="Events by workday, 09:00 to 18:00"
            data={spans}
            rows={ROWS}
            getRow={(s) => s.day}
            getStart={(s) => s.start}
            getEnd={(s) => s.end}
            series={SERIES}
            getSeries={(s) => s.kind}
            getLabel={(s) => s.title}
            rowExtent={(row) => {
              const d = WORKDAYS[ROWS.indexOf(row)]
              return d === undefined ? null : [at(d.open), at(d.close)]
            }}
            xDomain={DOMAIN}
            formatX={time}
            focus={focus}
            tooltip={false}
          />
        )}
      />
      <Section title="Events">
        <div data-shot="events">
          <DataTable table={table} focus={focus} />
        </div>
      </Section>
    </Page>
  )
}
