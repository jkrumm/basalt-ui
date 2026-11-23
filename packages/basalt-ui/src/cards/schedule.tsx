/**
 * `Schedule`: events on a calendar in three views. Week and day are a time grid (an hour gutter,
 * an all-day row, events placed by start and end, overlapping events side by side, the now line on
 * today's column); month is a 7 by 6 grid of days with one row per event and "+N more" past three.
 * A header holds Today, previous and next, the range and the view switch; a rail beside it (from the
 * wide container tier) holds the mini month and the next events. Below the regular tier the week is
 * its anchor day under a week strip. The view and the day are URL fields; an event is a record link
 * (`href`, which `usePeek` opens) or calls `onOpen`.
 */
import { useEffect, useRef } from 'react'
import type { ComponentType, CSSProperties, ReactElement, ReactNode } from 'react'
import { useCoarsePointer } from '../common/use-media-query'
import { cn } from '../core/cn'
import type { CalendarDate } from '../core/format'
import { useFormat } from '../core/format'
import { AppLink } from '../core/link'
import { schedule as scheduleMessages } from '../core/messages/schedule'
import { useMessages } from '../core/messages/use-messages'
import { resolvePhase } from '../core/phase'
import type { ControlHandle, NavTarget, Phase, QueryStateLike, Tone } from '../core/ports'
import { useNow } from '../core/use-now'
import {
  addDays,
  addMonths,
  isCalendarDate,
  monthGridOf,
  startOfMonth,
  todayIn,
  useCalendarDefaults,
  weekOf,
  zonedDay,
  zonedInstant,
} from '../core/zoned'
import type { Weekday } from '../core/zoned'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Segmented } from '../ui/segmented'
import { allDayOn, eventsOn, isPast, msOf, placeDay, upNext as nextEvents } from './schedule-model'
import type { PlacedEvent, ScheduleEvent, ScheduleView } from './schedule-model'

export type { ScheduleEvent, ScheduleInstant, ScheduleView } from './schedule-model'

/** Per-day dots on the mini month: a tone, or up to three. */
export type ScheduleMarks = Readonly<Partial<Record<CalendarDate, Tone | readonly Tone[]>>>

/**
 * What the rail's mini month is handed: `Calendar` from `basalt-ui/ui/calendar` fits it. A port,
 * so the cards entry never loads the calendar's date library for an app that shows no rail.
 */
export type MiniMonthLike = ComponentType<{
  'aria-label': string
  value: CalendarDate
  onChange: (day: CalendarDate) => void
  defaultMonth: CalendarDate
  today: CalendarDate
  marks: ScheduleMarks
  size: 'sm'
  weekStart: Weekday
}>

/** A field the schedule reads and writes: a `field` handle from `basalt-ui/router` fits it. */
type FieldOf<T> = Pick<ControlHandle<T>, 'use'>

export type ScheduleProps<E extends ScheduleEvent = ScheduleEvent> = {
  /** The schedule's accessible name. */
  label: string
  /** `undefined` while the first load runs: the grid draws with no events. */
  events: readonly E[] | undefined
  /** The load state, as on every frame: a `Phase` or a query result. */
  phase?: Phase | QueryStateLike | undefined
  /** `field.enum(['week', 'month', 'day'], 'week')`: the view lives in the URL. */
  view: FieldOf<ScheduleView>
  /** `field.string('')`: the shown day as `YYYY-MM-DD`, empty for today. */
  date: FieldOf<string>
  /** The event's record page: each event is a link, so `usePeek` opens it and the URL holds it. */
  href?: ((event: E) => string | NavTarget) | undefined
  /** Called with the event's id when it is activated (with `href` too, before the link runs). */
  onOpen?: ((id: string) => void) | undefined
  /** Called with the start of an empty hour the user clicks; creating the event is the app's. */
  onSlot?: ((start: number) => void) | undefined
  /** The hours the time grid spans, `[from, to)`. Default the whole day, `[0, 24]`. */
  hours?: readonly [number, number] | undefined
  /** The hour at the top of the time grid when it first draws. Default 8. */
  scrollTo?: number | undefined
  /**
   * The rail beside the grid, from the wide container tier: `month` is the mini month
   * (`Calendar` from `basalt-ui/ui/calendar`), `upNext` the count of next events (default 3).
   * `false` draws no rail.
   */
  rail?: { month?: MiniMonthLike | undefined; upNext?: number | undefined } | false | undefined
  /** A fixed clock (a screenshot, a story). Default the live minute from `useNow`. */
  now?: number | undefined
}

