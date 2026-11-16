# Expression cycle 3

Six one-shot trials on master after the cycle 2 fix rows and the two teardowns landed. They are scored against `docs/v3/expression/rubric.md`, now with the X items, and for the `c` cases against the reference shots. Protocol: `docs/v3/EXPRESSION.md`.

No case passed. The round-0 median is 62 and the minimum 54. On the F and K items alone, the trend measure against cycles 1 and 2, the median is 65.5 and the minimum 57. There is no P1 and there are 28 P2s, so the area has not converged. Repair rounds lifted the median to 71, and only n12 reached 80, at 81 on the F and K items in round 2. All four referenced cases ended `build` in round 0.

This was the first cycle in which builders built and shot their own page. That cut the label-collision and contrast misses of cycle 2, and still left 82 of the 132 lost points as `skill`. All six builds lost the new word-economy item. Five of six missed the answer on the mark or the readout behind it.

The kit cost 32 points, mostly in two places. The kit's own lists cannot join a chart's focus. A band axis has no tick step and no edge rule.

15 more points were the trial harness, not the builder: the playground generated no chart-box classes, so every `ChartCard` box collapsed in loading, empty and error. This PR fixes that.

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `2ad50570e616dc0935cf67e800f689965b469046`                                                                                                                                                                                                                                                                                                                                                              |
| Date       | 2026-11-16                                                                                                                                                                                                                                                                                                                                                                                              |
| Cases      | c10, c11, c12, c13 (referenced) and n02, n12 (native)                                                                                                                                                                                                                                                                                                                                                   |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel. Each was fenced to `packages/basalt-ui/agent/**`, `llms.txt`, the published types and docs, and the playground's own code, minus every other `scenarios/expr/` directory. Each built and shot its own route                                                                                                           |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                               |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after round 2                                                                                                                                                                                                                                                                                    |
| Shots      | `.evidence/v3-shots/expression-3/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored). Each round has the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names and a keyboard frame `--focus--`, each light and dark at 1800x1200 and 390x844. The source snapshots are in `src-r<round>/` and the builder reports in `builder-reports/` |

### The lead notes of the brief

- **(a) Keyboard frame.** A lead script (`.evidence/v3-shots/expression-3/focus-shots.ts`, not in git) focuses the first tabbable data element in `<main>`, presses ArrowRight twice, waits 500 ms and shoots. It logs the focused element and the `aria-live` text. Round 0 showed that the log was easy to misread, which is finding .79. From round 1 the reviewer prompt said that a one-tab-stop host keeps DOM focus while the announcement names the item the keys reached.
- **(b) `fixture` through the route.** `validateShotSearch` now keeps a non-empty string `fixture`, and `ScenarioProps` carries it, passed by the route and `ScenarioView`, with a test. No builder parsed the location.
- **(c) `scenario-info.ts`.** The lead pre-registered all six registry and scenario-info entries with a placeholder component before round 0. Each builder then owned one directory and replaced its placeholder.
- **(d) Builders look at their page.** All six ran in parallel. Each built the playground into its own dist directory under `.evidence/v3-shots/expression-3/dist/<case>` and shot its own route with `shots.ts --dist`. The one cost was a build that failed while a sibling was mid-edit, which builders retried. Most builders opened a subset of their shots, and none opened a keyboard frame.
- **(e) One ChartCard, one palette.** `basalt-ui/charts` exports the v3 `ChartCard` (`src/charts/index.ts:21`, from `parts/chart-card`). On a playground page `--vx-bad` resolves to solid `#af3b39` in light and `#ffa59c` in dark, with `--vx-good` and `--vx-warn` solid as well (lead probe, not in git). Both teardowns had landed.
- **(f) The repo's gate.** Builders ran typecheck, oxlint, oxfmt, the playground's `check-theme` and `scenarios.test.ts` on their directory. Before scoring round 0 the lead ran `make check-fast`. The static gate passed: fmt, lint, typecheck, check-theme, budgets, literals and recipes-lint. The unit and layout steps were still queued for a host slot when round 1 started editing the tree, so the lead stopped that run and ran the gate again on the final tree.

### Harness

- **The chart box.** The playground's `index.css` lists its Tailwind `@source` folders by hand, and the list missed `packages/basalt-ui/src/charts`. So no `ChartCard` box-height class was generated, and every loading, empty and error box collapsed to its figure row: 45 px against 545 loaded in c12. The lead measured the missing `h-[clamp(10rem,50cqw,26.25rem)]` in the built CSS. A consumer gets these classes from the Vite plugin's generated `.basalt/sources.css`, so this is a playground defect, not a kit defect. The fix landed between round 0 and round 1, and builders were told not to work around the collapse. Two kit defects showed only once the box had its height. A kind's legend row is clipped at the bottom of the box (c11, c12). The 160 px box at 390 px clips a kind's x axis, its legend and the negative half of a diverging chart (c11, c12, c13, n12). Both are in `v3-expr-3-kit-fixes`.
- **The shell title.** On every scenario page the shell's header and rail name the first scenario. `resolveActive` matches `/scenarios/$name` as a template and ignores `params`, so every scenario item ties and the first wins. Reviewers were told to ignore the shell. Filed as signal issue 1535.
- **Locale.** The shots ran in a Chrome whose locale is German. The chart's axis, its tooltip and its y ticks follow the browser locale while `useFormat` does not, so pages mixed "18. Okt." and "0,8" with English text. That is a kit defect (`v3-expr-3-kit-fixes` (2)), not a shot artefact: a German reader of an English app sees the same.
- **Fence.** Three slips:
  - c13's builder opened `packages/basalt-ui/src/charts/*` once in round 0 while chasing the box collapse.
  - In round 1 the same builder ran a background lookup for the engine package path.
  - In round 2 c11's builder ran a grep that printed lines from another builder's directory, and it took only the `text` mark's option names from them.

  None changed a round-0 build, which is the only round that counts as a first try.

