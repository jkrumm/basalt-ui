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
with Tailwind 4 over the `--basalt-*` token layer; `basalt-ui init` writes the entry, the layout and the
nav you start from.

### 1. Install

```bash
bun add basalt-ui
```

That is the whole install. A create-vite React app already has `react`, `react-dom` and `vite`; `init`
(step 2) installs the rest of the `app` profile's peers (`tailwindcss`, `@tailwindcss/vite`,
`@base-ui/react`, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/router-plugin`, and the two
`basalt-ui/shell` imports: `@tanstack/react-hotkeys` and `@atlaskit/pragmatic-drag-and-drop`) and the lint
tools. Every peer has a range matched to how tightly basalt is coupled to it (the table in `MAINTAINING.md` §
Dependencies: a caret for a stable package, a tilde for one whose internals basalt reads, an exact pin for 0.x or alpha tooling).
`@tanstack/router-plugin` is pinned at `1.168.40` but accepts any newer 1.x. An app already on a version inside the
range keeps it, and a fresh install takes the newest one and saves it exactly. A
dependency the app already had whose version falls outside the range or pin is changed, and `init` prints
one line for it (for example `oxlint ^1.90.0` moves to the preset's pin). Installing the peers yourself first only pins them twice. A peer a subpath
needs that `init` does not install (`./charts`, `./table`) is named by `basalt()` (the Vite plugin)
as the exact `bun add` line, and `basalt-ui doctor` lists what is missing; a missing peer otherwise
surfaces as an unresolved import at build time, not as an install warning. Exact versions:
`peerDependencies` in `package.json`.

| Class            | Peers                                                                                                                                                                                                                                 | Rule                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App              | `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-hotkeys`, `@atlaskit/pragmatic-drag-and-drop`, `@base-ui/react`, `tailwindcss`, `@tailwindcss/vite`; dev: `vite`, `@tanstack/router-plugin` | `init` installs all but `react`, `react-dom` and `vite`, the app's own                                   |
| Subpath-required | `./charts`: `@tanstack/charts`, `d3-scale` · `./table`: `@tanstack/react-table` · `./content`, `./ai`: `react-markdown`, `remark-gfm`, `rehype-sanitize`, `remend`                                                                    | needed only by consumers of that subpath; declared `optional` in `peerDependenciesMeta`                  |
| Optional         | `shiki`, `@shikijs/*`, `pele`, `@tanstack/react-router-devtools`, `vite-plugin-pwa`                                                                                                                                                   | reached through `import()` only; absent, the feature degrades (dev devtools panels, plain-text markdown) |

No peer is required: every peer above is optional, `react` included, so an install pulls in only what the
subpaths you import need. The three `@fontsource-variable/*` faces are regular dependencies.

**No React?** `./tokens` imports no UI framework, and the token system is consumable with no package
at all:

```bash
bunx basalt-ui tokens:css --out src/tokens.css
```

### 2. Scaffold the app and the repo doctrine (`basalt-ui init`)

```bash
./node_modules/.bin/basalt-ui init --profile app --root src
```

`--profile` is required and never inferred: `tokens`, `site`, `bridge`, `parts` or `app`. Each `--root`
(default `.`, paths relative to the repo root) is declared with it. Step 1 installed the package, so
`init` runs from the local bin like every later command, never `bunx`. There is no
plugin, no marketplace and no second version to track. `init` writes at the git root:

- `.basalt/manifest.json` — the profile, the declared roots, the `tokens:css` outputs and the sha256 of every managed file `sync` placed
- the `tokens:css` outputs (`--tokens-out`, `--tokens-json-out`, `--extra`, with the `--accent --neutral --vibrancy --selector` flags recorded in the manifest)
- `.stylelintrc.basalt.json` for every profile; `.oxlintrc.basalt.json` and an `.oxlintrc.json` that extends it from `site` up
- the profile's peers within their declared ranges, saved exactly (stylelint and postcss-html; `site` and above add oxlint and `@shadcn/lint`), installed with the lockfile's package manager (`--no-install` prints the command instead)
- above `tokens`: `.claude/rules/basalt-*.md`, `.claude/skills/basalt-*`, the managed `<!-- basalt:begin/end -->` block in `AGENTS.md`, and a thin `DESIGN.md` seed when no declared root has one
- `.basalt/budget.json` (the seeded ceilings) and the formatter ignore for the managed paths
- `site` (static pages on Astro) writes no router scaffold and no Vite patch: `init` prints the `basaltAstro()` line for `astro.config` from `basalt-ui/astro` and the tokens stylesheet import
- with `app`, the router scaffold (the files in the tree below), each written once and never touched by `sync`; a `main.tsx` that is create-vite's stock entry is replaced, any other entry gets the template's lines printed
- `.basalt/sources.css` and `shots-*/` in the `.gitignore` beside the Vite config (once each; `basalt()` regenerates the sources file on every run, and `doctor` reports it when git tracks it; `shots-*/` holds the `shot` rounds). `init` does not install Playwright, which `shot` needs and which downloads a browser: `doctor` prints a note with the install line until the app declares it
- in a stock Vite config, `tanstackRouter(...)` and `basalt()` in `plugins`; in a stock stylesheet entry (`index.css`), the `tailwindcss` import becomes `@import 'basalt-ui/tailwind.css'`, the app's `tokens.css` when the `tokens:css` output exists, and `.basalt/sources.css`; any other shape gets the exact lines printed

```text
src/
  main.tsx                  the entry
  index.css                 stylesheet entry
  routes/__root.tsx
  routes/_app.tsx           the AppShell layout
  routes/_app/index.tsx     the start page at /, which the nav's Home item opens
  lib/nav.tsx               the one defineNav
  components/route-pending.tsx, route-error.tsx, route-missing.tsx
```

It ends in `basalt-ui doctor`, which reports, then prints the session note when its run wrote agent-read files. Running `init` twice changes nothing; `sync` refreshes
what `init` placed and never creates an install.

The editor hook runs `basalt-ui lint` after each edit. Claude Code labels a finding it prints "PostToolUse:Write hook blocking error": the file was written, and the finding blocks the turn until you fix it.

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

<!-- readme-check: skip init writes this file and the ones it imports; the template is tested with the CLI -->

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
const defaults = routerDefaults()

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
defaults.bind(router)

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

<!-- readme-check: skip init writes this route and the nav it imports; the template is tested with the CLI -->

```tsx
// src/routes/_app.tsx — the frame every signed-in page renders in
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from 'basalt-ui/shell'
import { NAV } from '../lib/nav'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
  return (
    <AppShell nav={NAV} brand={{ name: 'MyApp' }}>
      <Outlet />
    </AppShell>
  )
}
```

<!-- readme-check: skip defineNav is typed by the app's Register, which init's router scaffold declares -->

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

## Compose a page

`node_modules/basalt-ui/docs/` holds one page per documented export. For a dashboard page read these first, in this order:

1. [`page`](docs/page.md): the root every route returns; it owns the gutter.
2. [`stat-group`](docs/stat-group.md) and [`stat-card`](docs/stat-card.md): the strip of headline figures.
3. [`chart-card`](docs/chart-card.md) and [`cartesian-chart`](docs/cartesian-chart.md): a chart in its card.
4. [`data-table`](docs/data-table.md): the records under the chart.
5. [`section`](docs/section.md): a titled group with its own `controls` slot.

The card props are typed by five shared types, each with its own page: [`delta`](docs/delta.md), [`verdict`](docs/verdict.md), [`empty`](docs/empty.md), [`foot-facts`](docs/foot-facts.md) and [`fact`](docs/fact.md). Read them before the `.d.ts` files.

---

## Configuration (the `basalt` key)

`init` writes a real `"basalt"` key from your actual layout, and everything derives from it — the
lint and stylelint scan, the seeded CI `oxfmt` globs, the rule `paths:`:

```json
// package.json — `roots` is written by init and backfilled by sync; the rest are yours to add
{
  "basalt": {
    "roots": ["apps/web/src"]
  }
}
```

`doctor` check 5 fails loudly (instead of a false `✓`) when the configured roots resolve to zero
files for the v3 lint and stylelint scans. Each root's **parent** also contributes its `index.html`
and its `public/` tree — the Vite layout `basaltViteConfig` assumes. The keys of the 2.x text guard
(`exempt`, `include`, `profile`, `severity`, `exemptRules`, `spacingSteps`, `forbiddenAccents`,
`rawRadius` and the per-kind switches) are gone with `check-theme`; `MIGRATING.md` lists the row.

`sync` **backfills `roots`** when the key is absent. A declared value is never overwritten; a
layout it does not cover is reported as one line, because `roots` being a subset is the normal case
in a monorepo, not drift.

**The escape hatch is a native oxlint directive that names the rule and ends in a reason:**

```text
// oxlint-disable-next-line basalt/<id> -- <why>
```

A directive without `-- <why>` is itself a finding (`basalt/waiver-needs-reason`), and an unknown id
waives nothing. The 2.x `theme-allow` and `theme-allow-file` annotations are inert: no rule reads them.

### Consumer-series extensibility

App-specific series colours live in the consumer, authored once in the app's `basalt.tokens.ts`. `init` seeds it at `bridge` and above (`--extra <file>` at `tokens` and `site`), emits `basalt.tokens.css` from it with `tokens:css --extra`, and imports that sheet in the stylesheet entry. The file is import-free, the one place raw colour is written, and a pair is `{ light, dark }`:

```ts
// src/basalt.tokens.ts
export default {
  series: {
    app: {
      sessions: { light: '#4f78a4', dark: '#7099c4' },
      churn: { light: '#c23030', dark: '#f08c8c' },
    },
  },
} as const
```

Both uses read that one file:

```ts
import { groupTokens } from 'basalt-ui/tokens'
import tokens from './basalt.tokens'

// A chart series takes the pair as its `color`
const series = [
  {
    mark: 'line',
    key: 'sessions',
    label: 'Sessions',
    color: tokens.series.app.sessions,
    y: (d: Row) => d.sessions,
  },
]

// An HTML mark (a Meter, a track div, a dot) takes the variable the sheet declares
export const colors = groupTokens('app', tokens.series.app)
// colors.sessions → 'var(--basalt-app-sessions)'
```

After an edit, regenerate the sheet: `basalt-ui tokens:css --extra src/basalt.tokens.ts --out src/basalt.tokens.css` (`doctor` re-runs it with `--check` for every row of the manifest). The sheet also writes `basalt.tokens.css.d.ts`, which registers the keys on `BasaltRegister`, so write no `declare module` of your own. `vars: { <name>: '<css value>' }` beside `series` emits `--basalt-<name>` once on `:root`. A ramp entry (`{ hue: 'blue', light: 3, dark: 4 }`) gives the variable only; a chart needs a literal pair.

`tokens:css --extra` is the one route. `defineSeries` and `buildPaletteCss({ groups })` are internal: the first types a pair map the CLI does not read, the second emits the same variables at runtime for a build with no CLI, and neither is documented for an app. A hand-written `BasaltRegister` series augmentation is removed from the docs: it conflicts with the generated one.

Every `defineX` factory is const-generic and exact-keyed — the return type mirrors the literal input shape, so `tsc` catches stale keys.

---

## Adapter batteries

The optional-peer batteries extend the core. Install only what you use — core resolves without them.

### `./charts` — TanStack Charts

```bash
bun add @tanstack/charts d3-scale
```

`./charts` is framework-free (see [Framework-free boundary](#framework-free-boundary) above) but not
dependency-free: it needs `@tanstack/charts` and `d3-scale`, at `~1.5.0` and
`^4.0.2`. They ship as optional peers, not bundled dependencies, so a `./tokens`-only consumer never
installs them. visx is gone: no dependency, peer or re-export.

`CartesianChart` is the entry point: it compiles one engine definition and owns the measured
margins, both y domains, the x scale, the grid, zones, the page-shared cursor, the crosshair,
keyboard focus, the legend and the derived tooltip, so a chart supplies its `series` and returns
only marks. `label` is required. The x scale follows the value `x` returns: a `Date` is a
proportional time axis, a `number` is linear, a `string` is a point (lines) or band (bars) scale.
Marks come straight from `@tanstack/charts/*` subpaths (`basalt/import-boundary` bans the engine's
react entry); `basalt-ui/charts` re-exports none, and tokens live in `basalt-ui/tokens` and
formatting in `useFormat` from `basalt-ui`.

```tsx
import { CartesianChart } from 'basalt-ui/charts'
import tokens from './basalt.tokens'

export const Sessions = () => (
  <CartesianChart
    label="Sessions"
    data={rows}
    x={{ value: (d) => d.date }}
    series={[
      {
        mark: 'line',
        key: 'sessions',
        label: 'Sessions',
        color: tokens.series.app.sessions,
        y: (d) => d.sessions,
      },
    ]}
    y={{ format: (v) => v.toFixed(0) }}
    height={260}
  />
)
```

Shipped kinds are that same composition, pre-wired: `Lines` (n series, `area`, `thresholds`, zones,
reference lines, `y2`) and `Bars` (stacked, grouped or normalised, ± bars, overlay lines), plus `BandStrip`,
`Heatmap`, `IntervalTrack` (rows of spans over time) and `Sparkline`. The
[`MIGRATING.md`](./MIGRATING.md) § 2.x to 3.0 lists every removed or renamed chart export.

Charts share a cursor with no provider (`cursorGroup="…"` isolates one; `chartCursor(group?)` reads
it for app code), and only the chart under the pointer or keyboard focus shows a tooltip
(`tooltip.onFollow` opts a follower in); a follower still draws the leader's focus and cursor-value dots at the shared x. `x` ticks are `xTicks` (a count or the values) and
collision is the engine's `tickLabels.thin`; labels never rotate.

### `./table` — TanStack Table

```bash
bun add -E @tanstack/react-table@9.3.1 @base-ui/react
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
    mode: { kind: 'client' },
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
export const Reply = () => (
  <Markdown contentTrust="untrusted" streaming>
    {part.text}
  </Markdown>
)

// Text you author: opt in to extra tags/attributes (additions to a fixed policy that runs last).
export const Note = () => (
  <Markdown contentTrust="trusted" sanitize={{ allowTags: ['details'] }}>
    {note}
  </Markdown>
)
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
default are byte-identical to what they always emitted. Full doctrine and plugin ordering: `agent/skills/basalt-app/SKILL.md`; the `icons` option: `docs/vite.md`.

---

## Type seam (`BasaltRegister`)

`BasaltRegister` is the single declaration-merge interface consumers augment to register their app-specific shapes for exact-keyed typing. It follows the same pattern as TanStack Router's `Register` interface — augment once per concern in the concern's own file, and every battery that reads the slot gets narrow types automatically.

<!-- readme-check: skip an augmentation fragment: SERIES is the app's own and the block is not a program -->

```ts
// src/series.ts — augment the series slot
import type {} from 'basalt-ui'

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
you've upgraded away from. That includes `init`: install the package first.

## Toolchain

- **Lint**: oxlint (NOT ESLint / Biome)
- **Format**: oxfmt (NOT Prettier / Biome)
- **Runtime**: Bun
- **TypeScript**: strict mode throughout
- **Tarball ships `src/`** alongside `dist/` — go-to-definition lands in real source, not compiled output

The `./configs/*` export gives consumer apps raw presets to `extends` or copy by hand. The oxlint
presets are generated per profile — `oxlint-app.json`, `oxlint-parts.json`, `oxlint-bridge.json`, `oxlint-site.json` — and
load `basalt-ui/lint`; `basalt-ui init` and `sync` place the one your profile takes:

```json
// .oxlintrc.json
{ "extends": ["./node_modules/basalt-ui/configs/oxlint-app.json"] }
```

`tsconfig.json` `extends` resolves the SAME way, through package exports (`bundler`
`moduleResolution`, CI-verified by `scripts/pack-test.sh`) — three raw presets, `base` (the shared
strict flags), `react-app` (`base` + DOM/JSX libs) and `node` (`base` + Node types):

```json
{ "extends": "basalt-ui/configs/tsconfig.react-app.json" }
```

`tsc` checks every file in the program with the program's options, so a workspace package imported from source is checked under the preset's flags and no compiler option excludes it. Give each package its own tsconfig and link them with TS project references (`references` + `composite: true`), or consume the package's built `.d.ts`.

`.oxfmtrc.json` has no `extends` of its own — copy `configs/oxfmt.json` verbatim. `basalt-ui init`
adds the `ignorePatterns` for the managed paths to an existing file and writes a new one when none exists;
a sibling app's new file copies the repo root's formatter settings (not its `ignorePatterns`).

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
