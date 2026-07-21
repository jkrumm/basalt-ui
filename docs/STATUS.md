# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-07-16**. The other docs in `docs/`
> are historical process artifacts or superseded scope ledgers — this file is what's true now.

**Branch:** `feat/s0-mantine-pivot` (PR-required, unmerged, pushed to
`origin/feat/s0-mantine-pivot` on 2026-06-11; many maturation commits have landed since — see
`git log`).
**Version:** `1.0.0` in `package.json`, **unpublished** (last npm tag: `v0.4.2`).

## TL;DR

The 1.0 Mantine pivot is **functionally complete**. No feature work remains for the 1.0 cut
line. What's left is the owner-gated **ship sequence** (push → PR → npm Trusted Publisher →
review → release). The June-era roadmap/handover docs still phrase built work as "remaining" —
that language is historical; see the banner on each.

## Built (verified as-built, 2026-07-07)

- **Spine** — `surfaces.ts` (the SSOT registry), `register.ts` (`BasaltRegister`/`Slot`/`SeriesKey`/
  `AsyncState`), `state.ts` (`createPersistedState`), `guard/` (incl. the `basalt guard-hook`
  PreToolUse adapter; `GUARD_RULES` drives `checkSource`), provider freeze (`BasaltErrorBoundary` +
  `onError` + CSP nonce).
- **Seven batteries** ship as runtime subpaths: `./query`, `./router-tanstack`, `./agent`,
  `./commands`, `./forms`, `./notifications`, `./data` (split into `./data/table` +
  `./data/virtual`) — plus `./guard`, `./state`, `./connectivity`, `./llms.txt`. All 19 subpaths
  (incl. `./connectivity` and `./content`) resolve in the pack-test.
- **Charts / tokens** — config-driven chart system (legend/tooltip/crosshair), `ResponsiveChart` +
  `useChartSize`, the semantic-tier `--vx-*` token keystone, the modern-zinc palette (see
  `docs/DESIGN-SPEC.md`), motion discipline (oxlint + `check-theme` enforced).
- **Design overhaul (2026-07-11)** — the shell, charts, components (`data-table`, notifications
  bell/center), and agent-chat surfaces were restyled to `docs/DESIGN-SPEC.md`: cool zinc surfaces,
  a single saturated sky accent, split by role (ink `#0077bd`/`#8ec5ff`; fill `#0077bd` both schemes, white label), `shadow-card` depth (whisper shadow + ring,
  no plain hairline), 7px card radius (6px controls, after the 2026-07-15 density pass), and the
  three-font system (Nunito Sans / Hubot Sans /
  JetBrains Mono, shipped via exact-pinned `@fontsource-variable/*` deps). `DESIGN-SPEC.md` is the
  ground truth for all visual doctrine going forward; older doctrine comments describing warm-neutral
  zinc-charcoal, a muted slate-blue accent, flat/no-shadow cards, or 8px radii are superseded — see
  its "Doctrine inversions" section.
- **Enforcement** — `SURFACES` projects `gen-oxlint` + `gen-llms`; `check-coverage` (8 assertions);
  Mantine-free boundary enforced on headless surfaces; `@visx/*`-only-in-`charts` boundary.
- **Release gates** (`scripts/pack-test.sh`) — `publint --strict` + `attw` (esm-only) +
  `check-dist-layering.mjs` (7 Mantine-free subpaths + root-barrel) + 19-subpath resolution +
  tarball parity (every CLI-read source ships) + export-surface snapshot (named-export completeness).
- **CLI** — `init` · `sync` (+ `--check` drift gate) · `check-theme` · `check-coverage` · `info`
  (+ `--json`) · `doctor` (+ a 4th, warn-only check for `basaltAppPlugin`'s icon files under
  `public/`) · `guard-hook`.
- **App bootstrap** (`./vite`) — `basaltAppPlugin` joins `basaltViteConfig`: dual `theme-color` +
  anti-FOUC background derived from `SURFACE.bg`, bring-your-own icon links, `site.webmanifest`
  (served in dev too), site-wide OG/Twitter defaults, and an opt-in `serviceWorker` that lazily
  composes the optional peer `vite-plugin-pwa` and degrades to a warning when it's absent. New
  `agent/rules/basalt-app.md` covers vite-config composition and plugin ordering.
- **Agent-DX** — `llms.txt`, `AGENTS.md`, `basalt-ui info --json`, `basalt-ui doctor`; rules +
  skills + CLAUDE block placed by `basalt-ui init`/`sync` (plugin/marketplace retired in 1.0.1).