## Numbers

| Number                         | c10                        | c11                                   | c12          | c13          | n02          | n12          | Summary                     |
| ------------------------------ | -------------------------- | ------------------------------------- | ------------ | ------------ | ------------ | ------------ | --------------------------- |
| First-try score (round 0)      | 63                         | 67                                    | 63           | 60           | 54           | 61           | median 62, minimum 54       |
| First-try score, F and K only  | 67                         | 67                                    | 67           | 64           | 57           | 64           | median 65.5, minimum 57     |
| Round 1 score (F and K)        | 70 (74)                    | 70 (71)                               | 67 (71)      | 74 (74)      | 68 (71)      | 67 (67)      | median 69 (71)              |
| Round 2 score (F and K)        | 70 (71)                    | 74 (76)                               | 63 (67)      | 70 (67)      | 72 (74)      | 77 (81)      | last-round median 71 (72.5) |
| Rounds-to-pass (F and K)       | 3 (3)                      | 3 (3)                                 | 3 (3)        | 3 (3)        | 3 (3)        | 3 (2)        | mean 3 (2.83)               |
| Verdict, round 0               | build                      | build                                 | build        | build        | n/a          | n/a          | build 4, tie 0, reference 0 |
| Verdict, rounds 1 and 2        | reference, tie             | tie, build                            | build, build | build, build | n/a          | n/a          |                             |
| Glue lines, round 0            | ~45                        | ~10                                   | ~17          | ~20          | ~43          | ~15          | median 18.5                 |
| Glue lines, last round         | ~95                        | ~38                                   | ~30          | ~15          | ~108         | ~15          | median 34                   |
| Escape hatches, round 0        | 0                          | 1 `as const`                          | 5 `as const` | 0            | 1 `as const` | 5 `as const` | hand `<svg>` 0 of 6         |
| Escape hatches, last round     | hand `<svg>`, 1 `as const` | 1 `as const`, 1 `as [number, number]` | 5 `as const` | 3 `as const` | 3 `as const` | 7 `as const` | hand `<svg>` 1 of 6         |
| Devices used unasked (round 0) | 5                          | 6                                     | 7            | 3            | 6            | 4            | median 5.5 of 12            |

All six round-0 builds scored under 80 both ways. The X items take a point or two off every build. On the F and K items alone this cycle sits where cycle 2 did, and a little above cycle 1, which had no X items.

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines. It excludes the fixture, and it was checked against the `// cycle-expression-3:` comments. Two builds tripled their glue in the repair rounds:

- c10 drew a ring graph of hops in a hand-written `<svg>` (`ReachRings.tsx`, about 75 lines), with focus, dim and tab stop from `useChartFocus`.
- n02 drew its stage names, rule labels and outlier tags as engine `text` marks because the band axis dropped labels at 390 (about 40 lines).

No build used a lint disable, `theme-allow` or a deep import. Every `as const` is a const assertion; the one cast is c11's tuple. From round 1, c11, c13 and n02 imported `text` from `@tanstack/charts/text`, an allowed engine subpath. Only n12 registered a series group (`SLEEP_SERIES` in `apps/playground/src/demo/series.ts`).

Devices reached in round 0, out of six builds: dim-the-rest 6, colour budget 5, keyboard parity 5, hero number 3, anatomy 3, threshold geometry 3, baseline delta 2, direct labels 2, pre-annotation 1, quantized marks 1, metaphor 0, live cue 0. Against cycle 2, dim-the-rest rose from 2 to 6. Hero number fell from 6 to 3, and so did anatomy, because the reviewers now read anatomy against the console look. Pre-annotation fell from 3 to 1.

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The cycle 3 row gives both, with F and K first.

| Cycle | Sha        | First-try median    | Minimum     | Last-round median   | Rounds-to-pass, mean | Verdicts (build, tie, reference) | P1  | P2  | Glue median, round 0 to last | Hand `<svg>`, last round |
| ----- | ---------- | ------------------- | ----------- | ------------------- | -------------------- | -------------------------------- | --- | --- | ---------------------------- | ------------------------ |
| 1     | `062367fe` | 68                  | 64          | 78.5                | 2.17                 | 3, 2, 0                          | 0   | 16  | 62.5 to 195                  | 1 of 6                   |
| 2     | `ac6acc90` | 66.5                | 48          | 78.5                | 2.17                 | 3, 1, 0                          | 0   | 17  | 50 to 67.5                   | 0 of 6                   |
| 3     | `2ad50570` | 65.5 (all items 62) | 57 (all 54) | 72.5 (all items 71) | 2.83 (all items 3)   | 4, 0, 0                          | 0   | 28  | 18.5 to 34                   | 1 of 6                   |

## Cases

### c10: what a leaked key can reach (reference: blast-radius)

- **Round 0, 63, build.** It drew a hop-ordered list with a staircase indent, an Affected status per row, and a `BarList` of resources per hop, with focus driving a headline readout. The extreme fixture hid hop 9 behind a fixed eight-row bar list. "13 of 19" stood as prose, and the bar list did not join the focus. Shots `r0/scenarios-expr-c10*`.
- **Round 1, 70, reference.** It added a three-cell strip, one denominator, and bar rows that focus their first resource. The reviewer judged that the reference's radial graph shows the fan-out faster than any list.
- **Round 2, 70, tie.** It replaced the bar list with a ring graph of hops in a hand-written `<svg>` through the seam, with two-way focus between nodes and rows. The nodes are unlabelled and the ring captions are cryptic.

### c11: a retrieval cut-off (reference: hex-density)

- **Round 0, 67, build.** A 50-bin relevance histogram, kept bins in accent and cut bins in grey, with a cut-off slider. The cut-off rule ran through the middle of a bin, recency appeared only as a footer median, and nothing was annotated. Shots `r0/scenarios-expr-c11*`.
- **Round 1, 70, tie.** 0.05 bins, a share figure, a second card for recency, a bar click setting the cut-off, and focus that walks only non-empty bins. The band axis would not draw a rule at 0.55 at all.
- **Round 2, 74, build.** "348" on the densest bin, a "Kept from 0.55" tag and a labelled clipped pile-up. The kind's legend is clipped by the chart box, and at 390 the x axis is gone.

