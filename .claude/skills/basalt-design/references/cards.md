# Cards

How a stat card and its neighbours read. The slots and props are in [StatCard](node_modules/basalt-ui/docs/stat-card.md), [StatGroup](node_modules/basalt-ui/docs/stat-group.md) and [StatCell](node_modules/basalt-ui/docs/stat-cell.md); region `stat-card` and region `stat-group` in `apps/playground/src/routes/overview.tsx` are the composed pair.

## Read a card top to bottom

- Caption: a sentence-case sans noun phrase that names the subject; a category word names nothing. [type:StatCardProps]
- Figure: the answer, as one hero value in proportional sans, with its unit beside it and a rate or total carrying its period. A missing reading prints a dash ([Num](node_modules/basalt-ui/docs/num.md)) and its caption names the reason, "Not measured, <why>" ([copy](copy.md)).
- Unit and period: the noun the figure counts goes in `unit`, which draws beside the value ("of 145 pairs disagree when both are sure"); `period` draws after the status, so a qualifier there reads as the status's caption and the 145 stays unnamed.
- Meaning: one plain sentence in `info` of what the figure means and which way is good ("Merged pull requests. Higher is better."). [type:StatCardProps]
- Delta: a tinted badge, signed, naming its period ("vs last week"), with its tint from its polarity (`up-good`, `up-bad`) where the direction is good or bad for the reader: `up-bad` where a rise is bad (latency, errors). A change that is neither (noise, zero, an unfinished or empty period, a base the data lacks) is `polarity: 'neutral'` and stays untinted; zero has no glyph. [type:Delta]
- Verdict: a status dot and its word ([Status](node_modules/basalt-ui/docs/status.md)) when the figure crossed a threshold.
- Micro-visual: a sparkline or a meter that encodes the history, a target or the parts. A visual that restates the headline is decoration.
- Footer: at most two facts. [type:FootFacts]

## Console anatomy

