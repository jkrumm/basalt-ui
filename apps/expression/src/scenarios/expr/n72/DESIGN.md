# Spam filter on four forms, 14 days (expr-n72)

## The three lines

- Who and what: the owner of the forms opens this to check the spam filter. Question: which messages went out although a classifier called them spam, and how often do the two classifiers disagree when both are sure (80 % or more). Decision: **tighten** the filter, or **leave** it.
- Figures that answer: `4 of 145` sure pairs disagree (hero, baseline `-7.2 pts vs unsure pairs`); `Spam delivered: 1` (status). Both clauses are in the first screen at 1800 and at 390.
- From `DESIGN.md`: none given for this case; the playground's neutral zinc ink with the single blue accent.

## Surface

A scatter of the second classifier's confidence against the first's, one dot per judged submission, and a table of the messages worth a look. They share one `useChartFocus` over the dots; the table's rows are a subset of those items, joined by id (`getRowId`). The sure region is a zone on the chart (the threshold that defines the answer), not a footer fact.

## One view (1800x1200, content column 1536 px)

| part                                                                            | question                                                                                      | x,y w×h         | joins                             |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------- | --------------------------------- |
| Classifier agreement (ChartCard, scatter, zone, figure, status, legend, footer) | how often do the classifiers disagree when both are sure; which message was delivered as spam | 264,72 748×640  | focus: dots and table rows, by id |
| Flagged messages (DataPanel, DataTable)                                         | which messages: spam delivered first, then every disagreement                                 | 1028,72 748×640 | focus: rows and dots, by id       |

Table width: priority 1 and 2 columns (Message, Case, First / second, Outcome) estimated at 168 + 184 + 240 + 96 = 688 px, inside the 696 px a 700 px step holds; the table stays a table in the 718 px cell. Form and Received are priority 3 and show on the phone card. The content ends at y 712 of 1200: the surface is sized to one scatter and twelve rows, nothing else answers the question.

## Color: meaning

- blue (accent): disagreement when both are sure
- red (status): spam delivered, the one state that needs action
- dark ink: disagreement where one classifier is unsure
- pale ink: the classifiers agree
- Accent count: one series (the sure disagreements). The delivered message is not a sure disagreement in the default fixture, so no dot carries two classes.

## Fixtures

- default: 250 submissions, 12 disagreements (4 both sure), one spam message delivered (first classifier spam 91 %, second legit 62 %), 25 without a second verdict, one of them an error.
- `?fixture=clean`: no sure disagreement and no spam delivered; the hero reads `0 of 142`, the legend keeps its entries.
- `?fixture=wave`: a spam burst the filter let through, 14 spam delivered, agreed on by both classifiers; the table scrolls in its box, the dots spread.

## Fact count

First run (before the first cut): `9 spam`, `7 delivered`, `7 [spam delivered]`, `6 second`, `5 first`, `4 unsure`, `4 sure`, `4 confidence`, `4 classifier`, `4 both`, `3 [both sure]`, `2 [second classifier]`, `2 [flagged messages]`, `2 [classifier confidence]`, `2 [# spam]`.
Last run: empty. The case words (spam delivered, both sure, one unsure, agree) live once in `CASE_LABEL`; the legend, the status, the mark label, the zone label and the table's Case column read it.

Measures and their words: the second classifier (first / second), disagreement (disagree, disagreement), sure (80 % and over, the zone label), delivered (spam delivered, the Outcome column). One word each.

Facts and their places: 4 of 145 in the hero only; 1 spam delivered in the status and on its mark and row (the status counts, the mark names, the row lists); 25 without a second verdict in the footer only; the 80 % threshold on the zone only; the empty sentences one per card.

## Pass criteria

1. The hero carries a count and its whole (`4 of 145`), with a delta that names its base.
2. The sure region is drawn on the chart.
3. The delivered message is named on its dot and first in the table.
4. Pointing at a dot or a row focuses the other; two arrow presses move the ring and the readout.
5. A loading frame holds every slot; empty and error name their cause.
