# Phone density: one inset (Issue 3211)

Frames at 390 x 844, light, the playground routes `/charts`, `/cards` and `/table`: `before-*` is master at `f28f0391d`, `after-*` is this branch.

## Numbers at 390 (asserted in `tests/layout/phone-density.layout.test.ts`)

| What                                                               | Before                                     | After                                                          |
| ------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Card, StatGroup and ChartCard content, from the screen's left edge | 24 px (8 gutter + 4 + 12)                  | 20 px (8 gutter + 12), one edge for all three                  |
| A ChartCard's chart frame                                          | 342 px                                     | 350 px (374 px with `bleed`)                                   |
| The plot inside it                                                 | about 298 px (a 44 px y axis column)       | 350 px (374 px with `bleed`)                                   |
| y tick labels                                                      | in an axis column left of the plot         | inside the plot, above their grid line                         |
| Lines that end apart                                               | named by the legend                        | named at their ends, no legend                                 |
| A wrapped legend's toggles                                         | 29 px pitch across rows, hit areas overlap | 44 px pitch, no overlap                                        |
| A table row on a phone                                             | label and value lines                      | title, two muted values, the answering value at the right edge |

## Decision: hairline, not flush

`decision-hairline.jpg` keeps the card's ring and radius on the 8 px page gutter and takes the content to 12 px inside it. `decision-flush.jpg` is the other option, emulated by a style override on the same fixture: cards run to the screen's edges, lose their ring and radius, and put the content on the 8 px gutter line.

The flush frame gains 8 px per side of plot (366 px against 350) and loses what makes a card a card: the screen becomes a stack of full-width bands, a card is no longer a thing that holds one question, and a bleeding chart (`bleed`) no longer differs from any other. It also needs the page to hand cards a negative margin, which breaks the moment a card sits in a grid cell, a split pane or a Section. The hairline keeps the card as the unit, costs 12 px per side and keeps the page gutter as the one gutter outside the card. `bleed` is the opt-in for the chart that wants the full width.

## Left as it was

- Bar kinds keep their y axis column: a bar fills the plot from its left edge, under any label placed there (an inside label drew at 1.5:1 on a bar in the layout suite).
- A chart with a right axis, a fixed `y.gutter` or stacked panes keeps its axis column.
- Type does not shrink on a phone (see `agent/skills/basalt-design/references/chart-view.md` § At 390).
