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
around a table, a list or a board. The body is one box slot at the height the required `bodySize`
declares, so a loading, empty or error panel is as tall as a ready one; in a grid row the panel
takes the row's height and the box grows past that floor, so the cards of a row end level and a
table shows the whole rows the taller box holds; a body shorter than the box (fewer rows than it
holds) takes the height of its rows, and in a stretched grid row it fills the box, its rows sharing the extra height,
so no band is left under its last row (a body that is no table keeps its own height and the extra sits below it). The body is called in `ready` and `stale`; in `empty` and `error` it is called too, so a table in it
keeps its column header row and draws the arm under it (a body that draws no table stays hidden
there and the panel draws its own arm). A `rows` count is table rows at the table's row height
(`--basalt-row-h`, the head row included), so the box is `rows` x that height: declare N data rows
as `rows: N + 1`, and the desktop box holds the head row and all N with no blank row; a table with
fewer rows than that takes the height of its rows once measured (the desktop box keeps the declared
height until then), so no blank row is left under the last, or the whole stretched box when a grid row grew the panel; a table
with more rows than the box shows whole rows, cut after the last that fits. Where the table folds to phone
cards the rows are taller than a table row (66 px, 74 px with a Details door), so the box is as tall as
the N data rows and a shorter list ends at its last row: every row is whole at 390 px. A loading
frame has no cards to measure: until a list has been measured it gives each data row one row (74 px, or `bodySize.cardHeight`),
then the height it had; the panel never runs the body in loading, so it cannot see that a table is `phone: 'columns'`: such a
table keeps its rows at 390 px, and its caller passes `bodySize.cardHeight` as that row (33 at the default density), or the
loading frame runs one 74 px row per row. A table body with `height="fill"`
takes the box's height and scrolls inside it, so a chart focus brings its joined row into view. The
box clips with `overflow: clip`, never `hidden`, so a table head that sticks to the page keeps sticking.

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
  bodySize: { rows: number; cardHeight?: number | undefined; } | { height: number; }  // Required: the loading card draws its final shape
  body: BoxSlot  // Tables, lists and boards
```

`CardMenu`, `DataPanelProps`, `Empty`, `LegendEntry`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { CardMenu, DataPanelProps, Empty, LegendEntry, Phase, QueryStateLike } from 'basalt-ui/cards'`.

`ControlsSlot` import from `basalt-ui/controls`: `import type { ControlsSlot } from 'basalt-ui/controls'`.

`BoxSlot`, `IconComponent` import from `basalt-ui`: `import type { BoxSlot, IconComponent } from 'basalt-ui'`.

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
