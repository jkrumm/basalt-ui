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

| Subpath             | Mantine? | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                 | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + sidebar / mobile-nav / breadcrumbs / page-header, `SidebarSearch` + `SidebarSearchConfig` (the sidebar search field), `NavCountBadge`, `SidebarAccount` + the provider-agnostic account contract (`BasaltAccountProps`/`State`/`Actions`), `ThemeToggle`, shell types, dashboard composites (`DeltaBadge`, `StatCard`, `EmptyState`, `SettingsSection`/`SettingsRow`/`DangerZone`), and the query-branch trio `QueryState` / `LoadingState` / `ErrorState` (see below — they live under `src/dashboard/`, not `src/query/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `./charts`          | **free** | visx primitives / kinds / sparklines / hooks (re-exports the token layer too). Centrepiece is **`CartesianChart`** — the primitive that owns measured margins, both y scales, axes, grid, zones, the shared cursor, crosshair + dots, and the derived tooltip, so a kind draws only marks (`docs/CHARTS-SPEC.md`). Plus `ChartCursorScope` (ISOLATES a subtree — the cursor is shared by default, no provider), `autoMargin`, `useChartCursor`, `ChartTooltipFloat`, `XZoneRects` + `type XZoneSpec` (vertical x-range bands, `getX`-domain-keyed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `./tokens`          | **free** | `VX`, `alpha`, `BP` + `p` (raw hue families + pair-picker), `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `chartMargin` + `type ChartMargin`, `ColorPair` / `SeriesMap` types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `./theme-lab`       | coupled  | `ThemeLabControls`, `applyOverrides`, `COLOR_GROUPS` (parameterized)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./guard`           | **free** | `checkSource`, `GUARD_RULES`, `Finding` types — the headless theme-guard core; plus the annotation reader `--audit-allows` is built on: `findAllowAnnotations`, `neutralizeAllowAnnotation`, `NEUTRALIZED_ALLOW_TOKEN`, `PLUGIN_RULE_IDS`, `AllowAnnotationSite`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `./state`           | **free** | `createPersistedState` (versioned localStorage) + `useOnlineStatus` — Mantine-free state primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./query`           | **free** | `createBasaltQueryClient`, transport-agnostic unwrap, lazy `BasaltQueryDevtools`, `toErrorMessage` / `errorStatus` (the ONLY route to those two — the root barrel does not re-export them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./router-tanstack` | **free** | TanStack Router bridge: `defineNav` / `navGroup` / `navTarget` / `flattenNav` (ONE typed nav definition) + `useNav` (→ `{ sections, mobileNav }`, spread onto `BasaltShell`), `useBasaltNav` (active route) + `useRouterBreadcrumbs`, `createSearchParamStore` / `createMultiSearchParamStore` (single-/multi-select URL-state stores)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `./forms`           | coupled  | Mantine form adapter: `useBasaltForm`, `field`, `FormErrorSummary`, `useFormDraft` (Standard Schema)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./notifications`   | coupled  | Mantine notifications: `notify` helpers, typed registry, persisted history, `NotificationBell`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `./commands`        | coupled  | typed command bus + overlay controller, `toSpotlightActions` / `toRouteActions` (projects a nav model to Spotlight page actions), `ShortcutsHelp`, `BasaltOverlays`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./data`            | coupled  | convenience barrel pulling both TanStack Table + Virtual peer groups: `BasaltDataTable`, `BasaltVirtualList` — prefer `./data/table` or `./data/virtual` for per-feature opt-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `./data/table`      | coupled  | `BasaltDataTable` — a sortable data table over TanStack Table, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./data/virtual`    | coupled  | `BasaltVirtualList` — a windowed virtual list over TanStack Virtual, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./agent`           | **free** | headless streaming-chat layer: `useAgentStream`, `aiSdkTransport` (recommended default, optional peer: `ai`) + `edenTransport` (zero-dep alternative), `PartList`, plus the multi-thread `createThreadsStore` + `useAgentThreadRuns` (transport can be a per-thread factory) + outcome-resolver seam, plus the client-side stream-resumption seam (`StartPart` / `AgentTransport.resume` / `ThreadsStore.resumeToken`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `./connectivity`    | coupled  | `ConnectivityProvider` (aggregates browser online/offline, React Query `onlineManager`, SSE, and health-check pings), `useConnectivity`, `ConnectivityIndicator` — auto-mounted by `BasaltProvider`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./content`         | coupled  | The content/prose surface (`docs/CONTENT-SPEC.md`): `Prose` (article/chat typography), `CodeBlock` (shiki, optional peer, lazy singleton), `Callout`, `TableOfContents` (scroll-spy), `ReadingProgress`, `headingSlug`/`SlugTracker`/`readingTime`, `Markdown` (react-markdown + remark-gfm, optional peers, streaming-aware AI-output renderer), `MermaidDiagram` (beautiful-mermaid, optional peer), `mdxComponents`/`createMdxComponents` (MDX runtime element map), `blockSplit`, `ArticleLayout` (docs-page frame: meta header + sticky TOC rail + prev/next footer), `ArticleCard`/`ArticleGrid` (docs-landing overview cards), Article model (`sortArticles`/`filterArticles`/`formatArticleDate`), `ArticleFilterBar` (category/tags filter UI), `toArticleActions` (Spotlight projector), `GuideLink`/`GuideDrawer` (contextual in-app help drawer)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `./vite`            | —        | `basaltViteConfig(opts)` (also prints the one-time enforcement notice when `basalt-ui init` has never run in the project — `enforcementNotice: false` opts out); `basaltAppPlugin(opts)` — PWA/favicon/head metadata from one config object: dual `theme-color` + anti-FOUC background resolved from `SURFACE.bg` via an internal `color-mix()` evaluator (so the hex is never hand-computed), icon links, apple/mobile web-app meta, `darkreader-lock`, an emitted `site.webmanifest`, site-wide OG/Twitter defaults, and an opt-in `serviceWorker` that lazily composes `vite-plugin-pwa` (optional peer) and degrades to a warning when absent. `icons` takes `false`, `{ dir?: string }`, or a `readonly BasaltAppIcon[]`. `false` omits BOTH the head `<link>` tags and the manifest's `icons` member (before 1.22.0 it skipped only the head, so a manifest shipped naming two PNGs the app never builds); `{ dir }` and the default walk the same six fixed filenames byte-identically; an ARRAY names the icons the app actually has, using the manifest's own field names (`src`, `sizes`, `type`, `purpose`) plus an optional `rel`. Every entry becomes a manifest icon; only an entry naming a `rel` reaches the head, which is what lets an app whose `index.html` already links its favicon take the generated manifest with no duplicate tag. An empty array reads as `false` |
| `./styles.css`      | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./tokens.css`      | **free** | Prebuilt `--vx-*` stylesheet — the default `buildPaletteCss()` output as a plain file, for a consumer with no bundler, React or Mantine; `basalt-ui tokens:css` re-emits it with a custom scheme selector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `./configs/*`       | —        | raw toolchain presets (real file paths — `extends` needs them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `./llms.txt`        | —        | machine-readable surface map — one entry per published subpath with import specifier, description, layer, optional peers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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

## Tests

Run tests from the **repo root** (`bun test`), not from this package directory. The DOM harness
(`tests/setup/dom.ts`) is wired via `[test].preload` in the ROOT `bunfig.toml` — Bun resolves
`bunfig.toml` relative to `cwd`, and there is no package-level one (deliberately: a second preload
config here would drift from the root one). Running `bun test` from inside `packages/basalt-ui`
finds no `bunfig.toml`, gets no DOM, and fails every DOM-touching test with `ReferenceError:
document is not defined`. `bun run test` from this directory is safe — it's a thin delegate
(`cd ../.. && bun test packages/basalt-ui`) that always runs from the root.

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

- **`dependencies` is empty.** The package ships zero runtime dependencies — `bun add basalt-ui`
  with no peers installed pulls in exactly one package. Every dependency the framework's components
  need is a peer instead, so a subpath that doesn't touch them never installs them.
- **peers**: `react` / `react-dom` `^19`; `@mantine/core` + `@mantine/hooks` `^9.3`;
  `@tanstack/react-query` `^5.101`. `./charts` needs 9 `@visx/*` pinned **exact** at stable `4.0.0`
  (`axis`, `curve`, `event`, `grid`, `group`, `responsive`, `scale`, `shape`, `threshold`). The root
  `.` entry's `ThemeToggle`/`ThreadFeed`/`ThreadDetailPanel` need `motion` pinned exact at
  `12.42.0`. `basalt-ui/content`'s `Markdown` needs `remend` pinned exact at `1.3.0` — its one
  eagerly-imported peer, so `./content` fails to resolve at all without it (every other content peer
  degrades gracefully when absent; see the package README). `basalt-ui/styles.css`'s font stack
  needs the three exact-pinned `@fontsource-variable/*` packages (`hubot-sans` `5.2.8`,
  `jetbrains-mono` `5.2.8`, `nunito-sans` `5.2.7`). Battery subpaths declare their own peers further
  (e.g. `@tanstack/*`, `@mantine/form|modals|notifications|spotlight`, `vite`, the markdown trio) —
  see `AGENTS.md`.
- **Every peer is `optional` in `peerDependenciesMeta`**, including the five the root `.` entry
  hard-requires at build time and the fourteen above that used to ship as bundled `dependencies`
  (the `@visx/*` chart stack, `motion`, `remend`, the three fonts) until this moved them to
  `peerDependencies` — a tokens-only consumer no longer installs any of them. npm expresses
  optionality per PACKAGE, never per SUBPATH, and `./tokens` / `./charts` / `./state` / `./guard`
  really do resolve with none of the five Mantine/react peers installed — so requiring them would
  charge a framework-free consumer packages it never loads. The trade: a consumer missing a peer
  gets a bundler resolution error instead of an install-time warning. Version-mismatch warnings are
  unaffected and must stay that way — `optional` only suppresses the MISSING-peer check, so every
  peer stays listed in `peerDependencies` (`tests/required-peers.test.ts` pins both halves for the
  five hard-required root peers).
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
by eye, persisted to localStorage) — never the production path, but a FAITHFUL one: it applies a
config through both halves of the theme, so what you read off a slider is what
`createBasaltTheme({ radius, density })` will ship. The CSS half is its own cascade-winning
`<style>` tag; the theme-OBJECT half is `provider/lab-theme.ts` — `BasaltProvider` reads the same
persisted store (`theme-lab/derive-state.ts`, deliberately Mantine-free so the root layer doesn't
pull the panel UI) and rebuilds a real theme via `createBasaltTheme(undefined, { derive, radius,
density })`. That subscription is **gated to DEV builds** at module scope
(`process.env.NODE_ENV !== 'production'`, one of two `use*` implementations bound once — a per-render
ternary would be a `react/rules-of-hooks` error): `BasaltProvider` is the mandatory `.` entry, so a
production app must not pay a localStorage read and a permanent `storage` listener to answer a
question that is always "no" there. Consequence to know: the sliders are inert in a production BUILD
of a dev app (`vite build && vite preview`) — run the playground through its dev server. It merges only that config's DELTA against the shipped base (`themeOverrideDelta`),
never the whole theme: `BasaltProvider`'s contract is consumer-overrides-win-last, and the
documented mount hands it a COMPLETE `createBasaltTheme()` carrying every level-0 number, so a
whole-theme merge would clobber the lab straight back to level 0 — while a whole-theme merge in the
other direction would eat the consumer's own overrides. What the object half covers, and nothing
else: `theme.radius`/`theme.spacing` (the generic Mantine `xs`..`xl` scales — every `p="md"` /
`gap="sm"`) plus `defaultProps.radius` on Badge/SegmentedControl/Progress/Tooltip/Popover/Modal/
Notification, `Progress.size`, `Timeline.bulletSize` (pinned by `provider/lab-theme.test.ts`).
Card/Paper are NOT in that set — their radius resolves through `var(--vx-radius-card)` in
`styles.root`; nor are Input's/Button's/ActionIcon's `size="md"` heights, which read
`--vx-space-input-height`/`--vx-space-control-height` via each component's `vars`. Those were always
covered by the CSS half. ONE gap remains and it is NOT theme-lab-only — it fails the PRODUCTION path
identically: `tokens/index.ts`'s `VX.legendGap`/`VX.margin`/`VX.dotR` (chart legend gap, plot-area
margins, marker radius) are frozen at module load from the level-0 snapshot and never re-derive from
a `density` option even under `createBasaltTheme` — see `deriveSpacing`'s JSDoc for the full
accounting of what tracks density end to end and what doesn't. See `docs/STATUS.md`'s "Derive
engine" section for what shipped and known limitations.

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
    fill with the ink accent (`--vx-accent`); fill with `--vx-accent-fill` / `--vx-fill-{family}`.
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
`globalActions` slot, settings/account extras; collapse persisted via `@mantine/hooks`
`useLocalStorage`. Router-agnostic — badge/active/navigate wiring stays consumer-side; ship
`NavCountBadge` for the count-badge pattern. No zustand, no router adapter.

**The router seam is ONE component, not a render callback.** `SidebarItem.Anchor` (a `NavAnchor`,
declared in `src/nav/types.ts`) is the consumer's router `<Link>`; basalt renders every pixel of
chrome around it — the desktop row, the 56px mobile slot, the 44px sheet row — and only hosts that
component. When `Anchor` is absent the row falls back to `<a href>` + `onClick`, so a no-router
consumer still works. There is no `renderNavLink` / `renderBreadcrumbLink` / `MobileNav sections=`
callback surface any more: one anchor per destination, three render paths, zero duplication. On the
breadcrumb bar the same seam is `parentAnchor`, rendered as `<Anchor component={parentAnchor}>` so
basalt keeps Mantine's link semantics.

**Mobile nav (`MobileNav` + `projectMobileNav`, `src/shell/mobile-nav-model.ts`).** The bottom bar
is a TAB BAR, not a menu: a slot is a destination, so a tap navigates through the consumer's router
with no overlay to dismiss. The full-height mobile `AppShell.Navbar` drawer is **gone** — the
navbar is permanently `collapsed: { mobile: true }`, and everything the drawer used to hold (nav,
account, settings, theme switcher) is reachable from the trailing More slot instead, rendered as
flat rows derived from `BasaltAccountProps` / `SettingsMenuItem[]` rather than by mounting
`SidebarAccount` (which would open a menu inside a menu).

`projectMobileNav(sections, { config, extraMoreRows })` is a PURE projection — no React, no
Mantine, no DOM — and it decides everything: which destinations get a slot, which slot is a plain
link and which raises a surface, and whether that surface is a `Menu` or a bottom-sheet `Drawer`.
The surface is INFERRED from row count, never configured: 0 drops the slot, 1 collapses to a plain
link (a group of one IS a destination), ≤ `menuMax` (6) is a menu, more is a sheet. Six is
arithmetic — 6 × 44px + 8px padding = 272px against 415px of headroom on the smallest supported
viewport — which is why the menu runs `flip: false` and can never render below the fold. Placement
per destination is `SidebarItem.mobile` (`'tab'` / `'more'` (default) / `'hidden'`); a section
claims its own slot with `mobile: { tab: true }` or leaves mobile with `mobile: false`. With
nothing configured the first `maxTabs - 1` non-disabled top-level destinations take slots.
`MobileNavConfig` (`tabs`, `maxTabs`, `menuMax`, `moreLabel`, `moreExtra`, `getScrollElement`) is
the escape hatch, not the interface.

Two things in the mobile CSS that look like bugs and are not:

- **`.bar` carries no `env(safe-area-inset-bottom)`.** Mantine's own `AppShell` `.footer` rule
  already does `height: calc(var(--app-shell-footer-height) + env(safe-area-inset-bottom))` plus a
  matching `padding-bottom`; adding it again double-counts the inset. The one real gap is
  `--app-shell-footer-offset`, which Mantine sets to the RAW height, leaving `AppShell.Main`'s
  padding short by exactly one inset — closed by `.mainSafeArea`, applied to `Main` by the shell.
  The sheet gets its own inset padding because a `Drawer` is not an `AppShell` section.
- **The active indicator is a neutral ink-10% pill behind the ICON only**, never the identity blue
  and never a full-tab fill (that reads as chrome instead of as a tab bar). The accent DOES appear
  on the 8px unread dot driven by `SidebarItem.count` — that is a badge, not the active state, so
  the "never the identity blue" rule is untouched.

Bar height and row height are density-tracked tokens (`mobileNavBarHeight` 56, `mobileNavRowHeight` 44) with hard floors at 48/44 in `deriveSpacing` — the `1 + 0.1 * level` law would take them to
39/31 at level −3 and silently break the minimum touch target.

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

**Sidebar nav extra (`sidebarNavExtra` on `BasaltShell`, `navExtra` on `AppSidebar`, optional).**
Arbitrary content appended after `sections` inside the nav `ScrollArea`, for a consumer with a
tree/filter panel/project list that doesn't fit `SidebarItem`s (e.g. a note tree, instead of a
second sidebar column beside the shell). Renders as the last child of the scrolling nav column so
it scrolls with the rest of the nav. Hidden on the collapsed desktop rail via CSS (`.navExtra`
under the same `min-width: sm` media query as `.childList`) — never a JS check on `collapsed`,
which is a persisted user preference rather than a viewport fact; the media query is what actually
tells the rail apart from the expanded sidebar. Pass `sections={[]}` to use the slot exclusively;
an empty `sections` produces no orphan divider above it.

## Query branches (`QueryState`, `.`)

**The gap was correctness, not convenience.** basalt owned both ends of the file — `EmptyState` and
`toErrorMessage` — and nothing in between, so a consumer rendering a query wrote the four-way switch
itself and got it wrong in the direction the shape suggested: image-share's library rendered
`No images` on a **500**, and a share detail rendered `Share not found` on a dropped connection,
until 204 hand-rolled lines stopped it. Shipping the empty branch alone steered a consumer into
claiming "nothing here" for "the server failed".

- **A component, not a hook.** The product IS the branch precedence, and a hook hands every call
  site the same four-way switch back. Implemented order: `isError && data === undefined` → error
  page; `data === undefined && fetchStatus === 'idle'` → empty; `data === undefined` → loading;
  otherwise → children (or empty, per `isEmpty`), with a **section-variant banner above them when
  `isError` and cached data exists**. That last branch hardcodes `Showing cached data` /
  `The last refresh failed.` and `variant="section"` — `errorTitle` / `errorFallback` /
  `errorAction` reach the no-data error branch ONLY. Deliberate; don't document them as covering
  both.
- **It lives in `src/dashboard/`, not `src/query/`.** `check-dist-layering.mjs` asserts
  `dist/query/index.js` reaches no `@mantine/*`, and `QueryState` renders Mantine. `query` is typed
  as a five-field structural subset (`QueryStateLike`: `data`, `isError`, `error`, `fetchStatus`,
  `refetch`) rather than TanStack's `UseQueryResult`, so the component couples to no query-library
  version and a composed, derived or hand-rolled result passes with no cast — **3 of image-share's
  10 call sites are exactly that.** **The honest scope of that:** it does not make the
  root barrel `@tanstack/react-query`-free — `src/connectivity/connectivity-provider.tsx` already
  imports `onlineManager` as a value, and the root entry has always required the peer. The JSDoc at
  `query-state.tsx:29` states the stronger claim; it is not true of the barrel today.
- **The subset removes the compiler, so the shape is asserted at runtime.**
  `assertQueryStateLike` throws before any branch on a missing `data` key, a non-boolean `isError`,
  a `fetchStatus` outside `'fetching' | 'paused' | 'idle'`, or a missing `refetch()`. A missing
  `isError` is precisely the "500 renders _No images_" bug, so it must not degrade quietly.
  (`error` is named in the message and is the one field NOT validated.)
- `children` is `ReactNode | ((data: TData) => ReactNode)`, and the function form is invoked only
  when data exists and is not empty. `empty` is `{ title, description?, icon?, action? }`;
  `EmptyState.description` is now optional, which five argo features had been wrapping the component
  to work around.
- `toErrorMessage(err, fallback?)` and `errorStatus(err)` ship on `./query` (split into
  `src/query/error-message.ts` so the dashboard decodes without importing the peer). Both had live
  bugs the port found: an opaque envelope rendered the literal `"{}"` (now the `UNUSABLE` set, with
  an HTTP status folded into the fallback), and `toErrorMessage(undefined)` returned the `undefined`
  VALUE despite a `string` return type.

**Port result — image-share, all 10 call sites plus a standalone `ErrorState`, by changing one
import line each.** Zero renames, zero prop changes, zero casts. Total 2467 → 2221; **code-only
2056 → 1882, −174**; `query-state.tsx` 204 → 0.

## `BasaltDataTable` chrome — the port got LONGER, and that is the finding

New props: `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `meta.align`,
`meta.numeral`, `verticalSpacing`, `horizontalSpacing`, `withRowBorders`, `withTableBorder`, and
`striped` widened to `boolean | 'odd' | 'even'`.

**argo's three tables went 341 → 370–379 lines. 29–38 longer.** argo named these props as the reason the
tables stayed hand-rolled; adding them shortened nothing. Column defs cost more lines than JSX rows
when every cell is bespoke — eight accessor blocks at 4–6 lines each against an eight-`<Table.Td>`
row at ~3. **The ask was mis-specified**, and that is the counterexample to the band kinds: the
port-before-shipping rule earns its keep by producing this number BEFORE the props are sold as a
line saving. What the port does buy is ownership, not brevity — the `type="native"` footgun, the
alignment duplication (`textAlign: 'right'` on both `th` and `td`, six times in one file) and
sorting/filter/pagination stop being consumer-owned.

- `maxHeight` (or `minWidth`) renders **`Table.ScrollContainer type="native"`**; `maxHeight` alone
  passes `minWidth={0}`. `type="native"` is required, not preferred — `ScrollArea`'s custom viewport
  is the positioning context a sticky `<thead>` resolves against, so the default type pins the
  header to the page viewport instead of the table's box. The prop's JSDoc calls this "the same node
  the docs sanction as the raw escape", and **that was not true when it was written**: nothing under
  `agent/rules/` or `docs/` had ever named `Table.ScrollContainer`, and
  `basalt/raw-scroll-container` steers raw `overflow: auto`, not a Mantine component.
  `agent/rules/basalt-data.md` now prescribes the identical node for a bespoke table, which is what
  makes the two lanes provably the same DOM.
- `align` is a `ColumnMeta` module augmentation (`align?: DataTableAlign`, `numeral?: boolean`), so
  a typo'd key is a tsc error and a wrong VALUE throws naming the column. `numeral` is read only as
  `!== false` — an opt-OUT of the mono-numeral cell style, never an opt-in.
- `withTableBorder` is the one prop basalt defaults (`true`, forwarded unconditionally, overriding
  Mantine's `false`); every other new prop is a conditional spread, so omitting it leaves Mantine's
  own default.

**Not shipped, known:** `emptyState` renders inside a `<td colSpan={columns.length}>` so the header
row survives an empty table — there is no `emptyState="replace"` mode, and the span counts the raw
`columns` prop, not visible leaf columns. The empty branch also keys on `data.length === 0`, not on
the filtered row model. basalt adds no per-column sorting prop of its own; TanStack's own
`ColumnDef.enableSorting` still reaches `getCanSort()` and works.

## CLI (`basalt-ui`)

One bin, **named like the package** so `bunx basalt-ui` can never resolve a stranger's package (an
unrelated `basalt` exists on npm — never print `bunx basalt` anywhere):
`basalt-ui init | sync | check-theme | check-coverage | info | doctor | guard-hook | tokens:css |
fonts:css | help` (Bun runtime). Every subcommand takes `--help`/`-h`; `check-theme`, `doctor` and
`sync` honour `BASALT_CWD` and relocate to the single workspace package carrying a basalt config when
invoked from a repo root that has none (two candidates is reported as ambiguous, never guessed).

**`resolveProjectDir` ascends as well as descends, and announces both the same way.** Order:
`BASALT_CWD` → cwd itself → declared workspace packages → `descendantProjects` (depth 2) →
`ascendantProject` → cwd unchanged. The ascend was the last silent hole: from a package with no
`basalt` key, `check-theme` used to **fabricate** `roots: ["src"]` and report the invention back
under the name `basalt.roots`. From `basalt-ui-obsidian`'s `apps/demo` that scanned **22 of the
repo's 44 guarded files, printed a clean pass, and made `--audit-allows` report 0 live waivers in a
repo carrying 1** — exit 0, no note. The audit exists so that `0 dead` cannot read as `0 dead
anywhere`; it could be made to say zero by standing in the wrong directory. `ascendantProject` walks
up to the nearest ancestor that carries a manifest **or** a `package.json` `basalt` key
(`hasBasaltProject`), bounded inclusively by `findRepoRoot`. **No `.git` above cwd means no ascend**,
so a standalone unconfigured consumer keeps the built-in defaults exactly as before. Ascend and
descend share one sentence per command — only the rendered relative path differs (`./web` vs
`../..`).

**`sync` shares the resolver, so it ascends too.** From a sub-package it relocates to the parent
install and refreshes it, announced, rather than refusing. It still **cannot scaffold a second
consumer**: the refusal is keyed on the RESOLVED directory and runs before the `basalt.roots`
backfill, so an unscaffolded project is still an exit 1 naming what it would have written.

**Nothing fails open.** `--version` / `-v` / `version` print one bare greppable line and exit 0,
resolved before dispatch alongside `--help` so answering "which basalt-ui is this" can never run a
command. Every subcommand then validates its flags against `COMMAND_FLAGS` and exits 1 naming the
first one it does not accept — `doctor --json` used to run doctor and exit **0**, and `check-theme
--audit-allow` scanned and reported success. An unknown COMMAND prints `basalt-ui: unknown command '…'` above
the usage block rather than dumping help and letting it read like a choice.

**Every invocation the CLI EMITS goes through `basaltBinCommand()`** — the seeded `lint` script, the
CI steps, the `.claude` PreToolUse hook, doctor's lefthook advice. It renders the resolved local bin
(`./node_modules/.bin/basalt-ui`) and falls back to `bunx basalt-ui` only when nothing resolves.
`bunx` does not re-resolve a cached package, which is how a consumer filed a P0 against a 1.20.0
cache while pinned to 1.22.0 — and the seed was shipping `bunx` into consumer CI in ten places.
`configs/lefthook.yml`'s `${BASALT_BIN:-bunx --no-install basalt-ui}` default stays: `--no-install`
fails loudly rather than downloading a stranger, and `BASALT_BIN` is the sanctioned override.

- `check-theme` — **real**. Port of argo's theme guard; fails on colors bypassing the central
  palette. **Findings carry a severity** (`warn` | `error`): errors fail the build, warnings report
  and pass, and the PreToolUse `guard-hook` denies only on errors. Consumers override per kind via
  `basalt.severity` — down, to upgrade now and migrate later, or up, to take a grace-period kind's
  enforcement immediately. Severity is not an off switch; each kind already has its own boolean and
  `exemptRules` scopes it to paths. Reads config from the consumer package.json `"basalt"` key
  (`{ roots?, exempt?, include?, profile?, severity?, exemptRules?, spacingSteps?, forbiddenAccents? }`);
  default root is `src`, `sync` backfills `roots` when absent and never
  overwrites a declared value, and a scan that matches zero files fails loudly. `exemptRules` takes
  relative paths, directory prefixes, globs and `{ paths, reason }`, and reports a pattern that
  suppressed nothing. `--audit-allows` proves what each waiver still suppresses by re-running the
  scan with that one occurrence neutralized, and exits 1 on a dead one. It runs BOTH halves: a
  guard-kind annotation is re-checked by `checkSource`, a plugin-rule annotation by re-running
  oxlint over one neutralized sibling file (no stdin mode; removed in a `finally`). Where oxlint is
  unreachable the verdict is "cannot judge", never "dead" — and the report prints the scope it
  audited, since `0 dead` over `basalt.roots` is not `0 dead anywhere`. It does NOT yet audit
  `basalt.exempt`, and its `scoped to …` line does not distinguish `theme-allow` from
  `theme-allow-file`. Consumer lint =
  `oxlint . && basalt-ui check-theme`, which `init` seeds as the `lint:basalt` script.
  **Scan reach beyond `roots`**: each root's PARENT contributes its `index.html` and its `public/`
  tree (the Vite layout `basaltViteConfig` assumes) — argo's raw hex lived one level up from its
  configured root. **Four guard syntaxes** (`guardSyntaxFor`): `.css` → `css`;
  `.html`/`.htm`/`.webmanifest`/`.json` → `markup` (`MARKUP_KINDS` — `raw-hex`, `raw-color-fn`,
  `raw-font-family`, 3 of the 25); `.astro`/`.vue` → **`sfc`**; everything else, `.jsx` included,
  → `ts`. `sfc` strips the markup region and then the script region — markup FIRST, so an HTML
  comment holding an unterminated `/*` cannot open one that runs to EOF — and keeps the **full
  25-kind set**: an `.astro` template is JSX-shaped and a `.vue` `<script setup>` is real TS, so
  classifying them as `markup` would have dropped 22 kinds. Both call sites (`checkSource`,
  `findAllowAnnotations`) go through one `stripGuardComments`, so the scan and `--audit-allows`
  cannot disagree about what a comment is. `.json` is never blanket-scanned; `basalt.include` names
  one explicitly and is the only route to it (`SCANNABLE_EXT` is
  `tsx?|jsx|astro|vue|css|html?|webmanifest`).
  **Two `sfc` limits, asserted rather than left ambiguous, both false-NEGATIVE-only**:
  `css-raw-surface` and the kebab-CSS kinds do not fire inside a `<style>` fence (that branch keys
  on `syntax === 'css'`, and an SFC is one file with three dialects), and stripping is region-blind,
  so a `<!--` inside a script string over-strips. Pinned in `check-source.test.ts` § `known limits`.
  **`raw-hex` no longer reads an HTML numeric character reference as a colour** — `&#123;` used to
  report `#123`. The hole was in the KIND, not the extension (the same string fired in `.html`,
  `.tsx` and `.css`); `.astro` only walked into it first. The exclusion is precise, not blanket:
  `HEX` rejects a full reference — `&#`, digits, `;` — so `color: red&#fff` still flags and nothing
  is exempted by file type. No sibling kind shares the blind spot and none structurally can: a
  character reference contains no `(`, and every other raw-text kind anchors on a property name,
  `var(`, or a JSX `=`.
  **A known non-fix, deliberate:** an all-hex URL fragment or SVG reference (`href="#cafe"`,
  `fill="url(#abcdef)"`) still reports. It is text-indistinguishable from a colour, so the fix would
  cost real findings; `theme-allow` is the escape. JSDoc-only — no test pins it.
  **`profile: 'tokens-only'`** disables the 17 kinds whose remedy is a Mantine component, prop or the
  React theme factory. `check-theme` requires it DECLARED (the key, or `--tokens-only`) and never
  infers it: inferring from a missing `@mantine/core` would silence those kinds on any repo keeping
  Mantine in a different workspace package. `doctor` DOES infer it, because its profile only changes
  which advice it prints, never what it enforces — and it names the key to write down. The asymmetry
  is the safety property, not an inconsistency.
  **Basalt-emitted lines are skipped — LINES, not files.** The file has to earn the exemption
  (a `.css` path, the canonical `@generated basalt-ui` header verbatim on line 1, the provenance
  line on line 2), and then each line has to earn it too: at brace depth 0 a selector or a
  self-closing comment, inside a block only a `--vx-*` / `--basalt-*` declaration whose value
  carries no `;`, a `}`, or a comment. That is what stopped the guard reporting 116 violations
  inside the stylesheet `tokens:css` had just written. The marker on its own (first 5 lines, any
  extension) was a hand-writable whole-file bypass; a whole-file body test replaced it and was
  itself forgeable twice over (a `;` inside a custom-property value, a comment that never closed).
  Per-line + depth-aware is the fix: a declaration only takes effect inside a block, so inside a
  block nothing but basalt's own custom properties is skippable, and a miss now costs one line
  instead of the file. A line carrying `theme-allow` is never skipped.
  **Footgun: `check-theme` (and `pre`, which runs it) validates the last BUILT `dist`, not the
  working tree.** `bin/basalt-ui.mjs` imports `../dist/cli/index.js` — a source change under
  `src/guard/**` or `src/cli/**` is invisible to `check-theme` until `bun run build` runs, and a
  stale `dist` can make `bun run pre` report green over source it never read. Run `bun run build`
  before trusting `check-theme` after touching `src/guard/` or `src/cli/`.
- `init` / `sync` — **real**. **`sync` refreshes an EXISTING install and refuses to create one**: it
  resolves its project exactly as `check-theme`/`doctor` do and exits 1 when the resolved project
  has no `.basalt/manifest.json`, naming the install it found above — the refusal runs BEFORE the
  `basalt.roots` backfill, which was half the damage when it scaffolded a competing install into
  `apps/dashboard` beside the real one. `created` and `recreated` are separate counters; `recreated`
  means the ledger placed that file once and it went missing. Two ownership modes, decided by one
  question — _does Claude read this file?_ **managed** (three-way reconciled; local edits skipped unless `--force`; the CLAUDE block
  is managed with markers): `.claude/rules/basalt-*.md`, `.claude/skills/basalt-*/SKILL.md`, the
  CLAUDE.md block. **seed** (written once, then consumer-owned; recreated only when missing):
  `DESIGN.md`, `.oxlintrc.json` + `lefthook.yml` (extends-stubs into
  `node_modules/basalt-ui/configs/`), `.oxfmtrc.json`, `.github/workflows/check.yml`, optional
  scaffolds. Reconciled against `.basalt/manifest.json` (sha256 per managed unit + basaltVersion);
  `--check` is the CI drift gate. Contract tests: `src/cli/placement-engine.test.ts`.
  Two of the seeds are **repo-root-shaped**, not package-shaped: `lefthook.yml` and
  `.github/workflows/check.yml` are read only from the repo root by their respective tools, so both
  `init` and `sync` walk up from `cwd` for the nearest `.git` and skip both (printed notice, exit 0)
  when the package isn't that root — writing them into a monorepo subdirectory nothing reads risks
  clobbering the real root's own config instead. `src/query-client.ts` gets the same treatment for
  a different reason: when a `query-client.ts` already exists anywhere else under `src/` (the
  consumer relocated it), the seed is skipped and the notice names the found path instead —
  re-seeding at the original location used to shadow a relocated client that sets real query
  options (`staleTime`, `refetchOnWindowFocus: false`) behind one wrong import. All three are
  notices, never errors; zero behaviour change when the package IS the repo root.
- `check-coverage` — **framework-internal only**, a self-consistency gate for the basalt-ui repo
  itself (asserts SURFACES ↔ rule files ↔ skill files ↔ package.json exports); not a consumer
  command.
- `info` (+ `--json`) — prints the published surface map; `--json` emits a stable JSON form.
- `doctor` — the wiring gate. **`SKIPPED` is a third outcome beside pass/warn/fail and exits
  non-zero on its own**: under bun's isolated linker doctor silently dropped 2 of 5 checks and still
  printed "All checks passed", so that footer is now only printable when every check RAN and passed.
  Hard checks: **`basalt-resolves`** (walks cwd → ancestors → workspace packages; when basalt does
  not resolve, every version check is unrunnable, `extends: [<preset>]` cannot resolve, and
  `bunx basalt-ui` silently fetches a different copy from npm), **`guard-scan`** (would `check-theme`
  cover more than zero files? — check-theme already exits 1 on that, and doctor disagreeing with it
  in the same repo WAS the bug), **`oxlint-preset`** (does `.oxlintrc.json` actually extend the
  shipped preset? `init` keeps an existing config, so one repo ran five minors with the whole lint
  half off; JSONC is parsed, not rejected), **`lefthook-preset`** (does a pre-commit gate EXIST? —
  asked via `lefthook dump`, which resolves `extends`, `include` and per-command `root:`, NOT by
  matching the config text for an extends string: linewatch wires all three jobs with `root: 'web/'`
  because `extends` merges commands without their working directory, and a text match warned at a
  correctly configured repo with advice that would have broken it. A broken `extends` target is
  still a hard fail — lefthook merges a missing target into ZERO commands and exits 0 — a provably
  absent gate is a warn, and an unresolvable one is an advisory warning naming what it could not
  see), plus the three below. **From a package whose install is ABOVE it, doctor names the parent and
  says `basalt-ui init` is NOT the fix** — one sentence shared with `sync` via `parentInstallAdvice`,
  because the two already shared `resolveProjectDir` but not the advice, and following doctor
  literally performed the second-consumer scaffold 1.22.0 exists to prevent. Its **icon warn reads
  `basaltAppPlugin({ icons })` out of the consumer's vite config** rather than hardcoding six
  filenames (`readAppIconsOption`): a named array is checked against itself, `false`/`[]` is nothing
  to check, and an unparseable or absent config falls back to the six defaults — so adopting 1.23.0's
  icons array stopped being a way to earn a warning. **That check used to read cwd alone, which made
  it unreachable from the only directory where `doctor` exits 0**: on rb's and argo's layouts
  `vite.config.ts` lives in the app package, so the root run omitted the line entirely — with no
  `⊘ SKIPPED`, which is the exact failure mode `SKIPPED` was introduced to eliminate — while the
  app-package run failed on two artefacts of standing in a non-install package. `findAppPluginDir`
  now resolves the app package off `basalt.roots`, walking each root back up toward cwd and never
  past it, and reports the absence rather than hiding it: **no `basaltAppPlugin(` anywhere and no
  `public/` is a PASS that says so; a plugin call with no `public/` beside it is a `⊘ SKIPPED`**,
  which exits non-zero on its own. Framework profile only. A tokens-only consumer is
  auto-detected (no manifest + no `@mantine/core`; `--tokens-only` / `--framework` force it) and is
  no longer told to run `init` — which also makes the CLI-vs-installed version check reachable in
  CI. **Version**: installed `node_modules/basalt-ui` vs the manifest's `basaltVersion` (plus
  manifest presence and a stale-`bunx` CLI-version warning).
  **Spacing scale**: `deriveSpacing(0).scale` vs the manifest's `spacingScale`, stamped by
  `init`/`sync` — skipped outright when the running CLI's version and the installed one disagree,
  since the CLI's scale is then not the one the app renders with and a "matches" would be a false
  pass. This one is the only check that reports a change in RENDERED OUTPUT rather
  than in placed files — a retune of the spacing bases moves every surface in an app calling
  `createBasaltTheme()` bare, and since majors are banned the version number cannot say so. The
  1.2.0 retune shipped as "tighten the sidebar, open up components" and sat unverified in the one
  consumer's production for a day; this makes the move something a consumer is told rather than
  something they have to notice in a subject line. **`ai-major-parity` (1.10.0, HARD failure, not a
  warning)**: every workspace package that declares the `ai` package agrees on its major version —
  doctor walks every manifest under the consumer repo's `workspaces` globs and exits non-zero on a
  skew, e.g. one package streaming on `ai@5` while another parses it on `ai@7`. This is
  CROSS-PACKAGE by construction, which is exactly why the `basalt/ai-sdk-major` oxlint rule cannot
  replace it: a lint run is scoped to one file's nearest `package.json`, so it only ever sees that
  package's own declared `ai` major and passes even when a sibling workspace package disagrees.
  Skipped entirely when `cwd` has no `workspaces` field or none of its packages declare `ai`. A
  detected skew is declarable, not just fatal: `basalt.aiMajorSkewReason` in the consumer's
  package.json exempts an INTENTIONAL pairing (argo's real one — the api app on ai@5, the dashboard
  app on ai@7, neutralized by a producer-side `TransformStream`), and doctor passes while echoing
  both the detected skew and the declared reason verbatim. The reason is mandatory — the
  value IS the reason string, so a bare `true` (or an empty string, or any non-string) is rejected
  and hard-fails exactly like an absent key, with a message saying so. A declared reason that
  outlives its skew (the majors later agree) is stale config, not a clean pass: doctor warns that
  the exemption can be deleted rather than passing silently, so a real skew that returns later isn't
  masked by a leftover declaration nobody re-checks.
- `guard-hook` — PreToolUse theme-guard adapter: reads a Write/Edit payload on stdin, denies
  off-palette writes. Register it in `.claude/settings.json` under `hooks.PreToolUse` with matcher
  `Write|Edit|MultiEdit` and command `./node_modules/.bin/basalt-ui guard-hook` — what `init` now
  seeds, via `basaltBinCommand()`.
- `tokens:css` — emit the `--vx-*` stylesheet (stdout, or `--out <path>`). Flags:
  `--selector-attribute` / `--selector-class <class>` (+ `--light-class`) / `--dark-value` /
  `--light-value` / `--default-scheme <dark|light|none>` / `--media-fallback` / `--only <core|all>` /
  `--no-legacy-aliases` / `--check`. No flags → byte-identical to the shipped `basalt-ui/tokens.css`.
  Token VALUES come from `buildPaletteCss` and only from there — the CLI and the API must not be able
  to disagree about what basalt's tokens are (`src/cli/tokens-css.test.ts`). What the command adds on
  top is **file framing for an artifact a consumer COMMITS**, and nothing else: the
  `@generated basalt-ui` marker as line 1 — imported from the guard as `GENERATED_HEADER_LINE`, one
  source of truth rather than the two hand-kept copies it replaced — version + invocation as line 2,
  a trailing newline, and `rgba()` argument spacing normalized to the spaced form. **`--check`
  neutralizes only the VERSION TOKEN of line 2** (`withoutProvenanceVersion` splices a `<version>`
  sentinel through the 3-group `PROVENANCE_VERSION` regex). Gating the file byte-for-byte made every
  basalt release a mandatory no-op commit in a tokens-only consumer, where byte-equality IS the
  gate — but 1.23.1 blanked the whole line, and line 2 also carries **the exact invocation line 1
  tells the reader to regenerate with**. Rewriting `--only core --no-legacy-aliases` to
  `--only all --with-legacy-aliases` passed clean. A line that fails to parse as a provenance line
  is now compared verbatim, so a deleted or reworded header fails instead of being blanked into
  agreement. The success message **parses** both versions and names them, and orders them only when
  the semver triples order (`describeVersionSkew` → `'a different'` otherwise) — it used to assert
  the file "still names an older basalt-ui" without reading it, so `0.0.1-nonsense` got the same
  sentence. The guard keeps its own copy of the shape as `GENERATED_PROVENANCE_LINE`
  (`src/guard/index.ts`, unexported) so the `@generated` line-skip exemption holds against the same
  grammar.
  `--selector-class` is the one
  structural rewrite — `buildPaletteCss` emits attribute selectors only, so the class form is
  produced by emitting against a CLI-chosen sentinel attribute and rewriting exactly those
  selectors; there is no `scheme: { class }` API. All of it was reported by the one framework-free
  consumer as the reason the output could not simply be committed.
- `fonts:css` — emit the shipped `--basalt-font-*` stacks as plain CSS (`--out`, `--check`). Read
  out of `styles.css` itself, so the two can never name different typefaces. It is the only route to
  basalt's typefaces for a consumer that declines the Mantine-coupled `styles.css`.

### Shipping a stricter guard — the grace minor

**A change that makes the guard reject code it previously accepted ships `warn` for one minor, then
promotes to `error`.** That covers a new `GuardKind` and an existing kind reaching a new file type
(1.2.0's CSS-module scan was the latter, and it is the reason this rule exists).

Mechanically: add the kind to `GRACE_PERIOD_KINDS` in `src/guard/index.ts` with its promotion note
in the same commit that ships it; deleting that entry one minor later IS the promotion, and belongs
in its own commit so the changelog reads "enforcement got stricter".

**A `SCANNABLE_EXT` widening is outside the mechanism, by design — do not force one into it.**
`GRACE_PERIOD_KINDS` is keyed per KIND; widening the file set widens all 25 at once, so there is no
kind to key an entry on. The nearest one is whichever actually fires, and adding `.astro`/`.jsx`/
`.vue` fired `raw-hex` — an entry for it would demote basalt's most load-bearing kind to `warn` in
every `.tsx` and `.css` in all seven consumers for a minor, to buy runway on a file type one
consumer has. Measured before shipping at `error`: rollhook's marketing site scans 6 files with 0
findings, and **no other consumer holds a single `.astro`, `.vue` or `.jsx` file** — grace would
have covered zero incumbent violations. Widen at `error`, but only after measuring the incumbent
violations across every consumer; if the count is nonzero the answer is fixing them, not a table
entry that cannot express the case.

**A rule the current minor WIDENS does not promote in that same minor.** Widening is a strictness
change, so it restarts the grace — promoting a widened rule in the minor that widens it is the one
thing this doctrine exists to prevent. 1.20.0 widened `hand-rolled-plot` and `chart-legend-literal`,
so both stayed `warn`; `raw-size-literal` was untouched and unviolated in all seven consumers, so it
promoted to `error`. 1.21.0 widened `hand-rolled-plot` again (the `theme-allow-file` split) and
`shadow-basalt-export` (all nine barrels), restarting grace for both. 1.22.0 NARROWED
`shadow-basalt-export` again — `isBasaltScopedFile` plus a component-shaped declaration — which does
not restart anything.

**The same rule governs the oxlint plugin, which now has its own ledger: `PLUGIN_RULE_GRACE`**, a
named export beside the plugin in `configs/oxlint-plugin.js` (it cannot live in `oxlint.json` — that
file's top-level keys are fixed by oxlint's parser). A test asserts it against the shipped preset in
BOTH directions, so deleting an entry forces the level flip in the same commit and a rule cannot sit
at `warn` for twelve minors with nothing tracking it again. Read the promotion state there; never
restate the list in prose. A new plugin rule ships `"warn"` in `configs/oxlint.json` (the consumer
preset) and `"error"` in the repo-local `.oxlintrc.json` — basalt fixes its own violations
immediately, consumers get a minor's runway. Promotion is flipping the shipped level, in its own commit. Corollary, and the reason
`raw-size-literal` is a separate rule rather than three extra lines inside `no-raw-font-size`: an
existing `error` rule cannot be widened to catch a new form, because a rule level is per-id and the
widened form would land as `error` on upgrade with no grace at all. Catching a new form means a new
rule id.

The justification is specific to this package, not general caution. **Majors are banned here by
design** — 1.x absorbs breaks — so a consumer has no semver channel telling them enforcement
tightened, and the guard is the one part of basalt that can hard-fail their build. Landing a kind as
an error turns a routine minor upgrade into an unplanned refactor: 1.2.0 cost the one real consumer
eleven `theme-allow` comments and 1.3.0 had them delete all eleven, for a net-zero source change
across two commits and two production deploys.

**This doctrine governs only changes that make enforcement STRICTER — a relaxation needs no
`GRACE_PERIOD_KINDS` entry.** `inline-display` and `raw-html-layout` no longer fire inside
`src/charts/**`: both remedies name a Mantine layout primitive (`Box`/`Flex`/`Grid`/`Stack`/
`Group`), which the Mantine-free chart layer (`basalt/token-layer-boundary`) already forbids there
— so inside a chart file the finding was unactionable, and the only "fix" was a `theme-allow`
comment written inside the very directory the boundary protects. `appliesTo` for both kinds now
excludes chart files (`isChartFile`, shared with the boundary rule's own path scoping). This also
deleted basalt's own `package.json` `exemptRules` `primitives` entry for both kinds — that private
self-exemption is what hid the unactionable-finding problem from the framework while every consumer
ate it; basalt now passes `check-theme` for the same reason a consumer does, not because it
silenced itself. Do not add a `GRACE_PERIOD_KINDS` entry for a relaxation like this one.

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
- `basalt/raw-size-literal` — flags a CSS-length STRING on a `size`/`fz`/`fontSize` JSX attribute
  (`<Text size="10px">`, `<ThemeIcon size="2rem">`). Its own rule id rather than a widening of
  `no-raw-font-size`: `size` is a box dimension on icon components and a font size on `Text`, so one
  shared id would let a consumer silencing the former also silence the latter — and a separate id can
  ship `warn` for its grace minor (see "Shipping a stricter guard" below) where widening an existing
  `error` rule could not. Numeric `size={32}` is deliberately not flagged (the documented Mantine
  icon idiom).
- `basalt/card-inset` — flags a `Card`/`Paper` carrying an explicit `p`/`padding`/`radius`, or a
  `py`/`px` off the `xs`/`sm` inset idiom.
- `basalt/chart-in-raw-surface` — flags a chart-kind element (`BandStrip`, `Bars`, `Donut`,
  `DualPanel`, `Heatmap`, `MirroredBars`, `MultiLine`, `StackedArea`, `ZonedLine`, `BarSparkline`,
  `LineSparkline`) rendered inside a raw `Card`/`Paper` instead of the shipped `ChartCard` wrapper.
  Its guard-side twin is **`chart-missing-aria-label`** (`CHART_ENTRY_POINT_TAG`,
  `src/guard/index.ts`), which carries the same tag list; adding a kind means both.
  **`cb4e5b7` says it taught `unframed-chart` the two new kinds. It did not** — that commit widened
  `CHART_ENTRY_POINT_TAG`, and `unframed-chart` keys on `<ChartLegend items={[` with no kind list at
  all. The message is on `master` and cannot be rewritten; this is the correction.
  **Both tag rules are provenance-gated**: a tag is skipped only when the file DEFINES a
  component of that name and does not also import it from `basalt-ui`. One-directional on purpose —
  a basalt import, a consumer barrel re-export, and an unattributable tag all still fire; requiring
  a POSITIVE basalt import would have switched both rules off for every barrel-wrapping consumer and
  every file with no imports. Verified old-vs-new over 945 files across six repos: 0 findings lost,
  0 gained. **The gate does not make the tag list redundant** — the list still answers _which_ tags
  owe an `ariaLabel`; the gate only turns a kind missing from it into an under-report instead of a
  false positive. Collapsing `CHART_ENTRY_POINT_TAG` and the plugin's `CHART_TAGS` into one source
  is an open question, not a plan.
- `basalt/hand-rolled-plot` — flags a chart-assembly primitive (`AxisLeftNumeric`,
  `AxisRightNumeric`, `AxisBottomDate`, `HoverOverlay`, `Crosshair`) rendered in a file that does
  not compose `CartesianChart`. **Composing `CartesianChart` is the contract for a single-plot
  cartesian chart, not a suggestion** — it owns the measured margins, both y scales and their
  domains, the axes, grid, the shared cursor, the crosshair and the derived tooltip, and
  hand-assembling those is precisely how two charts stop matching (`docs/CHARTS-SPEC.md`). Only the
  EVERY assembly node is reported and waived on its own (`theme-allow hand-rolled-plot — <why>`);
  a decision about the whole file is spelled `theme-allow-file hand-rolled-plot — <why>`, which is
  the 1.21.0 grammar and required — 1.20.0 silently promoted the node form. A genuinely
  non-single-plot shape is that exception and composes `ChartFrame` + `useChartCursor` +
  `autoMargin` + `ChartTooltipFloat` instead — five of them now (multi-pane `DualPanel`,
  two-bar-pane `MirroredBars`, y-less `BandStrip`, radial `Donut`, matrix `Heatmap`), of which
  three carry a file declaration: `Donut` and `Heatmap` render no assembly primitive, so nothing
  fires and there is nothing to waive. The module that DEFINES `CartesianChart` is exempt by
  declaration detection, not by path: a rule saying "compose X" cannot fire inside X. That is definitional, and
  deliberately not the self-exemption habit that let the 1.4.0 regression reach consumers.
- `basalt/chart-legend-literal` — flags a hand-written array literal passed to `ChartLegend`'s
  `items`. The legend must be DERIVED from the same `series` the chart draws (`deriveLegend`, or
  just let `ChartFrame`/`CartesianChart` do it); a parallel hand-authored list is a second source
  of truth that goes stale silently, still naming a series the plot no longer draws.
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

The six design-guard rules support the same `theme-allow` escape as `src/guard`, and the same
two-scope grammar: an annotation at the START of a comment on the flagged node's own line or the
line above scopes to THAT node, and `theme-allow-file <id>… — <why>` anywhere in the file scopes to
the file. **The two parsers must agree on what an annotation IS, and may differ only on which rules
each can judge.** Five holes in four rounds. The previous round's answer — a thirteen-shape list of
"every shape a consumer actually writes", plus the claim that the two parsers could therefore no
longer disagree — was **false when it was written**: a hand-collected list of anecdotes cannot close
a contract, and enumerating the axes instead found three more holes, only one of them the one that
got reported.

The grid is now generated from the four axes that actually vary — comment style × token position ×
where the closer falls × what follows — and pinned row name for row name in BOTH
`src/guard/check-source.test.ts` (37 supported + 8 asserted-unsupported) and
`configs/oxlint-plugin.test.ts` (32 + 8). The plugin's grid is five rows shorter because five rows
are dialects only the guard scans (CSS trailing, CSS reflowed onto continuation lines, HTML
own-line, HTML trailing, the JSON member form). **Asserting the unsupported cells is the point** —
it stops "unsupported" and "silently broken" reading the same. Add a shape to one file and it goes
in the other in the same commit.

The three boundary rules above deliberately do **not** — an architecture boundary a stray
comment can switch off is the silent bypass they exist to prevent. Turn one off by name or not
at all.

## Shipping a rendering change — what a minor may move

Majors are banned here, so the version number can never warn a consumer that their charts will look
different. This is the rule that replaces it, and the sibling of "Shipping a stricter guard" above.

- **A change that moves rendering for EVERY chart ships as an opt-in prop defaulted to the OLD
  behaviour.** `AxisConfig.nice` is the reference case: niceing a scale is better, and it still
  defaults `false`, because turning it on would move the domain of every already-migrated chart.
- **A change that moves rendering only for charts passing a specific opt-in prop, AND restores a
  documented or internally-consistent law, may ship as a plain `feat:`** — with the measured
  before/after in the commit body, the release notes and the consumer handover, plus a named
  opt-out. `autoMaxFloor`'s clamp order is the reference case.
- The line is **blast radius plus correction-vs-preference**, not how much better the new behaviour
  is. "It's obviously right" is not a licence to move every chart.

**And the rule that would have prevented the case which produced this section: a rewrite that
reimplements an existing law must pin that law with a test BEFORE the rewrite.** `autoMaxFloor` was
clamp-then-pad through 1.13 (`Math.max(safeMax, yAutoMaxFloor ?? safeMax) * yAutoPad`, per kind).
The 1.15 `CartesianChart` rebuild reimplemented it as pad-then-clamp and **nobody noticed** — there
was no test on the ordering, only on the padding's sign-safety. It shipped as a silent behaviour
regression, survived a full release, and was found only when a consumer proved the divergence
numerically two minors later; 1.17 restored 1.13's law. From outside, that reads as the semantics
moving twice in five minors, and the cost to a consumer is identical either way: every hand-written
domain function reproducing one ordering became dead weight. `padAutoLower` came through the same
rebuild unchanged precisely because its law WAS pinned by a test.

## Development Guidelines

- Strict TS, no `any`, explicit types on public exports; typed object params, low nesting, early
  returns.
- Function components only; no `React.FC`, no default exports.
- Respect the Mantine-free boundary and the `@visx/*`-only-in-charts rule.
- Don't reintroduce Tailwind, OKLCH foundation palettes, ShadCN/Tremor/Starlight compat, or any
  `import.meta.env` reference in shipped code.
- When extending the public API, keep it grounded in the argo source it was extracted from, and
  update this file in the same commit.
