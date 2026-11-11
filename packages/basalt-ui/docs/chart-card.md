---
name: ChartCard
use when: 'a metric needs a chart with a title, a headline figure, controls or a footer around it'
never when: 'the content is a table, a list or a board (use a data panel) or a lone figure (use a StatCard)'
peers: ['@tanstack/charts']
slots:
  [
    chart-card,
    card,
    card-band,
    icon-tile,
    card-info,
    chart-figure,
    chart-status,
    chart-box,
    chart-skeleton,
    chart-controls,
    chart-menu,
    chart-footer,
    inset,
  ]
---

# ChartCard

The frame every chart sits in: a header, an inset holding the headline figure over the chart box,
and an optional footer of at most two facts, on the surface, edge and radii of `StatCard`. It owns
the box and the phase. `chart` is a box slot called only in `ready` and `stale`, in a fixed clipping
box, so a taller chart cannot move the card and a loading, empty or error card is as tall as a ready
one. Source: `src/charts/parts/chart-card*`. It reaches no Base UI and no Mantine.

## Signature

```ts
ChartCard(props: ChartCardProps): ReactElement
  title: string
  chart: (box: { height: 'fill'; phase: 'ready' | 'stale' }) => ReactNode
  subtitle?: string
  icon?: IconComponent
  info?: string
  figure?: { value: number | string | null; unit?; delta?: { value; polarity; label? }; period?; status?: { tone; label } }
  footer?: readonly [Fact | null, (Fact | null)?]
  controls?: ControlsSlot
  menu?: (box) => ReactNode
  height?: 'auto' | 'short' | 'fill'
  phase?: Phase | QueryStateLike
  empty?: { cause: string; action?; filtered?: { reset } } | null
```

A second arm, `<ChartCard phase="loading" … />` with no `chart`, is the `Suspense` fallback. Pass it the
same `title`, `figure` and `footer` the ready card has and it draws the same rows, so nothing moves
when the chart arrives. Without a `title` the header draws a bar of the title's height.

## Height

| `height`         | Chart box                                                     |
| ---------------- | ------------------------------------------------------------- |
| `auto` (default) | half the card's width, between 160 and 420 px, decided in CSS |
| `short`          | 160 px                                                        |
| `fill`           | the card's remainder; the card takes its parent's height      |

The slot always receives `height: 'fill'`, so the chart takes the box and never states its own. The
height is a container-class rule, not a measurement: the server HTML, the first paint and the hydrated
page agree.

## Phase

| Phase     | Box                                                                          |
| --------- | ---------------------------------------------------------------------------- |
| `ready`   | the chart                                                                    |
| `loading` | a plot skeleton; the figure row shows bars                                   |
| `stale`   | the chart and an `Updating` line; `Could not refresh` after a failed refetch |
| `error`   | the error arm with Retry (none for a 403); a throwing slot lands here too    |
| `empty`   | the cause and its action; `filtered` offers Clear filters                    |

`empty` wins over `ready` and `stale` once the query settled; `loading` wins over everything. The phase
prints on the card and on the box as `data-phase`.

## Legend and tooltip

The legend is drawn by the chart, in its own markup, so it is in the server HTML. A series with
`failed: true` keeps its legend entry, which reads `charts.unavailable` (English `unavailable`, an
app overrides it through the provider's `messages`), draws nothing in the plot, and leaves the phase
on `ready`. The tooltip is the engine's, placed by the card portal inside the card on both axes and
off the first point's tick labels; its rows are data with a `solid`, `dashed`, `dot` or `line` swatch.
A click pins the tooltip unless the chart has a `selection`.
