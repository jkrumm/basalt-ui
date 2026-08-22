# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Opinionated framework for Mantine v9 + visx React apps — theme, app shell, chart system, and the agentic layer to drive them.

**[Documentation](#quick-start)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building a dashboard app means wiring a Mantine theme, a visx chart system, a typed token layer, and an app shell — each with its own opinions, and none of them talking to each other.

Basalt UI is the extraction of that setup from a production app. Install once, get a coherent system.

---

## Quick start

### 1. Install

```bash
bun add basalt-ui
bun add react react-dom @mantine/core @mantine/hooks @tanstack/react-query
```

The root `.` entry needs all five: `react` / `react-dom` `^19`, `@mantine/core` +
`@mantine/hooks` `^9.3`, and `@tanstack/react-query` (`BasaltProvider` hard-requires it at build
time). **Install them yourself — every peer is declared `optional`**, so no package manager adds
them for you and a missing one surfaces as an unresolved import when you build, not as a warning
when you install. That optionality is what lets the Mantine-free subpaths cost nothing (below);
version mismatches on an installed peer still warn.

A real app also needs `@types/react @types/react-dom` (dev) and a standard Vite `vite-env.d.ts`
for `tsc --noEmit` to pass.

Two more peers are needed by specific named exports of the root `.` entry, not by
`BasaltProvider` itself: `bun add motion` if you use `ThemeToggle`, `ThreadFeed` or
`ThreadDetailPanel`, and the three `@fontsource-variable` packages
(`bun add @fontsource-variable/hubot-sans @fontsource-variable/jetbrains-mono
@fontsource-variable/nunito-sans`, all exact-pinned — see `packages/basalt-ui/package.json` for the
versions) if you import `basalt-ui/styles.css`, which `@import`s them for the three-font system.
Both are optional peers, so neither installs automatically.

**No React?** `./tokens`, `./charts`, `./state` and `./guard` resolve with none of the five
installed, and the token system is consumable with no package at all:

```bash
bunx basalt-ui tokens:css --selector-attribute data-theme --only core --out src/tokens.css
```

See [`docs/FRAMEWORK-FREE.md`](https://github.com/jkrumm/basalt-ui/blob/master/docs/FRAMEWORK-FREE.md)
for the selector-specificity trap, the `color-mix` opacity law, and the surface-token roles.

### 2. Scaffold the repo doctrine (`basalt-ui init`)

```bash
bunx basalt-ui init
```

That's the whole install — there is no plugin, no marketplace, and no second version to track.
`init` writes into the consumer repo:

- `.claude/rules/basalt-*.md` — thirteen Claude Code rules (`basalt-tokens`, `basalt-charts`, `basalt-mantine`, `basalt-router`, `basalt-query`, `basalt-state`, `basalt-forms`, `basalt-notifications`, `basalt-commands`, `basalt-data`, `basalt-agent`, `basalt-content`, `basalt-app`)
- `.claude/skills/basalt-{app,design,charts}/SKILL.md` — the three skills (`/basalt-app`, `/basalt-design`, `/basalt-charts`), same managed path as the rules
- A managed `<!-- basalt:begin/end -->` block in `CLAUDE.md` — stack facts, the DESIGN.md pointer, and the frontend-design restraint override
- A thin `DESIGN.md` seed — your app's deltas (series dictionary, identity, deviations)
- Toolchain seeds: `.oxlintrc.json` and `lefthook.yml` as `extends` stubs into `node_modules/basalt-ui/configs/` (the presets auto-update with the package), plus `.oxfmtrc.json` and `.github/workflows/check.yml` as starting copies
- `.basalt/manifest.json` — sha256 per managed file + the basalt-ui version, for `sync` three-way diff and `doctor`
- Two `package.json` patches: `basalt.roots` inferred from the real layout, and a `lint:basalt` script

`init` on an **existing** app is a lint-debt event, not a no-op: the shipped preset switches on
whole oxlint plugins the repo was never linted against, so previously-clean code lands with real
findings on the first run. `init` names those plugins, and names every file it kept along with what
keeping it costs — an `.oxlintrc.json` that does not extend the preset means the entire basalt lint
half is inert and nothing else says so (`--merge-lint` splices the `extends` in; it refuses on a
commented config rather than deleting the comments). Run `oxlint .` and triage before your next
commit.

Every file is either **managed** (basalt owns it, `sync` refreshes it, local edits are skipped and
reported — exactly the files Claude reads, which cannot load from `node_modules`) or a **seed**
(written once, then yours forever). One rule decides which: does Claude read the file?

---

## Wire the runtime

After `bunx basalt-ui init`, wire the provider, overlays, and vite preset. This mirrors the canonical
reference, `apps/playground/src/main.tsx`:

```tsx
// main.tsx — plain Vite CSR entry. BasaltProvider defaults to the dark color scheme and reads any
// stored scheme from localStorage before mount, so a client-only app needs no ColorSchemeScript.
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/spotlight/styles.layer.css'
import 'basalt-ui/styles.css'
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'
import { BasaltOverlays } from 'basalt-ui/commands'
import { applyOverrides, loadOverrides } from 'basalt-ui/theme-lab'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { paletteGroups } from './theme/series'

// The theme lab owns only the editing UI — the host re-applies any persisted overrides at boot, so
// a tuning session survives a refresh.
applyOverrides(loadOverrides())

const theme = createBasaltTheme({
  /* app deltas only */
})

createRoot(document.getElementById('root')!).render(
  <BasaltProvider theme={theme} paletteOptions={{ groups: paletteGroups }}>
    <BasaltOverlays>
      <App />
    </BasaltOverlays>
  </BasaltProvider>,
)
```

> Use the **layered** `*.layer.css` bundles, never the plain ones — Mantine's unlayered bundle
> outranks basalt's `@layer basalt` styles (including the iOS 16px input floor) regardless of
> specificity. Only import `@mantine/notifications/styles.layer.css` /
> `@mantine/spotlight/styles.layer.css` if you install those optional-peer batteries
> (`./notifications` / `./commands` — see [Adapter batteries](#adapter-batteries) below).

### Theming

The shipped palette isn't a fixed set of hexes — it's **generated** from one accent seed + five
bounded knobs, with contrast guaranteed by derivation rather than hand-tuning:

```ts
const theme = createBasaltTheme(
  {
    /* app deltas only */
  },
  { derive: { accent: '#7c3aed', neutral: 'zinc', vibrancy: 1 } },
)
```

`derive` accepts `accent` (hex seed), `neutral` (`'zinc' | 'neutral' | 'stone' | 'slate'`), and
`lightLevel` / `darkLevel` / `vibrancy` / `accentBrightness` (`-5..5`, all optional — omitted knobs
keep the shipped default). Never hand-edit a palette hex to retune the identity.

`BasaltOverlays` (from `basalt-ui/commands`) is the composable overlay mount: it bundles
`ModalsProvider`, `Spotlight`, and `Notifications` into a single mount point and replaces a
standalone `<BasaltNotifications />`. `paletteOptions={{ groups: paletteGroups }}` emits your
app-specific series colors (see
[Consumer-series extensibility](#consumer-series-extensibility) below) alongside the framework
palette. Skip both — `BasaltOverlays` and `paletteGroups` — if you don't use those batteries yet.

> **SSR only:** Next.js / React Router (SSR) consumers must additionally render
> `<ColorSchemeScript defaultColorScheme="dark" />` (matching `BasaltProvider`'s default) in the
> document `<head>` to avoid a flash of the wrong theme during hydration. Plain Vite CSR apps don't
> need it — there is no hydration to mismatch. See `docs/MANTINE-THEMING.md`.

```tsx
// Shell — sidebar / mobile-nav / breadcrumbs / page-header; router-agnostic
import { BasaltShell, NavCountBadge } from 'basalt-ui'
import type { SidebarSection } from 'basalt-ui'
```

```ts
// vite.config.ts
import react from '@vitejs/plugin-react'
import { basaltAppPlugin, basaltViteConfig } from 'basalt-ui/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  ...basaltViteConfig({ port: 5173, apiTarget: 'http://localhost:3000' }),
  plugins: [react(), ...basaltAppPlugin({ name: 'MyApp', description: '…' })],
})
```

`basaltViteConfig` stays config-only (no `plugins`, by contract); `basaltAppPlugin` is the plugin
half — see the `./vite` adapter battery under [Adapter batteries](#adapter-batteries) below.

> **Local consumption (sibling checkouts).** Developing against an unpublished / `file:`-linked
> basalt-ui from a sibling repo? Build `dist/` first — `bunx basalt-ui` always resolves
> `bin/basalt-ui.mjs` → `dist/cli/index.js`, even though the _runtime_ import can ride
> `basaltViteConfig`'s `BASALT_LOCAL`/`basaltSrc` source aliasing above. And in a monorepo, add
> `basalt-ui` as a **root** devDependency (not only a leaf-workspace dep) so its bin hoists into the
> root `node_modules/.bin` — otherwise `bunx basalt-ui` silently resolves the stale published
> package from npm instead of your local checkout.

```ts
// Lint — theme guard is the teeth behind the token doctrine
// package.json scripts (init seeds this as "lint:basalt"):
"lint": "oxlint . && basalt-ui check-theme"
```

`check-theme` scans `src/` by default; `init` writes a real `"basalt"` key from your actual layout,
and everything derives from it — the guard's scan, the seeded CI `oxfmt` globs, the default scan
exemption:

```json
// package.json — `roots` is written by init; the rest are yours to add
{
  "basalt": {
    "roots": ["apps/web/src"],
    "include": ["app/manifest.json"],
    "profile": "tokens-only"
  }
}
```

`check-theme` fails loudly (instead of a false `✓`) when the configured roots resolve to zero
scanned files, and `doctor`'s `guard-scan` check agrees with it. Each root's **parent** also
contributes its `index.html` and its `public/` tree — the Vite layout `basaltViteConfig` assumes,
and where a raw `theme-color` or webmanifest `background_color` actually lives. `.json` is never
blanket-scanned; `include` names one explicitly and is the only route to it. `profile:
"tokens-only"` turns off the 16 kinds whose remedy is a Mantine component or prop, and must be
declared (or `--tokens-only`) — it is deliberately never inferred from a missing `@mantine/core`,
which would silence half the guard on any repo keeping Mantine in a different workspace package.
Other keys (`exempt`, `severity`, `spacingSteps`, `forbiddenAccents`, …) are documented on the
`BasaltConfig` type.

A file whose first 5 lines carry the `@generated basalt-ui` marker is skipped — so the stylesheet
`tokens:css` just wrote is not reported back at you.

**The escape hatch is scoped.** `theme-allow <rule-id> — <reason>` waives that one kind, on the
reported line, on a comment-only line directly above it (the only form JSX can express), or — in
CSS — from a trailing comment back over the declaration it terminates. A bare `theme-allow` still
waives everything but reports `theme-allow-unscoped`.

`doctor`'s `ai-major-parity` hard check fails a monorepo where workspace packages declare different
`ai` package majors — unless the split is intentional and written down. A producer pinned to an
older major with a client on a newer one, neutralized by a transform, is a locked decision, not a
defect:

```json
// package.json (repo root)
{
  "basalt": {
    "aiMajorSkewReason": "apps/api streams on ai@5, apps/dashboard parses on ai@7 — the one enum value that differs is neutralized by a producer-side TransformStream in apps/api/src/stream-transform.ts"
  }
}
```

The value **is** the reason — omitting the key, or setting it to `true`/`""`, does not weaken the
check; `doctor` still hard-fails a detected skew exactly as if `aiMajorSkewReason` were absent. Once
the reason is written, `doctor` passes and echoes both the detected skew and the reason back. If the
majors later come back into agreement, `doctor` warns that the declaration is stale so it gets
deleted rather than silently surviving into the next real skew.

---

## Subpath exports

| Subpath             | Mantine? | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                 | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + sidebar / mobile-nav / breadcrumbs / page-header, `NavCountBadge`, `SidebarAccount` + the provider-agnostic account contract (`BasaltAccountProps`/`State`/`Actions`), `ThreadWorkspace` + thread-chat components, shell types — the root entry still re-exports the thread-chat components; `./agent-chat` takes the same components standalone, without `BasaltProvider`, the shell, the dashboard composites, or `./connectivity`                                                                                                                    |
| `./charts`          | **free** | `CartesianChart` + visx primitives, kinds, sparklines, hooks, token re-exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `./tokens`          | **free** | `VX` token refs, `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `alpha`, `ColorPair` / `SeriesMap` types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `./theme-lab`       | coupled  | `ThemeLabControls`, `applyOverrides`, `loadOverrides`, `COLOR_GROUPS` for live theme inspection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `./vite`            | —        | `basaltViteConfig(opts)` — Vite preset for basalt-ui consumer apps; `basaltAppPlugin(opts)` — PWA head, manifest, and icon metadata derived from the token palette                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `./guard`           | **free** | `checkSource`, `GUARD_RULES`, `Finding` types — the headless theme-guard core                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./query`           | **free** | `createBasaltQueryClient`, transport-agnostic `unwrap`, lazy `BasaltQueryDevtools`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `./router-tanstack` | **free** | TanStack Router bridge: `useBasaltNav` (active route) + `useRouterBreadcrumbs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `./forms`           | coupled  | Mantine form adapter: `useBasaltForm`, `field`, `FormErrorSummary`, `useFormDraft` (Standard Schema)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `./notifications`   | coupled  | Mantine notifications: `notify` helpers, typed registry, persisted history, `NotificationBell`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `./commands`        | coupled  | Typed command bus + overlay controller, `toSpotlightActions`, `ShortcutsHelp`, `BasaltOverlays`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `./data`            | coupled  | Convenience barrel pulling both peer groups: `BasaltDataTable`, `BasaltVirtualList` (Mantine-rendered) — prefer `./data/table` / `./data/virtual` for per-feature opt-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `./data/table`      | coupled  | `BasaltDataTable` — sortable data table over TanStack Table, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `./data/virtual`    | coupled  | `BasaltVirtualList` — windowed virtual list over TanStack Virtual, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `./agent`           | **free** | Headless streaming layer (`useAgentStream`, `PartList`) + multi-thread `createThreadsStore` / `useAgentThreadRuns` / outcome seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `./agent-chat`      | coupled  | Mantine-styled thread-chat components over `./agent`: `ThreadWorkspace`, `ThreadFeed` (`variant`/`renderRow`), `ThreadFeedRow` (inline-expanding Slack row, lazily mounted + kept mounted), `ThreadOutcomeCard`, `ThreadDetailPanel`, `Composer`, `ThreadTranscript` (`groupConsecutive`/`affordances`/`virtualize` — windowed transcripts open at the newest message unless `initialScroll: 'start'`; `virtualize` is enabled by the optional `@tanstack/react-virtual` peer, absent it degrades to an unwindowed, height-bound pane), `threadPartRenderers` — **requires `motion`**, not merely an optional peer; see [Requirements](#requirements) |
| `./state`           | **free** | `createPersistedState` (versioned localStorage) + `useOnlineStatus` — Mantine-free state primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./connectivity`    | coupled  | `ConnectivityProvider` (aggregates browser/React-Query/SSE/health-check status), `useConnectivity`, `ConnectivityIndicator` — auto-mounted by `BasaltProvider`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `./content`         | coupled  | `Prose`, `CodeBlock`, `Callout`, `TableOfContents`, `ReadingProgress`, `Markdown`, `MermaidDiagram`, `ArticleLayout`, `ArticleCard` / `ArticleGrid`, `GuideLink` / `GuideDrawer`, `mdxComponents`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `./styles.css`      | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./tokens.css`      | **free** | Prebuilt `--vx-*` stylesheet — the default `buildPaletteCss()` output as a plain file, for a consumer with a bundler but no React or Mantine. **With no bundler, use the `basalt-ui tokens:css` CLI instead** and commit the emitted file: importing this subpath needs bare-specifier resolution. See [`docs/FRAMEWORK-FREE.md`](https://github.com/jkrumm/basalt-ui/blob/master/docs/FRAMEWORK-FREE.md)                                                                                                                                                                                                                                             |
| `./configs/*`       | —        | Raw toolchain presets — oxlint, oxfmt, tsconfig (base/react-app/node), lefthook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `./llms.txt`        | —        | Machine-readable surface map — one entry per published subpath with import specifier, description, layer, and optional peers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Named exports only — no default exports.

---

## Mantine-free boundary

`./charts` and `./tokens` import zero `@mantine/*`. `@visx/*` is only allowed inside `src/charts/**`. The root barrel (`.`) does not re-export `./charts` or `./tokens`.

The Mantine-free part protects two things. First, layering: `tokens` is pure data that `cssVariablesResolver` reads to bind Mantine's surfaces to the same `--vx-*` vars charts use, so an `@mantine/*` import in either would cycle back through the theme layer or let a chart bypass `--vx-*` and fork chrome/charts apart. Second, packaging: `./charts` and `./tokens` resolve and render with **no `@mantine/*` installed** — a charts/tokens-only consumer never pulls Mantine into their bundle. This is real and CI-tested (`scripts/pack-test.sh`'s "charts/tokens-only (no-Mantine) resolution + render" step scratch-installs the tarball with only `react`/`react-dom` and SSR-renders `basalt-ui/charts`; `scripts/check-dist-layering.mjs` walks the built dist graph and fails if those entries reach `@mantine/*`; the root barrel not re-exporting them is the third leg). The LAYER is Mantine-free — the FRAMEWORK is not: `.` requires Mantine (`@mantine/core`/`@mantine/hooks` are required, non-optional peers); only `./charts`/`./tokens` don't. Both consequences are a basalt-internal invariant enforced by the repo-local-only `basalt/token-layer-boundary` oxlint plugin rule — not a consumer contract, so it is deliberately absent from the shipped consumer preset. The `@visx/*`-only-in-charts part (`basalt/visx-boundary`) IS shipped, so that constraint holds downstream too.

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
// src/theme/series.ts — the single guard-exempt file
import { defineSeries, groupTokens } from 'basalt-ui/tokens'

// 1. Declare the series with light/dark pairs (ColorPair shape — hex strings per scheme)
export const SERIES = defineSeries({
  sessions: { light: '#4f78a4', dark: '#7099c4' },
  signups: { light: '#3f8a63', dark: '#62c08f' },
  revenue: { light: '#d9822b', dark: '#f0a868' },
  churn: { light: '#c23030', dark: '#f08c8c' },
})

// 2. Augment BasaltRegister — gives exact-keyed typing everywhere that reads series
declare module 'basalt-ui' {
  interface BasaltRegister {
    series: typeof SERIES
  }
}

// 3. Namespaced token refs — stale keys fail tsc at the call site
export const GROUP = 'app'
export const colors = groupTokens(GROUP, SERIES)
// colors.sessions → 'var(--vx-app-sessions)'

// 4. Hand the same map to BasaltProvider so the --vx-app-* vars are emitted
export const paletteGroups = { [`${GROUP}-`]: SERIES }
```

```tsx
// main.tsx — wire paletteGroups into BasaltProvider
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'
import { paletteGroups } from './theme/series'

export function App() {
  return (
    <BasaltProvider theme={createBasaltTheme()} paletteOptions={{ groups: paletteGroups }}>
      {/* app */}
    </BasaltProvider>
  )
}
```

Every `defineX` factory is const-generic and exact-keyed — the return type mirrors the literal input shape, so `tsc` catches stale keys.

---

## Adapter batteries

Seven optional-peer batteries extend the core. Install only what you use — core resolves without them.

### `./charts` — visx chart primitives

```bash
bun add @visx/axis @visx/curve @visx/event @visx/grid @visx/group @visx/responsive @visx/scale @visx/shape @visx/threshold
```

`./charts` is Mantine-free (see [Mantine-free boundary](#mantine-free-boundary) above) but not
dependency-free: it needs the nine `@visx/*` packages, all pinned exact at `4.0.0`. They ship as
optional peers, not bundled dependencies, so a `./tokens`-only consumer never installs them.

`CartesianChart` is the entry point: it owns the measured margins, both y scales and their
domains, the axes, grid, the page-shared cursor, the crosshair and the derived tooltip, so a chart
supplies its `series` and draws only marks. Legends toggle series, margins size themselves from
the tick labels actually painted, and charts share a cursor with no provider.

```tsx
import { CartesianChart, LinePath, VX } from 'basalt-ui/charts'
;<CartesianChart
  data={rows}
  chartId="sessions"
  getX={(d) => d.date}
  series={[
    {
      key: 'sessions',
      label: 'Sessions',
      color: VX.accent,
      mark: 'line',
      getValue: (d) => d.sessions,
    },
  ]}
  y={{ format: (v) => v.toFixed(0) }}
  height={260}
>
  {({ visible, xScale, yScale }) =>
    visible.map((s) => (
      <LinePath
        key={s.key}
        data={rows}
        x={(d) => xScale(d.date) ?? 0}
        y={(d) => yScale(s.getValue(d) ?? 0)}
        stroke={s.color}
      />
    ))
  }
</CartesianChart>
```

Shipped kinds (`Bars`, `MultiLine`, `StackedArea`, `ZonedLine`, `Donut`, `DualPanel`, `Heatmap`)
are that same composition, pre-wired.

### `./query` — TanStack Query adapter

```bash
bun add @tanstack/react-query @tanstack/react-query-devtools
```

```tsx
import { createBasaltQueryClient, QueryClientProvider, unwrap } from 'basalt-ui/query'

const [client] = useState(() => createBasaltQueryClient())
// queryFn: () => unwrap(api.users.get())
```

### `./router-tanstack` — TanStack Router bridge

```bash
bun add @tanstack/react-router
```

```tsx
import { useBasaltNav, useRouterBreadcrumbs } from 'basalt-ui/router-tanstack'

const { isActive } = useBasaltNav()
const crumbs = useRouterBreadcrumbs()
```

### `./forms` — Mantine form adapter

```bash
bun add @mantine/form
```

```tsx
import { useBasaltForm, field, FormErrorSummary } from 'basalt-ui/forms'

const form = useBasaltForm({ initialValues: { email: '' } })
```

### `./notifications` — Mantine notifications

```bash
bun add @mantine/notifications
```

```tsx
import { BasaltNotifications, notifySuccess, notifyError } from 'basalt-ui/notifications'

// in main.tsx: <BasaltProvider><BasaltNotifications /><App /></BasaltProvider>
notifySuccess('Saved')
notifyError('Upload failed', { title: 'Error' })
```

### `./commands` — command bus + Spotlight overlay

```bash
bun add @mantine/spotlight @mantine/modals @mantine/notifications @tanstack/react-hotkeys
```

```tsx
import { defineCommands, runCommand, BasaltOverlays } from 'basalt-ui/commands'

export const COMMANDS = defineCommands({
  'file:save': { label: 'Save', group: 'File', shortcut: 'Mod+S', run: () => save() },
})
// in main.tsx: <BasaltProvider><BasaltOverlays><App /></BasaltOverlays></BasaltProvider>
runCommand('file:save')
```

### `./data` — TanStack Table + Virtual

`./data` is a convenience barrel that pulls in both peer groups. Prefer the fine subpaths below
for per-feature opt-in — each only requires its own peer.

```bash
bun add @tanstack/react-table @tanstack/react-virtual
```

```tsx
import { BasaltDataTable, BasaltVirtualList, createColumnHelper } from 'basalt-ui/data'

const col = createColumnHelper<Row>()
const columns = [col.accessor('name', { header: 'Name' })]
// <BasaltDataTable data={rows} columns={columns} />
```

#### `./data/table` — BasaltDataTable only

```bash
bun add @tanstack/react-table
```

```tsx
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
```

#### `./data/virtual` — BasaltVirtualList only

```bash
bun add @tanstack/react-virtual
```

```tsx
import { BasaltVirtualList } from 'basalt-ui/data/virtual'
```

### `./content` — prose + markdown

````bash
bun add react-markdown remark-gfm     # Markdown
bun add remend                        # `Markdown`'s streaming-tail repair — optional, lazy dynamic import
bun add rehype-sanitize               # `Markdown`'s sanitize pass — optional, lazy dynamic import
bun add shiki                         # CodeBlock / fenced-code highlighting (brings @shikijs/langs, @shikijs/themes as optional peers)
bun add beautiful-mermaid             # MermaidDiagram / ```mermaid fences
````

Every peer here is lazy: `Markdown` reaches all of them through a dynamic `import()`, so
`basalt-ui/content` resolves and renders with none of them installed. Absence degrades gracefully
— never a crash: without `react-markdown`/`remark-gfm`, markdown falls back to plain text; without
`remend`, the streaming tail renders unrepaired; without `rehype-sanitize`, the sanitize pass is
skipped (dev-warned once); without `shiki`, fences fall back to plain mono; without
`beautiful-mermaid`, mermaid fences render nothing. `Markdown` is the package's **only** markdown
renderer — it backs long-form content and AI chat alike:

```tsx
import { Markdown, Prose, CodeBlock, TableOfContents } from 'basalt-ui/content'

// Long-form: 72ch measure, article typography, heading anchors + slug dedup.
<Markdown>{article.body}</Markdown>

// AI output: chat density, block-split + memoized, `remend`-repaired in-flight tail. Model-generated
// text is untrusted regardless of whether it has finished streaming — pin `contentTrust` explicitly.
<Markdown streaming density="chat" contentTrust="untrusted">{part.text}</Markdown>
```

`streaming` is a rendering mode only — it says the text is still arriving, not who wrote it. The
security input is the separate `contentTrust` prop (`'trusted' | 'untrusted'`), the sole driver of
the `allowedImagePrefixes` default: same-origin-only when untrusted, since LLM-authored markdown can
otherwise exfiltrate via a remote image URL. Any surface rendering agent/model output must pin
`contentTrust="untrusted"` explicitly. Full doctrine: `agent/rules/basalt-content.md`.

### `./agent` — streaming-chat layer

```bash
bun add ai use-stick-to-bottom
```

Ships no markdown renderer — `agent/** -> content` is lint-blocked by design, so `PartList` takes
a consumer-supplied `components.text`. Basalt's own is [`./content`](#content--prose--markdown)'s
`Markdown`, already wired in by `ThreadWorkspace`.

Single conversation — headless streaming primitives, `aiSdkTransport` (recommended default, optional
peer: `ai`):

```tsx
import { useAgentStream, aiSdkTransport, PartList } from 'basalt-ui/agent'

const transport = aiSdkTransport({ api: '/api/chat' })
const { parts, send, status } = useAgentStream({ transport })
```

Many short chats — the `ThreadWorkspace` composite (a distilled-outcome feed + a detail panel).
The headless multi-thread layer lives in `./agent`; the Mantine chrome ships from
`basalt-ui/agent-chat` (also re-exported from the root entry):

```tsx
import { ThreadWorkspace } from 'basalt-ui/agent-chat'
import { createThreadsStore, heuristicOutcome } from 'basalt-ui/agent'

// Once at module scope:
const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })

function Inbox() {
  return (
    <ThreadWorkspace
      useThreads={useThreads}
      transport={transport}
      resolveOutcome={heuristicOutcome} // swap for your LLM-backed {title, summary} resolver
      newThreadPlaceholder="Ask anything…"
    />
  )
}
```

`useAgentThreadRuns` streams each thread concurrently in the background; the feed shows only the
distilled `{ title, summary }` outcome, never the raw prompt or thinking. See
`agent/rules/basalt-agent.md` for the full doctrine.

### `./vite` — PWA / head metadata (optional peer)

`basaltAppPlugin` (see [Wire the runtime](#wire-the-runtime) above) needs no install by default —
its `serviceWorker` option is the only part with an optional peer, and it's `false` unless you opt
in:

```bash
bun add -D vite-plugin-pwa workbox-build workbox-window   # only if serviceWorker is enabled
```

Without the peer installed, `serviceWorker: true` degrades to a one-line console warning (no
service worker, no crash) — everything else (theme-color meta, anti-FOUC background,
`site.webmanifest`, favicon/apple-touch-icon links, OG/Twitter defaults) works with zero extra
dependencies. Full doctrine, plugin ordering, and the bring-your-own icon filenames:
`agent/rules/basalt-app.md`.

---

## Type seam (`BasaltRegister`)

`BasaltRegister` is the single declaration-merge interface consumers augment to register their app-specific shapes for exact-keyed typing. It follows the same pattern as TanStack Router's `Register` interface — augment once per concern in the concern's own file, and every battery that reads the slot gets narrow types automatically.

```ts
// src/commands.ts — augment the commands slot
import { defineCommands } from 'basalt-ui/commands'

export const COMMANDS = defineCommands({
  'file:save': { label: 'Save', group: 'File', shortcut: 'Mod+S', run: () => save() },
})

declare module 'basalt-ui' {
  interface BasaltRegister {
    commands: typeof COMMANDS
  }
}
```

Current slots: `series` (read by `./charts` + `./tokens`), `commands` (read by `./commands`), and `overlays` / `notifications` (read by `./commands` / `./notifications`). An un-augmented slot defaults to a never-keyed `{}` — augment only the slots you use.

---

## CLI

```bash
bunx basalt-ui init              # scaffold doctrine into a consumer repo
bunx basalt-ui sync              # three-way diff against .basalt/manifest.json after a basalt-ui upgrade
bunx basalt-ui sync --check      # CI drift gate — non-zero exit on any managed-file drift
bunx basalt-ui check-theme       # palette guard — fails on colors that bypass the central --vx-* system
bunx basalt-ui doctor            # integration health: basalt-resolves, guard-scan, oxlint-preset, manifest presence, node_modules-vs-manifest version, spacing-scale drift, and a cross-package `ai` major-version parity check (HARD failure — walks every workspace manifest, exemptable via `basalt.aiMajorSkewReason` — see above) + warn on missing basaltAppPlugin icon files under public/
bunx basalt-ui doctor --tokens-only   # force the Mantine-free profile (auto-detected otherwise; --framework forces the full set)
bunx basalt-ui tokens:css --out src/tokens.css     # emit the --vx-* stylesheet as a file you own
bunx basalt-ui fonts:css --out src/fonts.css       # emit the shipped --basalt-font-* stacks
bunx basalt-ui info              # human-readable surface map: subpath, layer, rule, skills, optional peers
bunx basalt-ui info --json       # same map as stable JSON (InfoOutput shape)
bunx basalt-ui help              # full usage; every subcommand also takes --help / -h
```

`doctor` reports **`SKIPPED`** as a third outcome beside pass/warn/fail and exits non-zero on it —
"All checks passed" is only printable when every check actually ran. `check-theme` and `doctor`
honour `BASALT_CWD`, and relocate to the single workspace package carrying a basalt config when
invoked from a repo root that has none (two candidates is reported as ambiguous, never guessed).
`tokens:css` and `fonts:css` both take `--check` as a CI drift gate.

`sync` strategy per file: unchanged since last write → overwrite; locally edited → skip (show diff); missing → recreate. `--force` overwrites local edits.

---

## Toolchain

- **Lint**: oxlint (NOT ESLint / Biome)
- **Format**: oxfmt (NOT Prettier / Biome)
- **Runtime**: Bun
- **TypeScript**: strict mode throughout
- **Tarball ships `src/`** alongside `dist/` — go-to-definition lands in real source, not compiled output

The `./configs/*` export gives consumer apps raw presets to `extends` or copy via `basalt-ui init`:

```json
// .oxlintrc.json
{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }
```

---

## `basalt-ui sync` in CI

Wire the drift gate to catch doctrine falling behind after a basalt-ui upgrade:

```yaml
# .github/workflows/check.yml (seeded by basalt-ui init)
- run: bunx basalt-ui sync --check
```

---

## Requirements

| Peer                      | Version        | Notes                                                                                                                                                                                                                                         |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react` / `react-dom`     | `^19`          | required                                                                                                                                                                                                                                      |
| `@mantine/core`           | `^9.3`         | required                                                                                                                                                                                                                                      |
| `@mantine/hooks`          | `^9.3`         | required                                                                                                                                                                                                                                      |
| `@tanstack/react-query`   | —              | required for the root `.` entry — `BasaltProvider` hard-requires it at build time; NOT required by `./agent-chat`, which doesn't touch it                                                                                                     |
| `motion`                  | `12.42.0`      | required for both the root `.` entry and `./agent-chat` — both export `ThreadFeed`/`ThreadDetailPanel` (`agent-chat/thread-feed.tsx` / `thread-detail-panel.tsx`), which import `motion/react` eagerly; the root's `ThemeToggle` also uses it |
| `@tanstack/react-virtual` | `>=3.13.26 <4` | optional for `./agent-chat` — enables `ThreadTranscript`'s `virtualize` windowing mode via a lazy `import()`; absent it degrades to an unwindowed, height-bound pane                                                                          |

`remend` was required through 1.10.x — `content/markdown.tsx` imported it at the top of the module,
so both the root `.` entry and `./agent-chat`'s `ThreadWorkspace`/`ThreadTranscript` hard-required it
transitively. It is now a genuinely optional, lazy peer (dynamic `import()`); see
[`./content`](#content--prose--markdown) below.

`./agent-chat`'s `optionalPeers` in `llms.txt`/`surfaces.ts` lists `remend`, `motion`, and
`@tanstack/react-virtual` (npm has no per-subpath optionality in `peerDependenciesMeta`) — only
`motion` needs to be treated as required when installing just this subpath; `remend` and
`@tanstack/react-virtual` are accurately optional there too, both reached only through a lazy
`import()` (the latter behind `ThreadTranscript`'s `virtualize` option).

Optional peer batteries and their packages are listed per battery above.

---

## License

Apache 2.0 — use freely, modify as needed, keep attribution.
