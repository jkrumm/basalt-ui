# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-08-22**. Per-release narratives older
> than 1.19 moved to `docs/archive/STATUS-HISTORY.md`; the rest of `docs/archive/` is superseded
> scope ledgers. This file is what's true now.

**Version:** **1.20.0** is the published npm `latest` (Trusted Publisher OIDC), released 2026-08-22 —
the round-4 guard and CLI batch below, plus two mobile-nav fixes. All seven consumers are on it.
`master` carries the round-5 corrections toward **1.20.1**; there is no unmerged feature branch.

_This version line is the one line a release must touch and semantic-release does not touch it._
Round 5 read it on release day and concluded there was nothing to upgrade to.

## TL;DR

Everything below this line is built and on npm. Nothing in this document is a plan.

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

Adopted downstream: seven consumer repos, all on 1.20.0 as of the round-5 sweep. `rollhook` runs
the framework-free route with no Mantine and no React (`docs/FRAMEWORK-FREE.md`);
`basalt-ui-obsidian` is a downstream _library_, not an app.

The June-era roadmap/handover docs in `docs/archive/` still phrase built work as "remaining"; that
language is historical, see the banner on each.

## Round-5 consumer sweep (2026-08-22)

Seven repos upgraded to 1.20.0 and reported back. The release does what it claimed — `basalt-resolves`,
the per-line generated-file skip, `--tokens-only`, the markup scan and the preceding-line
`theme-allow` all verified in the field. What round 5 found instead was **documentation making
false load-bearing claims**, which is the failure `MIGRATING.md` exists to prevent. Full reports:
`.claude/feedback/round-5/`.

1. **`theme-allow` per-node scoping is half-delivered, and the doc claimed it whole.**
   `hand-rolled-plot` reports per node, but a waiver naming the rule AND giving a reason matches
   `hasFileDeclaration` at any line, so it silences the file; dropping the reason keeps it
   node-scoped in the plugin and then `check-theme` reports `theme-allow-unscoped`. The two halves
   intersect at one legal shape and it is whole-file. **Not fixed** — a sibling change targets 1.20.1.
   `MIGRATING.md` now describes 1.20.0's real behaviour.
2. **Four wrong rows in `MIGRATING.md`**, found by re-auditing every replacement against the built
   `.d.ts` rather than the commit it came from. The one a consumer caught: `ZonedLine`/`MultiLine`
   `formatValue` was mapped to `tooltip`, with "**not** `y`" — backwards; `CartesianTooltipConfig`
   carries no value formatter and the format resolves from `y.format`. rb got it right by reading
   the types and would have got it wrong by trusting the doc.
3. **A correction that lands only in a repo-internal file has not shipped.** The
   `createSearchParamStore` scoping was correct in this repo's `CLAUDE.md` and absent from
   `agent/rules/*`, which is what `init`/`sync` copy into consumers. It now lives in
   `basalt-router.md`. Same class: the managed `CLAUDE.md` block told agents to read
   `node_modules/basalt-ui/llms.txt` — the exact path 1.20.0 taught `doctor` to reject in a monorepo.
4. **`basalt/shadow-basalt-export` misses the renamed majority.** It reads only the root barrel (so
   never the charts layer) and matches only exact names — linewatch's forks are `Cell` and `Box`,
   rb's is `Stat`. **Detection does not substitute for expressiveness**; the shipped rules now say so.
5. **`fonts:css` is correct and was not adopted by the consumer it was built for.** rollhook reported
   having no route to basalt's typefaces; 1.20.0 shipped one; adopting it would rebrand a public
   marketing site with a display face rollhook never had (0.4.2 was Instrument Sans, 1.x is Nunito
   Sans + Hubot Sans — the faces changed at 1.0). A feature can be correct and still not be the fix
   for the consumer that motivated it.

Open, not fixed here: the emitted stylesheet still fails `format/prettier` on two `rgba(…, 0.10)`
alphas; `exemptRules` matches single path segments, so a real relative path silently matches nothing
— the only waiver route for the JSON/webmanifest file class 1.20.0 started scanning; `doctor`'s
`oxlint-preset` check string-matches the `extends` entry with no `existsSync`, so it prints green in
a tree where `oxlint` refuses to start.

## Round 4 consumer sweep (2026-08-22)

Seven repos upgraded and reported back. Every app consumer finished at `check-theme` 0 / typecheck
pass / build pass — the gates are green, and all three findings sit outside them. Full reports:
`.claude/feedback/round-4/`.

1. **The escape hatch was broken** — `theme-allow` line-scoped, the two engines disagreeing about
   which line, a bare comment accountable to nobody, whole-file immunity on `hand-rolled-plot`, and
   `oxfmt` able to reflow the line out from under it. **Answered in 1.20.0** (see below).
2. **The guard sees palette, not vocabulary.** Off-palette code fails; a forked component built from
   correct tokens passes. ~15 independent re-rolls of shipped components were all green —
   `StatCard` alone was re-rolled by 4 of 4 app consumers across ~10 sites. **Partly answered**:
   `basalt/shadow-basalt-export` and `basalt/hand-rolled-shell` detect the two cheapest shapes. The
   expressiveness half — `StatCard`'s missing props, a query loading/error sibling to `EmptyState`,
   `createSearchSchemaStore`, `BandStrip`, `DualPanel` independent domains — is **not** built.
3. **There is no API-delta story.** `CHANGELOG.md` ships and is complete, but
   semantic-release's one-line-per-commit format never names a removed export. Two agents
   reconstructed the delta by reading `dist/**/*.d.ts`. Answered by
   `packages/basalt-ui/MIGRATING.md`.

**Corrected findings** — both reported and both wrong:

- _"No release notes for any minor."_ The published 1.19.1 tarball's `CHANGELOG.md` carries every
  release from 0.1.0 to 1.19.1. semantic-release writes minors as `#` (h1) and patches as `##`
  (h2); a grep for `## [x.y.z]` matches the 9 patches and none of the 23 minors.
- _"The chart rules are outside `GRACE_PERIOD_KINDS`."_ True but not meaningful.
  `GRACE_PERIOD_KINDS` only governs `GuardKind`s; `hand-rolled-plot`, `chart-legend-literal` and
  `raw-size-literal` are oxlint plugin rules whose severity lives in `configs/oxlint.json`, which
  had no grace-tracking mechanism at all. That was the actual defect, and 1.20.0's
  `PLUGIN_RULE_GRACE` is the fix.

**What 1.20.0 costs the consumers, measured — both consumer-side work for the next round, neither a
basalt bug:**

- The markup scan finds REAL raw hex today: argo 4 (`index.html` + `site.webmanifest`), linewatch 2
  (`index.html` `theme-color`). Both now fail `check-theme` at exit 1 — the scan working as built.
- rollhook's committed `basalt-tokens.css` was emitted by 1.19.1 and carries no header, so it keeps
  reporting 116 until the consumer re-runs `bun run tokens`. The 116 → 0 payoff requires that
  regeneration; it is not automatic on upgrade.

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
own — see the round-5 sweep above. Fix targets 1.20.1.

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
for up to twelve minors with nothing tracking them, and why this same drift has now been recorded
three separate times in this file.

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
- **`tokens:css` / `fonts:css` output is nearly commit-clean** (two `rgba(…, 0.10)` alphas still
  fail prettier — round 5): the `@generated basalt-ui` marker on line
  1, version + invocation on line 2, a trailing newline, normalized `rgba()` spacing, and a
  `--check` drift gate. `check-theme` skips LINES, not files: the file first has to earn it (a
  `.css` path, that header verbatim on lines 1 and 2), and then each line does too — at brace depth
  0 a selector or a self-closing comment, inside a block only a `--vx-*` / `--basalt-*` declaration
  whose value carries no `;`, a `}`, or a comment. The marker alone, anywhere in the first 5 lines
  of any extension, was a hand-writable whole-file guard bypass; the whole-file body test that
  replaced it was forgeable too (a `;` inside a custom-property value, a comment that never
  closed), which is why the exemption is per line and depth-aware now — a miss costs one line.
  Skipping is what fixed rollhook's 116 violations _inside the file `tokens:css` itself wrote_.
  `tokens:css --selector-class dark` emits the Tailwind `<html class="dark">` form (CLI-only; there
  is no `scheme: { class }` API). `fonts:css` emits the shipped `--basalt-font-*` stacks, read out
  of `styles.css` so the two can never name different typefaces.
- **`__APP_VERSION__`** ships its ambient declaration via `src/register.ts` → `dist/register.d.ts`,
  re-exported by the root barrel. A consumer importing from `basalt-ui` gets it with no
  `/// <reference>`; a subpath-only consumer does not, which is the same set as the consumers not on
  basalt's Vite preset anyway.

### Mobile nav

Two defects in `.tabIcon`, the rule that IS the active pill. Its inset sat behind a bare
`theme-allow` claiming the value was sub-scale; only the `2px` was, and the `12px` was the one
spacing value in the file with no token — so the bar and the glyph scaled with density and the
pill's inset alone did not (measured: 12px held across density −3/0/+3 while the glyph went
17 → 24 → 31). Two new tokens, `--vx-space-mobile-nav-tab-inset-{y,x}`. Separately the pill is the
icon span's own background and that span had no minimum box, so an app shipping no icon dependency
got a ~24×4px dash instead of an indicator, at every density; the span now floors at the icon box
plus its inset. `tests/layout` gained both invariants, verified to fail on the pre-fix CSS.

Token counts move with those two: 202 canonical names (was 200), the `--vx-space-*` half 108 (was
106), `only: 'core'` unchanged at 103 — both new tokens are component-named spacing, which the core
filter drops. `docs/FRAMEWORK-FREE.md` carries the corrected set.

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

**argo consumer-side migration is a separate repo task** (`~/SourceRoot/argo`) and is **not done**.
This refactor only extracted read-only _from_ argo _into_ basalt-ui. The BLUEPRINT S0–S5 argo plan
is superseded as basalt-ui's roadmap — do not execute it here.

**Update 2026-07-11:** the argo consumer migration referenced above has since run to completion,
end-to-end, against this branch (`file:`-linked, unpublished) — provider/theme/series foundation,
all chart features, the app shell, and the query/forms/notifications/commands batteries. Distilled
feedback from that run lives in `docs/ARGO-MIGRATION-LEARNINGS.md`; consult it before touching CLI
packaging, the charts/tokens API, the shell, or the batteries above.

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
  - Historical process artifacts (phase complete) — `ONE-ZERO-DRIVE-HANDOVER.md`,
    `EXECUTION-HANDOVER.md`, `PHASE-1-HANDOVER.md`, `PHASE-1-GROUNDING.md`, `PHASE-1-DESIGN.md`,
    `PHASE-1-IMPLEMENT-HANDOVER.md`.
- **Deleted** — 7 orphaned pre-pivot marketing/tooling docs (`BRAND_VOICE.md`,
  `brand_context.yaml`, `llm.md`, `prose/PROSE_TRANSITION.md`, `prose/tailwind_prose.md`,
  `prose/prose_styles.js`, `research/DARK_MODE_IMPLEMENTATION.md`) — zero references repo-wide,
  described dead Tailwind/Astro tooling that doesn't survive the marketing rebuild.
