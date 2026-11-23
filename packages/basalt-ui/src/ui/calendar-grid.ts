/**
 * The month grid both calendars share: `Calendar` (`ui/calendar`) inline and the popup of
 * `DatePicker` (`ui/date-picker`). Token classes for DayPicker's parts, the day button that keeps
 * DayPicker's roving focus and draws the per-day dots, the day names, and the `YYYY-MM-DD` to
 * local-noon `Date` bridge DayPicker needs. A `.ts` module, not a primitive: none of it is a
 * public value of a `ui/*` entry.
 */
import { createContext, createElement, useContext } from 'react'
import type { ReactElement } from 'react'
import { DayButton } from 'react-day-picker'
import type { ClassNames, DayButtonProps, DayPickerProps } from 'react-day-picker'
import { cn } from '../core/cn'
import type { CalendarDate } from '../core/format'
import { useFormat } from '../core/format'
import { date as dateMessages } from '../core/messages/date'
import { useMessages } from '../core/messages/use-messages'
import type { Tone } from '../core/ports'
import { useCalendarDefaults } from '../core/zoned'

/** A span of days, both ends `YYYY-MM-DD`. Reported once both ends are picked, never a half range. */
export type CalendarRange = { from: CalendarDate; to: CalendarDate }

/** Per-day marks: one tone, or a list of tones. A day draws at most three dots. */
export type CalendarMarks = Readonly<Partial<Record<CalendarDate, Tone | readonly Tone[]>>>

/** The most dots one day draws: a 32 px cell holds three 4 px dots in a row, and the name says busy either way. */
const MAX_DOTS = 3

export const NO_MARKS: CalendarMarks = {}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * The day colours, all tokens. A picked day (the single day, or either end of a range) is the one
 * strong fill; the middle of a range is the quiet `selected` band its ends sit on; hover is the
 * lighter `accent`; today is a neutral ring and weight, never the brand, so it never competes with
 * the pick.
 */
const CALENDAR_CLASSES: Partial<ClassNames> = {
  months: 'flex flex-col',
  month: 'flex flex-col gap-1',
  month_caption: 'flex h-(--cell) items-center justify-center',
  caption_label: 'text-sm font-medium',
  nav: 'absolute inset-x-0 top-0 flex h-(--cell) items-center justify-between',
  button_previous:
    'inline-flex size-(--cell) cursor-pointer items-center justify-center rounded-ctrl text-muted-foreground hover:bg-accent focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-50',
  button_next:
    'inline-flex size-(--cell) cursor-pointer items-center justify-center rounded-ctrl text-muted-foreground hover:bg-accent focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-50',
  chevron: 'size-icon fill-current',
  month_grid: 'border-collapse',
  weekdays: '',
  weekday: 'size-(--cell) p-0 text-center text-xs font-normal text-muted-foreground',
  week: '',
  day: 'group/day size-(--cell) p-0 text-center',
  day_button:
    'relative inline-flex size-(--cell) cursor-pointer items-center justify-center rounded-ctrl tabular-nums focus-ring hover:bg-accent group-data-today/day:font-semibold group-data-today/day:inset-ring group-data-today/day:inset-ring-input group-data-outside/day:text-faint group-data-disabled/day:pointer-events-none group-data-disabled/day:opacity-50 data-picked:bg-primary data-picked:text-primary-foreground data-picked:hover:bg-primary/90',
  range_middle: 'bg-selected',
  range_start: 'rounded-l-ctrl bg-selected',
  range_end: 'rounded-r-ctrl bg-selected',
}

/** The dot fill per tone: the same status tokens `Status` takes, as a solid dot. */
const DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  accent: 'bg-brand-fill',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
}

/**
 * The marks the grid draws, handed to each day button through context: DayPicker renders its own
 * `DayButton` component, so a mark cannot reach it as a prop of ours.
 */
export const MarksContext = createContext<CalendarMarks>(NO_MARKS)

function marksOf(marks: CalendarMarks, day: CalendarDate): readonly Tone[] {
  const mark = marks[day]
  if (mark === undefined) return []
  return typeof mark === 'string' ? [mark] : mark
}

