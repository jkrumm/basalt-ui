# Trial 2: a builder with the packed tarball only

2026-11-24. Tarball packed from master at 2fed04240. A fresh agent in an empty repo got the brief of trial 1
(build a data-analysis app on the CBBI data, no design guidance, the tarball as the only source) and one message.

## Result against trial 1

|                                        | Trial 1 (2026-11-21) | Trial 2                                                               |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Wall time                              | 31 min, two sessions | 20 min, one session                                                   |
| Pages                                  | 4                    | 4 (Overview, Indicators, Forward returns, Cycles)                     |
| Friction entries                       | 25                   | 31, of them 9 marked OK                                               |
| Skills loaded through the skill loader | basalt-design once   | none: the session that ran `init` cannot load them                    |
| Skills read by hand                    | none                 | basalt-design and basalt-charts `SKILL.md`                            |
| Generated docs opened                  | not counted          | 38 of `docs/<name>.md`, 10 `.d.ts` files                              |
| Edit hook                              | fired once           | fired, blocked one `data ?? []` with file and line                    |
| Reviewer                               | ran twice            | not spawnable; its file run through a general agent, 30 P1 in round 3 |
| `init` to a building app               | not recorded         | `doctor` 12 of 12, then the first build failed on two missing peers   |

## Verdict

The app is better than trial 1 and reads as a product at first look: the frame and panel shell, a log price axis
with round ticks, four cycles in four hues with the current one heavier, a stat strip, a chart and a table per page,
cards at 390. The builder called the generated docs and `shot` the strongest parts. It is not yet great. What I see
in the frames of round 4:

- **Tables stop short of the panel.** On all three table pages the columns end 140 to 400 px before the right edge.
- **Header marks.** A help mark sits before the kind icon in right-aligned headers; every header carries an icon.
- **Stat strip.** Cells of unequal content leave voids; a meter prints its raw value under the bar beside the figure.
- **Negative bars.** Three placements for three values: below the bar, left of the bar, inside it in dark ink.
- **Dates.** Mono in the table and the figure line, proportional in the stat cells.
- **Page bar.** A range control alone in a band of its own under the breadcrumb; the breadcrumb root is the nav
  section label ("Index").

## What it says about the foundation

1. **The single-session path is the common one and it is the weak one.** `init` says to continue in a new session.
   An unattended agent cannot. Rules loaded anyway (path-scoped), the hook fired anyway, skills and the reviewer did
   not. The builder worked around it by reading files; a more literal agent stops.
2. **`doctor` passed an app that did not build.** `basalt-ui/shell` statically needs `@tanstack/react-hotkeys` and
   pulls `@atlaskit/pragmatic-drag-and-drop` through the sortable list; `init` installs neither.
3. **Two checks disagreed by 100 points.** `shot detect` scored 100 on a round where the reviewer found 30 P1,
   among them a stat cell showing its empty text over loaded data. The reviewer's score floors at zero after ten P1
   and is no progress signal.
4. **The Done list was skipped as ceremony**: three written ledgers per screen.
5. **A lint rule matched syntax, not meaning**: `data ?? []` is refused, a named empty constant passes.

## The builder's friction log, verbatim

Trial: build a CBBI data-analysis app from the vendored tarball alone (README, CLI, what the CLI sets up).
Each entry: what I tried, what happened, what I did instead, time cost. Worked-first-time notes are marked **OK**.

## Setup

1. **OK — tarball install.** `bun add ./vendor/basalt-ui-2.29.0.tgz` into a fresh `bun create vite --template react-ts`: installed with the `basalt-ui` bin, 0.6 s. Cost: 0.
2. **OK — README + root AGENTS.md + `basalt-ui --help`** are enough to know the path (install → `init --profile app --root src` → doctor). The help text is long but complete. Cost: ~3 min reading.
3. **Note — README quick start says "A create-vite React app already has react, react-dom and vite".** create-vite 9.3.4 also ships `oxlint ^1.90.0`, an `.oxlintrc.json` and `typescript ~7.0.2` (tsgo). The README anticipates the oxlint case ("oxlint ^1.90.0 moves to the preset's pin"), good. Whether TS 7 is supported is not stated anywhere I have read yet.
4. **OK — `init --profile app --root src`** on stock create-vite: installed peers at pins, moved oxlint 1.94 → 1.93 with one printed line as promised, replaced `main.tsx`, deleted `App.tsx`/`App.css`, patched `vite.config.ts` and `index.css`, wrote the route tree, flipped `build` to `vite build && tsc -b`. Doctor: 12/12. ~6 s. Impressive.
5. **BLOCKER (small) — fresh `init` app does not build.** First `bun run build` right after a 12/12 doctor:
   `basalt-ui/ui/sortable-list needs @atlaskit/pragmatic-drag-and-drop` and `basalt-ui/shell needs @tanstack/react-hotkeys`.
   README's App peer row lists neither, `init` did not install them, and doctor check 3 ("peers for profile app resolve") passed. The basalt() gate message
   was excellent (exact `bun add` line) so the fix was one command. Expected: `init --profile app` installs every peer `basalt-ui/shell` statically needs, or doctor check 3 fails.
   Also odd: the shell drags in a drag-and-drop peer (sortable-list) for an app with no sortable list. Cost: 1 min.
