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
| Round-7 batch — two banded chart kinds, an x-tick seam, CLI resolution                                 | unreleased                     |

Adopted downstream: seven consumer repos, all on 1.22.0 as of the round-7 sweep. `rollhook` runs
the framework-free route with no Mantine and no React (`docs/FRAMEWORK-FREE.md`);
`basalt-ui-obsidian` is a downstream _library_, not an app.

The June-era roadmap/handover docs in `docs/archive/` still phrase built work as "remaining"; that
language is historical, see the banner on each.

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

**Corrected findings.** _"`sync` scaffolds 19–20 files into a consumer root"_ did not reproduce:
those runs executed a stale `bunx` cache of 1.20.0, and `bunx` does not re-resolve a cached
package. Third round in which a consumer diagnosis was directionally wrong on cause, and the second
caused by the measuring harness rather than the code — round 6's was `$?` after a pipe. **Check an
upgrade against the local bin.**

## Round-7 batch — unreleased

The first batch this cycle that widens the framework rather than the guard.

- **Two banded chart kinds** (`c1da509`; playground routes `f72611a`, the non-finite-`absentFraction`
  fix `370b9be`, `chart-in-raw-surface` `cc4903d`) — `BandStrip`
  (1-D categorical bands, no y dimension) and `MirroredBars` (two bar panes, one x scale, one
  baseline, independent domains). Neither can compose `CartesianChart`, which renders
  `AxisLeftNumeric` unconditionally and builds x as `scalePoint`. Shared choreography in an internal
  `useBandPlot`; `foldBands` + `HatchPattern`/`hatchFill`/`hatchSizeFor` ship.
  **Proven by porting, not by demo:** linewatch's real charts, 1884 → 957 source lines, all 11 of
  its `hand-rolled-plot` waivers retired, 14 `theme-allow` → 3. The port caught two live bugs —
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
one tooltip row, so extra rows stay hand-authored. **Handoff:** the guard's `unframed-chart` kind
(`CHART_ENTRY_POINT_TAG`, `src/guard/index.ts`) still names only the nine older kinds — `cc4903d`
taught the oxlint plugin's `chart-in-raw-surface` about the two new ones, the regex twin was missed.
`agent/templates/CLAUDE-block.md.tpl` still says `DualPanel`/`Donut`/`Heatmap` are the declared
exceptions.

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

**Known gaps — reported, not fixed:** `--audit-allows` says nothing about `basalt.exempt` (a whole
file removed from the scan, the broadest exception the config surface has), and its `scoped to …`
line does not distinguish `theme-allow` from `theme-allow-file`. **Handoff:** the profile-gated
`check-theme` manifest hint lives CLI-side behind a sentinel path (`PLAIN_JSON_HINT_PATH`,
`src/cli/index.ts`); it belongs in the guard as `guardWaiverHint(relPath, { profile })`.

## Round-6 batch — 1.22.0

Full per-export detail in `packages/basalt-ui/MIGRATING.md` § 1.22.0; the shape of it:

- **`sync` refuses instead of scaffolding** (`40d7fc6`) — resolves its project as
  `check-theme`/`doctor` do, then exits 1 when that project has no manifest, naming the install it
  found above. The refusal runs BEFORE the `basalt.roots` backfill, which was half the damage.
  `created` is its own counter now.
- **`--audit-allows` gains the oxlint half** (`cfb4d1a`, `40d7fc6`) — a plugin-rule annotation is
  probed by re-running oxlint over one neutralized sibling file. Judged: argo 8/8, linewatch 14/14,
  basalt's own tree 23/23. Unreachable oxlint is "cannot judge", never "dead". The reader ships as
  four runtime exports on `./guard`, so the audit stops carrying a mirrored regex one shape behind.
- **`doctor`'s `lefthook-preset` asks whether the gate EXISTS** (`40d7fc6`), via `lefthook dump`,
  which resolves `extends`, `include` and per-command `root:`. A broken `extends` target stays a
  hard fail, a provably absent gate is a warn, can't-tell is advisory.
- **Two `theme-allow` comment shapes fixed** (`cfb4d1a`) — a one-line docblock opener, and the
  wrapped `{/*` whose bare `}` scoped the waiver to a brace. **Fourth hole in three rounds**; the
  thirteen-shape matrix shipped with it did not close the contract (see round 7).
