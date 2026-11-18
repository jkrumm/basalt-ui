import type { CSSProperties } from 'react'
import type { Phase } from 'basalt-ui/cards'
import { ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartFocusItem, LegendEntry, TrackAxis } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { useFormat } from 'basalt-ui'
import type { ScenarioProps } from '../../shot-state'
import { AXIS, buildWeek, eventsFor } from './model'
import type { Block, CalEvent, DayStat, Kind } from './model'

const SHARE = 0.7 // the track's share of the card's width: the day label and the percent column take the rest

const KIND: Record<Kind, { bar: string; ink: string }> = {
  meeting: { bar: 'bg-foreground', ink: 'data-[spot=inside]:text-primary-foreground' },
  focus: { bar: 'bg-muted-foreground', ink: 'data-[spot=inside]:text-primary-foreground' },
  personal: { bar: 'bg-faint', ink: 'data-[spot=inside]:text-foreground' },
}
const DECLINED = {
  // oxlint-disable-next-line basalt/tw-off-law -- cycle-expression-9: a declined event is a hollow dashed span and the kit has no such mark
  bar: 'border border-dashed border-line',
  ink: 'data-[spot=inside]:text-muted-foreground',
}

const LEGEND: readonly LegendEntry[] = [
  {
    key: 'meeting',
    label: 'Meeting',
    color: { light: BASALT.ink, dark: BASALT.ink },
    swatch: 'bar',
  },
  {
    key: 'focus',
    label: 'Focus',
    color: { light: BASALT.inkMuted, dark: BASALT.inkMuted },
    swatch: 'bar',
  },
  {
    key: 'personal',
    label: 'Personal',
    color: { light: BASALT.inkFaint, dark: BASALT.inkFaint },
    swatch: 'bar',
  },
  {
    key: 'declined',
    label: 'Declined',
    color: { light: BASALT.line, dark: BASALT.line },
    swatch: 'hollow',
  },
  {
    key: 'free',
    label: 'Longest free block',
    color: { light: BASALT.brand, dark: BASALT.brand },
    swatch: 'hollow',
  },
]

// cycle-expression-9: the row places labels at the narrowest track, which drops nearly every title; titles are placed for a wide track and hidden below @wide
const WIDE_LABELS = 900
const DASH = '—'
const noop = (): void => undefined

// cycle-expression-9: the kit has no hours-and-minutes duration (`duration` is a clock form), so this is hand-written
const span = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** A bar on a track, sized from data as shares of the track. */
function Mark({
  from,
  to,
  at,
  className,
}: {
  from: number
  to: number
  at: (v: number) => number
  className: string
}) {
  return (
    // oxlint-disable-next-line basalt/primitive-bypass -- cycle-expression-9: the kit has no interval mark on an HTML track, so a bar's span is data
    <div
      className={`absolute inset-y-0 left-(--l) w-(--w) rounded-chip ${className}`}
      style={
        // cycle-expression-9: a CSS custom property is not on CSSProperties without a cast
        { '--l': `${at(from) * 100}%`, '--w': `${(at(to) - at(from)) * 100}%` } as CSSProperties
      }
    />
  )
}

export function ExprN35Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const clock = (min: number): string =>
    f.time(Date.UTC(2026, 10, 23, 0, min), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const range = (b: Block): string => `${clock(b.from)} to ${clock(b.to)}`

  const week = buildWeek(shotState === 'empty' ? [] : eventsFor(fixture))
  const axis = // cycle-expression-9: the axis is in hours because the track's ticks land on 100-minute steps over minutes
    chartLabels.axis({
      domain: [AXIS[0] / 60, AXIS[1] / 60],
      format: (h) => clock(h * 60),
      share: SHARE,
    })

  const free = (d: DayStat): string => (d.longest ? span(d.longest.to - d.longest.from) : '0 min')
  const where = (d: DayStat): string =>
    d.longest ? `${d.day.name} ${range(d.longest)}` : `${d.day.name} fully booked`

  const focus = useChartFocus(week.days, {
    announce: (d) =>
      `${d.day.name}: ${f.percent(d.share)} booked, ${free(d)} longest free${d.longest ? ` ${range(d.longest)}` : ''}`,
  })

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The calendar did not respond.' }
        : 'ready'
  const ready = phase === 'ready' && shotState !== 'empty'
  const shown = focus.datum ?? week.longestDay
  const overlap = week.overlaps[0]

  const figure = ready
    ? {
        value: focus.readout(
          `${week.longestDay ? free(week.longestDay) : '0 min'} free`,
          (d) => `${free(d)} free`,
        ),
        period: focus.readout(
          week.longestDay ? `${where(week.longestDay)}, longest block` : 'No block is free',
          where,
        ),
        periodMono: true,
      }
    : { value: null }

  const footer = [
    {
      label: 'Booked',
      value: ready ? `${span(week.bookedTotal)} of ${span(week.openTotal)}` : DASH,
    },
    {
      label: 'Overlap',
      value: !ready
        ? DASH
        : overlap
          ? `${week.days[overlap.day]?.day.name} ${clock(overlap.from)}`
          : 0,
      mono: true,
    },
  ] as const

  return (
    <Page area="expr-n35">
      <PageBar title="Workweek, Nov 23 to 27" />
      <ChartCard
        title="Booked time by workday"
        info="Accepted events inside working hours; an overlap counts once. Declined events book nothing."
        phase={phase}
        empty={
          shotState === 'empty'
            ? { cause: 'No events found for Nov 23 to 27. Connect a calendar to see booked time.' }
            : null
        }
        figure={figure}
        legend={LEGEND}
        footer={footer}
        chart={() => (
          <div className="@container flex h-full flex-col gap-1">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2">
              <span className="w-12" aria-hidden />
              <div className="relative h-4">
                {axis.ticks.map((t) => (
                  <span key={t.at} {...t.label}>
                    {t.text}
                  </span>
                ))}
              </div>
              <span className="w-10" aria-hidden />
            </div>
            <div
              {...focus.target}
              aria-label="Booked time by workday"
              className="flex min-h-0 flex-1 flex-col gap-1"
            >
              {week.days.map((d, i) => (
                <DayRow
                  key={d.day.name}
                  d={d}
                  item={focus.item(i)}
                  axis={axis}
                  percent={f.percent(d.share)}
                  freeLabel={free(d)}
                  showFree={shown?.index === d.index}
                />
              ))}
              {focus.live}
            </div>
          </div>
        )}
      />
    </Page>
  )
}

