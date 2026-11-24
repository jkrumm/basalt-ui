# Anti-defaults

Taste checks for a page that reads as a default. Read before the first build and at every look. Where a rule guards a tell, its tag is named; the rest are judgement, and the reviewer scores them.

## Seven defects a default page ships with

- **Clipped at 390.** A wide table with no scroll region, a fixed height on a card, text in a clipped box. [lint:raw-scroll]
- **Nameless controls.** An icon-only button or an input with no accessible name. [lint:primitive-bypass]
- **Restated figures.** One number in the summary line, a card and a table cell: each figure appears once per page.
- **A generic title.** "Overview" or "Dashboard" alone: name the subject and its scope. [type:PageBarProps]
- **A page root of its own.** A `div` with its own `gap` or `p-4`, a fragment, or a `@container` wrapper around the page: return `Page`, which owns the gutter and the top inset. [lint:page-root]
- **Color on its own.** A status carried by hue only: a word plus its tone, and polarity is data on the delta. [lint:status-fill-as-text]
- **A side stripe.** A colored bar on one edge of a card, row, toast or node reads as generated filler: say the state with `Status`, a badge or the tone of the whole border. [lint:tw-off-law]

## Self-check before review

Four defects a reviewer can pass and a person still marks down at the screen; the rubric fails a component on them (Craft 4, 8, 9 and 10), so run each on your own frames before you shoot for review:

- **Count the accent.** In the 1800 rest frame, name every series and mark class in the accent. More than one is cut to one, the rest go to ink steps in the series file, unless the page names a second meaning in a word ([chart-color](chart-color.md)).
- **No bare border.** Search the page for `border`, `border-b`, `border-t` and `divide-y` with no color class beside them: each paints in the text color. A rule between rows names `border-border` or `border-grid`, and rows separated by spacing and a hover surface need none.
- **Hover sweep.** Shoot `basalt-ui shot <route> --states rest,hover,focus,tooltip` and set each crop against the ready crop: the plot, its axes and the parts beside it sit at the same pixel position. A readout that grows the card, a label that wraps on focus or a legend that reflows is the defect.
- **Redraw test for marks you drew.** Rows, tracks and their labels start on one x and one rhythm; every label fits its box at 1800 and 390, none clipped or hidden under a mark; marks of one class share one size. Judge it as drawing, apart from whether the idea is right.
- **Records as a table.** A grid of five or more cards that each show one record of one shape gets a table view of the same records ([cards](cards.md)).

## Device checklist

Run it against the rendered page at 1800 and 390, light and dark, and one keyboard-focused frame; layout, contrast and motion show only there. Each line names the reference that holds the rule.

- **Answer on the mark**, **baseline**, **one name** and **axes**: [chart-labels](chart-labels.md).
- **One measure**, **part to whole**, **age and target**: [chart-form](chart-form.md), [table](table.md) § Measures in a column.
- **Color budget**: one accent, one status hue on the state that needs action, one meaning per hue across the cards ([chart-color](chart-color.md)).
- **Extremes, zeros, legends and heat grids**: [chart-honest](chart-honest.md).
- **Linked parts and one readout**: point at an item in the chart, then in the list, then step with the arrow keys; the other part focuses it every time, both ways ([linked-parts](../../basalt-charts/references/linked-parts.md)).
- **One view, sizes and 390**: [chart-view](chart-view.md).
- **Phases**: every part declares the same slots in every phase, nothing derived from rows before ready ([states](states.md)).
- **Fixture honesty**: the extreme reads true, a zero shows a cue, an empty state names the next step once ([concept](concept.md), [states](states.md)).
- **Label collisions and light-mode contrast**: direct labels clear each other and the marks; every text and mark reads in both schemes.
- **At 1800x1200**: a working screen answers its questions in the first screen without a scroll and runs full width; only running prose caps near 76 ch. 1280x800 keeps its layout and a phone scrolls vertically only ([concept](concept.md)).
- **Anatomy**: every card has its figure, pill, footer and context line; times and ids mono; cards in one row end at one height ([cards](cards.md)).
- **Table anatomy**: a `DataPanel` or a card with a title and a context line, never a flush `Section` ([table](table.md)).
- **Words**: `basalt-ui shot detect --facts <page dir>` reports no repeat, and the read-aloud finds no fact in two slots ([copy](copy.md)).
- **Numbers**: one `useFormat` at one precision, a true minus, one currency style ([copy](copy.md)).
- **Calm interaction**: the dimmed rest stays readable, and the gap between two marks or rows never flashes the unfocused state.

## Dashboard tells

| Tell                                          | Do instead                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A hue on every card                           | Neutral cards; one accent, spent where a decision turns on it                                                 |
| A delta with no period or polarity            | A tinted delta badge with its period ("vs last week"); `up-bad` when a rise is bad, plain if neutral          |
| Title-case or uppercase captions              | Sentence-case sans captions                                                                                   |
| A primary action drawn in the accent          | One ink-inverted primary per view [type:PageBarProps]                                                         |
| Equal cards in a uniform grid                 | Figures first, then the table or chart that explains them                                                     |
| A card wrapped around a `StatCard`            | The part is already the card; place it directly                                                               |
| A big number with no history, target or parts | Add a sparkline or a target, or make it a cell of a `StatGroup`                                               |
| A marker that restates the headline value     | Mark the target or the limit, not the reading                                                                 |
| Unlabelled marks with no axis or scale        | Direct-label the end points, add an axis, or use a table                                                      |
| Hand-formatted numbers in JSX                 | Pass the number; the part formats it                                                                          |
| Three rows of KPI cards                       | The card that answers, then the evidence; a stat row only for figures of equal weight, each with its baseline |
