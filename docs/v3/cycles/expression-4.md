# Expression cycle 4

Six one-shot trials on master after the cycle 3 fix rows landed. They are scored against `docs/v3/expression/rubric.md` and, for the two `c` cases, against the reference shots. Protocol: `docs/v3/EXPRESSION.md`.

No case passed in round 0. The round-0 median is 65 and the minimum 59. On the F and K items alone, the trend measure against cycles 1 and 2, the median is 65.5 and the minimum 62. There is no P1 and there are 16 P2s, so the area has not converged. Both referenced cases ended `build` or `tie` in round 0, but the bank held only two, so the referenced clause of convergence cannot be met in full.

Repair rounds lifted the median to 76.5, and two cases passed in round 1: c14 at 87 and c15 at 81. n09 reached 81 on the F and K items in round 2.

The cycle 3 fix rows show. Every builder opened its own frames, no box collapsed in loading, and no build lost a point to the locale or to a list that could not join a chart's focus.

What is left is mostly `skill`, 66 of 110 points. Four of those trace to the shipped text itself, among them an example that announces every step twice.

The kit cost 37 points, and one defect accounts for 11 of them. A fill chart inside a `ChartCard` stays 320 px tall whatever the card's box is: at 390 px it overflows the 192 px box by 128 px, and at 1800 px it leaves an empty band under the legend.

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `4c991fd87ae91dad83b2d132f1450801e10499e8`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Date       | 2026-11-16                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cases      | c14, c15 (referenced) and n04, n09, n13, n16 (native)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel. Each was fenced to `packages/basalt-ui/agent/**`, `llms.txt`, the published types and docs, and the playground's own code, minus every other `scenarios/expr/` directory. Each built and shot its own route. The prompt is cycle 3's with the paths bumped and the lint line set to the playground's app preset (`--deny-warnings`)                                                                    |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                                                                                                                |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                                                                                                                                                                                                                              |
| Shots      | `.evidence/v3-shots/expression-4/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored). Each round has the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, a keyboard frame `--focus--` and a pointer-sweep frame `--sweep-gap--`, each light and dark at 1800x1200 and 390x844, and `r<round>/shoot-log.txt`. Source snapshots are in `src-r<round>/`, builder reports in `builder-reports/`, reviews in `reports/` |

### Before round 0

- **TuffUI.** One commit since the benchmark read, `589cbb0` on 2026-11-13, which cycle 3 already turned into c15 (`gh api repos/yurigdesigner/tuffui/commits?since=2026-11-13`). No new visualization, so the cycle ran c14 and c15 with four native cases.
- **(a) Tailwind sources.** The playground's `index.css` lists `src/ui`, `cards`, `charts`, `content`, `core`, `controls`, `page`, `shell` and `table`. The charts line landed with `v3-expr-3-kit-fixes`, and every package folder a scenario reached is listed. No loading, empty or error box collapsed this cycle.
- **(b) The skill's frames.** basalt-design and basalt-charts step 6 name every frame to open, including one keyboard frame after two arrow presses. Every builder opened its own frames. None opened all of them in round 0. Two of six (n04, n13) wrote a throwaway script to shoot a keyboard frame, because `shots.ts` presses no keys and nothing shipped does either. The other four reported they could not shoot one.
- **(c) The repo's gate.** `make check-fast` ran on the round-0 tree before scoring. The static gate passed: fmt, lint, typecheck, check-theme, budgets, literals, recipes-lint and playground-lint. The unit step was still queued for a host test slot when round 1 started, so the lead stopped that run by pid. The gate ran again on the final tree (§ After the rounds).
- **(d) `VX`.** A lead probe (`probe-vx.ts`) resolved every `var(--vx-*)` the public `VX` object names, 25 of them, on a playground page in light and dark. None was unset. `f6da6a54` removed the dangling members. The signal cycle 3 filed was matched to issue 1539, which is closed.
- **The fix rows.** `v3-expr-3-skill` (1552), `-kit-fixes` (1553), `-contract` (1554) and `-rubric` (1555) were all done. So this cycle had `focus` on `DataTable` and `BarList`, a band tick step and the evidence rules for K3 and X4.

### The shoot

- **Keyboard frame and pointer sweep.** The rubric row (`8f94ca2c`) asks the shoot for both. Neither is in `shots.ts`. A lead tool (`.evidence/v3-shots/expression-4/lead-shots.ts`, not in git) records both:
  - the keyboard frame: focus the first tabbable data element in `<main>`, log the `aria-live` text before any key, after one ArrowRight and after two, then shoot;
  - the sweep: find two adjacent marks (the chart's SVG shapes first, else the kit's `data-chart-mark` rows, side by side or stacked), rest on one, move to the middle of the gap, shoot 60 ms later, move on to the other, and log the dim state at each stop.

  Its counters see opacity dims only. A chart that dims by colour, which is most engine charts, shows its dim state in the frame alone, and reviewers were told so. n09 in round 0 had no marks, so it had no sweep.

- **The page band.** Every trial page has a title-only `PageBar`, and every one starts its content 61 px below the header. That is `page-main`'s inset (`packages/basalt-ui/src/page/page.tsx:143`, `72af0bbf`), kept so content starts at one height on every page. Reviewers marked it as dead space, so round-1 and round-2 builders were told to leave it. `v3-dogfood-2-visual` (2) owns it.
- **Fence.** No slip was reported or seen. Builders read their own reviewer's report from `.evidence/` in the repair rounds, which the repair message allowed.

### After the rounds

`make check-fast` ran on the final tree, with every builder done, and passed (rc 0). That covers the static gate, the unit suite in a host slot, the coverage and doc-drift gates and the pack-test. The layout step picked no file, because none of the 26 changed files reaches a layout test, so CI runs the full suite. Two builders' last edits were a token swap and a plural that they gated but did not re-shoot (n09, n13). The shots of their last round are from just before those edits.

## Numbers

| Number                         | c14                                | c15                            | n04          | n09          | n13          | n16          | Summary                       |
| ------------------------------ | ---------------------------------- | ------------------------------ | ------------ | ------------ | ------------ | ------------ | ----------------------------- |
| First-try score (round 0)      | 78                                 | 72                             | 63           | 59           | 65           | 65           | median 65, minimum 59         |
| First-try score, F and K only  | 79                                 | 71                             | 62           | 64           | 67           | 64           | median 65.5, minimum 62       |
| Round 1 score (F and K)        | 87 (88)                            | 81 (86)                        | 67 (64)      | 67 (67)      | 77 (79)      | 77 (79)      | median 77 (79)                |
| Round 2 score (F and K)        | passed                             | passed                         | 72 (71)      | 79 (81)      | 74 (74)      | 65 (67)      | last-round median 76.5 (77.5) |
| Rounds-to-pass (F and K)       | 1 (1)                              | 1 (1)                          | 3 (3)        | 3 (2)        | 3 (3)        | 3 (3)        | mean 2.33 (2.17)              |
| Verdict, round 0               | tie                                | build                          | n/a          | n/a          | n/a          | n/a          | build 1, tie 1, reference 0   |
| Verdict, round 1               | build                              | build                          | n/a          | n/a          | n/a          | n/a          |                               |
| Glue lines, round 0            | ~70                                | ~45                            | ~85          | ~14          | ~30          | ~14          | median 37.5                   |
| Glue lines, last round         | ~85                                | ~70                            | ~105         | ~34          | ~60          | ~25          | median 65                     |
| Escape hatches, round 0        | 3 `as CSSProperties`, 1 `as const` | 1 `as const`                   | 1 `as const` | 1 `as const` | 2 `as const` | 5 `as const` | hand `<svg>` 0 of 6           |
| Escape hatches, last round     | 3 `as CSSProperties`, 3 `as const` | none; a key handler of its own | 2 `as const` | 5 `as const` | 2 `as const` | 6 `as const` | hand `<svg>` 0 of 6           |
| Devices used unasked (round 0) | 6                                  | 9                              | 4            | 4            | 5            | 6            | median 5.5 of 12              |

c14 and c15 passed in round 1, so they had no round 2. Their last round is round 1.

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines. It excludes the fixture. n16 counted about 100 lines of fixture statistics, which are left out here. Three things made glue grow in the repair rounds:

- n04 measured the card box to work around the fill chart and drew its windows and labels as engine `rect` and `text` marks.
- c15 drew its candidate box as a `rect` mark and wrote its own arrow-key handler.
- n09 drew a log time axis with hand-named ticks and `text` labels.

No build used a lint disable, `theme-allow`, a deep import or a hand-written `<svg>`. Every `as const` is a const assertion.

c14's three `as CSSProperties` casts carry CSS custom properties for its seam-drawn bar fills, because the app preset forbids an inline `width` and any non-literal style object. c15's round-1 key handler wraps the chart in a `div` that calls `focus.step` and `focus.set` itself (finding .20).

Devices reached in round 0, out of six builds: hero number 6, keyboard parity 6, anatomy 5, baseline delta 4, colour budget 3, dim-the-rest 3, direct labels 3, threshold geometry 3, pre-annotation 1, metaphor 0, quantized marks 0, live cue 0. Against cycle 3, hero number rose from 3 to 6, anatomy from 3 to 5 and baseline delta from 2 to 4. Dim-the-rest fell from 6 to 3: three builds were a table (n09), a line chart whose bars could not be drawn (n04), or a focus over the wrong array (n16).

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The rows of cycles 3 and 4 give both, with F and K first.

| Cycle | Sha        | First-try median    | Minimum     | Last-round median     | Rounds-to-pass, mean  | Verdicts (build, tie, reference) | P1  | P2  | Glue median, round 0 to last | Hand `<svg>`, last round |
| ----- | ---------- | ------------------- | ----------- | --------------------- | --------------------- | -------------------------------- | --- | --- | ---------------------------- | ------------------------ |
| 1     | `062367fe` | 68                  | 64          | 78.5                  | 2.17                  | 3, 2, 0                          | 0   | 16  | 62.5 to 195                  | 1 of 6                   |
| 2     | `ac6acc90` | 66.5                | 48          | 78.5                  | 2.17                  | 3, 1, 0                          | 0   | 17  | 50 to 67.5                   | 0 of 6                   |
| 3     | `2ad50570` | 65.5 (all items 62) | 57 (all 54) | 72.5 (all items 71)   | 2.83 (all items 3)    | 4, 0, 0                          | 0   | 28  | 18.5 to 34                   | 1 of 6                   |
| 4     | `4c991fd8` | 65.5 (all items 65) | 62 (all 59) | 77.5 (all items 76.5) | 2.17 (all items 2.33) | 1, 1, 0 (two referenced)         | 0   | 16  | 37.5 to 65                   | 0 of 6                   |

The first-try median has not moved in three cycles on the F and K items. The minimum rose by 5 on each measure, P2s fell from 28 to 16, and repair rounds got further: two cases passed in round 1, against none in cycle 3.

## Cases

### c14: who leads a live eval (reference: eval-race)

- **Round 0, 78, tie.** One card, five rows on a 0 to 400 track with passed and failed segments, and a hero "Dryad leads +1.9 pts vs Cinder". Rows are ranked by pass rate while the bars show cases done. In error the card kept the stale hero, and the 390 readout ellipsized. Shots `r0/scenarios-expr-c14*`.
- **Round 1, 87, build.** A subtitle naming the order, captions, a context line, the card fitted to its rows, and the error figure hidden by hand. The reviewer judged that the headline and one shared axis answer who leads faster than the reference's racetrack and table read together.

### c15: senders to leave (reference: inbox-cleanup)

- **Round 0, 72, build.** A log-x scatter of mails a week against open rate, a candidate zone, a hero of mail saved a week and a linked list. One of 12 candidates was named, the zone had no x bound, ArrowRight did not move past the first item, and the plot did not fill its card. Shots `r0/scenarios-expr-c15*`.
- **Round 1, 81, build.** A candidate box drawn as a `rect` mark and bounded at 5 a week, the top three named, a pill that follows focus, and its own arrow-key handler. Each step is still announced twice, because the page renders `focus.live` beside a chart that renders it too.

### n04: when to ride (native)

- **Round 0, 63.** Rain and wind as shares of the rider's limit with one 100 % rule, ride windows as bands, a hero "Ride Tue 07–17" and a linked window list. The windows carried no label, nothing dimmed, the announcement leaked a group key, and loading was 80 px short. Shots `r0/scenarios-expr-n04*`.
- **Round 1, 67.** Window labels, end labels and a "+3 h" pill. At 390 the labels collided.
- **Round 2, 72.** One accent, ink lines and a single "Best 10 h" label. The lines still cannot dim, and loading is still short, both from the kit.

### n09: what runs next (native)

- **Round 0, 59.** A stat strip over a `DataTable` grouped into Next 24 hours and Later. There was no time axis, no dim and no readout, and a Window column repeated each group header. Shots `r0/scenarios-expr-n09*`.
- **Round 1, 67.** A log time axis with a 24 h rule beside the table, sharing one focus, with the accent on the next run.
- **Round 2, 79 (81 on F and K).** The next run and the counts on either side of the rule labelled on the plot, and no tooltip. The y axis is still a run order, and loading is about 180 px short.

### n13: recurring charges (native)

- **Round 0, 65.** A total with a sparkline, change per charge as bars with a linked table, and a summary sentence. Four of 18 bars were named, the table was stacked under the cards, the money deltas read "+50€", and each step was announced twice. Shots `r0/scenarios-expr-n13*`.
- **Round 1, 77.** The top risers named on their bars, the table beside the cards, and rise and fall in red and green.
- **Round 2, 74.** Small rises drawn neutral and value-only labels. The bars no longer carry a payee, and the 20 % split is not explained on the page.

### n16: a cut's progress (native)

- **Round 0, 65.** A strip of rate, lean share and distance to goal over two charts: weight against plan, and fat and lean change. A pointer drove nothing, because the focus was built over the weigh-in days only. Loading dropped 56 px in the strip, and at 390 the weight plot lost its axis, legend and goal. Shots `r0/scenarios-expr-n16*`.
- **Round 1, 77.** The focus over every day, every declaration kept in loading, a fat-card pill and a one-shape announcement.
- **Round 2, 65.** Shorter hero text at 390 and dashed loading footers. A new reviewer scored F7 and X3 a point lower than round 1's: nothing dims, and the second chart's readout does not follow. The builder fixed neither in round 2, judging both kit-owned.

## Round-0 item scores

| Item                 | c14   | c15   | n04   | n09   | n13   | n16   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 2     | 3     | 2     | 1     | 2     | 3     |
| F2 Answer at rest    | 2     | 2     | 2     | 2     | 2     | 2     |
| F3 Baseline          | 3     | 3     | 2     | n/a   | 3     | 3     |
| F4 Colour budget     | 3     | 3     | 2     | 2     | 2     | 2     |
| F5 Honest marks      | 2     | 2     | 2     | 3     | 2     | 2     |
| F6 Labels            | 2     | 1     | 1     | 2     | 1     | 2     |
| F7 Focus and readout | 2     | 2     | 2     | 1     | 2     | 1     |
| F8 Anatomy           | 2     | 2     | 2     | 2     | 2     | 2     |
| K1 Scales            | 3     | 2     | 2     | 3     | 2     | 1     |
| K2 States            | 2     | 2     | 2     | 2     | 1     | 1     |
| K3 Keyboard          | 2     | 2     | 2     | 1     | 2     | 2     |
| K4 Tokens            | 3     | 2     | 2     | 2     | 3     | 3     |
| K5 Responsive        | 2     | 2     | 2     | 2     | 2     | 2     |
| K6 First paint       | 3     | 2     | 1     | 2     | 2     | 1     |
| X1 Word economy      | 2     | 2     | 2     | 1     | 2     | 2     |
| X2 One view          | 2     | 2     | 2     | 2     | 1     | 2     |
| X3 Linked parts      | n/a   | 2     | 2     | n/a   | 2     | 2     |
| X4 Calm interaction  | 3     | 3     | 2     | 1     | 2     | 2     |
| X5 Console anatomy   | 2     | 2     | 2     | 1     | 2     | 2     |
| Sum / max            | 42/54 | 41/57 | 36/57 | 30/51 | 37/57 | 37/57 |
| F and K sum / max    | 33/42 | 30/42 | 26/42 | 25/39 | 28/42 | 27/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`, which later rounds rewrote. No item scored 0. F2, F8 and K5 lost a point in all six builds.

