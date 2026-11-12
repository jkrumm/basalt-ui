import { cva } from 'class-variance-authority'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { DayPicker } from 'react-day-picker'
import type { ClassNames, DateRange, DayPickerProps } from 'react-day-picker'
import { cn } from '../core/cn'
import type { CalendarDate } from '../core/format'
import { useFormat } from '../core/format'
import { date as dateMessages } from '../core/messages/date'
import { useMessages } from '../core/messages/use-messages'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/**
 * The trigger's cva table: a field-shaped button on the input surface that shows the picked day
 * (or the placeholder) and opens the calendar. It is the root element of `DatePicker` and
 * `DateRangePicker`. Coarse pointers get the 44 px floor and 16 px text.
 *
 * @example
 * datePickerVariants() // class string for a hand-built trigger
 */
export const datePickerVariants = cva(
  'flex h-ctl w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-ctrl border border-input bg-background px-3 text-left text-sm text-foreground tabular-nums focus-ring transition-colors data-placeholder:text-faint data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const datePickerParts = ['date-picker', 'date-range-picker'] as const

/** The month grid inside the popup: day cells are 36 px (44 px on a coarse pointer) so it fits a phone at 320 px. */
const CALENDAR_ROOT =
  'relative w-fit text-sm text-foreground select-none [--cell:--spacing(9)] pointer-coarse:[--cell:--spacing(11)]'

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
    'inline-flex size-(--cell) cursor-pointer items-center justify-center rounded-ctrl tabular-nums focus-ring hover:bg-accent group-data-today/day:font-semibold group-data-today/day:text-primary group-data-outside/day:text-faint group-data-disabled/day:pointer-events-none group-data-disabled/day:opacity-50 group-data-selected/day:bg-primary group-data-selected/day:text-primary-foreground group-data-selected/day:hover:bg-primary/90',
  range_middle: 'bg-accent',
  range_start: 'rounded-l-ctrl bg-accent',
  range_end: 'rounded-r-ctrl bg-accent',
}

type Layout = {
  /** Layout only (`w-48`, `flex-1`). Height belongs to the trigger. */
  className?: string
  /** The trigger's `id`, so a `<label htmlFor>` can name it. */
  id?: string
  disabled?: boolean
  /** Shown in the trigger while no day is picked. Default: the English or app-supplied message. */
  placeholder?: string
}

/** The accessible name a picker must carry: a label, or the id of one. */
export type DatePickerName = { 'aria-label': string } | { 'aria-labelledby': string }

type OpenState = {
  /** Controlled open state; pair it with `onOpenChange`. */
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

export type DatePickerProps = Layout &
  OpenState &
  DatePickerName & {
    /** The picked day as `YYYY-MM-DD`, or null. Never a `Date`. Omit it to leave the picker uncontrolled. */
    value?: CalendarDate | null
    defaultValue?: CalendarDate | null
    /** Called with the clicked day, as `YYYY-MM-DD`. */
    onChange?: (value: CalendarDate) => void
  }

/** A range of days. Both ends are `YYYY-MM-DD`; a half range is only ever a value you pass in. */
export type CalendarRange = { from: CalendarDate; to: CalendarDate }

export type DateRangePickerProps = Layout &
  OpenState &
  DatePickerName & {
    /** The picked range, or null. Either end may be missing when you restore a half range. */
    value?: { from?: CalendarDate | null; to?: CalendarDate | null } | null
    defaultValue?: { from?: CalendarDate | null; to?: CalendarDate | null } | null
    /** Called once both ends are picked, never with a half range. */
    onChange?: (value: CalendarRange) => void
  }

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A `YYYY-MM-DD` day as the local-noon `Date` DayPicker works in. DayPicker reads dates in the
 * runtime's zone, so building the local day (never `new Date('2026-11-20')`, which is UTC midnight
 * and lands on the 19th west of UTC) keeps the day that was stored. Noon, not midnight, so no
 * daylight-saving gap can move it.
 */
function toLocalDate(day: CalendarDate | null | undefined): Date | undefined {
  const m = typeof day === 'string' ? ISO_DAY.exec(day) : null
  if (m === null || typeof day !== 'string') return undefined
  const local = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  // `2026-02-31` rolls to March in `Date`: a day that does not exist is no day.
  return toCalendarDate(local) === day ? local : undefined
}

