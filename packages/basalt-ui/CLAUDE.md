# Basalt UI — Package

**Inherits from**: `../../CLAUDE.md` (monorepo conventions).

The only published package (npm: `basalt-ui`, v1.0.0). An opinionated framework for Mantine-based
React apps, extracted from argo: a Mantine theme + `cssVariablesResolver`, a `BasaltProvider`, an
app shell, a visx chart system, a three-tier `--vx-*` token system, a theme-lab, a Vite preset,
raw toolchain config presets, and a `basalt` CLI.

> The old Tailwind CSS theme (OKLCH foundation palette, ShadCN/Tremor/Starlight compat,
> typography plugin, spacing-restriction strategy) is **gone**. Breaking 1.0 (`feat!:`), same npm
> name; `./css` and `./starlight` exports dropped.

## Staged migration (READ FIRST)

This is **S0** of a 5-stage argo extraction (S0 pivot → S1 toolchain → S2 charts/tokens →
S3 theme → S4 shell → S5 agentic + vite). `src/**` is currently **compiling stubs** with
argo-grounded, stable signatures — real bodies land in S2–S4. The public API shapes documented
below are real; their implementations are placeholders. Plan against `../../docs/BLUEPRINT.md`.

## Published surface (subpath exports)

| Subpath        | Mantine? | Contents                                                                                                                                                                     |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`            | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + sidebar / mobile-nav / breadcrumbs / page-header, `NavCountBadge`, shell types |
| `./charts`     | **free** | visx primitives / kinds / sparklines / hooks (re-exports the token layer too)                                                                                                |
| `./tokens`     | **free** | `VX`, `alpha`, `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `ColorPair` / `SeriesMap` types                                                             |
| `./theme-lab`  | coupled  | `ThemeLabControls`, `applyOverrides`, `COLOR_GROUPS` (parameterized)                                                                                                         |
| `./vite`       | —        | `basaltViteConfig(opts)`                                                                                                                                                     |
| `./styles.css` | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                |
| `./configs/*`  | —        | raw toolchain presets (real file paths — `extends` needs them)                                                                                                               |

Named exports only — **no default exports**. Files `kebab-case`, components `PascalCase`.

## Layering: Mantine-coupled vs Mantine-free

- `src/charts/**` and `src/tokens/**` are **Mantine-free** — zero `@mantine/*` imports.
- `@visx/*` may **only** be imported inside `src/charts/**`.
- Both rules are enforced by oxlint `no-restricted-imports` — repo-local AND in the shipped
  consumer oxlint preset, so the boundary holds for downstream apps too.
- The root barrel (`.`) does **not** re-export `./tokens` / `./charts`, so a charts/tokens-only
  consumer never pulls in `@mantine/*`.

## Build (dist-first, unbundled)

```bash
bun run build
# = tsup && cp src/styles.css dist/styles.css && tsc --emitDeclarationOnly --declarationMap
```

- **tsup** with `bundle: false`, `splitting: false`, `dts: false`, `entry: src/**/*.{ts,tsx}`,
  `loader: { '.css': 'copy' }` — transpiles each module in place, mirroring the `src/` tree to
  `dist/` so subpath exports resolve to real files. `bundle: false` alone only emits entry modules
  and drops CSS, so the glob entry + `splitting: false` are required.
- `loader: { '.css': 'copy' }` copies component-imported `*.module.css` verbatim and rewrites the
  import path (the S4 CSS-modules path). `src/styles.css` is imported by no module, so the build
  script **copies it explicitly** — don't remove that `cp`.
- **tsc owns declarations** (`--emitDeclarationOnly --declarationMap`) — running tsup's `dts` too
  fights it. `.d.ts` + maps ship alongside.
- The tarball ships `dist/` + `src/` + `configs/` + `bin/` so go-to-definition lands in real source.
- **Never use `import.meta.env`** (Vite-only) in shipped code — use `process.env.NODE_ENV`.
- The **pack-test** (`bun pm pack` + scratch-install) is the dist gate in CI; the playground only
  exercises `src/`, never `dist/`.
- tsup is in maintenance mode (upstream → tsdown). The CSS-copy behavior is the load-bearing piece
  and works today — **re-evaluate tsdown before S4's CSS-module work, behind the pack-test**.

## Dependencies

- **deps**: 8 `@visx/*` pinned **exact** at `4.0.0-alpha.11` (`axis`, `curve`, `event`, `grid`,
  `group`, `scale`, `shape`, `threshold`). No stable visx 4 exists — exact-pinning IS the
  hardening; a stable bump becomes a coordinated minor.
- **peers**: `react` / `react-dom` `^19`; `@mantine/core` + `@mantine/hooks` `^9.3`;
  `@mantine/dates` optional.
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

## Theme & provider surface (`.`)

- `baseTheme` — Mantine `createTheme` base (Blueprint-anchored: `primaryColor`, `primaryShade`
  light/dark, owned spacing/radius scales, named `fontWeights` ladder, mono font, `autoContrast`).
  Full 10-shade ramp reskin lands in S2.
- `createBasaltTheme(overrides?)` = `mergeThemeOverrides(baseTheme, overrides)`.
- `cssVariablesResolver` — binds Mantine's surface system to the same `--vx-*` vars the charts
  use, so chrome and charts share one scheme-reactive identity. Exported and pre-wired in
  `BasaltProvider`.
- `BasaltProvider` — wraps `MantineProvider`, injects the palette `<style>` (`injectPalette={false}`
  escape hatch for SSR/head injection), bridges the Vx tokens.

## App shell (`.`)

`BasaltShell` composes `AppSidebar` / `MobileNav` / `AppBreadcrumbs` / page-header
(`PageHeaderProvider` / `PageActions` / `PageActionsOutlet`). Brand, `SidebarSection[]`, a
`globalActions` slot, footer/settings extras; collapse persisted via `@mantine/hooks`
`useLocalStorage`. Router-agnostic — badge/active/navigate wiring stays consumer-side; ship
`NavCountBadge` for the count-badge pattern. No zustand, no router adapter.

## CLI (`basalt`)

One bin: `basalt init | sync | check-theme` (Bun runtime).

- `check-theme` — **real**. Port of argo's theme guard; fails on colors bypassing the central
  palette. Reads config from the consumer package.json `"basalt"` key
  (`{ roots?, exempt?, spacingSteps?, forbiddenAccents? }`); argo's hardcoded values are the
  defaults. Ships as `bunx basalt check-theme`. Consumer lint = `oxlint . && basalt check-theme`.
- `init` / `sync` — **S5 stubs** (scaffold rules, settings stanza, CLAUDE.md block, toolchain
  templates; sync does three-way diff). Not functional yet.

## Toolchain (oxlint + oxfmt — not Biome/Prettier)

oxfmt style: single quotes, **no semicolons**, `printWidth` 100, `trailingComma` all, 2-space
indent. The `configs/` presets (`oxlint.json`, `oxfmt.json`, `tsconfig.{base,react-app,node}.json`,
`lefthook.yml`, `check.yml`) ship raw for consumer `extends` / scaffolding.

## Development Guidelines

- Strict TS, no `any`, explicit types on public exports; typed object params, low nesting, early
  returns.
- Function components only; no `React.FC`, no default exports.
- Respect the Mantine-free boundary and the `@visx/*`-only-in-charts rule.
- Don't reintroduce Tailwind, OKLCH foundation palettes, ShadCN/Tremor/Starlight compat, or any
  `import.meta.env` reference in shipped code.
- When adding API surface in S2–S4, keep signatures grounded in the argo source the stub cites.