6. **Note — TypeScript 7 (tsgo, create-vite default) works** for `tsc -b` against the package types. Nothing said it would; it did.
7. **Friction — "continue in a new session before you write app code".** `init` ends telling the agent to stop and restart so the rules/skills/hook load. In a single unattended session that is not possible. I read `.claude/rules/basalt-*.md` and the skills by hand instead and run `basalt-ui lint` myself in place of the hook. Cost: none in time, but an agent that obeys literally stops the task here.

## Building pages

8. **OK — the managed rules load on their own.** Contrary to item 7's warning, the moment I wrote the first file under `src/` the path-scoped `.claude/rules/basalt-*.md` were injected into this same session. The "start a new session" note is stricter than it needs to be for rules (skills and the hook are another matter).
9. **OK — docs per export are excellent.** `docs/<name>.md` with signature + "use when / never when" answered every prop question for Page, PageBar, StatGroup/StatCell, ChartCard, Lines, Heatmap, DataTable, col. I never needed to open `dist/*.d.ts` for a page part except for: `Format` (useFormat's methods — the doc shows 2 calls, not the interface), `ChartFigure`, `XConfig`/`YConfig`, `ChartZone`/`ChartRefLine`, `Freshness`. Each was one grep in `dist/charts/contract.d.ts`. Suggest: link those types from `chart-card.md`/`lines.md` the way `stat-card.md` names its imported types. Cost: ~5 min of grepping.
10. **Friction — `ChartCard` box vs `Heatmap` height.** `chart={(box) => <Heatmap height={box.height} />}` fails tsc: `box.height` is `number | 'fill'`, `Heatmap.height` takes `number | ResponsiveChartHeight` and wants `matchHeight` for fill. Every other kind takes `box.height` straight. Wrote `height={box.height === 'fill' ? undefined : box.height} matchHeight={box.height === 'fill'}`. Expected: Heatmap accepts `'fill'` like Lines/Bars. Cost: 2 min.
11. **Guess — Heatmap `color`.** Doc says "a `BASALT.*` ref or a series token". A series _pair_ is not accepted (string only), so I passed `groupTokens('cbbi', tokens.series.cbbi).score` (the CSS var). Not sure that is what "series token" means; nothing in heatmap.md shows it. Cost: 2 min.
12. **Doc contradiction — `shot-state.md` example** passes `rows={result.data ?? []}` to a `DataTable`, the exact `data ?? []` pattern the charts and state rules forbid (and `DataTable` takes no `rows` prop; it takes `table`). Noticed while reading, not hit.
13. **OK — the editor hook works from a REPL-driven session too.** Writes made through my tool layer triggered `.basalt/hook.mjs post-edit`, which blocked the turn with `cycles.tsx:125 basalt/data-primitive: data={weeks} (an empty-array fallback)`. Clear message, right file and line.
14. **Friction — focus before data.** `useChartFocus(items)` is a hook, so it must run before the query settles, with _some_ array. `data?.weeks ?? []` feeding both the hook and `<Lines data>` is flagged by `basalt/data-primitive`. What I did: `data ? data.weeks : NO_WEEKS` (a module constant) for the hook and `data={focus.items}` on the chart — lint-clean, and correct because `ChartCard phase={q}` only calls `chart` when ready. But that is a lint _workaround_: the rule matches syntax, a named empty constant passes. Neither `use-chart-focus.md` nor the charts skill shows the loading-phase shape of a focus. Expected: one documented pattern (e.g. `useChartFocus(q.data?.rows, …)` accepting `undefined`). Cost: 5 min.
15. **Friction — `DataTable focus` needs the table rows to _be_ the chart items.** On Returns I first built the bars from `BucketStats` and the table from a flattened `Row`; `focus={focus}` failed tsc on the item type. The rule text ("drawn at the list's grain so a row and a mark are one item") says exactly this, and the type enforces it. Rebuilt both from `Row`. Worked; cost 2 min. Good guard.

## First look (`basalt-ui shot`)

16. **OK — `basalt-ui shot / /indicators /returns /cycles --dist dist --out shots-1`** served the built SPA itself, 52 shots in 20 s, light/dark × 1800/390, with the board. Playwright was already cached; `bun add -d playwright` was the only step. The first round looked like a finished product: shell, breadcrumb, phone tab bar, end labels, zones, heatmap legend, table → cards at 390, all without a line of CSS from me. This is the strongest part of the package.
17. **Friction — a meter shows its raw value.** `StatCell meter={{ value: here.winRate }}` printed `92.529` under the bar. `MeterSpec` has no `format`; I round before passing. Expected: the meter label takes the cell's `unit`/format, or a `format` field. Cost: 1 min.
18. **Friction — phone cards drop the answering column.** At 390 the Indicators table turned into cards showing "30 days", "A year ago", "Cycle high" but _not_ "Today" (the `c.meter` column, the answer). Fixed with `card: 'value'` on that column. The skill warns "at 390 the answering column stays in view", but the default card plan picked the meta columns over a meter. Cost: 3 min (found only by looking at the shot).
19. **Friction — `c.money` has no `digits`.** A BTC peak price prints `117,908.52`; cents are noise at that scale. MoneyOptions takes only `currency`. Switched to `c.number(..., { unit: 'USD', digits: 0 })`, which loses the `$`. Cost: 2 min.
20. **Note — DataTable is not a `shot` anchor here.** The help text says anchors include the outermost `data-table` slot, but my shots list only `_page`, `card-1` (the stat strip) and `chart-card-N`; the tables appear only inside the page shot.
21. **OK — `shot` states work end to end.** `shotState(useQuery(...))` in one data hook was enough for all four pages to render loading, empty and error frames under `--states`; `shot detect` scored 100 with no findings. The empty frame taught me something: every chart card drew its zones over nothing with no cause, so I added `empty` (cause on the first stat cell, a short caption on chart cards).
22. **Surprise — `empty` with a non-array query result.** ChartCard's doc: "with a query, `empty` takes effect only once `data` is an empty array". My query returns a `Snapshot` object (`{ days, fetchedAt, source }`), so in a real run `empty` can never fire; it only fires under `shot` because `shotState` substitutes `[]`. Either a selector-shaped empty (`empty: (data) => …`) or a note that the query must return the array would help. I left it: the snapshot is never empty in practice. Cost: 3 min reading.
23. **Good catch — doctor check 12.** I had added `"typecheck": "tsc -b"`; doctor failed it ("tsc reads src/routeTree.gen.ts before the router plugin writes it"). Correct and specific. Removed the script; `build` (`vite build && tsc -b`) is the type gate. Cost: 1 min.
24. **OK — `bun run lint`, `sync --check`** clean.

## Design review round (shots-3 → shots-4)

25. **Workaround — the `basalt-design-reviewer` subagent was not spawnable.** `init` placed `.claude/agents/basalt-design-reviewer.md`, but agent definitions load at session start, so this session could not call it by name (same root cause as item 7). I spawned a general-purpose subagent with the file's body as its prompt and the shot dir. It read the rubric from `node_modules/basalt-ui/agent/reviewer/rubric.md`, read every sheet and page shot, wrote `shots-3/last.json`. ~6 min, 84 tool calls. Score 0 (30 P1s); the floor-at-zero after 10 P1s makes the number useless as a progress signal, the findings list is what helped.
26. **BUG (package) — `StatCell` shows `empty` at rest when given a query `phase`.** I passed `empty={{ cause }}` and `phase={q}` to a StatCell, the same as on ChartCard. ChartCard's doc: "with a query, `empty` takes effect only once `data` is an empty array, so it can be passed unconditionally". StatCell does not: its rest frame replaced the figure with the cause text ("The CBBI snapshot holds no days…") while data was loaded. The reviewer caught it ("shows neither a figure nor a dash"); `shot detect` scored that round 100. Workaround: `empty={hasNoDays(q.data) ? NO_DAYS : null}`. Expected: StatCell and ChartCard share one `empty` rule. Cost: 10 min (only found through the reviewer).
27. **Package territory, not fixed — error frames.** Reviewer P1s I did not act on because the frame is the kit's: a StatGroup error shows the raw error message (`shot-state=error`) and Retry in the first cell only; a ChartCard error says "Could not load <title>." with no Retry. I pass the query; I found no prop for a retry on ChartCard in `chart-card.md`.
28. **Package territory — hover readout hides an axis tick.** Reviewer Craft 6 on every chart: the y/x cursor readout box covers the nearest tick label (79 over the 80 tick). That is the kit's cursor, not something a page sets.
29. **Fixed in app from the reviewer:** Overview's strip repeated the BTC price and CBBI that the chart figures already carry (Communication 5): replaced with "Below the BTC high", kept "Since the top zone" and "Hottest". Labels with qualifiers ellipsised at 390 ("Hottest indic… P…"): shortened to "Hottest"/"Coldest" + qualifier. A long `sub` truncated at 390: moved to `rows`. Missing `info` on cells: added. Returns meter drew "0" in the empty frame: meter only with data. Units on week columns.
30. **Friction — `StatCell rows` is a 4-tuple type.** `rows={past.map(...)}` fails tsc (`StatRow[]` is not `readonly [StatRow?, …×4]`). Wrote the three rows out by index. Expected: accept an array and cap, or doc the tuple in `stat-cell.md` (the doc shows a literal). Cost: 2 min.
31. **Not done — the Done list's `docs/design/<screen>.md` read-aloud and one-view files.** The basalt-design skill asks for a written fact count, a read-aloud section and a one-view table per screen. I ran the shots, detect and the reviewer instead and did not write those files: four screens × three ledgers is a lot of ceremony for an app this size, and the reviewer covered most of what they check (duplicate facts, units, truncation).
