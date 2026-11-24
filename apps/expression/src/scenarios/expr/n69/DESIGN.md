# n69: lead routing across five Claude accounts

## The three lines

- **Who and what:** the factory owner routes new leads across Claude accounts. The question has three clauses: which account takes the next lead, which one fills before its week resets, how much of each week's allowance went unused. The decision after reading: send the next lead to the named account, or step in on the one that fills.
- **Figures that answer:** Atlas (next lead, a fill-first account with seats free); Birch (full Fri 14:00, 18 h before its reset, forecast 110 % at the reset); 10 % of the allowance unused on average, 38 % at the worst reset (Atlas, 4 resets ago).
- **From DESIGN.md of the app:** Identity unchanged, no knob set. No series group added: the heat ramp is the ink token, the accent and the status hue come from tone props.

## Surface

Three parts share one account order and one focus (the 5 accounts x 9 reset columns of the grid, the table rows hold their cells by account).

| part           | question it answers                                                                                   | x,y w x h at 1800x1200 | what it joins                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Strip, 3 cells | next lead, fills before reset, unused on average                                                      | 264,72 1512x186        | none; the hero of each clause. The two account cells and the table share one source and one retry, the trend cell and the grid another |
| Accounts table | what each account holds now: routing verdict, week and 5 h use, full-by time, seats, both reset times | 264,274 1512x276       | the grid, by account (`focusItems holds`): a row holds its 9 cells                                                                     |
| Reset grid     | how much of each reset went unused, and the forecast for the coming one                               | 264,566 1512x580       | the table, by account; arrow keys step cell by cell                                                                                    |

Checks against the rules:

- Two parts of one question in two rows: none. The table holds the live state, the grid the history.
- Full width for four rows: the table has 5 rows and 8 columns (its columns sum to 1,168 px of the 1,480 px it gets, so all are visible); beside the grid it would fold to 5 columns and cut both reset times and the 5 h column.
- Card-wide gap in the first 1200 px: none. Empty lower half: none, the page ends at 1146 px.
- Table priority 1 and 2 columns sum to 160 + 128 + 136 + 136 + 104 = 664 px, under 800.
- At 390: strip (2 cells per row), table as a 3-column table (account, routing, week), grid with the figure above it. The rest of the table opens in the row sheet.

## Fixtures

`?fixture=` names: `quiet` (every account just reset, all zeros), `extreme` (Birch full on both windows with every seat taken, Drift left its whole last week unused so a cell reads 100 past the ramp's 50), `none` (no account can take a lead: the strip says so). No name draws the rest state; `?shot-state=` draws loading, empty and error.

## Color: meaning

- accent (blue dot): the account that takes the next lead, in the strip and the Routing column.
- warn (amber): fills before its reset: the Routing word, the strip's lock-out, the over-cap zone and the "Will fill" grid cell. One state, one hue.
- ink ramp (grid): the share of the allowance left unused; zero stays the palest step.
- ink steps (meters, ink text): everything else, including closed, stale and paused accounts.

## Copy: one word per measure

- reset: the moment a window refills; reset times, "at each reset", "before reset".
- unused: the share of the allowance left; the grid has no tooltip, its figure line is the one readout.
- week and 5 h: the two windows; "seat" the capacity of an account.
- forecast: the pace-based estimate; "Projected use" names the strip meter that draws it.
- The count over the page source printed nothing on the last run. The first run printed 12 reset, 7 account, 6 unused, 5 resets, 5 full, 5 forecast, 4 next, 4 left, 4 lead, 4 accounts and 12 phrases.

## Pass criteria

1. The strip names the next-lead account, the account that fills and the mean unused share, each with its base.
2. The table row of the next-lead account says "Takes lead"; Birch's says "Fills early" in the one status hue.
3. Every cell of the grid that has a reading prints its value at 1800; the forecast cell of Birch prints its time.
4. A reading older than 2 h (Ember) has no forecast and says why in the readout line.
5. Loading draws every slot; empty and error name their own cause; each source has its own retry.
