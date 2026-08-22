# Migrating basalt-ui

`CHANGELOG.md` ships in this package and lists every release. It cannot tell you what **broke**:
semantic-release writes one line per commit, and "make the mobile bar navigate, driven by one typed
nav definition" does not say `ChartHoverSync` was deleted. This file is that half — removed and
renamed exports per minor, with the replacement.

Reconstructed from `git diff` over the published export surface across `v1.0.0..v1.19.1`, then
cross-checked against the repo's `scripts/export-surface.json` snapshot. **Every replacement below
was re-audited against the built declaration files at 1.20.0 (2026-08-22)** after round 5 caught one
row that was wrong. That pass corrected 4 table rows and 3 prose claims. Every section from 1.21.0
on was written against source, not against its commit messages — which is not a formality: one
1.23.0 commit message describes a change it did not make (see `1.23.1` § Corrections). Check
the types, not this table, if the two disagree.

**The newest section is headed `## Unreleased`, and stays that way until npm serves it.** This file
is written before `semantic-release` picks the number, so a number written here is a guess — and it
was wrong three rounds running.

**No majors, by policy.** A rename or a removal ships as a plain `feat:` on the 1.x line, so a minor
bump can require code changes. Skipping several at once is the expensive case — read every section
between your version and the target.

> Reading the CHANGELOG: minors and majors are `#` (h1), patches are `##` (h2). Grepping for
> `## [1.` finds only the patches.

**Minors with no public API delta:** 1.1.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0, 1.8.0, 1.9.0,
1.10.0, 1.13.0, 1.14.0, 1.16.0, 1.18.0 — and every patch. Additive-only subpaths: `./tokens.css`
at 1.3.0, `./agent-chat` at 1.10.0.

---

## Unreleased

**The heading has no number on purpose.** Three rounds running, the newest heading here named a
version npm never served — `1.20.1`, then `1.21.1` — because this file is written before
`semantic-release` computes the number, and a `feat:` in the batch turns the guess into a phantom.
`shipped-versions.test.ts` now fails any file `init`/`sync` copy into a consumer that names a
version `CHANGELOG.md` does not record. This file is not in that set; the same discipline applies
by convention. Rename the section at release, or leave it — a reader can resolve `Unreleased`
against `CHANGELOG.md`, and could never resolve `1.21.1`.

**Nothing removed or renamed. Twelve new runtime exports on `.`/`./query`, plus table props.** Every
API entry is additive; the behaviour changes are in the guard and the CLI, listed after them.

### `QueryState` — the branch precedence, shipped as a component

`QueryState`, `LoadingState`, `ErrorState` (+ `QueryStateProps`, `QueryStateLike`,
`QueryStateVariant`, `QueryEmptyCopy`, `LoadingStateProps`, `ErrorStateProps`) on the root barrel,
beside `EmptyState`. `toErrorMessage` and `errorStatus` on `basalt-ui/query`.

basalt owned both ends of this file — `EmptyState` and `toErrorMessage` — and nothing in between, so
a consumer wrote the four-way switch and got it wrong in the direction the shape suggested:
image-share's library rendered `No images` on a **500** and a share detail rendered
`Share not found` on a dropped connection, until 204 hand-rolled lines stopped it. Open since round
4, re-reported in round 6.

- **A component, not a hook** — the product IS the precedence, and a hook returns the same four-way
  switch to every call site.
- **It lives under `src/dashboard/`, not `src/query/`**: `check-dist-layering.mjs` asserts
  `dist/query/index.js` reaches no `@mantine/*`, and this renders Mantine. `query` is typed as a
  five-field structural subset (`QueryStateLike`), so basalt couples to no query-library version and
  a hand-composed object is legal. The subset gives up the compiler, so the shape is asserted at
  **runtime**: a missing `isError` throws naming the field, because a missing `isError` is precisely
  the "500 renders _No images_" bug.
- `errorTitle` / `errorFallback` / `errorAction` apply to the no-cached-data error branch only; the
  error-with-cached-data branch renders a fixed section banner above `children`.
- **`EmptyState.description` is now optional.** Five argo features wrapped the component solely
  because a compact panel had to invent a second sentence. Existing calls are unaffected.
- `toErrorMessage(err, fallback?)` and `errorStatus(err)` had two live bugs the port found: an
  opaque envelope rendered the literal `"{}"`, and `toErrorMessage(undefined)` returned the
  `undefined` VALUE despite a `string` return type. Both fixed; a status is folded into the fallback
  when the body decodes to nothing readable. Split into `src/query/error-message.ts` so the
  dashboard decodes without importing the peer.

**Port result:** image-share, all 10 call sites plus a standalone `ErrorState`, **by changing one
import line each** — no renames, no prop changes, no casts. Total 2467 → 2221; code-only 2056 →
1882, **−174**; `query-state.tsx` 204 → 0.

### `BasaltDataTable` body chrome — and the honest number

