import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { cn } from '../core/cn'
import { scopeClass, useControlScope } from '../core/control-scope'
import type { CalendarDate } from '../core/format'
import { useFormat } from '../core/format'
import { date as dateMessages } from '../core/messages/date'
import { dialogs } from '../core/messages/dialogs'
import { useMessages } from '../core/messages/use-messages'
import { toCalendarDate, toLocalDate, useCalendarProps } from './calendar-grid'
import type { CalendarRange } from './calendar-grid'
import { Button } from './button'
import { useOverlay, useSheetPresent } from './overlay-presenter'
import type { OverlayPresent } from './overlay-presenter'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export type { CalendarRange } from './calendar-grid'

/** A picked day as `YYYY-MM-DD`, the type `value` and `onValueChange` take. Re-exported so a form types its field without `core/format`. */
export type { CalendarDate } from '../core/format'

/**
 * The trigger's cva table: a field-shaped button on the input surface that shows the picked day
 * (or the placeholder) and opens the calendar. It is the root element of `DatePicker` and
 * `DateRangePicker`. `size` takes the steps every field takes; coarse pointers get the 44 px floor and
 * 16 px text.
 *
 * @example
 * datePickerVariants({ size: 'sm' }) // class string for a hand-built trigger
 */
export const datePickerVariants = cva(
  'flex w-full min-w-0 items-center justify-between gap-2 rounded-ctrl border border-input bg-background text-left text-foreground tabular-nums focus-ring transition-colors aria-invalid:border-bad data-placeholder:text-faint data-disabled:opacity-50 pointer-coarse:text-base',
  {
    variants: {
      size: {
        md: 'h-ctl px-3 text-sm',
        sm: 'h-6 px-2 text-xs pointer-coarse:h-ctl',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const datePickerParts = ['date-picker', 'date-range-picker'] as const

/**
 * The month grid inside the popup: 36 px day cells (44 px on a coarse pointer), so it fits a phone at
 * 320 px. The same cell as `Calendar`'s `md` size, written here so the picker reaches the shared grid
 * through `calendar-grid` alone and never loads `ui/calendar`.
 */
const CALENDAR_ROOT =
  'relative mx-auto w-fit text-sm text-foreground select-none [--cell:--spacing(9)] pointer-coarse:[--cell:--spacing(11)]'

type Layout = VariantProps<typeof datePickerVariants> & {
  /** Layout only (`w-48`, `flex-1`). Height belongs to `size`. */
  className?: string
  /** The trigger's `id`, so a `<label htmlFor>` can name it. */
  id?: string
  disabled?: boolean
  /** Shown in the trigger while no day is picked. Default: the English or app-supplied message. */
  placeholder?: string
  /**
   * How the calendar opens: `auto` is a bottom sheet with a Done button on a phone (compact
   * width, coarse pointer) and the anchored popup elsewhere; `popup` and `sheet` force one.
   */
  present?: OverlayPresent
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
    onValueChange?: (value: CalendarDate) => void
    /** Called when the calendar closes, so a validator runs after the pick. */
    onBlur?: () => void
  }

export type DateRangePickerProps = Layout &
  OpenState &
  DatePickerName & {
    /** The picked range, or null. Either end may be missing when you restore a half range. */
    value?: { from?: CalendarDate | null; to?: CalendarDate | null } | null
    defaultValue?: { from?: CalendarDate | null; to?: CalendarDate | null } | null
    /** Called once both ends are picked, never with a half range. */
    onValueChange?: (value: CalendarRange) => void
    /** Called when the calendar closes, so a validator runs after the pick. */
    onBlur?: () => void
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
  layout: Pick<Layout, 'className' | 'id' | 'disabled' | 'size' | 'present'>
  open: boolean
  setOpen: (next: boolean) => void
  children: ReactElement
}): ReactElement {
  const autoId = useId()
  const scope = useControlScope()
  const phone = useSheetPresent('auto')
  // a calendar is a picker, not a panel: on a phone it is always a sheet
  const present: OverlayPresent = layout.present ?? (phone ? 'sheet' : 'popup')
  const id = layout.id ?? autoId
  const shown = text ?? placeholder
  // A FormField hands its control `aria-invalid`; it marks the trigger, never the popup.
  const { 'aria-invalid': invalid, ...popupName } = name as DatePickerName & {
    'aria-invalid'?: boolean | 'true' | 'false'
  }
  // The trigger's own text is the value, so its name is the label followed by that value.
  const triggerName =
    'aria-label' in popupName
      ? { 'aria-label': `${popupName['aria-label']}: ${shown}` }
      : { 'aria-labelledby': `${popupName['aria-labelledby']} ${id}` }
  return (
    <Popover open={open} onOpenChange={setOpen} present={present}>
      <PopoverTrigger
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger is named by aria-label or aria-labelledby spread below, and holds the value as text
        render={<button type="button" data-slot={slot} />}
        id={id}
        disabled={layout.disabled === true}
        {...(text === null && { 'data-placeholder': '' })}
        {...triggerName}
        {...(invalid !== undefined && { 'aria-invalid': invalid })}
        className={cn(
          datePickerVariants({ size: layout.size ?? scope?.size }),
          scopeClass(scope),
          layout.className,
        )}
      >
        <span className="truncate">{shown}</span>
        <CalendarGlyph />
      </PopoverTrigger>
      <PopoverContent {...(popupName as DatePickerName)} align="start" className="w-auto">
        {children}
        <SheetDone />
      </PopoverContent>
    </Popover>
  )
}

/** The Done button under a calendar presented as a sheet: the sheet has no anchor to click away from. */
function SheetDone(): ReactElement | null {
  const overlay = useOverlay()
  const t = useMessages(dialogs)
  if (overlay?.sheet !== true) return null
  return (
    <Button
      type="button"
      variant="primary"
      className="mt-3 w-full"
      onClick={() => overlay.setOpen(false)}
    >
      {t('sheet.done')}
    </Button>
  )
}

/**
 * Pick one day in a popover calendar. `value` and `onValueChange` are `YYYY-MM-DD` strings (the
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
 * <DatePicker aria-label="Due date" value={day} onValueChange={setDay} />
 */
export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  onBlur,
  placeholder,
  size,
  className,
  id,
  disabled,
  present,
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
  const state = useOpenState({
    open,
    defaultOpen,
    onOpenChange: (next) => {
      if (!next) onBlur?.()
      onOpenChange?.(next)
    },
  })
  return (
    <PickerShell
      slot="date-picker"
      text={picked === null ? null : format.date(picked)}
      placeholder={placeholder ?? t('date.placeholder')}
      name={name}
      layout={{
        size,
        ...(present !== undefined && { present }),
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
          onValueChange?.(next)
          state.setOpen(false)
        }}
      />
    </PickerShell>
  )
}

/**
 * Pick a span of days in a popover calendar. The same zone-less `YYYY-MM-DD` strings as
 * `DatePicker`. `onValueChange` fires once, when both ends are picked: the first click only starts a
 * range (a half range is never reported, so a URL never holds one). Picking the same day twice is
 * a one-day range. Clicking again after a full range starts a new one. The trigger prints both ends
 * in UTC through the app's `Format`.
 *
 * @useWhen the user picks a from and to day (a report window, a custom date filter)
 * @neverWhen the user picks one day (use `DatePicker`)
 *
 * @example
 * <DateRangePicker aria-label="Report window" value={range} onValueChange={setRange} />
 */
export function DateRangePicker({
  value,
  defaultValue,
  onValueChange,
  onBlur,
  placeholder,
  size,
  className,
  id,
  disabled,
  present,
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
      if (!next) onBlur?.()
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
        size,
        ...(present !== undefined && { present }),
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
          onValueChange?.(next)
          state.setOpen(false)
        }}
      />
    </PickerShell>
  )
}
