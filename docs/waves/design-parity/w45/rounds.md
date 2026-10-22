# Wave 45 — Board and the record page: rounds on S3 and S5

argo is paused (owner, 2026-10-22), so the validator is the playground: `/scenarios/s3-agents` (S3, the new `Board` and a
decision card, argo's warden) and `/scenarios/s5-learning` (S5 laid out as the record-page recipe, rb's knot detail).
Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --out .design-parity/w45/r<n>`, then
`shot detect`). Two fresh `basalt-design-reviewer` subagents per round, one per route, on Sonnet. Owner cap: three
rounds. Boards stay in the gitignored `.design-parity/w45/`.

| Route                       | r1 (#502, #503, #504) | r2 (r1 fixes) | r3 (r2 fixes) |
| --------------------------- | --------------------- | ------------- | ------------- |
| S3 agents (board, decision) | 26 (P0 2, P1 2)       | 97 (P1 0)     | 96 (P1 0)     |
| S5 learning (record page)   | 21 (P0 2, P1 2)       | 94 (P1 0)     | 93 (P1 0)     |
| `shot detect`               | 0 (3 P0, 4 P1)        | 100           | 100           |

## r1 — the board, the record page and the decision card land

Both routes' P0/P1 were one defect: the decision card's key hint was a `Kbd` inside the filled primary button (1.96:1 in
light, 3.24:1 in dark, a 5 px radius nested in the button's 6 px, a fourth font size at 10 px). Board: a total on one
column only that repeated the count; the compact column head restating the switcher's title and count. S5: the decision
facts restated the strip and the header badge; the topic named four times. Correct on first sight: the board's anatomy
(§ 6.8), per-column scroll, the compact switcher, the board's empty/loading/error; the record-page order (§ 6.9); the
list rows in the aside.

Aside width (SPEC § 5): 300 holds (D53). At 1440 the aside's list rows fit glyph, name, meta and count on one line with
about 100 px to spare; nothing wraps at 300.

Ruled, not defects: the record header has no right-hand actions — `basalt-controls.md` gives an action one home (`PageBar`)
and a header is not one; "Log a session" stays in the bar. The empty Done column keeps its slot (a column never moves
when it empties), so the board's right fifth is that column, not a void.

Code review (agent-gateway): #503 blocking — the compact roving tab stop could sit in an unrendered column, and
`isSafeHref` accepted `/\evil.test`; both fixed with tests before merge, plus `field` binding for the compact column
(basalt-state: a control takes a `field`, never `value`/`onChange`). #502 clean with improvements (one log action in
empty, date-derived fixture helpers), taken. #504: catalogue rows with two cells under a four-column header, argo-internal
paths in a shipped reference; fixed.

## r2 — hints beside the buttons, one statement per fact

Fixed: every r1 P0/P1 (the hint beside the button), board totals removed, the compact head shows only a total, the
first column reads "Awaiting" like the strip, captions name the agent and the work type instead of the column's state,
the S5 card states only the review interval. Board scrollbars on hover only (my call) — reverted in r3 after the code
review: it hid the scroll cue from touch and keyboard users.

## r3 — the merged tree

The hints are `Kbd` chips at 12 px beside the buttons (r2 read bare letters as stray characters); overflowing columns
show their scrollbar, so a clipped fourth card reads as scrollable. No P0/P1 on either route.

Open (carried into **Left behind**): the record link on a board card renders in the browser's default link blue
(visited purple in dark), not the themed link colour (P2, basalt); the primary button's hover crop matches rest on S5
(P2, basalt `Button`, or the shot's hover target); key-hint chips shown at 390 where touch has no keyboard (P3); the 390
summary headline breaks raggedly (P3); the aside's empty is a bare sentence (P3, Wave 46's `EmptyState` anatomy); the
topic named three times on S5 (P3); a bare "Board" section title (P3); the strip footer meters without a noun (P3).
Wave 46 already owns: the journal's rating chip wrapping (now also at 1440) and the sparkline readout over its
reference label.