const HOUR_PX = 64
/** The least an event draws, px: a 15-minute event is one compact line. */
const MIN_EVENT_PX = 29
/** The least on a coarse pointer: the 44 px touch target plus the gap under it. */
const MIN_TOUCH_EVENT_PX = 47
/** The gap under an event, px, so two back-to-back events read as two. */
const EVENT_GAP = 3
/** Below this height an event is one line: title and time side by side. */
const COMPACT_PX = 48
/** Two title lines and a hairline of air: a shared-lane event from this height wraps its title. */
const TWO_LINES_PX = 44
const MONTH_ROWS = 3
/** Px above the first shown hour, so its gutter label is not cut by the scroller's top edge. */
const LABEL_CLEAR = 12
const NOW_TICK = 60_000

/**
 * An event's fill: the tone's tint over the card colour, so the fill is opaque and no hour line
 * shows through an event (the tint tokens alone are mixed with transparent).
 */
const TONE_FILL: Record<Tone, string> = {
  neutral: 'before:bg-selected',
  accent: 'before:bg-selected',
  good: 'before:bg-good-tint',
  warn: 'before:bg-warn-tint',
  bad: 'before:bg-bad-tint',
  info: 'before:bg-info-tint',
}

/** The base the tint sits on; `isolate` keeps the tint layer under the event's own text. */
const FILL_BASE =
  'isolate bg-card before:absolute before:inset-0 before:-z-10 before:rounded-ctrl before:content-[""]'

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-faint',
  accent: 'bg-brand',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
}

const px = (minutes: number): number => (minutes * HOUR_PX) / 60
const vars = (v: Record<string, string | number>): CSSProperties => v as CSSProperties

/** The shown day: the field's value when it is a day, else today. */
function anchorOf(value: string, today: CalendarDate): CalendarDate {
  return value !== '' && isCalendarDate(value) ? value : today
}

const utcDay = (day: CalendarDate): number => Date.parse(`${day}T00:00:00Z`)

/** One instance per locale and shape; `formatRange` keeps one year when both ends share it. */
function rangeTitle(
  view: ScheduleView,
  anchor: CalendarDate,
  days: readonly CalendarDate[],
  locale: string,
): string {
  if (view === 'month') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(utcDay(anchor))
  }
  if (view === 'day') {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(utcDay(anchor))
  }
  const first = days[0] ?? anchor
  const last = days.at(-1) ?? anchor
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(utcDay(first), utcDay(last))
}

function Chevron({ side }: { side: 'left' | 'right' }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d={side === 'right' ? 'M6 4l4 4-4 4' : 'M10 4L6 8l4 4'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

type Activate<E extends ScheduleEvent> = {
  href: ((event: E) => string | NavTarget) | undefined
  onOpen: ((id: string) => void) | undefined
}

/** An event's target: a record link when `href` is given, else a button that calls `onOpen`. */
function EventTarget<E extends ScheduleEvent>({
  event,
  activate,
  className,
  style,
  label,
  slot,
  children,
}: {
  event: E
  activate: Activate<E>
  className: string
  style?: CSSProperties | undefined
  label: string
  slot: string
  children: ReactNode
}): ReactElement {
  const open = (): void => activate.onOpen?.(event.id)
  // The ring sits inside the event: an event meets its column's edge, where an outer ring is clipped.
  const ringed = cn(className, 'focus-visible:-outline-offset-2')
  if (activate.href !== undefined) {
    return (
      <span className={cn('contents')} style={style}>
        <AppLink
          href={activate.href(event)}
          data-slot={slot}
          aria-label={label}
          className={ringed}
          onClick={open}
        >
          {children}
        </AppLink>
      </span>
    )
  }
  return (
    <button
      type="button"
      data-slot={slot}
      aria-label={label}
      className={ringed}
      style={style}
      onClick={open}
    >
      {children}
    </button>
  )
}

function ToneDot({ tone, className }: { tone: Tone; className?: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone], className)}
    />
  )
}