- **Resolved owner decisions** — `@visx/*` bumped alpha.11 → **4.0.0 stable** (+ `@visx/responsive`);
  `@tanstack/react-hotkeys@0.10.0` optional peer (live keybinding) shipped; `createForm` →
  `useBasaltForm` rename.
- **Maturation review executed** (see `docs/archive/MATURATION-REVIEW.md`) — the `./data` split (`./data/table`
  - `./data/virtual`), `./connectivity` registered in `SURFACES`, an accessibility wave (keyboard-
    operable chart legend, `DataTable` sort, mobile-nav `aria-current`, streaming `aria-live`), agent
    `retry(threadId)` + orphaned-in-flight-thread reconcile, and a documentation cleanup (10 planning
    docs archived to `docs/archive/`, 7 marketing orphans deleted).
- **Sidebar account** — `SidebarAccount` (a presentational footer row) + a provider-agnostic
  account contract (`BasaltAccountProps`/`State`/`Actions`) threaded optionally through
  `AppSidebar`/`BasaltShell`'s `account` prop. No better-auth dependency, no `./auth` subpath — the
  Better-Auth mapping recipe ships as JSDoc only.
- **Content surface** (`./content`, `docs/CONTENT-SPEC.md`) — complete: `Prose`/`CodeBlock`/
  `Callout`/`TableOfContents`/`ReadingProgress`/`Markdown`/`MermaidDiagram`/`mdxComponents` (stages
  1+2) plus the docs-framing layer (stage 3) — `ArticleLayout` (meta header + sticky TOC rail +
  prev/next footer), `ArticleCard`/`ArticleGrid` (overview cards), `GuideLink`/`GuideDrawer`
  (contextual help drawer), and the content-collections + TanStack Start recipe in
  `agent/rules/basalt-content.md`.

## Derive engine — "one accent in, calculated palette out" (stages 1-3, done)

The shipped palette is GENERATED, not hand-authored. `tokens/derive.ts` (a ported, calibration-
checked HCT derivation) computes the accent family, the 12 categorical fills, the surface stops,
the ink ramp, and the status solids from one seed hex + five bounded knobs; `tokens/palette.ts`
builds `ACCENT`/`FILL`/`SURFACE`/`INK`/the status hues from `deriveTokens(DEFAULT_DERIVE_CONFIG)`
once at module load (seed `#0077bd`, `neutral: 'zinc'`, all level knobs at 0; vibrancy centers on
`x0.72` chroma — one step above the original muted `x0.6` center). Shipped:

- **Generator** — `tokens/{derive,hct}.ts`: the HCT math (zero-dependency sRGB↔HCT + a 16-iteration
  gamut-mapping chroma search) and the derivation laws (the Y=0.165 fill-luminance band, the
  3.0:1 `onAccent` contrast floor, the vibrancy/brightness/surface-level knob mappings).
- **Generated palette** — `tokens/palette.ts` computes `ACCENT`/`FILL`/`SURFACE`/`INK`/status from
  the generator at the new baseline (e.g. `ACCENT.accentFill` = `#4374a6`, `SURFACE.bg` =
  `#f2f2f5`/`#27272a`) instead of hand-picked hexes; the chart-chrome opacity ramps
  (`NEUTRAL.axis`/`grid`/`tooltip*`) now key off the derived ink hex too, not a frozen pre-
  derivation approximation.
- **Consumer API** — `createBasaltTheme(overrides?, { derive: { accent, neutral, lightLevel,
darkLevel, vibrancy, accentBrightness } })`. Omitted knobs fall back to the shipped default per-
  knob; the default (or a `derive` that resolves back to it) stays on the pre-baked static
  `baseTheme` — zero extra derivation work.
- **`DeriveControls`** (`theme-lab`) — the DEV-tool live-tuning panel for the same six knobs,
  persisted to its own localStorage key, applied via a cascade-winning `<style>` tag. Not the
  production path — that's `createBasaltTheme`'s `derive` option.
- **Non-color dimensions (step 2)** — the same options object (never a second config surface)
  gained `fonts: { sans?, head?, mono? }` (pure pass-through to the `--basalt-font-*` vars,
  enforced by the new `raw-font-family` guard kind) and `radius` (integer −5..+5; law: card =
  7 + level, ctrl = 6 + level, clamped ≥ 0, offset tiers + anchored Mantine scale stops follow —
  `deriveRadius(level)`, level 0 byte-identical to the pre-knob values, locked by
  `theme/radius.test.ts`). Every theme/component/CSS-module radius literal was tokenized onto
  `--vx-radius-{card,ctrl,tight,fine,floating}` first (no-visual-change refactor), then the knob
  landed; `basalt.rawRadius` guard is ON. `legendText`'s light value now derives from the ink hex
  like the sibling chart-chrome ramps. `DeriveControls` gained a Radius slider (persisted-state
  v2).
