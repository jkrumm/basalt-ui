---
name: BarList
use when: 'a card ranks a handful of named things by one number, or splits a total into its parts (a top-N list, a breakdown that replaces a donut)'
never when: 'the rows have several columns to compare (use a table) or the list is a stream of things that happened (use an event list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [bar-list, bar-list-row]
---

# BarList

A ranked list on one shared scale: label, a thin bar against the largest value, the value as
text and an optional muted second figure. Each row is a link, a button or plain text. It holds
one body height at every phase, scrolls past `rows`, and its loading skeleton draws the rows it
will become. Colour belongs to a verdict, so every bar is neutral.

## Signature

```ts
BarList(props: BarListProps): ReactElement
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  items: readonly BarListItem[]
  max?: number
  rows?: ListRows
  format?: (value: number) => string
```
