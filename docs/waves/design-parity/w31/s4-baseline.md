# Wave 31 — S4 baseline

Command (after `bun run build` in `packages/basalt-ui` and `bun run --cwd apps/playground build`):

```
bun packages/basalt-ui/bin/basalt-ui.mjs shot /scenarios/s4-spend --dist apps/playground/dist --out .design-parity/w31/s4-baseline
```

Scored blind by the calibrated reviewer (see calibration.md, method caveat). Metrics: `s4-metrics.json`.

## Reviewer output (verbatim)

| component                | verdict | failed items                                     |
| ------------------------ | ------- | ------------------------------------------------ |
| month-to-date            | fail    | Craft 2, Craft 4, Craft 5, Craft 7, Expression 3 |
| forecast                 | fail    | Craft 6, Expression 4                            |
| budget                   | pass    | —                                                |
| spend-over-time          | fail    | Craft 5, Craft 7                                 |
| spend-by-project         | fail    | Craft 5, Craft 6, Craft 7                        |
| top-drivers              | fail    | Craft 3                                          |
| spend-distribution       | fail    | Craft 5, Craft 7                                 |
| page /scenarios/s4-spend | pass    | —                                                |

Craft 2 — metrics.json month-to-date (light and dark, desktop and mobile) — `fontSizes` has 4 distinct values (10, 12.5, 13.5, 24 desktop; 10, 12.5, 13.5, 16 mobile).
Craft 4 — scenarios-s4-spend-ac51be__month-to-date-2296d1__dark__desktop__rest.png (dark, desktop, rest) — The delta is a solid red-tinted filled badge (also in the light crop), not neutral text with a trend glyph.
Expression 3 — scenarios-s4-spend-ac51be__month-to-date-2296d1__dark__desktop__rest.png (dark, desktop, rest) — A coloured fill on the delta badge, including the "vs 1–16 Sept" text inside it.
Craft 5 — metrics.json month-to-date — `contrast.failures` is non-empty: "0.1%", "▲" and "vs 1–16 Sept" measure 4.43:1 in light and 3.59:1 in dark, desktop and mobile.
Craft 7 — metrics.json month-to-date shots (tooltip, light and dark, desktop) — status `error`, "no visible [role="tooltip"] after hover"; no tooltip crop exists (`file` is null).
Craft 6 — scenarios-s4-spend-ac51be__forecast-018c49__light__mobile__rest.png (light, mobile, rest) — The title is truncated to "Forecast, end of Octob…". The dark mobile crop and the page crop show the same.
Expression 4 — scenarios-s4-spend-ac51be__forecast-018c49__light__desktop__rest.png (light, desktop, rest) — €2,652 is shown with no budget target or comparison, even though the budget is €1,500. The card carries a red left bar with no stated meaning.
Craft 5 — metrics.json spend-over-time (light, desktop and mobile) — Axis labels (dates and € ticks) measure 4.06:1 and are listed in `contrast.failures`.
Craft 7 — metrics.json spend-over-time shots (tooltip, light and dark, desktop) — status `error`, "no visible [role="tooltip"] after hover"; no crop.
Craft 5 — metrics.json spend-by-project (light, desktop and mobile) — The legend values ("€356 · 26%" and the rest) and "Month to date" measure 4.06:1 and are listed in `contrast.failures`.
Craft 5 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__light__desktop__rest.png (light, desktop, rest) — "Search" and "Evals" use the same blue, so the two slices are told apart only by position.
Craft 6 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__light__desktop__focus.png (light, desktop, focus) — The focused info icon overlaps the title, which reads "Spend by project, 1–16 Oct (€".
Craft 7 — metrics.json spend-by-project shots (tooltip, light and dark, desktop) — status `error`, "no visible [role="tooltip"] after hover"; no crop.
Craft 3 — scenarios-s4-spend-ac51be__top-drivers-a0d83b__dark__mobile__rest.png (dark, mobile, rest) — The "Support bot" row wraps to two lines at 390, as do the column headers. The light mobile crop shows the same.
Craft 5 — metrics.json spend-distribution (light, desktop and mobile) — The x-axis (€30 to €120) and y-axis (0 to 25) tick labels measure 4.06:1 and are listed in `contrast.failures`.
Craft 7 — metrics.json spend-distribution shots (tooltip, light and dark, desktop) — status `error`, "no visible [role="tooltip"] after hover"; no crop.

Reviewer's note: it viewed 16 of 156 PNGs (page crops, rest crops of every component, a few empty/error/focus crops); dark crops for budget, spend-over-time, spend-distribution and top-drivers were covered through `metrics.json` only.

Run-to-run variance (a baseline caveat): the previous run of the same board, under the iteration-2 reviewer text, additionally cited Craft 1 (delta radius 6 inside card 7, off-scale delta padding), Communication 6 (the empty state of month-to-date, forecast and budget is a bare "—" with no reason or action), Craft 4 (top-drivers wrap), Craft 5 (forecast's red edge as the only status signal) and Craft 7 on top-drivers (focus `error`). The shot fix below removed the focus error; the rest were not re-cited this run because the reviewer did not open the empty-state crops. Treat the union as the baseline.

## Lead summary (SPEC § 1: flexibility gap = no component/token can express the right thing; guidance gap = the parts exist, nothing steers to them)

Flexibility gaps:

- Nested radius 7/6 (card/badge, card/button): no token gives a ≥ 3 px step. SPEC § 5 radius row.
- Delta: `DeltaBadge` only ships as a filled, coloured pill (Craft 4, Expression 3, and its contrast 4.43/3.59). A neutral-text-plus-glyph delta does not exist.
- Chart axis/label ink: 4.06:1 on `faint` text at 10–11 px in light (Craft 5 on four charts). A token fix, not per-page.
- Same-hue neighbours: the categorical ramp gives Search and Evals near-identical blues in light.
- `StatCard` has no target/budget slot (forecast, Expression 4) and its empty state is a bare "—" with no reason or action (Communication 6 on three cards).
- `shot` tooltip: the info glyph of `StatCard`/`ChartCard` is not a `data-shot-tooltip` target, so tooltip shots on S4's anchors record `error` (Craft 7); the page cannot declare it from outside the component.

Guidance gaps:

- Status told by a coloured edge only (forecast): the status chip recipe (§ 6.10) exists; nothing steers the scenario to it.
- Top-drivers table wraps at 390 and forecast title truncates: the compact-table and title rules (§ 6.6, § 7) exist but nothing applies them.
- Four font sizes on month-to-date (10, 12.5, 13.5, 24): the type scale has the roles; the page composes ad hoc.

Operational notes: with this PR `shot` creates the parent of `--out` and records a focus state with no focusable descendant as `not-declared`; it still exits 1 on any real `error` shot, by design. `scale` now carries basalt's own `--vx-space/text/radius-*` steps, so the earlier off-scale gap findings (8/12/6) are gone, not fixed in the UI.
