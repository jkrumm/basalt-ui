# Wave 46 — Forms, states and the guidance half: rounds on every scenario

argo is paused (owner, 2026-10-22), so the validator is the playground: every scenario (S1–S8, S6 new this wave) with
its empty, loading and error toggles. Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --out
.design-parity/w46/r<n>`, then `shot detect`). Two fresh `basalt-design-reviewer` subagents per round on Sonnet, one per
half (S1 S2 S3 S6 / S4 S5 S7 S8). Owner cap: three rounds. Boards stay in the gitignored `.design-parity/w46/`.

| Route             | r1 (#506–#509) | r2 (#510–#512) | r3 (#513, #514)                   |
| ----------------- | -------------- | -------------- | --------------------------------- |
| S1 ops            | 63 (P1 2)      | 47 (S1–S3, S6) | 96 (P1 0)                         |
| S2 training       | 74 (P1 1)      | ″              | 99 (P1 0)                         |
| S3 agents         | 82 (P1 1)      | ″              | 99 (P1 0)                         |
| S4 spend          | 57 (P1 4)      | 54 (S4–S8)     | 100                               |
| S5 learning       | 89 (P1 0)      | ″              | 79 (P1 2)                         |
| S6 settings (new) | 67 (P1 1)      | 47 (S1–S3, S6) | 97 (P1 0)                         |
| S7 body           | 66 (P1 2)      | 54 (S4–S8)     | 97 (P1 0)                         |
| S8 map            | 94 (P1 0)      | ″              | 99 (P1 0)                         |
| `shot detect`     | 100            | 100            | 100 (S2 re-shot after `6bcfe48e`) |

## r1 — the merged wave: S6, the `EmptyState` anatomy, the DESIGN-CORE fold

The whole inventory, re-scored. The P1s are one gap: the patterns #509 aligned (`EmptyState`, `Board` columns,
`BarList`, the data table's body, `EventList`) read right, but the chart body's empty (S4 ×4, S7 ×2, S1, S2) and the
`StatCard` empty are still a bare muted sentence with no tile, title or action; the S3 empty board and the S1/S2 table
empties did not read as the tile either. A line chart's loading skeleton draws bars (S1). The error placeholder is
left-aligned in cards and charts but centred in the table, the board and the map. S6: the account page's loading titles
read "Loading" (banned filler), and the two forms on one page read as two systems (bare entry surface, lighter section
heads, different label columns).

Fixed from Wave 45 (S5): the strip skeleton keeps its sparkline row, the sparkline readout replaces the reference label
instead of covering it, the journal chip no longer wraps at 1440, the aside's empty is no longer a bare sentence.
Carried: the S5 primary's hover crop equals rest (the shot's hover target misses the button), decision-card key hints at 390.

## r2 — chart and card empties as tiles, one form row (#510–#512)

Both reviewers opened every contact sheet this round (r1 left strips, meters and the map key unread), so r2 scores the
whole inventory for the first time and reads lower for it: S1 S2 S3 S6 together **47** (P1 3, P2 7), S4 S5 S7 S8
together **54** (P1 2, P2 6). `shot detect` 100.

Fixed (22 of r1's 24): every chart-body empty on S4 and S7 is the tile with its why-and-what-to-do lines; the line
chart loads as a line ghost; `StatCard` empties are tiles and the loading card keeps its delta chip; the table, board
and map errors are left-aligned; the S3 empty board and the S1/S2 table empties are tiles with their ring in light;
the S6 forms share one row (D54), the account loading has no "Loading" titles, the Reps error shows only on a failed
validation; the S5 journal chips sit after the sentence, the aside keeps its heading, the scrubber loads without live
values.

New: the tile title is larger than its card head on S2 and S3 (the title takes `sm` inside a section); the band strip
loads as tall bars; `StatCard` loading omits its breakdown rows; the S5 strip cells' empties have no reason line; the
S8 overlay panel covers the map's error; the compact board loads without its switcher. Carried: the primary's hover
step is too small to read at button size (third round) — a theme decision now, taken in r3's fixes.

Ruled, not defects: a joined strip cell's empty is the value or an em dash plus a muted reason line, not a tile (a
tile would ring inside the strip's hairlines; S3's strip empties follow this); agents-decision declares no empty or
error (a decision card is absent when there is nothing to decide).

## r3 — the merged tree (#513, #514, `6bcfe48e`)

r2 scored per half; r3 per route again. Fixed: the band strip loads as one band row at its height, `StatCard` loading
keeps its breakdown rows, every tile and card error title is `sm` 500 inside a section (never above its card head),
the compact board loads with its switcher, the S5 strip cells carry reason lines, the aside loading keeps its heading,
the S8 overlay leaves the error readable, the scrubber skeleton has its anatomy, the S7 empties carry both lines, and
the primary's hover is legible (the derive hover step 4.8 → 10 tone; third round carried, now fixed). `shot detect` hit
one P0 on S2: the summary's omitted empty was declared only on the empty render, but the shot reads the declaration at
rest (an r2 review suggestion moved it); fixed and S2 re-shot (100).

Open, not shot again (owner cap three):

- **P1, basalt `EventList`:** at 390 a feed row with a long note pushes its rating chip to a third line (S5 journal, 25
  Sept, 17 Sept). Wave 44 left it as a P3; the rubric's "no dense-list row wraps at 390" makes it a P1.
- **P1, playground:** the S5 aside skeleton draws 3 rows against 5 loaded.
- **P2, basalt:** the S1 outages table's 390 skeleton lacks the folded table's scope and chevron columns; the S6 entry
  rows have no dividers where the settings rows do (the two forms otherwise read as one system).
- **P3:** the S2 session-log 390 skeleton lacks its chevron column and page footer; the compact board skeleton's
  switcher shows no counts; the "PR" label on the sparkline start (S7); the weight-trend focus tooltip over its title
  (S7); the skinfold table's focus ring clipped at 390 (S7); the map scrubber's hover equals rest (S8); the S1
  latency tooltip sentence; the S5 strip empties in ink, not muted.
- **Not scored by eye, measured:** light-scheme field boundaries are about 1.04:1 against the card (dark 1.22:1), below
  WCAG 1.4.11's 3:1 — a theme decision for the input ring, reported by the S6 worker, not changed here.
