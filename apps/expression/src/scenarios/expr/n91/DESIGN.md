# n91: library enrichment

## Three lines

- **Who and the question.** A library owner after an enrichment pass: how much of the library is enriched, what fails and why, and what the rest will cost, including what a schema change bills again. The decision is a verb: retry, fix the sources, or hold the next sweep.
- **The figures that answer.** 612 of 900 enriched (cell 1), 48 failed with 29 transport and 19 model output (cell 2), US$7.01 still to bill (cell 3) with the older-schema share on the accent bar of the bill list.
- **From DESIGN.md.** Identity inherited unchanged; series are the `N91_SERIES` group in `src/demo/series.ts`.

## Surface

Parts: the strip (three answers), the failure list and the bill list (the why and the cost, one focus with the table), the daily spend and cache chart (the cost history), the table of every entry that still needs work. At 390 the order is strip, failure list, bill list, chart, table.

## One view (1800x1200, page content starts at x 264)

| part                        | question it answers                                       | x,y w×h                | what it joins                                           |
| --------------------------- | --------------------------------------------------------- | ---------------------- | ------------------------------------------------------- |
| Enriched cell               | how much is enriched                                      | 264,112 496×210        | none (a running-total spark)                            |
| Failed cell                 | how many fail, in transport or in model output            | 772,112 496×210        | none (a failures-per-day spark)                         |
| Still to bill cell          | what the rest costs against what was spent                | 1280,112 496×210       | none                                                    |
| Why entries fail            | which cause fails or blocks entries                       | 264,338 750×392        | the table focus, by `focusItems` (reason)               |
| Bill by cause               | what each cause bills next, and the schema re-bill        | 264,742 750×208        | the table focus, by `focusItems` (bill cause)           |
| Spend and cache hits by day | did spend and cache hits move, and which day had no reads | 1026,338 750×612       | its own day focus on both panes                         |
| Work left                   | which entries wait, fail, or sit on an older schema       | 264,966 1512×(10 rows) | the entry focus; sorted and filtered rows keep the link |

Table priority 1 and 2 columns (name 40 ch, state 20 ch, reason 26 ch, bill 14 ch: about 340 + 184 + 232 + 136 px) sit in a full-width card, so no column drops at 1800. No gap as wide as a card, no dead lower half, the two columns of row 2 end level (950).

## Colour: meaning

- blue (accent): the bill a schema change repeats, on the bill row and the older-schema state in the table. One class.
- red (status): an entry the sweep failed on or cannot reach, the State column only.
- dark ink step: transport errors, the waiting bill, spend bars. Mid ink: model errors, retries, the cache line. Pale ink: unreachable entries. Ink steps are never a status.

## Phases and fixtures

- Loading, error and empty keep every slot (held `Delta`, empty row values, `bodyRows`, `bodySize`). Error: two sources, two retries (library index, usage log). Empty: one cause, "The library is empty", passed to every part.
- `?fixture=fresh`: 120 entries, nothing enriched, no spend, no cache reads: zeros at rest, the bill dash with its cause, the chart cause.
- `?fixture=outage`: 232 failed with one day of 190 transport failures (the failure spark takes the kit's `cap`), a 38 min lag.
- The rest fixture holds 3 unpriced entries, a day without reads (15 Nov, a zero bar tick and a gap in the line), 4 orphaned and 2 unreadable entries, an 11 min lag.

## Fact count

First run (before the cut): `11 entries`, `10 sweep`, `7 failed`, `6 cache`, `5 spend`, `5 next`, `5 hits`, `5 billed`, `5 [next sweep]`, `5 [cache hits]`, `4 waiting`, `4 schema`, `4 older`, `4 model`, `4 [older schema]`, `3 [sweep bills]`, `3 [model output]`, `3 [first sweep]`, `2 [week ago]`, `2 [sweep picks]`, `2 [billed again]`. Last run: empty print.

Measures and the words the page uses for each: enriched (Enriched, "enriched"), failed (Failed, "fail", "Nothing has failed"), waiting (Waiting; `KIND_LABEL.waiting` is the one string), older schema (Older schema, `KIND_LABEL.older`; "A schema change bills again" says the consequence once), spend (spend in the chart title, spent in the pill base, US dollars on the axis), price (Mean price), the run (sweep only).

## Read aloud

Read from the 1800 rest frame, top to bottom. `rg -n 'KIND_LABEL|noEntries|noSweep|noPrice|usd\(|cacheText|weekBase|signed\(' <dir>` run on the final source; each use below is one slot.

- 612 enriched | Enriched cell figure
- 900 library size | Enriched cell unit
- 240 waiting | Enriched cell row (the table and the bill list name the state per row and per dollar, never the count)
- 31 on an older schema | Enriched cell row (the bill list says US$0.69, a different measure)
- 435 a week ago | Enriched pill base
- 48 failed | Failed cell figure (the cause rows split 54 with the 6 unreachable, a different set)
- 29 transport, 19 model output | Failed cell rows (the legend names the kinds with no count)
- 4 orphaned, 2 unreachable | the two cause rows (no total of 6 anywhere)
- US$7.01 still to bill | Still to bill cell figure (the three bill rows are the parts)
- US$13.89 spent so far | the meter's value under the pill (the pill base says "vs spent so far", no second number)
- US$0.022 mean price | Still to bill cell row
- 3 unpriced | Still to bill cell row
- 11 min lag | page summary
- US$4.09 in the last 7 days, 15 to 21 Nov | chart figure and its period (on focus the period reads the day, its spend and its cache share)
- cache hit rate per day | second pane; a gap and the caption "No reads" on 15 Nov (the readout says "none" for that day)
- schema re-bill US$0.69 | the accent bill row
- empty cause | one sentence (`noEntries`), one slot per part in the empty frame: strip, two lists, chart, table; the sentence is the shared cause, written once

Helper greps: `usd(` prints money in the strip, lists, chart figure and readouts, each a different amount; `KIND_LABEL` feeds the strip rows, the legend, the bill rows and the State column, each a different count, dollar or row; `cacheText` feeds the announcement and the readout of one day (one fact, one slot per focus state).

## Keyboard

`basalt-ui shot /scenarios/expr-n91 --states rest,hover,focus,keys,tooltip` shot; two arrows on the spend pane step the day and the figure's period reads "24 Oct US$0.15 53%"; no page error.
