# Spike: shell frame geometry (S1, S6, S8)

All three claims hold. The in-flow sticky band, the CSS-only header tiers and the docked 320 px inspector pass their bars in two identical full runs, and the harness catches deliberately broken variants of two of them. The weakest number is the tightest S8 cell: 516 px of Main at window 900 with the rail collapsed, against a floor of 480.

Harness: `bun tools/spikes/shell-frame/run.ts` (one JSON object on stdout, exit 0; about 2 minutes, Chrome required). Concept: `docs/v3/concepts/shell-nav-router.md` section 6, rows S1, S6, S8. Section 6 is frozen; this spike records, it applies nothing.

## Question

Does `shell-i3` build on three geometry claims that hold?

- **S1.** A `PageBar` band that is in flow and sticky inside `<main>` (section 1 row 3) keeps its offset, and keeps the aside header seam aligned, through nested layouts, table heads, anchors, restored scroll and resize. If not, the shell path portals the band into a region.
- **S6.** The header's `priority` 1/2/3 collapse as CSS tiers, with shutterflow's real cluster, never wraps and never loses an item to the kebab. If not, the tier thresholds change.
- **S8.** A 320 px aside with `dock="always"` leaves shutterflow's viewer at least 480 px of Main at window 900, 1024 and 1200 with the rail collapsed, and Main resizes without visible lag. If not, shutterflow keeps its flex-sibling inspector in app code.

## Method

**Fixture.** `fixture/app.tsx`, plain React 19.3.0 plus Tailwind 4.3.5, built by `@tailwindcss/cli` and `Bun.build` and served from a local `Bun.serve`. It reproduces the structure of sections 3.1 and 3.2 only: a five-area grid (header, rail, Main as the only scrollport, aside), `Page` with a sticky in-flow `PageBar` that publishes `--page-bar-h` from a layout effect and a `ResizeObserver`, a `PageHost` mirror of that height to the shell root for the aside header, and two nested route layouts around every page. No consumer source; all data is synthetic, ids are hashes.

**Assumptions the concept does not fix** (the numbers below depend on them):

| Constant      | Value                                                                                                                                    | Source                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Header height | 48 px                                                                                                                                    | one token; 52 is `native-overlay` only                               |
| Rail          | 240 expanded, 64 collapsed                                                                                                               | 2.x `navbarWidth` 240 and the 64 px rail in `app-sidebar.module.css` |
| Aside         | 320                                                                                                                                      | the S8 brief                                                         |
| Size classes  | compact < 840 <= medium < 1200 <= expanded, by viewport                                                                                  | digest, tokens-visual                                                |
| Rail default  | collapsed at medium, expanded at expanded                                                                                                | section 3.5                                                          |
| Header tiers  | priority 3 below 1280 px of header content width (window minus 12 px padding), priority 2 below 1100, priority 1 never; kebab below 1280 | fixed in `app.css` before measuring                                  |
| Band          | box-content, 1 px border outside, text 13 px / 1.45 so heights are fractional                                                            | section 4, Band                                                      |

**S1.** Five views, each at 1800x1200 @1x and @2x, 390x844 @3x, 1440x560 and 1440x460 (25 cells):

| View     | Structure                                                                  | Sticky things sampled |
| -------- | -------------------------------------------------------------------------- | --------------------- |
| `argo`   | dense route: KPI cards, 90-row table, five anchored sections, anchor nav   | band, table head      |
| `map`    | `Page fill`, map with `min-h-[420px]`                                      | band                  |
| `week`   | not fill, 24 x 56 px hour grid, sticky day header                          | band, day header      |
| `month`  | `Page fill`, 6-row grid with `min` 420                                     | band                  |
| `agenda` | 70 rows, sticky right column at `top: calc(var(--page-sticky-top) + 16px)` | band, column          |