- **`shadow-basalt-export` narrowed** (`314eae8`), **`icons: false` reaches the manifest**
  (`9d6fbe0`), **`check-theme`'s manifest hint is profile-gated** (`40d7fc6`) — leading with
  `basaltAppPlugin` is unreachable for a tokens-only consumer.

## Round-5 consumer sweep (2026-08-22)

Seven repos upgraded to 1.20.0. The release did what it claimed; what round 5 found instead was
**documentation making false load-bearing claims**, which is the failure `MIGRATING.md` exists to
prevent. Full reports: `.claude/feedback/round-5/`. Everything it left open is closed in 1.21.0.

1. **Per-node `theme-allow` scoping was half-delivered and the doc claimed it whole** — the two
   halves intersected at one legal shape and it was whole-file. Closed: file scope is now spelled
   `theme-allow-file`.
2. **Four wrong rows in `MIGRATING.md`**, found by re-auditing every replacement against the built
   `.d.ts` rather than the commit it came from. The one a consumer caught: `ZonedLine`/`MultiLine`
   `formatValue` mapped to `tooltip`, which carries no value formatter — the format resolves from
   `y.format`. rb got it right by reading the types and would have got it wrong trusting the doc.
3. **A correction that lands only in a repo-internal file has not shipped.** The
   `createSearchParamStore` scoping was right in this repo's `CLAUDE.md` and absent from
   `agent/rules/*`, which is what `init`/`sync` copy into consumers. It now lives in
   `basalt-router.md`.
4. **`shadow-basalt-export` misses the renamed majority** — linewatch's forks are `Cell` and `Box`,
   rb's is `Stat`. Structural. **Detection does not substitute for expressiveness.**
5. **`fonts:css` is correct and was not adopted by the consumer it was built for** — adopting it
   would rebrand rollhook's public site with a display face it never had. A feature can be correct
   and still not be the fix for the consumer that motivated it.

## Round 4 consumer sweep (2026-08-22)

Seven repos, every gate green, all three findings outside them. Full reports:
`.claude/feedback/round-4/`.

1. **The escape hatch was broken** — line-scoped, the two engines disagreeing about which line, a
   bare comment accountable to nobody. **Answered in 1.20.0**, completed in 1.21.0.
2. **The guard sees palette, not vocabulary.** ~15 independent re-rolls of shipped components, all
   green — `StatCard` alone re-rolled by 4 of 4 app consumers. **Partly answered**:
   `shadow-basalt-export` and `hand-rolled-shell` detect the two cheapest shapes. **The
   expressiveness half is still not built** — `StatCard`'s missing props, a query loading/error
   sibling to `EmptyState`, `createSearchSchemaStore`. `BandStrip` and independent bar-pane domains
   are answered in round 7 (`BandStrip`/`MirroredBars`). image-share re-reported both in round 6:
   204 lines of `query-state.tsx` over 10 call sites, and 290 lines of hand-rolled URL state.
3. **There is no API-delta story** — semantic-release's one-line-per-commit format never names a
   removed export. Answered by `packages/basalt-ui/MIGRATING.md`.

**Corrected findings** — both reported and both wrong: _"no release notes for any minor"_ (the
shipped `CHANGELOG.md` writes minors as `#` and patches as `##`; a grep for `## [x.y.z]` matches the
9 patches and none of the 23 minors), and _"the chart rules are outside `GRACE_PERIOD_KINDS`"_ (true
but not meaningful — they are oxlint plugin rules, whose severity had no grace mechanism at all;
`PLUGIN_RULE_GRACE` is the fix).

## Round-5 batch — shipped in 1.21.0

Round 5 found the same false-green class one layer in: waivers nobody re-checked, wiring checks that
matched a string instead of resolving it, and an API whose whole point was reachable only through a
JSDoc nobody had to read. Per-export detail in `MIGRATING.md` § 1.21.0.

- **The `theme-allow` grammar** (`268fb43`) — both parsers did a bare substring search, so a comment
  merely _mentioning_ the token switched every rule off on the line below; linewatch disarmed a file
  by documenting its own waivers. An annotation must now START its comment, file scope is spelled
  `theme-allow-file`, and a bare one waives nothing. A **consumer break**, measured: linewatch
  0 → 11 waivers, argo 0 → 6, rb 0 → 0, all `warn`, one word per declaration.
- **`check-theme --audit-allows`** (`25323be`) — every waiver, with what it still suppresses, proved
  by re-running the guard with that occurrence neutralized. Exits 1 on a dead one; found one in
  basalt's own shell (`8f785a1`). `exemptRules` takes paths, prefixes, globs and `{ paths, reason }`.
