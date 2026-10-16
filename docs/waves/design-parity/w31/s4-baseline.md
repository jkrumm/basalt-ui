# Wave 31 — S4 baseline

Command (after `bun run build` in `packages/basalt-ui` and `bun run --cwd apps/playground build`):

```
bun packages/basalt-ui/bin/basalt-ui.mjs shot /scenarios/s4-spend --dist apps/playground/dist --out .design-parity/w31/s4-baseline
```

Scored blind by the calibrated reviewer (see calibration.md, method caveat); the metrics file is the baseline later waves diff against. Metrics: `s4-metrics.json`.

## Reviewer output (verbatim)

Iteration-4b reviewer, `shot` with contact sheets and tooltip-aware hover/focus crops. It read each component's sheet and the four page shots.

| component                | verdict | failed items                                                                        |
| ------------------------ | ------- | ----------------------------------------------------------------------------------- |
| month-to-date            | fail    | Craft 1, Craft 2, Craft 4, Craft 5, Craft 6, Craft 7, Expression 3, Communication 6 |
| forecast                 | fail    | Craft 6, Expression 4, Communication 6                                              |
| budget                   | fail    | Craft 6, Communication 6                                                            |
| spend-over-time          | fail    | Craft 5, Craft 6, Craft 7                                                           |
| spend-by-project         | fail    | Craft 5, Craft 6, Craft 7                                                           |
| top-drivers              | fail    | Craft 3                                                                             |
| spend-distribution       | fail    | Craft 5, Craft 6, Craft 7                                                           |
| page /scenarios/s4-spend | pass    | —                                                                                   |

Read: month-to-date: png/scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png, all four `_page` shots
Read: forecast: png/scenarios-s4-spend-ac51be__forecast-018c49__sheet.png, all four `_page` shots
Read: budget: png/scenarios-s4-spend-ac51be__budget-81e4a5__sheet.png, all four `_page` shots
Read: spend-over-time: png/scenarios-s4-spend-ac51be__spend-over-time-a9e8c1__sheet.png, all four `_page` shots
Read: spend-by-project: png/scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__sheet.png, all four `_page` shots
Read: top-drivers: png/scenarios-s4-spend-ac51be__top-drivers-a0d83b__sheet.png, all four `_page` shots
Read: spend-distribution: png/scenarios-s4-spend-ac51be__spend-distribution-30a4cc__sheet.png, all four `_page` shots
Read: page: scenarios-s4-spend-ac51be___page-8b9a99__{light,dark}__{desktop,mobile}__rest.png

