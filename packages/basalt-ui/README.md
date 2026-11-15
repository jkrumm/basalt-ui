# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Opinionated framework for React apps on Base UI, Tailwind 4 and TanStack — primitives, app shell, chart system, token layer, and the agentic layer to drive them.

**[Documentation](#quick-start)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building a dashboard app means wiring a primitive set, a TanStack Charts chart system, a typed token layer, a router and an app shell — each with its own opinions, and none of them talking to each other.

Basalt UI is the extraction of that setup from a production app. Install once, get a coherent system.

---

## Quick start

A Vite + React app with TanStack Router. basalt-ui 3 is shadcn-style primitives on Base UI, styled
with Tailwind 4 over the `--vx-*` token layer; `basalt-ui init` writes the entry, the layout and the
nav you start from.

### 1. Install

```bash
bun add basalt-ui
bun add react react-dom @tanstack/react-router @tanstack/react-query @base-ui/react tailwindcss @tailwindcss/vite
bun add -d vite @tanstack/router-plugin
```

That is the set the `app` profile needs: the shell and the primitives draw Base UI, the router and
query peers carry routing and data, and Tailwind compiles the styles. Install the peers yourself — a
missing one surfaces as an unresolved import at build time, not as an install warning, and `basalt()`
(the Vite plugin) names the exact `bun add` line when a subpath you import needs another. Exact
versions: `peerDependencies` in `package.json`; `basalt-ui doctor` lists what is missing.

| Class            | Peers                                                                                                                                                                 | Rule                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App              | `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`, `@base-ui/react`, `tailwindcss`, `@tailwindcss/vite`; dev: `vite`, `@tanstack/router-plugin` | every `app` profile install                                                                              |
| Subpath-required | `./charts`: `@tanstack/charts`, `d3-scale` · `./table`: `@tanstack/react-table` · `./content`, `./ai`: `react-markdown`, `remark-gfm`, `rehype-sanitize`, `remend`    | needed only by consumers of that subpath; declared `optional` in `peerDependenciesMeta`                  |
| Optional         | `shiki`, `@shikijs/*`, `beautiful-mermaid`, `@tanstack/react-query-devtools`, `@tanstack/react-router-devtools`, `vite-plugin-pwa`                                    | reached through `import()` only; absent, the feature degrades (dev devtools panels, plain-text markdown) |

The `@mantine/*` and `@fontsource-variable/*` peers are declared required for the root theme (see
[The root](#the-root)); your package manager places them, and a v3 app imports none of them.

**No React?** `./tokens` imports no `@mantine/*`, and the token system is consumable with no package
at all:

```bash
bunx basalt-ui tokens:css --out src/tokens.css
```

See [`docs/FRAMEWORK-FREE.md`](https://github.com/jkrumm/basalt-ui/blob/master/docs/FRAMEWORK-FREE.md)
for the selector-specificity trap, the `color-mix` opacity law, and the surface-token roles.

### 2. Scaffold the app and the repo doctrine (`basalt-ui init`)

```bash
bunx basalt-ui init --profile app --root src
```

`--profile` is required and never inferred: `tokens`, `bridge`, `parts` or `app`. Each `--root`
(default `.`, paths relative to the repo root) is declared with it. `bunx` is the one sanctioned
entry here, because nothing is installed yet; every later command runs the local bin. There is no
plugin, no marketplace and no second version to track. `init` writes at the git root:

- `.basalt/manifest.json` — the profile, the declared roots, the `tokens:css` outputs and the sha256 of every managed file `sync` placed
- the `tokens:css` outputs (`--tokens-out`, `--tokens-json-out`, `--extra`, with the `--accent --neutral --vibrancy --selector` flags recorded in the manifest)
- `.stylelintrc.basalt.json` for every profile; `.oxlintrc.basalt.json` and an `.oxlintrc.json` that extends it from `bridge` up
- the profile's peers at exact pins (stylelint and postcss-html; `bridge` and above add oxlint and `@shadcn/lint`), installed with the lockfile's package manager (`--no-install` prints the command instead)
- above `tokens`: `.claude/rules/basalt-*.md`, `.claude/skills/basalt-*`, the managed `<!-- basalt:begin/end -->` block in `AGENTS.md`, and a thin `DESIGN.md` seed when no declared root has one
- `.basalt/budget.json` (the seeded ceilings) and the formatter ignore for the managed paths
- with `app`, the router scaffold, each file written once and never touched by `sync`: `src/main.tsx` (the entry), `src/routes/__root.tsx`, `src/routes/_app.tsx` (the `AppShell` layout), `src/lib/nav.tsx` (the one `defineNav`) and `src/components/route-{pending,error,missing}.tsx`; a `main.tsx` that is create-vite's stock entry is replaced, any other entry gets the template's lines printed
- in a stock Vite config, `tanstackRouter(...)` and `basalt()` in `plugins`; in a stock stylesheet entry (`src/index.css`), the `tailwindcss` import becomes `basalt-ui/tailwind.css`, the app's `tokens.css` when the `tokens:css` output exists, and `.basalt/sources.css`; any other shape gets the exact lines printed

It ends in `basalt-ui doctor`, which reports. Running `init` twice changes nothing; `sync` refreshes
what `init` placed and never creates an install.

`init` on an **existing** app is a lint-debt event, not a no-op: the generated preset switches on
whole oxlint plugins the repo was never linted against, so previously-clean code lands with real
findings on the first run. Run `oxlint .` and `./node_modules/.bin/basalt-ui lint` and triage
before your next commit. An `.oxlintrc.json` with comments is never rewritten: `init` prints the
`extends` line to add.

Every file is either **managed** (basalt owns it, `sync` refreshes it, local edits are skipped and
reported — exactly the files Claude reads, which cannot load from `node_modules`) or a **seed**
(written once, then yours forever). One rule decides which: does Claude read the file?

---

## Wire the runtime

`init` has already written the wiring; this is what it is, so you can change it. Three files carry
the app, and the root barrel (`basalt-ui`) is in none of them.

```tsx
// src/main.tsx — builds the router from `routerDefaults` and mounts it
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from 'basalt-ui/data'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { RouteError } from './components/route-error'
import { RouteMissing } from './components/route-missing'
import { RoutePending } from './components/route-pending'
import { routeTree } from './routeTree.gen'

const queryClient = createQueryClient()
const defaults = routerDefaults({ router: (): object => router })

export const router = createRouter({
  routeTree,
  context: { queryClient },
  ...defaults.options,
  Wrap: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteMissing,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <BasaltProvider link={defaults.link}>
    <RouterProvider router={router} />
  </BasaltProvider>,
)
```

`routerDefaults` sets preloading, the 300/300 pending timing, structural sharing, scroll
restoration and the route transition; its `link` goes on `BasaltProvider` once, so every link prop
(`StatCard href`, `CardAction`, `col.entity`) navigates through the router with no document load.
`createQueryClient` is the one `QueryClient` the router context carries. The pending, error and
not-found components are yours; a router with no pending component never shows pending, and
`doctor` check 12 fails on it. `Register` is what types `defineNav`, `navTarget` and every
`<Link to>`.

```tsx
// src/routes/_app.tsx — the frame every signed-in page renders in
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from 'basalt-ui/shell'
import { NAV } from '../lib/nav'

export const Route = createFileRoute('/_app')({ component: AppLayout })

export function AppLayout() {
  return (
    <AppShell nav={NAV} brand={{ name: 'MyApp' }}>
      <Outlet />
    </AppShell>
  )
}
```

```tsx
// src/lib/nav.tsx — the app's ONE navigation declaration; keep it a leaf module
import { linkOptions } from '@tanstack/react-router'
import { defineNav } from 'basalt-ui/router'

export const NAV = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'home', label: 'Home', link: linkOptions({ to: '/' }), mobile: 'tab' }],
    },
  ],
})
```

`AppShell` derives the rail, the phone tab bar and the breadcrumb from `NAV`. A route outside `_app`
(a sign-in page) renders with no shell. Pages compose `basalt-ui/page`, `basalt-ui/cards`,
`basalt-ui/table` and `basalt-ui/controls`; read `node_modules/basalt-ui/docs/<name>.md` before
guessing an import or a prop.

```ts
// vite.config.ts — the router plugin goes first: it writes routeTree.gen before React sees it
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { basalt } from 'basalt-ui/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    basalt(),
  ],
})
```

```css
/* src/index.css */
@import 'basalt-ui/tailwind.css';
@import './tokens.css';
@import '../.basalt/sources.css';
```

`./tokens.css` is the app's own `tokens:css --out` output; it follows `tailwind.css` so a retune
wins. Without a retune, leave the line out.

`basalt()` is the plugin half of the setup: the missing-peer and stale-seed build gates, eject
aliases, `.basalt/sources.css` (the `@source` lines Tailwind scans), and the document head. Options
and failure messages: `docs/vite.md`.

```json
// package.json scripts — doctor check 5 fails until something runs the lint verb
"lint": "oxlint . && basalt-ui lint"
```

> **Local consumption (sibling checkouts).** Developing against an unpublished / `file:`-linked
> basalt-ui from a sibling repo? Build `dist/` first — `bunx basalt-ui` always resolves
> `bin/basalt-ui.mjs` → `dist/cli/index.js`. And in a monorepo, add `basalt-ui` as a **root**
> devDependency (not only a leaf-workspace dep) so its bin hoists into the root
> `node_modules/.bin` — otherwise `bunx basalt-ui` silently resolves the stale published package
> from npm instead of your local checkout.

**No `'use client'` directive ships anywhere in the package.** A Next.js App Router consumer wraps
the provider in its own client file and renders that from a server layout — basalt stays
framework-agnostic and does not guess at the boundary.

---

## Configuration (the `basalt` key)

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
scanned files; `doctor` check 5 says the same of the v3 lint and stylelint scans. Each root's **parent** also
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
does not, and a slash-free glob is also tried against the basename, so `*.module.css` works), A bare
segment (`agent`) matches only a root-level path, never `src/agent`. The object form records the
reason, which is what a `theme-allow` always carried and this key could not. A pattern that
suppresses nothing is now reported by a normal run and fails `--audit-allows`.

`sync` **backfills `roots`** when the key is absent — only `init` used to write it, so every
existing consumer stayed on the undeclared `src` default while the guard passed anyway. A
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
theme-allow                                  → nothing                      (reports theme-allow-unscoped)
theme-allow <id>[, <id>…] [— <why>]          → this node/line, those rules
theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those rules
"basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON / .webmanifest
```

An annotation must **start** its comment (after `//`, `/*`, `<!--`, a block gutter `*`, or
whitespace) — before 1.21.0 any comment merely mentioning the token parsed as a blanket waiver, so a
file documenting its own waivers disarmed itself; a bare annotation now waives nothing. Placements: the reported line, a comment-only
line directly above it (the only form JSX can express, and it reaches the first CODE line below,
walking through the rest of its comment block), or — in CSS — a trailing comment reaching back over
the declaration it terminates. The id slot is read strictly: a word there that names no rule waives
nothing, so a typo never widens a waiver.

`basalt-ui check-theme --audit-allows` reports every annotation and every `exemptRules` entry with
what it still suppresses, proved by re-running the scan with that one waiver neutralized. Exits 1 on
a dead waiver, so it is usable as a CI gate. Since 1.22.0 it runs **both** halves — `checkSource` for
a guard kind, oxlint over one neutralized sibling file for a plugin rule — so a waiver naming
a plugin rule is judged rather than skipped. **It needs oxlint reachable**; where it is not, the
verdict is "cannot judge", never "dead". The report prints the scope it audited, because `0 dead`
over `basalt.roots` is not `0 dead anywhere`. Two known gaps: `basalt.exempt` is not audited at all,
and the `scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`.

`doctor` check 3 carries `ai-major-parity`: `ai` must be on one major across the workspace packages
(declared and installed), and `@ai-sdk/react` must sit on the major that pairs with it (`ai` 7 with
`@ai-sdk/react` 4: the react major is the `ai` major minus 3). A split between packages that is
intentional is written down, and the written reason is the exemption:

```json
// package.json (repo root)
{
  "basalt": {
    "aiMajorSkewReason": "apps/api streams on ai@5, apps/dashboard parses on ai@7 — the one enum value that differs is neutralized by a producer-side TransformStream in apps/api/src/stream-transform.ts"
  }
}
```

The value **is** the reason: omitting the key, or setting it to `true` or `""`, exempts nothing. The

---

## The root

The root barrel, `basalt-ui`, holds the theme (`createBasaltTheme`, `ThemeToggle`, `StatusDot`,
`StatusVerdict`) and the state seams (`persisted`, `notify`, `createChannel`, `externalField`,
`useNow`, `createFormat`). A v3 app wires itself through `basalt-ui/router` (`BasaltProvider`,
`routerDefaults`) and `basalt-ui/data` (`makeQueryClient`, `unwrap`). The 2.x provider, router
factory, command bus, agent runtime, form adapter and store layer are removed: every symbol and its
replacement is a row in [`MIGRATING.md`](./MIGRATING.md).

### Theming (2.x)

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

```tsx
// Shell — header, rail, one scrollport and (on a phone) a tab bar, resolved against the router from `nav`
import { AppShell } from 'basalt-ui/shell'
import { PageBar } from 'basalt-ui/page'
```

> Use the **layered** `*.layer.css` bundles, never the plain ones — Mantine's unlayered bundle
> outranks basalt's `@layer basalt` styles (including the iOS 16px input floor) regardless of
> specificity. `basalt-ui/styles.css` already imports the core layer bundle.

---

## Subpath exports

The subpaths below, plus the v3 ones a new app imports: `./shell` (`AppShell`), `./router`, `./data`, `./page`, `./cards`, `./ai`, `./ui/*` and `./core/*`; each is a `## basalt-ui/<subpath>` section of `llms.txt`. One import path per symbol; named exports only — no default exports.

| Subpath        | Purpose                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`            | The theme (`createBasaltTheme`, `ThemeToggle`, `StatusDot`, `StatusVerdict`, `useCoarsePointer`) and the state seams (`persisted`, `notify`, `createChannel`, `externalField`, `useNow`, `createFormat`). Reaches no subpath-required peer. |
| `./tokens`     | **Mantine-free.** `VX` token refs, `alpha`, `defineSeries`, `seriesTokens`, `groupTokens`, `buildPaletteCss`, layout (`BP`, `p`, `CONTAINER_*`)                                                                                             |
| `./charts`     | **Mantine-free.** `CartesianChart` + the `Lines`/`Bars`/`Sparkline`/`Heatmap`/`BandStrip` kinds, `ChartCard`, `chartCursor` on `@tanstack/charts`                                                                                           |
| `./controls`   | `FilterSet` over `spec(...)`, `ViewTabs`, `ControlView`, `ControlHome`, `filterSlot`, `FormField`, `FormRow`, `FormFooter`, `useFormDraft`, `toSubmitErrors`                                                                                |
| `./table`      | `col<Row>()` kind columns, `useDataTable`, `DataTable` and its parts, `tableCodec`, the contract types                                                                                                                                      |
| `./format`     | `Intl`-backed, React-free formatting: `integer`, `money`, `percent`, `durationClock`, `relativeTime`, `weekday`, `km`, `kcal`                                                                                                               |
| `./content`    | `Markdown` (required `contentTrust`; the untrusted arm renders no images)                                                                                                                                                                   |
| `./vite`       | `basaltViteConfig(opts)` preset, `basalt(opts)` build gates, sources.css, head / manifest                                                                                                                                                   |
| `./styles.css` | The one stylesheet: `@layer basalt` base styles, iOS input floor, fonts                                                                                                                                                                     |
| `./configs/*`  | Raw toolchain presets — oxlint, oxfmt, tsconfig (base/react-app/node), lefthook                                                                                                                                                             |

**Static pages and CSS entries.** `./tokens.css`, `./typography.css`, `./prose.css` and `./fonts.css` are plain CSS with no JS, Tailwind or framework behind them, so an Astro or any static page takes the same tokens as an app: `@import 'basalt-ui/tokens.css'` (and the others it needs). `./table.css` is the same kind of entry (the table tiers, in `@layer basalt.table`); an app that imports `./table` imports it. `./tailwind.css` is the Tailwind 4 bridge and the only one that needs Tailwind.

`basalt-ui tokens:css` emits the prebuilt `--vx-*` stylesheet. Every dropped 1.x subpath and its new home:
[`MIGRATING.md`](./MIGRATING.md) § 2.x to 3.0.

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

Every `defineX` factory is const-generic and exact-keyed — the return type mirrors the literal input shape, so `tsc` catches stale keys.

---

## Adapter batteries

The optional-peer batteries extend the core. Install only what you use — core resolves without them.

### `./charts` — TanStack Charts

```bash
bun add @tanstack/charts d3-scale
```

`./charts` is Mantine-free (see [Mantine-free boundary](#mantine-free-boundary) above) but not
dependency-free: it needs `@tanstack/charts` and `d3-scale`, both pinned exact (`1.5.0` and
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
reference lines, `y2`) and `Bars` (stacked, grouped or normalised, ± bars, overlay lines), plus `BandStrip`,
`Heatmap` and `Sparkline`. The
[`MIGRATING.md`](./MIGRATING.md) § 2.x to 3.0 lists every removed or renamed chart export.

Charts share a cursor with no provider (`cursorGroup="…"` isolates one; `chartCursor(group?)` reads
it for app code), and only the chart under the pointer or keyboard focus shows a tooltip
(`tooltip.onFollow` opts a follower in); a follower still draws the leader's focus and cursor-value dots at the shared x. `x` ticks are `xTicks` (a count or the values) and
collision is the engine's `tickLabels.thin`; labels never rotate.

### `./table` — TanStack Table

```bash
bun add -E @tanstack/react-table@9.2.8 @base-ui/react
```

```tsx
import { DataTable, col, useDataTable } from 'basalt-ui/table'

const c = col<Row>()
const columns = [c.text('name'), c.number('amount')]

function Orders({ rows }: { rows: readonly Row[] }) {
  const table = useDataTable({
    id: 'orders',
    label: 'Orders',
    columns,
    data: rows,
    getRowId: (row) => row.id,
    mode: 'client',
  })
  return <DataTable table={table} />
}
```

Columns come from the kind constructors, never a raw column; a client table has no `rowCount`, a
server table has a `rowCount` or a `cursor`, never both. View state persists through a `ViewStore`.
The per-part references are in `docs/data-table.md`, `docs/use-data-table.md` and `docs/table.md`.

### `./content` — markdown

```bash
bun add react-markdown remark-gfm rehype-sanitize remend
```

All four are required by `basalt-ui/content` and imported statically: the first server render, the
client render and the hydrate produce the same sanitized tree, and a missing peer is an install
error, never a degraded or unsanitized render. `Markdown` is the package's **only** markdown
renderer — it backs long-form content and AI chat alike:

```tsx
import { Markdown } from 'basalt-ui/content'

// Model or third-party text: no images (alt text only), links limited to same-origin, https:,
// mailto: and tel:, and neither `sanitize` nor `rehypePlugins` is accepted.
<Markdown contentTrust="untrusted" streaming>{part.text}</Markdown>

// Text you author: opt in to extra tags/attributes (additions to a fixed policy that runs last).
<Markdown contentTrust="trusted" sanitize={{ allowTags: ['details'] }}>{note}</Markdown>
```

`contentTrust` is required and has no default. `streaming` is a rendering mode only — it says the
text is still arriving, not who wrote it; a finished agent message is settled and still untrusted.
A missing or unknown `contentTrust` renders as untrusted. `images="same-origin"` on the untrusted
arm admits relative image sources. Styling goes on a wrapper element: the root is
`data-slot="markdown"` and takes no `className`.

### `./vite` — PWA / head metadata (optional peer)

`basalt()` (see [Wire the runtime](#wire-the-runtime) above) needs no install by default — its
`app.serviceWorker` option is the only part with an optional peer, and it's off unless you opt in:

```bash
bun add -D vite-plugin-pwa workbox-build workbox-window   # only if serviceWorker is enabled
```

Without the peer installed, `serviceWorker: true` degrades to a one-line console warning (no
service worker, no crash) — everything else (theme-color meta, the pre-paint theme script,
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
// src/series.ts — augment the series slot
declare module 'basalt-ui' {
  interface BasaltRegister {
    series: typeof SERIES
  }
}
```

Current slots: `series` (read by `./charts` + `./tokens`) and `notifications` (the kinds `notify` accepts beyond the four it ships). An un-augmented slot defaults to a never-keyed `{}` — augment only the slots you use.

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

The `./configs/*` export gives consumer apps raw presets to `extends` or copy by hand:

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

`tsc` checks every file in the program with the program's options, so a workspace package imported from source is checked under the preset's flags and no compiler option excludes it. Give each package its own tsconfig and link them with TS project references (`references` + `composite: true`), or consume the package's built `.d.ts`.

`.oxfmtrc.json` has no `extends` of its own — copy `configs/oxfmt.json` verbatim. `basalt-ui init`
only adds the `ignorePatterns` for the managed paths.

---

## `basalt-ui sync` in CI

Wire the drift gate to catch doctrine falling behind after a basalt-ui upgrade. **The local bin,
never `bunx`** — `init` does not write the workflow; add this step to your own:

```yaml
# .github/workflows/check.yml
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