- **Toolchain seams** (`25323be`) — `oxlint-preset` resolves the `extends` target instead of
  matching the string; new `lefthook-preset` check, because a missing target merges to ZERO commands
  and exits 0. `sync` backfills `basalt.roots` — only `init` ever wrote it, so every existing
  consumer sat on the undeclared `src` default. An `extends` target WINS on a colliding key, hence
  `${BASALT_BIN:-bunx --no-install basalt-ui}`, the one overridable seam.
- **`store.linkSearch`** (`ad2b5bc`) — `createSearchParamStore`'s persistence lived entirely behind
  `validateSearch`, so adopting the store and never wiring the reader was usual, not merely
  possible: argo adopted it in three features and hand-rolled the persistence in all three.
- **The rest** — `basaltAppPlugin` gains `colorScheme`, scopes its anti-FOUC rule and hoists
  `<meta charset>` back inside the spec's 1024-byte window, 1653 → 46 (`d6426f0`). The type ladder
  gains `nano` (10) and `display` (30); a 20px rung was **rejected**, 21/20 = 1.05 being below the
  1.06×–1.17× band (`0d03db3`). `BasaltShell` persists collapse through `createPersistedState`
  (`129a31b`), which **retracts a round-4 finding** — argo's raw `localStorage` read was compliance
  with the shipped component, not drift. `tokens:css` emits `0.1`, not `0.10` (`cf55a20`).

## Round-4 batch — shipped in 1.20.0

Five repos hit one bug in five shapes: every gate passed and nothing was enforced. The fix is that
all of it is now reported rather than inferred. **Consumers will see `doctor` go red where it was
green — that is the point.** Migration notes ship in `packages/basalt-ui/MIGRATING.md`.

### The escape hatch

`theme-allow` now honours a standalone comment on the **preceding** line, matching the oxlint
plugin — they used to disagree, which made it unusable in JSX, where the reported line is a
multi-line opening tag or a `{expr}` child and a trailing `//` is a syntax error or visible text.
A trailing annotation in CSS also reaches back over the declaration it terminates, verified against
real `oxfmt` output: it reflows a long `background-color` so the hex lands ABOVE the comment, which
preceding-line support alone does not fix.

**`theme-allow <rule-id> — <reason>` scopes the exception to that one kind.** A bare comment still
waives everything (no upgrade breaks a build) but reports the new `theme-allow-unscoped` kind. A
word in the id slot that names no rule is recorded as unknown and waives **nothing** — an annotation
that reached for an id covers exactly the ids it got right, so a typo can never be more permissive
than the correct spelling. Every consumer had bare comments, basalt included — its own 22 are
rescoped in the same batch, verified by neutering each annotation and reading what the two engines
then reported rather than by guessing.
`basalt/hand-rolled-plot` no longer grants whole-file immunity off whatever comment happened to sit
on its first assembly node; a file-scoped waiver needs a written declaration naming the rule and
giving a reason. **Half-delivered:** every node is now REPORTED on its own, but not waivable on its
own — see the round-5 sweep above. Fix targets 1.21.0.

### Guard holes and false positives

New kinds, all `warn` for one minor: `surface-shadow-override` (a `boxShadow` built FROM tokens that
replaces `--vx-shadow-card` — the shape a token-fluent consumer writes, which the old `var()`/`${}`
skip waved straight through), `css-raw-surface` (the kebab dialect of the surface kinds),
`inline-font-size`, `hidden-inline-style`, `theme-allow-unscoped`.

Two new oxlint rules, both `warn`: **`basalt/shadow-basalt-export`** (a local component whose name
collides with a live basalt export, read from the real `dist/index.d.ts` barrel — the cheapest
detector for a forked composite, which no palette guard can see) and **`basalt/hand-rolled-shell`**.
`basalt/raw-size-literal` promoted `warn` → `error`; `hand-rolled-plot` and `chart-legend-literal`
were deliberately NOT promoted, because this minor widens both and promoting a widened rule in the
minor that widens it is exactly what the grace doctrine forbids.

`check-theme` resolves `.html` / `.webmanifest` / `.json` as markup (colour kinds only). False
positives fixed: `jsx-a11y/prefer-tag-over-role` off (it made basalt's own `ChartFrame` a11y pattern
unwritable), `no-underscore-dangle` allows `__APP_VERSION__`, `raw-color-fn` skips a computed colour
function, `raw-font-family` accepts any `var(--…)`, `no-raw-font-size` requires a style context and
skips test files, `ai-sdk-major` is scoped to packages depending on basalt or under declared roots.

