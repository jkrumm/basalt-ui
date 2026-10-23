# Wave 50 — the re-audit after the second-layer fixes

Validator: the playground, every scenario (S1–S8) with its empty, loading and error toggles, built from `master` at
`6c07912c` (#536–#540 merged). Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --dist
apps/playground/dist --out .design-parity/w50/r1`, then `shot detect`): 1394 shots, 0 failed, `shot detect` 100 (0
findings). Two fresh `basalt-design-reviewer` subagents on Sonnet, one per half, each told to open every contact sheet.
One round (the scoring round). Boards stay in the gitignored `.design-parity/w50/`.

| Route       | W49 r1 | W50 r1          | basalt (P2/P3) | playground (P2/P3) |
| ----------- | ------ | --------------- | -------------- | ------------------ |
| S1 ops      | 92     | 92 (P2 1, P3 5) | 1 / 3          | 0 / 2              |
| S2 training | 91     | 91 (P2 2, P3 3) | 1 / 2          | 1 / 1              |
| S3 agents   | 95     | 94 (P2 1, P3 3) | 1 / 1          | 0 / 2              |
| S4 spend    | 98     | 97 (P3 3)       | 0 / 1          | 0 / 2              |
| S5 learning | 92     | 97 (P3 3)       | 0 / 1          | 0 / 2              |
| S6 settings | 94     | 97 (P3 3)       | 0 / 1          | 0 / 2              |
| S7 body     | 76     | 89 (P2 2, P3 6) | 1 / 3          | 1 / 3              |
| S8 map      | 99     | 99 (P3 1)       | 0 / 1          | 0 / 0              |

No P1 on any route. Fixed against W49 (20 items): the S7 Meter track now spans the card (a lone strip cell took one of
two grid tracks, #539), the reading tick on an ink fill, the S5 summary, S6 account, S7 zone readout and weight strip
error titles, the S5 sparkline-less cell, the S5 orphan word, the S5/S7 kicker wrap at 390, the S7 strip footer inset,
the S7 table focus ring, the S7 goal prompt, the S1 folded skeleton count, "Could not load awaiting items" (S3).

## Basalt-owned (Wave 51 candidates)

- **P2 a table or list inside a titled `Section` still shows a bare "Could not load"** (S1 outages, S2 session log, S7
  skinfold history). #537 named a `QueryState` inside a `Section`; an untitled `BasaltDataTable` names its own error
  from its own (absent) title and never reads the host's.
- **P2 S3 item timeline at 390: the `EventList` day header covers the first event row** (new; "warden blocked → queued"
  half hidden).
- **Carried although Wave 50 changed the source — measure before the next attempt:** the Board column still cuts its
  fourth card with no fade (S3; #538's fade did not reach this column); the `BarList` delta glyphs still ~8 px apart in
  S4 top drivers (#536's two-track cell did not reach it); the throughput hover crop still holds a tooltip fragment
  from the chart above (S1; #538's mute); the "+N cols" header still read as unexplained at 390 (S1, S2, S7).
- **P3**: the S1 390 y ticks stop under the dashed contract line (#539 found no label collision: the tick policy drops
  the tick under the line); the S2 strip window caption flush on the card's left edge and smaller than the "7-day
  rolling" line under it (new, #539's caption); the S5 "12 wk mean" key crowds the window caption at 390; the S6
  focused-field autofill fill (#537 did not take in that crop); the S7 lift name ~950 px from its value; the S7 "PR"
  label touched by its line; the S8 map key's 0 % swatch near-white on the card.

## Playground-owned

S2 lede restating the pace, load and readiness cards; S1 download's contract in the kicker and a row; S1, S2, S7 tables
ending at 55–70 % of the row (the #540 width cap did not read as filled); S3 the same wait and nine items in four
places, the timeline using the left ~40 % at 1440; S4 the budget three times, the month-to-date period twice; S5 "Sept"
vs "Sep", the "Alpine butterfly" heading twice at 390; S6 the unit in the field and the helper, a 320 px control column
leaving ~45 % of each card empty; S7 the duplicated weight-spread card with different insets, the chart period vs strip
dates vs skinfold range, the weight-strip empty crop catching a neighbouring card.

## Verdict

Not converged: every route still carries findings, two of them P2 on basalt. Wave 51 is appended in the same shape.