/** The local calendar day DayPicker hands back, as `YYYY-MM-DD`. */
function toCalendarDate(d: Date): CalendarDate {
  const year = String(d.getFullYear()).padStart(4, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as CalendarDate
}

function useOpenState({ open, defaultOpen, onOpenChange }: OpenState): {
  open: boolean
  setOpen: (next: boolean) => void
} {
  const [inner, setInner] = useState(defaultOpen ?? false)
  return {
    open: open ?? inner,
    setOpen: (next) => {
      setInner(next)
      onOpenChange?.(next)
    },
  }
}

function Chevron({ orientation }: { orientation?: string }): ReactElement {
  const d = orientation === 'right' ? 'M6 4l4 4-4 4' : 'M10 4L6 8l4 4'
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CalendarGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-icon shrink-0 text-muted-foreground"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

/** The props both calendars share: the token classes, the app's month-button names, no CSS file. */
function useCalendarProps(): Pick<
  DayPickerProps,
  'classNames' | 'labels' | 'components' | 'showOutsideDays'
> {
  const t = useMessages(dateMessages)
  const format = useFormat()
  const previous = t('date.previousMonth')
  const next = t('date.nextMonth')
  return {
    classNames: CALENDAR_CLASSES,
    labels: {
      labelPrevious: () => previous,
      labelNext: () => next,
      // The visible text is the day number, so the name must contain it as a word ("5th" does not).
      labelDayButton: (day) => format.date(toCalendarDate(day), 'long'),
    },
    components: {
      Chevron: (p) => <Chevron {...(p.orientation && { orientation: p.orientation })} />,
    },
    showOutsideDays: true,
  }
}

/** A trigger that names itself and its value, and the named popup that holds the calendar. */
function PickerShell({
  slot,
  text,
  placeholder,
  name,
  layout,
  open,
  setOpen,
  children,
}: {
  slot: 'date-picker' | 'date-range-picker'
  text: string | null
  placeholder: string
  name: DatePickerName
  layout: Pick<Layout, 'className' | 'id' | 'disabled'>
  open: boolean
  setOpen: (next: boolean) => void
  children: ReactElement
}): ReactElement {
  const autoId = useId()
  const id = layout.id ?? autoId
  const shown = text ?? placeholder
  // The trigger's own text is the value, so its name is the label followed by that value.
  const triggerName =
    'aria-label' in name
      ? { 'aria-label': `${name['aria-label']}: ${shown}` }
      : { 'aria-labelledby': `${name['aria-labelledby']} ${id}` }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger is named by aria-label or aria-labelledby spread below, and holds the value as text
        render={<button type="button" data-slot={slot} />}
        id={id}
        disabled={layout.disabled === true}
        {...(text === null && { 'data-placeholder': '' })}
        {...triggerName}
        className={cn(datePickerVariants(), layout.className)}
      >
        <span className="truncate">{shown}</span>
        <CalendarGlyph />
      </PopoverTrigger>
      <PopoverContent {...name} align="start" className="w-auto">
        {children}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Pick one day in a popover calendar. `value` and `onChange` are `YYYY-MM-DD` strings (the
 * `CalendarDate` type), never a `Date`: nothing in the string carries a zone, so the day you store
 * is the day every reader sees, in Los Angeles and in Tokyo alike. The trigger prints it in UTC
 * through the app's `Format`. Arrow keys move by day, Page Up and Down by month, Escape closes.
 * `DateRangePicker` takes the same strings for a from and to day and reports a range only when both ends exist.
 * `react-day-picker` is an optional peer of this module alone; nothing in a barrel imports it.
 *
 * @useWhen the user picks one calendar day (a due date, a birthday, a report day)
 * @neverWhen a time of day or a time zone matters (the value has neither) or the user picks a span (use `DateRangePicker`)
 *
 * @example
 * const [day, setDay] = useState<CalendarDate | null>(null)
 * <DatePicker aria-label="Due date" value={day} onChange={setDay} />
 */
export function DatePicker({
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
  id,
  disabled,
  open,
  defaultOpen,
  onOpenChange,
  ...name
}: DatePickerProps): ReactElement {
  const t = useMessages(dateMessages)
  const format = useFormat()
  const calendar = useCalendarProps()
  const [inner, setInner] = useState<CalendarDate | null>(defaultValue ?? null)
  const selected = toLocalDate(value === undefined ? inner : value)
  const picked = selected === undefined ? null : toCalendarDate(selected)
  const state = useOpenState({ open, defaultOpen, onOpenChange })
  return (
    <PickerShell
      slot="date-picker"
      text={picked === null ? null : format.date(picked)}
      placeholder={placeholder ?? t('date.placeholder')}
      name={name}
      layout={{
        ...(className !== undefined && { className }),
        ...(id !== undefined && { id }),
        ...(disabled !== undefined && { disabled }),
      }}
      open={state.open}
      setOpen={state.setOpen}
    >
      <DayPicker
        {...calendar}
        className={CALENDAR_ROOT}
        mode="single"
        required
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus enters the day grid when the popup opens, so arrow keys work at once
        autoFocus
        selected={selected}
        {...(selected !== undefined && { defaultMonth: selected })}
        onSelect={(day) => {
          const next = toCalendarDate(day)
          setInner(next)
          onChange?.(next)
          state.setOpen(false)
        }}
      />
    </PickerShell>
  )
}

/**
 * Pick a span of days in a popover calendar. The same zone-less `YYYY-MM-DD` strings as
 * `DatePicker`. `onChange` fires once, when both ends are picked: the first click only starts a
 * range (a half range is never reported, so a URL never holds one). Picking the same day twice is
 * a one-day range. Clicking again after a full range starts a new one. The trigger prints both ends
 * in UTC through the app's `Format`.
 *
 * @useWhen the user picks a from and to day (a report window, a custom date filter)
 * @neverWhen the user picks one day (use `DatePicker`)
 *
 * @example
 * <DateRangePicker aria-label="Report window" value={range} onChange={setRange} />
 */
export function DateRangePicker({
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
  id,
  disabled,
  open,
  defaultOpen,
  onOpenChange,
  ...name
}: DateRangePickerProps): ReactElement {
  const t = useMessages(dateMessages)
  const calendar = useCalendarProps()
  const [inner, setInner] = useState(defaultValue ?? null)
  // The first click of a new range lives here: it is not a value until the second click.
  const [draft, setDraft] = useState<DateRange | undefined>()
  const picked = value === undefined ? inner : value
  const fromDate = toLocalDate(picked?.from)
  const toDate = toLocalDate(picked?.to)
  const state = useOpenState({
    open,
    defaultOpen,
    onOpenChange: (next) => {
      setDraft(undefined)
      onOpenChange?.(next)
    },
  })
  const from = fromDate === undefined ? null : toCalendarDate(fromDate)
  const to = toDate === undefined ? null : toCalendarDate(toDate)
  const selected: DateRange | undefined =
    draft ?? (fromDate === undefined ? undefined : { from: fromDate, to: toDate })
  const text =
    from !== null && to !== null
      ? t('date.range', from, to)
      : from !== null
        ? t('date.rangeStart', from)
        : null
  return (
    <PickerShell
      slot="date-range-picker"
      text={text}
      placeholder={placeholder ?? t('date.rangePlaceholder')}
      name={name}
      layout={{
        ...(className !== undefined && { className }),
        ...(id !== undefined && { id }),
        ...(disabled !== undefined && { disabled }),
      }}
      open={state.open}
      setOpen={state.setOpen}
    >
      <DayPicker
        {...calendar}
        className={CALENDAR_ROOT}
        mode="range"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus enters the day grid when the popup opens, so arrow keys work at once
        autoFocus
        resetOnSelect
        selected={selected}
        {...(selected?.from !== undefined && { defaultMonth: selected.from })}
        onSelect={(range) => {
          setDraft(range)
          // Both ends or nothing: the first click of a range is a draft, never a value.
          if (range?.from === undefined || range.to === undefined) return
          const next: CalendarRange = {
            from: toCalendarDate(range.from),
            to: toCalendarDate(range.to),
          }
          setInner(next)
          onChange?.(next)
          state.setOpen(false)
        }}
      />
    </PickerShell>
  )
}
