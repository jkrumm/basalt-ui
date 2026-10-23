# Wave 49 — the re-audit after the trial and audit fixes

Validator: the playground, every scenario (S1–S8) with its empty, loading and error toggles, built from `master` at
`524b3b41` (#528–#534 merged). Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --dist
apps/playground/dist --out .design-parity/w49/r1`, then `shot detect`): 1402 shots, 0 failed, `shot detect` 100 (0
findings; the per-anchor `craft-7/no-declared-states` from #534 passes on the playground). Two fresh
`basalt-design-reviewer` subagents on Sonnet, one per half, each told to open every contact sheet. One round (the scoring
round). Boards stay in the gitignored `.design-parity/w49/`.

| Route       | W48 r1 | W49 r1          |
| ----------- | ------ | --------------- |
| S1 ops      | 91     | 92 (P2 1, P3 5) |
| S2 training | 94     | 91 (P2 2, P3 3) |
| S3 agents   | 93     | 95 (P2 1, P3 2) |
| S4 spend    | 92     | 98 (P3 2)       |
| S5 learning | 74     | 92 (P2 1, P3 5) |
| S6 settings | 95     | 94 (P2 1, P3 3) |
| S7 body     | 58     | 76 (P2 5, P3 9) |
| S8 map      | 98     | 99 (P3 1)       |

Fixed against W48: both S5 P1s (the 390 chip wrap, the journal skeleton 312 → ~2,100 px), the bare error title on every
KPI, chart, strip and meter card, the struck budget label, the off-step ticks, the weight-trend focus ring, the BarList
name/value collision, the accent slider fill, and the playground copy (S1 noun, S3 meter titles, S5 title and summary,
S6 "Notes", S7 kickers, INOL, sparkline periods). Drops on S2 and S6 are read depth (unscored items), not regressions.

## Basalt-owned (Wave 50 candidates)

- **P2 bare "Could not load" where the host title is a `Section`/`WidgetHeader` around `QueryState`**: S1 outages
  table, S2 session log, S5 summary ("Practice record"), S6 account, S7 zone readout and skinfold history. #532 named the
  thing inside `StatCard`/strip/`ChartCard`/table; a `Section`'s title does not reach the `QueryState` inside it. The v3
  trial hit the same on its channel, product and log sections.
- **P2 S7 Meter track stops at ~48 % of the card** (x 291–836 of 280–1416) — carried: #531's `inline-size: 100%` and
  #529's strip change did not reach this layout. Measure the host before the next attempt.
- **P2 S7 reading tick on a fully dark track** still barely readable (carried; #531's halo is not enough at that size).
- **P1 (trial) `EventList` uses four font sizes** (11/12/13/15, `craft-2/font-sizes`, `shot detect` on the v3 app).
- **P3**: the table's "+N" fold header still reads unexplained at 390 in the crops (#530 changed the title and sr-only
  text, not the visible "+N"); the folded skeleton hides "+2" against "+1" loaded (S1); a hover crop still holds a
  tooltip fragment from the chart above (S1 throughput, harness); the 390 y ticks stop under a dashed contract line
  (S1); the board column cuts its fourth card with no fade (S3); the danger-zone ring differs by scheme (S6); autofill
  highlight on a focused select still visible (S6, #533 did not take in that crop); the BarList delta column misaligns
  by ~8 px (S4); the strip's "12 wk mean" label over the sparkline (S5) and the "PR" label touched by its line (S7);
  kicker scope wrapping unevenly in a 2×2 strip at 390 (S5, S7); the strip footer flush on its bottom edge (S7 weight
  strip); a table focus ring open at its top/right at 390 (S7); a lift name ~950 px from its value (S7); the map key's
  0 % swatch near-white on the card (S8).

## Playground-owned

S2 lede restating four card figures; S3 the same wait and nine items in four places, "Could not load awaiting"; S4
the budget stated three times; S5 mixed month forms, a sparkline-less strip cell, a 390 orphan word in an empty line;
S6 a unit typed into the field and named in the helper; S7 the weight figure three times, "Set a goal weight" against a
drawn goal line, the chart period vs the strips' dates, the skinfold title without scope, columns ending at ~55 %; S1 and
S2 tables leaving the right of the row empty.

## Verdict

Not converged: every route still carries findings. Wave 50 is appended in the same shape.
