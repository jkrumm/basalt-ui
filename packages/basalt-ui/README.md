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
// a tuning session survives a refresh. `applyOverrides`/`loadOverrides` (and `readVar`) live in
// `theme-lab/boot.ts`, a Mantine-free, SSR-safe module re-exported through this same
// `basalt-ui/theme-lab` subpath — no `document` guard needed at the call site, and it never throws
// under SSR. A production bundler that tree-shakes unused named exports drops `ThemeLabControls`'s
// Mantine imports when a prod entry (like this one) only ever names these three functions; an
// unbundled dev build still evaluates the whole subpath module.
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

### Composition order

The canonical stack, once a router and a query client join the example above:

```tsx
<BasaltProvider theme={theme}>
  <QueryClientProvider client={queryClient}>
    <BasaltOverlays>
      <RouterProvider router={router} />
    </BasaltOverlays>
  </QueryClientProvider>
</BasaltProvider>
```

The order is load-bearing, not stylistic: `BasaltProvider` auto-mounts `ConnectivityProvider`
(`./connectivity`), which aggregates React-Query's own status and so must sit **above** the query
client; `BasaltOverlays` must sit **inside** the theme, since Modals/Spotlight/Notifications
resolve `--vx-*` tokens through Mantine's context; the router goes **last** so every route
component renders with the theme, the data layer and the overlay layer already mounted above it.
`agent/rules/basalt-mantine.md` points here rather than restating the tree.

**No `'use client'` directive ships anywhere in the package.** A Next.js App Router consumer wraps
this whole composition in its own client file (`'use client'` at the top) and renders that from a
server layout — basalt stays framework-agnostic and does not guess at the boundary.

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
// Shell — sidebar / mobile nav / breadcrumbs / PageBar; router-agnostic
import { BasaltShell, NavCountBadge, PageBar } from 'basalt-ui'
import type { SidebarBlock, SidebarSection } from 'basalt-ui'
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
// package.json — `roots` is written by init and backfilled by sync; the rest are yours to add
{
  "basalt": {
    "roots": ["apps/web/src"],
    "include": ["app/manifest.json"],
    "profile": "tokens-only",
    "exemptRules": {
      "inline-display": ["agent"],
      "raw-hex": {
        "paths": ["public/site.webmanifest"],
        "reason": "a PWA manifest theme_color MUST be a literal hex — JSON cannot reference a CSS var"
      }
    }
  }
}
```

`check-theme` fails loudly (instead of a false `✓`) when the configured roots resolve to zero
scanned files, and `doctor`'s `guard-scan` check agrees with it. Each root's **parent** also
contributes its `index.html` and its `public/` tree — the Vite layout `basaltViteConfig` assumes,
and where a raw `theme-color` or webmanifest `background_color` actually lives. `.json` is never
blanket-scanned; `include` names one explicitly and is the only route to it. `profile:
"tokens-only"` turns off the 18 kinds whose remedy is a Mantine component or prop, and must be
declared (or `--tokens-only`) — it is deliberately never inferred from a missing `@mantine/core`,
which would silence half the guard on any repo keeping Mantine in a different workspace package.
Other keys (`exempt`, `severity`, `spacingSteps`, `forbiddenAccents`, …) are documented on the
`BasaltConfig` type.

**`exemptRules`** turns one kind off along a path. A pattern is a relative path
(`public/site.webmanifest`, or `src/agent` for everything under it), a glob (`*` stops at `/`, `**`
does not, and a slash-free glob is also tried against the basename, so `*.module.css` works), or a
bare path segment — the legacy shape, and the one nobody guesses, since before 1.21.0 it was the
ONLY shape and a real relative path matched nothing and said nothing. The object form records the
reason, which is what a `theme-allow` always carried and this key could not. A pattern that
suppresses nothing is now reported by a normal run and fails `--audit-allows`.

`sync` **backfills `roots`** when the key is absent — only `init` used to write it, so every
existing consumer stayed on the undeclared `src` default while `guard-scan` passed anyway. A
declared value is never overwritten; a layout it does not cover is reported as one line, because
`roots` being a subset is the normal case in a monorepo, not drift.

Basalt-emitted LINES are skipped, not whole files. The file has to earn it first — a `.css` path,
the `@generated basalt-ui` header verbatim on line 1, the version + invocation line on line 2 — and
then each line does too: at brace depth 0 a selector or a self-closing comment, inside a block only
a `--vx-*` / `--basalt-*` declaration whose value carries no `;`, a `}`, or a comment. So the
stylesheet `tokens:css` just wrote is not reported back at you, pasting the marker into a `.tsx`
suppresses nothing, and an ordinary declaration smuggled into a sheet wearing the header is
reported on its own line.

**The escape hatch is scoped, and since 1.21.0 the two scopes are spelled apart:**

```text
theme-allow                                  → this node/line, EVERY rule   (reports theme-allow-unscoped)
theme-allow <id>[, <id>…] [— <why>]          → this node/line, those rules
theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those rules; a bare one waives NOTHING
"basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON / .webmanifest
```

An annotation must **start** its comment (after `//`, `/*`, `<!--`, a block gutter `*`, or
whitespace) — before 1.21.0 any comment merely mentioning the token parsed as the bare blanket form,
so a file documenting its own waivers disarmed itself. Placements: the reported line, a comment-only
line directly above it (the only form JSX can express, and it reaches the first CODE line below,
walking through the rest of its comment block), or — in CSS — a trailing comment reaching back over
the declaration it terminates. The id slot is read strictly: a word there that names no rule waives
nothing, so a typo is never the blanket form.

