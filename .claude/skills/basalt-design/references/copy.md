# Copy

The words on a page state facts: a precise noun, its scope, a live number. Slots and props: [PageBar](docs/page-bar.md), [PageSummary](docs/page-summary.md), [StatCard](docs/stat-card.md). Words for empty, loading and error are in [states](states.md).

## Titles and summary

- The page title names the subject and its scope ("Pull requests, last 30 days"), the page bar's `title`. [type:PageBarProps]
- The summary sentence carries a live number and states a fact: "12 tickets open, 3 past SLA". [PageSummary](docs/page-summary.md) renders it; a headline that restates the title is left out.
- A card title is a noun phrase naming the subject, in sentence case, in the body sans. A category word names nothing.

## Captions and facts

- Captions are sentence-case sans.
- A caption names a period when the figure has one ("First reply, 7 days"); a rate or total carries its period.
- A delta names what it compares to ("vs last week"); a unit sits beside the figure, spelled short.
- The footer states two facts at most. [type:FootFacts]

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
