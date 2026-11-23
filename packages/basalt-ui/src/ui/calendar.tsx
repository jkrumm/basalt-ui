import { cva } from 'class-variance-authority'
import { useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { cn } from '../core/cn'
import type { CalendarDate } from '../core/format'
import { startOfMonth, todayIn, useCalendarDefaults } from '../core/zoned'
import type { Weekday } from '../core/zoned'
import {
  MarksContext,
  NO_MARKS,
  toCalendarDate,
  toLocalDate,
  useCalendarProps,
} from './calendar-grid'
import type { CalendarMarks, CalendarRange } from './calendar-grid'

export type { CalendarRange } from './calendar-grid'

const subscribeNever = (): (() => void) => () => {}

/** The client clock, read once after mount: a server render never reads it, so the markup matches on hydration. */
function useClientClock(): number | null {
  const at = useRef<number | null>(null)
  return useSyncExternalStore(
    subscribeNever,
    () => (at.current ??= Date.now()),
    () => null,
  )
}

/**
 * The root's cva table: the month grid's width and its day cell size. `md` is a 36 px cell and `sm` a
 * 32 px cell for a 280 px rail. A coarse pointer gets the 44 px floor at both sizes. The cell is a
 * custom property every grid class reads, so one size class sets every cell.
 *
 * @example
 * calendarVariants({ size: 'sm' }) // class string for a hand-built month grid
 */
export const calendarVariants = cva('relative w-fit text-sm text-foreground select-none', {
  variants: {
    size: {
      md: '[--cell:--spacing(9)] pointer-coarse:[--cell:--spacing(11)]',
      sm: '[--cell:--spacing(8)] pointer-coarse:[--cell:--spacing(11)]',
    },
  },
  defaultVariants: { size: 'md' },
})

/** The accessible name a calendar must carry: a label, or the id of one. */
export type CalendarName = { 'aria-label': string } | { 'aria-labelledby': string }

type CalendarShared = {
  /** `md` is the 36 px cell; `sm` the 32 px cell for a narrow rail. A coarse pointer gets 44 px in both. */
  size?: 'md' | 'sm'
  /** The first day of each row, 0 Sunday to 6 Saturday. Default: the app's locale week start. */
  weekStart?: Weekday
  /** Any day of the month to show. Pair it with `onMonthChange`: the caller then owns the month. */
  month?: CalendarDate
  /** Called with the first day of the month the user moves to. */
  onMonthChange?: (firstOfMonth: CalendarDate) => void
  /** The month to open on when `month` is not given. Default: the value's month, else today's. */
  defaultMonth?: CalendarDate
  /** The day marked as today. Default: today in the app's time zone. */
  today?: CalendarDate
  /** Per-day dots: one tone or a list, at most three drawn; a marked day's name says busy. */
  marks?: CalendarMarks
  /** Days that cannot be picked. */
  disabled?: (day: CalendarDate) => boolean
  /** Layout only (`w-64`). The size belongs to `size`. */
  className?: string
}

type CalendarSingle = {
  mode?: 'single'
  /** The picked day as `YYYY-MM-DD`, or null. Omit it to let the calendar keep its own pick. */
  value?: CalendarDate | null
  /** Called with the clicked or keyed-in day, as `YYYY-MM-DD`. */
  onChange?: (day: CalendarDate) => void
}

type CalendarRangeSelection = {
  mode: 'range'
  /** The picked span, or null. Omit it to let the calendar keep its own pick. */
  value?: CalendarRange | null
  /** Called once both ends are picked, never with a half range. */
  onChange?: (range: CalendarRange) => void
}

export type CalendarProps = CalendarShared &
  (CalendarSingle | CalendarRangeSelection) &
  CalendarName

/** The one set of parts this module renders; `calendar` is its root. Read by the generator for `SLOTS`. */
export const calendarParts = ['calendar'] as const

/**
 * A month of days, inline: no field and no popup. Use it for a mini month beside a schedule or a
 * page's own day picker. Arrow keys move by day and week, Page Up and Down by month, Shift with Page
 * by year, Home and End to the week's ends, and a click or Enter picks a day. A day in `marks` gets
 * up to three dots and says busy in its name, so a colour never carries the meaning alone.
 *
 * @useWhen a month is shown inline: a mini month beside a schedule, or a page's day picker with no field
 * @neverWhen a form field picks a day (use `DatePicker`), or the page shows events by the hour (use `Schedule` from `basalt-ui/cards`)
 *
 * @example
 * <Calendar aria-label="November" month={month} onMonthChange={setMonth} marks={{ '2026-11-24': ['warn'] }} />
 */
export function Calendar(props: CalendarProps): ReactElement {
  const {
    size,
    weekStart,
    month,
    onMonthChange,
    defaultMonth,
    today: todayProp,
    marks = NO_MARKS,
    disabled,
    className,
  } = props
  const defaults = useCalendarDefaults()
  const clock = useClientClock()
  const today = todayProp ?? (clock === null ? undefined : todayIn(clock, defaults.timeZone))
  const calendar = useCalendarProps(marks)
  // Uncontrolled, the calendar keeps its own pick; a `value` the caller passes always wins.
  const [inner, setInner] = useState<CalendarDate | CalendarRange | null>(null)
  // The first click of a range is a draft: it is not a value until the second click.
  const [draft, setDraft] = useState<DateRange | undefined>()
  const value = props.value === undefined ? inner : props.value
  const day = typeof value === 'string' ? value : null
  const span = typeof value === 'object' && value !== null ? value : null
  const onDayChange = props.mode === 'range' ? undefined : props.onChange
  const onRangeChange = props.mode === 'range' ? props.onChange : undefined
  const rangeSelected: DateRange | undefined =
    draft ??
    (span === null ? undefined : { from: toLocalDate(span.from), to: toLocalDate(span.to) })
  const first = defaultMonth ?? day ?? span?.from ?? today
  const shownMonth = toLocalDate(month ?? first)
  const todayDate = toLocalDate(today)
  const selectedDay = toLocalDate(day)
  const shared = {
    ...calendar,
    weekStartsOn: weekStart ?? defaults.weekStart,
    ...(shownMonth !== undefined &&
      (month === undefined ? { defaultMonth: shownMonth } : { month: shownMonth })),
    ...(todayDate !== undefined && { today: todayDate }),
    ...(disabled !== undefined && { disabled: (d: Date) => disabled(toCalendarDate(d)) }),
    onMonthChange: (d: Date) => onMonthChange?.(startOfMonth(toCalendarDate(d))),
  }
  const grid =
    props.mode === 'range' ? (
      <DayPicker
        {...shared}
        mode="range"
        resetOnSelect
        {...(rangeSelected !== undefined && { selected: rangeSelected })}
        onSelect={(range) => {
          setDraft(range)
          // Both ends or nothing: the first click of a range is a draft, never a value.
          if (range?.from === undefined || range.to === undefined) return
          setDraft(undefined)
          const next: CalendarRange = {
            from: toCalendarDate(range.from),
            to: toCalendarDate(range.to),
          }
          setInner(next)
          onRangeChange?.(next)
        }}
      />
    ) : (
      <DayPicker
        {...shared}
        mode="single"
        required
        selected={selectedDay}
        onSelect={(picked) => {
          if (picked === undefined) return
          const next = toCalendarDate(picked)
          setInner(next)
          onDayChange?.(next)
        }}
      />
    )
  // The name goes on the group, not the grid: DayPicker's own roles stay as it renders them.
  const named =
    'aria-labelledby' in props
      ? { 'aria-labelledby': props['aria-labelledby'] }
      : { 'aria-label': props['aria-label'] }
  return (
    <fieldset
      data-slot="calendar"
      {...named}
      className={cn(calendarVariants({ size }), 'min-w-0', className)}
    >
      <MarksContext.Provider value={marks}>{grid}</MarksContext.Provider>
    </fieldset>
  )
}
