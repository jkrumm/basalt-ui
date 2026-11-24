# Chart form

Which form answers the question, and what it must draw. Start from the question's row in the AGENTS block table; the parts index is [parts](parts.md).

## Pick the form

- A chart answers only when the reader compares or follows a shape. One value, fewer than four points or a ratio against a limit is a [StatCard](node_modules/basalt-ui/docs/stat-card.md) or a [Meter](node_modules/basalt-ui/docs/meter.md).
- A ranked list or a split of a total is a [BarList](node_modules/basalt-ui/docs/bar-list.md): one shared scale, the value printed, the legend left out.
- More than about seven classes to tell apart is a [DataTable](node_modules/basalt-ui/docs/data-table.md).
- Two grids on one scale (weekday by hour, service by day) are two [Heatmap](node_modules/basalt-ui/docs/heatmap.md)s that share one focus.
- Many near-identical series in one band are noise: draw the leader in the accent against a quiet rest in ink steps and name it at its end, or give each table row a `c.spark` beside its figure ([table](table.md)).
- Where the items carry a structure the question asks about, the form draws it: hops as a path, two scores per item as a scatter or paired marks, the stages of a run as segments. A ranked list or a total-only stack is the fallback, and the page says it is one.
- Spans over time (a wait, an outage, a hold) are an [IntervalTrack](node_modules/basalt-ui/docs/interval-track.md), where a table with a meter hides the overlap. Every measure the question names is drawn, as a mark or a second pane on the shared axis.
- The items the question names go on the chart's axis in their own order (path order, time), linked to their rows.
- An ordinal (a level, a rank, a difficulty) is a mark: pips or a segmented [Meter](node_modules/basalt-ui/docs/meter.md), because a word in a column is read and a mark is seen.

## Part to whole

- A few named parts of a whole are one stacked [BarList](node_modules/basalt-ui/docs/bar-list.md) row (`series` names the parts, the row's `parts` carries their values), or a Meter for one value on named zones: both draw the colors, the focus and the labels a bar of hand-sized `div`s lacks.
- A count of a whole draws its share beside the figure: a Meter or a row `bar` (a [StatCell](node_modules/basalt-ui/docs/stat-cell.md) `meter`, a `rows` entry's `bar`). A figure alone leaves the whole unmarked.
- The parts take their colors from the series file in the order `series` lists them, so the bar, its legend rows and every other list of the same parts show one color per part.
- The part that answers carries its value on its segment (`chartLabels.fits` places it where it fits), so segments are read by name rather than by legend order.
- The legend rows join the focus both ways through `focus.item(i)` or `focus.seriesItem(key)`, and the dim is the kit's alone.

## One measure

- The hero, the marks and the baseline measure one quantity: pick the quantity the question names and derive all three from it.
- A group against its control draws both groups on one axis and leads with the signed difference ("-2 min vs held back"); a scatter over dates hides the comparison.
- A target for an unfinished period is prorated, or its pill stays neutral ([copy](copy.md)).

## Progress against a target

- Progress against a target is a [Meter](node_modules/basalt-ui/docs/meter.md) with zones (behind, on and ahead of pace), or a bar of done against the pace on one measure. A rule belongs only on bars that measure its quantity.
- A Meter against a limit sets `zones` and a scale that holds the data: take `min` and `max` from the data's extremes with the zone edges inside them, because the meter clamps silently. Only the zone the value is in takes a status tint; the outer zones stay `neutral`.
- The hero stands against the reference the data holds (working hours for free time, the approvals a merge needs for "stuck"), said once, in the hero or its pill.

## A time window picks its resolution

- Up to 7 days the bucket is the hour, unless the data itself is daily; beyond that the day. Work that arrives in bursts reads wrong by the day.
- A bar series denser than about one bar per 3 px at the plot's width is an area (`mark: 'line'` with `area: 'fade'`) or merged buckets; denser bars alias into a hash at 390.
- The chart names its bucket: a unit caption ("per hour") and x labels for the window's start, now and end.
- A load-like series (queue depth, CPU) takes the bucket's max, so a spike survives; a count takes the sum.
- One window control per page (24 h, 7 d, 30 d, opening on 7 d), and every chart on the page follows it: a chart with its own window is a second question.
- A sliding window's query key is quantised onto the data's step with [windowKey](node_modules/basalt-ui/docs/window-key.md).
