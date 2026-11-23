---
name: EventList
use when: 'a card lists activity, history or an audit trail in the order it happened'
never when: 'the rows are compared by columns (use a table) or ranked by one number (use a bar list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [event-list, event-list-day, event-list-header, event-list-more]
---

# EventList

A feed of things that happened, headed by day or (`group="period"`) by This week, Earlier this month,
month and year: a leading glyph or the actor's face joined to the next entry by a connector, the
actor and a sentence on line one, the time, a body and chips on line two. A long body folds to one
line with an expander. It reads in order; a table compares rows. It holds one
body height at every phase and scrolls past `bodyRows`. It never windows: it shows `pageSize` rows
and a "Show more" control, and warns once in development above 200 rows.

## Signature

```ts
EventList(props: EventListProps): ReactElement
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  items: readonly EventListItem[]  // Events in display order: the list never re-sorts
  bodyRows?: number  // The body holds this many rows of height at every phase; more rows scroll
  pageSize?: number  // Rows shown before, and added by each "Show more"
  group?: "day" | "period"  // How the feed is headed: `day` (default) is one header per day, Today and Yesterday first; `period` is This week, Earlier this month, then each month by name and each earlier year
  weekStartsOn?: 0 | 2 | 3 | 1 | 4 | 5 | 6  // The first day of the week for `group="period"`, 0 for Sunday
  now?: number | Date  // The instant "Today" is measured from
```

`Phase`, `QueryStateLike`, `Empty` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike, Empty } from 'basalt-ui/cards'`.

## Example

```tsx
<EventList
  title="Activity"
  items={[{ id: 'e1', at: Date.now(), actor: 'Ada', title: 'merged #482', chips: ['main'] }]}
  phase={query}
/>
```