New: `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `verticalSpacing`,
`horizontalSpacing`, `withRowBorders`, `withTableBorder`, per-column `meta.align` and
`meta.numeral`; `striped` widens from `boolean` to `boolean | 'odd' | 'even'`. `withTableBorder`
defaults to `true` in basalt, overriding Mantine's `false`; every other one is a conditional
pass-through, so omitting it keeps Mantine's default.

**Porting argo's three tables onto them made them 341 → 370 lines. 29 LONGER.** argo named these
props as the reason the tables stayed hand-rolled, and adding them shortened nothing: column defs
cost more than JSX rows when every cell is bespoke — eight accessor blocks at 4–6 lines each against
an eight-`<Table.Td>` row at ~3. **The ask was mis-specified.** Adopt them for what they buy —
the `type="native"` footgun, alignment stated once instead of on both `th` and `td` six times in one
file, and sorting/filtering/pagination no longer consumer-owned — not for a line count. This is the
counterexample to the band kinds, and the reason the port-before-shipping rule earns its keep.

- `maxHeight` (or `minWidth`) renders **`Table.ScrollContainer type="native"`**, and
  `agent/rules/basalt-data.md` now prescribes that same node for a bespoke table — so the blessed
  lane and the escape cannot contradict, and `type="scrollarea"`, which breaks a sticky `thead`, is
  unreachable through the props. (The prop's JSDoc claimed the docs already sanctioned it; they had
  never named `Table.ScrollContainer` at all.)
- `meta.align` is a `ColumnMeta` module augmentation: a typo'd key is a tsc error, a wrong value
  throws naming the column. `meta.numeral` is read only as `!== false` — an opt-OUT of the
  mono-numeral cell style, never an opt-in.
- **Not shipped, known:** `emptyState` renders inside a `<td colSpan>` so the header row survives an
  empty table — there is no `emptyState="replace"` mode. No per-column `enableSorting` of basalt's
  own; TanStack's `ColumnDef.enableSorting` still reaches `getCanSort()` and works.

### Four false greens

1. **`check-theme` fabricated a config on the ascend path and passed silently.** From a package with
   no `basalt` key it invented `roots: ["src"]` and reported the invention back under the name
   `basalt.roots`. In `basalt-ui-obsidian`, run from `apps/demo`, that scanned **22 of 44** guarded
   files and made `--audit-allows` report **0 live waivers in a repo carrying 1** — exit 0, no note.
   The audit exists so `0 dead` cannot read as `0 dead anywhere`, and it could be made to say zero
   by standing in the wrong directory. `resolveProjectDir` now ascends to the nearest ancestor
   carrying a basalt project, bounded by the repo root, and announces it in the sentence descend
   already used. **No `.git` above cwd means no ascend**, so a standalone consumer keeps the
   built-in defaults exactly as before. After: 44 files, the real 1.
2. **`tokens:css --check` stopped verifying the regeneration command.** 1.23.1 blanked all of line 2
   so a version bump would stop forcing a no-op commit — but line 2 also carries the exact
   invocation line 1 tells the reader to regenerate with. Rewriting `--only core` to `--only all` in
   that line **passed clean**. Only the version token is neutralized now; a line that does not parse
   as a provenance line is compared verbatim, so a deleted or reworded header fails. The success
   message also **parses** the versions instead of asserting them — it used to claim the file "still
   names an older basalt-ui" without reading it, so `0.0.1-nonsense` earned the same sentence.
3. **`doctor`'s icons check was unreachable from the only directory where `doctor` exits 0.** On a
   monorepo the root run omitted it with no `⊘ SKIPPED` line — the exact failure mode `SKIPPED` was
   introduced to eliminate — while the app-package run failed on artefacts of standing in a
   non-install package. It resolves the app package off `basalt.roots` now. No `basaltAppPlugin(`
   anywhere and no `public/` is a pass that says so; a plugin call with no `public/` beside it is a
   `⊘ SKIPPED`, which exits non-zero on its own.
4. **`SCANNABLE_EXT` gained `.astro`, `.jsx` and `.vue`.** rollhook's marketing site is Astro and its
   two `.astro` templates are its entire markup layer — unguarded, while `check-theme` reported a
   clean 4-file scan. It scans 6 now.

**Behaviour change to name: `sync` ascends too.** It shares the resolver, so from a sub-package it
relocates to the parent install and refreshes it — announced — rather than refusing. It still cannot
scaffold a second consumer: the refusal is keyed on the RESOLVED project and runs before the
`basalt.roots` backfill.

### Guard changes the widening exposed

- **`raw-hex` no longer matches inside an HTML numeric character reference.** `&#123;` — the escaped
  brace a template writes to show a literal `${…}` in prose — read as the hex colour `#123`. The
  hole was in the KIND, not the extension: the same string produced the same findings in `.html`,
  `.tsx`, `.css` and `.vue`, so `.astro` only walked into it first. The fix is precise, not blanket:
  `HEX` rejects a full reference (`&#`, digits, `;`), so **`color: red&#fff` still flags** and
  nothing is exempted by file type. Every neighbouring raw-text kind was checked and structurally
  cannot share the blind spot — a character reference contains no `(`, and the rest anchor on a
  property name, `var(`, or a JSX `=`.
- **A fourth guard syntax, `sfc`, for `.astro`/`.vue`.** They used to fall through to the `ts`
  dialect, so `<!-- … -->` was never stripped: a `theme-allow` written in an HTML comment waived
  nothing and a colour inside a commented-out block still reported. `sfc` strips both regions —
  markup first, so an HTML comment holding an unterminated `/*` cannot open one that runs to EOF —
  and keeps the **full 25-kind set**. A `markup` classification would have dropped 22 of them: an
  `.astro` template is JSX-shaped and a `.vue` `<script setup>` is real TS. `.jsx` needs no branch.
  Both the scan and `--audit-allows` now share one `stripGuardComments`, so they cannot disagree
  about what a comment is.
- **Two limits, asserted rather than left ambiguous, both false-negative-only:** `css-raw-surface`
  does not fire inside a `<style>` fence, and stripping is region-blind, so a `<!--` inside a script
  string over-strips.
- **A known non-fix, deliberate:** an all-hex URL fragment or SVG reference (`href="#cafe"`,
  `fill="url(#abcdef)"`) still reports. It is text-indistinguishable from a colour, so a fix would
  cost real findings; `theme-allow` is the escape.
- **The widening ships at `error` with no `GRACE_PERIOD_KINDS` entry, and that table cannot express
  it.** The table is keyed per KIND; widening `SCANNABLE_EXT` widens the file set for all 25 at
  once. An entry for `raw-hex` — the kind that actually fired — would demote basalt's most
  load-bearing kind to `warn` across every `.tsx` and `.css` in all seven consumers to buy runway on
  a file type one consumer has. Measured: rollhook's marketing site scans 6 files with 0 findings,
  and no other consumer holds a single `.astro`, `.vue` or `.jsx` file, so grace would have covered
  zero incumbent violations.

## 1.23.1 — the band-state throw, the tag gate, a CLI that answers

**One type widened, nothing removed or renamed.** `BandStripSeries.formatValue` is now
`(d: T) => string | null`. `null` renders an em dash — an absent READING — which `''` never could:
`''` is a state whose label is the whole row. Every existing `(d) => string` still typechecks.

**A typo'd `BandSpan.state` no longer renders as absence.** A state naming no `series` entry used to
be skipped, so the band was simply not drawn — and on a measured/not-measured strip a missing band
is a claim about the data, not an "unknown". A misspelling asserted a reading nobody took, in a mark
indistinguishable from a real one.

| Key comes off                                                 | Dev                                      | Production                                                               |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| the DATUM — `BandSpan.state`, `marker.state`                  | throws, naming the key and the valid set | a dashed neutral outline band + an `Unknown state` / `<key>` tooltip row |
| a PROP — `absentState`, `MirroredBars`' `up.key` / `down.key` | throws                                   | throws                                                                   |

The split is the whole design. `state` comes off data, so a feed that grows a state basalt has never
seen must degrade rather than take a dashboard down — while a typo, which is the same input, still
fails loudly wherever it is being written. The dashed neutral outline belongs to no legend entry and
no state fill, so it cannot read as data. Pane keys are props, never data-driven, so `assertPaneKey`
throws in every environment: an unresolvable `up.key` used to hide the pane AND its axis, which
reads as "that half measured zero" — the one thing `MirroredBars` exists to keep apart from absence.

**`chart-missing-aria-label` and `unframed-chart` are gated on where the tag came from.** Both key
on a JSX tag NAME, so a consumer's own 235-line `MirroredBars` — sharing nothing with the shipped
kind but the name — was told to pass an `ariaLabel` prop it does not accept, by a rule that presents
as a correctness finding. A tag is now skipped only when the file DEFINES a component of that name
and does not also import it from `basalt-ui`. Deliberately one-directional: a tag imported from
basalt-ui, one imported from a consumer barrel that re-exports it, and one the scan cannot attribute
at all still all fire. Verified old-vs-new over **945 source files across six repos: 0 findings
lost, 0 gained.**

**CLI: `--version` exists, and no subcommand fails open on a flag.** `--version` / `-v` / `version`
print one bare greppable line and exit 0, resolved BEFORE dispatch so it can never run a command to
answer "which basalt-ui is this". Six consumer reports reached for it in one round; all six fell
back to `info --json`.

The larger fix sits underneath it. **Every subcommand validates its flags** and exits 1 naming the
one it does not accept — `doctor --json` used to run doctor and exit **0**, and `check-theme
--audit-allow` scanned and reported success. An unknown COMMAND now says so above the usage block
instead of dumping help and letting the dump read like a choice.

- **`doctor` reads `basaltAppPlugin({ icons })`** out of the consumer's vite config instead of
  hardcoding six filenames, so adopting 1.23.0's icons array stops producing a warning to generate
  five files you deliberately lack. A named array is checked against itself (an icon missing from
  `public/` still warns); an unparseable or absent config falls back to the six-filename check. It
  can only narrow, never blind.
- **`doctor` and `sync` share one sentence about a parent install** (`parentInstallAdvice`). Run
  from a package whose install is above it, `doctor` now names the parent and says `basalt-ui init`
  is NOT the fix. Following its old advice literally scaffolded the second consumer that 1.22.0
  exists to prevent.
- **Every seeded invocation resolves the local bin** (`basaltBinCommand`, overridable via
  `BASALT_BIN`): the `lint` script, the CI steps, the `.claude` PreToolUse hook and doctor's own
  advice all render `./node_modules/.bin/basalt-ui`. `bunx` does not re-resolve a package it has
  cached — that is what made a round-7 report file a P0 against a 1.20.0 cache while believing it
  was on 1.22.0, and the seed was shipping `bunx` into consumer CI in ten places.
  `configs/lefthook.yml`'s `${BASALT_BIN:-bunx --no-install basalt-ui}` default is unchanged and
  deliberate: `--no-install` fails loudly instead of downloading a stranger.
- **`tokens:css --check` blanks the provenance line (line 2) before comparing**, so a version bump
  alone no longer forces a no-op commit in a tokens-only consumer, where the gate is byte-equality.
  A stale provenance line is now a note on an otherwise-passing check. The `@generated` header is
  still emitted byte-identical — the line stays, it just stops gating. **Superseded in `Unreleased`:
  blanking the WHOLE line also stopped gating the regeneration command it carries. Only the version
  token is neutralized now.**

### Corrections to the record

- **All six round-8 reports said `basalt-ui --version` "exits 0 printing usage". It exited 1, to
  stderr** — the dispatcher's `default:` branch has always been `console.error(USAGE); return 1`.
  The real fail-open was an unknown FLAG, which no report tested, and the misdiagnosis was relayed
  verbatim into the fix brief. Report the symptom you measured, not the one you inferred from it.
- **`cb4e5b7`'s message is wrong** (`b9b99a6` on `origin/feat/round-7-band-kinds` is the same commit
  pre-merge), and it is on `master` where it cannot be rewritten. It claims it taught
  `unframed-chart` the two new kinds; it widened `CHART_ENTRY_POINT_TAG`, which only
  `chart-missing-aria-label` reads. `unframed-chart` keys on `<ChartLegend items={[` and carries no
  kind list at all — there was never an asymmetric pair to fix.
