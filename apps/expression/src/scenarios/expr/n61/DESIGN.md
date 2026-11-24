# Open work in one project (expr-n61)

## The three lines

- Who: the factory owner, opening one project's open work.
- Question: what is still open, in which state, and which Issue has waited the longest.
- Decision: hold on to a late Issue (release or close it) or leave the queue alone.
- Figures that answer: the longest wait with its Issue (hero), the count of Issues past a week (hero verdict), the count per state (state list, nothing running shown as a zero row).

## Surface

Question 1, what is open and in which state: the state list (BarList, one row per state, running kept at 0) and the table below it.
Question 2, which has waited longest: the hero card (days, Issue id, state, attempts, a line of every wait against the one-week rule) and the table sorted by wait with a meter column.
The three parts share one `useChartFocus` over the Issues: pointing at a state row lights its Issues in the table (`focusItems`), pointing at or stepping through a table row focuses it, and the live region names the Issue. The hero card joins nothing: it answers the headline, and its line is the distribution the table lists.

## One view at 1800x1200

| part                                | question it answers                           | x,y w x h        | joins                                                                   |
| ----------------------------------- | --------------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| Longest wait (StatCard + Sparkline) | which Issue waited longest, how many are late | 264,72 750x256   | nothing (headline; its line shows every wait against the one-week rule) |
| Issues by state (BarList)           | what is open, in which state                  | 1026,72 750x288  | the table through the state held by each row                            |
| Open Issues (DataPanel + DataTable) | every Issue with kind, origin, wait, attempts | 264,376 1512x640 | the state list, the focus                                               |

Table priority 1 and 2 columns: Issue (title) and State at priority 1, Waiting at priority 2, the rest at priority 3; full width at 1800, so no column is dropped; at 390 the rows become cards and every column is a line on its card.
Gaps: no gap as wide as a card in the first 1200 px. The cards of the first row end 32 px apart (kit gap: no option to align a StatCard and a BarList to one height).

## Color: meaning

- status red: an Issue held past a week (verdict dot in the hero and the State column), the one state that needs a hand.
- ink steps: everything else; no accent is spent, since the answer is a name and a number, not a series.

## Fixtures

- default: 30 Issues, two held over a week, nothing running.
- `calm`: nobody late, the longest wait is a paused Issue; the verdict reads neutral.
- `ancient`: one Issue held for 410 days; the line is capped at 30 days by the kit's `cap`, the meter by a cap of mine (marked), the true value stays in the cell and the hero.
- loading, empty and error come from `?shot-state=`.

## Pass criteria

1. The hero names the longest wait with its unit and the late count.
2. The state list shows five rows, running at 0.
3. Every row of the table carries its wait as a meter scaled to the oldest, with the one-week rule stated in the panel subtitle.
4. A state row, a table row and the arrow keys focus the same Issue(s).
5. Loading holds the loaded shape; empty and error name their cause or retry.
