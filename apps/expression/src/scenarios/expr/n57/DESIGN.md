# Astronomy nights, next ten (expr-n57)

## Three lines

- Who: an amateur astronomer picking a night. Question: which of the next ten nights is worth the drive to a dark site, and when is the sky dark and clear. Decision: drive, or stay home.
- Figures that answer: the best night and site as the hero (Sat Nov 28 at Kamm), its usable hours against the nearest site, and its drive time; the half-hourly cloud for the night shown, with the usable window on the mark.
- From DESIGN.md: neutral cards, one accent. The accent is usable hours, on the heat ramp only; the detail chart's usable window is an ink step.

## One measure

Usable hours are the half hours inside astronomical darkness with the moon down and total cloud under 30 %. The hero, the ramp, the zone, the Best column and the 4 h bar all measure it. A clear night under a moon that is up scores 0 and is drawn as its own state, "Clear, moon up". A site with no forecast is its own state and never a zero.

## One view (1800x1200, content column)

| part                                          | question it answers                             | x,y w x h         | joins                                          |
| --------------------------------------------- | ----------------------------------------------- | ----------------- | ---------------------------------------------- |
| Usable dark hours (Heatmap card, hero figure) | which night and site, and how far is the drive  | 0,0 736 x 820     | the one focus; one tab stop, arrows step cells |
| Cloud through the night (ChartCard)           | when is it dark and clear on the night in focus | 736,0 736 x 535   | follows the focus, rests on the best cell      |
| Sites (DataPanel table)                       | how far, how dark a sky, how many good hours    | 736,535 736 x 275 | rows hold every cell of their site             |

Priority 1 and 2 columns of the table: Site (entity with sky as sub), Drive (meter), Best (number), about 400 px, under the 480 px limit. No part is full width, no gap as wide as a card.

## Color: meaning

- brand blue: usable hours (the heat ramp)
- ink steps: cloud lines (total darkest, layers lighter), the usable window (darker) and the moon-up span (paler) in the detail chart, drive meter
- grey fill: the moon is up (heat cells and the detail zone), no forecast is a paler grey
- no status hue is spent: nothing here needs a hand

## Fact count

First run printed site 11, dark 7, usable 6, night 5, drive 5, forecast 4, sites 4 and the phrases dark hours, usable dark, cloud cover (plus code artefacts from `.site.name` and `text:`). After cutting, the last run printed nothing.

Read-aloud, one place each: the best night and site (hero value and unit), usable hours of that cell (hero period, detail figure), its drive (hero period and the Drive column), the 4 h bar (detail pill), 30 % (heatmap subtitle and the rule), moon lit and the dark window (detail footer), missing forecast (Missing footer and the state), nights worth it (footer).

## Pass criteria

1. The hero names a night and a site and the hours it beats the nearest site by.
2. The best cell says "best" on the grid; the full-moon night reads "moon" in every column.
3. The two no-forecast cells are neither zero nor hue.
4. The detail chart marks the usable window, the moon-up span and the 30 % rule.
5. Loading draws every slot; empty and error name their cause once, on the hero card.
6. At 390 the answer card is first, the table keeps all three columns as cards.
