# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-08-22**. Per-release narratives older
> than 1.19 moved to `docs/archive/STATUS-HISTORY.md`; the rest of `docs/archive/` is superseded
> scope ledgers. This file is what's true now.

**Version:** **1.19.1**, published to npm (Trusted Publisher OIDC) and the `latest` tag. `master`
carries it; there is no unmerged feature branch.

## TL;DR

Everything below this line is shipped and on npm. Nothing in this document is a plan.

| Capability                                                                                             | Shipped                        |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 1.0 Mantine pivot, 1.x line live                                                                       | 1.0.0                          |
| Theme config closed — all four `createBasaltTheme` dimensions (`derive`, `fonts`, `radius`, `density`) | 1.2.0                          |
| Framework-free tokens — `basalt-ui tokens:css`, `basalt-ui/tokens.css`, `only: 'core'`                 | 1.3.0 (kebab-case names 1.5.0) |
| `mantine-shade-index` promoted to `error`                                                              | 1.11.0                         |
| Chart-layer rebuild — `CartesianChart` as the one mandatory primitive                                  | 1.15.0                         |
| Chart-API consumer rounds one / two / three                                                            | 1.16.0 / 1.17.0 / 1.18.0       |
| Native mobile nav + `defineNav`                                                                        | 1.19.0                         |

Adopted downstream: seven consumer repos, all on 1.19.1 as of the round-4 sweep. `rollhook` runs
the framework-free route with no Mantine and no React (`docs/FRAMEWORK-FREE.md`);
`basalt-ui-obsidian` is a downstream _library_, not an app.

The June-era roadmap/handover docs in `docs/archive/` still phrase built work as "remaining"; that
language is historical, see the banner on each.

## Round 4 consumer sweep (2026-08-22)

Seven repos upgraded and reported back. Every app consumer finished at `check-theme` 0 / typecheck
pass / build pass — the gates are green, and all three findings sit outside them. Full reports:
`.claude/feedback/round-4/`.

1. **The escape hatch is broken.** `theme-allow` is line-scoped and the two engines disagree about
   which line: the oxlint plugin honours the flagged node's line _or the one above it_,
   `checkTheme`'s `isSkippedLine` only the reported line — so the same comment works in a `.ts` file
   and silently does nothing in JSX. It also takes a bare comment with no rule id and no reason, it
   grants a whole file permanent immunity on `hand-rolled-plot`, and the shipped `oxfmt` can reflow
   the line out from under it.
2. **The guard sees palette, not vocabulary.** Off-palette code fails; a forked component built from
   correct tokens passes. ~15 independent re-rolls of shipped components were all green —
   `StatCard` alone was re-rolled by 4 of 4 app consumers across ~10 sites.
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
  has no grace-tracking mechanism at all. That is the actual defect — see the chart-layer section.

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
   that was passing now fails. `GRACE_PERIOD_KINDS` is empty again.
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

**They are still `warn` at 1.19.1, four minors on** (`configs/oxlint.json`), and so is
`basalt/raw-size-literal`, whose grace minor started at 1.7.0 — twelve minors ago. This is the same
promotion drift the 1.7.0 section above diagnoses for `mantine-shade-index`, with one difference
that makes it worse: `GRACE_PERIOD_KINDS` is a `Partial<Record<GuardKind, string>>` and these are
oxlint plugin rules, not guard kinds, so there is no map to empty out and nothing to remind anyone.
**Treat the grace as indefinite until the severity map itself carries an expiry.** Promoting three
rule ids is a three-line diff in `configs/oxlint.json`; the reason it hasn't happened is that
nothing tracks it, not that a consumer would break — all seven consumers report zero violations of
all three. Everything else the rebuild removed is enforced
harder than lint: the old APIs are gone, so the old patterns do not resolve.

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

**Still open after that migration:**

- **A class selector.** The emitter keys on an attribute; Tailwind's convention is
  `<html class="dark">`. Both rollhook apps only worked via `--default-scheme dark`, which costs
  them the light scheme. `--selector-class` is in flight.
- **Fonts are unreachable.** `tokens.css` emits no `--basalt-font-*`, the defaults live only in the
  Mantine-coupled `styles.css`, and `buildFontsCss(fonts)` returns `''` without overrides — so it
  cannot re-emit the shipped stack. `fonts:css` is in flight.
- **No tokens-only profile for `check-theme` / `doctor`.** `check-theme` flags ~100 `raw-hex` in
  the file `tokens:css` just wrote, `raw-form-control` tells a Mantine-free app to import
  `@mantine/core`, and `doctor` exits 1 telling a tokens-only consumer to run `basalt-ui init`.
- **The emitted stylesheet is not commit-clean.** No trailing newline, no version header,
  `rgba(255,255,255,0.6)` rather than formatted spacing, no `--check` drift mode.

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
