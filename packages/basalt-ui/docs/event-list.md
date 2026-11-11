---
name: EventList
use when: 'a card lists activity, history or an audit trail in the order it happened'
never when: 'the rows are compared by columns (use a table) or ranked by one number (use a bar list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [event-list, event-list-day, event-list-header, event-list-more]
---

# EventList

A day-grouped feed of things that happened: a leading glyph, the actor and a sentence on line one,
the time, a body and chips on line two. It reads in order; a table compares rows. It holds one
body height at every phase and scrolls past `rows`. It never windows: it shows `pageSize` rows
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
  items: readonly EventListItem[]
  rows?: ListRows
  pageSize?: number
  now?: number | Date
```
