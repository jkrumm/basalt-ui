# Wave 42 — Data tables, responsive: rounds on S1, S2, /data and the components

Setup: `docs/waves/design-parity/w37/setup.md`, unchanged. Routes `/scenarios/s1-ops /scenarios/s2-training /data /components`
(the shot script: build the package and the playground, `basalt-ui shot … --out .design-parity/w42/r<n>`, then `shot detect`).
Three fresh `basalt-design-reviewer` subagents per round (S1; S2; /data with /components), told to score every table and toolbar
against SPEC § 6.6 and § 9.1. Boards stay in the gitignored `.design-parity/w42/` and are copied to the MacBook.

| Route                  | r0 (before, 2.27.2)  | r1 (#468 #469) | r2 (#470 #471) | r3 (#472 #473) | r4 (#474 #475) |
| ---------------------- | -------------------- | -------------- | -------------- | -------------- | -------------- |
| S1 ops (route)         | 33                   | 31             | 60             | —              | —              |
| S1 outages (component) | —                    | —              | 78             | 88             | 90             |
| S2 training            | 99 (no table yet)    | 71             | 64             | 74             | 84             |
| /data                  | 62 (page shots only) | 21             | 57             | 61             | 77             |
| /components            | 96                   | 97             | 97             | 99             | 99             |

S1's route score carries 18 KPI-card and chart items outside this wave (named in r0, unchanged). /data's r1 drop is the
newly shot per-table states and anchors (13 new items), not a regression.

## r0 — the before board (master `c834bd85`)

- **S1 (33; P1 2, P2 13, P3 8).** Table items: the outages rows and the `START (UTC)` header wrap at 390 with no fold or
  pin (P1, carried from W33 r3); `min` repeated in every Duration cell (P2, playground); columns stretched evenly at 1440, a
  start time ~700 px from its duration (P2); the generic "Could not load rows" (P3); a 5-row skeleton for 4 rows (P3). The other
  18 items are the KPI cards and charts (hover readouts, empty-card voids, loading ghosts in the wrong shape, the availability
  state body growing past its loaded height, P1) — outside this wave's table scope; recorded for the Wave 45 state pass.
- **S2 (99).** One carried P3 (the hit-rate skeleton has no legend row). The sessions table does not exist yet.
- **/data (62; page shots only, no anchors).** Names and roles wrap at 390 (P1 ×2); money mono but left-aligned (P2); a grey
  column fill in light (P2); the pinned demo neither pins nor scrolls at 390 and its 5 px unlabelled fold caret (P2); narrated
  subtitles (P2, playground); `$` in every cell, mixed numeric faces, mixed toolbar heights, plain-select filters with no
  label/value split (P3).
- **/components (96).** The loading headers wrap at 390 (P3, carried since W38); numbers in sans (ruled out: D33 supersedes
  § 6.6's "mono" — figures are sans `tabular-nums`, mono is for times); empty/error drop the header (P3); the table's own ring
  inside the card's (P3).

## r1 — kinds and toolbar (#468, #469)

Fixed: units in headers (S1 Duration), the header on the body fill and the sorted column in ink, figures right-aligned
sans `tabular-nums` (D33), dotted status chips, /data's narrated copy and mixed toolbar heights, the filter pill's muted
label and bright value. New/named: S2's new lift log (title clash with the SESSIONS card, a Squat volume that disagreed
with Top lifts, status hues reused by the entity dots, no shot of the date tooltip), the S1 scope hue reading as severity,
the count chip and pager reading 0 while loading/errored, "Could not load rows", short skeletons, columns spread evenly
at 1440, the accent on the active pill and the current page. 390 fold/pin pending (#470).

## r2 — the responsive law and the playground fixes (#470, #471)

Fixed: the 390 fold now folds the states too (S2), the ghost chevron and `+N` header (F102), the opaque pinned column, the
S2 volumes reconciled, Est. 1RM's formula in its header, neutral entity glyphs, money/percent units in headers on /data,
the S1 scope as neutral text and its start as a mono time with a UTC tooltip. Open: cells still wrap at 390 (S1 Cause,
/data Role) so the table fits by wrapping instead of folding — the P1; the fold differs between loading and rest; the
date tooltip opens over the header; no row hover; the S2 log contradicts "Strength 5 sessions" (P1, fixture); plus the
states and sizing items above.

## r3 — one-line rows and honest states (#472, #473)

Fixed: S1 Cause folds instead of wrapping (the last P1 on a table), the bare "Could not load", the count chip and range
hidden while loading/errored, the skeleton at the page size, ink for the active pill and the current page, row hover,
empty and error centred alike, the /components table on `BasaltDataTable` (one ring, header kept in every state, no
wrapped loading header — the P3 carried since Wave 38), the S2 log agreeing with the session mix and Top lifts. Keel:
/components holds up; S1, S2 and /data close. Open: the slack sat on the entity column (a name ~650 px from its
figures); a fourth type size from the pager and the toolbar fields; the custom S1/S2 date cells still opened their
tooltip above; skeleton counts on non-paginated tables; Role wrapping on /data; circular empty copy.

## r4 — the last round (#474, #475), master `2877ed7e`

Fixed: the fourth type size (the S2 log is back to 11/13/15), names beside their figures on the S2 log, the S1/S2 date
tooltips below the cell and open on focus, skeleton rows per table, /data Role one line at 390, empty copy with a cause
and a next step, the pinned header cell's fill, no pager under an empty table, the empty title no larger than the table
title. Keel: /components holds up; S1, S2, /data close (layout decides each). No P1 on a table.

Accepted by rule or by design (named, not scored): the 16 px toolbar search and rows-per-page text
(`sub-16-input-font`); a cold loading/empty/error shot folds and sizes from header widths, so at 390 it can fold
differently from rest and at 1440 its columns sit at other x positions.

Open after r4 (P2 unless marked):

- **basalt:** the slack lands on a `kind: 'text'` column that is not the trailing one when a later column has no kind
  (S1 Scope ~780 px from Cause; /data Block, Department–Role); with no text column the trailing spacer leaves ~47 % of
  a wide row blank and strands the pager (P3); the date tooltip below covers the next row and overhangs the card's
  left edge; /data roster loading at 1440 folds two columns that rest shows; the error state keeps a dead pager (P3);
  the 390 loading footer drops the range line (P3); a fixed-length skeleton bar is still off-shape for a 3-letter
  column (P3); the fold header reads a bare `+N` (P3); the empty title now smaller than its description (P3, the
  title seam overshot).
- **playground:** a title's figure ("3 departments", "4 locations") beside a 0 count in the empty/loading/error
  states; "Reload to fetch them again" with no Reload action (P3); a live "Export CSV" on an empty table (P3); the
  preset chip resets in cold states (P3); no expanded-row shot at 390 (P3); the S2 facet still reads "Any exercise"
  (an `EnumFilter` unset text from its label, a package choice).
- **Outside this wave:** S2's empty StatCards keep a ~45 % void (P1, the Wave 46 state pass); S1's KPI cards and
  charts (18 items since r0).