## Findings

Severity follows the rubric. A 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, a 2 is P3, and an X item counts like an F item. Round 0 has no 0, so no P1.

Points lost in round 0 by class: `skill` 66, `primitive` 37, `rubric` 4 and `planned` 3, for a total of 110. No point is `doctrine` or `case`. By severity there are 16 P2 (11 `skill`, 4 `primitive`, 1 `rubric`) and 78 P3.

Where findings are fixed:

- `skill (n)` is change (n) of `v3-expr-4-skill`.
- `kit (n)` is change (n) of `v3-expr-4-kit-fixes`.
- `contract (x)` is item (x) of `v3-expr-4-contract`.
- `rubric (n)` is change (n) of `v3-expr-4-rubric`.
- A `planned` finding is a note on the row that owns it.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                                             | Fix                           |
| --------------- | ---------- | ---- | --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| expression-4.1  | c14 F1     | 1    | P3  | skill     | Rows ranked by pass rate, bar length is cases done: the leader (204 done) is the third-shortest bar (`ExprC14.tsx:138`, `fixture.ts:66`). The builder found "leader" undefined when models are at different progress                 | skill (5)                     |
| expression-4.2  | c14 F2     | 1    | P3  | skill     | No aggregate progress figure and no word on the leader's bar (`:98-107`)                                                                                                                                                             | skill (3)                     |
| expression-4.3  | c14 F5     | 1    | P3  | skill     | The done column and the 0..400 axis carry no unit caption; "cases" only in the aria label (`:135`)                                                                                                                                   | skill (10)                    |
| expression-4.4  | c14 F6     | 1    | P3  | skill     | The rate label sits at the end of the done-length bar and reads as its length; at 390 "88.0%" straddles the fill boundary (`r0/…c14-fixture-done--light--390x844`)                                                                   | skill (3)                     |
| expression-4.5  | c14 F7     | 1    | P3  | primitive | The focus readout ellipsizes at 390: "Boreal 7…", "227 of 400 …" (`r0/…c14--focus--light--390x844`)                                                                                                                                  | kit (2)                       |
| expression-4.6  | c14 F8     | 1    | P3  | skill     | No context line under the title, no live cue; "Fewest done Cinder" without its count. The builder dropped a `Live` status because it pushed the hero out at 390                                                                      | skill (6)                     |
| expression-4.7  | c14 K2     | 1    | P3  | planned   | In error the card keeps the stale hero "Dryad leads +1.9 pts vs Cinder" and footer above "Could not load this." (`r0/…c14-shot-state-error--light--1800x1200`)                                                                       | note on `v3-dogfood-2-state`  |
| expression-4.8  | c14 K3     | 1    | P3  | primitive | The one-tab-stop ring of the seam row list cuts through the first letters of the names (`r0/…c14--focus--light--1800x1200`)                                                                                                          | kit (9)                       |
| expression-4.9  | c14 K5     | 1    | P3  | primitive | The tie headline ellipsizes at 390: "Boreal and A…", "vs …" (`r0/…c14-fixture-tie--light--390x844`)                                                                                                                                  | kit (2)                       |
| expression-4.10 | c14 X1     | 1    | P3  | skill     | "Suite 400 cases" restates the axis maximum; "Fewest done" repeats the done column                                                                                                                                                   | skill (7)                     |
| expression-4.11 | c14 X2     | 1    | P3  | skill     | Five rows use about 220 of a 510 px chart region at 1800                                                                                                                                                                             | skill (9)                     |
| expression-4.12 | c14 X5     | 1    | P3  | skill     | No context line, no monospace on model ids (`:88-92`, `:148-151`)                                                                                                                                                                    | skill (6)                     |
| expression-4.13 | c15 F2     | 1    | P3  | skill     | One annotation, a bare name with no figure; the 12 candidates are not named on the chart (`ExprC15.tsx:181-198`)                                                                                                                     | skill (3)                     |
| expression-4.14 | c15 F5     | 1    | P3  | primitive | The candidate zone is a full-width y band with no x bound, so 0.5 to 2 a week senders sit inside it as Keep dots (`:149`, `r0/…c15--light--1800x1200`): `ChartZone` is a y range only                                                | contract (b)                  |
| expression-4.15 | c15 F6     | 2    | P2  | primitive | One of 12 candidates named (`.slice(0, 1)`, `:185-186`); at 390 the label sits on the cluster (`r0/…c15--light--390x844`). `ChartPlot` gives a custom mark no scale, so `chartLabels.place` cannot run (wish list)                   | contract (a)                  |
| expression-4.16 | c15 F7     | 1    | P3  | skill     | The pill stays "-65%" beside one sender's "31" under focus (`:109-117`)                                                                                                                                                              | skill (3)                     |
| expression-4.17 | c15 F8     | 1    | P3  | primitive | A dead band of about 55 px under the legend: the fill chart stays 320 px in a 380 px box (lead probe `probe-fill.ts`)                                                                                                                | kit (1)                       |
| expression-4.18 | c15 K1     | 1    | P3  | primitive | At 390 the extreme label overlaps the dot cluster, placed in data space with no pixel position (`r0/…c15-fixture-extreme--light--390x844`)                                                                                           | contract (a)                  |
| expression-4.19 | c15 K2     | 1    | P3  | planned   | Empty and error draw a bare "—" figure, the empty sentence twice, a generic error title (`r0/…c15-shot-state-empty--light--1800x1200`)                                                                                               | note on `v3-dogfood-2-state`  |
| expression-4.20 | c15 K3     | 1    | P3  | primitive | ArrowRight stays on dealdrop.example for five presses while ArrowLeft walks the data (lead probe `probe-keys.ts`); the data is sorted by descending x. Its builder wrote its own key handler in round 1                              | kit (4)                       |
| expression-4.21 | c15 K4     | 1    | P3  | skill     | Footer values and the pill are plain strings without tabular numerals (`:113`, `:125-126`)                                                                                                                                           | skill (6)                     |
| expression-4.22 | c15 K5     | 1    | P3  | primitive | Under focus the hero ellipsizes to "31…" and the readout to "dealdrop.example, 0% …" at 390 (`r0/…c15--focus--light--390x844`)                                                                                                       | kit (2)                       |
| expression-4.23 | c15 K6     | 1    | P3  | primitive | The plot does not fill its box (the dead band of .17)                                                                                                                                                                                | kit (1)                       |
| expression-4.24 | c15 X1     | 1    | P3  | skill     | The saving three ways: "muting 12 senders", "-65% of all mail", "After muting 113" (`:89`, `:113`, `:126`)                                                                                                                           | skill (7)                     |
| expression-4.25 | c15 X2     | 1    | P3  | primitive | The fixed 544 px footprint the builder set to stop the 390 clip leaves the lower 45 % of the viewport empty (`:19`, `:96`)                                                                                                           | kit (1)                       |
| expression-4.26 | c15 X3     | 1    | P3  | primitive | At the gap the engine tooltip names buildstatus while the held focus and the hero name pizzaclub (`r0/…c15--sweep-gap--light--1800x1200`)                                                                                            | kit (11)                      |
| expression-4.27 | c15 X5     | 1    | P3  | skill     | Sender names mono in the list, sans in the chart label and hero readout (`:118`, `:190`)                                                                                                                                             | skill (6)                     |
| expression-4.28 | n04 F1     | 1    | P3  | skill     | The answer is a faint band; the two lines carry the detail (`r0/…n04--light--1800x1200`)                                                                                                                                             | skill (3)                     |
| expression-4.29 | n04 F2     | 1    | P3  | primitive | The best window is a 0.2 band against 0.1, unlabelled; the windows are hand-drawn `rect` marks because `ChartZone` takes no x range (`ExprN04.tsx:240-241`, wish list)                                                               | contract (b)                  |
| expression-4.30 | n04 F3     | 1    | P3  | skill     | The hero has no comparison, and the status shows only on focus (`:107`)                                                                                                                                                              | skill (6)                     |
| expression-4.31 | n04 F4     | 1    | P3  | skill     | Teal rain, amber wind and a blue band: three hues, and amber reads as a warning                                                                                                                                                      | skill (8)                     |
| expression-4.32 | n04 F5     | 1    | P3  | skill     | The 0 to 200 % axis carries no "of your limit" caption; the builder's 200 % cap piles the storm extreme on the ceiling (`:16`, `:181`)                                                                                               | skill (10)                    |
| expression-4.33 | n04 F6     | 2    | P2  | skill     | Series named only in the legend, windows unlabelled; the storm hero clips at 390 ("No ride wind…")                                                                                                                                   | skill (3)                     |
| expression-4.34 | n04 F7     | 1    | P3  | primitive | Nothing dims on focus (`SWEEP` data-dimmed 0): rain is a step line because `rect` marks vanished once a bar series shared the axis, and a line has no per-hour dim (builder report)                                                  | kit (6)                       |
| expression-4.35 | n04 F8     | 1    | P3  | skill     | No delta pill and no status at rest; the footer restates the list's count                                                                                                                                                            | skill (6)                     |
| expression-4.36 | n04 K1     | 1    | P3  | skill     | In `still` teal hides under amber at 0; in `storm` values past the builder's 200 % cap pile up as triangles                                                                                                                          | skill (10)                    |
| expression-4.37 | n04 K2     | 1    | P3  | primitive | Loading is 80 px shorter than loaded: the builder measured the card box to work around the fill chart and mounts the chart after measuring (`:47-62`)                                                                                | kit (1)                       |
| expression-4.38 | n04 K3     | 1    | P3  | primitive | The announcement leaks the group key: "skip-0: Mon 14:00 …" (shoot log `KEY`; `group` at `:81`)                                                                                                                                      | kit (5)                       |
| expression-4.39 | n04 K4     | 1    | P3  | primitive | `LEGEND_ROW = 24` and a 320 px body: magic pixels of the box workaround (`:41`, `:139`)                                                                                                                                              | kit (1)                       |
| expression-4.40 | n04 K5     | 1    | P3  | primitive | The storm hero and period ellipsize at 390 (`r0/…n04-fixture-storm--light--390x844`)                                                                                                                                                 | kit (2)                       |
| expression-4.41 | n04 K6     | 2    | P2  | primitive | An 80 px jump from loading to loaded, and the chart mounts after measuring (`:59`), both from the box workaround                                                                                                                     | kit (1)                       |
| expression-4.42 | n04 X1     | 1    | P3  | skill     | Title, panel title and subtitle say "ride windows" three ways; the hero repeats the first list row                                                                                                                                   | skill (7)                     |
| expression-4.43 | n04 X2     | 1    | P3  | skill     | A 320 px list body for four rows (`:139`)                                                                                                                                                                                            | skill (9)                     |
| expression-4.44 | n04 X3     | 1    | P3  | rubric    | Wired both ways in source (`:81`, `:149-150`), but the keyboard and sweep frames land on skip hours no row shows, and no frame focuses a row                                                                                         | rubric (2)                    |
| expression-4.45 | n04 X4     | 1    | P3  | primitive | No dim state on the pointer path, for the cause of .34                                                                                                                                                                               | kit (6)                       |
| expression-4.46 | n04 X5     | 1    | P3  | skill     | No delta pill; the status pill only on focus                                                                                                                                                                                         | skill (6)                     |
| expression-4.47 | n09 F1     | 2    | P2  | skill     | A stat strip over a grouped `DataTable` (`ExprN09.tsx:49-59`): a question of when with no time axis. Round 1 drew one with the kit in about 22 glue lines                                                                            | skill (5)                     |
| expression-4.48 | n09 F2     | 1    | P3  | skill     | The next job's row carries no mark                                                                                                                                                                                                   | skill (3)                     |
| expression-4.49 | n09 F4     | 1    | P3  | skill     | The accent is not spent on the 24 h boundary or the next run                                                                                                                                                                         | skill (8)                     |
| expression-4.50 | n09 F6     | 1    | P3  | primitive | A Window column repeats each group header ten and five times: `group.by` must name a visible column (`use-data-table.js:265`)                                                                                                        | kit (8)                       |
| expression-4.51 | n09 F7     | 2    | P2  | skill     | No dim and no readout: a ring on one row (`r0/…n09--focus--light--1800x1200`); follows from the form                                                                                                                                 | skill (5)                     |
| expression-4.52 | n09 F8     | 1    | P3  | skill     | No card header; the table sits flush under the strip                                                                                                                                                                                 | skill (6)                     |
| expression-4.53 | n09 K2     | 1    | P3  | primitive | Loading is shorter than loaded: the strip by 16 px and the table skeleton by about 80 px (`r0/…n09-shot-state-loading--light--1800x1200`)                                                                                            | kit (3)                       |
| expression-4.54 | n09 K3     | 2    | P2  | rubric    | The log shows no announcement after ArrowRight: the frame pressed ArrowRight on a table row, which moves with ArrowDown and is read natively, not through `aria-live`                                                                | rubric (1)                    |
| expression-4.55 | n09 K4     | 1    | P3  | skill     | `width: 22`, an unlabelled number (`:20`)                                                                                                                                                                                            | skill (6)                     |
| expression-4.56 | n09 K5     | 1    | P3  | primitive | `card: 'hidden'` on the Window column did not hide it on the phone cards (`:25`, `r0/…n09--light--390x844`)                                                                                                                          | kit (8)                       |
| expression-4.57 | n09 K6     | 1    | P3  | planned   | A 77 px blank band above the strip (`r0/…n09--light--1800x1200`, y 48 to 125): the page's band inset for a title-only `PageBar`                                                                                                      | note on `v3-dogfood-2-visual` |
| expression-4.58 | n09 X1     | 2    | P2  | skill     | The group header repeats the strip's "10 jobs"; Next run and At print one moment twice; a sentence where "0" says it (`:98`)                                                                                                         | skill (7)                     |
| expression-4.59 | n09 X2     | 1    | P3  | skill     | The 24 h split is a group row only, and about 400 px stay empty under the list                                                                                                                                                       | skill (9)                     |
| expression-4.60 | n09 X4     | 2    | P2  | skill     | No sweep and no dimmed rest: a table with no linked chart                                                                                                                                                                            | skill (5)                     |
| expression-4.61 | n09 X5     | 2    | P2  | skill     | No card header, no pill, no footer pairs; repos and timestamps in the sans face                                                                                                                                                      | skill (6)                     |
| expression-4.62 | n13 F1     | 1    | P3  | skill     | The commitment is one number, not split by category or interval                                                                                                                                                                      | skill (5)                     |
| expression-4.63 | n13 F2     | 1    | P3  | skill     | The top risers are unnamed bars; the builder removed names (`ExprN13.tsx:143`) where `x.ticks` as a list names exactly the bands given                                                                                               | skill (3)                     |
| expression-4.64 | n13 F4     | 1    | P3  | skill     | Every bar is brand blue, the falling one too, while the table pills are red and green (`:13`)                                                                                                                                        | skill (8)                     |
| expression-4.65 | n13 F5     | 1    | P3  | primitive | `c.delta` with money prints "+50€", "+5.66€", "0€" beside "€" prefixes (`r0/…n13--light--1800x1200`)                                                                                                                                 | kit (7)                       |
| expression-4.66 | n13 F6     | 2    | P2  | skill     | 18 bars with 4 to 6 axis names and none on the bars (`r0/…n13--light--390x844`), as .63                                                                                                                                              | skill (3)                     |
| expression-4.67 | n13 F7     | 1    | P3  | skill     | The tooltip repeats the readout with two "Change per month" rows (series format plus tooltip rows, `:166`, `:171-174`)                                                                                                               | skill (7)                     |
| expression-4.68 | n13 F8     | 1    | P3  | skill     | The chart card has no pill and no footer pairs                                                                                                                                                                                       | skill (6)                     |
| expression-4.69 | n13 K1     | 1    | P3  | primitive | The extreme hero ellipsizes at 390: "€2,907.…" (`r0/…n13-fixture-extreme--light--390x844`)                                                                                                                                           | kit (2)                       |
| expression-4.70 | n13 K2     | 2    | P2  | primitive | Loading: StatCard 183 against 235 px, chart card 243 against 288, table 6 skeleton rows against 18 (`r0/…n13-shot-state-loading--light--1800x1200`). Error keeps a summary skeleton (`v3-wiring-3-api` (2) owns `PageSummary` phase) | kit (3)                       |
| expression-4.71 | n13 K3     | 1    | P3  | skill     | Every step announced twice ("X \| X"): the page rendered `{focus.live}` beside a chart that renders it, as `references/linked-parts.md` shows                                                                                        | skill (1)                     |
| expression-4.72 | n13 K5     | 1    | P3  | primitive | The hero clips at 390 in the extreme fixture, as .69                                                                                                                                                                                 | kit (2)                       |
| expression-4.73 | n13 K6     | 1    | P3  | primitive | The page jumps on load, for the cause of .70                                                                                                                                                                                         | kit (3)                       |
| expression-4.74 | n13 X1     | 1    | P3  | skill     | "Since December" five times: pill, period, subtitle, column header, page title                                                                                                                                                       | skill (7)                     |
| expression-4.75 | n13 X2     | 2    | P2  | skill     | A card, a card and an 18-row table stacked, 600 px empty inside each row; the list does not sit beside the chart                                                                                                                     | skill (9)                     |
| expression-4.76 | n13 X3     | 1    | P3  | rubric    | Table to chart wired (`:181`); no frame focuses a row                                                                                                                                                                                | rubric (2)                    |
| expression-4.77 | n13 X4     | 1    | P3  | primitive | Dimmed bars are slate on near-black in dark (`r0/…n13--focus--dark--1800x1200`)                                                                                                                                                      | kit (10)                      |
| expression-4.78 | n13 X5     | 1    | P3  | skill     | The chart card's figure has no pill and no footer pairs                                                                                                                                                                              | skill (6)                     |
| expression-4.79 | n16 F2     | 1    | P3  | skill     | The gap between the mean and the plan line carries no word; only the goal rule is labelled (`ExprN16.tsx:229`)                                                                                                                       | skill (3)                     |
| expression-4.80 | n16 F4     | 1    | P3  | skill     | A red pill beside an amber "Behind plan" dot, one fact in two hues; the accent names the mean in one card and fat in the other                                                                                                       | skill (8)                     |
| expression-4.81 | n16 F5     | 1    | P3  | skill     | The stall fixture's y axis prints "0" four times (`signed(v, 0)`, `:280`)                                                                                                                                                            | skill (10)                    |
| expression-4.82 | n16 F6     | 1    | P3  | skill     | Series named only in the legend; "First reading" crossed by the lean line in `stall`                                                                                                                                                 | skill (3)                     |
| expression-4.83 | n16 F7     | 2    | P2  | skill     | A pointer dims nothing and the hero stays at 87.1 (`SWEEP` log): the focus was built over the weigh-in days, the chart drew every day, so a pointer on a gap day matched no item (round 1 report)                                    | skill (2)                     |
| expression-4.84 | n16 F8     | 1    | P3  | primitive | "7% of 4.8 kg lost" floats at the cell bottom, away from its value: a StatCell `sub` follows its neighbours' tracks                                                                                                                  | kit (12)                      |
| expression-4.85 | n16 K1     | 2    | P2  | primitive | At 390 `lean-loss` cuts the plot at about 85 kg, so the 80 kg extreme, the x axis and the legend are gone: the fill chart is 320 px in a 192 px box, 128 px past the clip (lead probe `probe-fill.ts`)                               | kit (1)                       |
| expression-4.86 | n16 K2     | 2    | P2  | skill     | Loading: strip 72 against 128 px, cards about 137 px short. The page dropped its declared rows, sub and footer outside `ready`; with them kept, round 1 matched at 792 px                                                            | skill (4)                     |
| expression-4.87 | n16 K3     | 1    | P3  | skill     | The announcement changes shape per press and omits the mean and the plan (`:59-61`)                                                                                                                                                  | skill (2)                     |
| expression-4.88 | n16 K5     | 1    | P3  | primitive | At 390 the weight plot has no x axis, legend or goal line, as .85                                                                                                                                                                    | kit (1)                       |
| expression-4.89 | n16 K6     | 2    | P2  | skill     | The 137 px jump on load, for the cause of .86                                                                                                                                                                                        | skill (4)                     |
| expression-4.90 | n16 X1     | 1    | P3  | skill     | "since first reading" four times (`:179`, `:268`, `:279`, `:285`)                                                                                                                                                                    | skill (7)                     |
| expression-4.91 | n16 X2     | 1    | P3  | primitive | A blank band under each legend (the fill chart of .85 at 1800) and the floating sub of .84                                                                                                                                           | kit (1)                       |
| expression-4.92 | n16 X3     | 1    | P3  | skill     | The fat card's figure and the strip do not follow the focus, for the cause of .83                                                                                                                                                    | skill (2)                     |
| expression-4.93 | n16 X4     | 1    | P3  | skill     | No dim state on the pointer path, for the cause of .83                                                                                                                                                                               | skill (2)                     |
| expression-4.94 | n16 X5     | 1    | P3  | skill     | The fat card's figure has no pill; the strip is flush; dates not monospace                                                                                                                                                           | skill (6)                     |

