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
only in `ready` and `stale`, in a fixed clipping box, so a taller chart cannot move the card and a
loading, empty or error card is as tall as a ready one. With `phase="loading"` and no `chart` it is
a Suspense fallback that draws the same rows. A kind draws its own legend, in the server HTML; marks
a page draws through the seam take theirs from `legend`, a row between the figure and the box that
is drawn in every phase, so loading does not move the box.

## Signature

```ts
ChartCard(props: ChartCardProps): ReactElement
  // either title + chart or phase
  empty?: Empty | null
  phase?: Phase | ChartQueryState | (Phase | ChartQueryState | undefined) & "loading"  // A `Phase` or the query itself
  figure?: ChartFigure
  legend?: readonly LegendEntry[]  // The legend row for marks the page draws through the seam, drawn in every phase
  footer?: FootFacts
  controls?: ControlsSlot<"widget">
  menu?: Menu
  height?: "fill" | "auto" | "short"
  title?: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  chart?: BoxSlot
```

`Phase`, `Empty`, `Menu`, `FootFacts` import from `basalt-ui/cards`: `import type { Phase, Empty, Menu, FootFacts } from 'basalt-ui/cards'`.

## Example

```tsx
<ChartCard
  title="Requests"
  subtitle="last 30 days"
  figure={{ value: 12840, delta: { value: '+8%', polarity: 'up-good' }, period: 'vs prior' }}
  phase={query}
  chart={(box) => <Lines height={box.height} ariaLabel="Requests per day" data={rows} x={x} series={series} />}
/>
```
