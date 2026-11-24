# Home line, 12 to 18 Nov (expr-n60)

## Three lines

- Who and what: a household looks back at the week's line and asks how much of it was down, how often, and how much was measured at all. The decision is whether to call the provider or look at the home router, in one verb: "escalate".
- Figures that answer: down time (4 h 58 min, 3% of 168 h), outages (7, one ongoing), measured (96.3% of cycles). Each clause of the question has a number at rest: the figure, the status and the two footer facts.
- Reads from DESIGN.md: neutral surfaces, one accent (an internet outage), one status hue (the outage still running).

## Surface

The track reads along time, so it takes the row's full width; the two lists sit under it, half a row each, on the same focus.

| part                                        | question it answers                             | x,y w×h at 1800x1200 | what it joins                                                 |
| ------------------------------------------- | ----------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| Time down by day (ChartCard, IntervalTrack) | how much was down, how often, how much measured | 264,72 1512×584      | figure period reads the focused span; focus drives both lists |
| Outages (DataPanel, DataTable)              | which outage: start, end, scope, length         | 264,672 750×435      | rows hold their spans by outage id (`focusItems`)             |
| Cycles by day (DataPanel, DataTable)        | how much was measured, how many cycles lossy    | 1026,672 750×435     | rows hold the spans of their day (`focusItems`)               |

Priority 1 and 2 columns of both tables sum under 480 px, so both stay tables at 750 px. Nothing is full width for four rows or one mark, no gap is card-wide, and every part joins the one focus. At 390 the card comes first (answer above the fold), the lists stack under it as cards, every column reachable (`card: 'value'` puts the meter on the card face).

## Color: meaning

- accent blue: an internet outage
- dark ink: a gateway outage
- status red: the outage still running (the one state that needs a hand)
- pale outline: time with no measurements
- meters in the tables: one ink step, no meaning of their own

## Fact count

- Run 1: outages 6, header 6, label 5, cycles 5, probe 4, line 4, [probe cycles] 3, [line outages] 2, [down min] 2.
- Run 2 (last): label 5, header 4. Both are the code tokens `label:` and `header:` that the quote-pairing in the count matches across code; no viewer string says either.

One line per fact, one place each:

- down time: figure value; its share of the week: figure period (the focused span replaces it on focus)
- outage count: footer; ongoing: status (and the `ongoing` word in the table's start cell, the open outage's end)
- measured: footer; the hole: label on its span; per-day counts: table
- scope meaning: Outages subtitle; lossy meaning: Cycles info; cycle rate: Cycles subtitle
- time zone: card subtitle

## Fixtures

`quiet` (zero outages, full coverage), `extreme` (a 26 h outage across two midnights, nine one-minute drops, the open one).
