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
- A domain word that is unfamiliar to a stranger carries an [InfoHint](node_modules/basalt-ui/docs/info-hint.md) whose definition is read from the app's glossary (`defineGlossary`) and retyped nowhere.

## Meaning, missing and time

- Every KPI card has one plain sentence of what its figure means and which way is good ("Merged pull requests. Higher is better."), in the `info` slot of the [StatCard](node_modules/basalt-ui/docs/stat-card.md); the delta's polarity says the same in colour. [type:StatCardProps]
- A figure nobody counted is a dash with its reason, "Not measured, <why>" ("Not measured, no agent has reported yet"). `value: null` on the [StatCard](node_modules/basalt-ui/docs/stat-card.md) draws the dash; the caption or the sub line names the reason.
- A time reads relative ("3 hours ago") with the absolute time on hover: `useFormat().relative` for the text, the `dateTime` form for the hover, or the table's `relativeTime` column, which carries both.
- An origin is a word plus its source ("Manual, from the CLI"; "Webhook, from GitHub"), where a bare word leaves the reader guessing who or what made it.

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

### Worked: a number four times, a leader three times

n10 printed "19.4 kt" in the hero, the bracket, the footer and the table; n18 named its leader in the hero, the list and a note. Keep it where the reader looks first and where a mark can carry it (the bracket on the chart), and let the hero, period, pill, footer and list each state something the others do not (n10 .38, n18 .76, n03 .9, n07 .21, n14 .50, n17 .62).

### Worked: the fact count

Before the last look, write the page's facts as a list with one line per fact: the fact, then every place it stands, as `current model: hero, chart label, rule label, table row, footer`. A fact with two or more places is cut to one, kept where a mark can carry it; the cut is made in the code, not noted. A fact is a noun with its value or its scope: a direction ("better when lower"), a period ("so far this week", "7 days"), a name (the top Issue, the contract), a verdict word and a total each count. c16 named its current model five times, n20 one overshoot four times, n19 its limit three times, n08 its verdict three times, n15 and n21 their baselines twice. Four cycles of prose on this did not move it; the count does, because a repeat is visible as a second entry.

Cycle 8 lost a P2 or a P3 to it in every case, and the count would have caught each:

- n27 (.8): `better when: all eight cards`, `period: summary, every axis`, `verdict word: beside its pill`, `vs last week: pill, footer`. The direction is one sentence in the card's `info`, the period one phrase in the period slot, the verdict the pill alone.
- n32 (.60): `the top Issue: hero, bar list, table`, plus near-twin card titles and the empty line three times. The top Issue stands in the hero and on its bar-list row; the table says only who waits.
- n30 (.43): `the contract: pill, legend caption, footer`. One of the three stays, in the pill.
- n29 (.33): `the year: three places`; the legend repeated its card's title and the hero's 38 %. A legend that names what the card title names is cut.
- n28 (.21): `change vs September: subtitle, footer`; the subtitle repeated the title.
- n31 (.49): `7 days: three places`, `each day's count: on the bar, in the list header`.

### Worked: a share and its threshold read as one line

A share against a limit is one line beside the hero, with the threshold drawn where the marks allow: "27 % strong, under 40 %", the 40 % line a `refLines` rule on the chart. n08 printed "4 of 15" and left the 40 % line to the legend; n19 stated a "too weak" total against nothing.

### Worked: numbers

The hero, the tooltip and the announcement go through one `useFormat` call at one precision: n19's hero read "-56.083 dBm" with an ASCII hyphen beside a rounded tooltip. A negative uses a true minus (U+2212), and one currency style per page ("$" beside "US$" read as two currencies: c16).

### Worked: an unfinished period is named

A partial week is drawn lighter and named where the reader reads it: "W16 so far" in the card's period slot, never the lighter fill alone (n15, n20). A target for it is prorated, or its pill stays neutral: n15 printed a red shortfall on a week not over.

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
- Print no 0 and no "None" for a figure nobody counted; a zero is a measurement.
- Print no bare ISO timestamp where a reader wants the age; the absolute time sits on hover.

Cycle 9 repeated it on pages of tables, again in every case:

- n33 (.9): `needs a fix`: strip and 'Failing' column; `F-232`: twice; `retry`: three buttons; a label on every line of a phone card. One verdict word, one id place, one Retry for the page.
- n34 (.17): `the go windows: hero, bands, table`. The hero states the next window, the bands carry the words, the table lists only what they do not.
- n36 (.38): `lane: a column that repeats each group header`, `you: every Waiting on cell and 'Author: you'`, `5 rows: beside the 5 in the card`. A group header says it once; a column that repeats it is cut.
- n37 (.45, .48, .49): `points: axis title, y ticks, labelled bars, hero unit`, 'Points (pts):' on every phone card, `'Not started, 13 pts'` beside a Points column of 13, `days left: '3 days left' and 'day 7 of 10'`. A unit stands once, beside the figure; a period stands in one phrase.
- n35 (.26): `5 h free: hero and mark`, `longest block: legend and mark`. The mark carries it, the legend names the form.
- n38 (.61): `issues held up: hero unit, axis title, label`, `ahead in N h: rows, footer, rule`, the empty sentence twice.

The repeat that a builder cannot see by reading is the one a unit or a window makes: list where each unit and each window is stated, then keep the one a mark carries.
