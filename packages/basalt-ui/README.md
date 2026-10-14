# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Opinionated framework for Mantine v9 + TanStack Charts React apps — theme, app shell, chart system, and the agentic layer to drive them.

**[Documentation](#quick-start)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building a dashboard app means wiring a Mantine theme, a TanStack Charts chart system, a typed token layer, and an app shell — each with its own opinions, and none of them talking to each other.

Basalt UI is the extraction of that setup from a production app. Install once, get a coherent system.

---

## Quick start

### 1. Install

```bash
bun add basalt-ui
bun add react react-dom @mantine/core @mantine/hooks @mantine/modals @mantine/notifications @mantine/spotlight \
  @tanstack/react-router @tanstack/react-query \
  @fontsource-variable/hubot-sans @fontsource-variable/jetbrains-mono @fontsource-variable/nunito-sans
```

That is the **required** set: `BasaltProvider` mounts the router, Query, Modals, Notifications and
Spotlight, and `basalt-ui/styles.css` imports the three fonts. Install the peers yourself — a
missing one surfaces as an unresolved import at build time, not as an install warning. A real app
also needs `@types/react @types/react-dom` (dev) and a standard Vite `vite-env.d.ts`. Exact
versions: `peerDependencies` in `package.json`.

| Class            | Peers                                                                                                                                                                                                                                                                                                     | Rule                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Required         | `react`, `react-dom`, `@mantine/{core,hooks,modals,notifications,spotlight}`, `@tanstack/react-router`, `@tanstack/react-query`, the three `@fontsource-variable/*`                                                                                                                                       | every consumer; `.` or `./styles.css` imports or names it                                                |
| Subpath-required | `./charts`: `@tanstack/charts`, `d3-scale` · `./commands`: `@tanstack/react-hotkeys` · `./agent`: `ai`, `@ai-sdk/provider`, `motion` · `./table`: `@tanstack/react-table` · `./forms`: `@mantine/form` · `./controls-dates`: `@mantine/dates`, `dayjs` · `./content`: `react-markdown` · `./vite`: `vite` | needed only by consumers of that subpath; declared `optional` in `peerDependenciesMeta`                  |
| Optional         | `remend`, `shiki`, `@shikijs/*`, `beautiful-mermaid`, `remark-gfm`, `rehype-sanitize`, `@tanstack/react-query-devtools`, `@tanstack/react-router-devtools`, `vite-plugin-pwa`                                                                                                                             | reached through `import()` only; absent, the feature degrades (dev devtools panels, plain-text markdown) |

**No React?** `./tokens` imports no `@mantine/*`, and the token system is consumable with no package
at all:

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

- `.claude/rules/basalt-*.md` — six Claude Code rules (`basalt-tokens`, `basalt-mantine`, `basalt-charts`, `basalt-state`, `basalt-controls`, `basalt-batteries`), each with a generated coverage header naming what enforces it
- `.claude/skills/basalt-{app,design,charts}/SKILL.md` — the three skills (`/basalt-app`, `/basalt-design`, `/basalt-charts`), same managed path as the rules
- A managed `<!-- basalt:begin/end -->` block in `AGENTS.md` — stack facts, the DESIGN.md pointer, and the frontend-design restraint override
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

After `bunx basalt-ui init`, two files wire the app. `BasaltProvider` owns the whole provider tree —
Mantine + theme, Query, Modals (wrapping the router), the router, Notifications, Spotlight, the root
error boundary, command hotkeys, and in dev the dev dock. Canonical reference:
`apps/playground/src/main.tsx`.

```tsx
// src/main.tsx
import '@mantine/notifications/styles.layer.css'
import '@mantine/spotlight/styles.layer.css'
import 'basalt-ui/styles.css'
import { createRoot } from 'react-dom/client'
import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import { routeTree } from './routeTree.gen'
import { telemetry } from './lib/telemetry'
import './lib/commands'

const router = createBasaltRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <BasaltProvider router={router} telemetry={telemetry} />,
)
```

```tsx
// src/routes/__root.tsx
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { BasaltShell, type BasaltRouterContext } from 'basalt-ui'
import { NAV } from '../lib/nav'

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  component: () => (
    <BasaltShell brand={{ name: 'Argo' }} nav={NAV}>
      <Outlet />
    </BasaltShell>
  ),
})
```

`createBasaltRouter({ routeTree, context?, query? })` creates one `QueryClient` per call (1.x
defaults, `query` merges over them) and carries it on `context.queryClient`; extra context extends
`BasaltRouterContext`. `BasaltProvider` takes `router` (required), `theme` (defaults to
`createBasaltTheme()`), `telemetry` (typed `BasaltEvent`s, no sink → no events) and `fallback` (the
root error boundary's UI).

> Use the **layered** `*.layer.css` bundles, never the plain ones — Mantine's unlayered bundle
> outranks basalt's `@layer basalt` styles (including the iOS 16px input floor) regardless of
> specificity. `basalt-ui/styles.css` already imports the core layer bundle.

**No `'use client'` directive ships anywhere in the package.** A Next.js App Router consumer wraps
the provider in its own client file and renders that from a server layout — basalt stays
framework-agnostic and does not guess at the boundary.

### Theming

The shipped palette isn't a fixed set of hexes — it's **generated** from one accent seed + five
bounded knobs, with contrast guaranteed by derivation rather than hand-tuning:

```ts
const theme = createBasaltTheme(
  {/* app deltas only */},
  { derive: { accent: '#7c3aed', neutral: 'zinc', vibrancy: 1 } },
)
```

`derive` accepts `accent` (hex seed), `neutral` (`'zinc' | 'neutral' | 'stone' | 'slate'`), and
`lightLevel` / `darkLevel` / `vibrancy` / `accentBrightness` (`-5..5`, all optional — omitted knobs
keep the shipped default). Never hand-edit a palette hex to retune the identity.

`paletteOptions={{ groups: paletteGroups }}` on `BasaltProvider` emits your app-specific series
colors (see [Consumer-series extensibility](#consumer-series-extensibility) below) alongside the
framework palette. Skip it if you have no app-specific series yet.

> **SSR only:** Next.js / React Router (SSR) consumers must additionally render
> `<ColorSchemeScript defaultColorScheme="dark" />` (matching `BasaltProvider`'s default) in the
> document `<head>` to avoid a flash of the wrong theme during hydration. Plain Vite CSR apps don't
> need it — there is no hydration to mismatch. See `docs/MANTINE-THEMING.md`.

```tsx
// Shell — sidebar / mobile nav / breadcrumbs / PageBar; resolved against the router from `nav`
import { BasaltShell, PageBar } from 'basalt-ui'
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
scanned files, and `doctor`'s `guard-scan` check agrees with it — it shares `scannableFiles` with
`check-theme`, so the two cannot disagree about what would be scanned. (`guard-scan` and
`install-parity` were absent from `doctor` for four minors up to 1.29.2, with no MIGRATING row, and
are back in 1.30.0. While they were gone a consumer CI step that ran `doctor` to catch an
install/manifest version mismatch caught nothing, zero-file roots could ship as a permanently green
guard, and this sentence described a check that did not exist.) Each root's **parent** also
contributes its `index.html` and its `public/` tree — the Vite layout `basaltViteConfig` assumes,
and where a raw `theme-color` or webmanifest `background_color` actually lives. `.json` is never
blanket-scanned; `include` names one explicitly and is the only route to it. `profile:
"tokens-only"` turns off the 16 kinds whose remedy is a Mantine component or prop, and must be
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
a plugin rule is judged rather than skipped. **It needs oxlint reachable**; where it is not, the
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

15 subpaths. One import path per symbol; named exports only — no default exports.

| Subpath            | Purpose                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                | Wiring (`BasaltProvider`, `createBasaltTheme`, `createBasaltRouter`, `unwrap`), shell + nav (`BasaltShell`, `PageBar`, `PageAside`, `defineNav`, `navGroup`, `flattenNav`, `useBasaltNav`), dashboard atoms (`Section`, `StatCard`, `EmptyState`, `SettingsSection`, …) |
| `./tokens`         | **Mantine-free.** `VX` token refs, `alpha`, `defineSeries`, `seriesTokens`, `groupTokens`, `buildPaletteCss`, layout (`BP`, `p`, `CONTAINER_*`)                                                                                                                         |
| `./charts`         | **Mantine-free.** `CartesianChart` + the `Lines`/`Bars` kinds, `ChartCard`, `chartCursor` on `@tanstack/charts`                                                                                                                                                         |
| `./controls`       | `FilterSet` + the `FieldHandle`-bound filters, `ViewTabs`, `SyncButton`, `FormRow`, `FormGroup`                                                                                                                                                                         |
| `./controls-dates` | `DateRangePicker` — its own subpath so `./controls` resolves with no `@mantine/dates`                                                                                                                                                                                   |
| `./forms`          | `useBasaltForm`, `inputProps`, `fieldKey` on `@mantine/form`                                                                                                                                                                                                            |
| `./state`          | `field`, `createSearchStore`, `createLocalStore`, `createPersistedState`                                                                                                                                                                                                |
| `./table`          | `BasaltDataTable`, `createColumnHelper<Row>()` over TanStack Table                                                                                                                                                                                                      |
| `./format`         | `Intl`-backed, React-free formatting: `integer`, `money`, `percent`, `durationClock`, `relativeTime`, `weekday`, `km`, `kcal`                                                                                                                                           |
| `./commands`       | `defineCommands`, `defineOverlays`, `overlays`, `setColorScheme`, `toggleSidebar`, `ShortcutsHelp`, `defineNotifications`, `emit`, `NotificationBell`                                                                                                                   |
| `./agent`          | Streaming-chat runtime (`aiSdkTransport`, `useAgentThreadRuns`, `parseAgentPart`) and its Mantine chat UI (`ThreadFeed`, `ThreadFeedRow`, `Composer`, `ToolChip`)                                                                                                       |
| `./content`        | `Prose`, `Markdown`, `Callout`, `TableOfContents`, `ArticleLayout`, `GuideLink`                                                                                                                                                                                         |
| `./vite`           | `basaltViteConfig(opts)` preset, `basaltAppPlugin(opts)` PWA head / manifest / icons                                                                                                                                                                                    |
| `./styles.css`     | The one stylesheet: `@layer basalt` base styles, iOS input floor, fonts                                                                                                                                                                                                 |
| `./configs/*`      | Raw toolchain presets — oxlint, oxfmt, tsconfig (base/react-app/node), lefthook                                                                                                                                                                                         |

The theme lab and the dev dock are mounted by `BasaltProvider` in dev only; `basalt-ui tokens:css`
emits the prebuilt `--vx-*` stylesheet. Every dropped 1.x subpath and its new home:
[`MIGRATING.md`](./MIGRATING.md) § 2.0.0.

---

## Mantine-free boundary

`./charts` and `./tokens` import zero `@mantine/*`. `@visx/*` is banned everywhere, and `@tanstack/charts/react` is imported by `src/charts/host.tsx` alone. The root barrel (`.`) does not re-export `./charts` or `./tokens`.

The Mantine-free part protects two things. First, layering: `tokens` is pure data that `cssVariablesResolver` reads to bind Mantine's surfaces to the same `--vx-*` vars charts use, so an `@mantine/*` import in either would cycle back through the theme layer or let a chart bypass `--vx-*` and fork chrome/charts apart. Second, packaging: `./charts` and `./tokens` resolve and render with **no `@mantine/*` installed** — a charts/tokens-only consumer never pulls Mantine into their bundle. This is real and CI-tested (`scripts/pack-test.sh`'s "charts/tokens-only (no-Mantine) resolution + render" step scratch-installs the tarball with only `react`/`react-dom` and SSR-renders `basalt-ui/charts`; `scripts/check-dist-layering.mjs` walks the built dist graph and fails if those entries reach `@mantine/*`; the root barrel not re-exporting them is the third leg). The LAYER is Mantine-free — the FRAMEWORK is not: `.` requires Mantine (`@mantine/core`/`@mantine/hooks` are required, non-optional peers); only `./charts`/`./tokens` don't. Both consequences are a basalt-internal invariant enforced by the repo-local-only `basalt/token-layer-boundary` oxlint plugin rule — not a consumer contract, so it is deliberately absent from the shipped consumer preset. The chart-engine part (`basalt/chart-engine-boundary`: no `@visx/*`, and `@tanstack/charts` only through an allowlist of mark subpaths) IS shipped, so that constraint holds downstream too.

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
// src/lib/series.ts — the ONE path check-theme exempts by default (see the note below)
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

> **Put it at `<first basalt.root>/lib/series.ts`, or the guard reports it.** `defineSeries` takes
> hex `ColorPair`s _by type_, so this is the one file the doctrine tells you to write raw hex in —
> and the exemption is an exact PATH, not a shape: `check-theme` skips
> `<first basalt.root>/lib/series.ts` (the same value `DESIGN.md`'s `{{SERIES_MODULE_PATH}}`
> renders, so the two cannot drift), and nothing special-cases a file merely _because_ it calls
> `defineSeries`. A series module anywhere else — `src/theme/series.ts`, say — reports `raw-hex`
> twice per pair. Two ways out, and the second is not the same as the first:
>
> ```json
> // package.json — `seriesModulePath` MOVES the default exemption; `exempt` REPLACES it wholesale
> { "basalt": { "seriesModulePath": "src/theme/series.ts" } }
> ```
>
> Writing your own `basalt.exempt` array REPLACES the series default rather than adding to it, so
> list your series module in that array explicitly whenever you use the key at all.

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

### `./charts` — TanStack Charts

```bash
bun add @tanstack/charts d3-scale
```

`./charts` is Mantine-free (see [Mantine-free boundary](#mantine-free-boundary) above) but not
dependency-free: it needs `@tanstack/charts` and `d3-scale`, both pinned exact (`1.1.0` and
`4.0.2`). They ship as optional peers, not bundled dependencies, so a `./tokens`-only consumer never
installs them. visx is gone: no dependency, peer or re-export.

`CartesianChart` is the entry point: it compiles one engine definition and owns the measured
margins, both y domains, the x scale, the grid, zones, the page-shared cursor, the crosshair,
keyboard focus, the legend and the derived tooltip, so a chart supplies its `series` and returns
only marks. `ariaLabel` is required. The x scale follows the value `x` returns: a `Date` is a
proportional time axis, a `number` is linear, a `string` is a point (lines) or band (bars) scale.
Marks come straight from `@tanstack/charts/*` subpaths (`basalt/chart-engine-boundary` allowlists
them); `basalt-ui/charts` re-exports none, and tokens and formatters live in `basalt-ui/tokens` and
`basalt-ui/format`.

```tsx
import { lineY } from '@tanstack/charts/line'
import { CartesianChart } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
;<CartesianChart
  ariaLabel="Sessions"
  data={rows}
  x={(d) => d.date}
  series={[{ key: 'sessions', label: 'Sessions', color: VX.accent, getValue: (d) => d.sessions }]}
  y={{ format: (v) => v.toFixed(0) }}
  height={260}
  marks={(plot) =>
    plot.visible.map((s) =>
      lineY(plot.rows(s.key), { x: (row) => row.x, y: 'y', z: 'series', stroke: s.color }),
    )
  }
/>
```

Shipped kinds are that same composition, pre-wired: `Lines` (n series, `area`, `thresholds`, zones,
reference lines, `y2`) and `Bars` (stacked, grouped or normalised, ± bars, overlay lines), plus `StackedArea`,
`DualPanel`, `MirroredBars`, `BandStrip`, `Donut`, `Heatmap` and `Sparkline`. The
[`MIGRATING.md`](./MIGRATING.md) § 2.0.0 Charts table maps every 1.x chart export.

Charts share a cursor with no provider (`cursorGroup="…"` isolates one; `chartCursor(group?)` reads
it for app code), and only the chart under the pointer or keyboard focus shows a tooltip
(`tooltip.onFollow` opts a follower in). `x` ticks are `xTicks` (a count or the values) and
collision is the engine's `tickLabels.thin`; labels never rotate.

### Query — `unwrap` (root barrel)

`createBasaltRouter` owns the `QueryClient` (one per call, `context.queryClient`); there is no
separate client factory. `unwrap` turns an Eden-style `{ data, error }` envelope into a thrown error
so `useQuery` sees it. TanStack itself (`useQuery`, `queryOptions`) is imported straight from
`@tanstack/react-query`, never re-exported by basalt.

```tsx
// queryFn: () => unwrap(api.users.get())
```

Dev only: the dock `BasaltProvider` mounts holds the router and query devtools; open them from
Spotlight (`dev.router`, `dev.query`, `dev.theme`). Install the optional
`@tanstack/react-router-devtools` / `@tanstack/react-query-devtools` to get those panels.

### Nav and stores — `.` and `./state`

```tsx
import { defineNav, navGroup } from 'basalt-ui'
import { createSearchStore, field } from 'basalt-ui/state'

export const NAV = defineNav({
  groups: [/* navGroup(...) */],
})
export const analytics = createSearchStore({
  key: 'analytics',
  fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d' }) },
})

// <BasaltShell nav={NAV} /> resolves the sidebar, mobile bar and breadcrumb
// route: validateSearch: analytics.validateSearch — nav link: search: analytics.linkSearch
```

`defineNav` needs the `Register` augmentation from `main.tsx` (it validates links against the route
tree); `useBasaltNav` returns the active route. A control binds to `analytics.field.range`, never to
`value`/`onChange` — see `basalt-ui/controls`.

### `./forms` — Mantine form adapter

```bash
bun add @mantine/form
```

```tsx
import { useBasaltForm, inputProps } from 'basalt-ui/forms'

const form = useBasaltForm({ initialValues: { email: '' } })
```

### `./commands` — command bus, overlays, notifications

```bash
bun add @tanstack/react-hotkeys
```

`BasaltProvider` mounts `ModalsProvider`, `Notifications` and `Spotlight`, and binds every
`defineCommands` shortcut (the hotkeys runtime loads lazily; absent the peer, shortcuts simply do not
bind). The subpath is only what an app declares and calls:

```tsx
import { defineCommands, defineNotifications, emit, overlays } from 'basalt-ui/commands'

export const COMMANDS = defineCommands({
  'file:save': { label: 'Save', group: 'File', shortcut: 'Mod+S', run: () => save() },
})
// commands appear in Spotlight (Mod+K) alongside the `defineNav` destinations
await overlays.confirm({ title: 'Discard draft?', onConfirm: () => reset() })
```

### `./table` — TanStack Table

```bash
bun add -E @tanstack/react-table@9.2.8
```

```tsx
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'

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
bun add ai @ai-sdk/provider motion use-stick-to-bottom
```

`aiSdkTransport` (over the `ai` package) is the one transport and `useAgentThreadRuns` the one
runner: it streams one turn per thread, concurrently, over a consumer-owned `ThreadsStore`. The chat
UI (`ThreadFeed`, `ThreadFeedRow`, `Composer`, `ToolChip`) ships from the same subpath.

```tsx
import { aiSdkTransport, useAgentThreadRuns, ThreadFeed, Composer } from 'basalt-ui/agent'

const transport = aiSdkTransport({ api: '/api/chat' })
const { runs, start, stop } = useAgentThreadRuns({ transport, store, resolveOutcome })
```

The feed shows only the distilled `{ title, summary }` outcome, never the raw prompt or thinking. It
ships no markdown renderer — pass `./content`'s `Markdown` where a part needs one. Doctrine:
`agent/rules/basalt-agent.md`.

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

Current slots: `series` (read by `./charts` + `./tokens`), `commands` (read by `./commands`), and `overlays` / `notifications` (both read by `./commands`). An un-augmented slot defaults to a never-keyed `{}` — augment only the slots you use.

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

`configs/oxlint-basalt.json` is the guard lane alone — the `basalt/*` rules, none of the generic
jsx-a11y / unicorn / import set — for a repo with history to take first; `oxlint.json` extends it.

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

Peers by class — required, subpath-required and optional — are listed under
[Install](#1-install); exact ranges are in `packages/basalt-ui/package.json`. Optional peers that a
subpath uses are named in that subpath's section above.

---

## License

Apache 2.0 — use freely, modify as needed, keep attribution.
