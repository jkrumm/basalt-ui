# Cards

How a stat card and its neighbours read. The slots and props are in [StatCard](node_modules/basalt-ui/docs/stat-card.md), [StatGroup](node_modules/basalt-ui/docs/stat-group.md) and [StatCell](node_modules/basalt-ui/docs/stat-cell.md); region `stat-card` and region `stat-group` in `apps/playground/src/routes/overview.tsx` are the composed pair.

## Read a card top to bottom

- Caption: a sentence-case sans noun phrase that names the subject; a category word names nothing. [type:StatCardProps]
- Figure: the answer, as one hero value in proportional sans, with its unit beside it and a rate or total carrying its period. A missing reading prints a dash ([Num](node_modules/basalt-ui/docs/num.md)) and its caption names the reason, "Not measured, <why>" ([copy](copy.md)).
- Meaning: one plain sentence in `info` of what the figure means and which way is good ("Merged pull requests. Higher is better."). [type:StatCardProps]
- Delta: a tinted badge, signed, naming its period ("vs last week"), with its polarity set from the data: `up-bad` where a rise is bad (latency, errors). Zero is neutral with no glyph. [type:Delta]
- Verdict: a status dot and its word ([Status](node_modules/basalt-ui/docs/status.md)) when the figure crossed a threshold.
- Micro-visual: a sparkline or a meter that encodes the history, a target or the parts. A visual that restates the headline is decoration.
- Footer: at most two facts. [type:FootFacts]

## Console anatomy

- The card is the console card: a header with the title and its context line, the figure with its delta pill inside the inset one surface step down, label and value pairs in the footer. The parts that give it are the [ChartCard](node_modules/basalt-ui/docs/chart-card.md) `figure`, the [StatCard](node_modules/basalt-ui/docs/stat-card.md) and the inset of the [Card](node_modules/basalt-ui/docs/card.md).
- Every card of a page carries its figure's delta pill and footer pairs, including the second and third: a card without them reads as a lesser one (n13, n16, n04, n09, c14).
- The secondary card is a card too: the per-month chart under n28's headline was a flush chart without inset, figure or footer, and its subtitle repeated its title (.16, .24); n32's bar list lacked the inset and the footer (.64). Give each its figure with its pill and its two footer pairs, with a subtitle that states a fact.
- Ids, repo names, hashes and timestamps are monospace (a `font-mono` text whose date comes from the kit's `useFormat`), in the header, the figure's sub line and the footer pairs; the time zone is named once, in the context line (n03, n07, n10, n17, n18).
- Every card has a context line, the secondary ones included: n40's Due dates card had none, and its dates stood in the sub line in the body face (.18, .25). A date, a time and an id are mono; count bars carry a unit caption ("per day", "of 64 GB"; n43's bars carried none, .48).
- A question with two clauses ("which restart, and how often") has a number at rest for each, on the card as well as in a sentence: the figure carries one, a status or a footer fact carries the other. n45's hero counted the one container in a restart loop and left the three that restart often without a number (.1); n46's figure was the median speed and the count of days under the minimum stood only in the headline sentence (.11). Write the clauses of the question in the three lines of step 1, then point at the number that answers each; a clause that has only a sentence is unanswered to the reviewer.
- The title is a noun phrase in the header and the figure is the largest thing in the inset; a small title over free text on a flush surface is the defect, and the part is reported when it cannot draw the content ([anti-defaults](anti-defaults.md)).

## A list or a strip is still a card

- A card that holds a list ([DataPanel](node_modules/basalt-ui/docs/data-panel.md)) or a strip states its figure with its pill in the inset and at most two footer pairs, or the page puts the figure in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md) `figure` beside it. The figure and the status live in the inset, where a pill, a delta and a polarity can attach; a subtitle carries a fact, and a figure there reads as prose (c10 F8: status facts outside the card; c13 F8 and X5: subtitles in place of the figure; c12 F8: the wrong number in the figure).

## A page of rows still leads with a card

- A page whose body is rows (courses, monitors, books) leads with a card: the figure that answers, its context line and a footer of two pairs, then the rows. A strip of bare counts beside a flush table, or one sentence over a table, falls short of the anatomy (n11 .8 and .15: a sentence over a flush table; n23 .36 and .44: a flush band of label, figure and free text). Round 1 of n11 led with a [StatCard](node_modules/basalt-ui/docs/stat-card.md) and scored.

## Every figure has a baseline

