---
name: ChartCard states
use when: 'a ChartCard must hold one height through loading, stale, error and empty, or the legend and tooltip contract is in question'
never when: 'you only need the props (read chart-card.md)'
peers: ['@tanstack/charts']
slots: []
---

# ChartCard states

The height, phase, legend and tooltip rules of `ChartCard`. The props and the example are in
`chart-card.md`.

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
`failed: true` keeps its legend entry, which reads `unavailable`, draws nothing in the plot, and
leaves the phase on `ready`. The standalone `Legend` (`src/charts/parts/legend.tsx`) reads that word
from the message `charts.unavailable`, so an app can override it through the provider's `messages`;
`CartesianChart` still prints the English default until it reads the key too.

The tooltip is the engine's, placed by the card portal inside the card on both axes and off the first
point's tick labels. `src/charts/parts/tooltip.ts` holds the v3 definition of its rows (a `solid`,
`dashed`, `dot` or `line` swatch), the one short date form, the 150 ms show and 100 ms hide delays and
the rule that a click pins unless the chart has a `selection`. The chart compiler does not call it
yet; until it does, those delays and the swatch shapes are not live.
