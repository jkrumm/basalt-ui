# n84: API key spend

## Question

- Who: the owner of a shared team API key, opening the panel to decide whether the key is safe to keep sharing.
- Question: how much has each key spent over the rolling 30 days against its US$500 cap, and is anything still billing outside the gateway since the cutover. Decision: move the models still on the team key, or keep the cap.
- Figures that answer it: each key's 30-day total with its distance to the cap (strip), the spend outside the gateway since the cutover with the days it billed (chart card figure and footer), the models and keys it bills through (table).

## Surface

- Strip (3 cells, full width): the answer to clause one. Joins nothing: a cell is a total of the window, so it stays beside the chart that draws its history.
- Chart card, two panes on one x (2/3 width): the rolling 30-day total per key against the cap rule (pane one) and the daily spend outside the gateway with the cutover and the missing report marked (pane two). Both panes take the one focus; the figure, its readout and the table follow it.
- Table panel (1/3 width): the models still billing, one row per model and key, joined by `focusItems` (a row holds every day it billed).
- At 390 the order is strip, chart card, table, so the second clause is in the first screen.

## One view (1800x1200 shot)

| part                     | question it answers                          | x,y w×h          | what it joins                   |
| ------------------------ | -------------------------------------------- | ---------------- | ------------------------------- |
| Team key cell            | spend against the cap                        | 264,72 496×154   | nothing (a total)               |
| Gateway key cell         | spend against the cap                        | 772,72 496×154   | nothing (a total)               |
| No key cell              | spend that sits on no cap                    | 1280,72 496×154  | nothing (a total)               |
| Chart card, rolling pane | when each key crossed the cap                | 264,242 1003×608 | focus, cursor group             |
| Chart card, daily pane   | what still bills outside the gateway, by day | inside the card  | focus, cursor group             |
| Table panel              | which models, through which key              | 1283,242 493×307 | focus (holds the days of a row) |

The table's three columns (model, spent, billed through) are all priority 1 or 2 and render as a table at 493 px, as the 1800 shot shows; the key column moves to the phone table's third slot at 390.

## Color: meaning

- ink (dark): the team key and spend before the cutover.
- ink (pale): the gateway key.
- blue accent: spend outside the gateway after the cutover (bars through `highlight`, the legend entry and the figure's status dot).
- status red: a key over its cap (the Team key delta pill and the meter's last zone), nothing else.

## Fixtures

- default: the team key 12 % over its cap, the gateway key under it, one day with no team report (30 Oct), keyless rows, zero days after the cutover.
- `idle`: the gateway key has no spend, so everything keeps billing on the team key (2.5 times the cap).
- `spike`: one US$1,832 day on the team key; the daily pane is capped by the kit's `y.domain` and carries the caret and the true value.
- `?shot-state=loading|empty|error`: every part keeps its slots; the strip and the chart card plus table take separate sources, each with its own retry.

## Fact count

First run (before the cuts): `12 spend`, `11 gateway`, `9 team`, `6 outside`, `6 days`, `6 billed`, `5 usage`, `5 reload`, `5 export`, `5 [team key]`, `4 reported`, `4 cutover`, `4 against`, `4 [t00 00]` (a date string in the page, moved to `model.ts`), `3 [spend reported]`, `3 [30 days]` and nine more phrases at two.

Last run: empty.

Measures and their words: spend (rolling total, per day, spent: one word each in its own slot), outside the gateway (status only), cap (rule, delta base, zone words), cutover (legend, rule, and nowhere else), report (table empty, rule, readout).

## Read aloud

| fact                                        | every slot that says it                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| the team key's 30-day total                 | strip cell value                                                                                                |
| the gateway key's 30-day total              | strip cell value                                                                                                |
| spend with no key                           | strip cell value                                                                                                |
| the distance to the cap                     | the pill on the Team and Gateway cells                                                                          |
| over or under the cap                       | the meter's zone word and the pill's tone (one fact on two slots: the word is the state, the pill the distance) |
| the US$500 cap                              | the rule's label in pane one                                                                                    |
| spend outside the gateway since the cutover | figure value                                                                                                    |
| it fell against the 16 days before          | figure pill                                                                                                     |
| it is still billing                         | figure status                                                                                                   |
| the days it billed, and the last            | footer                                                                                                          |
| the cutover date                            | figure period at rest, the rule's label in pane two (the date once, the word once)                              |
| the missing report                          | the rule's label in pane two, the figure readout when the day is focused                                        |
| which models and keys                       | table rows (key names come from `KEY_NAME`: strip, line ends, table column, announcement)                       |
| the sort                                    | table subtitle                                                                                                  |

Helpers and maps grepped: `rg -n 'KEY_NAME|dayText|money\(' ExprN84.tsx`. `KEY_NAME` is an identity label on four slots (strip, line ends, table, live region); every other helper prints a value into one slot, except `dayText`, which writes the dates of the figure period, the footer and the readout, each a different day.

## Frames

Rest, `idle`, `spike`, loading, empty and error in light and dark at 1800 and 390; one keyboard frame (two arrow presses, `basalt-ui shot --states keys`) with no page error.
