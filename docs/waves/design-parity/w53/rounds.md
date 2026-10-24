# Wave 53 — re-audit of the touched routes

Validator: the playground built from `master` at `b94c96e2` (#555, #556 merged). Setup:
`docs/waves/design-parity/w37/setup.md`, unchanged, on the routes Wave 53 touched only (S1 and S3 and S5 carry an
`EventList`, S6 the `DangerZone`): `basalt-ui shot /scenarios/s1-ops /scenarios/s3-agents /scenarios/s5-learning
/scenarios/s6-settings --dist apps/playground/dist --out .design-parity/w53/r1`, 655 shots, 0 failed, `shot detect`
100 (0 findings). Two fresh `basalt-design-reviewer` subagents on Sonnet (S1+S3, S5+S6), one round. Boards stay in the
gitignored `.design-parity/w53/`.

**Coverage:** S1+S3 opened 19 of 19 contact sheets, the 8 page shots and 7 Keel captures; S5+S6 opened 12 of 12 sheets,
the 8 page shots and, sent back once, 40 of 40 Keel route captures plus 8 patterns.

| Route       | W52 r1          | W53 r1           | basalt (P2/P3) | playground (P2/P3) | Keel  |
| ----------- | --------------- | ---------------- | -------------- | ------------------ | ----- |
| S1 ops      | 93 (P3 7)       | 93 (P3 7)        | 0 / 5          | 0 / 2              | close |
| S3 agents   | 88 (P2 1, P3 9) | 91 (P3 9)        | 0 / 4          | 0 / 5              | close |
| S5 learning | 89 (P2 1, P3 8) | 87 (P2 1, P3 10) | 0 / 3          | 1 / 7              | close |
| S6 settings | 87 (P2 1, P3 7) | 93 (P3 7)        | 0 / 1          | 0 / 6              | close |

No P1, nothing new. S5's drop is one _unscored_ item (strip empties as bare text, named on S4 in W52), not a
regression. Held out of the tally: S6 light-scheme inputs with no visible edge (owner).

**Fixed (confirmed by the reviewers):** the S3 box cue reads `↑ 39 loaded above` (1440) / `↑ 40 loaded above` (390),
so it no longer competes with "Show earlier (12)"; the S6 danger ring shows in light at 1440 and 390 (and in dark);
no feed sentence is ellipsised on S3 or S5; S3's loading bodies are skeletons in the loaded shape.

## Basalt-owned, still open

The W52 P3 list carries unchanged on these routes: the `+N cols` hint wrapping in its 28 px gutter, table time
tooltips over the next row, the S1 availability hover tooltip over tick and legend, the 390 contract line with no tick
(policy), period caption placement, the Board rails, the S3 failures strip with no count, the S3 feed error body at
loaded height, the S5 splined weekly sparklines, the S5 summary skeleton line count, strip empties as bare text, the S6
group headings barely heavier than labels.

## Playground-owned, still open

S5 "Last practised 16 Oct" against the journal's "Today" (P2, carried) and the W52 P3 list for S1/S3/S5/S6, plus one
new S5 P3 (a sparkline readout in days inside a date-valued card). No playground worker ran in Wave 53 (budget).