type RowProps = {
  d: DayStat
  item: ChartFocusItem
  axis: TrackAxis<number>
  percent: string
  freeLabel: string
  showFree: boolean
}

// cycle-expression-9: the kit has no day-by-hour interval track (a calendar week), so each day is a hand-drawn row on the seam-track recipe
function DayRow({ d, item, axis, percent, freeLabel, showFree }: RowProps) {
  const at = (min: number): number => axis.at(min / 60)
  const grid = chartLabels.row([], { share: SHARE, grid: axis.ticks }).lines
  const eventSpans = d.events.map((e) => ({ from: at(e.start), to: at(e.end) }))
  const freeRow =
    showFree && d.longest
      ? chartLabels.row(
          [
            {
              key: 'free',
              text: `${freeLabel} free`,
              from: at(d.longest.from),
              to: at(d.longest.to),
            },
          ],
          { share: SHARE, obstacles: eventSpans },
        ).placed[0]
      : undefined

  return (
    <div
      {...item}
      className="grid min-h-8 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-x-2 rounded-chip data-focused:bg-selected"
    >
      <span className="w-12 self-center text-sm">
        {d.day.name} {d.day.date}
      </span>
      <div className="relative">
        {grid.map((t) => (
          <span key={t.at} {...t.line} />
        ))}
        <Mark from={d.day.open} to={d.day.close} at={at} className="bg-selected" />
        {showFree && d.longest ? (
          <Mark
            from={d.longest.from}
            to={d.longest.to}
            at={at}
            // oxlint-disable-next-line basalt/tw-off-law -- cycle-expression-9: the answer's outline takes the one accent, and no kit part draws an outlined span
            className="border border-brand"
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col gap-0.5 py-0.5">
          {d.lanes.map((lane) => (
            <div key={lane[0]?.id} className="relative min-h-0 flex-1">
              {lane.map((e) => (
                <EventMark key={e.id} e={e} lane={lane} at={at} />
              ))}
            </div>
          ))}
        </div>
        {freeRow ? (
          // oxlint-disable-next-line basalt/tw-off-law -- cycle-expression-9: the answer's label takes the accent text token
          <span {...freeRow.props} className={`${freeRow.props.className} text-brand`}>
            {freeRow.text}
          </span>
        ) : null}
      </div>
      <span className="w-10 self-center text-end text-sm tabular-nums">{percent}</span>
    </div>
  )
}

function EventMark({
  e,
  lane,
  at,
}: {
  e: CalEvent
  lane: readonly CalEvent[]
  at: (v: number) => number
}) {
  const look = e.declined ? DECLINED : KIND[e.kind]
  const others = lane
    .filter((o) => o.id !== e.id)
    .map((o) => ({ from: at(o.start), to: at(o.end) }))
  const label = chartLabels.row([{ key: e.id, text: e.title, from: at(e.start), to: at(e.end) }], {
    share: SHARE,
    width: WIDE_LABELS,
    obstacles: others,
  }).placed[0]
  return (
    <>
      <Mark from={e.start} to={e.end} at={at} className={look.bar} />
      {label ? (
        <span
          {...label.props}
          className={`${label.props.className} ${look.ink} hidden @wide:block`}
        >
          {label.text}
        </span>
      ) : null}
    </>
  )
}
