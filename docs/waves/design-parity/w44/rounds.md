# Wave 44 — Event list: rounds on S5 and S3

argo is paused (owner, 2026-10-22), so the validator is the playground: `/scenarios/s5-learning` (S5, built this wave,
rb's knot detail and journal) and `/scenarios/s3-agents` (S3, its new item timeline, argo's warden). Setup:
`docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --out .design-parity/w44/r<n>`, then `shot detect`).
Two fresh `basalt-design-reviewer` subagents per round, one per route. Boards stay in the gitignored `.design-parity/w44/`.

| Route                 | r0 (#493, stubs) | r1 (#495) | r2 (#495 fixes, #496) | r3 (#495 fixes, #497) | r4 (#498, #499) | r5 (#500) |
| --------------------- | ---------------- | --------- | --------------------- | --------------------- | --------------- | --------- |
| S5 learning (journal) | —                | 0 (P1 10) | 39 (P1 3)             | 57 (P1 3)             | 81 (P1 1)       | 98        |
| S3 item timeline      | —                | 49 (P1 3) | 78 (P1 1, page P1 1)  | 66 (P1 2)             | 90 (P1 0)       | 99        |
| `shot detect`         | 80 (2 P1, stubs) | 70 (3 P1) | 100                   | 90 (1 P1)             | 100             | 100       |

r0 is the page with the two event-list slots as empty stubs (#493); its only findings are the empty slots.

## r1 — the first EventList (#495)

S3 timeline: no day groups (the relative time "5 days ago" ×18 carried the grouping), a `transition` chip repeating the
sentence, the decision row 3,100 px down an oldest-first list, a one-line skeleton under two-line rows, four type sizes
in one anchor (P1), the right-pinned time wrapping every dispatch sentence at 390 (P1), the actor at the sentence's
weight, dotless chips with no surface in light, no hover on "Show earlier", a bare empty line (P1). Correct: the rail,
the row gap, the mono time, the status chips, the earlier control's focus.

S5: the journal rendered 320 rows as one 29,000 px block (the virtual window inside a page-tall box: 96 % empty, P1),
the feed row stacked three lines (~91 px) against § 6.7's two (~52), the same four type sizes and skeleton shape; the
rest is fixture (four error titles for one source, figures stated twice between summary/strip/aside, a strip without
a trend, "…" as loading, no surface for the decision).

Code review (agent-gateway, actionable): duplicate day-header ids for non-adjacent runs of one day, an invalid `at`
throwing in `toISOString`, prepend-anchor state not reset, a root remount at the 200-row threshold, loading/empty
dropping `height`, Safari list semantics, raw `useLayoutEffect`.

## r2 — two-line rows, day groups, a paged journal (#495 fixes, #496)

Fixed (S3 9, S5 7): day groups instead of a repeated relative time, the `transition` chip, the decision row visible at
1440, two-line skeletons, three type sizes, the time moved onto the meta line at 390, a heavier actor, chips with a
surface in light, one error per source on S5, figures stated once, skeletons instead of "…", the 29,000 px journal
(newest 40, "Show earlier (280)").

Still failing, basalt: the bounded oldest-first box not opening at the newest row at 390 (P1), ~1,000 px of blank page
below the timeline at 390 (page P1), a bare day-header count read as part of the date, the time 500–900 px from its
sentence at 1440, no hover step on "Show earlier" (carried), an empty state without the § 6.11 tile and action, the
skeleton without day headers or chips. Playground: rows unsorted inside a day, "Session logged" restating the noun, a
grey dot as the leading mark, strip and aside empty values written as sentences, two windows (this month vs last 30
days), the aside title.

Ruled, not defects: the S5 error as a section heading over "Could not load" is the house title (W42 ruling). Out of this
wave (`StatGroup`, Wave 46): the strip skeleton drops the sparkline row; the sparkline's dashed reference is unlabelled
when a caller passes one. Out of this wave (Wave 45, the record-page recipe): a decision card on S5 and S3.

Code review (agent-gateway, actionable): a leading invalid `at` making its own "—" day group, a caller `dayLabel` handed
an Invalid Date; improvements: scroll gating documented and applied to the windowed path, row helpers deduplicated,
memoised groups, a stable group key under a same-day prepend.

## r3 — the 390 opening, sorted days, honest empty values (#495 fixes, #497)

Fixed: the bounded box opens at the newest row at 390 (the r2 P1), "· 10 events" on the day header, day headers and
chips in the skeleton, rows sorted inside a day, "Session logged" gone, strip and aside empties as figures and em
dashes, one 30-day window, a labelled sparkline reference.

The r2 page P1 (blank page below the timeline at 390) is a `basalt-ui shot` defect, not the page: `hiddenScrollPx` grew
the viewport by the largest scroller at least half the viewport tall, and the timeline's 440 px box clears 844/2 at 390
(not 900/2 at 1440). Fixed in the harness (w44-shot).

Regressed: the S3 empty state lost its why-line and kept the bounded box's height around it (both P1; the second from my
r1 instruction to keep `height` in every state, now reversed for empty). Still failing, basalt: no § 6.11 tile on the
empty, no hover step on "Show earlier" (carried since r1), the time 430–650 px from a short sentence at 1440, a bare
"—" for an untimed row, a 6.4 px avatar initial (P1, detect). Playground: two wordings and three buttons for one empty
gap, the topic unnamed at rest, "Practice partners: 5 partners".

Out of this wave: the Sparkline hover readout printing over its reference label ("12 wk 2 sessions · 4 Sept"), Wave 46.

Code review (agent-gateway, actionable): the growth hysteresis reset by a loading commit, a late `document.fonts.ready`
re-scrolling after the user scrolled. Decision: the hysteresis is removed (mode = count > 200), not patched.

## r4 — the empty tile, one statement per gap, the shot harness (#495 fixes, #498, #499)

Fixed: the § 6.11 empty (tile, title, why-line, one action) sized to its content in a bounded box, the 6.4 px avatar
initial, no time for an untimed row, the topic named at rest, one wording for the empty gap, "Practice partners 5".
The S3 page at 390 is now measured at its real 2,026 px (the harness fix, #499; S1's `_page` also lost 320 px of blank
that came from the sidebar's scroll box). No P1 on S3.

Still failing: the S5 note ellipsized on the meta line at 390 to keep the rating chip on it (P1, new); the time 120–390
px from a short sentence at 1440 (carried since r2 through two measure caps); the skeleton's three-line row at 390;
"Show earlier" ~9 px in from the column edge; the S5 summary empty without its action (playground).

Decision (D52): the time leads the meta line at every width instead of being pinned right — the § 6.7 "time pinned
right" is amended. Four rounds of reviewers read a right-pinned time as a value far from its name in a wide row; Keel
keeps the time beside the sentence. It also removes the narrow-container switch.

Ruled, not defects: "Show earlier" has no hover step in the hover crop — `basalt-ui shot` hovers the anchor's centre or a
`[data-shot-hover]` element, not the list's button; a layout test proves the computed hover change. The day count
("· 10 events") counts the day, including rows scrolled out of view. A half row under the sticky header at 390 is a
scroll position.

Code review (agent-gateway): clean; taken anyway — disjoint windowed key namespaces, the windowing restore cancelled by
user input, no open-at-end jump when an oldest-first list crosses 200 on an "earlier" load, an SSR-safe default clock.

## r5 — the time beside its sentence (#495 fixes, #500)

D52 landed: the time leads the meta line at every width, so it sits under the sentence's start at 1440 and 390; the meta
line wraps (no ellipsis); two-line skeletons; "Show earlier" on the column edge; the S5 summary empty has its one
action. No P0–P2 on either route.

Open, P3: a long note pushes the rating chip to a third line at 390 (§ 7 lets chips wrap); the S3 skeleton bars run wider
than the loaded content at 1440 (fixed before merge); the S5 summary empty keeps the headline size instead of the § 6.11
title (playground; the record-page recipe, Wave 45).

Code review (agent-gateway): one blocking timing defect in the 200-row crossing restore (a frame budget could clear the
anchor before a slow lazy chunk mounted the seam). Decision: that restore, its seam prop and its measured row estimate
are deleted rather than fixed; crossing 200 rows keeps the scroll root and its offset and may land a few rows off.

## r6 — the merged tree (#495 final)

The tree that merged: the crossing restore deleted, the held height released after the handoff, skeleton bars capped
at the loaded width, the empty state a `role="status"` region. `shot detect` 100; the lead checked the S3 loading and
the S5 journal at 390 (no reviewer pair: the deltas since r5 are the skeleton width and code with no visual effect).
Open, P3: rating chips flush to the right edge at 390 on long notes.
