---
name: DataPanel
use when: 'a page needs the card frame around a table, a row list or a board, with a header, controls and a legend'
never when: 'the body is a chart (use a chart card) or a single figure (use a stat card or a stat cell)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [data-panel, data-panel-rows, data-panel-toolbar]
---

# DataPanel

The frame for a body that is not a chart: the same header and phase handling as the other cards,
around a table, a list or a board. The body is one box slot at a fixed height, declared by the
required `bodySize`, so a loading, empty or error panel is as tall as a ready one and
the body is called in `ready` and `stale`; in `empty` and `error` it is called too, so a table in it
keeps its column header row and draws the arm under it (a body that draws no table stays hidden
there and the panel draws its own arm). A `{ rows }` body whose table rows run past
the declared height shows whole rows: the rows are cut after the last one that fits, while the
box keeps the declared height in every phase. A `rows` count is table rows at the desktop height
(the head row included): where the table folds to phone cards, the box is as tall as that many data
rows of cards (so declare the rows the desktop table needs, not the cards' height) and a shorter
list ends at its last card. A loading frame has no cards to measure: it is that many card-high
blocks (one 92 px card each) until a list has been measured, then the height it had; the panel
never runs the body in loading. The box clips with `overflow: clip`, never
`hidden`, so a table head that sticks to the page keeps sticking.

## Signature

```ts
DataPanel(props: DataPanelProps): ReactElement
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  controls?: ControlsSlot<"widget">
  toolbar?: ControlsSlot<"widget">
  menu?: CardMenu
  legend?: readonly LegendEntry[]
  bodySize: { rows: number; } | { height: number; }  // Required: the loading card draws its final shape
  body: BoxSlot  // Tables, lists and boards
```

`Phase`, `QueryStateLike`, `Empty`, `CardMenu` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike, Empty, CardMenu } from 'basalt-ui/cards'`.

## Example

```tsx
<DataPanel
  title="Open pull requests"
  subtitle="by age"
  phase={query}
  empty={rows.length ? null : { cause: 'Nothing open' }}
  bodySize={{ rows: 6 }}
  body={(box) => <PullTable rows={rows} height={box.height} />}
/>
```