Craft 1 — metrics.json month-to-date (all schemes, viewports) — the delta badge has radius 6 inside the radius-7 card, a step of 1 px, below the required 3 px.
Craft 2 — metrics.json month-to-date (all schemes, viewports) — `fontSizes` has 4 distinct values (10, 12.5, 13.5, 24 desktop; 10, 12.5, 13.5, 16 mobile).
Craft 4 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop and mobile, rest) — the delta is a red tinted-fill badge, not neutral text with a trend glyph.
Craft 5 — metrics.json month-to-date (light, both viewports) — contrast failures: "0.1%", "▲" and "vs 1–16 Sept" are 4.43:1.
Craft 5 — metrics.json month-to-date (dark, both viewports) — the same three texts are 3.59:1.
Craft 5 — metrics.json spend-over-time (light, desktop and mobile) — axis labels are 4.06:1 (`01.08`, `€0`…`€120`).
Craft 5 — metrics.json spend-by-project (light, desktop and mobile) — the "Month to date" label and the "€356 · 26%" … "€62 · 4%" legend values are 4.06:1.
Craft 5 — metrics.json spend-distribution (light, desktop and mobile) — axis labels `€30`…`€120` and `0`…`25` are 4.06:1.
Craft 5 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__sheet.png (light and dark, desktop and mobile, rest) — Search and Evals are two near-identical blues, so they are told apart only by position.
Craft 3 — scenarios-s4-spend-ac51be__top-drivers-a0d83b__light__mobile__rest.png (light and dark, mobile, rest) — the dense-list row "Support bot" wraps to two lines, and the column headers wrap.
Craft 6 — scenarios-s4-spend-ac51be__forecast-018c49__light__mobile__rest.png (light and dark, mobile, rest) — the title truncates to "Forecast, end of Octob…" and the info icon drops onto its own line.
Craft 6 — scenarios-s4-spend-ac51be__forecast-018c49__light__desktop__focus.png (light and dark, desktop and mobile, focus) — the info-tooltip text is cut mid-sentence ("Ignores weeken", "Average per day so far (€8").
Craft 6 — scenarios-s4-spend-ac51be__budget-81e4a5__light__desktop__focus.png (light and dark, desktop and mobile, focus) — the tooltip text is cut ("€48 a day ke", "€48 a").
Craft 6 — scenarios-s4-spend-ac51be__month-to-date-2296d1__light__desktop__focus.png (light and dark, desktop and mobile, focus) — the tooltip is clipped ("All 20" on mobile) and covers the delta badge text.
Craft 6 — scenarios-s4-spend-ac51be__spend-over-time-a9e8c1__light__mobile__focus.png (light and dark, mobile, focus) — the tooltip text is cut ("Stacked daily spe…").
Craft 6 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__light__mobile__focus.png (light and dark, mobile, focus) — the tooltip text is cut ("Each project's share of mont").
Craft 6 — scenarios-s4-spend-ac51be__spend-distribution-30a4cc__light__mobile__focus.png (light and dark, mobile, focus) — the tooltip text is cut ("How many of the last 9…").
Craft 7 — metrics.json shots month-to-date (light and dark, desktop, tooltip) — status `error`, "no visible [role=tooltip] after hover", although the sparkline is a hover target.
Craft 7 — metrics.json shots spend-over-time (light and dark, desktop, tooltip) — status `error`, no tooltip crop. The hover crop does show a tooltip, so the tooltip crop is missing.
Craft 7 — metrics.json shots spend-by-project (light and dark, desktop, tooltip) — status `error`, no tooltip crop.
Craft 7 — metrics.json shots spend-distribution (light and dark, desktop, tooltip) — status `error`, no tooltip crop. The hover crop does show a tooltip.
Expression 3 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop and mobile, rest) — the delta carries a solid red fill, where a single-metric delta must be neutral text with a trend glyph.
Expression 4 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop and mobile, rest) — the €2,652 forecast shows neither the €1,500 target nor any history.
Communication 6 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop and mobile, empty) — the value is a bare "—" with no reason or action, and the sparkline still draws.
Communication 6 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop and mobile, empty) — a bare "—" with no reason or action.
Communication 6 — scenarios-s4-spend-ac51be__budget-81e4a5__sheet.png (light and dark, desktop and mobile, empty) — a bare "—" with no reason or action.

Notes: the focus-tooltip Craft 6 findings are real, not crop artefacts: after the crops were made tooltip-aware the images are unchanged, because the `info` bubble (an in-card `role="tooltip"` span) overflows its own box on a narrow card. The Craft 7 tooltip `error`s are a `data-shot-tooltip` mismatch: the page's declared target opens no `role="tooltip"` while the chart tooltip shows in the hover crop. Metrics: `s4-metrics.json`.

## Lead summary (SPEC § 1: flexibility gap = no component/token can express the right thing; guidance gap = the parts exist, nothing steers to them)

Flexibility gaps:

- Nested radius 7/6 (card/badge, card/button): no token gives a ≥ 3 px step. SPEC § 5 radius row.
- Delta: `DeltaBadge` only ships as a filled, coloured pill (Craft 4, Expression 3, and its contrast 4.43/3.59). A neutral-text-plus-glyph delta does not exist.
- Chart axis/label ink: 4.06:1 on `faint` text at 10–11 px in light (Craft 5 on four charts). A token fix, not per-page.
- Same-hue neighbours: the categorical ramp gives Search and Evals near-identical blues in light.
- `StatCard` has no target/budget slot (forecast, Expression 4) and its empty state is a bare "—" with no reason or action (Communication 6 on three cards).
- Info bubble: `WidgetHeader`'s info glyph bubble overflows its own box on a narrow card, so its text is cut at 390 on forecast, budget, month-to-date and the three charts (Craft 6). A basalt component fix, not a shot gap.
- Tooltip target: the info glyph of `StatCard`/`ChartCard` is not a `data-shot-tooltip` target and the page's declared target opens no `role="tooltip"`, so tooltip shots on S4's anchors record `error` (Craft 7); the page cannot declare the glyph from outside the component.

Guidance gaps:

- Status told by a coloured edge only (forecast): the status chip recipe (§ 6.10) exists; nothing steers the scenario to it.
- Top-drivers table wraps at 390 and forecast title truncates: the compact-table and title rules (§ 6.6, § 7) exist but nothing applies them.
- Four font sizes on month-to-date (10, 12.5, 13.5, 24): the type scale has the roles; the page composes ad hoc.

Operational notes: with this PR `shot` creates the parent of `--out` and records a focus state with no focusable descendant as `not-declared`; it still exits 1 on any real `error` shot, by design. `scale` now carries basalt's own `--vx-space/text/radius-*` steps, so the earlier off-scale gap findings (8/12/6) are gone, not fixed in the UI.
