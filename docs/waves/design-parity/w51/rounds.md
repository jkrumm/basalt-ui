# Wave 51 — the re-audit after the anchors and host-title fixes

Validator: the playground, every scenario (S1–S8) with its empty, loading and error toggles, built from `master` at
`7f07e026` (#542–#546 merged). Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --dist
apps/playground/dist --out .design-parity/w51/r1`, then `shot detect`): 1372 shots, 0 failed, `shot detect` 100 (0
findings). Two fresh `basalt-design-reviewer` subagents on Sonnet, one per half. One round (the scoring round). Boards
stay in the gitignored `.design-parity/w51/`. Coverage caveat: the S1–S4 reviewer opened 17 of ~46 contact sheets and
no Keel captures, so its unopened components and Keel lines are provisional; the S5–S8 reviewer opened every sheet.

| Route       | W50 r1 | W51 r1          | basalt (P2/P3) | playground (P2/P3) |
| ----------- | ------ | --------------- | -------------- | ------------------ |
| S1 ops      | 92     | 95 (P3 5)       | 0 / 4          | 0 / 1              |
| S2 training | 91     | 95 (P3 4)       | 0 / 3          | 0 / 1              |
| S3 agents   | 94     | 93 (P2 1, P3 3) | 1 / 1          | 0 / 2              |
| S4 spend    | 97     | 97 (P3 3)       | 0 / 0          | 0 / 3              |
| S5 learning | 97     | 99 (P3 1)       | 0 / 0          | 0 / 1              |
| S6 settings | 97     | 99 (P3 1)       | 0 / 0          | 0 / 1              |
| S7 body     | 89     | 93 (P2 1, P3 4) | 0 / 3          | 1 / 1              |
| S8 map      | 99     | 99 (P3 1)       | 0 / 1          | 0 / 0              |

No P1 on any route. Fixed against W50 (28 items), among them every one of the four W50 fixes that had not reached its
crop: the S1 throughput hover is clean, the S3 Board column fades its fourth card, the S4 `BarList` glyphs share one x,
and the fold header is a button (its label is still the open item below). Also: the three host-named table errors, level
card rows, the facts delta glyph, "Show earlier" as a button, `Sep` on the S7 axis, the S7 "PR" label, the S5 key at
390, the S6 selection tint, the S2 caption inset, the S8 0 % swatch, and the playground copy and layout list.

## Basalt-owned (Wave 52 candidates)

- **P2 S3 item timeline at 390: the day header reads "5 events" and four rows show; the first row ("warden blocked →
  queued") is out of the box with no cue.** #542 stopped the header covering a row; the box now opens on whole rows,
  but nothing says one is above.
- **P3**: the `+N cols` button still does not say what it reveals before it is tapped (S1, S2, S7); a name ~650–800 px
  from its next column in a filled wide table (S1 outages Cause, S2 Exercise: the slack column is the last text or
  entity column, so a short cell gets the width); the S1 390 y ticks under the contract line (carried, policy); the
  S1 availability hover tooltip over the "12 Oct" tick; the S2 hit-rate title ~8 px below its row neighbour and "Goal
  28" over the Aug bar; heavy grey scroll rails on the S3 Board columns; the S7 Meter "60-day low" caption under the
  latest-reading tick; the S7 table tooltip over the next row's time; the S8 scrubber end labels ~8 px outside the
  track inset.

## Playground-owned

S7 skinfold table ends at ~55 % of the row (P2, carried: the table fills, its container does not); the S7 INOL card's
right third empty; S1 latency-now and S4 strip-forecast focus crops catching a neighbour; S2 the pace card's four
labels; S3 "Awaiting 6" three times and a decision body that adds no fact, the flow chart's void beside a surfaceless
history; S4 the period in four subtitles and two untitled-scope chart titles; S5 journal rows in the left ~40 %; S6 the
danger card saying delete three times.

## Verdict

Not converged, but the phase-1 exit holds: no P1 in the audit, and no basalt-owned P1 in trial v5. Wave 52 is appended in
the same shape.
