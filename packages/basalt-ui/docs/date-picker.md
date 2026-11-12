---
name: DatePicker
use when: 'the user picks one calendar day (a due date, a birthday, a report day)'
never when: 'a time of day or a time zone matters (the value has neither) or the user picks a span (use `DateRangePicker`)'
subpath: basalt-ui/ui/date-picker
peers: ['@base-ui/react']
slots: [date-picker, date-range-picker]
---

# DatePicker

Pick one day in a popover calendar. `value` and `onChange` are `YYYY-MM-DD` strings (the
`CalendarDate` type), never a `Date`: nothing in the string carries a zone, so the day you store
is the day every reader sees, in Los Angeles and in Tokyo alike. The trigger prints it in UTC
through the app's `Format`. Arrow keys move by day, Page Up and Down by month, Escape closes.
`DateRangePicker` takes the same strings for a from and to day and reports a range only when both ends exist.
`react-day-picker` is an optional peer of this module alone; nothing in a barrel imports it.

## `datePickerVariants`

Part `date-picker`.

No variant axes.

## Slots

- `date-picker`
- `date-range-picker`
