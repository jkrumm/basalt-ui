# Issues by state (scenario expr-n95)

## Question

- Who opens it: the factory owner, checking whether work piled up in one state.
- The question: at its worst, how many Issues sat in one state and when, and is the typical load steady or a few spikes.
- Decision: leave the queue alone or look at what held the busiest state.
- The figures: the worst peak (16 Issues, Not started, Wed 18 Nov 15:00), its excess over that state's average (+12.2 vs 3.8) and a verdict word (a few spikes or steady) with the hours within half the peak (19 of 168).

## Datasets

| Dataset                                             | Shape                                              | Form                                                                                       | Why                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Peak and time-weighted average per state per bucket | 4 states, 24 h or 7 d by the hour, 30 d by the day | One ChartCard of four panes on one x and one shared 0 to 20 scale: peak bars, average line | One x, one question: a shared scale makes the four states comparable; the gap between bar and line is spike against typical |

Kit gap named: no pane title slot, so each pane's state name is its `y.title`.

## Surface

Window control in the page bar (24 hours, 7 days, 30 days, opening on 7 days). Below it one full-width card: figure row, legend, four stacked panes, two footer facts. The panes take the one `useChartFocus` over the buckets; a pointer or the arrow keys on any pane reads the same bucket in all four and in the figure's period. The tooltip is off because the period is the readout.

## Fixtures

- `default`: 7 days by the hour, a paused burst of 9 (average about 0.4), the worst hour in Not started.
- `day`: 24 hours by the hour.
- `month`: 30 days by the day; the window starts before the first Issue, drawn as a shaded zone.
- `pileup`: three hours of a stuck gate (peak 64, average 52): the shared scale stops at 30 and the kit draws the off-scale caret.
- `fresh`: a factory with no events: the card is empty with its cause.
- Every window: the last bucket is 14 minutes long and drawn at half strength; the card's footer names it.

## One view

| Part           | Question it answers                                                      | x,y w×h at 1800x1200 | What it joins                        |
| -------------- | ------------------------------------------------------------------------ | -------------------- | ------------------------------------ |
| Window control | Which span                                                               | 1510,56 265x28       | Every pane and the figure            |
| Figure row     | How many at the worst, when, spiky or steady                             | 280,185 1480x50      | The four panes through one focus     |
| Four panes     | Where and when did each state peak, and how far is the peak from typical | 280,255 1480x650     | One focus, one legend, one scale     |
| Footer         | How many hours were near the peak; how long is the latest bucket         | 280,925 1480x24      | none, two facts the marks cannot say |

The card ends at y 958 of 1200; the page holds one question, so the rest is empty by design.

## States

- Loading: the same card, skeleton figure and box, held footer labels.
- Empty (`?shot-state=empty`, `?fixture=fresh`): the card says the cause and the step in one sentence; legend and footer labels hold their place.
- Error: the host's "Could not load counts per state", one cause line, one Retry.

## Colour: meaning

- Brand blue: the worst peak (one bar, from `highlight`).
- Pale ink: every other peak.
- Dark ink: the average line.
- No status hue: nothing here needs a hand.

Accent count: one (the worst peak).

## Read aloud

- Worst peak 16 | the figure value, the label on its bar
- Which state and when | the figure period (and on focus the focused hour)
- Typical load | the average line, the delta label "vs 3.8 average"
- Spiky or steady | the status word
- Hours within half the peak | the footer
- Latest bucket is 14 min | the footer
- Window starts before the first Issue | the zone caption (30 days)
- Unit per bucket and zone | the subtitle
- Why a count is empty | the empty sentence

## Fact count

First run printed "8 peak", "7 issues", "5 issue", "4 average", "4 [# issues]", "2 [worst peak]", "2 [issue yet]", "2 [first issue]". After the cuts (title and legend words, one format helper, the first-Issue fact replaced by the latest bucket) the last run prints nothing.