**Known limit, deliberate:** a DOM-drawn chart is structurally invisible to `hand-rolled-plot`,
which keys on the visx assembly primitives. Every alternative detector tried flagged either basalt's
own `Donut`/`Heatmap` or an icon in a card header, and a noisy shipped rule gets switched off.

### Grace tracking

**`PLUGIN_RULE_GRACE`** is the plugin's counterpart to `GRACE_PERIOD_KINDS` — a named export beside
the plugin (`oxlint.json` cannot hold it; its top-level keys are fixed by oxlint's parser), with a
test asserting both directions against the shipped preset, so deleting an entry forces the level
flip in the same commit. Read promotion state there. Its absence is why three rules sat at `warn`
for up to twelve minors with nothing tracking them.

### CLI

- **`doctor`: `SKIPPED` is a third outcome** beside pass/warn/fail and exits non-zero on its own.
  "All checks passed" is only printable when every check RAN. New hard checks: `basalt-resolves`,
  `guard-scan` (check-theme would cover more than zero files — check-theme already exited 1 on that,
  and doctor disagreeing with it in the same repo WAS the bug), `oxlint-preset` (JSONC parsed, not
  rejected; one repo ran five minors with the whole lint half off).
- **A tokens-only profile.** `doctor` auto-detects it; **`check-theme` requires it declared**
  (`basalt.profile: "tokens-only"` or `--tokens-only`). The asymmetry is a safety property:
  doctor's profile only changes which ADVICE it prints, while check-theme's silences 17 kinds, and
  inferring that from a missing `@mantine/core` would switch off half the guard on any repo keeping
  Mantine in a different workspace package.
- **`init`** writes real `basalt.roots`, adds a `lint:basalt` script, names every kept file AND what
  keeping it costs, and prints the lint-debt notice — adopting the preset on an existing app turns
  on whole oxlint plugins the repo was never linted against. `--merge-lint` splices the preset into
  an existing `.oxlintrc.json`, refusing on a commented config rather than deleting the comments.
- **Markup scan reach:** each root's PARENT contributes its `index.html` and `public/` tree (the
  Vite layout `basaltViteConfig` assumes) — argo's raw hex lived one level up from its configured
  root. `.json` is never blanket-scanned; `basalt.include` is the only route to one.
- **`tokens:css` / `fonts:css` output is commit-clean** — the `@generated basalt-ui` marker on line
  1, version + invocation on line 2, normalized `rgba()` spacing, a `--check` drift gate. Against
  that header `check-theme` skips LINES, not files, and depth-aware: the whole-file marker it
  replaced was a hand-writable guard bypass, and so was the body test after it. Skipping is what
  fixed rollhook's 116 violations _inside the file `tokens:css` itself wrote_. Mechanics in
  `packages/basalt-ui/CLAUDE.md`.
- **`__APP_VERSION__`** ships its ambient declaration via `src/register.ts`, re-exported by the root
  barrel — a subpath-only consumer does not get it, which is the same set as the consumers not on
  basalt's Vite preset anyway.

### Mobile nav

Two defects in `.tabIcon`, the rule that IS the active pill. Its `12px` inset sat behind a bare
`theme-allow` claiming the value was sub-scale, so the bar and glyph scaled with density and the
inset alone did not (12px held across density −3/0/+3 while the glyph went 17 → 24 → 31); and the
pill is the icon span's own background, which had no minimum box, so an app shipping no icon
dependency got a ~24×4px dash at every density. Two new tokens
(`--vx-space-mobile-nav-tab-inset-{y,x}`), the span floors at the icon box plus its inset, and
`tests/layout` gained both invariants, verified to fail on the pre-fix CSS. Token counts move with
them: 202 canonical names, the `--vx-space-*` half 108, `only: 'core'` unchanged at 103.

## Adoption gap — closed in 1.7.0 (2026-08-02)

Prompted by the first outside-of-argo consumer (LineWatch). Its dashboard had grown seven
hand-rolled `<Card withBorder radius="md" padding="lg">` across six files, next to `StatCard`s —
two card idioms, visibly different borders/shadows/heights on one screen. Running `check-theme`
there for the first time reported all of it in one pass. Three separate causes, all now addressed:

1. **basalt was installed as a component library and nothing else.** No `.oxlintrc.json`, no
   `.basalt/manifest.json`, no lint script, no CI — `basalt-ui init` had never been run, so every
   enforcement mechanism the package ships was inert and nothing said so. `basaltViteConfig` now
   prints a one-time notice when no `.basalt/manifest.json` is found at or above the cwd. It is the
   only basalt seam that runs on every dev start and every build, which makes it the only place that
   can catch this while it is still cheap. Notice, never an error (`enforcementNotice: false` opts
   out) — declining the toolchain is a legitimate choice; failing a build over a missing lint preset
   would be a worse bug than the one it prevents.
2. **Two real holes in the guard.** `size="10px"` passed because `basalt/no-raw-font-size` only
   ever tested for a NUMERIC literal → new `basalt/raw-size-literal` oxlint rule (CSS-length strings
   on `size`/`fz`/`fontSize`; `warn` in the shipped preset for its grace minor). `c="yellow.7"`
   passed because no kind covered a shade-pinned Mantine color — `off-identity-accent` polices which
   hue, not which index → new `mantine-shade-index` guard kind (`warn` from 1.7.0, **promoted to
   `error` in 1.11.0**). Its grace ran across four minors rather than the doctrinal one — deferred by
   1.8.0 (shipped the same day as 1.7.0), by 1.9.0 (which carried the chart-layer batch the same
   consumer was waiting on), and then 1.10.0 shipped without the promotion at all. Promoted only
   after verifying the consumer: argo's `check-theme` reports zero violations of any kind, so nothing
   that was passing now fails. `GRACE_PERIOD_KINDS` went empty again and stayed empty until the
   round-4 batch, which put five new kinds into it.
3. **An expressiveness failure, which no linter could have caught.** LineWatch wrote a 35-line
   `ThresholdRail` wrapper positioning a bar over a `StatCard`'s edge, with a docblock explaining
   that `StatCard.value` is typed `string` so the number could not be tinted, and that hand-rolling a
   card would fork the one component every stat was drawn with. That is a well-behaved consumer
   hitting a wall and inventing visual vocabulary anyway. `StatCard` now takes `tone="warn" | "bad"`
   and draws the rail itself (plus a `VisuallyHidden` label — colour alone never carries a verdict).
   The lesson generalizes: a composite that cannot express a common case gets routed around by
   compliant-looking code the guard has no way to recognize, so the gap is invisible until someone
   looks at a screenshot.

   **Follow-up in 1.8.0 — the tone set is three-valued.** The same consumer hit the same wall one
   step further in: a Downtime card where **zero is the earned state**, which the two-tone set could
   only render as red (wrong) or untinted (indistinguishable from "nothing measured"). `tone` now
   takes `"good"` as well. `undefined` is unchanged and still load-bearing — it means "fine, or
   nothing measured" and stays untinted, so `good` is a positive assertion a consumer opts into, not
   a default a card without a reading can fall into. Second data point for the same lesson: the gap
   a shipped composite leaves is found by the consumer, one case at a time, not by the framework.

## Chart-layer rebuild — one mandatory cartesian primitive, shipped 1.15.0 (2026-08-18)

Design + rationale: **`docs/CHARTS-SPEC.md`** (ground truth). Prompted by a field report from the
one consumer building charts daily: tooltips, legends and responsive sizing all needed pushing
around per chart, and nothing felt strictly wired. Diagnosis was not visx — it was that basalt's own
layer had two tiers with no rung between them, so anything that wasn't a shipped kind fell to ~130
lines of hand-rolled margin math, scales, axes, overlay and tooltip assembly, and every cartesian
kind repeated that same preamble internally.

TanStack Charts (v0.14.0, released the same month) was evaluated as a replacement and **rejected**:
it is pre-alpha, its own README says not production-ready, and there is no 1.0 date. Its
architecture is the better one — grammar of graphics, framework-neutral scene, renderer-neutral
contracts — and the four ideas worth stealing were stolen instead: measured guides, a cursor
controller separate from crosshair presentation, one responsive path, and tooltips/legends/axes as
first-class parts of the chart definition rather than per-call-site assembly. Revisit the library
itself if it reaches 1.0.

What shipped:

1. **`CartesianChart`** — the missing rung. Owns measured margins, both y scales + their domains,
   the x scale and tick thinning, grid, zones, axes, the shared cursor, the crosshair and its
   per-series dots, the hover/keyboard overlay, and the derived tooltip. A kind (or a bespoke
   chart) supplies `series` + a child that draws ONLY marks. Every single-plot cartesian kind was
   rewritten onto it, and the two bespoke playground charts collapsed with it (the dual-axis one
   from ~145 lines to 29). `DualPanel` (two panes, one x scale) and the non-cartesian
   `Heatmap`/`Donut` stay hand-composed on `ChartFrame` + `useChartCursor` + `autoMargin` — they
   share the machinery, not the single-plot assembly.