/**
 * Events on a calendar: a week or a day by the hour, or a month of days, with the now line, a
 * header that moves through time and an optional rail with the mini month and the next events.
 * The view and the shown day are URL fields, so a shared link opens the same week. Instants are
 * placed in the zone and the week start of the app's format defaults (`BasaltProvider`
 * `timeZone` and `locale`). Each event is a record link when `href` is given, so the app's
 * `usePeek` opens it beside the schedule, the URL holds it and Escape returns focus to it.
 *
 * @useWhen dated events with a start and an end are read by the day and the hour: deliveries, calls, shifts, bookings
 * @neverWhen the events are a feed in time order with no grid (use EventList), or spans on rows over one axis are compared (use IntervalTrack)
 *
 * @example
 * <Schedule
 *   label="Deliveries"
 *   events={query.data}
 *   phase={query}
 *   view={store.field.view}
 *   date={store.field.date}
 *   href={(e) => navTarget(linkOptions({ to: '/deliveries/$id', params: { id: e.id } }))}
 *   rail={{ month: Calendar }}
 * />
 */
export function Schedule<E extends ScheduleEvent>(props: ScheduleProps<E>): ReactElement {
  const { label, events, phase, href, onOpen, onSlot, rail } = props
  const [h0, h1] = props.hours ?? [0, 24]
  const t = useMessages(scheduleMessages)
  const f = useFormat()
  const { locale, timeZone, weekStart } = useCalendarDefaults()
  const live = useNow(NOW_TICK)
  const now = props.now ?? live
  const today = todayIn(now, timeZone)
  const [view, setView] = props.view.use()
  const [dateValue, setDate] = props.date.use()
  const anchor = anchorOf(dateValue, today)
  const resolved = resolvePhase({ phase, empty: null })
  const shown = resolved.body ? (events ?? []) : []
  const activate: Activate<E> = { href, onOpen }

  const days = view === 'day' ? [anchor] : weekOf(anchor, weekStart)
  const step = (dir: 1 | -1): void => {
    const next =
      view === 'month' ? addMonths(anchor, dir) : addDays(anchor, view === 'day' ? dir : 7 * dir)
    setDate(next === today ? '' : next)
  }
  const goTo = (day: CalendarDate): void => setDate(day === today ? '' : day)
  const viewOptions = [
    { value: 'day', label: t('schedule.day') },
    { value: 'week', label: t('schedule.week') },
    { value: 'month', label: t('schedule.month') },
  ]

  return (
    <section
      data-slot="schedule"
      aria-label={label}
      aria-busy={resolved.tag === 'loading' ? true : undefined}
      className="@container flex h-full min-h-0 min-w-0 flex-col"
    >
      <div data-slot="schedule-header" className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Button size="sm" onClick={() => goTo(today)}>
          {t('schedule.today')}
        </Button>
        <div className="flex items-center">
          <Button
            size="sm"
            variant="ghost"
            shape="icon"
            aria-label={t('schedule.previous')}
            onClick={() => step(-1)}
          >
            <Chevron side="left" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            shape="icon"
            aria-label={t('schedule.next')}
            onClick={() => step(1)}
          >
            <Chevron side="right" />
          </Button>
        </div>
        <h2
          data-slot="schedule-range"
          aria-live="polite"
          className="m-0 min-w-0 flex-1 truncate text-sm font-medium"
        >
          {rangeTitle(view, anchor, days, locale)}
        </h2>
        <div className="hidden @regular:block">
          <Segmented
            size="sm"
            aria-label={t('schedule.view')}
            value={view}
            onValueChange={(v) => setView(v as ScheduleView)}
            options={viewOptions}
          />
        </div>
        {/* Below the regular tier a week is drawn as its day, so the switch offers the day and the month. */}
        <div className="w-full @regular:hidden">
          <Segmented
            size="sm"
            fill
            aria-label={t('schedule.view')}
            value={view === 'month' ? 'month' : 'day'}
            onValueChange={(v) => setView(v as ScheduleView)}
            options={viewOptions.filter((o) => o.value !== 'week')}
          />
        </div>
      </div>
      {resolved.tag === 'error' && (
        <p data-slot="schedule-error" role="alert" className="m-0 px-3 pb-2 text-xs text-bad">
          {resolved.message ?? t('schedule.failed')}
        </p>
      )}
      <div className="flex min-h-0 flex-1 border-t border-border">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === 'month' ? (
            <MonthGrid
              anchor={anchor}
              today={today}
              weekStart={weekStart}
              locale={locale}
              timeZone={timeZone}
              events={shown}
              now={now}
              activate={activate}
              onDay={(day) => {
                goTo(day)
                setView('day')
              }}
            />
          ) : (
            <>
              <WeekStrip
                days={weekOf(anchor, weekStart)}
                anchor={anchor}
                today={today}
                locale={locale}
                timeZone={timeZone}
                events={shown}
                label={t('schedule.days')}
                onPick={goTo}
              />
              <TimeGrid
                days={days}
                anchor={anchor}
                today={today}
                locale={locale}
                timeZone={timeZone}
                events={shown}
                now={now}
                hours={[h0, h1]}
                scrollTo={props.scrollTo ?? 8}
                activate={activate}
                onSlot={onSlot}
                label={label}
                format={f}
              />
            </>
          )}
        </div>
        {rail !== false && rail !== undefined && (
          <Rail
            month={rail.month}
            count={rail.upNext ?? 3}
            anchor={anchor}
            today={today}
            weekStart={weekStart}
            timeZone={timeZone}
            events={shown}
            now={now}
            activate={activate}
            onPick={goTo}
            label={label}
          />
        )}
      </div>
    </section>
  )
}

