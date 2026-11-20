# Household events, 2026: design

## The three lines

- Who: a household closing out its trips and shared costs. Question: which events cost more than the 300 euro limit once reimbursements are in, and which still wait for money back. Decision: chase the waiting events and talk about the ones over the limit.
- Figures: "4 of 9 events over" with the signed distance of the highest net to the limit (+€2,100), and "2 waiting" in the status slot; the net total and the waiting amount in the footer.
- Reads from DESIGN.md: the basalt identity unchanged, one accent.

## Surface

Two parts side by side at a regular container and stacked at a narrow one, sharing one `useChartFocus` over the nine event rows.

- Net card: two panes on one x, one bar per event. Top pane is the net with the limit rule; the 2,400 euro outlier is capped by `y.domain` and keeps its true value at the caret. Bottom pane is the reimbursed share of paid; an event with nothing back shows a 0 % tick.
- Ledger: a `DataPanel` with a `DataTable` of the same rows, so a row and a bar are one item. At 390 the table becomes cards, below the chart.

## One view, 1800x1200

| part                  | question it answers                   | x,y w×h                      | joins             |
| --------------------- | ------------------------------------- | ---------------------------- | ----------------- |
| Net card, top pane    | which events cost more than the limit | 265,72 750×565 (pane 1 of 2) | focus, limit rule |
| Net card, bottom pane | which still wait for money back       | same card, pane 2            | focus, same x     |
| Ledger                | the figures behind each bar           | 1027,72 750×565              | focus by row id   |

Table check: priority 1 and 2 columns are Event, Net, Status, Reimbursed, Paid; Paid sits at priority 3 and Bookings at 3, so the half-width table keeps Event, Net, Status and Reimbursed and the phone card carries all six.

## Colour

- accent: events over the limit (bars, legend entry, table status dot)
- ink steps: net within the limit, reimbursed share, limit rule
- status hue: none; waiting is a word and a 0 % tick, never a colour

## Facts, one place each

| fact                  | words                                       | places             |
| --------------------- | ------------------------------------------- | ------------------ |
| events over the limit | "4 of 9 events over", accent bars           | figure, bars       |
| distance to the limit | signed pill, labelled rule                  | pill, rule         |
| waiting count         | "2 waiting"                                 | status slot        |
| waiting amount        | footer fact                                 | footer             |
| rule for waiting      | "Waiting means nothing reimbursed yet"      | ledger subtitle    |
| empty                 | one sentence per card, each naming its step | chart card, ledger |

One word per measure: net, paid, reimbursed, waiting, limit.

## Fact count

First run: `9 limit`, `7 reimbursed`, `7 events`, `6 event`, `5 paid`, `4 waiting`, five phrases. Last run: empty print.

## Pass criteria

1. The hero reads "4 of 9 events over" and the highest net's distance to the limit.
2. The limit is a labelled rule; the outlier is capped with its true value on screen.
3. An event with nothing reimbursed shows a 0 % tick and the status word Waiting.
4. Pointing at a bar, a row or an arrow step focuses the same event in both parts.
5. Loading, empty and error hold the card heights of the ready frame.
