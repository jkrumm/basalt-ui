# Honest marks

What a mark claims is what the data holds: every fill named, every value reachable, no extreme hidden.

## Legends and states

- Every fill a mark uses has a legend entry: a series, or a legend-only entry for a fill without a series, a `highlight` fill included. Pass `legend={...}` to [ChartCard](node_modules/basalt-ui/docs/chart-card.md). [type:LegendEntry]
- A mark's state is named by what it means ("so far", "estimate"), beyond its look ("lighter"), because opacity reads darker on one scheme and lighter on the other. The word goes in the legend-only entry or on the mark.
- An incomplete datum (a partial day, a night missing a stage) is marked on its mark (hatched, hollow or a caption) and named once; drawn plain it reads as a complete smaller value.
- Every series that prints a value sets `format` with its unit, so the tooltip and every readout carry it.
- A stepped or binned scale says its step in a caption ("per 15 min"); a size channel gets a key.

## Scale and extremes

- The fixture shows its zero and its extreme at rest, so the card is judged with an empty hour and an over-limit value on screen; a zero shows a cue (a dash, a baseline) where the marks would be, and a zero series keeps a visible mark.
- One value that crushes the rest is capped with `y.domain` (a [Sparkline](node_modules/basalt-ui/docs/sparkline.md) takes `cap`): the kit draws the off-scale caret and the tooltip keeps the true value. A cap you write under the data (a domain max below the largest value, a `Math.min`) draws the bar at the cap and says nothing.
- A ranking that saturates says how many are hidden.
- An axis or a zone ends where its last slot ends (its start plus the step), and every tick label differs from the first.
- Dots that coincide or touch set `spread: 'x'` or `'y'` on the series, on the axis that takes a few pixels without a misread; the tooltip keeps the true value and a caption says the dots are nudged ([cartesian-chart guide](node_modules/basalt-ui/docs/cartesian-chart-guide.md)).
- An extreme fixture keeps the rest of the page readable at 1800 and 390: marks per over-limit hour that would merge thin to a zone with one label on its peak.

## Heatmap

- The cells that answer carry their value: `annotate` returns a short mark ("1.2k", "4+") for those and `null` for the rest. The kit drops a note wider than its cell, so a row of bare grey is an `annotate` too wide.
- At 390 the grid omits cell values, so a value that answers also needs another carrier: the footer names the cell ("Wed 03:00") or a list sits under the grid.
- The legend says the cap and the unit: `formatLegend` ends the ramp at its cap ("4+"), `legend.label` names the unit and `tooltip.valueLabel` names the measure. Cap the color `domain` below the extreme and `annotate` the clipped cell with its true value.
- A partial cell is a `states` entry returned by `getState`, drawn and legended as its own state.
- `tickCols` adds the ticks the reader tells time by ("00", "06", "12", "18") to the kit's stride; `formatCol` returning `''` thins a tick.
- `data` has a stable identity (module scope or memoized): without the React Compiler a focused grid re-renders in a loop.

## Finish of a form the page draws

- A focused item gets its own mark beside the container's ring, and the ring is inset clear of the text inside.
- Figures in the page's own markup take tabular numerals; every transition is motion-safe; every value is on the ladder.
- A status token is a fill or a border in a CSS module and text takes a text token, because the lint stops short of a CSS module.