Notes on the classes:

- **`skill`.** Four defects are in the shipped text, each with its own change in `v3-expr-4-skill`:
  - `references/linked-parts.md` passes `focus` to a `CartesianChart`, which renders `focus.live` itself (`src/charts/parts/cartesian.tsx:472`), and then renders `{focus.live}` again. Both builders who followed it announce every step twice (c15, n13).
  - Nothing says a chart's focus is built over the array the chart draws. n16 built it over the weigh-in days while the chart drew every day, so a pointer on a gap day matched no item.
  - `x.ticks` as a list names exactly the bands given (`docs/cartesian-chart.md:90`), and no skill text points at it for naming the bars that matter. n13 left 14 of 18 bars unnamed.
  - A frame's skeleton draws what the part declares, and nothing says to keep declaring sub, rows, delta and footer outside `ready`. n16 dropped them in loading and lost 56 px in the strip. With them kept, round 1 matched the loaded height to the pixel.

  The rest are devices the skill names that builders skipped. Every one came back in one round when a finding named it:
  - n09 drew its time axis in about 22 lines;
  - c14 fitted its card to its rows;
  - n13 put its table beside the chart.

- **`primitive`.** One defect, the fill chart, costs 11 points in three builds (c15, n04, n16), made n13 pin its chart to 160 px, and caused about 20 glue lines in n04. The 390 figure that ellipsizes costs 6. Loading heights in `StatCard` and `DataTable` cost 4. The arrow order, the group announcement, the `rect` mark beside bars, the money delta, the hidden column, the seam ring, the dark dim, the gap tooltip and the StatCell sub are one-case defects in shipped behaviour. All of these fix inside components (`v3-expr-4-kit-fixes`). Two gaps add a field to `charts/contract.ts`, so they sit behind a Spec (`v3-expr-4-contract`):
  - a custom mark gets no pixel position for `chartLabels` (c15, P2 .15; n04, n16 in their repair rounds);
  - a zone takes no x range (c15, n04).
