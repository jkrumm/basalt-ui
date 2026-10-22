# Wave 43 — argo upstream rows: rounds on S7 body and S8 map

argo is paused (owner, 2026-10-22), so the validator is the playground: two fixtures built from argo's compositions
(`/scenarios/s7-body` for body-composition and strength, `/scenarios/s8-map` for astro's Map tab) plus a regression
pass on `/scenarios/s2-training`, `/scenarios/s4-spend` and `/components`. Setup: `docs/waves/design-parity/w37/setup.md`,
unchanged (build the package and the playground, `basalt-ui shot … --out .design-parity/w43/r<n>`, then `shot detect`).
Two fresh `basalt-design-reviewer` subagents per round (S7; S8 with the regression routes). Boards stay in the
gitignored `.design-parity/w43/`.

| Route                  | r1 (#478–#486) | r2 (#487–#489) | r3 (#490 #491) |
| ---------------------- | -------------- | -------------- | -------------- |
| S7 body                | 0 (P1 9)       | 59 (P1 0)      | 66 (P1 0)      |
| S8 map                 | 50 (P1 4)      | 95             | 99             |
| S2 training, S4, /comp | 100 (no new)   | —              | —              |
| `shot detect`          | 90 (1 P1)      | 100            | 100            |

There is no r0: the "before" is argo's own record (`argo/docs/design/UPSTREAM.md` § Wave 50–53), and S7/S8 did not
exist before this wave.

## r1 — the eight rows (#479–#486)

Fixed, per the S7 reviewer: the Meter start caption (no clipped descender at 390, one line at 1440), the ChartCard
subtitle at 390, the Sparkline band and the PR label at 390, the neutral danger icon at rest, the strip-cell anchors.
S8: the map catalogue form, the overlay radius step (6 in 10), the attribution control on scale in both schemes, the
page fill at 1440 and 390. Still failing on rows of this wave: `Lines` end labels (Goal over Weight, the mean line
through "7 d mean", P1), the strip's under-cell footer at 15 px (four type sizes, P1, `shot detect`). The rest were
fixture defects in the new scenarios (states without Retry, skeletons in the wrong shape, three wordings per gap,
an unplaced raster, no map title) — playground, fixed in r2.

## r2 — labels, the strip footer, honest fixtures (#487–#489)

S7: no P1. Fixed: Goal vs Weight, the strike-through, four type sizes, every r1 playground P1. Carried, row-owned (P3):
the series peak touching "7 d mean" at 1440, the Weight label under the Goal line at 390, the PR label corner at
1440, the INOL band cut at the plot edge. S8: all ten r1 items fixed; three playground P2/P3 (scrubber end labels
past the panel, a wrapped place label, the key in empty/error).

Ruled, not defects: the bare "Could not load" under a titled card is the house title (W42 ruling).

## r3

Fixed: the "7 d mean" touch at 1440, the Weight label under the Goal line at 390, the PR label corner at 1440 (S7);
the scrubber end labels, the wrapped place label, the key in empty/error (S8). Each gap has one wording, the skinfold
dates are distinct, body fat and lean mass are stated once with a dated delta. The regression routes are pixel-identical
to r1 where labels could have moved.

Still open on this wave's rows: the INOL band sits flush on the plot edge of two sparks and fills the third (P3,
pixel-identical to r2 although #491 widened a band edge's air; the cause is not found — the playground's INOL values
changed under #490 in parallel, so the fixture #491 aligned to may not be the one shot). Playground, unscored: the S7
page states weight and e1RM in figures that disagree across cards (P2 ×2), the goal footer vs the drawn Goal line,
INOL windows unnamed, a scrubber label inside the panel's padding (S8, P3).

## Open, outside this wave's rows (basalt-owned, for later waves)

- `Meter` marked track painted full ink, so a low reading reads as a full bar (Expression 2, P2) — the marker form's
  track; Wave 46 or a Meter row.
- `Sparkline` focus chip: the marker on the first point reads another value, no date, and overprints `PR` at 390 (P2).
- The INOL list: lift names ~920 px from their sparks at 1440 (P2); the info bubble covering values at 390 (P2).
- A chart focus tooltip covering the card title (P2); the weight-trend focus ring with no top edge (P3).
- `BasaltDataTable` at 390: the row focus ring stops before the actions column (P2); the `+N` header (W42 design, P3).
- A strip footer link with no hover state (P3).
