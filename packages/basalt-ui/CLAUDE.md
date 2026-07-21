# Basalt UI — Package

**Inherits from**: `../../CLAUDE.md` (monorepo conventions).

The only published package (npm: `basalt-ui`; the breaking 1.0 ships from this branch). An opinionated framework for Mantine-based
React apps, extracted from argo: a Mantine theme + `cssVariablesResolver`, a `BasaltProvider`, an
app shell, a visx chart system, a three-tier `--vx-*` token system, a theme-lab, a Vite preset,
raw toolchain config presets, and a `basalt-ui` CLI.

> The old Tailwind CSS theme (OKLCH foundation palette, ShadCN/Tremor/Starlight compat,
> typography plugin, spacing-restriction strategy) is **gone**. Breaking 1.0 (`feat!:`), same npm
> name; `./css` and `./starlight` exports dropped.

## Status

The full S0→S5 argo extraction is **implemented** on `feat/s0-mantine-pivot`: tokens, charts,
theme/provider/theme-lab, the router-agnostic shell, the vite preset, the agentic layer, and the
real `init`/`sync`/`check-theme` CLI. `src/**` is real code, not stubs. The historical plan lives
in `../../docs/archive/BLUEPRINT.md`.

## Published surface (subpath exports)

| Subpath             | Mantine? | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.`                 | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + sidebar / mobile-nav / breadcrumbs / page-header, `SidebarSearch` + `SidebarSearchConfig` (the sidebar search field), `NavCountBadge`, `SidebarAccount` + the provider-agnostic account contract (`BasaltAccountProps`/`State`/`Actions`), `ThemeToggle`, shell types, dashboard composites (`DeltaBadge`, `StatCard`, `EmptyState`, `SettingsSection`/`SettingsRow`/`DangerZone`)                                                                                                                                                                                                                                                                                                                                                                             |
| `./charts`          | **free** | visx primitives / kinds / sparklines / hooks (re-exports the token layer too)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./tokens`          | **free** | `VX`, `alpha`, `BP` + `p` (raw hue families + pair-picker), `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `ColorPair` / `SeriesMap` types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./theme-lab`       | coupled  | `ThemeLabControls`, `applyOverrides`, `COLOR_GROUPS` (parameterized)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./guard`           | **free** | `checkSource`, `GUARD_RULES`, `Finding` types — the headless theme-guard core                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./state`           | **free** | `createPersistedState` (versioned localStorage) + `useOnlineStatus` — Mantine-free state primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./query`           | **free** | `createBasaltQueryClient`, transport-agnostic unwrap, lazy `BasaltQueryDevtools`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `./router-tanstack` | **free** | TanStack Router bridge: `useBasaltNav` (active route) + `useRouterBreadcrumbs`, `createSearchParamStore` / `createMultiSearchParamStore` (single-/multi-select URL-state stores)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `./forms`           | coupled  | Mantine form adapter: `useBasaltForm`, `field`, `FormErrorSummary`, `useFormDraft` (Standard Schema)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./notifications`   | coupled  | Mantine notifications: `notify` helpers, typed registry, persisted history, `NotificationBell`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `./commands`        | coupled  | typed command bus + overlay controller, `toSpotlightActions` / `toRouteActions` (projects a nav model to Spotlight page actions), `ShortcutsHelp`, `BasaltOverlays`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./data`            | coupled  | convenience barrel pulling both TanStack Table + Virtual peer groups: `BasaltDataTable`, `BasaltVirtualList` — prefer `./data/table` or `./data/virtual` for per-feature opt-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `./data/table`      | coupled  | `BasaltDataTable` — a sortable data table over TanStack Table, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./data/virtual`    | coupled  | `BasaltVirtualList` — a windowed virtual list over TanStack Virtual, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./agent`           | **free** | headless streaming-chat layer: `useAgentStream`, `aiSdkTransport` (recommended default, optional peer: `ai`) + `edenTransport` (zero-dep alternative), `PartList`, plus the multi-thread `createThreadsStore` + `useAgentThreadRuns` (transport can be a per-thread factory) + outcome-resolver seam, plus the client-side stream-resumption seam (`StartPart` / `AgentTransport.resume` / `ThreadsStore.resumeToken`)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `./connectivity`    | coupled  | `ConnectivityProvider` (aggregates browser online/offline, React Query `onlineManager`, SSE, and health-check pings), `useConnectivity`, `ConnectivityIndicator` — auto-mounted by `BasaltProvider`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./content`         | coupled  | The content/prose surface (`docs/CONTENT-SPEC.md`): `Prose` (article/chat typography), `CodeBlock` (shiki, optional peer, lazy singleton), `Callout`, `TableOfContents` (scroll-spy), `ReadingProgress`, `headingSlug`/`SlugTracker`/`readingTime`, `Markdown` (react-markdown + remark-gfm, optional peers, streaming-aware AI-output renderer), `MermaidDiagram` (beautiful-mermaid, optional peer), `mdxComponents`/`createMdxComponents` (MDX runtime element map), `blockSplit`, `ArticleLayout` (docs-page frame: meta header + sticky TOC rail + prev/next footer), `ArticleCard`/`ArticleGrid` (docs-landing overview cards), Article model (`sortArticles`/`filterArticles`/`formatArticleDate`), `ArticleFilterBar` (category/tags filter UI), `toArticleActions` (Spotlight projector), `GuideLink`/`GuideDrawer` (contextual in-app help drawer) |
| `./vite`            | —        | `basaltViteConfig(opts)`; `basaltAppPlugin(opts)` — PWA/favicon/head metadata from one config object: dual `theme-color` + anti-FOUC background resolved from `SURFACE.bg` via an internal `color-mix()` evaluator (so the hex is never hand-computed), icon links, apple/mobile web-app meta, `darkreader-lock`, an emitted `site.webmanifest`, site-wide OG/Twitter defaults, and an opt-in `serviceWorker` that lazily composes `vite-plugin-pwa` (optional peer) and degrades to a warning when absent                                                                                                                                                                                                                                                                                                                                                   |
| `./styles.css`      | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./configs/*`       | —        | raw toolchain presets (real file paths — `extends` needs them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `./llms.txt`        | —        | machine-readable surface map — one entry per published subpath with import specifier, description, layer, optional peers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Named exports only — **no default exports**. Files `kebab-case`, components `PascalCase`.

### Agent chat (`.` + `./agent`)

`./agent` ships the headless streaming layer (Mantine-free): `useAgentStream`, `AgentPart` +
`parseAgentPart`, `AgentTransport` / `aiSdkTransport` (recommended default, optional peer: `ai`) /
`edenTransport` (zero-dep alternative), `PartList`,
`BasaltStickToBottom`, `createChatHistoryStore`, plus the multi-thread primitives
`createThreadsStore`, `useAgentThreadRuns` (N concurrent per-thread runs), and the `AgentOutcome` /
`OutcomeResolver` / `heuristicOutcome` summarize-to-outcome seam, plus a client-side stream-resumption
seam (`StartPart`, `AgentTransport.resume`, `ThreadsStore.resumeToken`) — a mount-time reconnect
attempt before an orphaned thread falls back to `'interrupted'`. `./agent` ships no markdown
renderer of its own — `agent/** -> content` is lint-blocked by design, so `PartList` takes a
consumer-supplied `components.text`. The root `.` entry adds the Mantine chrome:
**`ThreadWorkspace`** — the flagship "many short chats" composite (a distilled outcome feed + a
detail panel) — plus `ThreadFeed`, `ThreadOutcomeCard`, `ThreadDetailPanel`, `Composer`,
`ThreadTranscript`, and `threadPartRenderers` (wires `./content`'s `Markdown` in as the text
renderer). Full doctrine + usage: `agent/rules/basalt-agent.md`.

## Layering: Mantine-coupled vs Mantine-free

- `src/charts/**` and `src/tokens/**` are **Mantine-free** — zero `@mantine/*` imports.
- `@visx/*` may **only** be imported inside `src/charts/**`.
- Enforced by three independent oxlint plugin rules — `basalt/visx-boundary` and
  `basalt/visx-tooltip` (repo-local AND shipped consumer preset, so the `@visx/*` boundary holds
  for downstream apps too) plus `basalt/token-layer-boundary` (repo-local **only** — protects two
  things: layering, the token layer's position UPSTREAM of Mantine, and packaging, `./charts`/
  `./tokens` resolving with no `@mantine/*` installed; see "Mantine-Free Boundary" in the root
  CLAUDE.md for both).
- The root barrel (`.`) does **not** re-export `./tokens` / `./charts` — it keeps the arrow pointing
  one way (root reads tokens via `cssVariablesResolver`, tokens never re-broadcasts through root),
  the same direction the token-layer boundary protects, AND it means a charts/tokens-only consumer
  never pulls Mantine into their bundle by importing the root barrel.

## Build (dist-first, unbundled)

```bash
bun run build
# = tsup && tsc --emitDeclarationOnly --declarationMap
#   && bun scripts/copy-assets.mjs && bun scripts/fix-esm-extensions.mjs
```

- **tsup** with `bundle: false`, `splitting: false`, `dts: false`, `entry: src/**/*.{ts,tsx}` —
  transpiles each module in place, mirroring the `src/` tree to `dist/` so subpath exports resolve
  to real files. `bundle: false` alone only emits entry modules, so the glob entry + `splitting:
false` are required.
- **`scripts/copy-assets.mjs`** mirrors every `src/**/*.css` (plus co-located `*.module.css.d.ts`)
  into `dist/` — under `bundle: false` esbuild leaves `.module.css` imports verbatim for the
  consumer's bundler, and `styles.css` is imported by no module, so both must be copied.
- **`scripts/fix-esm-extensions.mjs`** fully-specifies relative ESM imports in the unbundled `dist`
  (`./x` → `./x.js`, dir → `/index.js`) so Node resolves the subpaths — the pack-test enforces it.
- **tsc owns declarations** (`--emitDeclarationOnly --declarationMap`) — running tsup's `dts` too
  fights it. `.d.ts` + maps ship alongside.
- The tarball ships `dist/` + `src/` + `configs/` + `bin/` so go-to-definition lands in real source.
- **Never use `import.meta.env`** (Vite-only) in shipped code — use `process.env.NODE_ENV`.
- The **pack-test** (`bun pm pack` + scratch-install) is the dist gate in CI; the playground only
  exercises `src/`, never `dist/`.
- tsup is in maintenance mode (upstream → tsdown). The CSS-copy behavior is the load-bearing piece
  and works today — **re-evaluate tsdown before S4's CSS-module work, behind the pack-test**.

## Dependencies

- **deps**: 9 `@visx/*` pinned **exact** at stable `4.0.0` (`axis`, `curve`, `event`, `grid`,
  `group`, `responsive`, `scale`, `shape`, `threshold`).
- **peers**: `react` / `react-dom` `^19`; `@mantine/core` + `@mantine/hooks` `^9.3`. Battery
  subpaths declare their own **optional** peers (e.g. `@tanstack/*`, `@mantine/form|modals|notifications|spotlight`,
  `vite`, the markdown trio) — see `AGENTS.md`.
- **`motion`** pinned exact at `12.42.0` — the framework's one animation dependency (bundled
  implementation detail of shipped components, same precedent as `@visx/*`; not a peer). See
  "Motion" below.
- **NO** zustand, **NO** `@tanstack/*`, **NO** `@tabler/icons` — icons are passed in as `ReactNode`.
- `sideEffects: ['*.css']`.

## Token system (`--vx-*`, three tiers)

1. **Palette data** — pure data + string helpers (`BP`, `p()`, semantic/status/neutral/surface
   pairs). Zero React, zero `@mantine/*`, zero browser API.
2. **CSS variables** — emitted as `--vx-*` custom properties under the light/dark color scheme;
   resolution is pure CSS.
3. **Token refs** (`VX.*`) — just `var(--vx-*)` strings (colors) plus non-color sizing constants,
   so they work in components AND non-component files.

Keep the `--vx-*` prefix (do not rename — it makes argo's migration byte-provable). A color pair
keeps its hue identity but shifts shade across schemes. Apply opacity with `alpha(token, a)`
(`color-mix`), never `rgba()`, so the hue keeps resolving per scheme.

**The shipped default palette is GENERATED, not hand-authored.** `tokens/derive.ts` (ported from
the `apps/playground` HCT-derivation POC) computes the accent family, the 12 categorical fills, the
surface stops, the ink ramp, and the status solids from `DEFAULT_DERIVE_CONFIG` — seed `#0077bd`,
`neutral: 'zinc'`, `lightLevel`/`darkLevel`/`vibrancy`/`accentBrightness` all at `0` (vibrancy
centers on `×0.72` calibrated chroma); `tokens/palette.ts` builds `ACCENT`/`FILL`/`SURFACE`/`INK`/
the status hues from `deriveTokens(DEFAULT_DERIVE_CONFIG)` once at module load, and the chart-chrome
opacity ramps (`NEUTRAL.axis`/`grid`/`crosshair`/`tooltip*`) key off the same derived light `ink`
hex. Never hand-edit one of those hexes — retune `DEFAULT_DERIVE_CONFIG` or the calibrated
constants in `derive.ts` instead; `tokens/derive.ts` and `tokens/hct.ts` are themselves exempt from
`check-theme`'s `raw-hex` guard (alongside `palette.ts`/`theme/index.ts`) since they ARE that
source. Structural, non-derived tokens (shadows, the overlay surface, dividers, the raw `BP` hue
ramps) stay hand-authored.

A consumer retunes the identity via `createBasaltTheme(overrides?, { derive: { accent, neutral,
lightLevel, darkLevel, vibrancy, accentBrightness } })` — the ONE production entry point; omitted
knobs fall back to the shipped default per-knob. The same options object carries the non-color
dimensions (never a second config surface): `fonts: { sans?, head?, mono? }` (pure pass-through to
the `--basalt-font-*` vars — the single font entry point, enforced by the `raw-font-family` guard
kind), `radius` (integer −5..+5; law: card = 7 + level, ctrl = 6 + level, clamped ≥ 0, offset
tiers and the anchored Mantine scale stops follow — `deriveRadius(level)` in `tokens/palette.ts`,
level 0 = today's values, locked by `theme/radius.test.ts`), and `density` (integer −3..+3 —
narrower than `radius`'s −5..+5 on purpose, see `deriveSpacing`'s JSDoc for why; law: a multiplier
`1 + 0.1 * level` over every spacing anchor/scale-stop/one-off (rounded, floored at 1
unconditionally — a future base under 1 can never round down to 0), plus an independent, gentler
additive law for the NavLink row line-height, plus two relation-preserving special cases: the 4px
stack rhythm rebuilds from one shared unit (not five independently-rounded values) so its
documented 2:1 pairs hold at every level, and the sidebar search trigger height floors at 24px
(WCAG 2.5.8) — `deriveSpacing(level)` in `tokens/palette.ts`, level 0 = today's values, locked by
`theme/spacing.test.ts` and by cross-level relation tests in `theme/density-relations.test.ts`.
`theme-lab`'s `DeriveControls` is the DEV-tool analog (live-tweak the color knobs + radius + density
by eye, persisted to localStorage) — never the production path; its `<style>` override only moves
CSS vars, so numeric `defaultProps` baked into the theme object (Timeline's `bulletSize`,
Progress's `size`) — and `theme.spacing` itself, the generic Mantine scale, baked into the theme
object the same way — don't visibly follow the Radius/Density sliders there, while
`createBasaltTheme` rebuilds them correctly. Input's/Button's/ActionIcon's `size="md"` height is
NOT in that bucket
despite reading like the same shape of gap: it resolves through a CSS custom property
(`--vx-space-input-height`/`--vx-space-control-height`, read via each component's `vars`, not a
numeric `defaultProps` literal), so it DOES visibly follow the Density slider in the dev tool too,
not only in production. One piece of the gap is bigger than the `defaultProps` case and NOT
theme-lab-only: `tokens/index.ts`'s `VX.legendGap`/`VX.margin`/`VX.dotR` (chart legend gap,
plot-area margins, marker radius) are frozen at module load from the level-0 snapshot and never
re-derive from a `density` option even on the PRODUCTION `createBasaltTheme` path — see
`deriveSpacing`'s JSDoc for the full accounting of what tracks density end to end and what doesn't.
See `docs/STATUS.md`'s "Derive engine" section for what shipped and known limitations.

### Consumer-series extensibility (`./tokens`)

App-specific series colors are domain data — they live in the consumer, not the framework. The
framework ships the primitives:

```ts
buildPaletteCss(opts?)                  // → full PALETTE_CSS string (embeds consumer series/groups/derived)
seriesTokens(map, prefix?)              // → { hrv: 'var(--vx-hrv)', ... } exact-keyed; stale keys fail tsc
groupTokens(name, map)                  // → namespaced token refs for a group
defineSeries(map)                       // sugar — returns the series map (css + tokens)
alpha(token, a)                         // theme-aware opacity helper
```

`VX.series` is NOT in the framework — argo rebuilds it app-side in one guard-exempt file.

### Canonical token-factory contract

Every `defineX` factory exported from `./tokens` follows **one shape** — const-generic, exact-keyed,
no widening:

```ts
// canonical signature (const-generic, exact-keyed, satisfies for validation)
function defineX<const T extends Constraint>(spec: T): T

// ✓ correct — preserves literal key set, tsc catches stale keys
const MY = defineX({ hrv: '#…', rhr: '#…' } satisfies Constraint)

// ✗ wrong — widening annotation discards the literal keys
const MY: Constraint = defineX({ hrv: '#…', rhr: '#…' })
```

Rules that apply to every factory, without exception:

- **`const` generic** — `<const T extends Constraint>` so the return type mirrors the exact input
  shape verbatim; never widen `T` to `Constraint`.
- **Exact-keyed return** — return type is `T` (or a mapped form of `T`), not the constraint base.
  Stale keys therefore fail `tsc` at the call site.
- **`satisfies` for validation, never a widening annotation** — callers write
  `defineX({ … } satisfies Constraint)`, not `const x: Constraint = defineX(…)`.
- **No fluent builder, no config bag** — the factory is a single call; no chained `.add()`, no
  options object that accumulates state.
- New factories must match this shape before being added to the public surface.

## Theme & provider surface (`.`)

- `baseTheme` — Mantine `createTheme` base (Blueprint-anchored: `primaryColor`, `primaryShade: 6`,
  owned spacing/radius scales, named `fontWeights` ladder, mono font).
- `createBasaltTheme(overrides?, options?)` = `mergeThemeOverrides(baseTheme, overrides)` by
  default; `options.derive` (`tokens/derive.ts`'s `DeriveConfig`, partial) retunes the palette
  identity from a seed + knobs, `options.fonts` sets the `--basalt-font-*` stacks, `options.radius`
  shifts the corner-radius law by an integer level, and `options.density` shifts the spacing law by
  an integer level — see "Token system" above. Every non-default option rides `theme.other.basalt*`
  and the provider's injected `<style>`.
- `cssVariablesResolver` — binds Mantine's surfaces AND its color families to the same `--vx-*` vars
  the charts use, so chrome and charts are ONE source. Exported and pre-wired in `BasaltProvider`.
  Two rules live here, both enforced by `theme/contrast.test.ts`:
  - **The fill band.** A filled control does not invert across schemes, so its color must clear a
    white label (≥3.0:1, the derivation's UI-component contrast floor) AND stay visible on both
    pages (≥3:1). That pins every fill into one narrow luminance band (Y=0.165, `FILL` / `ACCENT`
    in `tokens/palette.ts`, computed by `tokens/derive.ts`) — hue varies, luminance does not. Never
    fill with the ink accent (`--vx-accent`); fill with `--vx-accentFill` / `--vx-fill-{family}`.
  - **On-color in CSS, never in JS.** Mantine resolves a filled foreground once, scheme-blindly, via
    a brightness heuristic that does not track WCAG contrast. Basalt emits `--vx-on-{color}` per
    scheme instead and re-points every filled surface at it — including the seven components
    (Checkbox / Radio / Tabs / Pagination / Stepper / Indicator / Timeline) that bypass
    `variantColorResolver` and call `getContrastColor` themselves.
- `BasaltProvider` — wraps `MantineProvider`, injects the palette `<style>` (`injectPalette={false}`
  escape hatch for SSR/head injection), bridges the Vx tokens.
- `ThemeToggle` — tri-state (light/dark/system) control. Click cycles all three (Mantine's own
  `toggleColorScheme` only flips light/dark); hover/focus reveals a popover to pick one directly.
  Single animated sun/moon glyph — never a third "computer/monitor" icon — with a subtle ring
  indicating system mode. See "Motion" below for the animation layer it's built on.

## Motion (`motion`, the animation layer)

The motion analog of the `--vx-*` token system — one shared set of constants instead of ad hoc
durations/easings scattered per component.

- `src/motion/index.ts` exports `MOTION_DURATION` (seconds: `fast`/`base`/`slow`, capped at 0.3 —
  matches basalt-mantine.md's "never above 300ms" interaction-feedback ceiling), `MOTION_SPRING`
  (the standard interactive spring), `MOTION_EASE_STANDARD` (tween curve) — all re-exported from
  the root `.` barrel. Zero React, zero `@mantine/*` — importable from Mantine-coupled AND
  Mantine-free code alike (`motion` itself has no framework coupling, so using it inside
  `src/charts/**`/`src/tokens/**` does NOT violate the Mantine-free boundary — only `@mantine/*`
  imports are banned there).
- Reduced-motion is read via `@mantine/hooks`' `useReducedMotion` (already a peer dep) at the call
  site, not a duplicate hook from `motion` — every animated component must branch on it and render
  an unanimated, instant equivalent (see `ThemeToggle` for the pattern: a fully separate
  no-`motion`-import code path when reduced motion is requested, not just `duration: 0`).
- `ThemeToggle` is the first consumer: the sun/moon glyph crossfade/rotate and the direct-select
  popover reveal both animate via `motion/react` (`motion.*` components + `AnimatePresence`) using
  the shared spring token.
- Restraint applies to motion the same way it applies to color (see `/basalt:design`): subtle,
  purposeful, physically-plausible — never a looping/pulsing idle animation, never decorative.
- **Mechanically enforced, same rigor as the Mantine-free boundary and the color guard:**
  - oxlint `no-restricted-imports` bans a direct `framer-motion` import repo-wide and in the
    shipped consumer preset (`#app` synthetic surface in `surfaces.ts`) — must import from
    `motion/react`. Regenerate via `bun packages/basalt-ui/scripts/gen-oxlint.ts` after any
    `SURFACES` edit (`--check` is the CI drift gate).
  - `basalt-ui check-theme`'s 13th guard kind, `raw-motion-value`, fails the build on a hardcoded
    duration/spring/ease literal inline in a `transition={{...}}` prop — route it through the
    tokens above instead (`theme-allow` escape same as every other guard kind).

## App shell (`.`)

`BasaltShell` composes `AppSidebar` / `MobileNav` / `AppBreadcrumbs` / page-header
(`PageHeaderProvider` / `PageActions` / `PageActionsOutlet`). Brand, `SidebarSection[]`, a
`globalActions` slot, footer/settings extras; collapse persisted via `@mantine/hooks`
`useLocalStorage`. Router-agnostic — badge/active/navigate wiring stays consumer-side; ship
`NavCountBadge` for the count-badge pattern. No zustand, no router adapter.

**Sidebar account (`account` prop, optional).** `SidebarAccount` is a presentational footer row
over a provider-agnostic contract (`account-types.ts`: `BasaltAccountState` — loading /
unauthenticated / authenticated identity+role+plan — plus `BasaltAccountActions`). basalt-ui has
**no** auth dependency and ships **no** `./auth` subpath — the consumer maps its real auth client
(Better Auth, Clerk, …) into this shape; the Better-Auth mapping recipe lives as JSDoc on
`BasaltAccountProps` only. Pass `account` to `BasaltShell`/`AppSidebar` to render it below the
settings menu (separated by its own top hairline); omitting it reproduces the pre-existing footer
unchanged. The row shows a generic, non-personalized "person" icon (never an avatar/photo/initials)
with plan/role badges nested under the name; the email is hidden unless `showEmail` is passed
(privacy default).

## CLI (`basalt-ui`)

One bin, **named like the package** so `bunx basalt-ui` can never resolve a stranger's package (an
unrelated `basalt` exists on npm — never print `bunx basalt` anywhere):
`basalt-ui init | sync | check-theme | check-coverage | info | doctor | guard-hook` (Bun runtime).

- `check-theme` — **real**. Port of argo's theme guard; fails on colors bypassing the central
  palette. Reads config from the consumer package.json `"basalt"` key
  (`{ roots?, exempt?, spacingSteps?, forbiddenAccents? }`); default root is `src`, and a scan that
  matches zero files fails loudly. Consumer lint = `oxlint . && basalt-ui check-theme`.
- `init` / `sync` — **real**. Two ownership modes, decided by one question — _does Claude read this
  file?_ **managed** (three-way reconciled; local edits skipped unless `--force`; the CLAUDE block
  is managed with markers): `.claude/rules/basalt-*.md`, `.claude/skills/basalt-*/SKILL.md`, the
  CLAUDE.md block. **seed** (written once, then consumer-owned; recreated only when missing):
  `DESIGN.md`, `.oxlintrc.json` + `lefthook.yml` (extends-stubs into
  `node_modules/basalt-ui/configs/`), `.oxfmtrc.json`, `.github/workflows/check.yml`, optional
  scaffolds. Reconciled against `.basalt/manifest.json` (sha256 per managed unit + basaltVersion);
  `--check` is the CI drift gate. Contract tests: `src/cli/placement-engine.test.ts`.
- `check-coverage` — **framework-internal only**, a self-consistency gate for the basalt-ui repo
  itself (asserts SURFACES ↔ rule files ↔ skill files ↔ package.json exports); not a consumer
  command.
- `info` (+ `--json`) — prints the published surface map; `--json` emits a stable JSON form.
- `doctor` — verifies the one version axis: installed `node_modules/basalt-ui` vs the manifest's
  `basaltVersion` (plus manifest presence and a stale-`bunx` CLI-version warning).
- `guard-hook` — PreToolUse theme-guard adapter: reads a Write/Edit payload on stdin, denies
  off-palette writes. Register it in `.claude/settings.json` under `hooks.PreToolUse` with matcher
  `Write|Edit|MultiEdit` and command `bunx basalt-ui guard-hook`.

## Toolchain (oxlint + oxfmt — not Biome/Prettier)

oxfmt style: single quotes, **no semicolons**, `printWidth` 100, `trailingComma` all, 2-space
indent. The `configs/` presets (`oxlint.json`, `oxfmt.json`, `tsconfig.{base,react-app,node}.json`,
`lefthook.yml`, `check.yml`) ship raw for consumer `extends` / scaffolding.

### The `basalt` oxlint plugin (`configs/oxlint-plugin.js`)

A custom oxlint JS plugin (alpha `jsPlugins`, ESLint-v9-compatible `create(context)` API) shipping
design-guard AST rules `src/guard`'s regex scan can't reach. It ships inside `configs/` and
`configs/oxlint.json` wires `jsPlugins: ["./oxlint-plugin.js"]` — a consumer that `extends` the
shipped preset inherits it automatically, path resolved relative to the preset file.

- `basalt/no-raw-font-size` — flags a hardcoded numeric font size (`fz`/`fontSize` JSX attribute or
  a `fontSize` style/object property) instead of `VX.text.*` / `--vx-text-*`.
- `basalt/card-inset` — flags a `Card`/`Paper` carrying an explicit `p`/`padding`/`radius`, or a
  `py`/`px` off the `xs`/`sm` inset idiom.
- `basalt/chart-in-raw-surface` — flags a chart-kind element (`Bars`, `Donut`, `DualPanel`,
  `Heatmap`, `MultiLine`, `StackedArea`, `ZonedLine`, `BarSparkline`, `LineSparkline`) rendered
  inside a raw `Card`/`Paper` instead of the shipped `ChartCard` wrapper.
- `basalt/visx-boundary` — flags a `@visx/*` import outside a `charts/` path segment. Shipped in
  the consumer preset AND repo-local.
- `basalt/visx-tooltip` — flags `@visx/tooltip` everywhere, including inside charts (use
  `ChartTooltip` + the `TooltipHeader`/`Row`/`Body` family instead). Shipped AND repo-local.
- `basalt/token-layer-boundary` — flags `@mantine/*` inside `charts/` or `tokens/` path segments.
  **Repo-local only**, deliberately absent from the shipped consumer preset — it protects two
  things. **Layering**: `src/tokens/**` is pure data that `cssVariablesResolver` (Mantine-coupled)
  reads to bind Mantine's surfaces to the same `--vx-*` vars `src/charts/**` reads (chrome and
  charts, one source); an `@mantine/*` import in `tokens` would cycle back through the theme layer,
  and one in `charts` would let a chart bypass `--vx-*` and read Mantine's theme directly, forking
  chrome and charts apart. **Packaging**: `./charts` and `./tokens` resolve and render with **no
  `@mantine/*` installed** — real and CI-tested (`scripts/pack-test.sh`'s "charts/tokens-only
  (no-Mantine) resolution + render" step; `scripts/check-dist-layering.mjs`'s dist-graph walk; the
  root barrel not re-exporting them). The LAYER is Mantine-free — the FRAMEWORK is not: `.` requires
  Mantine (`@mantine/core`/`@mantine/hooks` are required peers); `./charts`/`./tokens` don't. Both
  are invariants internal to this repo, not a consumer contract — a consumer's own
  `charts/`/`tokens/`-named directories carry no such obligation.

These three used to be one bundled `import-boundary` rule sharing a single on/off toggle, so a
consumer disabling the one check they disagreed with silently dropped the other two — each is now
its own rule id for that reason. They're plugin rules rather than `no-restricted-imports` because
oxlint's `no-restricted-imports` is last-writer-wins per glob — a consumer's own override on an
overlapping glob would silently replace the boundary instead of merging with it, whereas a plugin
rule can only be turned off explicitly, by name.

The four design-guard rules support the same `theme-allow` escape as `src/guard`: a line comment
containing `theme-allow` on the flagged node's own line, or the line above it, suppresses the
finding. The three boundary rules above deliberately do **not** — an architecture boundary a stray
comment can switch off is the silent bypass they exist to prevent. Turn one off by name or not
at all.

## Development Guidelines

- Strict TS, no `any`, explicit types on public exports; typed object params, low nesting, early
  returns.
- Function components only; no `React.FC`, no default exports.
- Respect the Mantine-free boundary and the `@visx/*`-only-in-charts rule.
- Don't reintroduce Tailwind, OKLCH foundation palettes, ShadCN/Tremor/Starlight compat, or any
  `import.meta.env` reference in shipped code.
- When extending the public API, keep it grounded in the argo source it was extracted from, and
  update this file in the same commit.