- **Open question, not a plan.** The import gate does not make `CHART_ENTRY_POINT_TAG` or the oxlint
  plugin's `CHART_TAGS` redundant: that list still answers _which_ tags owe an `ariaLabel`. The gate
  only converts a kind missing from the list from a false positive into an under-report. Collapsing
  the two lists is a separate, larger change and has not been made.

## 1.23.0 — two band kinds, an x-tick seam, CLI resolution

**No export removed or renamed; six new runtime exports and nine new types.** Nothing you wrote
changed. Every entry is additive, and the batch runs the other way from the last three: those made
the guard stricter, this one makes the framework more expressive.

**Two chart kinds `CartesianChart` structurally could not host.** It renders `AxisLeftNumeric`
unconditionally and builds x as `scalePoint` — positions, no widths. `BandStrip` has no y dimension
to axis; `MirroredBars` has two, and needs band widths. Both compose `ChartFrame` directly and
declare themselves with `theme-allow-file hand-rolled-plot`, alongside `DualPanel`.

| New on `basalt-ui/charts`                                                | Note                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BandStrip` (+ `BandStripProps`, `BandStripSeries`, `BandSpan`)          | 1-D categorical bands. `getBand(d) => { state, fill?, absentFraction?, marker? }`; `series` IS the state set, so a strip cannot name a state it does not draw. `cursorResolution` defaults `'leading'`                                                    |
| `MirroredBars` (+ `MirroredBarsProps`, `MirroredBarPane`)                | two bar panes, one x scale, one baseline, independent domains. `up`/`down` take `{ key, max?, autoMaxFloor?, ticks?, format }`; plus `upFraction` (the up pane's share of the band height, where the baseline sits), `getAbsentFraction`, `getBarOpacity` |
| `foldBands` (+ `BandFold`, `BandTooltipConfig`, `BandTooltipRowContext`) | the width-driven fold both kinds run, exported so a consumer can test their `merge` against the real grouping                                                                                                                                             |
| `HatchPattern`, `hatchFill`, `hatchSizeFor`                              | the absence fill                                                                                                                                                                                                                                          |

The shared choreography lives in an internal `useBandPlot` — **not exported**, deliberately: it is
the kinds' contract with each other, not a public seam.

**`MirroredBars` reverses a recorded decision, and the recorded reason for it was wrong.** The old
entry in `docs/CHARTS-SPEC.md` read _"no two-bar-pane kind with independent per-pane scales"_, with
_"a second consumer asks"_ as its trigger. That trigger never fired. Round 4 framed the blocker as
independent SCALES; `DualPanel` already had `topYDomain`/`bottomYDomain`, so that was never it. The
real blockers are that `DualPanel`'s top pane is a LINE pane and its bottom takes one SIGNED
`getBar` over a symmetric domain. A decision recorded against the wrong blocker outlives its own
refutation.

**`xTickValues?: (keys, xMax) => readonly string[]` on `CartesianChart`**, forwarded by `Bars`,
`MultiLine`, `StackedArea`, `ZonedLine` and both band kinds. It resolves AHEAD of `xTicks`, which is
unchanged and still works; omit both and ticks are chosen to fit (`smartTicks`), exactly as before.
Reach for it on a dense time axis: the tick choosers append the final key unconditionally, so a
COUNT that does not land on the last index paints two labels on top of each other at the right edge
— at every count, not at an unlucky one. On the consumer that reported it, the local tick helper
went 200 → 170 lines; it shrinks, it does not disappear. (The promise was 160. The 10-line miss is
docblock — the port's own JSDoc grew, because the helper stopped being a fallback and became the one
seam every chart on the page passes through.)

**`basaltAppPlugin`'s `icons` takes an array now.**

```ts
icons?: false | { dir?: string } | readonly BasaltAppIcon[]
// BasaltAppIcon = { src, sizes?, type?, purpose?, rel? }
icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
```

Every entry becomes a manifest icon; an entry reaches the head only when it names a `rel` (`'icon' |
'shortcut icon' | 'apple-touch-icon' | 'mask-icon'`) — which is what lets an app whose `index.html`
already links its favicon take the generated manifest without a duplicate tag. An empty array reads
as `false`, i.e. no `icons` member rather than an empty one. `{ dir }` and the default are
byte-identical to before. **If you kept a hand-written `manifest.webmanifest` because the plugin
could not name your icon, you can delete it now** — with its permanent `theme-allow-file` — the
generated manifest reproduces it member for member, plus an `id` a hand-written copy usually lacks.

**CLI: a repo root with no `workspaces` field was invisible to everything.** With the install one
level down and nothing declaring it, `check-theme` printed "no off-palette colors" having scanned
**zero files** and `doctor` inferred `tokens-only` for a full Mantine consumer. `resolveProjectDir`
now falls back to a bounded two-level layout scan when there is nothing declared to read; a declared
`workspaces` still wins, and 2+ candidates stays ambiguous. `BASALT_CWD` is honoured by all three
commands now, not two.

- **`sync` is profile-aware.** A `"basalt": { "profile": "tokens-only" }` consumer has no scaffold
  to reconcile, so `sync` prints `n/a` and exits 0 — `sync --check` is now wirable into a
  tokens-only repo's CI. It used to refuse and prescribe `basalt-ui init`, the one command that
  would have written a competing install.
- **`DESIGN.md` version rot is healed, not re-stamped.** The stamp was never a constant: `DESIGN.md`
  is a **seed**, written once and never reconciled, so the same line read 1.0.0 / 1.9.0 / 1.21.0 /
  1.22.0 under one install. Reported as four doc bugs over three rounds; it was one. The template
  names no version and `sync` rewrites openers already written.

**The `theme-allow` shape grid is enumerated, not collected.** The reported fifth hole was three:
the closer-alone-on-its-line shape that got reported, a `MAX_COMMENT_BLOCK_LINES = 8` budget
truncating the walk inside a ~12-line docblock (not a JSX shape at all), and the plugin requiring
the annotation's comment to be the LAST one above the node — so a reason wrapped onto a second `//`,
a shape argo writes, reported under oxlint while the guard waived it. The grid now runs the four
axes that vary (comment style × token position × where the closer falls × what follows), pinned row
for row in `src/guard/check-source.test.ts` (37 supported + 8 asserted-unsupported) and
`configs/oxlint-plugin.test.ts` (32 + 8; the guard's extra five rows are CSS/HTML/JSON dialects
oxlint never sees). Zero disagreements, down from five — **and no waiver tally moved in any of the
seven consumer repos.**