### c12: weekly AI spend (reference: usage-summary)

- **Round 0, 63, build.** A three-cell strip with a budget meter, a stacked daily chart and a model `BarList`. The chart's hero was the 14-day total. The "US$200/day" label lay on the bars, and the loading card collapsed, which was the harness. Shots `r0/scenarios-expr-c12*`.
- **Round 1, 67, build.** Today's spend as the hero, pace zones on the meter, the partial day faded and captioned, and `CardGrid`. The legend was clipped and at 390 the axis was gone.
- **Round 2, 63, build.** The legend moved to the card's legend row and a `breach` fixture was added. In that fixture at 390, four non-zero days shrank to a pixel, and the footer note about lighter bars no longer held.

### c13: SOC triage (reference: diverging-bars)

- **Round 0, 60, build.** A strip, a closed-per-day line, escalation bars with accent spikes and a median line, and a ranked list. That is four parts where one diverging chart answers both halves, and every fact appeared two or three times. Shots `r0/scenarios-expr-c13*`.
- **Round 1, 74, build.** One diverging chart, closed above the axis and escalated below, with labelled spike days, a "+4 pts" pill, footer pairs, and a list scrolled to the focused day.
- **Round 2, 70, build.** The rule labels moved into the legend. At 390 the default box clips the negative half, and the y axis prints "-200" with no tick format to fix it.

### n02: where Issues are stuck (native)

- **Round 0, 54.** A stage-by-stage dot plot scaled to each stage's typical time, with 1x and 2x rules, beside a `DataTable`. At 390 the band axis kept two of five stage names. A 40x outlier crushed the rest, and the table could not join the chart's focus (X3 0). Shots `r0/scenarios-expr-n02*`.
- **Round 1, 68.** The table was replaced by a hand-built row list that takes `focus.item`, giving up sort and the phone card. It added a 6x cap with a labelled off-scale dot, spread dots and two labelled worst dots.
- **Round 2, 72.** Stage names drawn as engine text marks, because the axis drops them. Only stuck dots are labelled.

### n12: last night's sleep (native)

- **Round 0, 61.** A verdict sentence, a strip of four stage cells with deltas against the usual, and a 30-night stacked `Bars` with a 7 h need rule. A night missing a stage was drawn as complete, "Need 7h" lay on the tallest bar, and the strip ignored the focus. Shots `r0/scenarios-expr-n12*`.
- **Round 1, 67.** The chart and the strip side by side, and the strip follows the focused night. The hero is last night's total against the need, and pills are coloured only past 10 %.
- **Round 2, 77.** The hero unclipped at 390, a context line, and the short stage in the announcement. It scores 81 on the F and K items alone, the cycle's one pass by that measure.

## Round-0 item scores

