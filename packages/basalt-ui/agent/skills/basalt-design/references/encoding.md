# Encoding

Which form carries which shape of data, and what the marks may say. The question-to-form table is in the AGENTS block; this adds the reasoning the table has no room for. Chart bodies are in [charts](charts.md); every shipped part is in [parts](parts.md).

## Is it a chart at all

- One current value is a [StatCard](node_modules/basalt-ui/docs/stat-card.md); three or more headline values of equal weight, each with its baseline, are a [StatGroup](node_modules/basalt-ui/docs/stat-group.md) strip ([cards](cards.md) § When a page leads with figures).
- One ratio against a limit is a [Meter](node_modules/basalt-ui/docs/meter.md) with its zones; the verdict is a word under the marker. Its value carries a `caption` that names it on screen ("US$13.89 spent", "of 150 listed"); a bare number or a `format` bent into words is the defect. A range's ends or a limit are its `ticks` on the track and the reason is its `cause`; sibling text is the defect.
- A top-N or a share of a total is a [BarList](node_modules/basalt-ui/docs/bar-list.md). Many rows with several attributes is a [DataTable](node_modules/basalt-ui/docs/data-table.md), unless the question is which items changed state or passed: that is one mark per item (a square per case) with the table holding the detail.
- Rows of one kind beside a chart (a name, a second line, a verdict, a figure) are a [RowList](node_modules/basalt-ui/docs/row-list.md) with the chart's `focus`, quiet by default; never a mapped `div` with a `border-b` or `divide-y`. [lint:primitive-bypass]
- A value over time is a chart in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md); compare categories with bars, follow a shape with a line.
- A question of when (when does it run out, when did it change) is a time axis with the boundary drawn (a ref line at the limit, the next run marked); a table answers what and leaves when to the reader.
- A ranking is one order that is also the mark order (two orders in one list are the defect); a commitment is split by what makes it up (one total hides the split).
- Events in order are an [EventList](node_modules/basalt-ui/docs/event-list.md). Intervals on a time axis (a stay, a run, a notice window) get one row each, drawn as a bar on the axis.
- A series that must dim on focus is [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md) marks: [Lines](node_modules/basalt-ui/docs/lines.md) ignores marks and so cannot dim, while [Bars](node_modules/basalt-ui/docs/bars.md) dims through its own `opacity`.

## Colour follows the entity

- An entity that earns a hue keeps it on every chart and card where it appears, whatever its rank; most entities earn none and stay neutral.
- Colour is a budget: neutral by default, one accent on one series or mark class per view, one status hue. Two series in the accent is a failed budget, and so are seven family hues on one chart; fold the tail into "Other" and keep the rest neutral. One measure drawn at two grains counts as two classes ([chart-color](chart-color.md)).
- A status is a word or a dot with its tone, so a reader without colour still has the verdict. [lint:status-fill-as-text]
- Text takes a text token; a series colour is a fill. [lint:colour-literal]

## Tooltips enhance

- Every value is reachable without hover: a direct label, a caption under the segments, or a table beside the chart.
- A tooltip shows the same content on keyboard focus as on pointer hover, one tooltip for all series at a point. [type:ChartTooltipConfig]
- Values lead and labels follow: "12.4 K sessions".

## A refetch keeps the frame

- A refetch holds the previous render and says it is old; a skeleton is for the first load, at the final footprint. [type:FrameState]
- A refetch that fails over saved data keeps the data and flags the failure; only an empty cache with a failure shows the error. See [states](states.md).

## Filters

- One left-aligned filter row above what it scopes, the date range first ([FilterSet](node_modules/basalt-ui/docs/filter-set.md)); a filter scopes everything below it. [type:ControlHandle]
- A filter that empties the view offers its own reset in the empty state ([EmptyState](node_modules/basalt-ui/docs/empty-state.md)).

## Numbers

- Compact from 1,000 (`12.9K`, `$4.2M`); ticks compact the same way. Every number carries its unit inline, and a rate or a total carries its period.
- Format through [useFormat](node_modules/basalt-ui/docs/use-format.md) or pass the number to the part, which formats it.

not guarded:

- Use one axis per chart; a second value scale is a second chart.
- Never encode a category in the rank of its colour, and never cycle a palette.
- A marker restating the headline value adds nothing; mark the target or the limit.
