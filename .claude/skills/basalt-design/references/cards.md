# Cards

How a stat card and its neighbours read. The slots and props are in [StatCard](docs/stat-card.md), [StatGroup](docs/stat-group.md) and [StatCell](docs/stat-cell.md); region `stat-card` and region `stat-group` in `apps/playground/src/routes/overview.tsx` are the composed pair.

## Read a card top to bottom

- Caption: a sentence-case sans noun phrase that names the subject; a category word names nothing. [type:StatCardProps]
- Figure: the answer, as one hero value in proportional sans, with its unit beside it and a rate or total carrying its period. A missing reading prints a dash ([Num](docs/num.md)).
- Delta: a tinted badge, signed, naming its period ("vs last week"), with its polarity set from the data: `up-bad` where a rise is bad (latency, errors). Zero is neutral with no glyph. [type:Delta]
- Verdict: a status dot and its word ([Status](docs/status.md)) when the figure crossed a threshold.
- Micro-visual: a sparkline or a meter that encodes the history, a target or the parts. A visual that restates the headline is decoration.
- Footer: at most two facts. [type:FootFacts]

## Every figure has a baseline

- Give the figure a baseline in the card itself: the delta, a target tick, the limit with the distance to it, or a history line.
- A card with none of these is allowed when the number lacks a history, a target and parts.

## Compose, in this order

- One strip or row of cards first, then the table or chart that explains them; equal cards in a uniform grid leave the reader to find the order.
- Use [StatGroup](docs/stat-group.md) `strip` for a dense status bar and `cards` where each figure needs its own surface; a lone figure is a [StatCard](docs/stat-card.md).
- Pass the numbers; the part formats them. Pass the phase or the query; the card draws its own skeleton at its loaded height. [type:StatCardProps]
- The card's action sits in the card menu; the page's one primary action sits in [PageBar](docs/page-bar.md), drawn ink-inverted. [type:PageBarProps]
- Cards in one row align their heights; a card's subtitle carries a fact, with filler left out.
- Spend colour once: neutral cards, one accent where a decision turns on it, one status hue for a verdict.

## Neighbours

- A top-N or a breakdown is a [BarList](docs/bar-list.md) in a [ChartCard](docs/chart-card.md) so the row reads as one surface level.
- A feed of things that happened is an [EventList](docs/event-list.md); a record's facts beside a list is [PageAside](docs/page-aside.md).

not guarded:

- Wrap no card around a [StatCard](docs/stat-card.md); it is already the card.
- Restate no figure: one number appears once per page, in the summary line, a card or a table cell.
- A tile with a hand-rolled box is a gap to report, not a part to rebuild.
