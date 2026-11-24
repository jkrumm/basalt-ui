# Chart color

Neutral by default, one accent, one status hue. Series colors come from the app's series file; the code is step 2 of the `basalt-charts` skill.

## The accent

- The accent marks the one series or mark class the question is about. A second series in the accent needs a second meaning named in a word on the surface (the legend or the card's context line, beyond `DESIGN.md`); otherwise it takes an ink step. One measure drawn at two grains (a heat ramp and its detail zone, a running total and its daily bars) counts as two classes.
- The accent goes to the item that answers, chosen from the data so it follows whichever item that is. The rest of that series stays in ink: today's dot in the accent on an ink line.
- A bar series puts the accent on its answering bars with `highlight: (d) => boolean`, inside the one series.
- Two accent lines told apart by `dash` alone take a name at each end through `chartLabels`, or a legend entry.

## Status hues

- A status hue marks a state that needs action and is carried with a word or a dot, never by hue alone. A target rule, a live band and a passing delta stay in ink steps; the failed mark takes the status fill instead of its category hue. [lint:status-fill-as-text]
- The common state stays neutral and the few that need a hand take the hue: a hue on most rows hides the one that matters.
- One fact takes one hue: a red pill and an amber dot for the same fact say it twice, and a third fact beside a red and green pair takes a neutral dot or a word.
- A delta pill takes its tint from its polarity (`up-good`, `up-bad`) where the direction is good or bad for the reader, and `polarity: 'neutral'` where it is neither. A quiet or zero day, or a delta against an empty or partial period, stays neutral.
- A ramp starts neutral below its threshold and turns hue only past it; zero stays neutral.

## One color, one meaning

- A part of a whole or a category split is read from position, order and a direct label; a hue per part is a rainbow.
- A state has one color in every linked view: the legend swatches, a table's status dots and the marks match, and a rise is one hue in the chart and in the pill.
- Kinds told apart by color take the series file's pairs. An HTML mark (a [Meter](node_modules/basalt-ui/docs/meter.md) bar, a track `div`, a dot) reads the same pair as a CSS variable: `groupTokens('<group>', tokens.series.<group>)` from `basalt-ui/tokens` gives `var(--basalt-<group>-<key>)`, so a kind keeps one color in the chart, the list and the track. Kinds drawn as close greys fail; give them distinct ink steps or a direct label.
- Before the shot is done, name each hue's meaning across the cards and the table columns of the 1800 frame together: a hue with two meanings, or one fact in two hues, is cut to an ink step or a word.