A `requestAnimationFrame` probe runs on every frame. It records the band's top in Main's coordinates, every other sticky element against (band bottom + its gap), counted only while that element should be stuck (its natural position is above its sticky offset and its container has not run out), and the aside header bottom minus the band bottom. Passes per cell: a scripted `mouse.wheel` scroll down and back up in 90 px steps; a reload with a restored scroll at 40 % of the range, the probe armed from document start through `sessionStorage`; for `argo` also five anchor jumps and a cold `#runs` load. Once, at 1800x1200: a resize sweep 1800 to 1300 and back in 50 px steps. A second `ResizeObserver` on the band reads the seam after layout and before paint, because a rAF sample cannot see a frame that painted stale and was fixed by the next commit.

`offsetFlicker` is true when any sampled frame, in any cell or in a restore pass, is off its sticky offset by more than 0.5 px. `asideSeamPx` is the maximum absolute seam over all cells with a docked aside.

**Controls.** A probe that has never fired proves nothing, so two broken fixtures run through the same code:

- `control=head`: the table head is pinned at `top: 0` instead of under the band. The probe must report flicker.
- `control=mirror`: the aside height arrives 50 ms after the band's. The paint-time seam must be non-zero.

**S6.** `view=viewer` (shutterflow's cluster): one `custom` status item at priority 1 (3 badges, `Card · 40 new` at expanded, `Card 40` below), a job-progress `custom` at priority 2, two `button` items at priority 3, then search, bell, kebab and account. All present at once, the worst case. Cells: window 1024, 1200, 1440, each with the rail expanded and collapsed (6 cells). The cluster is `flex-wrap` on purpose, so a lack of room shows as a wrap instead of a silent clip. Per cell:

- `itemsLost` counts items neither visible in the row nor listed in the kebab (the menu is built, as in the concept, from items whose node is `display: none` at open time);
- `wraps` is a cell where the cluster is taller than one 32 px row, or the header scrolls horizontally;
- labels must be long at 1200 and above, short below;
- yield order: a hidden item never outranks a shown one.

Information only: a sweep from 1024 to 1492 in 12 px steps with the rail expanded.

**S8.** `view=viewer`, `dock="always"`, aside 320, window 900, 1024, 1200 at height 720, rail expanded and collapsed (6 cells). The contact sheet is a justified-row grid re-laid out from a `ResizeObserver` and React state, like shutterflow's measured scroller. `mainWidthPxByCell` is `<main>`'s border-box width. `resizeLagMs`: the in-page `resize` event until `<main>`'s width has held its final value for 3 consecutive frames, for 1440 to the cell and back, maximum over the 12 resizes. It includes the 2 frames the rule itself needs, about 33 ms at 60 Hz. `gridToCellMs` adds that every non-last row sums to the container width. The same cells also run with `dock="auto"` for the dock-and-overlay table.

**Bars, fixed before the first measuring.** S1: flicker 0 frames at 0.5 px, seam <= 1 px. S6: 0 lost, 0 wraps, labels and yield order right. S8: Main >= 480 px with the rail collapsed, `resizeLagMs` <= 100.

**Browser.** `chrome` channel via `playwright-core` 1.63.0, as the layout harness does. Chrome 157.0.8103.40.

## Measurements

Two full runs, identical on every pass/fail field. Raw output: `tools/spikes/shell-frame/results/run-1.json` and `run-2.json`.

### S1: sticky band

| Metric                                                                 | Run 1         | Run 2         | Bar         |
| ---------------------------------------------------------------------- | ------------- | ------------- | ----------- |
| `s1.offsetFlicker`                                                     | false         | false         | false       |
| `s1.asideSeamPx` (20 cells with a docked aside)                        | 0             | 0             | <= 1        |
| Paint-time seam, resize sweep (21 observer calls, band height changed) | 0             | 0             | <= 1        |
| Cold `#runs` load, section top minus band bottom                       | 0.16 px       | 0.16 px       | not gated   |
| Anchor jumps reachable (`overview`, `runs`, `latency`), worst          | 0.41 px       | 0.41 px       | not gated   |
| Restored scroll, scrollTop after reload minus before (15 cells), worst | 0 px          | 0 px          | not gated   |
| Control `head`: flicker frames, worst head offset                      | 109, 43.25 px | 107, 43.25 px | must be > 0 |
| Control `mirror`: paint-time seam                                      | 32.5 px       | 32.5 px       | must be > 0 |

What the cells covered (run 1):

- **Scrolling.** `argo` scrolls 2,979 to 4,276 px, `agenda` 2,089 to 2,829, `week` 418 to 769 px except at 1800x1200 where it scrolls only 29 px. `map` and `month` do not scroll at 1800x1200, 390x844 or 1440x560; at 1440x460 their `min` 420 exceeds Main and they scroll 51 px. About 2,000 frames were probed in the scroll and restore passes.
- **Zero everywhere.** Band offset 0 and table head, day header and sticky column offset 0 in every stuck frame, at @1x, @2x and @3x.
- **Restore.** The restored `scrollTop` is already right on the first painted frame (first-frame delta 0 px), and the band never moves.
- **Anchors.** The anchors that can reach the top land within half a pixel of the band's bottom. `errors` and `capacity` cannot: the page ends first, as it would in any page.
- **Fractional band height.** The band text is 13 px / 1.45, so its height is not a whole pixel; `--page-bar-h` carries the fraction and the seam stays 0 at @1x, @2x and @3x (the phone cells have no docked aside, so their seam is not sampled).

### S6: header collapse

Run 1; run 2 is identical.

| Window | Rail      | Shown in the row | In the kebab          | Lost | Wraps | Labels | Breadcrumb px |
| ------ | --------- | ---------------- | --------------------- | ---- | ----- | ------ | ------------- |
| 1024   | expanded  | badges           | progress, import, tag | 0    | no    | short  | 329           |
| 1200   | expanded  | badges, progress | import, tag           | 0    | no    | long   | 240           |
| 1440   | expanded  | all four         | none                  | 0    | no    | long   | 301           |
| 1024   | collapsed | badges           | progress, import, tag | 0    | no    | short  | 449           |
| 1200   | collapsed | badges, progress | import, tag           | 0    | no    | long   | 360           |
| 1440   | collapsed | all four         | none                  | 0    | no    | long   | 421           |

`s6.itemsLost` 0, `s6.wraps` 0, labels right in 6 of 6, quick actions yield before progress, progress before badges in 6 of 6. The sweep (40 widths, 1024 to 1492 in 12 px steps, rail expanded) has no wrap and no lost item. Its tightest point is the breadcrumb at 161 px at window 1300, just past the width where priority 3 returns; the breadcrumb truncates and does not wrap.

### S8: docked inspector

| Window | Rail      | `dock="always"` Main px | Docked | `dock="auto"` Main px | `auto` docks |
| ------ | --------- | ----------------------- | ------ | --------------------- | ------------ |
| 900    | expanded  | 340                     | yes    | 660                   | no (overlay) |
| 900    | collapsed | **516**                 | yes    | 836                   | no (overlay) |
| 1024   | expanded  | 464                     | yes    | 784                   | no (overlay) |
| 1024   | collapsed | **640**                 | yes    | 960                   | no (overlay) |
| 1200   | expanded  | 640                     | yes    | 960                   | no (overlay) |
| 1200   | collapsed | **816**                 | yes    | 816                   | yes          |

`s8.mainWidthPxByCell` is the `dock="always"` column. The rail-collapsed cells (bold) are the ones the bar covers. They are the window minus 64 minus 320, as the arithmetic says: the spike confirms the grid delivers it, with no scrollbar or gutter eating more.

`s8.resizeLagMs`: 42.8 ms in run 1, 43.0 ms in run 2 (maximum over 12 resizes). Per cell it is 35 to 43 ms in both directions, narrowing from 1440 and widening back to it. The justified grid is settled in the same frame as Main's width in every cell (`gridToCellMs` equals the width lag), and every non-last row sums to the container width at rest.

## Verdict

S1: PASS
S6: PASS
S8: PASS

Verdict: PASS

- **S1.** Every sampled frame sits exactly on its offset (bar 0.5 px), through nested layouts, table head, day header, sticky column, anchors, restore and resize; the aside seam is 0 settled and at paint. Both controls fire, so the zeros are measurements. The in-flow band needs no portal region on the shell path.
- **S6.** CSS tiers with the thresholds above hold for shutterflow's full cluster at all six cells: no wrap, nothing lost, labels short only below 1200. The tiers stay as written; nothing is retuned.
- **S8.** `dock="always"` is viable at 900 with the rail collapsed (516 px). Resize lag is at most 43 ms, of which about 33 ms is the 3-frame rule itself. Shutterflow's inspector claim for G5 stands.

Limits of this verdict:

- **Chrome 157 only**, React 19.3.0, the `chrome` channel run headless, mouse-wheel scrolling. WKWebView (shutterflow's host), Safari and iOS are untested; sticky and `ResizeObserver` ordering are exactly where engines differ. S7 and S3 own those devices.
- **Main-thread geometry.** The probe reads layout in `requestAnimationFrame`. A compositor-thread scroll that disagrees with main-thread layout for one frame would not show. The band is `position: sticky`, which the compositor handles, so this is the less likely failure, but it is not measured.
- **The fixture's mirror is the shape in the concept** (a layout effect plus a `ResizeObserver` and React state), not the shell's code. The paint-time seam stayed 0 over 21 observer calls, among them band height changes (`bandChanged` is true in the sweep). That is one fixture, one React version; the control shows the probe would see a 50 ms lag.
- **Rail widths are assumed.** For S8 at window 900 the collapsed rail may be up to 100 px wide before Main falls under 480 (900 - 320 - 480).
- **Anchors.** The last two anchors never reach the top, and `fill` pages scroll 51 px at most, so those paths are lightly covered. `week` at 1800x1200 scrolls 29 px, so its sticky coverage comes from the other four viewports.
- **The header is full width** and the lead is as wide as the rail. A header that starts at the rail's edge gains up to 240 px and only loosens S6.
- **S8 `resizeLagMs`** is measured from the in-page `resize` event. It excludes the delay between the harness's `setViewportSize` call and the page's `resize` event, and it is not a human perception test of a drag: a stepped viewport change, not a continuous drag.
- **Out of scope:** the shell, shutterflow, S2 to S5, S7, S9, and the second-`PageBar` dev assertion (`shell-i4`).

## Then

- **`shell-i3`.** Builds on all three claims as written: the in-flow band with the measured `--page-bar-h`, the CSS tiers on the header container with the thresholds above, `dock="always"` for canvas apps. No refuted-if action applies; `docs/v3/concepts/shell-nav-router.md` is not edited by this spike.
- **Layout suite row.** Keep the paint-time seam check, not only a settled one: `ResizeObserver` on the band, read the aside header bottom, assert <= 1 px. A settled-only assertion would not have caught the `mirror` control.
- **Tier thresholds as data.** The 1280 and 1100 header-content-width thresholds and the kebab at 1280 sit in one CSS block here. The sweep's 161 px breadcrumb at window 1300 is the number to watch if a consumer adds a header item.

## Affects

- `docs/v3/concepts/shell-nav-router.md`: section 6 rows S1, S6, S8 get this verdict; the owner of the concept edits them.
- `shell-i3` (shell frame, band, header, aside), which this feeds.
- G5 (shutterflow Photos at 1024x700): the inspector claim stays.
- Nothing else: no `package.json` or lockfile outside `tools/spikes/shell-frame/package.json`.
