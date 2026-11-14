# Concept

What to settle before the first component. Write it as `docs/design/<screen>.md`, one page per screen; the reviewer reads it as the contract the shots try to fail.

## The three lines

- Who opens this page, the one question it answers, and the decision they take after reading it, in one verb ("reassign", "escalate", "leave").
- The figures that answer the question. The hero figure is the answer itself ("3 past SLA"), where a count of the things on the page answers nothing.
- What this screen reads from `DESIGN.md`: its Identity and its narrowing deviations. The Direction is the owner's to write.

## Datasets

- One row per dataset: source, shape, the form that answers it, the export, and the reason. The form comes from the question-to-form table in the AGENTS block.
- A shape without a shipped form is reported to the user as a gap and left out of the page.
- Open the doc of every export in the table before its props are written: [StatCard](docs/stat-card.md), [ChartCard](docs/chart-card.md), [DataTable](docs/data-table.md), [BarList](docs/bar-list.md), [Section](docs/section.md).

## Layout

- At desktop width, row by row: what pairs, what spans, what sits above the fold. The answer is in the first row.
- At 390: the single-column order, what collapses and what moves behind a disclosure. Keep the column that carries the answer and put the answer above the fold. [type:SizeClass]
- Chrome follows [useSizeClass](docs/use-size-class.md); the page follows its container. [type:SizeClass]

## Fixtures

- Fixture data shows each extreme at rest: a zero delta, an empty bucket, a value over its limit, a long name, a waiting item. A fixture that sits mid-range hides the states the page must survive.
- A fixture gives every state in [states](states.md) a place on the page. Every section's skeleton holds the loaded height, and an empty state names the next step once.

## Copy and pass criteria

- Write the page title, the summary sentence with its live number, the card titles and the empty and error lines now, using [copy](copy.md) and [states](states.md).
- Pass criteria are numbered sentences a reviewer can fail on a crop: "the summary carries a count", "every delta names its period", "the limit is drawn". "Looks clean" fails nothing.
- When restyling, record what the current page gets wrong, then append each round's verdict to the doc.

not guarded:

- "Monitor" and "stay informed" are not decisions, and "default" is not a reason for a form.
- Write no component code before the three lines exist.
- A page that cannot name its question is a list of boxes; stop and ask the user.
