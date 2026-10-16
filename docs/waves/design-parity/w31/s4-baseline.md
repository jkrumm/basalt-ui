# Wave 31 — S4 baseline

Command (after `bun run build` in `packages/basalt-ui` and `bun run --cwd apps/playground build`):

```
bun packages/basalt-ui/bin/basalt-ui.mjs shot /scenarios/s4-spend --dist apps/playground/dist --out .design-parity/w31/s4-baseline
```

Scored blind by the calibrated reviewer (see calibration.md, method caveat); the metrics file is the baseline later waves diff against. Metrics: `s4-metrics.json`.

## Reviewer output (verbatim)

Iteration-4 reviewer, `shot` with contact sheets. It read each component's sheet and the four page shots.

| component                | verdict | failed items                                                               |
| ------------------------ | ------- | -------------------------------------------------------------------------- |
| month-to-date            | fail    | Craft 1, Craft 2, Craft 4, Craft 5, Craft 7, Expression 3, Communication 6 |
| forecast                 | fail    | Craft 4, Craft 6, Expression 3, Expression 4, Communication 6              |
| budget                   | fail    | Craft 6, Communication 6                                                   |
| spend-over-time          | fail    | Craft 1, Craft 5, Craft 7                                                  |
| spend-by-project         | fail    | Craft 1, Craft 5, Craft 7                                                  |
| top-drivers              | fail    | Craft 3                                                                    |
| spend-distribution       | fail    | Craft 1, Craft 5, Craft 7                                                  |
| page /scenarios/s4-spend | pass    | —                                                                          |

Read: scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png, the four _page shots (light/dark × desktop/mobile)
Read: scenarios-s4-spend-ac51be__forecast-018c49__sheet.png, the four _page shots
Read: scenarios-s4-spend-ac51be__budget-81e4a5__sheet.png, the four _page shots
Read: scenarios-s4-spend-ac51be__spend-over-time-a9e8c1__sheet.png, the four _page shots
Read: scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__sheet.png, the four _page shots
Read: scenarios-s4-spend-ac51be__top-drivers-a0d83b__sheet.png, the four _page shots
Read: scenarios-s4-spend-ac51be__spend-distribution-30a4cc__sheet.png, the four _page shots

Craft 1 — metrics.json month-to-date — the card has radius 7 and its nested delta badge has radius 6, a step of 1 px where at least 3 px is required.
Craft 2 — metrics.json month-to-date — `fontSizes` has four distinct values (10, 12.5, 13.5, 24) at desktop and four (10, 12.5, 13.5, 16) at mobile.
Craft 4 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop and mobile, rest) — the delta is a solid red-tinted filled badge.
Craft 5 — metrics.json month-to-date — `contrast.failures` is non-empty: 4.43 in light, with a minimum of 3.59 in dark, on the "0.1%", "▲" and "vs 1–16 Sept" text.
Craft 7 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop, tooltip) — the tooltip shot has status error: no visible [role="tooltip"] after hover.
Expression 3 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop, rest) — the delta is a coloured fill badge, not neutral text with a trend glyph.
Communication 6 — scenarios-s4-spend-ac51be__month-to-date-2296d1__sheet.png (light and dark, desktop, empty) — the empty state is a bare "—" with no reason and no action.
Craft 4 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop, rest) — a red accent stripe on the card edge is chrome colour.
Expression 3 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop, rest) — a single metric carries a hue, and the surface states no status that explains it.
Expression 4 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop, rest) — the forecast €2,652 shows no budget target and no history.
Craft 6 — scenarios-s4-spend-ac51be___page-8b9a99__light__mobile__rest.png (light, mobile, rest) — the title truncates to "Forecast, end of Octob…" and the info icon wraps to its own line. The dark mobile page shot shows the same.
Craft 6 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop and mobile, focus) — the focus tooltip text is clipped ("Average per day so far (€86) he…", "weeken…").
Communication 6 — scenarios-s4-spend-ac51be__forecast-018c49__sheet.png (light and dark, desktop and mobile, empty) — the empty state is a bare "—" with no reason or action.
Craft 6 — scenarios-s4-spend-ac51be__budget-81e4a5__sheet.png (light and dark, desktop and mobile, focus) — the focus tooltip text is clipped ("€48 a day ke…").
Communication 6 — scenarios-s4-spend-ac51be__budget-81e4a5__sheet.png (light and dark, desktop and mobile, empty) — the empty state is a bare "—" with no reason or action.
Craft 1 — metrics.json spend-over-time — the card has radius 7 and its nested toggle button has radius 6, a step of 1 px.
Craft 5 — metrics.json spend-over-time — `contrast.failures` is non-empty in light: 4.06 on the axis ticks ("01.08", "€0" to "€120").
Craft 7 — scenarios-s4-spend-ac51be__spend-over-time-a9e8c1__sheet.png (light and dark, desktop, tooltip) — the tooltip shot has status error: no visible [role="tooltip"] after hover.
Craft 1 — metrics.json spend-by-project — the card has radius 7 and its nested legend buttons have radius 6, a step of 1 px.
Craft 5 — metrics.json spend-by-project — `contrast.failures` is non-empty in light: 4.06 on the legend values and "Month to date".
Craft 5 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__sheet.png (light, desktop and mobile, rest) — "Search" and "Evals" are the same blue, so those two slices are told apart only by position.
Craft 7 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__sheet.png (light and dark, desktop, tooltip) — the tooltip shot has status error: no visible [role="tooltip"] after hover.
Craft 3 — scenarios-s4-spend-ac51be__top-drivers-a0d83b__sheet.png (light and dark, mobile, rest) — the "Support bot" row wraps to two lines at 390, and the column headers wrap too.
Craft 1 — metrics.json spend-distribution — the card has radius 7 and its nested legend element has radius 6, a step of 1 px.
Craft 5 — metrics.json spend-distribution — `contrast.failures` is non-empty in light: 4.06 on the axis ticks (€30 to €120, 0 to 25).
Craft 7 — scenarios-s4-spend-ac51be__spend-distribution-30a4cc__sheet.png (light and dark, desktop, tooltip) — the tooltip shot has status error: no visible [role="tooltip"] after hover.

