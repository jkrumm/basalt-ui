# Spike: fleet census (F1 symbols and tags, F4 hand-rolled copies)

F1 passes: 6 of 1,838 items are unmapped (0.3%) and the symbol sum after extras is 95. F4 is refuted by one row of section 10, `board-drag-schedule`, which has 3 confirmed copies across 2 repos. The three copies are three different things, so the row's reach is narrower than its name. Optimistic updates have 3 copies: keep `optimistic`.

Harness: `bun tools/spikes/census/run.ts` (one JSON object on stdout, exit 0 means the harness ran). Two outputs are attached as `tools/spikes/census/runs/run-1.json` and `run-2.json`; they are byte-identical (`cmp`). Contract: `docs/v3/ARCHITECTURE.md` sections 3, 10 and 11 (F1, F4).

## Question

- **F1.** Does the section 3 surface (91 symbols, plus the extras the contract names) answer what argo imports and what the fleet renders from `@mantine/*`? Refuted if more than 10% of the items are unmapped, or the symbol sum after extras passes 100.
- **F4.** Does any refusal of section 10 have 3 or more hand-rolled copies outside basalt-ui? If so it is reinstated before the freeze. Also S4 of `state-persistence-forms.md` section 9: how many hand-rolled optimistic updates exist (2 or more keeps `optimistic`).

## Method

Static scan by TypeScript AST (`typescript` 6.0.3, pinned in the harness `package.json`). Nothing is built, started or written in a consumer. No browser is involved, so the playwright-core pattern of the layout harness is not used. 12 consumers under `~/SourceRoot` (argo, rb, linewatch, shutterflow, weatherorb, finances, email-gateway, image-gateway, rollhook, basalt-ui-obsidian, jkrumm.com, `software-factory/apps/console`) plus the Epos teamchat `ui` as a 13th, reported as counts only and never added to a verdict.

**Scope.** Source files `.ts .tsx .mts .cts .js .jsx .mjs .cjs`, not `.d.ts`, not `*.gen.ts`, not test paths (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `e2e/`, `__tests__/`, `__mocks__/`). Skipped directories: `node_modules dist dist-* build out .git .claude .output .next .astro .turbo target coverage .svelte-kit vendor var`. Symlinks are not followed; files over 1 MB are skipped. A module is one source file. Public ids are the first 8 hex of `sha1(repo:path)`; no path appears in the output unless `CENSUS_NAMES=1` is set locally.

**F1, signatures (rule fixed before measuring).** Documented = every `Signature:` line of argo's installed `node_modules/basalt-ui/llms.txt` (2.29.0). Used = a documented name imported by name from `basalt-ui` or `basalt-ui/*` anywhere in `apps/dashboard`, including tests and `vite.config.ts`. The 81st name, `defineFormat`, is imported by a test file, which is why tests count here (and only here). Each used name is classified in this order:

1. `kept`: a section 3 symbol (the 91 of the section 3 table, plus the names of the Primitives paragraph).
2. `mapped`: an entry of `mapping.json` whose `anchor` string is present in the cited contract doc (`concepts/*.md` or `ARCHITECTURE.md`, never evidence) and, for kind `symbol`, whose target is a section 3 symbol. A failed anchor would count as unmapped; none failed. `mapping.json` also carries the F1 extras, and a family rule for `basalt-ui/format` (all format functions go to `useFormat`/`createFormat`, `quality-contract.md`).
3. `unmapped`: nothing above.

`mapped` includes names the contract drops with an instead (kinds `drop`, `replace`): a documented migration row is an answer, even when argo must rewrite the use.

**F1, tags.** A tag is a JSX element whose root identifier is imported from `@mantine/*`, counted by its Mantine export name (`Table.Td` is `Table`). Layout tags are `Stack Group Flex Center Box Text SimpleGrid`; the rest are component tags. A component tag is mapped when its name is in column 1 of the first table of `primitives-distribution.md` section 9 (or in the one alias of `mapping.json`: `ModalsProvider` to the `@mantine/modals` row).

**F1 total (primary rule, fixed before measuring).** `f1.total` = used signatures + component tags, by occurrence. `unmappedShare` = unmapped over total. Sensitivities are reported beside it: by distinct name, and signatures alone. `symbolSumAfterExtras` = 91 + the extras that have no section 3 row.

**F4.** `refusals.json` fixes the signatures per row of section 10 before any count: each item is a conjunction of predicates (`import`, `decl`, `call`, `ident`, `jsxAttr`, `path`, `dep`); `decl` is a declared function, class or variable name, and type aliases and interfaces do not count because they implement nothing (counting them would add 4 `agent-runtime` and 4 `board-drag-schedule` hits on names like `ChatMessage`). Items with role `copy` count toward `copies`; items with role `lib` (a consumer using an off-the-shelf equivalent) are reported as `libModules` only. A refusal's `copies` is the distinct modules matching any of its copy items. The row "Exported styled parts for shell and controls" is not re-implementable and is marked not applicable.