Asserting the unsupported cells is the point: it stops "unsupported" and "silently broken" reading
the same. What does NOT waive, in both halves:

| Shape                                                                                                            | Why                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| a blank line between annotation and code — after `//`, after `{/* */}`, or after a `{/*` whose closer sits alone | a blank line is how you say "this comment is not about the next statement"                |
| the token mid-sentence in a line comment, a docblock gutter, or a JSX expression comment                         | prose that MENTIONS the token is not an annotation — the reason it must START its comment |
| the token inside a string literal                                                                                | same                                                                                      |
| above a multi-line OPENING tag, with the finding on a later attribute line                                       | a waiver reaches the first line below its comment, not an arbitrary line further down     |

**Corrected consumer findings.** _"`sync` scaffolds 19–20 files into a consumer root"_ **did not
reproduce** — those runs used a stale `bunx` cache of 1.20.0, and `bunx` does not re-resolve a
package it already has. Check an upgrade against the local bin. Round 6's _"`doctor` exits 0 on hard
failures"_ was a pipe artifact (`$?` read after `| tail`) and was already withdrawn.

## 1.22.0 — the toolchain stops overclaiming

**No export removed or renamed; four added.** Nothing you wrote changed. Every entry below is a
check that reported an answer it had not earned, so a green CI on 1.21.0 was, for several of them,
green over an empty set.

**`sync` refuses where it used to scaffold.** Run from a sub-package that depends on basalt-ui but
holds no `.basalt/manifest.json` — `apps/dashboard`, `apps/web` — it printed `0 updated, 20
recreated`, wrote a second `basalt` key, and stood up a complete competing install beside the real
one at the repo root. argo and rb both reverted it by hand. It now resolves its project exactly as
`check-theme` and `doctor` do, and **exits 1** when the resolved project has no manifest, naming the
install it found above instead. The refusal runs before the `basalt.roots` backfill, which was half
the damage. Two ways to unblock it:

```bash
cd <the package holding .basalt/manifest.json> && ./node_modules/.bin/basalt-ui sync
BASALT_CWD=<that package> ./node_modules/.bin/basalt-ui sync   # or from anywhere
```

The summary line gained a `created` counter. **`recreated` now means what it always claimed** — the
ledger placed that file once and it went missing. Twenty first-time writes were never that.

**`--audit-allows` judges plugin-rule annotations.** They used to print "not a check-theme kind" and
drop out of the exit-1 gate, so the gate covered an empty set wherever the waivers were plugin
rules: argo's whole tally was `0 live, 0 dead, 8 outside reach`, and 11 of linewatch's 14 went the
same way. Each is now probed by re-running oxlint over that one file with the annotation
neutralized. Judged now: argo 8 of 8, linewatch 14 of 14, basalt's own tree 23 of 23.

**It requires oxlint to be reachable.** The probe writes one neutralized sibling file and re-runs
oxlint over it (oxlint has no stdin mode), removing it in a `finally`. Where oxlint cannot run, the
annotation is reported as **"cannot judge"**, never as dead. The report now also prints the scope it
audited — `0 dead` over `basalt.roots` was reading as `0 dead anywhere`.

**`doctor`'s `lefthook-preset` check asks a different question.** It tested whether the config text
contained the `extends` string. It now asks whether the gate EXISTS, via `lefthook dump`, which
resolves `extends`, `include` and per-command `root:`. linewatch wires all three jobs with
`root: 'web/'` precisely because `extends` merges commands _without_ their working directory — it
was correctly configured, got warned, and the old advice would have broken it. Three outcomes: a
broken `extends` target is still a hard fail, a provably absent gate is a warn, and where
`lefthook dump` could not run you get an advisory warning naming what it could not see.

**`basalt/shadow-basalt-export` narrowed twice.** It now gates on `isBasaltScopedFile` like every
other rule in the file, and needs a component-SHAPED declaration — a function, an arrow, a
`memo`/`forwardRef` wrapper, or a class extending one. It had been firing on a `SlugTracker` class
in a React-free package carrying no basalt-ui dependency, telling it to import from basalt-ui. The
stated limit is unchanged: exact-name-only, a tripwire, not coverage.