- The card is the console card: a header with the title and its context line, the figure with its delta pill inside the inset one surface step down, label and value pairs in the footer. The parts that give it are the [ChartCard](node_modules/basalt-ui/docs/chart-card.md) `figure`, the [StatCard](node_modules/basalt-ui/docs/stat-card.md) and the inset of the [Card](node_modules/basalt-ui/docs/card.md).
- Every card of a page carries its figure's delta pill and footer pairs, including the second and third: a card without them reads as a lesser one. A card of two bare charts is the same fault: a Totals card lacked a figure, a context line and a footer pair; give it the anatomy or fold it into the card that does.
- The secondary card is a card too: the per-month chart under a headline was a flush chart without inset, figure or footer, and its subtitle repeated its title; a bar list lacked the inset and the footer. Give each its figure with its pill and its two footer pairs, with a subtitle that states a fact.
- Ids, repo names, hashes and timestamps are monospace (a `font-mono` text whose date comes from the kit's `useFormat`), in the header, the figure's sub line and the footer pairs; the time zone is named once, in the context line.
- Every card has a context line, the secondary ones included: a Due dates card had none, and its dates stood in the sub line in the body face. Strip cells declare `rows` on every cell: in one strip, cells 2 to 4 passed `sub` and left `rows` out while cell 1 declared three, leaving about 100 px of blank in a 190 px card. An id or a name that is a key, a step id or a test name ("e2e", "tsc") in a figure period or on an axis sets `periodMono` where it stands. A date, a time and an id are mono, wherever the page prints one: the figure's `period` (`periodMono`, at rest, on focus and in a hover stamp), a stat card's `sub` (`subMono`), a footer fact's value (fact `mono`), a stat row's value (row `mono`), a [PageSummary](node_modules/basalt-ui/docs/page-summary.md) fact (`{ label, value, mono: true }`), a `c.entity` that is an id (`mono`) and a `c.date` or `c.relativeTime` column (`mono`, the cell and its phone card line); a sentence stays body face, and the hero `value` window text cannot be mono, so a time that must read as one goes in `period`. After the fact count list every id, time and stamp the page prints with the prop that sets each mono; count bars carry a unit caption ("per day", "of 64 GB"; one page's bars carried none).
- A question with two clauses ("which restart, and how often") has a number at rest for each, on the card as well as in a sentence: the figure carries one, a status or a footer fact carries the other. One hero counted the one container in a restart loop and left the three that restart often without a number; on another page the figure was the median speed and the count of days under the minimum stood only in the headline sentence. Write the clauses of the question in the three lines of step 1, then point at the number that answers each; a clause that has only a sentence is unanswered to the reviewer.
- The title is a noun phrase in the header and the figure is the largest thing in the inset; a small title over free text on a flush surface is the defect, and the part is reported when it cannot draw the content ([anti-defaults](anti-defaults.md)).

## A list or a strip is still a card

- A card that holds a list ([DataPanel](node_modules/basalt-ui/docs/data-panel.md)) or a strip states its figure with its pill in the inset and at most two footer pairs, or the page puts the figure in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md) `figure` beside it. The figure and the status live in the inset, where a pill, a delta and a polarity can attach; a subtitle carries a fact, and a figure there reads as prose. The faults seen are status facts outside the card, subtitles in place of the figure and the wrong number in the figure.

## A page of rows still leads with a card

- A page whose body is rows (courses, monitors, books) leads with a card: the figure that answers, its context line and a footer of two pairs, then the rows. A strip of bare counts beside a flush table, or one sentence over a table, falls short of the anatomy (a sentence over a flush table; a flush band of label, figure and free text). A page that led with a [StatCard](node_modules/basalt-ui/docs/stat-card.md) instead met the anatomy.

## Every figure has a baseline

- Give the figure a baseline in the card itself: the delta, a target tick, the limit with the distance to it, or a history line.
- Every headline stands against the reference the data offers (yesterday, a usual day, the rest of the day, the goal's pace) as a signed delta; name the base in words where it is unclear ("+151 min vs usual day"). A threshold in words ("over 500 ms") stands against nothing, and a 30-day figure beside a 1-day one compares nothing. A delta pill compares the figure's own window: a fortnight's '90 refused' beside 'vs first week' compares a fortnight with a week; base the pill on the same fortnight, the previous one.
- A count over a total is a figure with its share or delta ("13", pill "68% of 19"), where a sentence in prose gives nothing to compare.
- A share shows its whole beside it ("9 / 18" next to the percent bar), so a small and a large item draw differently: 12 and 48 lessons drew the same bar.
- A card with none of these is allowed when the number lacks a history, a target and parts.
- Name the base in the pill, or in a strip cell beside the pill on the line under the figure (`delta.label`, which the cell draws there), and keep it at 390: a hero count lacked a margin to 0 °C and its pill named its base only as 'GFS' after `delta.label` was cut for the phone; shorten the words around the base and keep the base. A table's medians and Rate column carried a figure with nothing beside it; a CPU and Memory strip lacked one, and on `pegged` its pill signed noise as '+1 pts CPU': a change inside the noise takes a neutral pill or an absent one, and a saturated figure stands against its limit.
- A duration or an age is a fact for the footer or a meter, and a delta is a signed change against a named base: an Overdue pill was an unsigned duration drawn with the delta arrow; moving it to the footer as a pair, 'Overdue 31 days', fixed it.
- A cadence beside a last-run age is an overdue state: one page held "weekly" against "90 days since last run" and left the two apart, so the row or cell carries a status word or icon ("Overdue 83 days") and the age stays a meter or a fact. `c.meter` draws a bar against `max` and cannot flag a state, so the flag is the status word.
- Sign every compared figure the data holds a base for. A footer pair of a total and a previous total ("Total 236", "Previous period 198") is a delta left unsigned: make it `figure.delta` with the base named. A winner's cost and first audio stand against the cheapest and the fastest in the data, each a signed `delta` on its strip cell.
- A delta pill stands against a baseline the data holds, and the pill shows it: 'vs yesterday' needs a prior day (a '+2 vs yesterday' was the count due today), and a gap between two rates names both rates, in the pill label or a footer pair, where '-7.2 pts vs unsure pairs' leaves the 7.2 undecodable at rest. A pill whose base the data lacks is dropped, or is `polarity: 'neutral'` and untinted.
- Every figure has a stated reference, and the pill names it: a "-8 pts vs 33 %" read as a bare change, and a "Still open 6" and per-loop 7-day rows had a missing base. Write "-8 pts vs 33 % last 30 d", or the baseline in `delta.label`, and hold the same label at 390. A share of the whole ("53 % of all", as four pills on one page) is a `sub` under the figure and stays out of the delta pill: it signs a change the data lacks.

## When a page leads with figures

- Lead with the card that answers the page's question, then the table or chart that explains it; equal cards in a uniform grid leave the reader to find the order.
- A stat row earns its place only when the page has three or more headline figures of equal weight, and its minimum is the verdict's cell, the structured strip the owner chose over a row of bare figures (the owner: Services 6, Deploys 164, 11.0 %, 174 s read as "a way less thought-through version of cards"). Every cell carries: its icon and label (`icon`, `label`); the figure with its unit; a delta pill that names its base on the line under it (`delta.label`, "vs prior 7 days"); and the 28 px trend (`chart`) wherever the page holds that figure's series. A figure without a series (a count right now) is the one cell that omits the trend, and it adds a verdict (`status`) or a meter in its place. A comparison in a footnote or a sentence is a sentence, a delta is the pill; one of the four parts on a cell falls short of the minimum. One strip drew bare labels without icons, omitted the trend though the page held deploys per day, compared the median in a footnote and counted a state without naming a service.
- A state cell ("five of six healthy", "2 incidents open") names the item it counts in `sub` and links to it with `href`; a state that names nothing is a bare count, and a bare count goes in the footer of the card it belongs to, or in the list where it is acted on. The reviewer fails a row where every cell is a bare figure (Expression 4), and the [StatGroup](node_modules/basalt-ui/docs/stat-group.md) warns in development only when every cell lacks a baseline: a missing icon or trend, or a pill that names its base nowhere, passes both, so check each cell against the list above before the shots.
- The row is a [StatGroup](node_modules/basalt-ui/docs/stat-group.md): `strip` rules the cells on one surface; `cards` gives each figure its own surface and holds the same cell. A strip figure in an inset (the console anatomy above) is `variant="cards"`: `strip` is one flat surface by design. A lone figure is a [StatCard](node_modules/basalt-ui/docs/stat-card.md). Region `stat-group` in `apps/playground/src/routes/cards.tsx` is the fleet row composed.

## Compose

- Write every percent through `useFormat().percent` (it takes the fraction), one form per page: a page's kit rows read "72%" beside its own "35 %" in the gear lists.
- Pass the numbers; the part formats them. Pass the phase or the query; the card draws its own skeleton at its loaded height. [type:StatCardProps]
- The card's action sits in the card menu; the page's one primary action sits in [PageBar](node_modules/basalt-ui/docs/page-bar.md), drawn ink-inverted. [type:PageBarProps]
- Cards in one row align their heights; a card's subtitle carries a fact, with filler left out.
- Spend colour once: neutral cards, one accent where a decision turns on it, one status hue for a verdict.
- A grid of five or more cards that each show one record of one shape (a measure, an Issue, a host) offers a table view of the same records, a toggle in the header or a table beside the grid: a reader compares records across a row, which cards cannot line up (from the owner's review). A strip of five or more measure cells is that grid: one page drew Votes, Estimations, Rooms, Unique users and Page views as five cells without a table view; a Cards/Table switch fixed it. Give the strip a table view of the same measures, or keep the strip at four cells and fold the rest into a table. Write the records line in DESIGN.md (two pages did, one left it out).

## Neighbours

- A top-N or a breakdown is a [BarList](node_modules/basalt-ui/docs/bar-list.md) in a [ChartCard](node_modules/basalt-ui/docs/chart-card.md) so the row reads as one surface level.
- Steps with a duration each (a deploy, a job run, a trace summary) are a [StepRail](node_modules/basalt-ui/docs/step-rail.md): bars scaled to the longest step, composed in a [DataPanel](node_modules/basalt-ui/docs/data-panel.md).
- Records that wait on other records (tasks, Issues, deploy steps), asked what blocks what, are a [ChainView](node_modules/basalt-ui/docs/chain-view.md) on the table's focus; a strict tree is [DataTable](node_modules/basalt-ui/docs/data-table.md) with `nested`.
- A feed of things that happened is an [EventList](node_modules/basalt-ui/docs/event-list.md); a record's facts beside a list is [PageAside](node_modules/basalt-ui/docs/page-aside.md).

not guarded:

- Wrap no card around a [StatCard](node_modules/basalt-ui/docs/stat-card.md); it is already the card.
- Restate no figure: one number appears once per page, in the summary line, a card or a table cell.
- A tile with a hand-rolled box is a gap to report, not a part to rebuild.