- **`rubric`.** The keyboard frame pressed ArrowRight on n09's table row, which moves with ArrowDown and is read from the focused row, not from an `aria-live` region. And no frame shows a list row driving the chart, so X3's second direction is never evidenced (n04, n13). `v3-expr-4-rubric` says how both are read and adds a list frame.
- **`planned`.** c14's stale hero in error and c15's bare figure dash and doubled empty sentence are `v3-dogfood-2-state` (1) and (2). n09's band above the content is `v3-dogfood-2-visual` (2). Each finding is a note on that row's brief.

The six trial builds add 2,368 lines under `apps/playground/src/scenarios/expr/`.

## Filing

| Row                     | Class                                                        | Covers                                                                                                                                                                  | Checkpoint | Gate                         |
| ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------- |
| `v3-expr-4-skill`       | skill (all 11 skill P2s; their P3s ride along)               | .1–.4, .6, .10–.13, .16, .21, .24, .27, .28, .30–.33, .35, .36, .42, .43, .46–.49, .51, .52, .55, .58–.64, .66–.68, .71, .74, .75, .78–.83, .86, .87, .89, .90, .92–.94 | none       | none: skill ships in a minor |
| `v3-expr-4-kit-fixes`   | primitive (P2s .41, .70, .85; no export, no contract change) | .5, .8, .9, .17, .20, .22, .23, .25, .26, .34, .37–.41, .45, .50, .53, .56, .65, .69, .70, .72, .73, .77, .84, .85, .88, .91                                            | none       | none                         |
| `v3-expr-4-contract`    | primitive (P2 .15; amends `charts/contract.ts`)              | .14, .15, .18, .29                                                                                                                                                      | spec       | none: additive               |
| `v3-expr-4-rubric`      | rubric (P2 .54)                                              | .44, .54, .76                                                                                                                                                           | none       | none                         |
| `v3-cycle-expression-5` | next cycle                                                   | n03, n07, n10, n14, n17, n18                                                                                                                                            | none       | none: no open P1             |
| notes                   | planned                                                      | .7, .19 on `v3-dogfood-2-state`; .57 on `v3-dogfood-2-visual`                                                                                                           |            |                              |