**`basaltAppPlugin({ icons: false })` now omits the manifest's `icons` member too.** It skipped the
head `<link>` icons and emitted the two PNG manifest entries anyway, so `{ manifest: true, icons:
false }` shipped an installable app pointing at two 404s. The manifest is now **honest** about
icons — it is not yet **sufficient**. If you went hybrid over the 404s, dropping the hand-written
half here costs you every icon unless your `public/` matches basalt's six filenames: at this
release `icons` was still `false | { dir?: string }` over those six, so an app whose icon is
`favicon.svg` could pick between a manifest naming two PNGs it never builds and a manifest with no
`icons` member at all. The array form that fixes it is in `## Unreleased`. The option's JSDoc said
"skips the head `<link>` icons"; it now says what the option does.

**Two `theme-allow` comment shapes were silently broken and now work.** Plainly: this is the fourth
hole found in this one contract in three rounds. A thirteen-shape matrix — every shape a consumer
had been SEEN to write — is pinned in both halves, `src/guard/check-source.test.ts` and
`configs/oxlint-plugin.test.ts`. **The claim that followed it here, that the two parsers could
therefore no longer disagree, was false when it was written**: a list of collected anecdotes cannot
close a contract. Three more holes were open at this release. See `## Unreleased`.

| Shape                                         | What it did                                                                                                                | Now                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `/** theme-allow <id> — <why> */` on one line | waived under oxlint, reported under `check-theme`                                                                          | both halves honour it                   |
| `{/*` + token on the next line + `*/}`        | comment-stripping left a bare `}`, so the line read as CODE and the annotation was classified trailing — scoped to a brace | scoped to the node below it, as written |

**linewatch writes that wrapped shape for every hand-composed chart axis**, so any _guard_ kind
annotated that way was silently unwaivable. It only appeared to work because the rules it names
(`hand-rolled-plot`) live in the oxlint plugin, whose placement test is comment-node-based and never
saw the brace.

**New, additive — `./guard` gains four runtime exports**, the reader half of the audit:

| Export                                       | Note                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `findAllowAnnotations(text, relPath, cfg)`   | every annotation as written, ids split into `guardKinds` / `pluginRules` / `unknownRules`. Shares `collectAllowAnnotations` with `checkSource`, so it cannot list a line the scan does not honour |
| `neutralizeAllowAnnotation(text, line, cfg)` | one annotation rewritten to the token below, every other left intact — the probe half of an audit                                                                                                 |
| `NEUTRALIZED_ALLOW_TOKEN`                    | so a guard probe and an oxlint probe neutralize identically                                                                                                                                       |
| `PLUGIN_RULE_IDS`                            | the ids only oxlint can judge                                                                                                                                                                     |

The `AllowAnnotationSite` type ships alongside them.

**Known gaps, reported and not fixed:** `--audit-allows` says nothing about `basalt.exempt` — a
whole file removed from the scan, the broadest exception the config surface has — and its
`scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`.

## 1.21.0 — the `theme-allow` grammar

**No export removed or renamed.** One break, and it is in the escape hatch itself: **file scope must
now be spelled `theme-allow-file`.** At 1.20.0 an annotation that named a rule and gave a reason —
the exact shape the rule's own message asks for — was promoted to a whole-file declaration, which is
why per-node scoping never actually shipped. The two forms are now distinct:

```text
theme-allow                                  → this node/line, EVERY rule   (reports theme-allow-unscoped)
theme-allow <id>[, <id>…] [— <why>]          → this node/line, those rules
theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those rules; a bare one waives NOTHING
"basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON / .webmanifest
```

**The migration is one word per file declaration.** Measured across the consumer sweep: linewatch
0 → 11 findings, argo 0 → 6, rb 0 → 0 — all `warn`, so **no build changes colour**.

```diff
-// theme-allow hand-rolled-plot — two panes over one x scale
+// theme-allow-file hand-rolled-plot — two panes over one x scale
```

**An annotation must now START its comment** — after `//`, `/*`, `<!--`, a block-comment gutter `*`,
or nothing but whitespace. Both parsers used a bare substring search, so a comment that merely
_mentioned_ the token parsed as the legacy blanket form and switched every rule off on the line
below. linewatch documented its own waivers in a docblock and thereby disarmed the file — a false
NEGATIVE, and the reason this ships as a break rather than a grace period. Every annotation anyone
actually writes still qualifies; a sentence about the escape hatch no longer waives anything.

**A comment-only annotation now reaches the first CODE line below it**, walking through the rest of
its own comment block. Before, a reason that wrapped onto a second line, or a docblock's `*/`,
absorbed the waiver and the natural shape silently waived nothing — argo hit that three times in one
upgrade. A blank line still ends the block.

**`.json` / `.webmanifest` finally have a waiver.** They have been scanned since 1.20.0 and cannot
hold a comment, so their findings were unwaivable and the printed remedy prescribed something
impossible; both consumers fell back to a blanket `exemptRules`. Use a member key — but for a
manifest, `basaltAppPlugin` is the first remedy, since a hand-copied hex drifts from the palette:

```json
{ "basalt:theme-allow-file": "raw-hex — a PWA manifest theme_color must be a literal hex" }
```

**Two API-shaped fixes worth acting on:**

| Change                                                                     | What to do                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSearchParamStore` / `createMultiSearchParamStore` gain `linkSearch` | replace every nav link's `search: { <param>: '<literal>' }` with `search: <store>.linkSearch`, passed BY REFERENCE. A module-scope literal pins the fallback on every click — argo's reader had ZERO call sites, so "remember my window" had never worked |
| `BasaltShell` collapse moves to `createPersistedState`                     | the key is now `basalt:<storageKey>` holding `{ v, value }`; read it with `readPersistedValue(storageKey, 1)`. A one-time migration adopts the raw pre-1.21.0 value, so the sidebar does not re-expand on upgrade                                         |

**New, additive:**

| Surface                                              | Note                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-theme --audit-allows`                         | every waiver and every `exemptRules` entry with what it still suppresses, proved by re-running the guard with that one occurrence neutralized. Exits 1 on a dead waiver — wire it into CI                                                     |
| `basalt.exemptRules` takes paths, globs and a reason | relative paths and directory prefixes (`public/site.webmanifest`, `src/agent`), globs (`*` stops at `/`, `**` does not, a slash-free glob also matches the basename), and `{ paths, reason }`. Entries that suppress nothing are now reported |
| `doctor` → `lefthook-preset`                         | hard-fails a broken `extends` target. lefthook merges a missing target into ZERO commands and exits 0, so a stale path leaves a repo with no pre-commit gate and a clean `lefthook dump`. `sync` reports the same seam                        |
| `basaltAppPlugin({ colorScheme })`                   | `'dark'` (default) / `'light'` / `'auto'` / `false`. Set it to whatever the app passes as `defaultColorScheme` — before this, a light-scheme consumer got dark native controls permanently                                                    |
| `VX.text.nano` (10px) + `VX.text.display` (30px)     | the two rungs `inline-font-size` could previously only be waived for. A 20px rung was rejected: 21/20 = 1.05 is below the ladder's 1.06×–1.17× band, so `h2` is the remedy                                                                    |
| `sync` backfills `basalt.roots`                      | only `init` wrote it, so every existing consumer sat on the undeclared `src` default while `guard-scan` passed. A declared value is never overwritten                                                                                         |
| `basalt/shadow-basalt-export` reads all nine barrels | the charts layer included. Still exact-name-only — a **tripwire, not coverage**                                                                                                                                                               |

