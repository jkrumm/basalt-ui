---
name: RowList
use when: 'the rows are things of one kind, each with a name, an optional second line, a verdict and a figure, shown beside a chart that draws the same items (ids with ages, windows with hours, resources with a hop)'
never when: 'the rows have several columns to compare (use a table), rank by one number with a bar (use a bar list) or are a stream of things that happened (use an event list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [row-list, row-list-row, row-list-scroll-cue]
---

# RowList

A list of rows beside a chart: a label with a muted word and a second line, a verdict dot and
word, and a figure at the end. Quiet by default: rows are separated by spacing, the hovered or
focused row takes a surface, and `separator="hairline"` opts in to a rule in the grid token. Each
row is a link, a button or plain text. Pass the chart's `useChartFocus` as `focus` and a row and
its mark are one item. It holds one body height at every phase, scrolls past `bodyRows` and its
loading skeleton draws the rows it will become.

## Signature

```ts
RowList(props: RowListProps): ReactElement
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  items: readonly RowListItem[]  // Rows in display order: the list never re-sorts
  bodyRows?: number  // The body holds this many rows of height at every phase; more rows scroll
  lines?: 2 | 1  // Lines per row, 1 or 2 (a row with a `detail` or `valueDetail` is two)
  mono?: boolean  // Draw every label in the mono face with tabular figures: ids, hashes, paths
  separator?: "hairline" | "none"  // What sits between rows
  focus?: ListFocus<unknown>  // A chart's focus (`useChartFocus(items, …)`): row i is `focus.items[i]`, so pass the rows in the same order as the chart's items
```

`Empty`, `Phase`, `QueryStateLike`, `RowListProps` import from `basalt-ui/cards`: `import type { Empty, Phase, QueryStateLike, RowListProps } from 'basalt-ui/cards'`.

## Example

```tsx
<RowList
  title="Open Issues"
  items={[
    {
      label: 'issue_2283',
      meta: 'building',
      detail: 'Lists: a bare border',
      value: '3.1 d',
      valueDetail: '2.4× typical',
    },
  ]}
  lines={2}
  mono
  focus={focus}
  phase={query}
/>
```