- **Density dimension (step 3)** — a fourth, non-color dimension joins the options object:
  `createBasaltTheme(overrides?, { derive, fonts, radius, density })`. `density` is an integer
  −3..+3 (level 0 = today's values, byte-identical, with ONE deliberate exception — see below) —
  narrower than `radius`'s −5..+5 on purpose: it retunes every spacing token together via
  `deriveSpacing(level)`, a multiplier law (`1 + 0.1 * level`, rounded, floored at 1) for
  anchors/scale-stops/one-offs, plus an independent, gentler additive law — its OWN hand-picked
  coefficient (`ROW_LINE_HEIGHT_STEP`), not derived from the multiplier's own coefficient, which a
  prior version of this law incorrectly claimed — for the NavLink row line-height, which would
  overshoot the readable range under the multiplier. The ±3/0.1 range reproduces the exact same
  `0.7..1.30` multiplier envelope as an earlier ±5/0.06 shape at fewer, more meaningful notches — the
  wider range left 41-43 of the 108 spacing values byte-identical to level 0 at one notch of movement
  (uniform over-quantization, not a single dead zone), which the narrower range corrects; see
  `deriveSpacing`'s JSDoc (`tokens/palette.ts`) and the "Fix 7" relation tests in
  `theme/density-relations.test.ts`. Landed in
  two prep commits first (no-visual-change refactors, byte-identical, locked by
  `theme/spacing.test.ts`): `tokens/palette.ts` gained `SPACE` (semantic anchors — the `6px 10px`
  row inset, the 4px vertical rhythm, input height), `SPACE_SCALE` (the Mantine `xs`/`sm`/`md`/
  `lg`/`xl` spacing scale, kept independent of `SPACE` even where a level-0 number coincides — an
  anchor is one component's inset, a scale stop is the app-wide generic rhythm), `SPACE_STEP`
  (named one-offs, including six chart-chrome constants — legend gap, the four plot-area margins,
  dot radius — that track density; stroke weights don't), and `SPACE_FIXED` (density-EXEMPT
  structurals — hairlines, the reading-progress bar height — deliberately never emitted as a
  `--vx-*` var). A CSS-module sweep then routed 114 hardcoded spacing declarations across 15 files
  (prose and the app sidebar accounting for nearly half) onto `--vx-space-*`, one named token per
  site, byte-identical. `DeriveControls` gained a Density slider (persisted-state v4 — bumped from
  v3 when `deriveSpacing`'s accepted range narrowed to `[-3, 3]`, so a stale out-of-range `density`
  from an earlier session falls back to the default state instead of reaching `deriveSpacing` and
  throwing at render). **The one level-0 exception**: `SPACE_STEP.stickyHeaderClearance` is
  RESPONSIVE, not a single value — a desktop (`>= sm`) value (`appShellHeaderHeight + stackMd`, 60
  at level 0) and a mobile (`< sm`) `stickyHeaderClearanceMobile` sibling
  (`appShellHeaderMobileHeight + stackMd`, 108 at level 0), each clearing only its own AppShell
  header instead of one value tuned against either the wrong header or an over-cleared common
  (desktop) path — see `deriveSpacing`'s JSDoc (third bullet) and `docs/CONTENT-SPEC.md` §5 for the
  full rationale and the `./content` ↔ `BasaltShell` coupling this creates.
- **Theme-lab prune** — `COLOR_GROUPS` used to expose a swatch for every derived color, which is
  dead weight now the palette is generated: hand-tuning a hex the derive engine owns and
  regenerates on the next config change. Classified against `buildPaletteData` rather than by group
  name: Accent/Fills/Ink/Semantic (wholly derived) were dropped; Status/Neutral/Surface keep only
  their hand-authored members (status `excellent`/`neutral`, `line`/`line2`/`dotStroke`, surface
  `overlay`). `COLOR_GROUPS` is now a six-token structural inspector, not an identity tuner —
  identity/color tuning lives in `DeriveControls` alone. Export surface unchanged (same name, same
  subpath); the playground's Theme-lab panel copy was updated to match.
- **Enforcement** — `basalt-ui check-theme` wired into the repo's own `bun run pre` (root
  `package.json`) and into `lefthook.yml`'s staged pre-commit (`packages/basalt-ui/src/**` glob);
  `tokens/derive.ts` + `tokens/hct.ts` are in the package's `basalt.exempt` list (they ARE the
  generator/calibrated-constant source, alongside `palette.ts`/`theme/index.ts`) so the `raw-hex`
  guard rule doesn't fire on their calibrated literals.