`basalt-ui check-theme --audit-allows` reports every annotation and every `exemptRules` entry with
what it still suppresses, proved by re-running the scan with that one waiver neutralized. Exits 1 on
a dead waiver, so it is usable as a CI gate. Since 1.22.0 it runs **both** halves — `checkSource` for
a guard kind, oxlint over one neutralized sibling file for a plugin rule — so a waiver naming
`hand-rolled-plot` is judged rather than skipped. **It needs oxlint reachable**; where it is not, the
verdict is "cannot judge", never "dead". The report prints the scope it audited, because `0 dead`
over `basalt.roots` is not `0 dead anywhere`. Two known gaps: `basalt.exempt` is not audited at all,
and the `scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`.

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

| Subpath             | Mantine? | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.`                 | coupled  | `BasaltProvider`, `createBasaltTheme` / `baseTheme` / `cssVariablesResolver`, `BasaltShell` + sidebar / mobile nav / breadcrumbs / `PageBar`, `Section` / `WidgetHeader`, `NavCountBadge`, `SidebarAccount` + the provider-agnostic account contract (`BasaltAccountProps`/`State`/`Actions`), `ThreadWorkspace` + thread-chat components, dashboard composites (`DeltaBadge`, `StatCard`, `EmptyState`, `SettingsSection`/`SettingsRow`/`DangerZone`) and the query-branch trio `QueryState` / `LoadingState` / `ErrorState`, shell types — the root entry still re-exports the thread-chat components; `./agent-chat` takes the same components standalone, without `BasaltProvider`, the shell, the dashboard composites, or `./connectivity` |
| `./charts`          | **free** | `CartesianChart` + visx primitives, kinds, sparklines, hooks, token re-exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./tokens`          | **free** | `VX` token refs, `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `alpha`, `ColorPair` / `SeriesMap` types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `./theme-lab`       | coupled  | `ThemeLabControls`, `applyOverrides`, `loadOverrides`, `COLOR_GROUPS` for live theme inspection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `./vite`            | —        | `basaltViteConfig(opts)` — Vite preset for basalt-ui consumer apps; `basaltAppPlugin(opts)` — PWA head, manifest, and icon metadata derived from the token palette                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `./guard`           | **free** | `checkSource`, `GUARD_RULES`, `Finding` types — the headless theme-guard core; plus the annotation reader `--audit-allows` is built on: `findAllowAnnotations`, `neutralizeAllowAnnotation`, `NEUTRALIZED_ALLOW_TOKEN`, `PLUGIN_RULE_IDS`, `AllowAnnotationSite`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `./query`           | **free** | `createBasaltQueryClient`, transport-agnostic `unwrap`, lazy `BasaltQueryDevtools`, `toErrorMessage` / `errorStatus` — the only route to those two; the root barrel does not re-export them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `./router-tanstack` | **free** | TanStack Router bridge: `defineNav`/`navGroup`/`navTarget`/`flattenNav` + `useNav` (→ `{ sections, mobileNav }`), `useBasaltNav` (active route), `useRouterBreadcrumbs`, and `createSearchStore` + the `field.*` vocabulary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `./forms`           | coupled  | Mantine form adapter: `useBasaltForm`, `inputProps`, `FormErrorSummary`, `useFormDraft` (Standard Schema)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `./notifications`   | coupled  | Mantine notifications: `notify` helpers, typed registry, persisted history, `NotificationBell`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./commands`        | coupled  | Typed command bus + overlay controller, `toSpotlightActions`, `ShortcutsHelp`, `BasaltOverlays`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `./data`            | coupled  | Convenience barrel pulling both peer groups: `BasaltDataTable`, `BasaltVirtualList` (Mantine-rendered) — prefer `./data/table` / `./data/virtual` for per-feature opt-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./data/table`      | coupled  | `BasaltDataTable` — sortable data table over TanStack Table, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `./data/virtual`    | coupled  | `BasaltVirtualList` — windowed virtual list over TanStack Virtual, rendered with Mantine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `./agent`           | **free** | Headless streaming layer (`useAgentStream`, `PartList`) + multi-thread `createThreadsStore` / `useAgentThreadRuns` / outcome seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./agent-chat`      | coupled  | Mantine-styled thread-chat components over `./agent`: `ThreadWorkspace`, `ThreadFeed` (`variant`/`renderRow`), `ThreadFeedRow` (inline-expanding Slack row, lazily mounted + kept mounted), `ThreadOutcomeCard`, `ThreadDetailPanel`, `Composer`, `ThreadTranscript` (`groupConsecutive`/`affordances`/`virtualize` — windowed transcripts open at the newest message unless `initialScroll: 'start'`; `virtualize` is enabled by the optional `@tanstack/react-virtual` peer, absent it degrades to an unwindowed, height-bound pane), `threadPartRenderers` — **requires `motion`**, not merely an optional peer; see [Requirements](#requirements)                                                                                            |
| `./state`           | **free** | createPersistedState (versioned localStorage) + the store field vocabulary (field.enum/multi/range/number/boolean/string, FieldHandle, lanes) + createLocalStore, the router-free store — Mantine-free state primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `./connectivity`    | coupled  | `ConnectivityProvider` (aggregates browser/React-Query/SSE/health-check status), `useConnectivity`, `ConnectivityIndicator` — auto-mounted by `BasaltProvider`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `./content`         | coupled  | `Prose`, `CodeBlock`, `Callout`, `TableOfContents`, `ReadingProgress`, `Markdown`, `MermaidDiagram`, `ArticleLayout`, `ArticleCard` / `ArticleGrid`, `GuideLink` / `GuideDrawer`, `mdxComponents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./styles.css`      | —        | `@layer basalt` base styles, iOS input safety net, font stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `./tokens.css`      | **free** | Prebuilt `--vx-*` stylesheet — the default `buildPaletteCss()` output as a plain file, for a consumer with a bundler but no React or Mantine. **With no bundler, use the `basalt-ui tokens:css` CLI instead** and commit the emitted file: importing this subpath needs bare-specifier resolution. See [`docs/FRAMEWORK-FREE.md`](https://github.com/jkrumm/basalt-ui/blob/master/docs/FRAMEWORK-FREE.md)                                                                                                                                                                                                                                                                                                                                        |
| `./configs/*`       | —        | Raw toolchain presets — oxlint, oxfmt, tsconfig (base/react-app/node), lefthook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `./llms.txt`        | —        | Machine-readable surface map — one entry per published subpath with import specifier, description, layer, and optional peers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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

Shipped kinds (`Bars`, `MultiLine`, `StackedArea`, `ZonedLine`, `Donut`, `DualPanel`, `Heatmap`,
`BandStrip`, `MirroredBars`) are that same composition, pre-wired. The last five compose
`ChartFrame` directly, because a ring, a matrix, two panes or a strip is not a single plot rect:
**`BandStrip`** draws 1-D categorical bands with no y dimension at all (`CartesianChart` renders a
left numeric axis unconditionally, so it could never host one), and **`MirroredBars`** draws two
bar panes over one x scale and one baseline, each in its own domain. Both fold their domain by
width, hatch the share of a slot nothing measured, and share the page cursor like every other
chart.

On a strip, `series` IS the state set, so a `state` naming no entry has no colour, no legend entry
and no tooltip row. It **throws in dev**, naming the key and the valid set; in production it draws a
dashed neutral outline band — a treatment no legend entry and no state fill uses — plus an
`Unknown state` tooltip row. Drawing nothing was the old behaviour and the wrong one: on a
measured/not-measured strip a missing band claims a coverage gap. `absentState` and `MirroredBars`'
`up.key`/`down.key` are PROPS rather than data, so those throw in every environment; an
unresolvable pane key used to hide the pane and its axis, which reads as a measured zero.
`BandStripSeries.formatValue` returns `string | null`, `null` rendering an em dash — an absent
reading, distinct from `''`, which is a state whose label is the whole row.

Which x ticks get painted is `xTickValues?: (keys, xMax) => readonly string[]`, on
`CartesianChart` and forwarded by `Bars`/`MultiLine`/`StackedArea`/`ZonedLine` and both band kinds.
It resolves ahead of the `xTicks` COUNT, which is unchanged; omit both and ticks are chosen to fit.
Reach for values on a dense time axis — the tick chooser appends the final key unconditionally, so
a count that misses the last index collides two labels at the right edge at every count.

### `./query` — TanStack Query adapter

```bash
bun add @tanstack/react-query @tanstack/react-query-devtools
```

```tsx
import { createBasaltQueryClient, QueryClientProvider, unwrap } from 'basalt-ui/query'

const [client] = useState(() => createBasaltQueryClient())
// queryFn: () => unwrap(api.users.get())
```

`toErrorMessage(err, fallback?)` and `errorStatus(err)` also live here — decode an unknown thrown
value into something renderable, folding an HTTP status into the fallback when the body decodes to
nothing usable (`''`, `'{}'`, `'[object Object]'`, …).

#### Rendering a query — `QueryState`

Imported from **`basalt-ui`**, not `basalt-ui/query`: it renders Mantine, and `./query` is a
guard-enforced Mantine-free entry.

```tsx
import { QueryState } from 'basalt-ui'

function Library() {
  const q = useQuery(imageQueries.list()) // { data, isError, error, fetchStatus, refetch }
  return (
    <QueryState
      query={q}
      variant="page" // or "section"
      errorTitle="Could not load images"
      errorFallback="The request failed."
      errorAction={<Button onClick={openSupport}>Get help</Button>}
      empty={{ title: 'No images yet', description: 'Upload one to get started.' }}
      isEmpty={(d) => d.items.length === 0}
    >
      {(data) => <ImageGrid items={data.items} />}
    </QueryState>
  )
}
```

**Ship it instead of writing the switch yourself.** Rendering only the empty branch is the mistake
this exists to retire: a consumer's library showed `No images` on a **500** and a share detail
showed `Share not found` on a dropped connection, because "nothing here" is what an app renders when
nobody wrote the other three branches. `LoadingState` and `ErrorState` ship beside it as the escape
hatch for a page that must place its branches in different DOM positions.

Branch precedence, in the order it is evaluated:

| Condition                           | Renders                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `isError` and no `data`             | `ErrorState` — `errorTitle` / `errorFallback` / `errorAction`, with Retry |
| no `data`, `fetchStatus === 'idle'` | the `empty` copy (or nothing, if `empty` is omitted)                      |
| no `data`                           | `loading`, else `LoadingState`                                            |
| `data`, `isEmpty(data)`             | the `empty` copy                                                          |
| `data`                              | `children` — a node, or `(data) => node`                                  |
| `data` **and** `isError`            | a section-variant _stale data_ banner above `children`                    |

The stale-data banner carries its own fixed copy (`Showing cached data`); `errorTitle` /
`errorFallback` / `errorAction` apply to the no-data error branch only.

`query` is typed as a five-field structural subset, not TanStack's `UseQueryResult` — a
hand-composed object is legal, and basalt couples to no query-library version. That subset removes
the compiler, so **the shape is checked at runtime and a missing `isError` throws**, naming the
field. That is deliberate: a missing `isError` is exactly the bug above, and degrading quietly would
reproduce it.

### `./router-tanstack` — TanStack Router bridge

```bash
bun add @tanstack/react-router
```

```tsx
import { createSearchStore, defineNav, field, useNav } from 'basalt-ui/router-tanstack'

export const NAV = defineNav({
  groups: [
    /* navGroup(...) */
  ],
})
export const analytics = createSearchStore({
  key: 'analytics',
  fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d' }) },
})

const nav = useNav(NAV) // spread onto <BasaltShell {...nav} />
// route: validateSearch: analytics.validateSearch — nav link: search: analytics.linkSearch
```

`useBasaltNav` (active route) and `useRouterBreadcrumbs` ship here too. A control binds to
`analytics.field.range`, never to `value`/`onChange` — see `basalt-ui/controls`.

### `./forms` — Mantine form adapter

```bash
bun add @mantine/form
```

```tsx
import { useBasaltForm, inputProps, FormErrorSummary } from 'basalt-ui/forms'

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
const columns = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('amount', { header: 'Amount', meta: { align: 'right' } }),
]
// <BasaltDataTable data={rows} columns={columns} maxHeight={320} stickyHeader />
```

**Body chrome.** `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `verticalSpacing`,
`horizontalSpacing`, `withRowBorders`, `withTableBorder` (basalt defaults this one to `true`),
`striped` (`boolean | 'odd' | 'even'`), and per-column `meta: { align, numeral }`.

- `maxHeight` (or `minWidth`) renders `Table.ScrollContainer type="native"` — the same node a
  bespoke escape-hatch table should wrap itself in, so the two lanes produce identical DOM.
  `type="native"` is required, not preferred: `ScrollArea`'s custom viewport is what a sticky
  `<thead>` positions against, so the default type pins the header to the page viewport.
- `meta.align` is a `ColumnMeta` module augmentation: a typo'd key is a type error, and a value
  outside `'left' | 'center' | 'right'` throws naming the column rather than left-aligning a money
  column in silence. `meta: { numeral: false }` opts a numeric cell OUT of the mono-numeral style —
  it is an opt-out only; `numeral: true` forces nothing.
- `emptyState` renders inside a `<td colSpan>`, so the header row survives an empty table. There is
  no mode that replaces the whole table.

**Honest result:** porting argo's three tables onto these props made them 341 → **370–379** lines, 29–38
longer. Column defs cost more than JSX rows when every cell is bespoke. Adopt the props for what
they actually buy — the `type="native"` footgun, alignment stated once instead of on both `th` and
`td`, and sorting/filtering/pagination owned by basalt — not for a line count.

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
dependencies.

`icons` takes `false | { dir?: string } | readonly BasaltAppIcon[]`. The array form names the icons
the app actually has, with the manifest's own field names (`src`, `sizes`, `type`, `purpose`) plus
an optional `rel` — every entry becomes a manifest icon, and only an entry naming a `rel` reaches
the head. `icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]` is a complete,
installable icon set for a single-page app. An empty array reads as `false`; `{ dir }` and the
default are byte-identical to what they always emitted. Full doctrine, plugin ordering, and the six
default icon filenames: `agent/rules/basalt-app.md`.

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

`basalt-ui help` prints full usage (every subcommand also takes `--help`/`-h`); `AGENTS.md` at the
install directory is the machine-readable companion. Run the **local bin, not `bunx`** —
`./node_modules/.bin/basalt-ui` or a `package.json` script; `bunx` can silently run a cached version
you've upgraded away from. The one sanctioned `bunx` invocation is `init`, because nothing is
installed yet.

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

`tsconfig.json` `extends` resolves the SAME way, through package exports (`bundler`
`moduleResolution`, CI-verified by `scripts/pack-test.sh`) — three raw presets, `base` (the shared
strict flags), `react-app` (`base` + DOM/JSX libs) and `node` (`base` + Node types):

```json
{ "extends": "basalt-ui/configs/tsconfig.react-app.json" }
```

`.oxfmtrc.json` has no `extends` of its own — copy `configs/oxfmt.json` verbatim (`basalt-ui init`
does this for you).

---

## `basalt-ui sync` in CI

Wire the drift gate to catch doctrine falling behind after a basalt-ui upgrade. **The local bin,
never `bunx`** — this is what `init` seeds (`configs/check.yml`, rendered from where basalt actually
installed):

```yaml
# .github/workflows/check.yml (seeded by basalt-ui init)
- run: ./node_modules/.bin/basalt-ui sync --check
```

`sync --check` is the worst command to run from a stale `bunx` cache: it compares the consumer's
files against the **cached CLI's own** shipped doctrine, so it passes while the install has drifted.
Three consumer repos hand-corrected this exact line, and this snippet used to talk the next reader
straight back into it.

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
