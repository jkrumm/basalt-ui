# Anti-defaults

Taste checks for a page that reads as a default. Read before the first build and at every look. Where a rule guards a tell, its tag is named; the rest are judgement, not law, and a reviewer scores them.

## Five defects earlier builds shipped with

- **Clipped at 390.** A wide table with no scroll region, a fixed height on a card, text in a clipped box. [lint:raw-scroll]
- **Nameless controls.** An icon-only button or an input with no accessible name. [lint:primitive-bypass]
- **Restated figures.** One number in the summary line, a card and a table cell: each figure appears once per page.
- **A generic title.** "Overview" or "Dashboard" alone: name the subject and its scope. [type:PageBarProps]
- **Colour on its own.** A status carried by hue only: a word plus its tone, and polarity is data on the delta. [lint:status-fill-as-text]

## Device checklist

Run it against the rendered page at 1800 and 390, light and dark, and one keyboard-focused frame; layout, contrast and motion show only there. Each device names the reference that teaches it.

- **Answer on the mark.** The hero states the answer with its verb and at most one phrase of baseline, and the marked item is annotated at rest; a list keeps the answer above its cut ([charts](charts.md)).
- **Baseline.** Every headline figure shows its target, prior period or limit as a signed delta or as geometry, a colour rule alone included ([charts](charts.md)).
- **Colour budget.** A status hue marks only a state that needs action; the failed mark takes the status fill ([charts](charts.md)).
- **Seam-drawn finish.** A focus mark beside the ring, the ring inset clear of text, tabular numerals, motion-safe transitions, on-ladder values, status tokens as fills only ([charts](charts.md)).
- **Fixture honesty.** The extreme reads true, a zero shows a cue, binned bars carry a unit caption, every skeleton holds the loaded height, an empty state names the next step once ([concept](concept.md), [states](states.md)).
- **Label collisions and light-mode contrast.** Direct labels clear each other and the marks; every text and mark reads in both schemes.
- **At 390.** The answer and the first rows sit above the fold; a header that pushes rows below it is the defect ([concept](concept.md)).
- **Anatomy.** Cards in one row align their heights; a subtitle carries a fact ([cards](cards.md)).
- **Word economy.** Marks and numbers carry the change; a sentence appears only where no mark can say it, and no fact is stated twice across headline, sub line, annotation and caption. Read each line aloud against the mark beside it ([copy](copy.md)).
- **One view.** The parts read as one working surface at 1800 and at 390: the footprint fits the question, a long list scrolls in its own region beside its chart, nothing is large for its own sake ([concept](concept.md)).
- **Linked parts.** Point at an item in the chart, then in the list, then step with the arrow keys: the other part focuses it every time, both ways ([charts](charts.md)).
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