/** The dots under a day number. Hidden from assistive tech: the day's name carries the mark. */
function MarkDots({ tones }: { tones: readonly Tone[] }): ReactElement {
  return createElement(
    'span',
    {
      'aria-hidden': true,
      className: 'pointer-events-none absolute inset-x-0 bottom-1 flex justify-center gap-0.5',
    },
    tones.map((tone, i) =>
      createElement('span', {
        key: i,
        'data-tone': tone,
        className: cn('size-1 rounded-full', DOT[tone]),
      }),
    ),
  )
}

/**
 * DayPicker's own day button (it keeps the roving focus), flagged `data-picked` on a single pick or a
 * range end, with the day's dots under the number.
 */
function CalendarDayButton(props: DayButtonProps): ReactElement {
  const marks = useContext(MarksContext)
  const { selected, range_middle: middle } = props.modifiers
  const tones = marksOf(marks, toCalendarDate(props.day.date)).slice(0, MAX_DOTS)
  return createElement(
    DayButton,
    { ...props, ...(selected === true && middle !== true && { 'data-picked': '' }) },
    props.children,
    tones.length > 0 ? createElement(MarkDots, { tones }) : null,
  )
}

function Chevron({ orientation }: { orientation?: string }): ReactElement {
  const d = orientation === 'right' ? 'M6 4l4 4-4 4' : 'M10 4L6 8l4 4'
  return createElement(
    'svg',
    { viewBox: '0 0 16 16', className: 'size-icon', fill: 'none', 'aria-hidden': true },
    createElement('path', {
      d,
      stroke: 'currentColor',
      strokeWidth: '1.5',
      strokeLinecap: 'round',
    }),
  )
}

/**
 * A `YYYY-MM-DD` day as the local-noon `Date` DayPicker works in. DayPicker reads dates in the
 * runtime's zone, so building the local day (never `new Date('2026-11-20')`, which is UTC midnight
 * and lands on the 19th west of UTC) keeps the day that was stored. Noon, not midnight, so no
 * daylight-saving gap can move it.
 */
export function toLocalDate(day: CalendarDate | null | undefined): Date | undefined {
  const m = typeof day === 'string' ? ISO_DAY.exec(day) : null
  if (m === null || typeof day !== 'string') return undefined
  const local = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  // `2026-02-31` rolls to March in `Date`: a day that does not exist is no day.
  return toCalendarDate(local) === day ? local : undefined
}

/** The local calendar day DayPicker hands back, as `YYYY-MM-DD`. */
export function toCalendarDate(d: Date): CalendarDate {
  const year = String(d.getFullYear()).padStart(4, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as CalendarDate
}

/**
 * The props every month grid shares: the token classes, the app's month-button names, the day
 * name (with `busy` where a day has marks), and no CSS file.
 */
export function useCalendarProps(
  marks: CalendarMarks = NO_MARKS,
): Pick<DayPickerProps, 'classNames' | 'labels' | 'components' | 'formatters' | 'showOutsideDays'> {
  const t = useMessages(dateMessages)
  const format = useFormat()
  const { locale } = useCalendarDefaults()
  // DayPicker formats with date-fns' English unless handed a locale object; Intl in the app's locale
  // keeps the caption and the weekday names in the language the week start already follows.
  const caption = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const previous = t('date.previousMonth')
  const next = t('date.nextMonth')
  return {
    classNames: CALENDAR_CLASSES,
    labels: {
      labelPrevious: () => previous,
      labelNext: () => next,
      // The visible text is the day number, so the name must contain it as a word ("5th" does not).
      labelDayButton: (day) => {
        const iso = toCalendarDate(day)
        const name = format.date(iso, 'long')
        // The dots are hidden from assistive tech, so a day with marks says so in its name.
        return marksOf(marks, iso).length === 0 ? name : `${name}, ${t('date.busy')}`
      },
    },
    components: {
      Chevron: (p) => createElement(Chevron, p.orientation ? { orientation: p.orientation } : {}),
      DayButton: CalendarDayButton,
    },
    formatters: {
      formatCaption: (month) => caption.format(month),
      formatWeekdayName: (day) => weekday.format(day),
    },
    showOutsideDays: true,
  }
}
