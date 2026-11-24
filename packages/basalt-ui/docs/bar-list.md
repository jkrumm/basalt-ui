---
name: BarList
use when: 'a card ranks a handful of named things by one number, or splits a total into its parts (a top-N list, a breakdown that replaces a donut), or ranks long names by a total stacked by kind (horizontal stacked bars)'
never when: 'the rows have several columns to compare (use a table) or the list is a stream of things that happened (use an event list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [bar-list, bar-list-live, bar-list-row, bar-list-scroll-cue]
---

# BarList

A ranked list on one shared scale: label, a thin bar against the largest value, the value as
text and an optional muted second figure (`secondary`: a share, a status word, or the counts a
stacked row's segments carry, "11 gained, 9 dropped"). Each row is a link, a button or plain text. It holds
one body height at every phase, scrolls past `bodyRows`, and its loading skeleton draws the rows it
will become. Colour belongs to a verdict, so a single bar is neutral; a row with `parts` stacks
them in the colours of `series`, and the name stays on its own line above the bar at every width.

## Signature

```ts
BarList<I = unknown>(props: BarListProps<I>): ReactElement
  // either focus, focusSeries or focusItems
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  focus?: ListFocus<unknown>  // A chart's focus (`useChartFocus(items, …)`): row i is `focus.items[i]`, so pass the list in the same order as the chart's items
  focusSeries?: { focus: { readonly setSeries: (key: string | null) => void; readonly seriesItem: (key: string) => ListFocusItem; }; key: (row: BarListItem) => string; }  // A chart's focus whose series the rows stand for (a row per request kind beside bars stacked by the model that served it): `key` maps a row to its series key
  focusItems?: { focus: ListFocus<I>; holds: (row: BarListItem, item: I) => boolean; }  // A chart's focus over items of another grain: `holds(row, item)` is true for every item the row stands for (the hours of a window, the probes under a service), never by position
  items: readonly BarListItem[]  // Rows in display order: sort them yourself, the list does not reorder
  max?: number  // The scale end every bar fills against
  bodyRows?: number  // The body holds this many rows of height at every phase; more rows scroll
  format?: (value: number) => string  // Formats each value
  series?: readonly LegendEntry[]  // The series a row's `parts` stack by: their order (first at the bar's start), their colour and a legend row under the header
  legend?: false  // `false` draws no legend row for `series`: the page's one legend sits elsewhere (a `ChartCard legend` beside it keys the same colours), so the card does not repeat it
  mono?: boolean  // Draw every label in the mono face with tabular figures: ids, hashes, paths
```

`BarListProps`, `Empty`, `LegendEntry`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { BarListProps, Empty, LegendEntry, Phase, QueryStateLike } from 'basalt-ui/cards'`.

## Example

```tsx
<BarList
  title="Top projects"
  subtitle="by tokens"
  items={[{ label: 'argo', value: 1840, href: '/argo' }, { label: 'rb', value: 920 }]}
  phase={query}
/>
```
