---
name: ChartCard
use when: 'a metric needs a chart with a title, a headline figure, controls or a footer around it'
never when: 'the content is a table, a list or a board (use a data panel) or a lone figure (use a stat card)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: [card, chart-card, chart-legend, inset]
---

# ChartCard

The frame every chart sits in: a header (icon, title, definition glyph, subtitle, controls, menu),
an inset holding the headline figure with its delta, period and verdict over the chart box, and an
optional footer of at most two facts. It owns the box and the phase: `chart` is a box slot called
only in `ready` and `stale`, in a clipping box the card sizes (its `height`, grown to a stretched
grid row), so a taller chart cannot move the card and a loading, empty or error card is as tall as
a ready one. With `phase="loading"` and no `chart` it is
a Suspense fallback that draws the same rows. A kind draws its own legend, in the server HTML; marks
a page draws through the seam take theirs from `legend`, a row between the figure and the box that
is drawn in every phase, so loading does not move the box.

## Signature

```ts
ChartCard(props: ChartCardProps): ReactElement
  // either title + chart, title + panes or phase
  empty?: Empty | null
  phase?: Phase | QueryStateLike  // A `Phase` or the query itself
  figure?: ChartFigure
  legend?: readonly LegendEntry[]  // The legend row for marks the page draws through the seam, drawn in every phase
  footer?: FootFacts
  controls?: ControlsSlot<"widget">
  menu?: CardMenu
  contextMenu?: boolean  // Whether a right click, a long press or Shift+F10 on the card opens its menu at the pointer
  height?: "auto" | "fill" | "tall" | "short"  // The chart box: `auto` (default) half the card width between 192 and 420 px; `tall` the same with a 288 px floor, for the chart that answers the page and needs its axis at 390; `short` 160 px; `fill` the card's remainder in a parent that sets the height
  bleed?: boolean  // Runs the plot to the card's edges on any size: the chart box leaves the inset's side padding, so it is as wide as the card, and the inset drops its gutter and rounded sides to stay one surface under it; default false
  flat?: boolean  // One surface: the figure and the chart sit on the card itself, under the title, with no inset behind them; default false
  title?: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  chart?: BoxSlot
  panes?: readonly ChartPane[]
```

`CardMenu`, `Empty`, `FootFacts`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { CardMenu, Empty, FootFacts, Phase, QueryStateLike } from 'basalt-ui/cards'`.

`ChartCardProps`, `ChartFigure`, `ChartPane`, `LegendEntry` import from `basalt-ui/charts`: `import type { ChartCardProps, ChartFigure, ChartPane, LegendEntry } from 'basalt-ui/charts'`.

`ControlsSlot` import from `basalt-ui/controls`: `import type { ControlsSlot } from 'basalt-ui/controls'`.

`BoxSlot`, `IconComponent` import from `basalt-ui`: `import type { BoxSlot, IconComponent } from 'basalt-ui'`.

## Example

```tsx
<ChartCard
  title="Requests"
  subtitle="last 30 days"
  figure={{ value: 12840, delta: { value: '+8%', polarity: 'up-good' }, period: 'vs prior' }}
  phase={query}
  chart={(box) => <Lines height={box.height} label="Requests per day" data={rows} x={x} series={series} />}
/>
```
