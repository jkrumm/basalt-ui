# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Opinionated framework for Mantine v9 + visx React apps — theme, app shell, chart system, and the agentic layer to drive them.

**[Documentation](https://basalt-ui.com?utm_source=basalt_ui_readme)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building a dashboard app means wiring a Mantine theme, a visx chart system, a typed token layer, and an app shell — each with its own opinions, and none of them talking to each other.

Basalt UI is the extraction of that setup from a production app. Install once, get a coherent system.

---

## Quick start

### 1. Install

```bash
bun add basalt-ui
bun add react react-dom @mantine/core @mantine/hooks
# @mantine/dates is optional (date pickers only)
```

Peer requirements: `react` / `react-dom` `^19`, `@mantine/core` + `@mantine/hooks` `^9.3`.

### 2. Scaffold the repo doctrine (`basalt init`)

```bash
bunx basalt init
```

Writes into the consumer repo:

- `.claude/rules/basalt-*.md` — six Claude Code rules (`basalt-tokens`, `basalt-charts`, `basalt-mantine`, `basalt-router`, `basalt-query`, `basalt-state`)
- A managed `<!-- basalt:begin/end -->` block in `CLAUDE.md` — stack facts, the DESIGN.md pointer, and the frontend-design restraint override
- A thin `DESIGN.md` seed — your app's deltas (series dictionary, identity, deviations)
- Toolchain templates: `oxfmt.json`, `lefthook.yml`, `check.yml`
- `.oxlintrc.json` with `"extends": ["./node_modules/basalt-ui/configs/oxlint.json"]`
- `.basalt/manifest.json` — sha256 per managed file for `sync` three-way diff

### 3. Install the plugin (skills)

```bash
claude plugin marketplace add jkrumm/basalt-ui
claude plugin install basalt@basalt-ui     # enable auto-update when prompted
```

Gives you `/basalt:app`, `/basalt:design`, `/basalt:charts` in every Claude Code session.

### The plugin and `basalt init` are a pair

| Channel           | Ships                                                                | Scope                                                   |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| **Plugin**        | The three skills (`/basalt:app`, `/basalt:design`, `/basalt:charts`) | User scope — installed once, available in every project |
| **`basalt init`** | The repo doctrine (rules, CLAUDE block, DESIGN.md, toolchain)        | Per repo — run once per consumer                        |

A Claude Code plugin cannot write project context (`CLAUDE.md`, `.claude/rules/`, `DESIGN.md`) — that is why doctrine is a separate per-repo `init`. And `init` cannot auto-install a plugin at user scope — that is why the plugin is a one-time separate step. Skills without `init` degrade to generic advice. `init` without the plugin still loads the rules as context, but the design and charts workflows are not a slash command away. Do both.

---

## Wire the runtime

After `bunx basalt init`, wire the provider, shell, and vite preset:

```tsx
// Provider — wraps MantineProvider, injects the --vx-* palette, bridges the Vx tokens
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'
import 'basalt-ui/styles.css'

const theme = createBasaltTheme({
  /* app deltas only */
})

export function App() {
  return <BasaltProvider theme={theme}>{/* app */}</BasaltProvider>
}
```

```tsx
// Shell — sidebar / mobile-nav / breadcrumbs / page-header; router-agnostic
import { BasaltShell, NavCountBadge } from 'basalt-ui'
import type { SidebarSection } from 'basalt-ui'
```

```ts
// vite.config.ts
import { basaltViteConfig } from 'basalt-ui/vite'

export default basaltViteConfig({ port: 5173, apiTarget: 'http://localhost:3000' })
```

```ts
// Lint — theme guard is the teeth behind the token doctrine
// package.json scripts:
"lint": "oxlint . && basalt check-theme"
```

---

## Subpath exports

| Subpath        | Mantine? | Contents                                                                                                                                                                                                                               |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`            | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + `AppSidebar` / `MobileNav` / `AppBreadcrumbs` / `PageHeaderProvider` / `PageActions` / `PageActionsOutlet`, `NavCountBadge`, shell types |
| `./charts`     | **free** | visx primitives, 7 chart kinds (Bars, Donut, DualPanel, Heatmap, MultiLine, StackedArea, ZonedLine), sparklines, hooks; re-exports the token layer                                                                                     |
| `./tokens`     | **free** | `VX`, `alpha`, `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `ColorPair` / `SeriesMap` types                                                                                                                       |
| `./theme-lab`  | coupled  | `ThemeLabControls`, `applyOverrides`, `COLOR_GROUPS`                                                                                                                                                                                   |
| `./vite`       | —        | `basaltViteConfig(opts)`                                                                                                                                                                                                               |
| `./styles.css` | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                                                                          |
| `./configs/*`  | —        | Raw toolchain presets — oxlint, oxfmt, tsconfig (base/react-app/node), lefthook                                                                                                                                                        |

Named exports only — no default exports.

---

## Mantine-free boundary

`./charts` and `./tokens` import zero `@mantine/*`. `@visx/*` is only allowed inside `src/charts/**`. The root barrel (`.`) does not re-export `./charts` or `./tokens` — a charts/tokens-only consumer never pulls in Mantine.

This boundary is enforced by oxlint `no-restricted-imports` in both the repo and the shipped consumer preset, so the constraint holds downstream too.

---

## Token system (`--vx-*`, three tiers)

```
Tier 1 — Palette data     Pure data + string helpers (BP, p()). Zero React, zero Mantine, zero browser.
Tier 2 — CSS variables    Emitted as --vx-* custom properties under light/dark color-scheme. Pure CSS.
Tier 3 — Token refs       VX.* — just var(--vx-*) strings. Work in components and non-component files.
```

Apply opacity with `alpha(token, a)` (backed by `color-mix`) — never `rgba()`, so the hue keeps resolving per scheme.

### Consumer-series extensibility

App-specific series colors live in the consumer, not the framework. The framework ships the factories:

```ts
import { defineSeries, seriesTokens, groupTokens, buildPaletteCss, alpha } from 'basalt-ui/tokens'

// Define once in lib/series.ts (the single guard-exempt file)
export const SERIES = defineSeries({
  hrv: '#6C8EBF',
  rhr: '#D6A84E',
  load: '#7BAF7B',
})

// Exact-keyed token refs — stale keys fail tsc at the call site
export const S = seriesTokens(SERIES)
// S.hrv → 'var(--vx-hrv)'
```

Every `defineX` factory is const-generic and exact-keyed — the return type mirrors the literal input shape, so `tsc` catches stale keys.

---

## CLI

```bash
bunx basalt init          # scaffold doctrine into a consumer repo
bunx basalt sync          # three-way diff against .basalt/manifest.json after a basalt-ui upgrade
bunx basalt sync --check  # CI drift gate — non-zero exit on any managed-file drift
bunx basalt check-theme   # palette guard — fails on colors that bypass the central --vx-* system
```

`sync` strategy per file: unchanged since last write → overwrite; locally edited → skip (show diff); missing → recreate. `--force` overwrites local edits.

---

## Toolchain

- **Lint**: oxlint (NOT ESLint / Biome)
- **Format**: oxfmt (NOT Prettier / Biome)
- **Runtime**: Bun
- **TypeScript**: strict mode throughout
- **Tarball ships `src/`** alongside `dist/` — go-to-definition lands in real source, not compiled output

The `./configs/*` export gives consumer apps raw presets to `extends` or copy via `basalt init`:

```json
// .oxlintrc.json
{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }
```

---

## `basalt sync` in CI

Wire the drift gate to catch doctrine falling behind after a basalt-ui upgrade:

```yaml
# .github/workflows/check.yml (scaffolded by basalt init)
- run: bunx basalt sync --check
```

---

## Requirements

| Peer                  | Version | Notes                        |
| --------------------- | ------- | ---------------------------- |
| `react` / `react-dom` | `^19`   | required                     |
| `@mantine/core`       | `^9.3`  | required                     |
| `@mantine/hooks`      | `^9.3`  | required                     |
| `@mantine/dates`      | `^9.3`  | optional — date pickers only |

---

## License

Apache 2.0 — use freely, modify as needed, keep attribution.
