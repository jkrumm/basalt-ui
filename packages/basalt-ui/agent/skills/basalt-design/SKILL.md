---
name: basalt-design
description: Build or restyle dashboards and metric UIs in a basalt-ui app — scenario, encoding, build, then rounds of screenshots scored by a reviewer subagent.
when_to_use: User is building or restyling dashboards, charts or metric UIs; tuning a palette; or says a UI looks inconsistent, over-colored or "AI default". Entry point for "make this look professional".
---

Method only; the law is `.claude/rules/basalt-*.md` and `./DESIGN.md`.

## Steps

1. Read `./DESIGN.md` and the rules `basalt-tokens.md`, `basalt-mantine.md`, `basalt-controls.md`, `basalt-charts.md`. No `DESIGN.md`: run `/basalt-app` first.
2. **Scenario first.** Write down realistic fixture data, the user's question, and the decision the view supports. Decide which metrics earn a hue (trend, status, separation; the rest neutral), the one primary action per view, each control's home (a `SettingsRow` preference via `createLocalStore`, never `useState`).
3. **Pick each encoding from the data's shape**, then the shipped composite (`StatCard`, `ChartCard`, `Section`, `WidgetHeader`, `BasaltDataTable`, `EmptyState`; a gap is reported, not routed around):

   | Data shape                    | Encoding    | Component         |
   | ----------------------------- | ----------- | ----------------- |
   | One headline number + trend   | stat        | `StatCard`        |
   | Value over time               | line / area | `CartesianChart`  |
   | Compare categories            | bars        | `CartesianChart`  |
   | Part of whole, few parts      | stacked bar | `CartesianChart`  |
   | Many rows, several attributes | table       | `BasaltDataTable` |
   | Nothing yet / failed          | empty state | `EmptyState`      |

4. Build with Mantine primitives and the composites; every color from `VX.*` or a series token. Tune by eye in the theme lab (`dev.theme` Spotlight command, dev only) in both schemes, then bake values into the `derive` knobs of `createBasaltTheme` and series colors into `src/lib/series.ts`.
5. **Mark up for the board.** Tag each scored component `data-shot="<name>"`; hover and tooltip targets inside it get `data-shot-hover` / `data-shot-tooltip`. Declare supported states with `data-shot-states="empty loading error"` and render them when the `shot-state` URL param asks.
6. **Rounds, at least three.** Playwright is the app's dev dependency: `bun add -d playwright && bunx playwright install chromium`. Then:
   - `basalt-ui shot <routes> --dist <built app>` (or `--base <url>` for a running server);
   - hand the out dir (`.basalt/shots`) to the `basalt-design-reviewer` subagent by name;
   - revise every failing item at its source, rebuild, and shoot again.
     Boards stay local (gitignored); the scored verdict and notes are worth committing.
7. **Done** only when the reviewer passes every component. After five failed rounds stop and show the owner the boards and the failing items.
8. Run the repo's own gate (e.g. `make check`); fix every finding at its source.
