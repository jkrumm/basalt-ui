# Encoding

Which form carries which shape of data, and what the marks may say. The question-to-form table is in the AGENTS block; this adds the reasoning the table has no room for. Chart bodies are in [charts](charts.md).

## Is it a chart at all

- One current value is a [StatCard](docs/stat-card.md); a handful of headline values is a [StatGroup](docs/stat-group.md) strip.
- One ratio against a limit is a [Meter](docs/meter.md) with its zones; the verdict is a word under the marker.
- A top-N or a share of a total is a [BarList](docs/bar-list.md). Many rows with several attributes is a [DataTable](docs/data-table.md).
- A value over time is a chart in a [ChartCard](docs/chart-card.md); compare categories with bars, follow a shape with a line.
- Events in order are an [EventList](docs/event-list.md).

## Colour follows the entity

- An entity that earns a hue keeps it on every chart and card where it appears, whatever its rank; most entities earn none and stay neutral.
- Colour is a budget: neutral by default, one accent, one status hue. Seven family hues on one chart is a failed budget; fold the tail into "Other" and keep the rest neutral.
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

- One left-aligned filter row above what it scopes, the date range first ([FilterSet](docs/filter-set.md)); a filter scopes everything below it. [type:ControlHandle]
- A filter that empties the view offers its own reset in the empty state ([EmptyState](docs/empty-state.md)).

## Numbers

- Compact from 1,000 (`12.9K`, `$4.2M`); ticks compact the same way. Every number carries its unit inline, and a rate or a total carries its period.
- Format through [useFormat](docs/use-format.md) or pass the number to the part, which formats it.

not guarded:

- Use one axis per chart; a second value scale is a second chart.
- Never encode a category in the rank of its colour, and never cycle a palette.
- A marker restating the headline value adds nothing; mark the target or the limit.
