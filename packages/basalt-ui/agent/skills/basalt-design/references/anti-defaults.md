# Anti-defaults

Taste checks for a page that reads as a default. Read before the first build and at every look. Where a rule guards a tell, its tag is named; the rest are judgement, not law, and a reviewer scores them.

## Five defects earlier builds shipped with

- **Clipped at 390.** A wide table with no scroll region, a fixed height on a card, text in a clipped box. [lint:raw-scroll]
- **Nameless controls.** An icon-only button or an input with no accessible name. [lint:primitive-bypass]
- **Restated figures.** One number in the summary line, a card and a table cell: each figure appears once per page.
- **A generic title.** "Overview" or "Dashboard" alone: name the subject and its scope. [type:PageBarProps]
- **Colour on its own.** A status carried by hue only: a word plus its tone, and polarity is data on the delta. [lint:status-fill-as-text]

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