**Review pass.** Every signature hit was read in source and the false positives are listed in `review.json` (module ids and a one-line reason; all other hits stand). The output carries both `signatureHits` (before review) and `copies` (after). The verdict uses `copies`. Two corrections to the scan came from the first run: weatherorb keeps minified build bundles of Mantine under `var/` and `dist-*` directories, which inflated the websocket and RTL signatures to 30 and 27 modules; those directories are now skipped. Nothing else was tuned to move a number.

**Epos** is scanned with the same signatures and reported as counts. It is not reviewed, so its numbers are signature hits.

## Measurements

Each number comes from `bun tools/spikes/census/run.ts | jq '<path>'`.

**F1, signatures** (argo, `llmsVersion` 2.29.0)

| Number                        | Value | Extraction                                                                                                                   |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| Documented signatures         | 124   | `jq .f1.argo.documented`; raw: `grep -c '^Signature:' ~/SourceRoot/argo/node_modules/basalt-ui/llms.txt`                     |
| Used (`f1.argo.signatures`)   | 81    | `jq .f1.argo.signatures` (reproduces `consumer-argo.md` 1.3)                                                                 |
| Kept (same name in section 3) | 32    | `jq .f1.argo.kept`                                                                                                           |
| Mapped                        | 43    | `jq .f1.argo.mapped`; by kind `jq .f1.argo.byKind` (symbol 23, replace 10, drop 4, extra 3, ui 2, tooling 1)                 |
| Unmapped                      | 6     | `jq .f1.argo.unmappedNames`                                                                                                  |
| Mapped on a judgement cite    | 2     | `jq .f1.argo.judgement` (`StatusDot` to `ui/status`, `setColorScheme` to `setScheme`; the cite does not name the 2.x symbol) |

Unmapped names: `CONTAINER_GRID_BREAKPOINTS`, `SettingsSection`, `ShortcutsHelp`, `basaltViteConfig`, `defineNotifications`, `groupTokens`.

**F1, tags** (fleet of 12)

| Number                                  | Value                                        | Extraction                                                                 |
| --------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| Mantine tags, all                       | 4,312                                        | `jq .f1.tags.total` (documented 4,310)                                     |
| Layout tags                             | 2,555                                        | `jq .f1.tags.layout` (documented 2,555)                                    |
| Component tags                          | 1,757                                        | `jq .f1.tags.component` (documented 1,755)                                 |
| Unmapped component tags                 | 0                                            | `jq .f1.tags.unmapped`; 72 distinct names, 0 unmapped                      |
| Names under a "No answer in basalt" row | `@mantine/schedule`, `WeekView`, `MonthView` | `jq .f1.tags.noAnswerNames` (argo only; DPO 10 sends them to app code)     |
| Epos                                    | 0 Mantine tags in 0 files                    | `jq .f1.tags.epos`; 570 source files scanned (`jq .scan.epos.sourceFiles`) |

`jq .f1.tags.byApp`, component tags: argo 342, shutterflow 675, image-gateway 190, rb 232, weatherorb 125, email-gateway 102, linewatch 82, obsidian 9; finances, rollhook, jkrumm.com and console 0. The two documented figures are reproduced to within 2 tags (a newer commit of the apps).

**F1, totals**

| Number                            | Value                                                               | Extraction                            |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| `f1.total`                        | 1,838 (81 + 1,757)                                                  | `jq .f1.total`                        |
| `f1.unmapped`                     | 6                                                                   | `jq .f1.unmapped`                     |
| Unmapped share                    | 0.0033                                                              | `jq .f1.unmappedShare`                |
| By distinct name                  | 6 of 153 (0.0392)                                                   | `jq .f1.distinct`                     |
| Signatures alone                  | 6 of 81 (0.0741)                                                    | `jq .f1.signaturesOnly`               |
| Section 3 table symbols           | 91, matches "Sum 91 of 100"                                         | `jq .f1.section3`                     |
| Extras without a section 3 row    | `StatStripCell`, `overlays`, `createColumnHelper`, `CONTAINER_KEYS` | `jq .f1.extras`                       |
| `f1.symbolSumAfterExtras`         | 95                                                                  | `jq .f1.symbolSumAfterExtras`         |
| If the 6 unmapped were also added | 101                                                                 | `jq .f1.symbolSumIfUnmappedAlsoAdded` |

`PageSummary`, `EventList`, `EmptyState` and `alpha` already have a section 3 row. Three of the four extras without a row have a rename target in a concept doc (`createColumnHelper` to `col`, `StatStripCell` to `StatCell`, `overlays` to `defineOverlays`); the sum counts them as additions anyway, the worst case.

**F4** (12 consumers; `jq '.f4.byRefusal["<id>"]'`)

| Refusal id                                 | Signature hits | Copies after review | Repos | Library modules |
| ------------------------------------------ | -------------- | ------------------- | ----- | --------------- |
| `agent-runtime`                            | 2              | 0                   | 0     | 0               |
| `board-drag-schedule`                      | 4              | 3                   | 2     | 4               |
| `tree-stepper`                             | 0              | 0                   | 0     | 2               |
| `runtime-theming`                          | 0              | 0                   | 0     | 0               |
| `cli-verbs`                                | 0              | 0                   | 0     | 0               |
| `form-hook-and-peer`                       | 0              | 0                   | 0     | 0               |
| `state-nav-palette-toast-markdown-hotkeys` | 3              | 2                   | 2     | 5               |
| `chart-kinds`                              | 2              | 0                   | 0     | 0               |
| `dropped-before-ship`                      | 2              | 2                   | 1     | 0               |
| `styled-parts-for-shell-and-controls`      | not applicable | 0                   | 0     | 0               |
| `realtime-transports`                      | 5              | 0                   | 0     | 0               |
| `guards-registry-mcp-rtl-i18n`             | 0              | 0                   | 0     | 2               |

Review rejections (`review.json`, 11 modules): third-party chat data in the agent-runtime hits; a per-row daily bar chart named `Timeline` in a board hit; all five `realtime-transports` hits are Chrome DevTools Protocol clients in dev scripts and one ingest tool; a lazy alias of the palette counted twice in one repo; a local variable named `bucketOther`; a stacked-bars component that is not a refused kind.

The `board-drag-schedule` copies are three modules in two repos: an HTML5 drag reorder list, a pointer-capture time scrubber, and a read-only dated-rows time axis. Per item the counts are 1, 1 and 1 (`perItem`: `html5-drag-and-drop`, `pointer-capture-drag`, `own-timeline-or-schedule`). The 4 library modules are argo's `@mantine/schedule` week and month views.

`jq .f4.optimisticCopies` is 3 in 2 repos (argo, rb): a mutation with `onMutate` that writes the query cache. `jq .f4.optimistic.perItem`: `rq-onmutate-cache-write` 3, `named-optimistic` 0.

**Epos (counts only, unreviewed signature hits)** `jq .f4.epos`: `agent-runtime` 10, `state-nav-palette-toast-markdown-hotkeys` 5, `board-drag-schedule` 3, `chart-kinds` 1, `guards-registry-mcp-rtl-i18n` 1, `tree-stepper` 1, optimistic 1; the rest 0. `jq .f4.watch` lists the refusals that would cross 3 with Epos added: `agent-runtime` and `state-nav-palette-toast-markdown-hotkeys`.

## Verdict

F1: PASS
F4: REFUTED
Optimistic: keep

Verdict: REFUTED

F1 by the rule: 0.0033 unmapped against 0.10, and 95 symbols against 100. F4 by the rule: `board-drag-schedule` has 3 confirmed copies. `run.ts` prints the same four lines under `verdictLines` and `verdict`.

## Then

The orchestrator amends section 3 and section 10 from this verdict; this spike amends neither.

**reinstate before freeze** (rule, F4): `board-drag-schedule`.

Read it with the caveat above. The rule counts a table row, and this row bundles four refusals. Each of the three copies is a different item and no item has more than one, so the row's name overstates the demand; the Cut tests also ask for no 20-line recipe and a type or rule that guarantees it, which this count does not address. The two other tracked rows stay under 3: `state-nav-palette-toast-markdown-hotkeys` at 2 (a command palette and a toast queue) and `dropped-before-ship` at 2 (`useSettle`, `safeToReload`, one repo). With Epos added, `agent-runtime` (10 signature hits there) and `state-nav-palette-toast-markdown-hotkeys` would cross 3; that is a watch item, not part of the verdict.

**Optimistic: keep.** `optimistic` stays in `./data`.

**F1 follow-ups** (the verdict is PASS, these are findings):

- The 6 unmapped argo names need a migration row or a decision, none needs a new symbol on the evidence: `CONTAINER_GRID_BREAKPOINTS`, `groupTokens`, `basaltViteConfig` (tokens and tooling, likely `tokens:css` and `basalt()`), `ShortcutsHelp`, `SettingsSection`, `defineNotifications`. By signature alone the share is 7.4%. `ThemeToggle` has a rewrite row in `tokens-visual.md` (to a scheme module) and is mapped as `replace`.
- `StatusDot` and `setColorScheme` are mapped on a judgement cite; a row in the concept docs would make them firm.
- `WeekView` and `MonthView` have a section 9 row whose answer is "No answer in basalt" (DPO 10).
- If every unmapped name were added as a symbol, the sum is 101 and exceeds the ceiling of 100: do not do that.

## Affects

- `docs/v3/ARCHITECTURE.md`: section 10 (the `board-drag-schedule` row, the three copies, and the per-item counts above), section 11 (F1 and F4 results), section 3 (the 4 extras counted in the sum of 95).
- `docs/v3/concepts/migration-release.md`: migration rows for the 6 unmapped argo names.
- `docs/v3/concepts/state-persistence-forms.md` section 9, S4: 3 optimistic copies, keep.
- Re-run after any change to section 3, section 9 or the consumers: `bun tools/spikes/census/run.ts`.