| Item                 | c10   | c11   | c12   | c13   | n02   | n12   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 2     | 2     | 2     | 2     | 2     | 2     |
| F2 Answer at rest    | 2     | 2     | 2     | 2     | 2     | 2     |
| F3 Baseline          | 1     | 2     | 2     | 2     | 2     | 2     |
| F4 Colour budget     | 3     | 3     | 3     | 3     | 2     | 2     |
| F5 Honest marks      | 1     | 1     | 2     | 2     | 2     | 1     |
| F6 Labels            | 2     | 2     | 1     | 2     | 1     | 1     |
| F7 Focus and readout | 2     | 2     | 2     | 2     | 2     | 2     |
| F8 Anatomy           | 1     | 2     | 2     | 2     | 2     | 2     |
| K1 Scales            | 2     | 2     | 2     | 2     | 1     | 2     |
| K2 States            | 2     | 1     | 1     | 1     | 1     | 1     |
| K3 Keyboard          | 3     | 2     | 3     | 2     | 1     | 3     |
| K4 Tokens            | 2     | 3     | 2     | 2     | 3     | 2     |
| K5 Responsive        | 2     | 2     | 2     | 2     | 1     | 3     |
| K6 First paint       | 3     | 2     | 2     | 1     | 2     | 2     |
| X1 Word economy      | 1     | 2     | 1     | 1     | 1     | 1     |
| X2 One view          | 2     | 2     | 2     | 1     | 2     | 2     |
| X3 Linked parts      | 1     | 2     | 1     | 2     | 0     | 1     |
| X4 Calm interaction  | 2     | 2     | 2     | 2     | 2     | 2     |
| X5 Console anatomy   | 2     | 2     | 2     | 1     | 2     | 2     |
| Sum / max            | 36/57 | 38/57 | 36/57 | 34/57 | 31/57 | 35/57 |
| F and K sum / max    | 28/42 | 28/42 | 28/42 | 27/42 | 24/42 | 27/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`, which later rounds rewrote. Every case scored F1, F2 and F7 at 2. Every case lost K2 and X4, and five of six lost X1 at 1.

## Findings

Severity follows the rubric. A 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, a 2 is P3, and an X item counts like an F item. Round 0 has no P1. n02 X3 is a 0, but X3 is not a P1 item.

Points lost in round 0 by class: `skill` 82, `primitive` 32, `harness` 15 and `rubric` 3, for a total of 132. No point is `doctrine`, `case` or `planned`: no open plan row owns a chart, card or skill gap. By severity there are 28 P2 (12 `skill`, 9 `primitive`, 6 `harness`, 1 `rubric`) and 75 P3.

`harness` is not a class of `EXPRESSION.md` § Finding classes. It is used here for the 15 points the trial playground cost the builder: the chart box classes of § Harness. The fix landed in this PR, so they carry no row. EXPRESSION.md's classes all name an artifact a builder meets. This one is the lead's, and the cycle 4 brief carries the check (lead note (a)).

Where findings are fixed:

- `skill (n)` is change (n) of `v3-expr-3-skill`.
- `kit (n)` is change (n) of `v3-expr-3-kit-fixes`.
- `contract (x)` is item (x) of `v3-expr-3-contract`.
- `rubric (n)` is change (n) of `v3-expr-3-rubric`.
- `this PR` is the playground's `@source` line in `apps/playground/src/index.css`.

| Id               | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                              | Fix          |
| ---------------- | ---------- | ---- | --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| expression-3.1   | c10 F1     | 1    | P3  | skill     | A hop-indented list and a per-hop `BarList`; no node, edge or ring, kind as text (`ExprC10.tsx:96-138`). The builder looked for a graph form, found none and listed it                                | skill (10)   |
| expression-3.2   | c10 F2     | 1    | P3  | skill     | The 13 and the 6 are sentence-weight, not a figure; the six out-of-reach rows sit below the fold (`r0/…c10--light--1800x1200`)                                                                        | skill (9)    |
| expression-3.3   | c10 F3     | 2    | P2  | skill     | "13 of 19" is prose only and "4 affected" stands against nothing (`ExprC10.tsx:56`)                                                                                                                   | skill (4)    |
| expression-3.4   | c10 F5     | 2    | P2  | skill     | `rows={8}` hides hop 9 in the sprawl fixture, whose headline says 9 hops; the bars sum to 18 of 19 and carry no unit (`:151`, `r0/…c10-fixture-sprawl--light--1800x1200`)                             | skill (4)    |
| expression-3.5   | c10 F6     | 1    | P3  | skill     | Ids and "via" text truncate at 390 ("secret-registry-to…", `r0/…c10--light--390x844`)                                                                                                                 | skill (1)    |
| expression-3.6   | c10 F7     | 1    | P3  | primitive | The per-hop `BarList` does not react to focus, so the readout names the hop but not its count. `BarList` takes no focus (wish list)                                                                   | contract (a) |
| expression-3.7   | c10 F8     | 2    | P2  | skill     | No stat strip and no legend: nothing says what the red dot means, and the status facts sit outside the card (`:84-85`)                                                                                | skill (3)    |
| expression-3.8   | c10 K1     | 1    | P3  | skill     | The sprawl fixture hides hop 9, as .4                                                                                                                                                                 | skill (4)    |
| expression-3.9   | c10 K2     | 1    | P3  | skill     | Empty says "reaches no other resource", which is false when nothing is indexed (`:55`); error drops the headline and the page jumps about 60 px                                                       | skill (4)    |
| expression-3.10  | c10 K4     | 1    | P3  | skill     | `grid-cols-[2.5rem_1fr_auto]` (`:101`) and a `w-3` spacer per hop (`:109`); tabular numerals on the hop column only                                                                                   | skill (11)   |
| expression-3.11  | c10 K5     | 1    | P3  | skill     | The 720 px list fills the phone and pushes the per-hop card out of sight (`r0/…c10--light--390x844`)                                                                                                  | skill (7)    |
| expression-3.12  | c10 X1     | 2    | P2  | skill     | Hop stated as number, indent and bar; a "Reachable" badge on every reachable row; subtitles restate titles (`:121-135`)                                                                               | skill (2)    |
| expression-3.13  | c10 X2     | 1    | P3  | skill     | A half-empty per-hop card that reserves 8 rows and a 60 px dead band above the headline (`r0/…c10--light--1800x1200`)                                                                                 | skill (7)    |
| expression-3.14  | c10 X3     | 2    | P2  | primitive | Row focus drives the headline, but the list and the per-hop bars never link: `BarList` rows cannot take `focus.item` (wish list)                                                                      | contract (a) |
| expression-3.15  | c10 X4     | 1    | P3  | primitive | The kit's dim of `focus.item` rows leaves "Key · origin" and the badges near invisible (`r0/…c10--focus--light--1800x1200`, `--focus--dark--390x844`)                                                 | kit (3)      |
| expression-3.16  | c10 X5     | 1    | P3  | skill     | A header and an inset body, but no figure with a pill and no footer pairs                                                                                                                             | skill (3)    |
| expression-3.17  | c11 F1     | 1    | P3  | skill     | Recency, the second score, appears only as a footer median (`ExprC11.tsx:111-114`)                                                                                                                    | skill (10)   |
| expression-3.18  | c11 F2     | 1    | P3  | skill     | The mass is not annotated; the median is footer text. The builder believed engine `text` marks are banned from a page (wish list)                                                                     | skill (9)    |
| expression-3.19  | c11 F3     | 1    | P3  | skill     | "kept of 2,400" is the only baseline: no share, no dropped count (the reference prints 55.8 % / 44.2 %)                                                                                               | skill (4)    |
| expression-3.20  | c11 F5     | 2    | P2  | primitive | The cut-off at 0.56 runs through the middle of the 0.56 bin (`r0/…c11--light--1800x1200`): a band-axis rule takes only a band key and lands on the band's centre (`fixture.ts:69-73`, wish list)      | contract (c) |
| expression-3.21  | c11 F6     | 1    | P3  | skill     | The two humps are named only through the legend                                                                                                                                                       | skill (9)    |
| expression-3.22  | c11 F7     | 1    | P3  | skill     | Focus starts on an empty bin, so no mark lights (`r0/…c11--focus--light--1800x1200`)                                                                                                                  | skill (9)    |
| expression-3.23  | c11 F8     | 1    | P3  | skill     | No status and no delta pill in the figure                                                                                                                                                             | skill (3)    |
| expression-3.24  | c11 K1     | 1    | P3  | primitive | The 780-chunk pile-up rescales the axis to 800 and crushes the distribution; the y axis has no log scale and `y.domain` as an object is not applied (`r0/…c11-fixture-pileup--light--1800x1200`)      | contract (d) |
| expression-3.25  | c11 K2     | 2    | P2  | harness   | Loading is about 140 px against 610 loaded (`r0/…c11-shot-state-loading--light--1800x1200`): the playground generated no chart-box classes. Empty and error also still print "2,400 chunks"           | this PR      |
| expression-3.26  | c11 K3     | 1    | P3  | skill     | One stop and an announcement, but the ring frames an empty bin, as .22                                                                                                                                | skill (9)    |
| expression-3.27  | c11 K5     | 1    | P3  | primitive | x labels at 390 read 0.0, 0.2, 0.5, 0.8; the builder blanked labels in `x.format` because a band axis has no tick step (`cycle-expression-3` comment)                                                 | contract (b) |
| expression-3.28  | c11 K6     | 1    | P3  | harness   | The loading-to-loaded jump of .25                                                                                                                                                                     | this PR      |
| expression-3.29  | c11 X1     | 1    | P3  | skill     | The cut-off value appears four times and "2,400" twice                                                                                                                                                | skill (2)    |
| expression-3.30  | c11 X2     | 1    | P3  | skill     | The slider sits 70 px above a chart it cannot be dragged on                                                                                                                                           | skill (7)    |
| expression-3.31  | c11 X3     | 1    | P3  | skill     | Only the slider writes the cut-off (`:77`); round 1 let a bar click set it through `selection`, which the kit already had                                                                             | skill (6)    |
| expression-3.32  | c11 X4     | 1    | P3  | skill     | The builder's cut grey goes dull when dimmed in dark (`r0/…c11--focus--dark--1800x1200`)                                                                                                              | skill (1)    |
| expression-3.33  | c11 X5     | 1    | P3  | skill     | No delta pill in the inset                                                                                                                                                                            | skill (3)    |
| expression-3.34  | c12 F1     | 1    | P3  | skill     | A generic daily stack whose hero is the 14-day total US$2,121 (`ExprC12.tsx:138`), which answers neither question                                                                                     | skill (10)   |
| expression-3.35  | c12 F2     | 1    | P3  | skill     | The strip answers at rest, but no mark carries a word                                                                                                                                                 | skill (9)    |
| expression-3.36  | c12 F3     | 1    | P3  | skill     | The meter has no pace marker and its end label repeats US$653 instead of the US$1,400 budget                                                                                                          | skill (4)    |
| expression-3.37  | c12 F5     | 1    | P3  | skill     | Today's partial bar looks like a finished day; the US$200/day line is an invented even split                                                                                                          | skill (5)    |
| expression-3.38  | c12 F6     | 2    | P2  | primitive | "US$200/day" lies on the bars in the over fixture and at 390 (`r0/…c12-fixture-over--light--1800x1200`); the x axis skips days and leaves the last bar unlabelled                                     | kit (1)      |
| expression-3.39  | c12 F7     | 1    | P3  | skill     | The readout is a day total, with no model                                                                                                                                                             | skill (9)    |
| expression-3.40  | c12 F8     | 1    | P3  | skill     | The chart card's figure is the wrong number and the strip has no pill                                                                                                                                 | skill (3)    |
| expression-3.41  | c12 K1     | 1    | P3  | primitive | The reference label collides in the over fixture, and the zero-today bar has no x label                                                                                                               | kit (1)      |
| expression-3.42  | c12 K2     | 2    | P2  | harness   | Loading collapses the chart card to about 45 px against 545 loaded (`r0/…c12-shot-state-loading--light--1800x1200`, inspected by the lead); the error strip says only "Could not load this."          | this PR      |
| expression-3.43  | c12 K4     | 1    | P3  | skill     | `@wide:grid-cols-[3fr_2fr]` (`:127`), the template the shipped `linked-parts.md` example uses                                                                                                         | skill (11)   |
| expression-3.44  | c12 K5     | 1    | P3  | primitive | A sparse x axis at 390 and the label collision of .38                                                                                                                                                 | contract (b) |
| expression-3.45  | c12 K6     | 1    | P3  | harness   | The page jumps from loading to loaded, as .42                                                                                                                                                         | this PR      |
| expression-3.46  | c12 X1     | 2    | P2  | skill     | US$653, "this week" and the driver are each stated twice                                                                                                                                              | skill (2)    |
| expression-3.47  | c12 X2     | 1    | P3  | skill     | About 60 % of the 1800 canvas is empty under a four-row list                                                                                                                                          | skill (7)    |
| expression-3.48  | c12 X3     | 2    | P2  | primitive | Focusing a day changes neither the list nor the strip: `BarList` rows cannot take `focus.item` (wish list)                                                                                            | contract (a) |
| expression-3.49  | c12 X4     | 1    | P3  | skill     | The builder's dimmed frontier-xl is very pale in light                                                                                                                                                | skill (1)    |
| expression-3.50  | c12 X5     | 1    | P3  | skill     | The strip is flush, with no inset and no pill                                                                                                                                                         | skill (3)    |
| expression-3.51  | c13 F1     | 1    | P3  | skill     | A strip, a closed-per-day line, an escalation bar chart and a source list: four parts where one diverging chart answers both halves (`ExprC13.tsx:121-155`)                                           | skill (7)    |
| expression-3.52  | c13 F2     | 1    | P3  | skill     | The spike bars carry no word; the answer is a sentence                                                                                                                                                | skill (9)    |
| expression-3.53  | c13 F3     | 1    | P3  | skill     | The 1.8x spike threshold is not drawn and the 88 % has no previous-period delta                                                                                                                       | skill (4)    |
| expression-3.54  | c13 F5     | 1    | P3  | skill     | The threshold that splits grey from accent lives only in the subtitle (`:161`)                                                                                                                        | skill (4)    |
| expression-3.55  | c13 F6     | 1    | P3  | skill     | The end label "Closed automatically" repeats the card title; spike bars have no date                                                                                                                  | skill (2)    |
| expression-3.56  | c13 F7     | 1    | P3  | skill     | The visible readout is the line chart's tooltip and never returns to a total                                                                                                                          | skill (9)    |
| expression-3.57  | c13 F8     | 1    | P3  | skill     | Subtitles stand in for the card figure                                                                                                                                                                | skill (3)    |
| expression-3.58  | c13 K1     | 1    | P3  | primitive | The quiet fixture's end label touches the line peak (`r0/…c13-fixture-quiet--light--1800x1200`)                                                                                                       | kit (1)      |
| expression-3.59  | c13 K2     | 2    | P2  | harness   | Chart skeletons 288 px against 402 loaded at 1800 and about 60 against 400 at 390; the empty and error text repeats seven times                                                                       | this PR      |
| expression-3.60  | c13 K3     | 1    | P3  | primitive | The tooltip date reads "Mo., 19. Okt. 2026" beside English "19 Oct", and the announcement is spoken twice (focus log)                                                                                 | kit (2)      |
| expression-3.61  | c13 K4     | 1    | P3  | skill     | `ml-auto` (`:215`) and `grid-cols-[3fr_2fr]` (`:120`, `:158`)                                                                                                                                         | skill (11)   |
| expression-3.62  | c13 K5     | 1    | P3  | skill     | The stacked strip pushes the escalation marks below the first screen at 390                                                                                                                           | skill (7)    |
| expression-3.63  | c13 K6     | 2    | P2  | harness   | The loading jump of .59; the empty and error states also drop the headline, moving the strip 60 px                                                                                                    | this PR      |
| expression-3.64  | c13 X1     | 2    | P2  | skill     | "5 sources" three ways, the median twice, "11 Nov" three times, "Closed automatically" three times                                                                                                    | skill (2)    |
| expression-3.65  | c13 X2     | 2    | P2  | skill     | A strip and four cards read as a stack; a 400 px card for a weekday pattern (`r0/…c13--light--1800x1200`)                                                                                             | skill (7)    |
| expression-3.66  | c13 X3     | 1    | P3  | primitive | Bars and list share focus, but the focused 19 Oct row is below the list's fold and never scrolls into view                                                                                            | kit (3)      |
| expression-3.67  | c13 X4     | 1    | P3  | primitive | The kit's dim leaves the list's text low-contrast in dark (`r0/…c13--focus--dark--1800x1200`)                                                                                                         | kit (3)      |
| expression-3.68  | c13 X5     | 2    | P2  | skill     | No figure with a pill in an inset and no footer pairs; the strip is flat                                                                                                                              | skill (3)    |
| expression-3.69  | n02 F1     | 1    | P3  | skill     | A dot strip scaled to typical time (`ExprN02.tsx:149-194`); no dot names its Issue                                                                                                                    | skill (10)   |
| expression-3.70  | n02 F2     | 1    | P3  | skill     | The 4.8x and 3.9x dots carry no annotation                                                                                                                                                            | skill (9)    |
| expression-3.71  | n02 F3     | 1    | P3  | skill     | The hero "2d" has no delta against its stage's typical; in the quiet fixture both lines leave the domain                                                                                              | skill (4)    |
| expression-3.72  | n02 F4     | 1    | P3  | skill     | Two status hues, amber and red (`:23-25`)                                                                                                                                                             | skill (1)    |
| expression-3.73  | n02 F5     | 1    | P3  | primitive | Dots at the plot floor draw as half dots in the extreme fixture                                                                                                                                       | kit (4)      |
| expression-3.74  | n02 F6     | 2    | P2  | primitive | At 390 the band axis keeps Build and Deploy only (`r0/…n02--light--390x844`), so "most in review" maps to no column; "typical" and "stuck" sit on dots                                                | contract (b) |
| expression-3.75  | n02 F7     | 1    | P3  | skill     | The pill stays "Stuck" on a 0.31x Issue (`:133-135`); the readout shows hours, not the plotted multiple                                                                                               | skill (9)    |
| expression-3.76  | n02 F8     | 1    | P3  | skill     | The footer "Stuck 7" has no swatch and the figure no pill                                                                                                                                             | skill (3)    |
| expression-3.77  | n02 K1     | 2    | P2  | primitive | One 40x Issue presses 31 dots and both rules into the bottom tenth (`r0/…n02-fixture-extreme--light--1800x1200`); no log y, `y.domain` as an object not applied (wish list)                           | contract (d) |
| expression-3.78  | n02 K2     | 2    | P2  | harness   | Loading holds about 180 px against 507; error drops the summary and the card jumps 60 px (`:109`)                                                                                                     | this PR      |
| expression-3.79  | n02 K3     | 2    | P2  | rubric    | Scored 1 because the log showed the same focused element after two presses. With one tab stop that is by design; the log's announcement ("ISS-1486 in Queued", third in reading order) shows the move | rubric (1)   |
| expression-3.80  | n02 K5     | 2    | P2  | primitive | At 390 three stage labels vanish (as .74) and the table scrolls sideways: the builder chose `phone: 'scroll'` because phone cards print numbers without headers (`:95`)                               | contract (b) |
| expression-3.81  | n02 K6     | 1    | P3  | primitive | The axis prints "0,8" in the browser locale while the table prints "0.9"                                                                                                                              | kit (2)      |
| expression-3.82  | n02 X1     | 2    | P2  | skill     | The stuck count four times: headline, footer, subtitle and axis title; "No open Issues" twice                                                                                                         | skill (2)    |
| expression-3.83  | n02 X2     | 1    | P3  | skill     | The table is flush beside a card with 500 px empty below; at 390 the table is below the fold                                                                                                          | skill (7)    |
| expression-3.84  | n02 X3     | 3    | P2  | primitive | The chart focus does not touch the table (`:197`): `DataTable` rows cannot take `focus.item`. Round 1 replaced the table with a hand-built list to link them                                          | contract (a) |
| expression-3.85  | n02 X4     | 1    | P3  | rubric    | The dimmed rest is readable; the 2 rests on a gap flash that a still frame cannot show                                                                                                                | rubric (2)   |
| expression-3.86  | n02 X5     | 1    | P3  | skill     | Issue ids in the sans face and no pill                                                                                                                                                                | skill (3)    |
| expression-3.87  | n12 F1     | 1    | P3  | skill     | The chart shows the total only (`ExprN12.tsx:137`), with no per-stage usual, so "which stage" lives in the pills                                                                                      | skill (10)   |
| expression-3.88  | n12 F2     | 1    | P3  | skill     | The one big number is the usual night, not last night; the last bar carries no word                                                                                                                   | skill (9)    |
| expression-3.89  | n12 F3     | 1    | P3  | skill     | Last night's total has no delta against usual                                                                                                                                                         | skill (4)    |
| expression-3.90  | n12 F4     | 1    | P3  | skill     | Pills turn red or green on -1 and +3 min (`:99`)                                                                                                                                                      | skill (1)    |
| expression-3.91  | n12 F5     | 2    | P2  | skill     | With REM missing the last bar is drawn as a complete 305 min night (`:137-142`); only the readout says "Incomplete"                                                                                   | skill (5)    |
| expression-3.92  | n12 F6     | 2    | P2  | primitive | "Need 7h" collides with the tall last bar in the restless fixture at both widths (`r0/…n12-fixture-restless--light--1800x1200`)                                                                       | kit (1)      |
| expression-3.93  | n12 F7     | 1    | P3  | skill     | The readout carries the total only and the strip does not follow                                                                                                                                      | skill (6)    |
| expression-3.94  | n12 F8     | 1    | P3  | primitive | The strip's cells have no swatch matching the stage colours: `StatCell` takes none (wish list)                                                                                                        | contract (e) |
| expression-3.95  | n12 K1     | 1    | P3  | skill     | The missing-REM fixture draws a partial stack as complete, as .91                                                                                                                                     | skill (5)    |
| expression-3.96  | n12 K2     | 2    | P2  | harness   | The chart card is about 90 px loading against 570 loaded (`r0/…n12-shot-state-loading--light--1800x1200`); Retry is a no-op (`:64`)                                                                   | this PR      |
| expression-3.97  | n12 K4     | 1    | P3  | skill     | The verdict has no tabular numerals and `signed()` builds a hyphen-minus (`:22-25`)                                                                                                                   | skill (11)   |
| expression-3.98  | n12 K6     | 1    | P3  | harness   | The loading jump of .96                                                                                                                                                                               | this PR      |
| expression-3.99  | n12 X1     | 2    | P2  | skill     | "Deep fell furthest short" in the sentence and the tag; "7h you need" in the sentence and the label                                                                                                   | skill (2)    |
| expression-3.100 | n12 X2     | 1    | P3  | skill     | Prose, a strip card and a chart card stacked, the lower 30 % empty                                                                                                                                    | skill (7)    |
| expression-3.101 | n12 X3     | 2    | P2  | skill     | Focusing a night changes only the hero; the strip stays on last night. Round 1 bound it to `focus` with no new glue                                                                                   | skill (6)    |
| expression-3.102 | n12 X4     | 1    | P3  | skill     | The builder's light-stage fill is very pale when dimmed in light                                                                                                                                      | skill (1)    |
| expression-3.103 | n12 X5     | 1    | P3  | skill     | No pill in the figure, no footer pairs, times not monospace                                                                                                                                           | skill (3)    |

Notes on the classes:

- **`skill`.** The shipped skill already names most of what was missed:
  - the surface step;
  - linked parts;
  - word economy;
  - the answer on the mark;
  - the baseline;
  - the colour budget.

  Builders ran the look step this time, but on a subset of their own frames. Rounds 1 and 2 show they could apply the text when a finding pointed at it. n12 bound its strip to `focus` in one round with no new glue, and c13 merged four parts into one diverging chart. The gap is applying the text before stopping, as in cycle 2, now with a step that ran. Four text defects are real, each with its own change in `v3-expr-3-skill`:
  - the shipped `linked-parts.md` example teaches the arbitrary `@wide:grid-cols-[3fr_2fr]` that K4 marks down (c12, c13);
  - nothing tells a builder that a kind such as `Bars` takes no annotation mark, so the answer on the mark needs `CartesianChart`;
  - the docs type every frame's `phase` as `Phase` without naming its import (c10, c13, n02);
  - c11 read the rules as banning engine `text` marks.

- **`primitive`.** Two families account for 22 of the 32 points.
  - Kit lists cannot join a chart's focus: `DataTable` and `BarList` rows take no `focus.item`. This cost n02 an X3 of 0 and c10 and c12 their X3. All of them are in `v3-expr-3-contract` (a).
  - The band axis has no tick step and no edge rule. This cost n02's stage labels, c11's cut-off and c12's day labels: `v3-expr-3-contract` (b), (c).

  The rest:
  - labels that still land on bars and dots after `v3-expr-2-kit-fixes` moved them off lines;
  - a chart locale that follows the browser;
  - the dim and the scroll of linked rows;
  - half dots at the plot floor.

  Those fix without a contract change in `v3-expr-3-kit-fixes`.

- **`rubric`.** Two items cannot be read from what the reviewer gets. K3 needs the announcement, not the focused element, and X4 needs a pointer path, not a still. `v3-expr-3-rubric` says how each is evidenced and adds a pointer sweep to the shoot.

The trial builds add 2,128 lines under `apps/playground/src/scenarios/expr/`, outside the demo line ceiling of `budget.test.ts`.

## Filing

| Row                     | Class                                                               | Covers                                                                                                                                                             | Checkpoint | Gate                         |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------- |
| `v3-expr-3-skill`       | skill (all 12 skill P2s; their P3s ride along)                      | .1–.5, .7–.13, .16–.19, .21–.23, .26, .29–.37, .39, .40, .43, .46, .47, .49–.57, .61, .62, .64, .65, .68–.72, .75, .76, .82, .83, .86–.91, .93, .95, .97, .99–.103 | none       | none: skill ships in a minor |
| `v3-expr-3-kit-fixes`   | primitive (P2s .38, .92; no export, no contract change)             | .15, .38, .41, .58, .60, .66, .67, .73, .81, .92, plus the legend and 390 box defects of § Harness                                                                 | none       | `v3-ga-prep`                 |
| `v3-expr-3-contract`    | primitive (P2s .14, .20, .48, .74, .77, .80, .84; amends contracts) | .6, .14, .20, .24, .27, .44, .48, .74, .77, .80, .84, .94                                                                                                          | spec       | `v3-ga-prep`                 |
| `v3-expr-3-rubric`      | rubric (P2 .79)                                                     | .79, .85                                                                                                                                                           | none       | none                         |
| `v3-cycle-expression-4` | next cycle                                                          | c14, c15, n04, n09, n13, n16                                                                                                                                       | none       | none: no open P1             |
| this PR                 | harness                                                             | .25, .28, .42, .45, .59, .63, .78, .96, .98                                                                                                                        |            |                              |

The primitive P2s file as two rows, as in cycle 2: fixes inside components, and a Spec for the props and options a contract gains. The contract row changes `charts/contract.ts`, `table/contract.ts` and `cards/contract.ts`, so it carries `checkpoint: spec`, seat opus high and `chore: contract amendment` commits (`check-contract-frozen.ts`).

**The gate.** EXPRESSION.md § Gate puts every `primitive` and `doctrine` fix row into the `after` of `v3-freeze-g4`, and the brief asks for the same. That row closed as issue 1227 before this cycle, and the teardown rows this cycle waited on run after it. Adding an expression-3 row to its `after` makes a cycle that `factory plan check` refuses: `v3-freeze-g4` -> `v3-expr-3-kit-fixes` -> `v3-cycle-expression-3` -> `v3-teardown-runtime` -> `v3-teardown-views` -> `v3-freeze-g4`.

The gate's purpose is stated in the same section: 3.0 is the last chance to change the charts contract. So the two primitive rows join `v3-ga-prep`, the open row before 3.0. That row was at the planner's limit of 20 `after` keys, so two edges that were already implied came out:

- `v3-cli-sibling`, implied through `v3-cycle-wiring-1`;
- `v3-ctl-8-lint`, implied through `v3-cycle-lint-1`.

That is a transitive reduction, and it changes no order. No P1 is open, so `v3-cycle-expression-4` holds no gate. EXPRESSION.md § Gate still names `v3-freeze-g4`, so its text no longer matches the plan. The owner may want it to name `v3-ga-prep`. That doc is outside this cycle's files, so the cycle 4 brief asks its lead to raise it.

**The bank.** It holds two referenced cases that have not run: c14 and the new c15. Cycle 4 therefore runs c14 and c15 with four native cases, n04, n09, n13 and n16. Its brief tells the lead to first look for TuffUI components published after 2026-11-13 and run them as further `c` cases. With fewer than four referenced cases, the convergence clause "three of four referenced cases end build or tie" cannot be met in full, and the cycle 4 file says so.

Two cases were added to the bank:

- c15 comes from TuffUI's Inbox Cleanup. It was published at `589cbb0` on 2026-11-13, after the benchmark read, and is the only visualization TuffUI added since. Its reference shot is `.claude/shots/tuffui-ref/inbox-cleanup-dark.png`, taken 2026-11-16. Tone Rewrite, the other component added at `589cbb0`, is a text tool, not a visualization.
- n16 comes from argo's body-composition page: weigh-ins, skinfold readings and a goal.

Factory friction: none this cycle. The plan check's refusals named their cause and the fix, and `factory project plan` gave the open rows that `planned` needs. Cycle 2's signal about it is answered.

The nav defect of § Harness is a kit bug, filed as signal issue 1535 on basalt-ui.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` findings are 82 of the 132 points lost in round 0, 62 %. That meets the first half of the confirm column (half or more). No `planned` point exists. Leaving out the 15 harness points the builder could not have avoided, the share is 82 of 117, 70 %.