The primitive P2s file as two rows, as in cycles 2 and 3: fixes inside components, and a Spec for the fields a contract gains. The contract row changes `charts/contract.ts`, so it carries `checkpoint: spec`, seat opus high and a `chore: contract amendment` commit (`check-contract-frozen.ts`).

**The gate.** `v3-freeze-g4` closed as issue 1227 before cycle 3. EXPRESSION.md § Gate still names it, and cycle 3 put its primitive rows into `v3-ga-prep`, the open row before 3.0. That is the gate a `primitive` or `doctrine` P1 should hold now. This cycle has none, and both of its primitive rows join no gate:

- the kit row changes no contract;
- the contract row only adds optional fields (an x range on `ChartZone`, position functions on `ChartPlot`), which a 3.x minor may ship.

The contract row's Spec says whether the fields should gate 3.0 anyway. The stale gate name in EXPRESSION.md is raised with the owner as a Decision on this Issue, not edited here: that doc is outside this cycle's files.

**The bank.** Every referenced case has now run. Cycle 5 therefore runs six native cases (n03, n07, n10, n14 and the two added below), and its brief tells its lead to look for TuffUI components published after `589cbb0` first and run them as `c` cases.

Two cases were added to the bank, both from the factory console's Throughput page, which no case covered:

- n17, host memory pressure;
- n18, what queued Issues waited for.

Factory friction: none this cycle. `factory project plan` gave the open rows that `planned` needs, and `factory plan check` passed on the appended rows.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` findings are 66 of the 110 points lost in round 0, 60 %. No `planned` point is owned by a skill row. That meets the first half of the confirm column (half or more).

Repair rounds lifted the median from 65 to 76.5, by 11.5 points on all items. On the F and K items they lifted it from 65.5 to 77.5, by 12. Both lifts are under the 15 that confirms and over the 5 that kills, so the hypothesis stays open on the lift, as in cycles 2 and 3. The lift is the largest yet (cycle 3: 9 and 7), and two cases passed in round 1.

What capped it is the kit. In round 2, n04, n13 and n16 each left a finding open as kit-owned:

- the fill chart at 390;
- loading heights;
- lines that cannot dim.

n16 fell from 77 to 65 on a fresh reviewer's reading of those two gaps.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in any round, against three that would confirm.
- The round-0 median glue was 37.5 lines and the last-round median 65, both under 80.

Glue grew where the seam has no cut. c15 and n04 placed labels in data space because a custom mark gets no pixel position, and n04 and c15 drew x ranges as `rect` marks. Both are `v3-expr-4-contract`, and both match census V3's `scale` and `label-fit` helpers.

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for three forms:

- a two-segment progress bar and horizontal bars (c14);
- a category y axis (n09).

Each served one case, so each is a recipe at most, and the Rule of Three stands. The x-range zone two builds asked for is a field on an existing type, not a kind.

## Convergence

Not converged:

- The round-0 median is 65, under 80; on the F and K items it is 65.5.
- The minimum is 59, under 60; on the F and K items it is 62.
- Both referenced cases ended `build` or `tie` in round 0. With two in the cycle, the clause of three of four cannot be met in full.
- There are 16 P2s against a limit of three.

`v3-cycle-expression-5` is filed after the four fix rows.

owner:
