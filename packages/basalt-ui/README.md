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
```

Peer requirements: `react` / `react-dom` `^19`, `@mantine/core` + `@mantine/hooks` `^9.3`.

### 2. Scaffold the repo doctrine (`basalt init`)

```bash
bunx basalt init
```

Writes into the consumer repo:

- `.claude/rules/basalt-*.md` — eleven Claude Code rules (`basalt-tokens`, `basalt-charts`, `basalt-mantine`, `basalt-router`, `basalt-query`, `basalt-state`, `basalt-forms`, `basalt-notifications`, `basalt-commands`, `basalt-data`, `basalt-agent`)
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

After `bunx basalt init`, wire the provider, overlays, and vite preset. This mirrors the canonical
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
import { basaltViteConfig } from 'basalt-ui/vite'

export default basaltViteConfig({ port: 5173, apiTarget: 'http://localhost:3000' })
```

> **Local consumption (sibling checkouts).** Developing against an unpublished / `file:`-linked
> basalt-ui from a sibling repo? Build `dist/` first — `bunx basalt` always resolves
> `bin/basalt.mjs` → `dist/cli/index.js`, even though the _runtime_ import can ride
> `basaltViteConfig`'s `BASALT_LOCAL`/`basaltSrc` source aliasing above. And in a monorepo, add
> `basalt-ui` as a **root** devDependency (not only a leaf-workspace dep) so its bin hoists into the
> root `node_modules/.bin` — otherwise `bunx basalt` silently resolves the stale published package
> from npm instead of your local checkout.

```ts
// Lint — theme guard is the teeth behind the token doctrine
// package.json scripts:
"lint": "oxlint . && basalt check-theme"
```

`check-theme` scans your own source roots, not basalt's — point it at them via a `"basalt"` key
in your `package.json` (defaults are argo's own paths and will scan 0 files in any other repo):

```json
// package.json
{
  "basalt": {
    "roots": ["src"]
  }
}
```

`roots` is required for a real scan. `check-theme` warns (instead of a false `✓`) when the
configured roots resolve to zero scanned files. Other `"basalt"` config keys (`exempt`,
`spacingSteps`, `forbiddenAccents`, …) are documented on the `BasaltConfig` type.

---

## Subpath exports

| Subpath             | Mantine? | Purpose                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                 | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + sidebar / mobile-nav / breadcrumbs / page-header, `NavCountBadge`, `SidebarAccount` + the provider-agnostic account contract (`BasaltAccountProps`/`State`/`Actions`), `ThreadWorkspace` + thread-chat components, shell types |
| `./charts`          | **free** | visx chart primitives, sparklines, hooks, and token re-exports                                                                                                                                                                                                                                                               |
| `./tokens`          | **free** | `VX` token refs, `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `alpha`, `ColorPair` / `SeriesMap` types                                                                                                                                                                                                  |
| `./theme-lab`       | coupled  | `ThemeLabControls`, `applyOverrides`, `COLOR_GROUPS` for live theme inspection                                                                                                                                                                                                                                               |
| `./vite`            | —        | `basaltViteConfig(opts)` — Vite preset for basalt-ui consumer apps                                                                                                                                                                                                                                                           |
| `./guard`           | **free** | `checkSource`, `GUARD_RULES`, `Finding` types — the headless theme-guard core                                                                                                                                                                                                                                                |
| `./query`           | **free** | `createBasaltQueryClient`, transport-agnostic `unwrap`, lazy `BasaltQueryDevtools`                                                                                                                                                                                                                                           |
| `./router-tanstack` | **free** | TanStack Router bridge: `useBasaltNav` (active route) + `useRouterBreadcrumbs`                                                                                                                                                                                                                                               |
| `./forms`           | coupled  | Mantine form adapter: `useBasaltForm`, `field`, `FormErrorSummary`, `useFormDraft` (Standard Schema)                                                                                                                                                                                                                         |
| `./notifications`   | coupled  | Mantine notifications: `notify` helpers, typed registry, persisted history, `NotificationBell`                                                                                                                                                                                                                               |
| `./commands`        | coupled  | Typed command bus + overlay controller, `toSpotlightActions`, `ShortcutsHelp`, `BasaltOverlays`                                                                                                                                                                                                                              |
| `./data`            | coupled  | Convenience barrel pulling both peer groups: `BasaltDataTable`, `BasaltVirtualList` (Mantine-rendered) — prefer `./data/table` / `./data/virtual` for per-feature opt-in                                                                                                                                                     |
| `./data/table`      | coupled  | `BasaltDataTable` — sortable data table over TanStack Table, rendered with Mantine                                                                                                                                                                                                                                           |
| `./data/virtual`    | coupled  | `BasaltVirtualList` — windowed virtual list over TanStack Virtual, rendered with Mantine                                                                                                                                                                                                                                     |
| `./agent`           | **free** | Headless streaming layer (`useAgentStream`, `PartList`) + multi-thread `createThreadsStore` / `useAgentThreadRuns` / outcome seam                                                                                                                                                                                            |
| `./state`           | **free** | `createPersistedState` (versioned localStorage) + `useOnlineStatus` — Mantine-free state primitives                                                                                                                                                                                                                          |
| `./connectivity`    | coupled  | `ConnectivityProvider` (aggregates browser/React-Query/SSE/health-check status), `useConnectivity`, `ConnectivityIndicator` — auto-mounted by `BasaltProvider`                                                                                                                                                               |
| `./styles.css`      | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                                                                                                                                                                |
| `./configs/*`       | —        | Raw toolchain presets — oxlint, oxfmt, tsconfig (base/react-app/node), lefthook                                                                                                                                                                                                                                              |
| `./llms.txt`        | —        | Machine-readable surface map — one entry per published subpath with import specifier, description, layer, and optional peers                                                                                                                                                                                                 |

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
bun add react-markdown remark-gfm   # Markdown
bun add shiki                       # CodeBlock / fenced-code highlighting
bun add beautiful-mermaid           # MermaidDiagram / ```mermaid fences
````

Every peer is lazily imported and degrades gracefully when absent (markdown falls back to plain
text, fences to plain mono, mermaid renders nothing). `Markdown` is the package's **only** markdown
renderer — it backs long-form content and AI chat alike:

```tsx
import { Markdown, Prose, CodeBlock, TableOfContents } from 'basalt-ui/content'

// Long-form: 72ch measure, article typography, heading anchors + slug dedup.
<Markdown>{article.body}</Markdown>

// AI output: chat density, block-split + memoized, `remend`-repaired in-flight tail.
<Markdown streaming density="chat">{part.text}</Markdown>
```

`streaming` also tightens image URLs to same-origin — LLM-authored markdown can otherwise exfiltrate
via a remote image URL. Full doctrine: `agent/rules/basalt-content.md`.

### `./agent` — streaming-chat layer

```bash
bun add ai use-stick-to-bottom
```

Ships no markdown renderer — `agent/** -> content` is lint-blocked by design, so `PartList` takes
a consumer-supplied `components.text`. Basalt's own is [`./content`](#content--prose--markdown)'s
`Markdown`, already wired in by `ThreadWorkspace`.

Single conversation — headless streaming primitives:

```tsx
import { useAgentStream, edenTransport, PartList } from 'basalt-ui/agent'

const transport = edenTransport((input, signal) =>
  api.chat.post({ body: { message: input }, fetch: { signal } }),
)
const { parts, send, status } = useAgentStream({ transport })
```

Many short chats — the `ThreadWorkspace` composite (a distilled-outcome feed + a detail panel).
The headless multi-thread layer lives in `./agent`; the Mantine chrome ships from the root entry:

```tsx
import { ThreadWorkspace } from 'basalt-ui'
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
bunx basalt init              # scaffold doctrine into a consumer repo
bunx basalt sync              # three-way diff against .basalt/manifest.json after a basalt-ui upgrade
bunx basalt sync --check      # CI drift gate — non-zero exit on any managed-file drift
bunx basalt check-theme       # palette guard — fails on colors that bypass the central --vx-* system
bunx basalt doctor            # check consumer repo basalt integration health (manifest, CLAUDE.md block, rules, plugin)
bunx basalt info              # human-readable surface map: subpath, layer, rule, skills, optional peers
bunx basalt info --json       # same map as stable JSON (InfoOutput shape)
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

| Peer                  | Version | Notes    |
| --------------------- | ------- | -------- |
| `react` / `react-dom` | `^19`   | required |
| `@mantine/core`       | `^9.3`  | required |
| `@mantine/hooks`      | `^9.3`  | required |

Optional peer batteries and their packages are listed per battery above.

---

## License

Apache 2.0 — use freely, modify as needed, keep attribution.
