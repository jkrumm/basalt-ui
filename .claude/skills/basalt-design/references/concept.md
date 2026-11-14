# Concept

What to settle before the first component. Write it as `docs/design/<screen>.md`, one page per screen; the reviewer reads it as the contract the shots try to fail.

## The three lines

- Who opens this page, the one question it answers, and the decision they take after reading it, in one verb ("reassign", "escalate", "leave").
- The figures that answer the question. The hero figure is the answer itself ("3 past SLA"), where a count of the things on the page answers nothing.
- What this screen reads from `DESIGN.md`: its Identity and its narrowing deviations. The Direction is the owner's to write.

## Plan the surface

Before any form is picked, write the surface as a few lines: the parts it needs, where each sits, what they share. Good marks on a surface nobody planned still read as a stack of cards.

- Name the parts the question needs: the mark, the figure, and the detail (a list, a table or a timeline of the same items). A part that does nothing for the question is cut.
- Say where each sits. A chart with a detail list sits side by side at a wide container, the list in its own [ScrollArea](docs/scroll-area.md) at the chart's height; at a narrow container the two stack, the chart first. Key it on the container. [lint:viewport-keyed]
- Say what they share. Parts that show the same items share one focus: pointing at or stepping to an item in one focuses it in the other, both ways ([charts](charts.md)). A shared filter or scale is stated once, on the part that owns it.
- Size the footprint to the question: a comparison of two numbers is one small card that hugs its content, and the page leaves the rest empty.
- The parts read as one working surface: a shared edge and a shared gap.

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

- Spend no full-page card on two numbers, and nest no card in a card that holds nothing else.
- "Monitor" and "stay informed" are not decisions, and "default" is not a reason for a form.
- Write no component code before the three lines exist.
- A page that cannot name its question is a list of boxes; stop and ask the user.
