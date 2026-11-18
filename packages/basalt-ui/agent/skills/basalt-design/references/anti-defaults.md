# Anti-defaults

Taste checks for a page that reads as a default. Read before the first build and at every look. Where a rule guards a tell, its tag is named; the rest are judgement, not law, and a reviewer scores them.

## Six defects earlier builds shipped with

- **Clipped at 390.** A wide table with no scroll region, a fixed height on a card, text in a clipped box. [lint:raw-scroll]
- **Nameless controls.** An icon-only button or an input with no accessible name. [lint:primitive-bypass]
- **Restated figures.** One number in the summary line, a card and a table cell: each figure appears once per page.
- **A generic title.** "Overview" or "Dashboard" alone: name the subject and its scope. [type:PageBarProps]
- **A page root of its own.** A `div` with its own `gap` or `p-4`, a fragment, or a `@container` wrapper around the page: return `Page`, which owns the gutter and the top inset. [lint:page-root]
- **Colour on its own.** A status carried by hue only: a word plus its tone, and polarity is data on the delta. [lint:status-fill-as-text]

## Owner self-check

The owner's first hands-on review of the playground (2026-11-18) marked down five things the reviewers had passed: n15 "too much screaming blue", n02 and n04 "too hard borders between entries", n35 "nice idea but horrible rendering", n04 "hovering the chart causes crazy jumps", and n27's grid of cards with no table view. The reviewer now scores each: the shipped rubric fails a component on the first four (Craft 4, 8, 9 and 10), and the expression trials cap the score under the pass line on them, so run them on your own frames before you shoot for review, each as its own line:

