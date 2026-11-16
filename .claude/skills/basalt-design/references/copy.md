# Copy

The words on a page state facts: a precise noun, its scope, a live number. Slots and props: [PageBar](node_modules/basalt-ui/docs/page-bar.md), [PageSummary](node_modules/basalt-ui/docs/page-summary.md), [StatCard](node_modules/basalt-ui/docs/stat-card.md). Words for empty, loading and error are in [states](states.md).

## Titles and summary

- The page title names the subject and its scope ("Pull requests, last 30 days"), the page bar's `title`. [type:PageBarProps]
- The summary sentence carries a live number and states a fact: "12 tickets open, 3 past SLA". [PageSummary](node_modules/basalt-ui/docs/page-summary.md) renders it; a headline that restates the title is left out.
- A card title is a noun phrase naming the subject, in sentence case, in the body sans. A category word names nothing.

## Captions and facts

- Captions are sentence-case sans.
- A caption names a period when the figure has one ("First reply, 7 days"); a rate or total carries its period.
- A delta names what it compares to ("vs last week"); a unit sits beside the figure, spelled short.
- The footer states two facts at most. [type:FootFacts]

## Word economy

- Marks and numbers carry the change. The hero is the answer with its verb and at most one phrase of baseline; the delta pill, the annotation on the mark and the footer pair say the rest.
- A sentence appears only where the marks cannot say it. A line that describes what the chart shows is cut; a line that names what the reader cannot see (a cause, a scope) stays.
- The hero's verb ("Runs out 13:52") is the answer, and the sentences around it say something else: the headline, the sub line, the annotation and the caption state it once between them.

### Worked: one fact, four lines, one figure

A build of an incident page said the same fact four times:

- Headline: "13 of 19 services are affected right now"
- Sub line: "13 services affected out of 19 in total"
- `refLine` label: "Limit: 19 services"
- Badge on the list: "13 affected"

Cut to what the marks cannot say: the figure `13` with its pill `of 19`, one annotation on the mark that needs the eye ("Worst: payments, 4 h"), and nothing else. The headline sentence, the sub line, the limit label (the line is the limit) and the badge (the list is the affected items) each restate the figure. Six cycle 3 builds (c10, c11, c12, c13, n02, n12) lost word economy to this shape; read each line aloud against the mark beside it, and cut every line that says what the figure, its pill or the annotation already says.

### Worked: the period said once

A build said "last 30 days" in the title, the caption, the axis title and the footer, and the hero repeated the count the chart's pill carried. Keep the period in the card's `figure` period slot and the count in the figure; the axis title names the unit only ("Deploys"), the footer holds two facts the marks do not (the busiest day, the slowest run). Six cycle 4 builds (n13, n09, c15, c14, n04, n16) stated one fact three to five times.

## Say each thing once

- A figure appears once per page, in the summary line, the card or the table cell, whichever the reader reaches first.
- A qualifier appears once: "681 allowed" in the figure and again in the caption is one qualifier too many. Put it where the reader looks first and cut the other.
- A caption sits under a subject already named by its card title; repeat the subject in the caption and it clips at 390 first.
- A label that restates the value beside it is cut.

## Control and action labels

- A button names its action by verb and object ("Compact now"); the primary action is one per view, in the page bar. [type:PageBarProps]
- An icon-only control carries an accessible name. [lint:primitive-bypass]

not guarded:

- Avoid filler: "Overview" or "Dashboard" alone, "Metrics", "Stay informed", "Oops", "No data".
- Avoid title case, a trailing colon on a caption and a leading "+" on a delta that has its own sign.
- Write no raw key or parameter dump into a footer.
