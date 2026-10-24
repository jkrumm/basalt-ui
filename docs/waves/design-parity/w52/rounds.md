# Wave 52 — the full re-audit (phase-1 confirmation)

Validator: the playground, every scenario (S1–S8) with its empty, loading and error toggles, built from `master` at
`15206db2` (#548–#551 merged). Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --dist
apps/playground/dist --out .design-parity/w52/r1`, then `shot detect`): 1372 shots, 0 failed, `shot detect` 100 (0
findings). **Four** fresh `basalt-design-reviewer` subagents on Sonnet (S1+S3, S2+S4, S7, S5+S6+S8), one round (the
scoring round). Boards stay in the gitignored `.design-parity/w52/`.

**Coverage (the W51 caveat closed):** every reviewer opened every contact sheet of its routes (19/19, 18/18, 15/15,
15/15 = 67 of 67) and the 40 Keel route captures (the S5/S6/S8 reviewer on a second pass; its first pass opened 3 and
was sent back), plus the Keel patterns matching its components. The scores below replace W51's provisional S1–S4 lines.

| Route       | W51 r1 | W52 r1          | basalt (P2/P3) | playground (P2/P3) | Keel     |
| ----------- | ------ | --------------- | -------------- | ------------------ | -------- |
| S1 ops      | 95     | 93 (P3 7)       | 0 / 5          | 0 / 2              | close    |
| S2 training | 95     | 93 (P3 7)       | 0 / 3          | 0 / 4              | close    |
| S3 agents   | 93     | 88 (P2 1, P3 9) | 1 / 4          | 0 / 5              | close    |
| S4 spend    | 97     | 93 (P3 7)       | 0 / 3          | 0 / 4              | holds up |
| S5 learning | 99     | 89 (P2 1, P3 8) | 0 / 2          | 1 / 6              | close    |
| S6 settings | 99     | 87 (P2 1, P3 7) | 1 / 1          | 0 / 6              | close    |
| S7 body     | 93     | 87 (P3 13)      | 0 / 6          | 0 / 7              | close    |
| S8 map      | 99     | 94 (P3 6)       | 0 / 2          | 0 / 4              | holds up |

No P1 on any route. The drops against W51 are a stricter, full-coverage reading of largely the same surfaces (most
items are classed _unscored_: visible in W51's shots, named only now), not regressions; W51's provisional S1–S4 lines
were too high. Held out of the tally: S6 light-scheme inputs with no visible edge (P2) — the light-scheme input border
contrast is the owner's call, unchanged.

Fixed against W51 (as confirmed by the reviewers): the S3 cut first row now has a cue, the `+N cols` button names what
it reveals, the S1 outages and S2 Exercise slack, the S7 skinfold table fills its row (W51's P2), the S7 "60-day low"
caption, the S2 hit-rate title level with its neighbour, the S3 flow chart and history both carded, the S4 period once
and scoped titles, the Retry border in every error state, the Meter empty tile, loading skeletons in the loaded shape.

## Basalt-owned (Wave 53 candidates)

- **P2 S3 item timeline: the box cue reads "↑ 39 above" (1440) / "↑ 40 above" (390) beside "Show earlier (12)".** The
  count is the rows scrolled above inside the box, but with no unit next to a second "earlier" count it reads as an
  event count that matches nothing on screen. One mechanism, or a cue that says what it counts.
- **P2 S6 the danger-zone card has its red ring in dark and none visible in light** (W50 claimed both schemes).
- **P3**: the `+N cols` hint truncated and wrapped in the 28 px gutter ("+3 cols / Est. 1R…", "Abdo…", S1/S2/S7); a short
  table packs left with a ~530 px void under full-width rules (S2 session log: the W52 slack rule's other edge); table
  time tooltips over the next row (S1 outages, S7 skinfold: the right placement did not reach these crops); the S1
  availability hover tooltip over its tick and legend (carried); the S1 390 throughput 250 contract line with no tick
  (carried, policy); period caption under the label on half-width cards and top-right on a full-width one (S1, S3 strip);
  the Board rails still always visible (thinner); the S3 failures strip three bars with no count or scale; a feed
  error body at loaded height (S3); the S2 "Goal 28" label crowding the Sep bar (carried); the S4 strip tooltip running
  out of its card at 390; three crowded meter tick labels in a ~140 px strip card (S4); strip empties as bare text where
  cards use the empty tile (S4); the S5 sparklines spline 12 discrete weekly values; the S5 summary skeleton 4 lines for
  a 3-line sentence at 390; the S6 form group headings barely heavier than field labels; the S7 strip empty band and the
  error dot centred on a wrapped title; the S7 zone-readout skeleton a single bar; the S7 first-point focus tooltip over
  the "76 kg" tick (row 207's fence did not reach this card); the S8 scrubber end labels ~8 px outside the track
  (carried; a basalt `Slider` style); Retry styled two ways (the S8 map error a hairline, the W52 ink border elsewhere).

## Playground-owned

S5 the strip's "Last practised 16 Oct" against the journal's "Today" (P2: two surfaces, two dates); S5 journal rows in
the left ~40 % (carried), the strip's repeated range and mean, "SESSIONS … sessions", "3, 5, 3 of 5", the 390 aside far
down; S1/S2/S3/S4/S5/S7 focus crops catching a neighbour (one harness-and-composition cause); S1 the outages table
with no surface; S2 the pace label restating the headline, the 390 strip arrangement, "log a workout" worded four ways;
S3 the decision body with no evidence and "Awaiting 6" three times (carried), the two spend meters labelled
differently, the "per-" hyphen break; S4 the median bin and the two named projects unmarked, "no spend" worded three
ways; S6 "reconnect it in Settings" on Settings, the danger card copy (carried), the right column void, the US date
field, a subtitle restating its title, three-line API-key rows; S7 the strip footers off one baseline, the INOL card
half empty (carried), INOL 0.88 vs 0.84 unscoped, PR stated twice, zone bands without thresholds, info tooltips over
their data, surfaceless zone and table; S8 the end label with no day across midnight, place labels with no marker,
hover identical to rest, the 390 legend a third of the map.

## Verdict

**The phase-1 exit holds:** no P1 in the full audit (67 of 67 sheets and the Keel captures opened), and no
basalt-owned P1 in trial v6 (P1 0; P2 basalt 2, app 2). Not converged: two basalt P2s in the audit, two in the trial
(rows 212–213). Wave 53 is appended in the same shape.
