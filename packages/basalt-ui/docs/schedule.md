---
name: Schedule
use when: 'dated events with a start and an end are read by the day and the hour: deliveries, calls, shifts, bookings'
never when: 'the events are a feed in time order with no grid (use EventList), or spans on rows over one axis are compared (use IntervalTrack)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [schedule, schedule-error, schedule-header, schedule-range]
---

# Schedule

Events on a calendar: a week or a day by the hour, or a month of days, with the now line, a
header that moves through time and an optional rail with the mini month and the next events.
The view and the shown day are URL fields, so a shared link opens the same week. Instants are
placed in the zone and the week start of the app's format defaults (`BasaltProvider`
`timeZone` and `locale`). Each event is a record link when `href` is given, so the app's
`usePeek` opens it beside the schedule, the URL holds it and Escape returns focus to it.

## Signature

```ts
Schedule<E extends ScheduleEvent>(props: ScheduleProps<E>): ReactElement
  label: string  // The schedule's accessible name
  events: readonly E[]  // `undefined` while the first load runs: the grid draws with no events
  phase?: Phase | QueryStateLike  // The load state, as on every frame: a `Phase` or a query result
  view: FieldOf<ScheduleView>  // `field.enum(['week', 'month', 'day'], 'week')`: the view lives in the URL
  date: FieldOf<string>  // `field.string('')`: the shown day as `YYYY-MM-DD`, empty for today
  href?: ((event: E) => string | NavTarget)  // The event's record page: each event is a link, so `usePeek` opens it and the URL holds it
  onOpen?: ((id: string) => void)  // Called with the event's id when it is activated (with `href` too, before the link runs)
  onSlot?: ((start: number) => void)  // Called with the start of an empty hour the user clicks; creating the event is the app's
  hours?: readonly [number, number]  // The hours the time grid spans, `[from, to)`
  scrollTo?: number  // The hour at the top of the time grid when it first draws
  rail?: false | { month?: MiniMonthLike | undefined; upNext?: number | undefined; }  // The rail beside the grid, from the wide container tier: `month` is the mini month (`Calendar` from `basalt-ui/ui/calendar`), `upNext` the count of next events (default 3)
  now?: number  // A fixed clock (a screenshot, a story)
```

`MiniMonthLike`, `Phase`, `QueryStateLike`, `ScheduleEvent`, `ScheduleProps` import from `basalt-ui/cards`: `import type { MiniMonthLike, Phase, QueryStateLike, ScheduleEvent, ScheduleProps } from 'basalt-ui/cards'`.

`NavTarget` import from `basalt-ui`: `import type { NavTarget } from 'basalt-ui'`.

## Example

```tsx
<Schedule
  label="Deliveries"
  events={query.data}
  phase={query}
  view={store.field.view}
  date={store.field.date}
  href={(e) => navTarget(linkOptions({ to: '/deliveries/$id', params: { id: e.id } }))}
  rail={{ month: Calendar }}
/>
```