- **Count the accent.** Write `accent: <every series and mark class in it>` from the 1800 rest frame. More than one is cut to one, the rest go to ink steps in the series file, unless the page names a second meaning for the second in a word (n15 drew minutes and pace in one blue, so the hue pointed at nothing).
- **No bare border.** Search the page for `border`, `border-b`, `border-t` and `divide-y` with no colour class beside them: each paints in the text colour, an ink rule. A rule between rows names `border-border` or `border-grid`, and rows separated by spacing and a hover surface need none (n07's list has none, and of its right side the owner said it "does the right side better").
- **Hover sweep.** Shoot `basalt-ui shot <route> --states rest,hover,focus,tooltip` and set each crop against the ready crop: the plot, its axes and the parts beside it sit at the same pixel position. A readout or tooltip that grows the card, a label that wraps on focus, or a legend that reflows is the defect (n04's plot jumped under the pointer).
- **Redraw test for marks you drew.** Rows, tracks and their labels start on one x and one rhythm; every label and title fits its box at 1800 and 390, none clipped, cut at the card edge or hidden under a mark; marks of one class share one size. Judge it as drawing, apart from whether the idea is right: n35's week track was the right idea, scored 85 and passed, and the owner called its rendering poorly designed.
- **Records as a table.** A grid of five or more cards that each show one record of one shape gets a table view of the same records, a toggle in the header or a table beside the grid ([cards](cards.md)).

## Device checklist

Run it against the rendered page at 1800 and 390, light and dark, and one keyboard-focused frame; layout, contrast and motion show only there. Each device names the reference that teaches it.

- **Answer on the mark.** The hero states the answer with its verb and at most one phrase of baseline, and the mark that answers carries its value or name at rest (the share on its segment, the sha on the deploy rule, the top Issue's row); a list keeps the answer above its cut ([charts](charts.md)).
- **One measure.** The hero, the marks and the baseline measure one quantity; a comparison of a group against its control draws both on one axis and leads with the signed difference ([charts](charts.md)).
- **Baseline.** Every headline figure shows its target, prior period or limit as a signed delta or as geometry, a colour rule alone included; a share shows its whole beside it ("9 / 18") ([charts](charts.md), [cards](cards.md)).
- **Extremes and zeros.** One outlier is capped with `y.domain` and the off-scale caret; a saturated ranking says how many are hidden; a zero series draws a mark ([charts](charts.md)).
- **One readout.** When the figure follows focus the tooltip is off, and the announcement names the focused item's values ([charts](charts.md)).
- **Colour budget.** A status hue marks only a state that needs action, the common state stays neutral and a quiet or zero day is no fault (its delta is neutral); the failed mark takes the status fill ([charts](charts.md)).
- **Seam-drawn finish.** A focus mark beside the ring, the ring inset clear of text, tabular numerals, motion-safe transitions, on-ladder values, status tokens as fills only ([charts](charts.md)).
- **Phases.** No pill, dash or delta outside the ready phase; every part declares the same slots in every phase, and the loaded summary is no taller than its skeleton at 390 ([states](states.md)).
- **Fixture honesty.** The extreme reads true, a zero shows a cue, binned bars carry a unit caption, every skeleton holds the loaded height, an empty state names the next step once ([concept](concept.md), [states](states.md)).
- **Label collisions and light-mode contrast.** Direct labels clear each other and the marks; every text and mark reads in both schemes.
- **At 390.** The answer and the first rows sit above the fold; a header that pushes rows below it is the defect ([concept](concept.md)).
- **At 1800x1200.** A working screen answers its questions in the first screen without a scroll (a project page: is it healthy, what moves now, what is next, what shipped) and states each fact once. It runs full width; a narrow centred column wastes half the frame, and only running prose caps near 76 ch, with side panels using the rest. 1280x800 keeps its layout and a phone scrolls vertically only ([concept](concept.md)).
- **Anatomy.** Every card of the page, the secondary ones included, has its figure, pill and footer; cards in one row end at one height; a subtitle carries a fact; a page of rows leads with a card of figure, context line and footer ([cards](cards.md)).
- **Fact count.** Write one line per fact, `fact: every place it stands` (a direction, a period, a name, a verdict, a total); a fact with two places is cut to one in the code, and a sentence appears only where no mark can say it. Read each line aloud against the mark beside it ([copy](copy.md)).
- **One view.** The parts read as one working surface at 1800 and at 390: charts on one x share a card or sit side by side inside the 1800x1200 fold, a chart is as tall as its marks need, a long list scrolls in its own region beside its chart, no dead band under a short card, two parts on one focus share one legend and one caption, nothing is large for its own sake ([charts](charts.md)).
- **Part to whole.** A few named parts are a one-row stacked `BarList` or a Meter in the series file's colours, the part that answers labelled on its segment, the legend rows spreading `focus.item(i)` or `focus.seriesItem(key)` ([charts](charts.md)).
- **Heatmap tools.** `annotate` puts the value on the cells that answer, a `states` entry marks a partial bucket, `tickCols` keeps clock-stop ticks ([charts](charts.md)).
- **Age and target.** An age or a duration column is a `c.meter` scaled to the oldest, with the rule that makes an item late stated on the column or the card; progress against a target is a [Meter](node_modules/basalt-ui/docs/meter.md) with zones or done against pace, never a rule over bars it does not measure, and the hero stands against the reference the data holds ([table](table.md), [charts](charts.md)).
- **Table anatomy.** A table is a `DataPanel` or a card with a title and a context line, never a flush `Section`; mono is for ids and times only; a page of tables takes one `useChartFocus` over its rows, and a chart beside a list is drawn at the list's grain ([table](table.md), [charts](charts.md)).
- **One name.** The axis, the list and the hero use one name per item; the kit cuts a long one ([charts](charts.md)).
- **Groups and phones.** Many small cards are grouped by verdict, the group that needs action first, and the verdict reads above the fold at 390 ([charts](charts.md)).
- **Linked parts.** Point at an item in the chart, then in the list, then step with the arrow keys: the other part focuses it every time, both ways. A `DataTable` or `BarList` of the page's items joins the one focus with or without a chart ([charts](charts.md)).
- **Numbers.** Hero, tooltip and announcement go through one `useFormat` call at one precision, with a true minus (U+2212) and one currency style per page ([copy](copy.md)).
- **Console anatomy.** Header with title and context line, figure and delta pill inside the inset, label and value pairs in the footer, monospace for ids, repo names and timestamps; a flush card with a small title over free text is the defect ([cards](cards.md)).
- **Calm interaction.** The dimmed rest stays readable, and moving the pointer across the gap between two marks or rows never flashes the unfocused state ([charts](charts.md)).

## Dashboard tells

| Tell                                          | Do instead                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| A hue on every card                           | Neutral cards; one accent, spent where a decision turns on it                         |
| A delta with no period or polarity            | A tinted delta badge with its period ("vs last week") and `up-bad` when a rise is bad |
| Title-case or uppercase captions              | Sentence-case sans captions                                                           |
| A primary action drawn in the accent          | One ink-inverted primary per view [type:PageBarProps]                                 |
| Equal cards in a uniform grid                 | Figures first, then the table or chart that explains them                             |
| A card wrapped around a `StatCard`            | The part is already the card; place it directly                                       |
| A big number with no history, target or parts | Add a sparkline or a target, or make it a cell of a `StatGroup`                       |
| A marker that restates the headline value     | Mark the target or the limit, not the reading                                         |
| Unlabelled marks with no axis or scale        | Direct-label the end points, add an axis, or use a table                              |
| Hand-formatted numbers in JSX                 | Pass the number; the part formats it                                                  |
| Three rows of KPI cards                       | One strip, then the evidence                                                          |