Also: `check-theme`'s `inline-spacing` no longer reads a unitless number in a plain options bag as
CSS (`fitBounds({ padding: 48 })` stops reporting); the shipped `oxfmt` pre-commit job drops back to
`*.{ts,tsx,js,jsx,css}` and gains `--no-error-on-unmatched-pattern`; `tokens:css` emits `0.1` rather
than `0.10`, so a committed sheet stops failing prettier — re-run the command to pick it up.

**The lefthook preset overrides YOU, not the other way round.** An `extends` target wins on a
colliding key: declare `pre-commit.commands.oxfmt.run` (or `glob:`) in your own file and **yours**
is the one silently discarded. Only keys the preset does not define merge in. The guard job runs
`${BASALT_BIN:-bunx --no-install basalt-ui}`; that shell default is the sanctioned seam, set via
`env:`, which does merge.

## 1.20.0 — enforcement

**No export removed or renamed.** The whole delta is that things which used to pass now report. If
your build goes red on this upgrade, that is the release working. Every new **kind** and **rule**
lands `warn` — but two other changes in this release do fail a build: `basalt/raw-size-literal`
promotes to `error`, and the widened markup scan reads `index.html` / `.webmanifest`, where a raw
hex is an `error`-severity colour kind. Two consumers exited 1 on exactly that.

| Change                                                           | What you'll see                                                                                                 | What to do                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `basalt/raw-size-literal` `warn` → **`error`**                   | CSS-length strings on `size`/`fz`/`fontSize` now fail lint                                                      | use a token (`size="sm"`); `warn` since 1.7.0, zero violations across all seven consumers |
| Five new guard kinds (`warn`)                                    | `theme-allow-unscoped`, `surface-shadow-override`, `css-raw-surface`, `inline-font-size`, `hidden-inline-style` | see below; promotion is tracked in `GRACE_PERIOD_KINDS`                                   |
| Two new oxlint rules (`warn`)                                    | `basalt/shadow-basalt-export`, `basalt/hand-rolled-shell`                                                       | import the shipped component instead of the fork                                          |
| `basalt/hand-rolled-plot`, `basalt/chart-legend-literal` widened | more sites report; both stay `warn`                                                                             | a widened rule does not promote in the minor that widens it                               |
| `doctor` `SKIPPED` exits non-zero, + 3 new hard checks           | doctor goes red where it was green                                                                              | that is the finding — see below                                                           |

**`theme-allow` has a new contract, and one comment shape stops waiving.** A bare `theme-allow`
still waives every kind, but now reports `theme-allow-unscoped`. Rescope it — and spell the id
right, because a word in the id slot that names no rule now waives NOTHING rather than degrading to
the blanket form:

```diff
-// theme-allow
+// theme-allow raw-surface — third-party widget needs a literal corner
```

**The break: a reason with no separator introducing it.** `// theme-allow legacy vendor asset` used
to waive the line; it now waives nothing and the un-suppressed finding reports at its own severity
(`error` for `raw-hex`). The first word after the token is read as a rule id, and an id that names
no rule fails closed — that is the whole point, since the alternative is one mistyped character
silently widening a scoped waiver into a blanket one. No annotation in any of the seven consumer
repos writes that shape; every one of them introduces its reason with `—`, `–`, `-` or `:`. Add a
separator, or an id:

```diff
-// theme-allow legacy vendor asset
+// theme-allow raw-hex — legacy vendor asset
```

Prose AFTER a resolved id is safe and needs no separator —
`// theme-allow raw-surface sub-scale legend corner` waives `raw-surface` and reports nothing. Only
a comma keeps the id list open past the first id.

Two placements that used to fail now work, both matching what the oxlint plugin always did: a
comment-ONLY line directly above the reported line (the only form JSX can express — the reported
line is usually a multi-line opening tag or a `{expr}` child), and in CSS a trailing annotation
reaching back over the declaration it terminates, which is what survives the shipped `oxfmt`
reflowing a long `background-color` so the hex lands above the comment.

**`basalt/hand-rolled-plot` waivers must now be written deliberately.** Every assembly node is
reported individually, and a waiver is no longer picked up off whatever comment happened to sit on
the file's first assembly node — it needs a written declaration naming the rule and giving a reason,
anywhere in the file: `// theme-allow hand-rolled-plot — two panes over one x scale`.

**But the waiver is still whole-file, and per-node scoping is not expressible at 1.20.0.** Naming
the rule AND giving a reason is what `hasFileDeclaration` matches, at any line — so a comment
intended for one node silences the file. Dropping the reason keeps it node-scoped in the oxlint
plugin, but then `check-theme` reports `theme-allow-unscoped ("no reason")`. The two halves of the
contract intersect at exactly one legal shape and that shape is whole-file. Write the declaration in
the component's docblock, where it reads as the file-level decision it is. **Fixed in 1.21.0** —
see that section; the declaration moves to `theme-allow-file`.

**`doctor` will go red.** `SKIPPED` is a third outcome beside pass/warn/fail and exits non-zero on
its own — "All checks passed" is only printable when every check RAN. Three new hard checks:
`basalt-resolves` (walks cwd → ancestors → workspace packages), `guard-scan` (would `check-theme`
cover more than zero files?), `oxlint-preset` (does `.oxlintrc.json` really extend the shipped
preset? JSONC is parsed, not rejected — `init` keeps an existing config, so one repo ran five minors
with the whole lint half off).

**New, additive:**

| Surface                                                          | Note                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt.profile: 'tokens-only'` / `--tokens-only`                | disables the 17 kinds whose remedy is a Mantine component, prop or the React theme factory. `check-theme` requires it DECLARED; `doctor` infers it, because its profile only changes advice, never enforcement                                                                                                                                                                                                                               |
| `basalt.include: [...]`                                          | scan a named file outside `roots` — and the only route to a `.json`, which is never blanket-scanned                                                                                                                                                                                                                                                                                                                                          |
| `basalt.roots` + a `lint:basalt` script                          | written by `init` from the real layout; `init` on an existing app is a lint-debt event, not a no-op                                                                                                                                                                                                                                                                                                                                          |
| `tokens:css --check`, `--selector-class <c>` (+ `--light-class`) | drift gate; the Tailwind `<html class="dark">` convention. There is no `scheme: { class }` API — the class form is CLI-only                                                                                                                                                                                                                                                                                                                  |
| `fonts:css [--out] [--check]`                                    | the shipped `--basalt-font-*` stacks as plain CSS, read out of `styles.css` — the only route to basalt's typefaces without the Mantine-coupled `styles.css`                                                                                                                                                                                                                                                                                  |
| `__APP_VERSION__` ambient declaration                            | ships via `src/register.ts`, re-exported by the root barrel: delete your hand-written ambient block. A subpath-only consumer does not get it                                                                                                                                                                                                                                                                                                 |
| `BASALT_CWD`                                                     | `check-theme`/`doctor` honour it, and relocate to the single workspace package carrying a basalt config when invoked from a root that has none                                                                                                                                                                                                                                                                                               |
| `@generated basalt-ui` header                                    | `tokens:css`/`fonts:css` output carries it on line 1, the version + invocation line on line 2, and `check-theme`, in a `.css` file with that exact header, skips the LINES that are basalt custom properties, selectors, `}` or self-closing comments — this is what fixed 116 violations reported inside the stylesheet `tokens:css` had just written. Committed output emitted by 1.19.1 has no header: re-run the command to get the skip |

`check-theme` also resolves `.html` / `.webmanifest` / `.json` as markup (colour kinds only), and
each root's PARENT now contributes its `index.html` and `public/` tree.

## 1.19.0 — nav

| Removed / renamed                                                 | Replacement                                                                                                                      | Note                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavLinkRenderer` (type)                                          | `defineNav` + `{...useNav(NAV)}` (`basalt-ui/router-tanstack`), or `SidebarItem.Anchor`                                          | basalt now paints every nav pixel                                                                                                                           |
| `BasaltShellProps.renderNavLink`, `AppSidebarProps.renderNavLink` | same                                                                                                                             |                                                                                                                                                             |
| `BreadcrumbLinkRenderer` (type)                                   | `AppBreadcrumbs.parentAnchor`                                                                                                    |                                                                                                                                                             |
| `BasaltShellProps.renderBreadcrumbLink`                           | same                                                                                                                             |                                                                                                                                                             |
| `BasaltShellProps.sidebarFooterExtra`                             | `mobileNav.moreExtra`                                                                                                            | its only host was the mobile drawer; it rendered nowhere on desktop                                                                                         |
| `AppSidebarProps.footerExtra`, `AppSidebarProps.onClose`          | —                                                                                                                                | the full-height mobile sidebar drawer is deleted                                                                                                            |
| `MobileNavItem` (type)                                            | `MobileNavSlot`                                                                                                                  |                                                                                                                                                             |
| `MobileNavSection` (type)                                         | `MobileNavGroup`                                                                                                                 |                                                                                                                                                             |
| `MobileNavLinkRenderer` (type)                                    | `MobileNavModel`                                                                                                                 |                                                                                                                                                             |
| `SidebarSection.mobileTab`                                        | `SidebarSection.mobile?: false \| NavSectionMobile` — an OBJECT (`{ tab: true, label?, icon? }`), or `false` to hide the section | `'tab' \| 'more' \| 'hidden'` is `SidebarItem.mobile` (`NavMobilePlacement`, `true` ≡ `'tab'`, `false` ≡ `'hidden'`) — a different prop on a different type |

A consumer with no router needs no migration — `href` + `onClick` still work.

**Expect new type errors, and read them.** `renderNavLink` took `to` as an opaque value, which is
why consumers reached for `to={target.to as never}`. `defineNav` types it, so a destination missing
a required `search` now fails to compile — in one repo that surfaced two nav links that had been
shipping without required params. Fix with a click-time thunk (`search: () => Schema.parse({})`),
never `search: true`.

## 1.17.0 — behaviour only, no export removed

| Changed                                              | Effect                                                       | Opt out                          |
| ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `resolveAxisDomain` clamps before padding, not after | the axis top moves on any chart with an `autoMaxFloor`       | lower the floor, or pin `domain` |
| `ChartFrame` `role="img"` → `role="group"`           | `role="img"` pruned the keyboard slider out of the a11y tree | —                                |

## 1.15.0 — chart layer rebuilt

The largest delta in the 1.x line. No shims were shipped.

| Removed / renamed                                                                                                                                                    | Replacement                                                                                                                                                | Note                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChartHoverSync`, `ChartHoverSyncProps`                                                                                                                              | `globalCursorStore` / `createCursorStore` / `useChartCursor` / `useCursorState` — **no provider**                                                          | `ChartCursorScope` now _isolates_ a subtree; it is the inverse of the old provider, not a rename                                                                                                                                             |
| `HoverContext`, `HoverCtx`, `useHoverSync`, `DEFAULT_NO_OP_SET_HOVER`                                                                                                | `useChartCursor`, `useCursorState`, `CursorState`, `CursorStore`                                                                                           | context → `useSyncExternalStore`                                                                                                                                                                                                             |
| `ResponsiveChart`, `ResponsiveChartProps`                                                                                                                            | `CartesianChart` / `CartesianChartProps` (+ `autoMargin`, `PlotContext`, `PlotRect`)                                                                       | now mandatory for every single-plot cartesian chart, enforced by `basalt/hand-rolled-plot`                                                                                                                                                   |
| `ChartTooltip` (tip-based), `useChartTooltip`, `useTooltipStyles`                                                                                                    | `ChartTooltipFloat` + the `tooltip: CartesianTooltipConfig` prop                                                                                           | portal / flip / clamp done once                                                                                                                                                                                                              |
| `BarsAxisConfig`                                                                                                                                                     | `AxisConfig` + `resolveAxisDomain`                                                                                                                         |                                                                                                                                                                                                                                              |
| `ZonedLineTooltipLabel`                                                                                                                                              | `tooltip` config on the kind                                                                                                                               |                                                                                                                                                                                                                                              |
| `ZonedLine`/`MultiLine`: `yDomain`, `yAutoPad`, `yAutoMaxFloor`, `yAutoMinCeil`, `numTicksY`, `formatYTick`                                                          | one `y?: AxisConfig<T>`                                                                                                                                    | `y` is **optional** where `yDomain` was required                                                                                                                                                                                             |
| `ZonedLine`/`MultiLine`: `tooltipLabel`, `renderExtraTooltipRows`                                                                                                    | `tooltip.label`, `tooltip.extraRows` (`CartesianTooltipConfig`)                                                                                            | there is no `appendRows`; the field is `extraRows`                                                                                                                                                                                           |
| `ZonedLine`/`MultiLine`: `formatValue`                                                                                                                               | **`y.format`** — or per-series `ChartSeries.formatValue` for one row                                                                                       | `CartesianTooltipConfig` has no value formatter: the axis format IS the tooltip value format                                                                                                                                                 |
| `ZonedLine`/`MultiLine`: `numTicksX`                                                                                                                                 | `xTicks`                                                                                                                                                   | `xZones` added alongside                                                                                                                                                                                                                     |
| `Bars`: `formatValue`, `hideBarTooltipRows`, `leftAxis`, `rightAxis`, `marginLeft`, `numTicksX`, `tooltipLabel`, `renderExtraTooltipRows`, `renderPrefixTooltipRows` | `y` / `y2` (`AxisConfig`), `xTicks`, `tooltip.{label,extraRows,prependRows}`, per-bar `BarsBar.formatValue` / `.tooltip`, measured `autoMargin` + `margin` | passing `y2` is what makes a chart dual-axis. `chartMargin({ rightAxis })` is **not** removed — it is still exported from `basalt-ui` and `basalt-ui/charts`; it is simply no longer needed, since the right gutter follows from measurement |
| `StackedArea`: `formatValue`, `numTicksX`, `numTicksY`, `yAutoMaxFloor`, `yLabel`                                                                                    | `y` (incl. `y.format`), `xTicks`; per-series `ChartSeries.formatValue`                                                                                     | `StackedAreaProps` has **no** `tooltip` prop — its tooltip is entirely derived from `series`                                                                                                                                                 |
| `Heatmap.width`                                                                                                                                                      | measures itself; takes `height` / `aspectRatio` / `fill`                                                                                                   |                                                                                                                                                                                                                                              |

## 1.12.0 — agent-chat, behaviour only

| Changed                                                                    | Effect                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streaming` no longer selects the image allowlist                          | **security-relevant.** Model output must now pass `contentTrust="untrusted"`; leaving it unset silently reopens prompt-injection image exfiltration |
| consumer `rehypePlugins` output is now sanitized, `clobberPrefix` is empty | a consumer injecting non-default elements must pass a matching `sanitizeSchema`                                                                     |

## 1.11.0 — agent parts

Semver-breaking in a minor; the commit body says so.

| Removed / renamed                                        | Replacement                                                                                           | Note                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ToolCallPart` flat `{ type, toolName, input, output? }` | `ToolCallPart` as a 7-arm union discriminated on `state` (`input-streaming` … `output-error`)         | mirrors the AI SDK v7 lifecycle                                                             |
| the error field named `error`                            | `errorText`                                                                                           | the SDK union has no `error`                                                                |
| flattened approval fields                                | nested `approval: ToolApproval`, carried verbatim                                                     | flattening dropped `isAutomatic` / `signature`                                              |
| —                                                        | every `AgentPart` now extends `PartBase` with a **required `id`**; `withPartIds` mints them on drafts | a 1.10-shaped part rehydrated from localStorage no longer throws, but id-less parts collide |
| `ToolChip` threw `assertNever` on an unknown state       | now falls back instead of throwing                                                                    |                                                                                             |

## 1.0.0 — the Mantine pivot

| Removed / renamed                                                                             | Replacement                                                               | Note                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `./css` subpath (877 lines: 307 custom props, 19 utilities, a reset, the Tailwind entrypoint) | `basalt-ui tokens:css` / `basalt-ui/tokens.css` — **but only from 1.3.0** | between 1.0.0 and 1.2.x the only CSS door was `styles.css` + `buildPaletteCss()` |
| `./starlight` subpath                                                                         | —                                                                         | no replacement                                                                   |
| the OKLCH foundation palette, ShadCN/Tremor/Starlight doctrine                                | the three-tier `--vx-*` system                                            | see `docs/FRAMEWORK-FREE.md` for the token-only route                            |

Names that have no 1.x equivalent: the `--chart-blue-1..8` sequential ramp (1.x is categorical
`--vx-fill-*` only), the default font stacks as a token (they live in `styles.css`), `purple` as a
text color, `black`, `blue-400`/`green-400`.

**The typefaces changed at 1.0, not just their delivery.** 0.4.2 shipped Instrument Sans; 1.x ships
Nunito Sans (body) + Hubot Sans (condensed headings), mono unchanged at JetBrains Mono. `fonts:css`
emits the 1.x stacks — for a 0.4.2 migrant that is a **rebrand**, not a restoration. It also emits
`--basalt-font-head-stretch: 88%`, tuned for Hubot Sans specifically; pointed at another face it
silently condenses it.

## 1.0.1 — CLI binary renamed

`basalt` → **`basalt-ui`**. Never `bunx basalt`.

---

## Lint and guard rules that tightened

Two independent mechanisms, each with its own ledger — read the ledger, not this table, for what is
in grace TODAY. `GuardKind` severities (`basalt-ui check-theme`) default to `error` and are
downgraded only by `GRACE_PERIOD_KINDS` (`src/guard/index.ts`). `basalt/*` oxlint rule severities
live in `configs/oxlint.json`, and since 1.20.0 their grace is tracked by `PLUGIN_RULE_GRACE`, a
named export beside the plugin — a test asserts it against the shipped preset in both directions, so
deleting an entry forces the level flip in the same commit.

| Rule                               | Landed           | Became `error`                                                           |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `mantine-shade-index` (guard kind) | 1.7.0 as `warn`  | **1.11.0**                                                               |
| `basalt/raw-scroll-container`      | ≤1.2.0 as `off`  | `warn` 1.10.0 → **`error` 1.13.0**                                       |
| `basalt/ai-sdk-major`              | 1.10.0 as `warn` | **1.13.0**                                                               |
| `basalt/agent-no-raw-usechat`      | 1.10.0 as `warn` | **1.13.0**                                                               |
| `basalt/agent-resume-guard`        | 1.10.0 as `warn` | **1.13.0**                                                               |
| `basalt/raw-size-literal`          | 1.7.0 as `warn`  | **1.20.0**                                                               |
| `basalt/hand-rolled-plot`          | 1.15.0 as `warn` | still `warn` — widened again at 1.21.0; grace restarts with the widening |
| `basalt/chart-legend-literal`      | 1.15.0 as `warn` | still `warn` — widened at 1.20.0                                         |
| `basalt/shadow-basalt-export`      | 1.20.0 as `warn` | may stay `warn` permanently — widened at 1.21.0, narrowed at 1.22.0      |
| `basalt/hand-rolled-shell`         | 1.20.0 as `warn` | —                                                                        |

`card-with-border`, `inline-display`, `raw-html-layout`, `raw-form-control`, `raw-font-family` and
the other original guard kinds have been `error` since before 1.2.0 — they never had a grace minor.
Guard findings only gained a severity field at all in 1.4.0; before that every finding was fatal.

**Rule-id rename at 1.1.0:** `basalt/import-boundary` split into `basalt/visx-boundary`,
`basalt/visx-tooltip` and `basalt/token-layer-boundary` (the last is repo-local and deliberately not
in the shipped preset). A config still naming `import-boundary` after 1.1.0 disables nothing.

## Deprecated, not yet removed

The 32 camelCase `--vx-*` aliases deprecated in 1.5.0 are **still emitted at 1.21.0**.
`buildPaletteCss({ legacyAliases: false })` / `tokens:css --no-legacy-aliases` opts out now; a later
minor flips the default.

## Not verified

- Props declared inline on a component (`function X({ a }: { a: string })`) rather than on an
  exported type are outside the diff method used here. Spot checks on the shell and charts modules
  found none, but the negative is unproven.
- The 0.4.2 `./css` line counts in the 1.0.0 table (877 lines / 307 custom props / 19 utilities) come
  from the removal commit, not from a re-read of the 0.4.2 tarball.

`AppBreadcrumbs.parentAnchor` was listed here through 1.20.0 and is now verified: it is declared on
the shipped `dist/shell/app-breadcrumbs.d.ts` (`parentAnchor?: NavAnchor`, with `parentHref` as the
no-router fallback). The type is inline on the component rather than an exported `AppBreadcrumbsProps`,
which is why the export-surface diff never saw it.
