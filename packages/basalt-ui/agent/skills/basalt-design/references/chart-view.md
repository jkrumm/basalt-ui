# Chart view

The parts that answer one question read as one working surface at 1800 and at 390. Judge it from the shots, never from the code.

## Anatomy of a chart card

- The headline figure, its unit, delta, period and status live in the card's `figure`; a card action lives in the card's own `menu` or `controls`, not in the page bar. [type:ChartCardProps]
- The status is a dot and its word ([Status](node_modules/basalt-ui/docs/status.md)) in the figure. [lint:status-fill-as-text]
- The footer holds at most two facts the marks do not say. [type:FootFacts]

## One view at 1800

- Parts that answer one question sit beside each other inside the 1800×1200 fold at `@wide`, and the table that answers sits above the fold.
- Charts on one x share one card, or sit side by side inside the fold; two cards stand only when the axes differ. Two charts that answer the two halves of one question on one axis are one diverging chart in one card.
- A list longer than the chart sits beside it in its own scroll region at `@wide`; a box takes its content's height, so a fixed height neither leaves a gap nor clips.
- A form laid out along time or along a chain ([IntervalTrack](node_modules/basalt-ui/docs/interval-track.md), [ChainView](node_modules/basalt-ui/docs/chain-view.md), a timeline) takes the row's full width with its list below on the same focus, because half the width is half the reading. Half width is for a form that reads at half width: a bar list, a sparkline, a short chart.
- Peer cards that each answer one dimension of one question join into one answer: one figure above them, or one shared axis across them. A dimension of the page's question is a row of one card.
- Two parts that share a focus share one legend and one caption.
- A part that restates another part's rows or figures is folded into it or dropped: ask of each part which figure or row only it says. A table of the chart's items is a [DataTable](node_modules/basalt-ui/docs/data-table.md) with `focus` inside the chart's card, beside the chart rather than as a third stacked surface.
- Many small cards are grouped by verdict, the group that needs action first, and every card keeps a label for its figure.
- A [DataTable](node_modules/basalt-ui/docs/data-table.md) in a half-width cell (about 730 px) folds into phone cards unless its priority 1 and 2 columns fit ([table](table.md) § Priority): add that width before you place a table beside its chart, then demote a column to priority 3 or give the table the wider column.
- The page fails on any of: two parts that answer one question in two rows; a full-width part that holds four rows or one mark; a gap as wide as a card in the first 1200 px; a part that joins nothing and lacks a word for why it stays. Fix the surface (which parts share a card, a legend or a focus) and shoot again; padding changes none of these.

## Size each part to what it holds

- A chart is as tall as its marks need, and cards in one row end at one height: give a short card its content's height or a second fact.
- A [Heatmap](node_modules/basalt-ui/docs/heatmap.md) of a few rows takes `height`, and `matchHeight` only inside a card its rows fill; a `min-h` stays within the rows it holds; a table panel takes `bodySize={{ rows }}` per layout in place of a hand `height`; every cell of a strip takes footer `rows` so the cells end at one height.
- A row or bar count is derived from the data or the fold. A part more than a third taller than its marks is resized and shot again.

## At 390

- One visualization is one tab stop: [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md) moves focus between datums with the arrows, inside the one tab stop.
- A plot keeps the height its axis needs: `ChartCard height="tall"` is a 288 px box at 390, the same as `auto` on a card 576 px or wider; cut the ticks to the ones that fit.
- A phone pays one inset: the page gutter (8) plus a card edge of 12 on every card, stat group and [ChartCard](node_modules/basalt-ui/docs/chart-card.md), so content stands 20 px from the screen and a plot is 350 px. Y tick labels sit inside the plot above their grid line (bars keep their column, as does a `y.gutter` or right axis). The card's `bleed` runs the plot to the card edges (374 px) for the chart that answers the page.
- Lines that end apart are named at their ends and the legend goes; lines that end close, or long names, keep the legend, whose wrapped rows sit 44 px apart on touch.
- The type scale holds on a phone: Apple's body default (17 pt) is larger than ours and the research argues against smaller text. Save room by cutting words and parts.
- The answer comes first: order the parts so the rows that answer, and each clause of a two-clause question, sit in the first screen, and keep the answering column in view, in front of any `phone: 'scroll'` columns.
- Each item keeps one line of detail (its title, its time); the rest folds into the item's detail. A table that repeats the chart's rows is dropped.
- The kit cuts a mark label, a card `sub`, a status and a subtitle to one line and drops lower-priority labels. Keep each to a name or a number that fits, put a sentence in a wrapping line (the context line, a table row, a legend entry), and read every 390 frame for an ellipsis.
- A strip cell fits one line with its verdict word.
