---
name: basalt-design
description: Build or restyle a page in a basalt-ui app: name the question, pick the form, compose the shipped parts, then look at the page at desktop and phone width before calling it done.
when_to_use: The user asks for a dashboard, list, detail or settings page, or says a UI looks inconsistent or generic.
---

Method only. The law is `.claude/rules/basalt-*.md` and `./DESIGN.md`; props live in the generated docs (`node_modules/basalt-ui/docs/<name>.md`) and the shipped `.d.ts`. This file restates neither.

## Steps

1. **Question first.** Before code, write three lines: who opens this page, the one question it answers, the figures that answer it. A page that cannot name its question is a list of boxes. State the answer at rest as one hero figure that is the answer, not a count of things.
2. **Form second.** Pick each form from the data's shape with the question-to-form table in the AGENTS block. A figure that fits no shipped form is reported to the user, never faked with a hand-built box. Open the doc of every part you use before you write its props: [stat-card](docs/stat-card.md), [stat-group](docs/stat-group.md), [chart-card](docs/chart-card.md), [cartesian-chart](docs/cartesian-chart.md), [bar-list](docs/bar-list.md), [data-table](docs/data-table.md), [section](docs/section.md).
3. **Marks third.** Compose with the parts and theme tokens; the rules guard the colour, spacing and import limits. Delta badges are tinted and carry their polarity and period. Captions are sentence-case sans. Neutral by default; the single accent is spent where a decision turns on it. The primary action is ink-inverted, one per view.
4. **States.** Every part that loads data takes its phase from the query ([query-state](docs/query-state.md)); empty states say why and what to do ([empty-state](docs/empty-state.md)). Copy states facts: precise nouns with their scope, a live number in the summary line.
5. **Look before you stop.** Build and typecheck, then read the page at 1800 and 390 wide against `references/anti-defaults.md`: every figure from the brief is on the page, nothing is cut, every control has a name. Fix at the source, rebuild, look again. Run the repo gate before reporting done.