2. **Margins are measured, not tokenized.** `autoMargin` sizes each gutter from the formatted tick
   labels that will actually be painted (`measureText`, offscreen canvas, memoized, SSR fallback).
   `VX.margin` becomes a FLOOR — no chart gets tighter than before, and a wide label widens its own
   gutter instead of clipping. `chartMargin({ rightAxis })` is no longer needed: passing `y2` is
   what makes a chart dual-axis, and the right gutter follows from measurement.
3. **The cursor is shared by default.** It moved from a React context that had to be mounted to a
   module-level external store read through `useSyncExternalStore`. `ChartHoverSync` is deleted;
   `ChartCursorScope` now ISOLATES a subtree instead. Resolution is domain-aware (exact match, else
   nearest parsed date/number within one domain step), which retires the `resolveKey` escape hatch
   and the folded-domain desync recorded in the chart-layer batch (`docs/archive/STATUS-HISTORY.md`).
4. **Legends toggle.** Clicking an entry hides that series from the plot, the tooltip and the auto
   domain together (on by default at ≥2 entries; `legend={{ toggle: false }}` opts out).
5. **Tooltip and keyboard.** `ChartTooltipFloat` does portal + flip + viewport clamp +
   measure-before-show once for every chart; pointer moves are rAF-coalesced. The hover overlay is
   focusable and scrubs on ←/→, Escape clears.

**The contract is mechanically enforced, not advisory.** Two oxlint plugin rules ship with it:
`basalt/hand-rolled-plot` fails a file that renders a chart-assembly primitive (`AxisLeftNumeric`/
`AxisRightNumeric`/`AxisBottomDate`/`HoverOverlay`/`Crosshair`) without composing `CartesianChart`
— a `theme-allow` comment on the first site is how a genuinely non-single-plot shape declares
itself, and `DualPanel` carries the only one in the repo; `basalt/chart-legend-literal` fails a
hand-written `ChartLegend items={[…]}` array, since the legend must derive from the same `series`
the chart draws or it goes stale naming a series nobody plots. Both are `error` repo-local and
`warn` in the shipped consumer preset, nominally for one minor per the grace-minor doctrine.

Both sat at `warn` for four minors with nothing tracking them, as did `basalt/raw-size-literal`
from 1.7.0 — twelve minors. That was the same promotion drift the 1.7.0 section above diagnoses for
`mantine-shade-index`, made worse because `GRACE_PERIOD_KINDS` governs `GuardKind`s only, so there
was no map to empty and nothing to remind anyone. **1.20.0's `PLUGIN_RULE_GRACE` is that map**
(`configs/oxlint-plugin.js`), asserted against the shipped preset in both directions by a test —
read the current level and its promotion note there rather than from a list in a doc, which is what
drifted. `raw-size-literal` promoted to `error` in 1.20.0; these two stayed `warn` because 1.20.0
widens both. Everything else the rebuild removed is enforced harder than lint: the old APIs are
gone, so the old patterns do not resolve.

Deleted outright (greenfield, one lockstep consumer, no shims): `ResponsiveChart`, `ChartHoverSync`,
`HoverContext`, `useHoverSync`, `useChartTooltip`, the tip-based `ChartTooltip` + `useTooltipStyles`,
`BarsAxisConfig`, `ZonedLineTooltipLabel`, and the whole `yDomain`/`yAutoMaxFloor`/`yAutoMinCeil`/
`yAutoPad`/`numTicksY`/`formatYTick` prop family on every kind (now one `AxisConfig` object per
axis). `Heatmap` measures itself via `ChartFrame` and takes `height`/`aspectRatio`/`fill` like every
other kind. Ships as a plain `feat:` on the 1.x line — majors stay banned.

Two regressions were caught during migration and fixed in the primitive rather than worked around
per kind: a stacked band's crosshair dot sat at its raw value instead of the cumulative band top
(now the `cursorValue` seam), and an `AxisConfig.domain` function could not see which series the
legend had hidden, so a stacked domain never shrank (the function now receives `visible`).

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
  or renamed and what replaces it), `README.md`, `llms.txt`, `AGENTS.md`, `agent/rules/*`.
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
