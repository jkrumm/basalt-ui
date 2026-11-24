# Cards

How a stat card and its neighbours read. The slots and props are in [StatCard](node_modules/basalt-ui/docs/stat-card.md), [StatGroup](node_modules/basalt-ui/docs/stat-group.md) and [StatCell](node_modules/basalt-ui/docs/stat-cell.md).

## Read a card top to bottom

- Caption: a sentence-case sans noun phrase that names the subject; a category word names nothing. [type:StatCardProps]
- Figure: the answer, as one hero value in proportional sans, with its unit beside it and a rate or total carrying its period. A missing reading prints a dash ([Num](node_modules/basalt-ui/docs/num.md)) and its caption names the reason ([copy](copy.md)).
- Unit and period: the noun the figure counts goes in `unit`, which draws beside the value; `period` draws after the status, so a qualifier there reads as the status's caption.
- Meaning: one plain sentence in `info` of what the figure means and which way is good. [type:StatCardProps]
- Delta: a tinted badge, signed, naming its period ("vs last week"), tinted by its polarity (`up-good`, `up-bad`) where the direction is good or bad for the reader. A change that is neither (noise, zero, an unfinished or empty period, a base the data lacks) is `polarity: 'neutral'` and untinted; zero has no glyph. [type:Delta]
- Verdict: a status dot and its word ([Status](node_modules/basalt-ui/docs/status.md)) when the figure crossed a threshold.
- Micro-visual: a sparkline or a meter that encodes the history, a target or the parts. A visual that restates the headline is decoration.
- Footer: at most two facts. [type:FootFacts]

## Console anatomy

- The card is the console card: a header with the title and its context line, the figure with its delta pill inside the inset one surface step down, label and value pairs in the footer. The parts that give it are the [ChartCard](node_modules/basalt-ui/docs/chart-card.md) `figure`, the [StatCard](node_modules/basalt-ui/docs/stat-card.md) and the inset of the [Card](node_modules/basalt-ui/docs/card.md).
- Every card of a page carries the anatomy, the secondary ones included: a figure with its pill where the data holds a base, a context line that states a fact, and footer pairs. A card of bare charts or a flush chart without inset gets the anatomy or folds into the card that has it.
- Strip cells declare `rows` on every cell, so every cell of the strip ends at one height.
- A date, a time and an id are mono wherever the page prints one: the figure's `period` (`periodMono`, at rest, on focus and in a hover stamp), a stat card's `sub` (`subMono`), a footer fact's value and a stat row's value (`mono`), a [PageSummary](node_modules/basalt-ui/docs/page-summary.md) fact (`{ label, value, mono: true }`), a `c.entity` that is an id and a `c.date` or `c.relativeTime` column (`mono`). A sentence stays body face; the hero `value` cannot be mono, so a time that must read as one goes in `period`. The time zone is named once, in the context line.
- A question with two clauses ("which restart, and how often") has a number at rest for each on the card: the figure carries one, a status or a footer fact the other. A clause answered only by a sentence is unanswered.
- The title is a noun phrase in the header and the figure is the largest thing in the inset; a part that cannot draw the content is reported ([anti-defaults](anti-defaults.md)).

## A list, a strip or a page of rows is still a card

- A card that holds a list ([DataPanel](node_modules/basalt-ui/docs/data-panel.md)) or a strip states its figure with its pill in the inset and at most two footer pairs, or the page puts the figure in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md) `figure` beside it. A figure in a subtitle reads as prose, and only the inset takes a pill.
- A page whose body is rows leads with a card (the figure that answers, its context line, two footer pairs), then the rows; a strip of bare counts or one sentence over a flush table falls short.

## Every figure has a baseline

- Give the figure a baseline in the card itself: the delta, a target tick, the limit with the distance to it, or a history line. A card without one is allowed only when the number lacks a history, a target and parts.
- The headline stands against the reference the data offers (yesterday, a usual day, the goal's pace) as a signed delta that names its base ("+151 min vs usual day"). A pill compares the figure's own window: a fortnight against the previous fortnight. A threshold in words ("over 500 ms") stands against nothing.
- The pill names its measure as well as its base where they differ from the hero's ("−88 pts rated vs 93 % usual", through `delta.label`), and keeps the base at 390: shorten the words around the base and keep the base.
- A count over a total is a figure with its share ("13", pill "68% of 19"); a share shows its whole beside it ("9 / 18" next to the bar). A share of the whole ("53 % of all") is a `sub`: a delta pill would sign a change the data lacks.
- A change inside the noise takes a neutral pill or none, and a saturated figure stands against its limit. A pill whose base the data lacks is dropped or neutral.
- A duration or an age is a footer fact or a meter; a delta pill is for a signed change. A cadence beside a last-run age is an overdue state: the row or cell carries a status word ("Overdue 83 days"), because `c.meter` cannot flag a state.
- Sign every compared figure the data holds a base for: a footer pair of a total and a previous total is a `figure.delta` with its base named.

## When a page leads with figures

- Lead with the card that answers the page's question, then the table or chart that explains it; equal cards in a uniform grid leave the reader to find the order.
- A stat row earns its place only with three or more headline figures of equal weight. Every cell carries its icon and label, the figure with its unit, a delta pill that names its base on the line under it (`delta.label`), and the 28 px trend (`chart`) wherever the page holds that figure's series. A cell without a series adds a verdict (`status`) or a meter instead.
- A state cell ("five of six healthy") names the item it counts in `sub` and links to it with `href`; a bare count goes in the footer of its card or in the list where it is acted on. [StatGroup](node_modules/basalt-ui/docs/stat-group.md) warns in development only when every cell lacks a baseline, so check each cell against this list.
- The row is a StatGroup: `strip` rules the cells on one surface; `cards` gives each figure its own surface. A strip figure in an inset is `variant="cards"`. A lone figure is a StatCard.
- A grid or strip of five or more records of one shape offers a table view of the same records (a toggle in the header or a table beside it), because a reader compares records across a row and cards cannot line them up; or keep it at four and fold the rest into a table.

## Compose

- Write every percent through `useFormat().percent` (it takes the fraction), one form per page.
- Pass the numbers; the part formats them. Pass the phase or the query; the card draws its own skeleton at its loaded height. [type:StatCardProps]
- The card's action sits in the card menu; the page's one primary action sits in [PageBar](node_modules/basalt-ui/docs/page-bar.md), drawn ink-inverted. [type:PageBarProps]
- Cards in one row align their heights; spend colour once ([chart-color](chart-color.md)).

## Neighbours

- A top-N or a breakdown is a [BarList](node_modules/basalt-ui/docs/bar-list.md) in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md).
- Steps with a duration each (a deploy, a job run) are a [StepRail](node_modules/basalt-ui/docs/step-rail.md) in a [DataPanel](node_modules/basalt-ui/docs/data-panel.md).
- Records that wait on other records, asked what blocks what, are a [ChainView](node_modules/basalt-ui/docs/chain-view.md) on the table's focus; a strict tree is [DataTable](node_modules/basalt-ui/docs/data-table.md) with `nested`.
- A feed of things that happened is an [EventList](node_modules/basalt-ui/docs/event-list.md); a record's facts beside a list are a [PageAside](node_modules/basalt-ui/docs/page-aside.md). Every other part is in [parts](parts.md).

not guarded:

- Wrap no card around a [StatCard](node_modules/basalt-ui/docs/stat-card.md); it is already the card.
- Restate no figure: one number appears once per page.
- A tile with a hand-rolled box is a gap to report, not a part to rebuild.
