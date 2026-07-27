# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-07-27**. The other docs in `docs/`
> are historical process artifacts or superseded scope ledgers — this file is what's true now.

**Branch:** `master` is the released 1.x line; `feat/density-tokens` (PR #23) carries the density
dimension and the guard wave below it.
**Version:** `1.1.1` on `master`, **published** to npm (tags through `v1.1.1`, Trusted Publisher
OIDC).

## TL;DR

The 1.0 Mantine pivot shipped and the 1.x line is live on npm. Current work is the theme-config
surface: `createBasaltTheme`'s four dimensions (`derive`, `fonts`, `radius`, `density`) — the first
three released, `density` in review on PR #23. The June-era roadmap/handover docs still phrase built
work as "remaining"; that language is historical, see the banner on each.

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
  persisted to its own localStorage key. Not the production path — that's `createBasaltTheme`'s
  `derive` option — but a faithful one: it applies a config through BOTH halves of the theme (a
  cascade-winning `<style>` tag for the `--vx-*` vars, plus a real rebuilt theme object; see
  "Honest theme lab" below).
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
- **Density dimension (step 3)** — a fourth theme dimension (the third non-color one) joins the
  options object:
  `createBasaltTheme(overrides?, { derive, fonts, radius, density })`. `density` is an integer
  −3..+3 (level 0 = today's values, byte-identical, with ONE deliberate exception — see below) —
  narrower than `radius`'s −5..+5 on purpose: it retunes every density-TRACKING spacing token
  together (the `SPACE_FIXED` structurals below are exempt by design) via
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
- **Guard dogfooding wave (rides with the density PR)** — the package now runs five guard kinds it
  previously exempted itself from: `raw-surface`, `raw-spacing`, `inline-spacing`, and the
  `inline-display`/`raw-html-layout` layout-primitive pair (two kinds, one category — they share an
  `exemptRules` opt-out below). No new rule kinds — these already
  shipped; what changed is that basalt-ui itself is now scanned by them, which surfaced and cleared
  the last raw literals in its own source. Two things fell out of it: **`exemptRules`**
  (`Partial<Record<GuardKind, string[]>>` on `GuardConfig`) — the missing seam between whole-file
  `exempt` (skips every rule) and hardcoded `appliesTo` (per-kind path scoping in the registry),
  applied as one post-filter so it covers the inline-handled kinds too, empty by default; and **15
  new tokens** — 14 `--vx-space-*` one-offs (agent rail/code/error/message/transcript insets, badge
  inset, stat-card gap, virtual-list row inset), each seeded into `SPACE_STEP_BASE` at its shipped
  px so level 0 is byte-identical and the value now tracks density instead of freezing, plus a fixed
  `--vx-radius-pill` (9999px, level-invariant). The headless layers (`agent/`, `charts/`) declare
  themselves exempt from the layout-primitive rules via `exemptRules` — their remedy points at a
  Mantine `<Flex>`/`<Center>` they cannot import under the Mantine-free contract. A handful of
  irreducible sites (sub-scale opticals below the token floor, a Badge `styles.label` part, two
  `motion.span` glyph wrappers) keep a documented `theme-allow`.
- **Honest theme lab (rides with the density PR)** — `DeriveControls` applied a config through an
  injected `<style>` tag alone, which can only reach CSS custom properties. The Radius/Density knobs
  also control plain numbers baked into the theme OBJECT by `buildTheme`: `theme.radius` and
  `theme.spacing` (the generic Mantine `xs`..`xl` scales — every `p="md"`/`gap="sm"` in an app) plus
  `defaultProps.radius` on Badge/SegmentedControl/Progress/Tooltip/Popover/Modal/Notification,
  `Progress.size` and `Timeline.bulletSize`. A `<style>` tag cannot reach a number inside a JS object,
  so the sliders moved the CSS-var surfaces (the CSS-module-heavy app sidebar most of all) and left
  plain Mantine layout at level 0 — the tool under-reported its own knobs UNEVENLY across surfaces,
  which is exactly the reading a retune is judged by, so any by-eye measurement taken through it was
  half blind (a `-2` radius read on the sidebar alone, a sidebar-wants-`-1`/rest-wants-`+1` density
  split that may be the instrument rather than the design). `BasaltProvider` now reads the same
  persisted store and rebuilds a real theme via `createBasaltTheme(undefined, { derive, radius,
density })`. Three pieces: the state moved to `theme-lab/derive-state.ts` (deliberately Mantine-free
  — the root layer must not pull the panel UI into every consumer's chunk for six lines of state, and
  one store instance means the CSS half and the object half can never disagree);
  `provider/lab-theme.ts` merges only the config's DELTA against the shipped base
  (`themeOverrideDelta`), because `BasaltProvider`'s contract is consumer-overrides-win-last and the
  documented mount hands it a COMPLETE `createBasaltTheme()` carrying every level-0 number — a
  whole-theme merge would clobber the lab back to level 0 in one direction and eat the consumer's own
  overrides in the other; function-valued fields are skipped (`buildTheme` allocates fresh
  `vars`/`classNames` closures per call and none of them closes over a radius/spacing value). The
  delta also carries `other.basaltDerive`/`basaltRadius`/`basaltDensity`, so `BasaltBridge`'s existing
  injection emits the matching `--vx-*` CSS off the running theme. **No shipped default moved, and the
  production path pays nothing**: the store subscription is gated to DEV builds at module scope
  (`process.env.NODE_ENV !== 'production'` picking one of two `use*` implementations — a per-render
  ternary would be a `react/rules-of-hooks` error), since `BasaltProvider` is the mandatory `.` entry
  and must not cost every consumer a localStorage read plus a permanent `storage` listener to answer a
  question that is always "no" there; a bundler drops the dev implementation and its
  `theme-lab/derive-state` import outright. Even in a dev build, with the "Apply" switch off — or in
  any app that never mounts the panel, since nothing else writes that key — the provider returns
  `createBasaltTheme(theme)` verbatim, and an active override at level 0 yields an empty delta. The
  cost of the gate: the sliders are inert in a production BUILD of a dev app (`vite build && vite
preview`) — run the playground through its dev server. Two things previously documented as part of the gap never were: Card/Paper resolve their
  radius through `var(--vx-radius-card)` in `styles.root`, and the Input/Button/ActionIcon `size="md"`
  heights read `--vx-space-*-height` via each component's `vars` — the CSS half always covered both.
  Pinned by `provider/lab-theme.test.ts` (16 tests) + `theme-lab/derive-state.test.ts` (6, for the
  store-to-override projection both halves share — the `applied` gate the "production untouched" claim
  rests on, and that no state-only key leaks into `theme.other.basaltDerive`).
- **Level-0 spacing retune (rides with the density PR)** — the first retune taken with a trustworthy
  instrument, applied to the BASE tables so level 0 stays the shipped identity and the knob keeps its
  full ±3 travel around it. No default level, no second knob — the knob's zero IS the identity.
  Components roomier: `SPACE_SCALE_BASE` 10/12/16/18/24 → **11/13/18/20/26** (~+10%), the app-wide
  rhythm every `p=`/`m=`/`gap=` resolves through, including the Card/Paper `p="xs"`/`p="sm"` inset
  idiom. Sidebar tighter (~−15%) across 13 gap/inset one-offs (`sidebarRegionGap` 12→10,
  `sidebarSectionGap` 15→12, `sidebarChildListIndent` 17→15, …). Three deliberate exclusions: sidebar
  SIZES are not spacing (`sidebarAvatarSize`, `sidebarSearchTriggerHeight`, the two Menu widths stay —
  shrinking them is a dimension change); the 4px stack rhythm stays 4/8/12/16/24, being the grid the
  scale sits on (moving it reshapes every Prose/Callout/ArticleCard margin); and `SPACE.rowInsetX`/
  `rowInsetY` stay 10/6, since that anchor is shared by the sidebar NavLink AND every Menu item, so
  tightening it for the sidebar tightens menus app-wide — the opposite direction from the rest. If the
  sidebar still reads loose, that anchor is the next lever, and the honest conclusion then is that the
  NavLink row inset is wrong everywhere rather than that the sidebar needs a private copy. Two
  consequences, both recorded at the source rather than papered over. `SPACE_SCALE` no longer coincides
  with the anchor group at level 0 (`xs`/`sm`/`md`/`xl` used to equal `rowInsetX`/`stackMd`/`stackLg`/
  `stackXl`) — always a coincidence, never a law, and this is what proves the two groups move
  independently, so the doc comments and `tokens/density.test.ts`'s independence assertion are updated
  to the stronger form. And `appShellHeaderMobileHeight` went 96 → **97**: it is documented as a SUM
  (row 1 + `SPACE_SCALE.sm` + `appHeaderMobileActionsHeight`), so raising the `sm` addend without
  raising the total took the pixel out of row 1 instead — surfacing as row 1's WCAG 2.5.8 target-size
  budget at density −3 going flush against its 22px floor. Restoring the sum restores the 1px margin
  (budgets 23/26/28/32/36/38/41 across the range). Both that constant's JSDoc and the assertion that
  measures it now name the real fix: compute the header from its addends the way
  `stickyHeaderClearance*` already is, so the drift becomes impossible rather than re-tuned — a
  follow-up only because it moves every non-zero level's value. `theme/spacing.test.ts`'s doc header
  was rewritten to match its actual job: it locks the CURRENT identity, updating it is how a deliberate
  retune lands AND how a regression would hide, so a diff to it must be a decision taken on purpose in
  the same commit as the base-table edit.

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
- Chart constants (`VX.legendGap`/`margin`/`dotR`) are single-sourced off `SPACE_STEP`'s
  `chartLegendGap`/`chartMargin*`/`chartDotR` keys, but — unlike every other density-tracking
  one-off — deliberately have NO `--vx-space-*` CSS var (visx SVG props read plain JS numbers, not
  `var()` strings, so a declaration would have zero consumers). `VX` is built ONCE at module load
  from the frozen level-0 `SPACE_STEP` snapshot, so it never re-reads a `density` option at all —
  this is the one case that fails BOTH paths, including the PRODUCTION `createBasaltTheme({
  density })` one, not merely the dev slider (see `deriveSpacing`'s JSDoc, `tokens/palette.ts`, for
  the full accounting of what tracks density end to end and what doesn't).

## Open — PR #23 (`feat/density-tokens`)

The 1.0 ship sequence is closed: the pivot merged, npm Trusted Publisher (OIDC) is configured, and
`v1.0.2`/`v1.1.0`/`v1.1.1` published. What's open is one PR:

1. **PR #23** — the density dimension, the theme-lab prune, and the guard wave above. Mergeable, no
   conflicts.
2. **`/code-review ultra`** before merge (billed).
3. **Merge**, then trigger the release workflow (semantic-release-monorepo, npm provenance).
   `release.yml` is `workflow_dispatch`-only — merging to `master` does NOT auto-release.

## Validation

Last verified green **2026-07-27** on `feat/density-tokens` — `bun test`: 905 pass / 49 files, and
`bun run pre` (fmt/lint/typecheck/check-theme). The pack-test's export-surface snapshot was updated
in the same pass for `./tokens`'s three new exports (`deriveSpacing`, `buildDensityCss`, `pxRem`).
**A final re-verification (`bun run pre` + `bun test` + pack-test) runs before ship** if further
commits land.

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
