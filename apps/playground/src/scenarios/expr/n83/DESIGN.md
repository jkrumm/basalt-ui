# n83: when agents run, in the owner's time zone

## The three lines

- Who: the owner of a fleet of agent tools, opening the usage page between runs. Question: in which hours of the day and on which days of the week does cost land, read in the owner's zone (Europe/Berlin)? Decision: move or stop a batch (`leave`, `move`).
- Answer figures: 64 % of cost lands Mon to Fri, 09:00 to 18:00 (`+37 pts` against the 27 % of the week's hours that window is); the day totals answer the days clause, the time-of-day totals the hours clause.
- Reads from DESIGN.md: neutral ink, no accent. Nothing narrows it.

## Surface

- Heatmap card (the mark): 7 weekdays by 24 hours, 168 cells folded from a few hundred usage records in the owner's zone, one ink ramp, capped at the third-largest cell so the one 03:00 batch clips to the top step and prints its true value on its cell.
- Two bar lists beside it, one per clause of the question, each on the heatmap's one focus through `focusItems.holds` (a weekday row holds its 24 cells, a time-of-day row its hours).
- One page control, Cost or Tokens, in the page bar: it scopes all three parts.
- At 390 the heatmap card comes first, the lists follow; ticks stand at 00:00 to 18:00 every 6 h.

## One view (1800x1200)

| part                         | question it answers        | x,y w×h          | joins                                      |
| ---------------------------- | -------------------------- | ---------------- | ------------------------------------------ |
| page bar control             | which measure              | 1604,56 172×28   | all three parts                            |
| weekday-by-hour heatmap card | which hours and which days | 264,117 1002×631 | focus, legend, caption                     |
| totals by day of week        | which days                 | 1284,117 492×368 | heatmap focus (holds 24 cells a row)       |
| totals by time of day        | which hours                | 1284,501 492×247 | heatmap focus (holds the cells of a block) |

No table: the 168 cells are the records' grain and the two lists are its marginals. Both columns end at y 748. No part is full width for four rows; the lower half of the 1200 frame is empty because three parts answer the question.

## Fixtures

- default: 361 records, one 03:00 batch on Wed 4 Nov at US$186 (57 % of that week), 91 empty cells, one cell with only unpriced records, the 25 Oct clock change (Sun 02:00 holds two hours).
- `no-batch`: the same month without the batch; the cap is 20 and no cell clips.
- `no-cost`: no record carries a cost; the cost view shows dashes and the tokens view still reads.

## States

- Loading: every slot of the ready card is passed (figure with held values, footer label with an empty value); the lists draw their rows as skeleton.
- Empty: one cause per part, each its own cause: the heatmap names the missing usage, the day list the missing day, the hours list the missing run.
- Error: one source, one `retry`; each part keeps its place.

## Copy and pass criteria

1. The hero carries a share and its baseline (27 % of the week's hours) as a signed pill.
2. The 03:00 batch is on its cell (190) and in the footer (US$186, 57 % of its week).
3. The cap is drawn in the legend (25+), the unit in its caption.
4. A cell with no record and a cell with records but no cost are two legend entries, the second with its record count.
5. A focused cell or row writes its reading into the figure's period; the tooltip is off.
6. Fact count run before the shot, and the read-aloud pass below.

## Fact count

First run (before the cuts): `7 record`, `5 weekday`, `5 hour`, `5 days`, `4 cost`, `4 [30 days]`, `2 [record lands]`, `2 [rank until]`, `2 [last 30]`. Last run: empty.

Measures and their words: cost (US$, "cost"), tokens ("tokens"), usage records ("record", "records"), the owner's week ("weekday" for a cell row, "day of week" for the list, "hours" for the blocks). `rg -ci 'spend|priced|usage'` leaves "usage" only in the three empty causes, which each name a different missing thing, and "priced" only in the `no-cost` period line ("Nothing priced yet").

## Read aloud

| fact                                           | every slot that says it                            |
| ---------------------------------------------- | -------------------------------------------------- |
| share of cost in office hours                  | figure value                                       |
| its baseline (27 % of hours)                   | figure pill                                        |
| the office window (Mon to Fri, 09:00 to 18:00) | figure period at rest                              |
| the zone and the clock change                  | card subtitle                                      |
| the 30-day window                              | page title                                         |
| the batch                                      | cell label 190, footer fact (US$186, 57 % of week) |
| cap and unit                                   | legend end label (25+), legend caption             |
| no record                                      | legend entry                                       |
| no cost, and how many records                  | legend entry with its note                         |
| weekday totals                                 | day list rows                                      |
| time-of-day totals                             | hours list rows                                    |
| the measure                                    | page control, the figure unit, the legend caption  |

Helpers and maps (`rg -n 'UNPRICED|NONE|PARTS|cellName|cellReading|spanReading|text\(f'`): `UNPRICED.label` reaches the viewer in the legend and, for an unpriced cell, in the focus reading, which only exists on focus. `cellName` and `spanReading` print the focus period and the announcement, which is the live region and not a slot on the frame. `PARTS` labels the hours list rows only.

## Colour

- ink ramp: size of the measure in a cell (light to dark); one hue family on the page.
- mid grey: cells with records but no cost.
- pale grey: cells with no record.
- accent: none. Status hue: none.

## Kit gaps reported

- `ChartCard` stretched beside two stacked lists is flush; `Heatmap matchHeight` fills it, but the kit has no word for "a grid of N rows takes its card's remainder" without it.
- `seriesTokens` on a group the provider does not register draws every cell black (the app root is not mine to edit), so the ramp takes `BASALT.ink`.
- A clock-change hour has no kit mark: it is a subtitle clause.
