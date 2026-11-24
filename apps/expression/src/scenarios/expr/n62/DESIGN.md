# Kitesurf spot, next 48 hours

## Three lines

- Who opens it: a kitesurfer checking the spot. The question: when in the next two days is the wind steady between 12 and 25 kt, from a usable direction, and how gusty. The decision: go, and when.
- The figures: the longest rideable window as the hero (`Sat 11:00-18:00`), its steadiness as the status (`Steady, gusts x1.2`), and per window its mean and peak. Rideable means the mean in 12-25 kt and the direction in 200-290 degrees.
- From DESIGN.md: neutral surfaces, one accent (rideable), one status hue (offshore).

## Surface

The wind and gust lines share one time axis and one card with the rider's range and the two kinds of window drawn as zones. The direction is a second scale, so it is a second card. The windows list sits beside the direction card; all three join one focus over the 48 hours.

## One view (1800x1200, shell content 1512 wide)

| part                                     | question it answers                             | x,y w x h        | what it joins                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wind and gusts card                      | when is it in range and how gusty               | 264,72 1512x584  | the focus; hero, status, zones and footer answer here                                                                                                              |
| Windows by state (DataPanel + DataTable) | what each stretch of the 48 h is and how strong | 264,672 748x316  | the focus through `focusItems.holds` (a window holds its hours); priority 1 and 2 columns: Window 15 ch, Verdict 8 ch, Mean and Peak about 9 ch each, about 430 px |
| Wind direction card                      | is the direction usable, and when does it turn  | 1028,672 748x323 | the focus; the hour pointed at in either chart is read in both                                                                                                     |

Nothing answers one question twice: the wind card holds range and gust, the table holds the per-window figures, the direction card the sector. At 390 the order is wind, windows, direction.

## Colours

- accent (brand tint): a rideable window, zone fill and the Steady or Gusty verdict dot
- status red: offshore, as the zone on the wind card, the dots on the direction card and the table verdict
- ink, darkest: the wind line, in-sector dots
- ink, mid steps: the three gust lines (solid 1 h, dashed 3 h, dashed paler 6 h) and the range rules
- neutral tint: the usable sector band

## Facts, one place each (second run of the count: empty)

- 12-25 kt: the two rules on the wind card; the rule sentence stands once in the table's context line
- the rideable window: hero and its zone label on the mark; the table lists all windows
- the offshore turn: the zone and the direction card's hero say when, the table carries its figures
- gust ratio: the status and the table; steady or gusty is the verdict word, the threshold is in the context line
- the empty cause and the error cause: one wording, passed to all three cards

First count run: 9 wind, 6 hours, 6 gusts, 5 verdict, 4 usable, 4 offshore, 4 next, 4 length, 4 header, 4 gust, 4 forecast. Last run: empty.

## Fixtures

- default: Saturday sea breeze (steady), a gusty Sunday morning window, and a front at Sunday 14:00 that turns the wind offshore.
- `calm`: wind under 5 kt with zero hours, so no hour is in range; the hero says so and the range rules stay on screen.
- `storm`: the front arrives with a 91 kt gust; the y axis is clamped at 45 kt by the kit and the true value is in the footer and the caret.

## Pass criteria

1. The hero names a window and the zone on the chart carries the same window with its verdict and length.
2. The 12 and 25 kt rules are drawn.
3. Offshore hours are red in the chart zone, the dots and the table.
4. Loading holds the loaded height of every card; empty and error name one cause each.
5. Pointing at a window row holds its hours in both charts; two arrow presses on a chart step the hours and the readout follows.