**Known limitations:**

- `accentHover`'s dark-mode hue drifts from the legacy hand-tuned value by ΔE≈5.9 (perceptible but
  minor) — a calibration gap, not a regression, tracked for a future re-tune.
- A handful of structural tokens stay non-derived by design: `SHADOW.*`, `SURFACE.overlay`/
  `divider`, the raw `BP` hue ramps, and `STATUS.excellent`/`neutral`.
- Mantine's `theme.colors.dark` tuple is generator-derived (`buildDarkTuple`, `theme/index.ts`) for
  every config, including the shipped default — the previous pinned `basaltDark` literal (hand-
  tuned, pre-derive-engine) is gone; a small visible dark-mode shift is expected and accepted.
- The accent fill's page-contrast floor (3.0:1 against BOTH derived page backgrounds) is now a
  clamped law: `derive.ts`'s `clampFillTone` steps the `accentBrightness`-shifted fill tone back
  toward the band centre until it clears the floor on both schemes, so the knob saturates rather
  than violating 3.0:1 at the extremes.
- `stone`/`slate`/`neutral` are spec'd `NEUTRAL_PRESETS` entries (hue/chroma pairs) but have no
  calibration data behind them — only `zinc` is calibrated against the framework's original
  hand-tuned identity.
- `DeriveControls`'s dev-tool `<style>` override can only move CSS vars, so numeric Mantine
  `defaultProps` baked into the theme object (Timeline's `bulletSize`, Progress's `size`) — and
  `theme.spacing` itself, the generic Mantine `xs`/`sm`/`md`/`lg`/`xl` scale, baked in the same
  way — don't follow the Radius/Density sliders; production `createBasaltTheme({ radius, density
  })` rebuilds all of those numbers correctly from the same law.
- Chart constants (`VX.legendGap`/`margin`/`dotR`) are single-sourced off `SPACE_STEP`'s
  `chartLegendGap`/`chartMargin*`/`chartDotR` keys, but — unlike every other density-tracking
  one-off — deliberately have NO `--vx-space-*` CSS var (visx SVG props read plain JS numbers, not
  `var()` strings, so a declaration would have zero consumers). `VX` is built ONCE at module load
  from the frozen level-0 `SPACE_STEP` snapshot, so it never re-reads a `density` option at all —
  this is the one case that fails BOTH paths, including the PRODUCTION `createBasaltTheme({
  density })` one, not merely the dev slider (see `deriveSpacing`'s JSDoc, `tokens/palette.ts`, for
  the full accounting of what tracks density end to end and what doesn't).

## Open — the finish line (owner-gated, cannot be closed from source)

1. **Push** the outstanding commits to `origin/feat/s0-mantine-pivot` (pushed to `origin` on
   2026-06-11; many maturation commits have landed since — see `git log`).
2. **Open the PR** (basalt-ui is PR-required).
3. **npm Trusted Publisher** — `publish.yml` is already OIDC-ready (`id-token: write`); configure
   `jkrumm/basalt-ui` → `publish.yml` on the npm side, then **delete the `NPM_TOKEN` GitHub
   secret**. Without this the OIDC publish 403s.
4. **`/code-review ultra`** at the finish line (billed).
5. **Merge**, then trigger the release workflow (semantic-release-monorepo, npm provenance).
   `release.yml` is `workflow_dispatch`-only — merging to `master` does NOT auto-release.

## Validation

Last verified green **2026-07-16**, on the release-hardening wave following `aa64af6` — `bun test`:
560 pass / 22 files. Also green on that tree: `bun run pre` (fmt/lint/typecheck), build,
`check-coverage`, and pack-test (19 subpaths, now including the scratch-consumer oxlint-preset
`extends` contract). **A final re-verification (`bun run pre` + `bun test` + pack-test) runs before
ship** if further commits land.

## Deferred by design — do NOT build for 1.0

Intentional cut-line calls, not gaps:

- **tsdown migration** — NO-GO for 1.0 (swapping the tsc declaration emitter on a type-spine
  package; owner may override).
- **Phase-5 kill-list** — bottom-sheet, runtime hooks, canvas-line-kind, appshell-aside-slot,
  `create-basalt-app`, dtcg-interchange, `@mantine/dropzone`, full `<Chat>`/voice. Advisory-only.
  (The PWA vite helper on this list shipped — see `basaltAppPlugin` in the "Built" section above.)
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
  see its "Doctrine inversions" section), `DESIGN-CORE.md`, `MANTINE-THEMING.md`.
- **`docs/archive/`** — superseded scope ledgers and historical process artifacts, kept for
  provenance only:
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
