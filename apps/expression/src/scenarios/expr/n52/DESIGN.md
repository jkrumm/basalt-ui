# Household month, November (expr-n52)

## The three lines

- **Who opens it:** a household checking the month on the 19th.
- **The question:** is spending running faster than usual, and how much income is left once the bills still due are paid? The decision is whether to hold back spending until payday.
- **The figures that answer it:** the income left after bills (the hero, with its signed distance from the usual pace in the pill), the spent total and the bills due (footer pair), the day with the large one-off, the days with nothing spent.

## Surface

Two columns at `@wide`, one stack at a narrower container. The left chart card fills the row height, so both columns end flush; a floor on its cell keeps the stacked plot tall at 390.

| part                                   | question it answers                              | x,y w×h at 1800    | what it joins                                                                                                  |
| -------------------------------------- | ------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Spending pace (ChartCard)              | faster than usual? how much is left after bills? | 264,72 750×616     | one focus by day; figure follows it; income rule, payday rule, one-off dot and the end labels sit on the marks |
| Upcoming bills (DataPanel + DataTable) | what is still due, and when?                     | 1026,72 750×~320   | `focusItems` by day: a row holds its due day on both charts                                                    |
| Spending per day (ChartCard of Bars)   | which days made the pace?                        | 1026,~404 750×~324 | same focus by day; scale cut with the kit's `y.domain` caret, true value kept                                  |

Fail checks: no two parts answer one question; the table has four rows and shares half a row; no gap wider than a card in the first 1200 px; every part joins the one focus. The table's priority 1 columns are two (name with its due date as a sub line, amount), well under 480 px.

## colour: meaning

- accent blue: spending this month (the Spent line and the daily bars)
- dark ink, dashed: spent plus what is due, and the one-off dot
- mid grey: the usual pace (median of the last six months)
- ink step: the income rule
- pale grey, dashed: payday
- status red: the delta pill when the month runs behind usual (kit polarity), nothing else

## Pass criteria

1. The hero states the money left with its unit; the pill names its base ("vs usual") and its sign.
2. Income, payday and the one-off are drawn on the chart, each named on its mark.
3. A zero day (two weekdays with nothing spent) keeps a baseline tick; the one-off and the first-day payment are cut by the kit's caret with the true value kept in the readout.
4. Loading, empty and error hold the ready height on all three parts; the empty sentence stands once per source.
5. Pointing at a bill or a bar moves the chart's readout to that day; arrows step the chart by day.
6. At 390 the answer, the plot with its axis and the first bills sit above or just under the fold.

## Fixtures (`?fixture=`)

- default: the rest month, a one-off of 890 on day 11, spending above usual by day 19.
- `overdrawn`: income 3,100, a car repair of 1,750; the bills push the total past the income and the hero goes negative.
- `nobills`: nothing left to pay, no one-off, spending under usual; the bills table shows its empty state.

## Fact count

| fact                   | words         | places before                                                      | places after          |
| ---------------------- | ------------- | ------------------------------------------------------------------ | --------------------- |
| money left after bills | left          | hero unit, mark label, two focus units, announce                   | hero unit, mark label |
| the usual pace         | usual, median | pill, mark, legend, aria, announce                                 | pill, mark, legend    |
| bills due              | bills, due    | footer, panel title, table label, three units, legend, aria, empty | footer, panel title   |
| the one-off            | one-off       | subtitle, mark, legend                                             | subtitle, mark        |

First run of the count command (page strings, identifiers inside templates are noise): bills 10, month 9, usual 8, spent 8, left 7. Last run: month 6 and usual 5 and spent 5 and bills 5, all but bills and month identifiers (`d.usual`, `s.spent`, `month.income`); real prose repeats are bills 3, usual 3, spent 3, left 3.
