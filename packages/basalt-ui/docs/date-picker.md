---
name: DatePicker
use when: 'the user picks one calendar day (a due date, a birthday, a report day)'
never when: 'a time of day or a time zone matters (the value has neither) or the user picks a span (use `DateRangePicker`)'
subpath: basalt-ui/ui/date-picker
peers: ['@base-ui/react', react-day-picker]
slots: [date-picker, date-range-picker]
---

# DatePicker

Pick one day in a popover calendar. `value` and `onChange` are `YYYY-MM-DD` strings (the
`CalendarDate` type), never a `Date`: nothing in the string carries a zone, so the day you store
is the day every reader sees, in Los Angeles and in Tokyo alike. The trigger prints it in UTC
through the app's `Format`. Arrow keys move by day, Page Up and Down by month, Escape closes.
`DateRangePicker` takes the same strings for a from and to day and reports a range only when both ends exist.
`react-day-picker` is an optional peer of this module alone; nothing in a barrel imports it.

## Props

### `DatePicker`

Pick one day in a popover calendar. `value` and `onChange` are `YYYY-MM-DD` strings (the
`CalendarDate` type), never a `Date`: nothing in the string carries a zone, so the day you store
is the day every reader sees, in Los Angeles and in Tokyo alike. The trigger prints it in UTC
through the app's `Format`. Arrow keys move by day, Page Up and Down by month, Escape closes.
`DateRangePicker` takes the same strings for a from and to day and reports a range only when both ends exist.
`react-day-picker` is an optional peer of this module alone; nothing in a barrel imports it.

```ts
DatePicker({ value, defaultValue, onChange, onValueChange, onBlur, placeholder, size, className, id, disabled, open, defaultOpen, onOpenChange, ...name }: DatePickerProps): ReactElement
  // either aria-label or aria-labelledby
  size?: "sm" | "md" | null
  className?: string  // Layout only (`w-48`, `flex-1`)
  id?: string  // The trigger's `id`, so a `<label htmlFor>` can name it
  disabled?: boolean
  placeholder?: string  // Shown in the trigger while no day is picked
  open?: boolean  // Controlled open state; pair it with `onOpenChange`
  defaultOpen?: boolean
  onOpenChange?: ((open: boolean) => void)
  aria-label: string
  value?: `${number}-${number}-${number}` | null  // The picked day as `YYYY-MM-DD`, or null
  defaultValue?: `${number}-${number}-${number}` | null
  onChange?: (value: CalendarDate) => void  // Called with the clicked day, as `YYYY-MM-DD`
  onValueChange?: (value: CalendarDate) => void  // Same as `onChange`; a `FormField` hands this one
  onBlur?: () => void  // Called when the calendar closes, so a validator runs after the pick
  aria-labelledby: string
```

### `DateRangePicker`

Pick a span of days in a popover calendar. The same zone-less `YYYY-MM-DD` strings as
`DatePicker`. `onChange` fires once, when both ends are picked: the first click only starts a
range (a half range is never reported, so a URL never holds one). Picking the same day twice is
a one-day range. Clicking again after a full range starts a new one. The trigger prints both ends
in UTC through the app's `Format`.

```ts
DateRangePicker({ value, defaultValue, onChange, onValueChange, onBlur, placeholder, size, className, id, disabled, open, defaultOpen, onOpenChange, ...name }: DateRangePickerProps): ReactElement
  // either aria-label or aria-labelledby
  size?: "sm" | "md" | null
  className?: string  // Layout only (`w-48`, `flex-1`)
  id?: string  // The trigger's `id`, so a `<label htmlFor>` can name it
  disabled?: boolean
  placeholder?: string  // Shown in the trigger while no day is picked
  open?: boolean  // Controlled open state; pair it with `onOpenChange`
  defaultOpen?: boolean
  onOpenChange?: ((open: boolean) => void)
  aria-label: string
  value?: { from?: CalendarDate | null; to?: CalendarDate | null; } | null  // The picked range, or null
  defaultValue?: { from?: CalendarDate | null; to?: CalendarDate | null; } | null
  onChange?: (value: CalendarRange) => void  // Called once both ends are picked, never with a half range
  onValueChange?: (value: CalendarRange) => void  // Same as `onChange`; a `FormField` hands this one
  onBlur?: () => void  // Called when the calendar closes, so a validator runs after the pick
  aria-labelledby: string
```

## `datePickerVariants`

Part `date-picker`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `date-picker`
- `date-range-picker`