Repair rounds lifted the median from 62 to 71, by 9 points on all items. On the F and K items they lifted it from 65.5 to 72.5, by 7. Both lifts are under the 15 that confirms and over the 5 that kills, so the hypothesis stays open on the lift, as in cycle 2.

The direction holds for a third cycle. When a finding named a device, the builder reached it, mostly without glue:

- n12's strip followed the focus in one round;
- c13 became one diverging chart;
- c11 got its share figure and its labelled densest bin.

The lift is capped by `primitive` gaps. Rounds 1 and 2 kept hitting the band axis, the kit lists' focus and the 160 px box at 390. c12 fell from 67 to 63 in round 2 on a fixture it added, whose bars the narrow box crushed. The method is necessary and not enough while the kit leaves those three open.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in round 0, and 1 of 6 in the last round, against three that would confirm. c10's ring graph uses the seam for focus, dim and tab stop.
- The round-0 median glue was 18.5 lines and the last-round median 34, both under 80.

Glue grew where the seam has no cut: c10's radial layout (about 75 lines) and n02's axis labels as text marks (about 40 lines). The second is a contract gap (`v3-expr-3-contract` (b)), not a seam gap. Polar layout is not in census V3, and c10 is one case, so it stays app code.

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for two kinds:

- a graph or node-link form (c10);
- a histogram with binning (c11).

Each served one case, so each is a recipe at most, and the Rule of Three stands.

## Convergence

Not converged:

- The round-0 median is 62, under 80; on the F and K items it is 65.5.
- The minimum is 54, under 60; on the F and K items it is 57.
- All four referenced cases ended `build` in round 0, which meets the bar of three.
- There are 28 P2s against a limit of three.

`v3-cycle-expression-4` is filed after the four fix rows.

owner:
