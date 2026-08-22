# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-08-22**. Per-release narratives older
> than 1.19 moved to `docs/archive/STATUS-HISTORY.md`; the rest of `docs/archive/` is superseded
> scope ledgers. This file is what's true now.

**Published version: read it, don't trust a doc.** `npm view basalt-ui version` for what is on npm,
`packages/basalt-ui/CHANGELOG.md` for the release notes, `packages/basalt-ui/MIGRATING.md` for the
breaking half. What `master` carries beyond it is `git log $(git describe --tags --abbrev=0)..master`.

_This line used to name the published version and was wrong three rounds running — structurally, not
by neglect: the docs pass runs before the release and `chore: release` lands after, so any number
written here is stale before a consumer reads it. Version numbers elsewhere in this file mark **when
a capability landed**, which does not rot._

## TL;DR

Everything below this line is built. Nothing in this document is a plan — but the last row may not
be released yet; the version column says when a capability landed, not what npm serves.

| Capability                                                                                             | Shipped                        |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 1.0 Mantine pivot, 1.x line live                                                                       | 1.0.0                          |
| Theme config closed — all four `createBasaltTheme` dimensions (`derive`, `fonts`, `radius`, `density`) | 1.2.0                          |
| Framework-free tokens — `basalt-ui tokens:css`, `basalt-ui/tokens.css`, `only: 'core'`                 | 1.3.0 (kebab-case names 1.5.0) |
| `mantine-shade-index` promoted to `error`                                                              | 1.11.0                         |
| Chart-layer rebuild — `CartesianChart` as the one mandatory primitive                                  | 1.15.0                         |
| Chart-API consumer rounds one / two / three                                                            | 1.16.0 / 1.17.0 / 1.18.0       |
| Native mobile nav + `defineNav`                                                                        | 1.19.0                         |
| Round-4 batch — usable escape hatch, guard holes closed, toolchain false-greens fixed                  | 1.20.0                         |
| Round-5 batch — `theme-allow` grammar, `linkSearch`, waiver audit                                      | 1.21.0                         |
| Round-6 batch — `sync` refuses, the audit's oxlint half, `lefthook dump`                               | 1.22.0                         |
| Round-7 batch — two banded chart kinds, an x-tick seam, CLI resolution                                 | 1.23.0                         |
| Round-8 batch — the band-state throw, the tag-provenance gate, a CLI that answers                      | 1.23.1                         |
| Round-9 batch — `QueryState`, table body chrome, four false greens                                     | unreleased                     |

Adopted downstream: seven consumer repos, all on 1.23.1 as of the round-9 sweep. `rollhook` runs
the framework-free route with no Mantine and no React (`docs/FRAMEWORK-FREE.md`);
`basalt-ui-obsidian` is a downstream _library_, not an app.

The June-era roadmap/handover docs in `docs/archive/` still phrase built work as "remaining"; that
language is historical, see the banner on each.

## Round-9 consumer sweep (2026-08-22)

Seven repos on 1.23.1. **No finding forced a change in any of them; no waiver tally moved** — argo
8, linewatch 3, rb 5, `basalt-ui-obsidian` 1, rollhook 1, image-share 0, image-gen 3, all 0 dead and
0 unjudgeable. Every fix the release claimed was measured as delivered. What round 9 found is one
class: **a green that was reachable by standing in the wrong directory.** Full reports:
`.claude/feedback/round-9/`.

| Found                                                                                                                                                                                                                                                                                                                | By                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `check-theme` from a package with no `basalt` key **invented** `roots: ["src"]`, reported the invention as `basalt.roots`, and passed silently — the mirror of the `doctor` case 1.23.1 had just fixed. `--audit-allows` therefore reported **0 live waivers in a repo carrying 1**: 22 of 44 files, exit 0, no note | argo; obsidian sharpest; rb, image-gen reproduce |
| `tokens:css --check` excludes the WHOLE provenance line — which carries the invocation line 1 tells you to regenerate with. `--only core` rewritten to `--only all` passed clean                                                                                                                                     | rollhook                                         |
| The same success message asserts the file "still names an older basalt-ui" without parsing it: `0.0.1-nonsense` got the same sentence                                                                                                                                                                                | rollhook                                         |
| `doctor`'s icons check is unreachable from the only directory where `doctor` exits 0 — omitted from the root run with no `⊘ SKIPPED`                                                                                                                                                                                 | rb, argo                                         |
| `.astro`/`.jsx`/`.vue` are not scannable: rollhook's two `.astro` templates are its whole markup layer, unguarded, under a clean 4-file scan                                                                                                                                                                         | rollhook                                         |
| `README.md:783-786` prescribes `bunx basalt-ui sync --check` **under a comment claiming that is what `init` seeds** — three repos hand-fixed that exact line last round                                                                                                                                              | all seven                                        |

**Not fixed, filed:** `--audit-allows` has no verdict for plain `basalt.exempt`, the stronger of the
two waivers. argo's one `exempt` entry is byte-identical to the built-in default and nothing says
so. Suggested: `redundant — identical to the default`, `dead — matched no scanned file`.

## Round-9 batch — unreleased

Two `feat:` commits and two `fix:`. Per-export detail in `packages/basalt-ui/MIGRATING.md`
§ `Unreleased`.

- **`QueryState`, and the branches around it** (`91f612f`; playground routes `a299813`) — the
  app-layer ask image-share and argo ranked first for four rounds. Shipping `EmptyState` and nothing
  for the other three branches was a **correctness** gap: image-share's library rendered `No images`
  on a 500 and a share detail rendered `Share not found` on a dropped connection, until 204
  hand-rolled lines over 10 call sites stopped it. A component, not a hook — the product IS the
  precedence, and a hook returns the same four-way switch to every call site. It lives under
  `src/dashboard/` because `check-dist-layering.mjs` keeps `dist/query/index.js` Mantine-free, and
  types `query` as a five-field structural subset; that subset removes the compiler, so **the shape
  is asserted at runtime and a missing `isError` throws** — precisely the "500 renders _No images_"
  bug. `LoadingState`/`ErrorState` ship beside it, `toErrorMessage`/`errorStatus` land on `./query`
  with two live bugs fixed, and `EmptyState.description` becomes optional. **Port: image-share
  2467 → 2221 total, code-only 2056 → 1882 (−174), `query-state.tsx` 204 → 0 — all 10 sites plus a
  standalone `ErrorState` by changing one import line each, zero renames, prop changes or casts.**
- **`BasaltDataTable` body chrome — and the result that did not go the promised way** (`91f612f`) —
  `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `meta.align`, `meta.numeral`, and the
  Mantine passthroughs. **argo's three tables came out 341 → 370–379 lines. 29–38 LONGER.** argo named these
  props as the reason the tables stayed hand-rolled; adding them shortened nothing, because column
  defs cost more than JSX rows when every cell is bespoke — eight accessor blocks at 4–6 lines each
  against an eight-`<Table.Td>` row at ~3. **The ask was mis-specified**, which is the counterexample
  to the band kinds and the reason the port-before-shipping rule earns its keep. What the port does
  buy is ownership — the `type="native"` footgun, the alignment duplication (`textAlign: 'right'` on
  both `th` and `td`, six times in one file), and sorting/filtering/pagination. `maxHeight` renders
  `Table.ScrollContainer type="native"`, and `agent/rules/basalt-data.md` now prescribes that same
  node for a bespoke table, so the two lanes are provably the same DOM and `type="scrollarea"` — which
  breaks a sticky `thead` — is unreachable through the props; `align` is a `ColumnMeta` augmentation, so a typo'd key is a tsc error and a wrong
  value throws. **Known, not shipped:** `emptyState` renders in a `<td colSpan>` so the header
  survives an empty table (no `replace` mode); no per-column `enableSorting` of basalt's own.
- **The four false greens** (`08c17df`) — `check-theme` ascends instead of fabricating a config and
  says so in descend's own sentence (obsidian's `apps/demo`: 22 of 44 files and a 0-waiver audit
  becomes 44 and the real 1); `tokens:css --check` neutralizes only the version TOKEN, so the
  regeneration command is gated again and the success message parses both versions instead of
  asserting one; `doctor` resolves the icons check off `basalt.roots` and reports `⊘ SKIPPED` rather
  than vanishing; `SCANNABLE_EXT` gains `.astro`/`.jsx`/`.vue`. **Behaviour change:** `sync` shares
  the resolver, so from a sub-package it relocates to the parent install and refreshes it rather than
  refusing — it still cannot scaffold a second consumer.
- **The two defects the widening exposed** (`859a5d3`) — `raw-hex` read `&#123;` as `#123`. The hole
  was in the KIND, not the extension (same string, same findings in `.html`/`.tsx`/`.css`/`.vue`);
  `.astro` only walked into it first. `HEX` now rejects a full character reference, so
  `color: red&#fff` still flags and nothing is exempted by file type; every neighbouring raw-text
  kind was probed and structurally cannot share the blind spot. `.astro`/`.vue` resolve as a fourth
  `sfc` syntax stripping BOTH regions while keeping the **full 25-kind set** — a `markup`
  classification would have dropped 22. Two limits asserted, both false-negative-only:
  `css-raw-surface` does not fire inside a `<style>` fence, and stripping is region-blind. **A known
  non-fix, deliberate:** an all-hex URL fragment or SVG ref (`href="#cafe"`) still reports — a fix
  would cost real findings.

**A `SCANNABLE_EXT` widening is outside the grace mechanism, by design.** `GRACE_PERIOD_KINDS` is
keyed per KIND; widening the file set widens all 25 at once. An entry for `raw-hex` would demote the
most load-bearing kind to `warn` across every `.tsx` and `.css` in all seven consumers to buy runway
on a file type one consumer has. Measured: no other consumer holds a single `.astro`/`.vue`/`.jsx`
file, so grace would have covered zero incumbent violations. Doctrine recorded in
`packages/basalt-ui/CLAUDE.md` § "Shipping a stricter guard".

**Handoff:** `--audit-allows` still has no verdict for `basalt.exempt` (above), and
`agent/templates/CLAUDE-block.md.tpl` still names three chart exceptions where there are five —
`templates/` was outside this pass too, second round running.

## Round-8 consumer sweep (2026-08-22)

Seven repos on 1.23.0. **No finding forced a change in any of them** — the only code that moved was
linewatch's deliberate band-kind port, below. Two waiver tallies moved and both are the consumer's
own doing: linewatch 14 → 3 through the port, rb 6 → 5 because the `icons` array let it delete the
hand-written `manifest.webmanifest` its sixth waiver lived on (expect 5 there now, not 6). Full
reports: `.claude/feedback/round-8/`.

| Found                                                                                                                                                                       | By                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `basalt-ui --version` did not exist — the one control introduced after round 7's stale-`bunx` incident, and six reports independently reached for it and fell back          | six of seven                          |
| An unrecognized FLAG was silently ignored and the command exited 0: `doctor --json` ran doctor and passed                                                                   | nobody — found while fixing the above |
| `doctor` from a non-install package prescribed `basalt-ui init` where `sync`, same directory, names the parent — following it scaffolds the second consumer 1.22.0 prevents | argo, image-gen, rb, obsidian         |
| `init`'s script and CI templates had seeded `bunx basalt-ui` into ten places across three consumers, one of them a `.claude` PreToolUse hook                                | argo, image-gen, rb                   |
| `chart-missing-aria-label` fired on a consumer's OWN 235-line `MirroredBars`, demanding a prop it does not accept, as a correctness finding                                 | linewatch                             |
| `doctor`'s icon check demanded six filenames from the app that adopted the `icons` array — the app the feature was written for                                              | rb                                    |
| `tokens:css --check` gates on a line carrying the emitting version, so every release forces a no-op commit in a tokens-only consumer                                        | rollhook                              |
| A `BandSpan.state` naming no `series` entry drew nothing, which on a measured/not-measured strip is a coverage claim                                                        | linewatch                             |

### The band-kind adoption result — and the ~150 lines it missed

linewatch put all six of its charts on shipped kinds. This is the first kind proven by porting a
real consumer rather than by demo, so the port's own promise is the thing to check.

| Source                              | Promised   | Actual          |
| ----------------------------------- | ---------- | --------------- |
| `availability-strip.tsx`            | 613 → 321  | 613 → **391**   |
| `link-speed-strip.tsx`              | 642 → 389  | 642 → **441**   |
| `throughput-chart.tsx`              | 532 → 247  | 532 → **276**   |
| `charts/follower-anchor.ts` (+test) | → 0        | deleted         |
| `charts/hatch.tsx`                  | unpromised | 49 → 0, deleted |
| **total**                           | 1884 → 957 | 1884 → **1108** |

**On code-only lines the port is 1148 → 649, −43% — larger than the raw-line −41%.** The whole miss
is comment prose, which a scratch port does not carry: linewatch keeps its arguments in docblocks by
house rule, and every rationale still true was preserved rather than trimmed to hit a number.
`lib/axis.ts` landed at 200 → 170 against a promised 160, the miss again a docblock, which GREW
because the helper stopped being a fallback and became the one seam six charts pass through.

**The claim that mattered held exactly.** All 11 `hand-rolled-plot` waivers retired, none replaced;
14 `theme-allow` → 3, and none of the three survivors is chart-related (two `inline-spacing` on a
prose verdict line, one `raw-surface` on a status dot).

One line worth keeping: **a scratch port is honest about structure and optimistic about totals.**
Read its file-by-file shape; discount its arithmetic.

**Known gaps — reported, not fixed.** No `bandHeight` prop, so band height is derived and floored
and linewatch hand-copies `AXIS_HEIGHT = 30` into three files — a restatement of `VX.margin.bottom`,
which is density-derived upstream, with no guard on the drift. `getBand`/`getAbsentFraction` never
see the fold's bookkeeping. **`ChartTooltipFloat` still has no viewport gate**: linewatch's 57-line
`use-in-viewport.ts` survives, now threaded into all six charts. `BandStrip` derives exactly one
tooltip row, so extras stay hand-authored in `extraRows`. No `init --tokens-only` to seed the three
scripts a tokens-only consumer's gates need. No `inline-spacing` exemption for `src/charts/**`,
where the rule's own remedy is a Mantine prop the boundary forbids — the same argument that already
exempts `inline-display` and `raw-html-layout` there.

## Round-8 batch — 1.23.1

Three `fix:` commits. Per-export detail in `packages/basalt-ui/MIGRATING.md` § `Unreleased`.

- **A typo'd band state stops asserting absence** (`c51b9a0`) — a `BandSpan.state` naming no
  `series` entry used to be skipped, drawing a coverage GAP on a strip whose whole vocabulary is
  measured/not-measured. It now **throws in dev** naming the key and the valid set, and in
  production draws a dashed neutral outline band — a treatment no legend entry and no state fill
  uses — plus an `Unknown state` tooltip row. The split is deliberate: `state` comes off the DATUM,
  so a feed growing a new state must degrade rather than take a dashboard down, while a typo, the
  same input, still fails loudly where it is written. `marker.state` follows it. `absentState` and
  `MirroredBars`' `up.key`/`down.key` are PROPS, so they throw everywhere — an unresolvable pane key
  hid the pane AND its axis, which reads as a measured zero. `BandStripSeries.formatValue` is now
  `(d) => string | null`; `null` renders an em dash, distinct from `''`.
- **The two chart tag rules gate on where the tag came from** (`ba2ea5f`) — a tag is skipped only
  when the file DEFINES a component of that name and does not also import it from `basalt-ui`.
  One-directional on purpose: a basalt import, a consumer barrel re-export and an unattributable tag
  all still fire, where a positive-import gate would have switched both rules off for every
  barrel-wrapping consumer and every file with no imports. Verified old-vs-new over **945 files
  across six repos: 0 findings lost, 0 gained.**
- **The CLI answers which version ran, and stops failing open** (`498b011`) — `--version` / `-v` /
  `version` print one bare line and exit 0, resolved before dispatch. The larger half: **every
  subcommand validates its flags** and exits 1 naming the one it does not accept. `doctor` reads
  `basaltAppPlugin({ icons })` instead of hardcoding six filenames; `doctor` and `sync` share
  `parentInstallAdvice()`; every seeded invocation goes through `basaltBinCommand()`/`BASALT_BIN`,
  so the ten `bunx` sites the seed produced become the local bin; `tokens:css --check` blanks the
  provenance line before comparing, so a version bump alone stops forcing a no-op commit.

**Corrections to the record.** Three, and all three are ours:

1. **All six reports said `--version` "exits 0 printing usage". It exited 1, to stderr** — the
   dispatcher's `default:` branch has always been `console.error(USAGE); return 1`. The real
   fail-open was an unknown FLAG, which no report tested, and the misdiagnosis was relayed verbatim
   into the fix brief. Report the symptom you measured, not the one you inferred from it.
2. **`cb4e5b7`'s message is wrong**, and it is on `master` where it cannot be rewritten. It claims
   it taught `unframed-chart` the two new kinds; it widened `CHART_ENTRY_POINT_TAG`, which only
   `chart-missing-aria-label` reads. `unframed-chart` keys on `<ChartLegend items={[` and has no
   kind list — there was never an asymmetric pair. Round 7's handoff below named the same wrong
   rule. The correction lives in `packages/basalt-ui/CLAUDE.md`, where the next reader of that
   commit will be.
3. **Open question, not a plan:** the import gate does not make `CHART_ENTRY_POINT_TAG` or the
   plugin's `CHART_TAGS` redundant — the list still answers _which_ tags owe an `ariaLabel`. The
   gate only turns a missed kind from a false positive into an under-report. Collapsing the two
   lists is a larger change and has not been made.

**Handoff:** `agent/templates/CLAUDE-block.md.tpl` still names `DualPanel`/`Donut`/`Heatmap` as the
declared non-single-plot exceptions; there are five. `templates/` was outside this pass.

## Round-7 consumer sweep (2026-08-22)

Seven repos on 1.22.0. **Zero code changes needed in any of them** — no `check-theme` finding, no
`basalt/*` oxlint finding, no waiver moved. Full reports: `.claude/feedback/round-7/`.

| Found                                                                                                                                                                                                              | By                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| A repo root with no `workspaces` field and the install one level down is invisible: `check-theme` printed "no off-palette colors" over **zero files**, `doctor` inferred `tokens-only` for a full Mantine consumer | linewatch, image-share |
| `sync` told a tokens-only consumer to run `basalt-ui init` — the advice `doctor` exists to prevent, same directory, same version                                                                                   | rollhook               |
| The fifth `theme-allow` shape hole: the `{/*` whose closer sits alone on its line, honoured by oxlint, ignored by the guard                                                                                        | linewatch              |
| `icons` still could not name a real icon file — six fixed filenames or nothing, and rb's icon is `favicon.svg`                                                                                                     | rb                     |
| `MIGRATING.md`'s newest heading named `1.21.1`, a version npm never served — **third round running**                                                                                                               | all seven              |

**Corrected findings.** _"`sync` scaffolds 19–20 files into a consumer root"_ did not reproduce —
those runs executed a stale `bunx` cache of 1.20.0. Third round in which a consumer diagnosis was
wrong on cause, and the second caused by the measuring harness rather than the code (round 6's was
`$?` after a pipe). **Check an upgrade against the local bin.**

## Round-7 batch — 1.23.0

The first batch this cycle that widens the framework rather than the guard.

- **Two banded chart kinds** (`c1da509`; playground routes `f72611a`, the non-finite-`absentFraction`
  fix `370b9be`, `chart-in-raw-surface` `cc4903d`) — `BandStrip`
  (1-D categorical bands, no y dimension) and `MirroredBars` (two bar panes, one x scale, one
  baseline, independent domains). Neither can compose `CartesianChart`, which renders
  `AxisLeftNumeric` unconditionally and builds x as `scalePoint`. Shared choreography in an internal
  `useBandPlot`; `foldBands` + `HatchPattern`/`hatchFill`/`hatchSizeFor` ship.
  **Proven by porting, not by demo:** linewatch's real charts — promised 1884 → 957 source lines,
  delivered 1108 (code-only 1148 → 649, −43%; the miss is docblock, see the round-8 sweep), and the
  waiver claim held exactly: all 11 `hand-rolled-plot` retired, 14 `theme-allow` → 3. The port caught two live bugs —
  a `NaN` series value painting `y="NaN" height="NaN"` bars and a non-finite `absentFraction`
  painting `width="NaN"` bands, both silently invisible. **Doctrine now: a kind is proven by porting
  a real consumer's call sites and reporting what it could NOT express.** `StatCard.tone` shipped in
  1.7.0 without that check and four consumers re-rolled the card anyway.
- **`xTickValues` on `CartesianChart`** (`cdb083a`) — resolves ahead of `xTicks`, forwarded by the
  four cartesian kinds and both band kinds. A tick COUNT cannot express a legible dense time axis:
  `smartTicks` appends the final key unconditionally, so any count missing the last index collides
  two labels at the right edge. The consumer's own helper went 200 → 160 lines — it shrinks, it does
  not die.
- **CLI resolution and reporting** (`791225b`) — `resolveProjectDir` falls back to a bounded
  two-level layout scan when nothing is declared; `BASALT_CWD` honoured by all three commands;
  `sync` is profile-aware (tokens-only → `n/a`, exit 0, so `sync --check` is CI-wirable); `sync`
  heals `DESIGN.md` openers that still name a version (the file is a seed, so the stamp was never a
  constant); new `shipped-versions.test.ts` fails any shipped asset naming a version `CHANGELOG.md`
  does not record.
- **The annotation grid is enumerated, not collected** (`28367af`) — the reported hole was three:
  the closer-alone shape, a `MAX_COMMENT_BLOCK_LINES = 8` budget truncating the walk inside a
  ~12-line docblock, and the plugin requiring the annotation to be the LAST comment above the node
  (so a reason wrapped onto a second `//` reported under oxlint while the guard waived it). Pinned
  now over four axes: guard 37 supported + 8 asserted-unsupported, plugin 32 + 8. **Zero
  disagreements, down from five, with no tally change in any of the seven consumers.** The previous
  round's "thirteen-shape matrix means the two parsers can no longer disagree" was false when
  written — a list of anecdotes cannot close a contract.
- **`basaltAppPlugin` icons can name a real file** (`ead3bac`) — `icons` also takes an array using
  the manifest's own field names plus an optional `rel`; every entry becomes a manifest icon, only a
  `rel` reaches the head, an empty array reads as `false`, `{ dir }` unchanged. rb can delete its
  hand-written `manifest.webmanifest` and the permanent `theme-allow-file` on it.

**Known gaps — reported, not fixed:** no `bandHeight` prop (band height is derived and floored by
`VX.margin`, so linewatch raised its axis height instead); `getBand`/`getAbsentFraction` never see
the fold's bookkeeping; `ChartTooltipFloat` still has no viewport gate; `BandStrip` derives exactly
one tooltip row, so extra rows stay hand-authored. **Handoff, and it named the wrong rule:** `CHART_ENTRY_POINT_TAG` (`src/guard/index.ts`) is read by
`chart-missing-aria-label`, not by `unframed-chart`, which keys on `<ChartLegend items={[` and
carries no kind list. `cb4e5b7` widened the regex and its own message repeats the error — see the
round-8 batch's corrections. Still open: `agent/templates/CLAUDE-block.md.tpl` says
`DualPanel`/`Donut`/`Heatmap` are the declared exceptions; there are five.

## Round-6 consumer sweep (2026-08-22)

Seven repos on 1.21.0. Every finding was **a toolchain reporting an answer it had not earned** — the
class the last two releases exist for, one layer in. All closed in the 1.22.0 batch below. Full
reports: `.claude/feedback/round-6/`.

| Found                                                                                                                                                                                 | By                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `sync` scaffolded a competing install from a sub-package — `0 updated, 20 recreated`, a second `basalt` key, 20+ files beside the real one. Neither run warned; both reverted by hand | argo, rb                   |
| `--audit-allows` could not judge a plugin-rule waiver, so the exit-1 gate covered an empty set: argo `0 live, 0 dead, 8 outside reach`, 11 of linewatch's 14 the same                 | argo, image-gen, linewatch |
| `doctor`'s `lefthook-preset` warned at a correctly configured repo and prescribed a change that would have broken it                                                                  | linewatch                  |
| `shadow-basalt-export` told a React-free package with no basalt-ui dependency to import from basalt-ui                                                                                | basalt-ui-obsidian         |
| `basaltAppPlugin({ icons: false })` shipped a manifest naming two 404s                                                                                                                | rb                         |
| Two `theme-allow` comment shapes waived nothing, one of them linewatch's chart-axis shape                                                                                             | linewatch                  |

**Corrected finding** — argo's _"`doctor` exits 0 on two hard failures"_ was a pipe artifact: `$?`
read after `| tail` returns tail's status. The real exit was 1; no code changed. `doctor`'s exit
status is now pinned per outcome rather than by printed text, which is what let 1.20.0 ship a
SKIPPED-exits-0 bug.

**Known gaps, still open:** `--audit-allows` says nothing about `basalt.exempt` (re-filed in round 9) and its `scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`. The
profile-gated `check-theme` manifest hint sits CLI-side behind `PLAIN_JSON_HINT_PATH`; it belongs in
the guard as `guardWaiverHint(relPath, { profile })`.

## Round-6 batch — 1.22.0

Full per-export detail in `packages/basalt-ui/MIGRATING.md` § 1.22.0; the shape of it:

- **`sync` refuses instead of scaffolding** (`40d7fc6`) — resolves its project as
  `check-theme`/`doctor` do, then exits 1 when that project has no manifest, naming the install it
  found above. The refusal runs BEFORE the `basalt.roots` backfill, which was half the damage.
  `created` is its own counter now.
- **`--audit-allows` gains the oxlint half** (`cfb4d1a`, `40d7fc6`) — a plugin-rule annotation is
  probed by re-running oxlint over one neutralized sibling file (argo 8/8, linewatch 14/14, basalt
  23/23); unreachable oxlint is "cannot judge", never "dead". The reader ships as four runtime
  exports on `./guard`, so the audit stops carrying a mirrored regex one shape behind.
- **`doctor`'s `lefthook-preset` asks whether the gate EXISTS** (`40d7fc6`), via `lefthook dump`,
  which resolves `extends`, `include` and per-command `root:`. A broken `extends` target stays a
  hard fail, a provably absent gate is a warn, can't-tell is advisory.
- **Two `theme-allow` comment shapes fixed** (`cfb4d1a`) — **fourth hole in three rounds**; the
  thirteen-shape matrix shipped with it did not close the contract (see round 7).
- **`shadow-basalt-export` narrowed** (`314eae8`), **`icons: false` reaches the manifest**
  (`9d6fbe0`), **`check-theme`'s manifest hint is profile-gated** (`40d7fc6`) — leading with
  `basaltAppPlugin` is unreachable for a tokens-only consumer.

## Rounds 4 and 5 — compressed (1.20.0, 1.21.0)

Both batches shipped and are four releases behind; the full reports are `.claude/feedback/round-4/`
and `round-5/`, per-export detail in `MIGRATING.md` § 1.20.0 / § 1.21.0. What still governs:

- **Round 4's one bug in five shapes: every gate passed and nothing was enforced.** `doctor` gained
  `SKIPPED` as a third outcome that exits non-zero on its own, plus `basalt-resolves` / `guard-scan`
  / `oxlint-preset` hard checks; five guard kinds and two oxlint rules landed at `warn` for one
  minor; `init` started writing a real `basalt.roots`; `tokens:css`/`fonts:css` output became
  commit-clean. Consumers saw `doctor` go red where it had been green — that was the point.
- **The guard sees palette, not vocabulary.** ~15 independent re-rolls of shipped components, all
  green — `StatCard` alone re-rolled by 4 of 4 app consumers. `shadow-basalt-export` and
  `hand-rolled-shell` detect the two cheapest shapes; the **expressiveness** half is what actually
  closes the gap, one case at a time: the chart half landed in round 7 (`BandStrip`/`MirroredBars`),
  the query-branch half in round 9 (`QueryState`), `createSearchSchemaStore` is still unbuilt.
- **Round 5 found documentation making false load-bearing claims** — the failure `MIGRATING.md`
  exists to prevent. Four wrong rows, found by re-auditing every replacement against the built
  `.d.ts` rather than the commit it came from; a correction that landed only in this repo's
  `CLAUDE.md` and not in `agent/rules/*` had not shipped at all. **A doc claim is audited against
  source or it is a guess.**
- **The `theme-allow` grammar** (1.21.0) — both parsers did a bare substring search, so a comment
  merely _mentioning_ the token disarmed the line below, and a consumer disabled a file by
  documenting its own waivers. An annotation must START its comment, file scope is spelled
  `theme-allow-file`, and a bare one waives nothing. `--audit-allows` proves each waiver by
  re-running the guard with that one occurrence neutralized.
- **Two corrected findings, both reported and both wrong**: "no release notes for any minor" (minors
  are `#`, patches `##`) and "the chart rules are outside `GRACE_PERIOD_KINDS`" (true but not
  meaningful — they are plugin rules, and `PLUGIN_RULE_GRACE` is their ledger).
- **Known limit, deliberate:** a DOM-drawn chart is invisible to `hand-rolled-plot`, which keys on
  the visx assembly primitives. Every alternative detector tried flagged either basalt's own
  `Donut`/`Heatmap` or an icon in a card header, and a noisy shipped rule gets switched off.

## Adoption gap — closed in 1.7.0 (2026-08-02)

Prompted by the first outside-of-argo consumer (LineWatch), whose dashboard had grown seven
hand-rolled `<Card withBorder radius="md" padding="lg">` next to `StatCard`s — two card idioms,
visibly different on one screen. Three separate causes:

1. **basalt was installed as a component library and nothing else.** No `.oxlintrc.json`, no
   manifest, no lint script, no CI — `basalt-ui init` had never been run, so every enforcement
   mechanism the package ships was inert and nothing said so. `basaltViteConfig` now prints a
   one-time notice when no manifest is found at or above the cwd; it runs on every dev start, so it
   catches this while it is cheap. A notice, never an error (`enforcementNotice: false` opts out).
2. **Two real holes in the guard.** `size="10px"` passed (`no-raw-font-size` tested only a NUMERIC
   literal) → `raw-size-literal`; `c="yellow.7"` passed (no kind covered a shade-pinned Mantine
   colour) → `mantine-shade-index`, `warn` at 1.7.0 and **`error` at 1.11.0** — a grace that ran
   four minors instead of one, which is why `GRACE_PERIOD_KINDS` is a tracked list.
3. **An expressiveness failure no linter could have caught.** LineWatch wrote a 35-line
   `ThresholdRail` wrapper because `StatCard.value` is typed `string` and the number could not be
   tinted. `StatCard` took `tone`; 1.8.0 widened it to three values when the same consumer hit the
   same wall on a Downtime card where **zero is the earned state**, which two tones could render
   only as red (wrong) or untinted (indistinguishable from "nothing measured"). **The lesson, twice
   over: a composite that cannot express a common case gets routed around by compliant-looking code
   the guard cannot recognize, and the gap is found by the consumer, one case at a time.**

## Chart-layer rebuild — one mandatory cartesian primitive, shipped 1.15.0 (2026-08-18)

Design + rationale: **`docs/CHARTS-SPEC.md`** (ground truth). Prompted by the one consumer building
charts daily: tooltips, legends and responsive sizing all needed pushing around per chart. The
diagnosis was not visx — basalt's own layer had two tiers with no rung between them, so anything
that was not a shipped kind fell to ~130 lines of hand-rolled margin math, scales, axes, overlay and
tooltip assembly, and every cartesian kind repeated that preamble internally.

TanStack Charts (v0.14.0, same month) was evaluated as a replacement and **rejected** — pre-alpha,
its own README says not production-ready, no 1.0 date. Its architecture is the better one, and the
four ideas worth stealing were: measured guides, a cursor controller separate from crosshair
presentation, one responsive path, and tooltips/legends/axes as first-class parts of the chart
definition. Revisit the library if it reaches 1.0.

1. **`CartesianChart`** — the missing rung. Owns measured margins, both y scales + domains, the x
   scale and tick thinning, grid, zones, axes, the shared cursor, the crosshair and its per-series
   dots, the hover/keyboard overlay and the derived tooltip. A kind supplies `series` + a child that
   draws ONLY marks. Every single-plot cartesian kind was rewritten onto it; the bespoke dual-axis
   playground chart went ~145 → 29 lines.
2. **Margins are measured, not tokenized.** `autoMargin` sizes each gutter from the tick labels that
   will actually be painted (`measureText`, offscreen canvas, memoized, SSR fallback). `VX.margin`
   becomes a FLOOR, and passing `y2` is what makes a chart dual-axis.
3. **The cursor is shared by default** — a module-level external store read through
   `useSyncExternalStore`, not a context that had to be mounted. `ChartHoverSync` is deleted;
   `ChartCursorScope` ISOLATES a subtree instead. Resolution is domain-aware, which retired the
   `resolveKey` escape hatch and the folded-domain desync.
4. **Legends toggle** (on at ≥2 entries), hiding the series from plot, tooltip and auto domain
   together. **`ChartTooltipFloat`** does portal + flip + viewport clamp + measure-before-show once
   for every chart; the hover overlay is focusable and scrubs on ←/→.

**The contract is mechanically enforced, not advisory** — `basalt/hand-rolled-plot` and
`basalt/chart-legend-literal`. Both sat at `warn` for four minors with nothing tracking them, as did
`basalt/raw-size-literal` for twelve: `GRACE_PERIOD_KINDS` governs `GuardKind`s only, so there was
no map to empty. **1.20.0's `PLUGIN_RULE_GRACE` is that map** — read the current level there, not
from a doc, which is what drifted.

Deleted outright (greenfield, one lockstep consumer, no shims): `ResponsiveChart`, `ChartHoverSync`,
`HoverContext`, `useHoverSync`, `useChartTooltip`, the tip-based `ChartTooltip` + `useTooltipStyles`,
`BarsAxisConfig`, `ZonedLineTooltipLabel`, and the whole `yDomain`/`yAutoMaxFloor`/`yAutoMinCeil`/
`yAutoPad`/`numTicksY`/`formatYTick` prop family on every kind (now one `AxisConfig` per axis).
Ships as a plain `feat:` on the 1.x line — majors stay banned.

Two regressions were caught during migration and fixed in the primitive rather than per kind: a
stacked band's crosshair dot sat at its raw value instead of the cumulative band top (now the
`cursorValue` seam), and an `AxisConfig.domain` function could not see which series the legend had
hidden, so a stacked domain never shrank (it now receives `visible`).

## Native mobile nav + one typed nav definition — shipped 1.19.0 (2026-08-20)

Two changes that turned out to be one change. The mobile bottom bar stopped being a menu, and the
consumer's navigation stopped being five restatements of the same destination.

### The bar navigates

A slot is now a DESTINATION. Tapping it navigates through the consumer's router `Link` with no
overlay, no animation and nothing to dismiss — previously every tab raised a full-viewport
`Drawer`, so reaching a page took two taps and opened one overlay. The full-height mobile
`AppShell.Navbar` drawer is deleted outright (`collapsed: { mobile: true }`, permanently) and
everything it held — account, settings, theme switcher, the rest of the nav — moved into the
trailing More slot as flat rows.

Overlays now exist only where a slot genuinely holds more than one destination, and the surface is
INFERRED rather than configured: 0 rows drops the slot, 1 collapses to a plain link, ≤ 6 is a
`Menu` that pops out of the tab, more is a bottom sheet. Six is arithmetic (6 × 44px + 8px against
415px of headroom on the smallest supported viewport), which is why the menu runs `flip: false` and
can never render below the fold. Move a destination in or out of More and the surface changes
itself.

`projectMobileNav` (`src/shell/mobile-nav-model.ts`) is the pure projection that decides all of it —
no React, no Mantine, no DOM — so the whole interaction law is unit-testable with no renderer.
`MobileNav` only paints the result. Three behaviours that were bugs and are now rules:

- A **disabled** destination used to be dropped silently and shipped as a live row. It now appears
  in the overflow rendered disabled, and can never be a link slot.
- A slot's `active` now includes **nested children**, so a tab no longer goes dark when a child
  route is current. Consequence to know: re-tapping a parent tab while a child route is active
  scrolls to top (the Material/iOS pop-to-root idiom) rather than navigating to the parent.
- Every `:hover` moved behind `@media (hover: hover)`; ungated, the last-tapped row stayed lit.

Safe-area handling is the part most likely to be "fixed" back into a bug: Mantine's own
`AppShell.footer` rule already grows the footer box by `env(safe-area-inset-bottom)` AND pads its
content, so adding either to `.bar` double-counts. The one real gap is `--app-shell-footer-offset`,
set to the raw height, which leaves `AppShell.Main` short by exactly one inset — closed by
`.mainSafeArea`.

Two new density-tracked tokens (`mobileNavBarHeight` 56, `mobileNavRowHeight` 44) carry hard floors
at 48/44 in `deriveSpacing`, because the `1 + 0.1 * level` law would take them to 39/31 at level −3
and silently break the minimum touch target.

### One typed nav definition

`defineNav` / `navGroup` / `navTarget` / `flattenNav` / `useNav` (`basalt-ui/router-tanstack`)
replace the whole hand-wired nav layer. One `defineNav({ groups: [...] })` in a leaf module
produces the desktop sidebar AND the mobile bar; `useNav(NAV, { badges })` resolves active state
through `useMatchRoute` and builds each destination's anchor, returning `{ sections, mobileNav }`
to spread onto `BasaltShell`. In the reference consumer that is ~237 nav lines in `__root.tsx`
collapsing to 4 (plus a 95-line leaf), a destination stated once instead of five times, and zero
`as never` casts, zero render callbacks and zero hand-written `useMatchRoute` calls.

Route options ride inside a `link: linkOptions({...})` key rather than flat on the item. That is
not cosmetic: TanStack's `Constrain` is an ASSIGNABILITY check, and assignability does no
excess-property checking, so a flat `{ id, label, to, colour: 'red' }` compiles silently. A config
whose selling point is "typos are compile errors" cannot have a hole exactly where metadata typos
live. Compile-verified both ways.

**The risk that comes with it, stated plainly:** without the consumer's `Register` module
augmentation, `RegisteredRouter` degrades to `AnyRouter`, every `to` widens to `string`, and the
whole definition validates NOTHING while reporting zero errors. The API looks like it is working.
`agent/rules/basalt-router.md` says so, and the playground type-guard fixture is the only defence
inside this repo.

A compile-time cap on `mobile.tabs.length` was tried and **rejected**: both forms that make the
length check work silently degrade `NavTabId<G>` to `string`, killing the far more valuable id-union
validation. The cap is a runtime DEV warn in `projectMobileNav` instead.

### Migration (removed exports — no major, per the no-majors doctrine)

`renderNavLink`, `renderBreadcrumbLink` and `sidebarFooterExtra` are gone from `BasaltShellProps`,
along with the exported types `NavLinkRenderer`, `MobileNavLinkRenderer`, `BreadcrumbLinkRenderer`,
`MobileNavItem` and `MobileNavSection`. The replacement for all three callbacks is one component
seam — `SidebarItem.Anchor`, typed `NavAnchor` — and on the breadcrumb bar, `parentAnchor`.
`sidebarFooterExtra` rendered inside `mobileControls`, which was `hiddenFrom="sm"`: it was invisible
on desktop, a latent bug, and its only host is the drawer being removed. A consumer with no router
needs no migration at all — `href` + `onClick` still work.

`MobileNav`'s own props changed from `sections` to a `model` built by `projectMobileNav`; the shell
does that itself, so only a consumer composing the sub-components by hand is affected.

## Framework-free token consumption — shipped 1.3.0

`basalt-ui tokens:css`, the published `basalt-ui/tokens.css` subpath, the `scheme` /
`defaultScheme` / `mediaFallback` selector options, `only: 'core'`, and five peers turned
`optional` so a tokens-only install carries no React. Kebab-case name normalisation followed in
1.5.0. Ground truth for consuming it: **`docs/FRAMEWORK-FREE.md`**.

First real non-Mantine consumer: `rollhook`, round 4 — two Tailwind v4 apps, one on
`import 'basalt-ui/tokens.css'`, one on a committed `tokens:css` output.

**Three and a half of the four gaps that migration found are closed in 1.20.0** —
`--selector-class`, `fonts:css`, a declared tokens-only profile, and a `--check` drift gate. The
half: the emitter still writes `rgba(…, 0.10)`, which `format/prettier` rejects, and `--fix` puts
the file into `--check` drift. See `docs/FRAMEWORK-FREE.md`.

**Follow-ups the original work deliberately did NOT fold in:**

- **Expose `buildPaletteData` / `PaletteData`.** `deriveRadius` and `deriveSpacing` are public, but
  the color derivation runs through `createBasaltTheme` (React + Mantine), so a framework-free
  consumer can retune radius and density and **cannot retune the accent**. Real gap.
- **A plain-class `dist/content.css`.** The prose language is CSS-modules-scoped and reachable only
  through React components. Larger design question.
- **Reconcile the accent drift.** `docs/DESIGN-SPEC.md` states `#0077bd` / `#8ec5ff`; the emitter
  produces `#4374a6` / `#a2c3f0`, because chroma is scaled by `max(seedChroma, 40) × 0.72` at
  vibrancy 0. `theme/contrast.test.ts` pins the drifted values, so this is known rather than
  accidental — but a consumer reading the spec gets a different palette than one calling the
  emitter. Decide which is authoritative. This is the one item here that would visibly move existing
  consumers' pixels, which is why it stays separate.
- **`--basalt-font-head-stretch` as a `createBasaltTheme({ fonts })` option.** The knob exists in
  CSS; reaching it from the theme config would make it a real dimension like the rest.

## Validation

Gates: `bun run pre` (fmt:check + lint + typecheck) → `bun test` → `scripts/pack-test.sh`. The
pack-test is the only one that exercises `dist` — the playground aliases `basalt-ui` to `src`, so
neither the running app nor `bun run typecheck` proves the published artifact resolves. Run all
three before a release; don't quote a stale count here, run it.

## Deferred by design — still not built, on purpose

Intentional cut-line calls, not gaps:

- **tsdown migration** — NO-GO for 1.0 (swapping the tsc declaration emitter on a type-spine
  package; owner may override).
- **Phase-5 kill-list** — bottom-sheet, runtime hooks, canvas-line-kind, appshell-aside-slot,
  `create-basalt-app`, dtcg-interchange, `@mantine/dropzone`, full `<Chat>`/voice. Advisory-only.
  (The PWA vite helper on this list shipped as `basaltAppPlugin` — see the package README.)
- **`no-explicit-any` → error escalation**, **`./state` static-lint globs** (would over-reach into
  consumer state files), **controlled `DataTable` sorting** prop.
- **`@example` JSDoc markdown-compile harness** (the playground demos already are canonical
  compiling examples).
- **`react-perf` lint** — dropped after evidence (141 false-positive warnings on idiomatic
  Mantine/visx; React Compiler supersedes manual memoization).
- **3 `@deprecated` back-compat aliases** — `state.ts` legacy connectivity export, `ZonedLine`/`Bars`
  `ZoneSpec` aliases — remove at the next major.

## Not part of this refactor

**The BLUEPRINT S0–S5 argo plan is superseded as basalt-ui's roadmap — do not execute it here.**
The argo consumer migration it describes ran to completion 2026-07-11; distilled feedback from that
run lives in `docs/ARGO-MIGRATION-LEARNINGS.md`. Consult it before touching CLI packaging, the
charts/tokens API, the shell, or the query/forms/notifications/commands batteries.

## Doc map (post-reconciliation)

- **Living reference** (current, maintained alongside the code) — **`STATUS.md`** (this file,
  single source of truth), `DESIGN-SPEC.md` (2026-07 visual identity, supersedes older doctrine —
  see its "Doctrine inversions" section), `DESIGN-CORE.md`, `MANTINE-THEMING.md`,
  `CHARTS-SPEC.md`, `CONTENT-SPEC.md`, `AGENT-CHAT-SPEC.md`,
  `FRAMEWORK-FREE.md` (consuming the token system with no React/Mantine/bundler).
- **Ships to consumers** — `packages/basalt-ui/MIGRATING.md` (per-minor API delta: what was removed
  or renamed and what replaces it), `README.md`, `llms.txt`, `AGENTS.md`, `agent/rules/*`,
  `agent/skills/*`. **Nothing under `docs/` is in the tarball** — a shipped file citing
  `docs/CHARTS-SPEC.md` was pointing a consumer at a path they do not have, so those references are
  GitHub URLs now, marked as outside the package. Check that before adding one.
- **`docs/archive/`** — superseded scope ledgers and historical process artifacts, kept for
  provenance only:
  - Per-release narratives — `STATUS-HISTORY.md` (chart-API rounds one to three, the 2026-08-02
    chart-layer batch, the pre-1.0 as-built inventory, the derive engine). Lifted out of this file
    2026-08-22.
  - Executed ledger — `MATURATION-REVIEW.md` (the maturation quality ledger; its phases are
    executed, kept for provenance).
  - Superseded scope ledgers — `MATURATION-ROADMAP.md`, `ENFORCEMENT-HARDENING.md`,
    `INTEGRATION-DX.md`. Their phases are built except the finish line above; per-phase
    "proposal/remaining" language is historical.
  - Superseded plan — `BLUEPRINT.md` (S0–S5 = argo-consumer migration, do not execute here).
  - Historical process artifacts, phase complete — the `PHASE-1-*` and `*-HANDOVER.md` set.
- **Deleted** — 7 orphaned pre-pivot marketing/tooling docs (Tailwind/Astro era, zero references
  repo-wide).
