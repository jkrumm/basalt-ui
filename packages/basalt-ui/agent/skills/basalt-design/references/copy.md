# Copy

The words on a page state facts: a precise noun, its scope, a live number, each said once. Slots and props: [PageBar](node_modules/basalt-ui/docs/page-bar.md), [PageSummary](node_modules/basalt-ui/docs/page-summary.md), [StatCard](node_modules/basalt-ui/docs/stat-card.md). Words for empty, loading and error are in [states](states.md).

## Titles and summary

- The page title names the subject and its scope ("Pull requests, last 30 days"), the page bar's `title`. [type:PageBarProps]
- The summary sentence carries a live number and states a fact: "12 tickets open, 3 past SLA". [PageSummary](node_modules/basalt-ui/docs/page-summary.md) renders it; a headline that restates the title is left out.
- A card title is a noun phrase naming the subject, in sentence case, in the body sans. A category word names nothing.

## Captions and facts

- Captions are sentence-case sans. A caption names a period when the figure has one ("First reply, 7 days"); a rate or total carries its period.
- A delta names what it compares to ("vs last week"); a unit sits beside the figure, spelled short.
- The footer states two facts at most, each one the marks do not say. [type:FootFacts]
- A domain word unfamiliar to a stranger carries an [InfoHint](node_modules/basalt-ui/docs/info-hint.md) whose definition is read from the app's glossary (`defineGlossary`) and retyped nowhere.
- Every KPI card has one plain sentence of what its figure means and which way is good ("Merged pull requests. Higher is better."), in the `info` slot of the [StatCard](node_modules/basalt-ui/docs/stat-card.md); the delta's polarity says the same in color. [type:StatCardProps]
- A figure nobody counted is a dash with its reason, "Not measured, <why>". `value: null` on the StatCard draws the dash; the caption or the sub line names the reason. A zero is a measurement.
- A time reads relative ("3 hours ago") with the absolute time on hover: `useFormat().relative` for the text, the `dateTime` form for the hover, or the table's `relativeTime` column, which carries both.
- An origin is a word plus its source ("Manual, from the CLI"; "Webhook, from GitHub").
- Numbers go through one `useFormat` at one precision in the hero, the tooltip and the announcement; a negative takes a true minus (U+2212), and a page keeps one currency style.
- An unfinished period is named where the reader reads it ("This week so far" in the period slot) in words as well as by a lighter fill; a target for it is prorated, or its pill is `polarity: 'neutral'`.
- A share against a limit is one line beside the hero ("27 % strong, under 40 %"), the limit a `refLines` rule on the chart.

## Say each thing once

- The hero is the answer with its verb and at most one phrase of baseline. The delta pill, the annotation on the mark and the footer pair say the rest, and the headline, the sub line, the annotation and the caption state each fact once between them.
- A sentence appears only where the marks cannot say it. A line that describes what the chart shows is cut; a line that names what the reader cannot see (a cause, a scope) stays.
- A figure appears once per page, where the reader reaches it first; a qualifier once ("681 allowed" in the figure and again in the caption is one too many); a label that restates the value beside it is cut.
- A caption sits under a subject its card title already names; repeating the subject clips it at 390 first.
- A unit stands once, beside the figure, and a window or a sort is a fact: state it once for the page, above the cards and rows. A group header says its value once; a column that repeats it is cut.
- One quantity takes one word in every string: "usable" on one card and "clear" on the next for the same hours is two words for one measure.
- The empty sentence stands on one card; the others hold a dash or a short caption ([states](states.md)).

### Example: one fact, four lines

An incident page said one fact four times: the headline "13 of 19 services are affected right now", the sub line "13 services affected out of 19 in total", a reference line labelled "Limit: 19 services" and a list badge "13 affected". Cut to the figure `13` with its pill `of 19` and one annotation on the mark that needs the eye ("Worst: payments, 4 h"). The limit label goes because the line is the limit, the badge because the list is the affected items.

## The fact count

Run `basalt-ui shot detect --facts <page dir>` after the first typecheck and again after every cut; it needs no shot round, and with `--out <dir>` its findings join that round's. It reads the strings a viewer reads in the page's `.tsx` files and reports each word said in four or more strings, each two-word phrase said in two or more, and each string constant read in two or more places as a `communication-5/repeated-*` finding. A reported word is cut or reworded in every string but one; it is never explained away. Keep every string the page writes in the page's own `.tsx` files, so none hides in a helper the count skips.

The count reads literal strings, so read the 1800 rest shot aloud as well, top to bottom, and group the rendered strings by what they say, not by their letters. Four shapes it cannot see:

- One value printed by one helper or one label map (a `Record<K, string>`) into several parts: run `rg -n '<name>' <page dir>` and count each use that reaches the viewer.
- One state said by a zone caption, a pill and a sub line.
- A legend entry that repeats an axis title, a subtitle or a period, or a meter that prints its value under the figure that says it.
- One fact in other words across slots ("Orphaned raws", "Orphans found", "unmatched").

Each group keeps one slot, the figure or the mark's label; the others are cut or say something the first does not. A reason to keep a second slot is not a slot.

## Control and action labels

- A button names its action by verb and object ("Compact now"); the primary action is one per view, in the page bar. [type:PageBarProps]
- An icon-only control carries an accessible name. [lint:primitive-bypass]

not guarded:

- Avoid filler: "Overview" or "Dashboard" alone, "Metrics", "Stay informed", "Oops", "No data".
- Avoid title case, a trailing colon on a caption and a leading "+" on a delta that has its own sign.
- Write no raw key or parameter dump into a footer.
- Print no 0 and no "None" for a figure nobody counted.
- Print no bare ISO timestamp where a reader wants the age; the absolute time sits on hover.