Notes: with sheets, run-to-run variance is much smaller than iteration 3 (the empty states and nested radii are cited again). Two of the "failures" are `shot` artefacts, not UI defects: the Craft 6 focus-tooltip clips on forecast and budget (the focus crop's box cuts the tooltip off) and the Craft 7 tooltip `error`s (the info glyph is not a `data-shot-tooltip` target). Metrics: `s4-metrics.json`; the exact command is above.

## Lead summary (SPEC § 1: flexibility gap = no component/token can express the right thing; guidance gap = the parts exist, nothing steers to them)

Flexibility gaps:

- Nested radius 7/6 (card/badge, card/button): no token gives a ≥ 3 px step. SPEC § 5 radius row.
- Delta: `DeltaBadge` only ships as a filled, coloured pill (Craft 4, Expression 3, and its contrast 4.43/3.59). A neutral-text-plus-glyph delta does not exist.
- Chart axis/label ink: 4.06:1 on `faint` text at 10–11 px in light (Craft 5 on four charts). A token fix, not per-page.
- Same-hue neighbours: the categorical ramp gives Search and Evals near-identical blues in light.
- `StatCard` has no target/budget slot (forecast, Expression 4) and its empty state is a bare "—" with no reason or action (Communication 6 on three cards).
- `shot` focus crop: its clip ends at the anchor plus a margin, so a focus tooltip is cut off (Craft 6 on forecast, budget and the banned-subtitle seed); the crop should union the visible tooltip.
- `shot` tooltip: the info glyph of `StatCard`/`ChartCard` is not a `data-shot-tooltip` target, so tooltip shots on S4's anchors record `error` (Craft 7); the page cannot declare it from outside the component.

Guidance gaps:

- Status told by a coloured edge only (forecast): the status chip recipe (§ 6.10) exists; nothing steers the scenario to it.
- Top-drivers table wraps at 390 and forecast title truncates: the compact-table and title rules (§ 6.6, § 7) exist but nothing applies them.
- Four font sizes on month-to-date (10, 12.5, 13.5, 24): the type scale has the roles; the page composes ad hoc.

Operational notes: with this PR `shot` creates the parent of `--out` and records a focus state with no focusable descendant as `not-declared`; it still exits 1 on any real `error` shot, by design. `scale` now carries basalt's own `--vx-space/text/radius-*` steps, so the earlier off-scale gap findings (8/12/6) are gone, not fixed in the UI.