type Ctx = { locale: string; timeZone: string }

/** The day under the header's weekday: `Mon 23`, today's number in the brand circle. */
function DayHead({
  day,
  today,
  locale,
}: {
  day: CalendarDate
  today: CalendarDate
  locale: string
}): ReactElement {
  const at = utcDay(day)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(at)
  const isToday = day === today
  return (
    <div
      data-slot="schedule-day-head"
      {...(isToday && { 'aria-current': 'date' as const })}
      className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 text-xs text-muted-foreground"
    >
      <span>{weekday}</span>
      <span
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums',
          isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground',
        )}
      >
        {Number(day.slice(8))}
      </span>
    </div>
  )
}

function TimeGrid<E extends ScheduleEvent>({
  days,
  anchor,
  today,
  locale,
  timeZone,
  events,
  now,
  hours,
  scrollTo,
  activate,
  onSlot,
  label,
  format,
}: Ctx & {
  days: readonly CalendarDate[]
  anchor: CalendarDate
  today: CalendarDate
  events: readonly E[]
  now: number
  hours: readonly [number, number]
  scrollTo: number
  activate: Activate<E>
  onSlot: ((start: number) => void) | undefined
  label: string
  format: ReturnType<typeof useFormat>
}): ReactElement {
  const t = useMessages(scheduleMessages)
  const root = useRef<HTMLDivElement>(null)
  const [h0, h1] = hours
  const height = (h1 - h0) * HOUR_PX
  const minPx = useCoarsePointer() ? MIN_TOUCH_EVENT_PX : MIN_EVENT_PX
  const minMinutes = (minPx * 60) / HOUR_PX
  const hourList = Array.from({ length: h1 - h0 }, (_, i) => h0 + i)
  const hourText = new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' })
  const allDay = days.map((d) => allDayOn(events, d, timeZone))
  const anyAllDay = allDay.some((list) => list.length > 0)
  const shownOn = (day: CalendarDate): boolean => days.length === 1 || day === anchor
  const nowAt = zonedDay(now, timeZone)

  // The first draw's scroll offset only: after that the reader's own scroll is theirs.
  const firstTop = useRef(Math.max(0, (scrollTo - h0) * HOUR_PX - LABEL_CLEAR))
  useEffect(() => {
    const scroller = root.current?.querySelector<HTMLElement>('[data-slot="scroll-area"]')
    if (scroller) scroller.scrollTop = firstTop.current
  }, [])

  return (
    <div ref={root} data-slot="schedule-time-grid" className="flex min-h-0 flex-1 flex-col">
      <div className="hidden border-b border-border @regular:flex" data-slot="schedule-head-row">
        <div className="w-14 shrink-0" />
        {days.map((d) => (
          <DayHead key={d} day={d} today={today} locale={locale} />
        ))}
      </div>
      {anyAllDay && (
        <div
          data-slot="schedule-all-day"
          className={cn(
            'flex border-b border-border',
            allDayOn(events, anchor, timeZone).length === 0 &&
              days.length > 1 &&
              'hidden @regular:flex',
          )}
        >
          <div className="flex w-14 shrink-0 items-center justify-end pr-2 text-micro text-muted-foreground">
            {t('schedule.allDay')}
          </div>
          {days.map((d, i) => (
            <div
              key={d}
              {...(shownOn(d) && { 'data-shown': '' })}
              className="hidden min-w-0 flex-1 flex-col gap-0.5 border-l border-border p-0.5 data-shown:flex @regular:flex"
            >
              {(allDay[i] ?? []).map((e) => (
                <EventTarget
                  key={e.id}
                  event={e}
                  activate={activate}
                  slot="schedule-event"
                  label={`${e.title}, ${t('schedule.allDay')}`}
                  className={cn(
                    'relative flex h-6 min-w-0 items-center gap-1.5 rounded-ctrl px-2 text-xs text-foreground focus-ring pointer-coarse:h-11',
                    FILL_BASE,
                    TONE_FILL[e.tone ?? 'neutral'],
                    isPast(e, now) && 'opacity-60',
                  )}
                >
                  <ToneDot tone={e.tone ?? 'neutral'} />
                  <span className="truncate font-medium">{e.title}</span>
                </EventTarget>
              ))}
            </div>
          ))}
        </div>
      )}
      <ScrollArea aria-label={label} className="min-h-0 flex-1 focus-visible:-outline-offset-2">
        <div className="flex" style={vars({ '--grid-h': `${height}px` })}>
          <div
            data-slot="schedule-gutter"
            aria-hidden="true"
            className="relative h-(--grid-h) w-14 shrink-0"
          >
            {hourList.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-2 top-(--y) -translate-y-1/2 text-micro text-muted-foreground tabular-nums"
                style={vars({ '--y': `${(h - h0) * HOUR_PX}px` })}
              >
                {hourText.format(Date.UTC(2026, 0, 1, h))}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const placed = placeDay(events, day, timeZone, minMinutes)
            const isToday = day === today
            const nowY = px(nowAt.minutes - h0 * 60)
            return (
              <div
                key={day}
                data-slot="schedule-day"
                data-day={day}
                {...(shownOn(day) && { 'data-shown': '' })}
                {...(isToday && { 'data-today': '' })}
                className="relative hidden h-(--grid-h) min-w-0 flex-1 border-l border-border data-shown:block @regular:block"
              >
                {hourList.map((h) =>
                  onSlot === undefined ? (
                    <div
                      key={h}
                      aria-hidden="true"
                      className="absolute inset-x-0 top-(--y) h-16 border-t border-border first:border-t-0"
                      style={vars({ '--y': `${(h - h0) * HOUR_PX}px` })}
                    />
                  ) : (
                    <button
                      key={h}
                      type="button"
                      tabIndex={-1}
                      data-slot="schedule-slot"
                      aria-label={t('schedule.slot', zonedInstant(day, timeZone, h * 60))}
                      className="absolute inset-x-0 top-(--y) h-16 cursor-pointer border-t border-border first:border-t-0 hover:bg-accent"
                      style={vars({ '--y': `${(h - h0) * HOUR_PX}px` })}
                      onClick={() => onSlot(zonedInstant(day, timeZone, h * 60))}
                    />
                  ),
                )}
                {placed.map((p) => (
                  <TimedEvent
                    key={p.event.id}
                    placed={p}
                    minPx={minPx}
                    h0={h0}
                    h1={h1}
                    now={now}
                    activate={activate}
                    format={format}
                  />
                ))}
                {isToday && nowAt.day === day && nowY >= 0 && nowY <= height && (
                  <div
                    data-slot="schedule-now"
                    data-minute={Math.floor(nowAt.minutes)}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-(--y) z-20 h-0.5 -translate-y-1/2 bg-foreground"
                    style={vars({ '--y': `${nowY}px` })}
                  >
                    <span className="absolute -left-1.5 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-foreground" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function TimedEvent<E extends ScheduleEvent>({
  placed,
  minPx,
  h0,
  h1,
  now,
  activate,
  format,
}: {
  placed: PlacedEvent<E>
  /** The least height an event draws, px, gap included. */
  minPx: number
  h0: number
  h1: number
  now: number
  activate: Activate<E>
  format: ReturnType<typeof useFormat>
}): ReactElement | null {
  const { event, from, to, lane, lanes } = placed
  const top = Math.max(from, h0 * 60)
  const bottom = Math.min(to, h1 * 60)
  if (bottom <= top && !(from === to && from >= h0 * 60 && from < h1 * 60)) return null
  const y = px(top - h0 * 60)
  const h = Math.max(minPx, px(bottom - top)) - EVENT_GAP
  const shared = lanes > 1
  // A shared lane is narrow, so its title takes every line the height holds (two from 44 px) and
  // gives up the time; an event alone in its column keeps the time beside or under the title.
  const compact = shared ? h < TWO_LINES_PX : h < COMPACT_PX
  const tone = event.tone ?? 'neutral'
  const time = `${format.time(msOf(event.start))} – ${format.time(msOf(event.end))}`
  const who = event.attendees?.length ? `, ${event.attendees.join(', ')}` : ''
  return (
    <EventTarget
      event={event}
      activate={activate}
      slot="schedule-event"
      label={`${event.title}, ${time}${who}`}
      style={vars({
        '--y': `${y}px`,
        '--h': `${h}px`,
        '--x': `calc(${(lane / lanes) * 100}% + 2px)`,
        '--w': `calc(${100 / lanes}% - 4px)`,
      })}
      className={cn(
        'absolute top-(--y) left-(--x) z-10 flex h-(--h) w-(--w) min-w-0 animate-enter-item overflow-hidden rounded-ctrl px-2 text-left text-foreground focus-ring',
        compact ? 'items-center gap-1.5' : cn('flex-col gap-0.5', shared ? 'py-0.5' : 'py-1'),
        FILL_BASE,
        TONE_FILL[tone],
        isPast(event, now) && 'opacity-60',
      )}
    >
      <span className={cn('flex min-w-0 gap-1.5', compact ? 'items-center' : 'items-start')}>
        {/* The dot sits on the title's first line: a box one line tall centres it there. */}
        <span className="flex h-(--text-sm--line-height) shrink-0 items-center">
          <ToneDot tone={tone} />
        </span>
        <span
          className={cn(
            'min-w-0 text-sm font-medium',
            // Wrapped and clamped, never run on in one line: a title in a narrow lane stays inside its own box.
            compact
              ? 'line-clamp-1 break-words text-ellipsis'
              : 'line-clamp-2 break-words text-ellipsis',
          )}
        >
          {event.title}
        </span>
      </span>
      {/* An event in a shared lane gives its width to the title: the time stays in its name. */}
      {lanes === 1 && (
        <span
          className={cn(
            'truncate text-xs text-muted-foreground tabular-nums',
            compact && 'shrink-0',
          )}
        >
          {format.time(msOf(event.start))}
        </span>
      )}
    </EventTarget>
  )
}

/** The phone's day picker: the week's seven days, the shown one raised, a dot under a busy day. */
function WeekStrip<E extends ScheduleEvent>({
  days,
  anchor,
  today,
  locale,
  timeZone,
  events,
  label,
  onPick,
}: Ctx & {
  days: readonly CalendarDate[]
  anchor: CalendarDate
  today: CalendarDate
  events: readonly E[]
  label: string
  onPick: (day: CalendarDate) => void
}): ReactElement {
  const letter = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' })
  const long = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return (
    <fieldset
      data-slot="schedule-week-strip"
      className="m-0 flex min-w-0 gap-1 border-0 border-b border-border p-0 px-1 py-1 @regular:hidden"
    >
      <legend className="sr-only">{label}</legend>
      {days.map((d) => {
        const busy = eventsOn(events, d, timeZone).length > 0
        const picked = d === anchor
        return (
          <button
            key={d}
            type="button"
            aria-pressed={picked}
            aria-label={long.format(utcDay(d))}
            {...(d === today && { 'aria-current': 'date' as const })}
            onClick={() => onPick(d)}
            className={cn(
              'flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-ctrl text-xs focus-ring',
              picked
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <span aria-hidden="true">{letter.format(utcDay(d))}</span>
            <span
              aria-hidden="true"
              className={cn(
                'text-sm tabular-nums',
                d === today && 'font-semibold',
                !picked && 'text-foreground',
              )}
            >
              {Number(d.slice(8))}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'size-1 rounded-full',
                busy
                  ? picked
                    ? 'bg-primary-foreground'
                    : 'bg-muted-foreground'
                  : 'bg-transparent',
              )}
            />
          </button>
        )
      })}
    </fieldset>
  )
}

function MonthGrid<E extends ScheduleEvent>({
  anchor,
  today,
  weekStart,
  locale,
  timeZone,
  events,
  now,
  activate,
  onDay,
}: Ctx & {
  anchor: CalendarDate
  today: CalendarDate
  weekStart: Weekday
  events: readonly E[]
  now: number
  activate: Activate<E>
  onDay: (day: CalendarDate) => void
}): ReactElement {
  const t = useMessages(scheduleMessages)
  const f = useFormat()
  const cells = monthGridOf(anchor, weekStart)
  const month = startOfMonth(anchor).slice(0, 7)
  const head = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const long = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return (
    <div data-slot="schedule-month" className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {cells.slice(0, 7).map((d) => (
          <div
            key={d}
            className="flex h-8 items-center justify-center text-xs text-muted-foreground"
          >
            {head.format(utcDay(d))}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((d, i) => {
          const list = eventsOn(events, d, timeZone)
          const rows = list.slice(0, MONTH_ROWS)
          const more = list.length - rows.length
          const outside = d.slice(0, 7) !== month
          return (
            <div
              key={d}
              data-slot="schedule-month-day"
              data-day={d}
              {...(outside && { 'data-outside': '' })}
              className={cn(
                'flex min-h-16 min-w-0 flex-col gap-0.5 border-border p-1',
                i % 7 !== 0 && 'border-l',
                i >= 7 && 'border-t',
                outside && 'bg-inset',
              )}
            >
              <button
                type="button"
                aria-label={long.format(utcDay(d))}
                {...(d === today && { 'aria-current': 'date' as const })}
                onClick={() => onDay(d)}
                className={cn(
                  'inline-flex size-6 cursor-pointer items-center justify-center self-start rounded-full text-xs tabular-nums focus-ring pointer-coarse:size-11',
                  d === today
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'hover:bg-accent',
                  outside && d !== today && 'text-faint',
                )}
              >
                {Number(d.slice(8))}
              </button>
              <div className="hidden min-w-0 flex-col gap-0.5 @regular:flex">
                {rows.map((e) => (
                  <EventTarget
                    key={e.id}
                    event={e}
                    activate={activate}
                    slot="schedule-event"
                    label={
                      e.allDay === true
                        ? `${e.title}, ${t('schedule.allDay')}`
                        : `${e.title}, ${f.time(msOf(e.start))}`
                    }
                    className={cn(
                      'flex h-6 min-w-0 cursor-pointer items-center gap-1.5 rounded-chip px-1 text-xs text-foreground hover:bg-accent focus-ring pointer-coarse:h-11',
                      isPast(e, now) && 'opacity-60',
                    )}
                  >
                    <ToneDot tone={e.tone ?? 'neutral'} />
                    {e.allDay !== true && (
                      <span className="shrink-0 text-micro text-muted-foreground tabular-nums">
                        {f.time(msOf(e.start))}
                      </span>
                    )}
                    <span className="truncate">{e.title}</span>
                  </EventTarget>
                ))}
                {more > 0 && (
                  <button
                    type="button"
                    data-slot="schedule-more"
                    onClick={() => onDay(d)}
                    className="h-6 cursor-pointer self-start rounded-chip px-1 text-xs text-muted-foreground hover:bg-accent focus-ring pointer-coarse:h-11"
                  >
                    {t('schedule.more', more)}
                  </button>
                )}
              </div>
              {list.length > 0 && (
                <div aria-hidden="true" className="flex gap-0.5 @regular:hidden">
                  {list.slice(0, MONTH_ROWS).map((e) => (
                    <ToneDot key={e.id} tone="neutral" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Days a multi-day event marks at most: a long block marks its first six weeks, never an unbounded loop. */
const MARK_SPAN_DAYS = 42

/**
 * The mini month's dots over every loaded event, not one month's grid, so a month the reader pages
 * to shows its busy days too. Busy, not which kind: up to three dots in one ink count the day's
 * events, and the day's name says busy, so no hue carries a meaning the words do not.
 */
function busyMarks(events: readonly ScheduleEvent[], timeZone: string): ScheduleMarks {
  const counts = new Map<CalendarDate, number>()
  for (const e of events) {
    const start = msOf(e.start)
    const first = zonedDay(start, timeZone).day
    const last = zonedDay(Math.max(start, msOf(e.end) - 1), timeZone).day
    for (let d = first, i = 0; d <= last && i < MARK_SPAN_DAYS; d = addDays(d, 1), i += 1) {
      counts.set(d, Math.min(3, (counts.get(d) ?? 0) + 1))
    }
  }
  const marks: Partial<Record<CalendarDate, Tone[]>> = {}
  for (const [day, n] of counts) marks[day] = Array.from({ length: n }, (): Tone => 'neutral')
  return marks
}

function Rail<E extends ScheduleEvent>({
  month: MiniMonth,
  count,
  anchor,
  today,
  weekStart,
  timeZone,
  events,
  now,
  activate,
  onPick,
  label,
}: {
  month: MiniMonthLike | undefined
  count: number
  anchor: CalendarDate
  today: CalendarDate
  weekStart: Weekday
  timeZone: string
  events: readonly E[]
  now: number
  activate: Activate<E>
  onPick: (day: CalendarDate) => void
  label: string
}): ReactElement {
  const t = useMessages(scheduleMessages)
  const f = useFormat()
  const marks = busyMarks(events, timeZone)
  const next = nextEvents(events, now, count)
  const dayName = (at: number): string => {
    const day = zonedDay(at, timeZone).day
    if (day === today) return t('schedule.today')
    return f.date(at, 'weekday')
  }
  return (
    <aside
      data-slot="schedule-rail"
      aria-label={label}
      className="hidden w-70 shrink-0 flex-col gap-4 border-l border-border p-3 @wide:flex"
    >
      {MiniMonth !== undefined && (
        <MiniMonth
          key={startOfMonth(anchor)}
          aria-label={t('schedule.month')}
          value={anchor}
          onChange={onPick}
          defaultMonth={anchor}
          today={today}
          marks={marks}
          size="sm"
          weekStart={weekStart}
        />
      )}
      <section aria-label={t('schedule.upNext')} className="flex min-w-0 flex-col gap-2">
        <h3 className="m-0 text-xs font-medium text-muted-foreground">{t('schedule.upNext')}</h3>
        {next.length === 0 ? (
          <p className="m-0 text-xs text-muted-foreground">{t('schedule.nothingNext')}</p>
        ) : (
          next.map((e) => {
            const at = msOf(e.start)
            const when =
              e.allDay === true
                ? `${dayName(at)} · ${t('schedule.allDay')}`
                : `${dayName(at)} · ${f.time(at)}`
            return (
              <EventTarget
                key={e.id}
                event={e}
                activate={activate}
                slot="schedule-next"
                label={`${e.title}, ${when}`}
                className="flex min-w-0 animate-enter-item flex-col gap-1 rounded-card border border-border p-3 text-left text-foreground hover:bg-accent focus-ring"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <ToneDot tone={e.tone ?? 'neutral'} />
                  <span className="truncate text-sm font-medium">{e.title}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{when}</span>
                {e.attendees !== undefined && e.attendees.length > 0 && (
                  <span className="truncate text-xs text-muted-foreground">
                    {e.attendees.join(', ')}
                  </span>
                )}
              </EventTarget>
            )
          })
        )}
      </section>
    </aside>
  )
}
