---
name: Calendar
use when: 'a month is shown inline: a mini month beside a schedule, or a page''s day picker with no field'
never when: 'a form field picks a day (use `DatePicker`), or the page shows events by the hour (use `Schedule` from `basalt-ui/cards`)'
subpath: basalt-ui/ui/calendar
peers: [react-day-picker]
slots: [calendar]
---

# Calendar

A month of days, inline: no field and no popup. Use it for a mini month beside a schedule or a
page's own day picker. Arrow keys move by day and week, Page Up and Down by month, Shift with Page
by year, Home and End to the week's ends, and a click or Enter picks a day. A day in `marks` gets
up to three dots and says busy in its name, so a color never carries the meaning alone.

## Props

### `Calendar`

```ts
Calendar(props: CalendarProps): ReactElement
  // either aria-label, aria-labelledby, mode + aria-label or mode + aria-labelledby
  size?: "sm" | "md"  // `md` is the 36 px cell; `sm` the 32 px cell for a narrow rail
  weekStart?: Weekday  // The first day of each row, 0 Sunday to 6 Saturday
  month?: `${number}-${number}-${number}`  // Any day of the month to show
  onMonthChange?: (firstOfMonth: CalendarDate) => void  // Called with the first day of the month the user moves to
  defaultMonth?: `${number}-${number}-${number}`  // The month to open on when `month` is not given
  today?: `${number}-${number}-${number}`  // The day marked as today
  marks?: Readonly<Partial<Record<`${number}-${number}-${number}`, Tone | readonly Tone[]>>>  // Per-day dots: one tone or a list, at most three drawn; a marked day's name says busy
  disabled?: (day: CalendarDate) => boolean  // Days that cannot be picked
  className?: string  // Layout only (`w-64`)
  mode?: "single" | "range"
  value?: `${number}-${number}-${number}` | null | CalendarRange  // The picked day as `YYYY-MM-DD`, or null
  onValueChange?: (day: CalendarDate) => void | (range: CalendarRange) => void  // Called with the clicked or keyed-in day, as `YYYY-MM-DD`
  aria-label: string
  aria-labelledby: string
```

## `calendarVariants`

Part `calendar`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `calendar`
