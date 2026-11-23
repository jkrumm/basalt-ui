---
name: periodOf
use when: 'a list of moments is headed by calendar period (a mailbox''s day groups, an activity feed''s This week and Earlier this month)'
never when: 'the grouping is by an exact day key only (group on `f.date(at, ''short'')`), or the moments are not in a time zone you can name'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# periodOf

The bucket a moment belongs to, read on the calendar of `now`: today and yesterday (unless
`days: false`), then the rest of this week, the earlier days of this month, each earlier month of
this year by name, and every earlier year by its number. A moment after the week ends keeps its
own month or year. One pure function, so a day-grouped list elsewhere (a mailbox) reads the same
boundaries; `now` is the caller's, never the clock's, so a server and a client agree.

## Signature

```ts
periodOf(at: Date, now: Date, options?: PeriodOptions): Period
```

## Example

```tsx
periodOf(new Date('2026-08-03'), new Date('2026-11-23')).key // '2026-08'
```