- Give the figure a baseline in the card itself: the delta, a target tick, the limit with the distance to it, or a history line.
- Every headline stands against the reference the data offers (yesterday, a usual day, the rest of the day, the goal's pace) as a signed delta; name the base in words where it is unclear ("+151 min vs usual day"). A threshold in words ("over 500 ms") stands against nothing, and a 30-day figure beside a 1-day one compares nothing (n23 .32, n26 .73).
- A count over a total is a figure with its share or delta ("13", pill "68% of 19"), where a sentence in prose gives nothing to compare (c10 F3, c11 F3).
- A share shows its whole beside it ("9 / 18" next to the percent bar), so a small and a large item draw differently: 12 and 48 lessons drew the same bar (n11 .3).
- A card with none of these is allowed when the number lacks a history, a target and parts.
- Name the base in the pill, or in a strip cell beside the pill on the line under the figure (`delta.label`, which the cell draws there), and keep it at 390: n39's hero count lacked a margin to 0 °C and its pill named its base only as 'GFS' after its builder cut `delta.label` for the phone (.2); shorten the words around the base and keep the base. n41's medians and Rate column carried a figure with nothing beside it (.27); n42's CPU and Memory strip lacked one, and on `pegged` its pill signed noise as '+1 pts CPU' (.38): a change inside the noise takes a neutral pill or an absent one, and a saturated figure stands against its limit.
- A duration or an age is a fact for the footer or a meter, and a delta is a signed change against a named base: n40's Overdue pill was an unsigned duration drawn with the delta arrow (.13); round 1 moved it to the footer as a pair, 'Overdue 31 days'.

## When a page leads with figures

- Lead with the card that answers the page's question, then the table or chart that explains it; equal cards in a uniform grid leave the reader to find the order.
- A stat row earns its place only when the page has three or more headline figures of equal weight, and every cell carries a delta that names its base, a verdict, a meter or a trend. A bare count goes in the footer of the card it belongs to, or in the list where it is acted on: the owner rejected four figures on a band as "a way less thought-through version of cards" (owner review 2, the fleet overview's Services 6, Deploys 164, 11.0 %, 174 s). The reviewer fails a row where every cell is a bare figure (Expression 4), and the group warns in development.
- The row is a [StatGroup](node_modules/basalt-ui/docs/stat-group.md): `strip` rules the cells on one surface, each an icon, its label, the figure with its verdict, the pill beside the base it names, and a 28 px trend; `cards` gives each figure its own surface. A lone figure is a [StatCard](node_modules/basalt-ui/docs/stat-card.md). Region `stat-group` in `apps/playground/src/routes/cards.tsx` is the fleet row composed.

## Compose

- Pass the numbers; the part formats them. Pass the phase or the query; the card draws its own skeleton at its loaded height. [type:StatCardProps]
- The card's action sits in the card menu; the page's one primary action sits in [PageBar](node_modules/basalt-ui/docs/page-bar.md), drawn ink-inverted. [type:PageBarProps]
- Cards in one row align their heights; a card's subtitle carries a fact, with filler left out.
- Spend colour once: neutral cards, one accent where a decision turns on it, one status hue for a verdict.
- A grid of five or more cards that each show one record of one shape (a measure, an Issue, a host) offers a table view of the same records, a toggle in the header or a table beside the grid: a reader compares records across a row, which cards cannot line up (n27, from the owner's review).

## Neighbours

- A top-N or a breakdown is a [BarList](node_modules/basalt-ui/docs/bar-list.md) in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md) so the row reads as one surface level.
- Steps with a duration each (a deploy, a job run, a trace summary) are a [StepRail](node_modules/basalt-ui/docs/step-rail.md): bars scaled to the longest step, composed in a [DataPanel](node_modules/basalt-ui/docs/data-panel.md).
- Records that wait on other records (tasks, Issues, deploy steps), asked what blocks what, are a [ChainView](node_modules/basalt-ui/docs/chain-view.md) on the table's focus; a strict tree is [DataTable](node_modules/basalt-ui/docs/data-table.md) with `nested`.
- A feed of things that happened is an [EventList](node_modules/basalt-ui/docs/event-list.md); a record's facts beside a list is [PageAside](node_modules/basalt-ui/docs/page-aside.md).

not guarded:

- Wrap no card around a [StatCard](node_modules/basalt-ui/docs/stat-card.md); it is already the card.
- Restate no figure: one number appears once per page, in the summary line, a card or a table cell.
- A tile with a hand-rolled box is a gap to report, not a part to rebuild.
