# Wave 31 — S4 baseline

Command (after `bun run build` in `packages/basalt-ui` and `bun run --cwd apps/playground build`; the out dir's parent must exist, see note):

```
mkdir -p .design-parity/w31
bun packages/basalt-ui/bin/basalt-ui.mjs shot /scenarios/s4-spend --dist apps/playground/dist --out .design-parity/w31/s4-baseline
```

Scored blind by the calibrated reviewer (see calibration.md, method caveat). Metrics: `s4-metrics.json`.

## Reviewer output (verbatim)

| component                | verdict | failed items                                                               |
| ------------------------ | ------- | -------------------------------------------------------------------------- |
| month-to-date            | fail    | Craft 1, Craft 2, Craft 4, Craft 5, Craft 7, Expression 3, Communication 6 |
| forecast                 | fail    | Craft 5, Craft 6, Expression 4, Communication 6                            |
| budget                   | fail    | Communication 6                                                            |
| spend-over-time          | fail    | Craft 5, Craft 7                                                           |
| spend-by-project         | fail    | Craft 5, Craft 7                                                           |
| top-drivers              | fail    | Craft 3, Craft 7                                                           |
| spend-distribution       | fail    | Craft 5, Craft 7                                                           |
| page /scenarios/s4-spend | pass    | —                                                                          |

Craft 1 — metrics.json month-to-date (light and dark, desktop and mobile) — the delta badge has 7 px horizontal padding, which is not on the layout grid or in `scale`. Its 6 px radius sits inside the 7 px card, a step of 1 px against the required 3 px.
Craft 2 — metrics.json month-to-date (light and dark, desktop and mobile) — `fontSizes` has 4 distinct values (10, 12.5, 13.5, 24 on desktop; 16 replaces 24 on mobile).
Craft 4 — scenarios-s4-spend-ac51be__month-to-date-2296d1__light__desktop__rest.png (light, desktop, rest) — the delta renders as a red-tinted filled pill (same in dark and on mobile).
Expression 3 — scenarios-s4-spend-ac51be__month-to-date-2296d1__light__mobile__rest.png (light, mobile, rest) — a coloured fill and coloured text sit on the delta, which must be neutral text with a trend glyph. The pill also covers the "vs 1–16 Sept" comparison text.
Craft 5 — metrics.json month-to-date (light and dark) — `contrast.failures` is non-empty: "0.1%", "▲" and "vs 1–16 Sept" measure 4.43 in light and 3.59 in dark.
Craft 7 — metrics.json month-to-date (light and dark, desktop, tooltip) — the tooltip shot has status `error` ("no visible [role=tooltip] after hover"), so no tooltip crop exists for an anchor that has an info icon.
Communication 6 — scenarios-s4-spend-ac51be__month-to-date-2296d1__light__desktop__empty.png (light, desktop, empty) — the empty state is a bare em dash beside a sparkline. It does not say why the value is missing or what to do.
Craft 5 — scenarios-s4-spend-ac51be__forecast-018c49__light__desktop__rest.png (light, desktop, rest) — a red left-edge bar is the only signal of status on the Forecast card, with no text or glyph backing it.
Craft 6 — scenarios-s4-spend-ac51be__forecast-018c49__light__mobile__rest.png (light, mobile, rest) — the title truncates to "Forecast, end of Octob…", and the info icon drops to its own line.
Expression 4 — scenarios-s4-spend-ac51be__forecast-018c49__light__desktop__rest.png (light, desktop, rest) — €2,652 carries no target or budget reference on its own card, although the red edge implies an overrun.
Communication 6 — scenarios-s4-spend-ac51be__forecast-018c49__light__desktop__empty.png (light, desktop, empty) — a bare "—" with no reason or action.
Communication 6 — scenarios-s4-spend-ac51be__budget-81e4a5__light__desktop__empty.png (light, desktop, empty) — a bare "—" with no reason or action.
Craft 5 — metrics.json spend-over-time (light, desktop and mobile) — axis labels ("01.08", "€0" through "€120") measure 4.06 (#7b7b7e on #fafafd).
Craft 7 — metrics.json spend-over-time (light and dark, desktop, tooltip) — the tooltip shot has status `error`, with no tooltip crop.
Craft 5 — metrics.json spend-by-project (light, desktop and mobile) — the "Month to date" label and the legend values ("€356 · 26%" and the rest) measure 4.06.
Craft 5 — scenarios-s4-spend-ac51be__spend-by-project-ad9f7d__light__desktop__rest.png (light, desktop, rest) — Search and Evals use the same blue, so the two slices and their legend swatches are told apart by position only. This does not occur in dark.
Craft 7 — metrics.json spend-by-project (light and dark, desktop, tooltip) — the tooltip shot has status `error`, with no tooltip crop.
Craft 3 — scenarios-s4-spend-ac51be__top-drivers-a0d83b__light__mobile__rest.png (light, mobile, rest) — the "Support bot" row wraps to two lines, and the column headers wrap to two lines.
Craft 7 — metrics.json top-drivers (light and dark, desktop and mobile, focus) — the focus shot has status `error` (":focus-visible never reached the anchor in 80 Tab presses"), so no focus crop exists.
Craft 5 — metrics.json spend-distribution (light, desktop and mobile) — the axis ticks ("€30" through "€120" and "0" through "25") measure 4.06.
Craft 7 — metrics.json spend-distribution (light and dark, desktop, tooltip) — the tooltip shot has status `error`, with no tooltip crop.

## Lead summary (SPEC § 1: flexibility gap = no component/token can express the right thing; guidance gap = the parts exist, nothing steers to them)

Flexibility gaps:

- Nested radius 7/6 (card/badge, card/button): no token gives a ≥ 3 px step. SPEC § 5 radius row.
- Delta: `DeltaBadge` only ships as a filled, coloured pill (Craft 4, Expression 3, and its contrast 4.43/3.59). A neutral-text-plus-glyph delta does not exist.
- Chart axis/label ink: 4.06:1 on `faint` text at 10–11 px in light (Craft 5 on four charts). A token fix, not per-page.
- Same-hue neighbours: the categorical ramp gives Search and Evals near-identical blues in light.
- `StatCard` has no target/budget slot (forecast, Expression 4) and its empty state is a bare "—" with no reason or action (Communication 6 on three cards).
- `shot` itself: a tooltip on the info glyph and focus on a non-interactive table cannot be captured with the shipped anchors (7 Craft 7 findings are shot-state errors, not UI defects), and metrics `scale` omits the 8/12/6 gaps components emit.

Guidance gaps:

- Status told by a coloured edge only (forecast): the status chip recipe (§ 6.10) exists; nothing steers the scenario to it.
- Top-drivers table wraps at 390 and forecast title truncates: the compact-table and title rules (§ 6.6, § 7) exist but nothing applies them.
- Four font sizes on month-to-date (10, 12.5, 13.5, 24): the type scale has the roles; the page composes ad hoc.

Operational notes: `shot` does not create the parent of `--out` (rename ENOENT; `mkdir -p` first) and exits 1 whenever any state shot errors, even when all rest crops are written.
