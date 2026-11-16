## basalt-ui — Agent Quick Reference

> Maintaining this package? Read `packages/basalt-ui/MAINTAINING.md` first (repo-only — not in the tarball).

React 19 framework on Base UI and Tailwind 4: `BasaltProvider` (`basalt-ui/router`), app shell, TanStack Charts
chart system with a three-tier `--basalt-*` CSS-variable token system, and TanStack adapter batteries.
Toolchain: Bun runtime, oxlint + oxfmt, conventional commits (empty scope), `master` branch.

## Subpath ownership

The package ships the subpaths in the table below (the table is the contract).
Everything else is internal: `./guard`, `./data/virtual`, `./llms.txt`
and `./package.json` are **not exports** (`llms.txt` still ships in the tarball as a file;
`basalt-ui tokens:css` emits the token stylesheet).

| Subpath                  | Layer           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt-ui`              | mantine-coupled | The state seams (`persisted`, `notify`, `externalField`, `useNow`, `createFormat`, `useFormat`). Reaches no subpath-required peer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `basalt-ui/charts`       | headless        | CartesianChart (the TanStack Charts rung), the Lines, Bars, Sparkline, Heatmap and BandStrip kinds, ChartCard, the shared chartCursor and the geometry seam: useChartFocus (focus, dim the rest, one bound readout) and chartLabels (server-equal label width and placement) (Mantine-free; @tanstack/charts + d3-scale peers)                                                                                                                                                                                                                                                                                                                                                                                    |
| `basalt-ui/tokens`       | headless        | BASALT token refs, buildPaletteCss, defineSeries, seriesTokens, groupTokens, alpha (Mantine-free)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `basalt-ui/vite`         | build-tooling   | basalt(opts) — v3 plugin: peer and seed build gates, eject aliases, `.basalt/sources.css`, theme script, theme-color and manifest; basaltViteConfig(opts) — 2.x Vite preset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `basalt-ui/table`        | mantine-coupled | `DataTable` over `useDataTable`, the `col` kind columns, the parts `DataTable` composes (`TableToolbar`, `DataTableBody`, `TablePager`, `BulkBar`) and `tableCodec`, on TanStack Table v9 and `ui/*` primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `basalt-ui/content`      | mantine-coupled | Markdown (react-markdown + remark-gfm + rehype-sanitize + remend, all required peers, every import static so server, client and hydrate render the same tree; `contentTrust` is REQUIRED and independent of `streaming`, which is a rendering mode only — render agent or model output with `contentTrust="untrusted"`: no `<img>` (alt text; `images="same-origin"` admits relative srcs), links limited to same-origin, https:, mailto: and tel:, and no `sanitize` or `rehypePlugins`; `contentTrust="trusted"` takes `sanitize` ({ allowTags, allowAttrs } additions over a fixed policy that runs last) and `rehypePlugins`; a missing or unknown `contentTrust` renders as untrusted) — the content surface |
| `basalt-ui/controls`     | mantine-coupled | The control tier (docs/v3/concepts/controls-url-state.md). Exports: `FilterSet` (a list of `spec(...)`s as one nowrap row of pills, a measured +N fold and the mobile Filters (n) sheet), `ViewTabs` bound to a control handle, `ControlView`, `ControlHome`, `filterSlot`, `spec`, and the v3 forms `FormField`/`FormRow`/`FormFooter`/`useFormDraft`/`toSubmitErrors`. The home picks the presentation (pill, row, inline), never a prop. Every control owns its own desktop/mobile swap in CSS and resolves with no Mantine installed.                                                                                                                                                                         |
| `basalt-ui/router`       | headless        | v3 router bridge — nav, controls and search-state defaults on TanStack Router                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `basalt-ui/data`         | headless        | v3 data layer — query client, unwrap, optimistic and live queries on TanStack Query                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `basalt-ui/page`         | headless        | v3 page composites — Page, PageBar, Section, QueryState, overlays                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `basalt-ui/cards`        | headless        | v3 card composites — StatCard, StatGroup, BarList, EventList                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `basalt-ui/ai`           | headless        | v3 AI-chat part views — partView, defineBlock, defineCatalog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `basalt-ui/ui/*`         | headless        | v3 primitives — one module per primitive on Base UI, wildcard entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `basalt-ui/core/*`       | headless        | v3 core modules (cn, format, messages, phase, ports) — the paths an ejected primitive imports; wildcard entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `basalt-ui/shell`        | mantine-coupled | App shell — AppShell, the CSS-grid frame: header, rail, one scrollport, aside and phone tab bar from one defineNav                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `basalt-ui/lint`         | build-tooling   | v3 oxlint plugin — tooling, no app bundle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `basalt-ui/stylelint`    | build-tooling   | v3 stylelint preset — tooling, no app bundle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `basalt-ui/testing`      | build-tooling   | v3 test harness — renderApp, settled, quality; tooling, no app bundle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `basalt-ui/theme-script` | build-tooling   | v3 pre-paint color-scheme script, frozen per major                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Also published, but not JS subpaths: `basalt-ui/styles.css` (the one stylesheet: `@layer basalt;`, the three font imports, then basalt's own layer), the v3 CSS entries `basalt-ui/{tokens,typography,prose,fonts,tailwind}.css` (stubs until the v3 token layer lands) and `basalt-ui/configs/*` (raw oxlint / tsconfig / lefthook / oxfmt presets).

## Hard rules

**Framework-free boundary**: the layer is `basalt-ui/charts` and `basalt-ui/tokens`; each imports no UI
framework. `@visx/*` is banned everywhere and `@tanstack/charts` is an allowlist of mark subpaths
(`basalt/chart-engine-boundary`, enforced in both the repo and the shipped consumer preset);
`@tanstack/charts/react` is imported by `src/charts/host.tsx` alone (`basalt/chart-host-single`, repo-local).

The boundary protects **layering** (`tokens` is pure data that `charts` reads, so a chart cannot fork
the palette) and **packaging** (the dist entries resolve with only `react`/`react-dom` installed —
`scripts/check-dist-layering.mjs` walks their built dist graphs, and `scripts/pack-test.sh`'s
"charts/tokens-only resolution + render" step scratch-installs the tarball and SSR-renders
`basalt-ui/charts` + `basalt-ui/tokens` live). **No peer is required**: every peer is optional in
`peerDependenciesMeta` and `tests/required-peers.test.ts` asserts the empty required set.

Enforcement is repo-local ONLY, not in the shipped preset: `./charts`/`./tokens` via the
`basalt/token-layer-boundary` plugin rule.

**No raw hex or raw color functions**: route every color through `BASALT.*` tokens or the shipped
CSS vars. Never write `#rrggbb`, `rgb(…)`, or `hsl(…)` in component or style code. Use
`alpha(token, a)` for opacity (`color-mix` under the hood) — never `rgba()`.

**Motion discipline**: import animation from `motion/react`, never the raw `framer-motion`
package (enforced by oxlint `no-restricted-imports`). Route transition timing through the shared
`MOTION_DURATION` / `MOTION_SPRING` / `MOTION_EASE_STANDARD` tokens — never a hardcoded
duration/spring/ease literal in a `transition={{...}}` prop.

## Key commands

`tokens:css`/`fonts:css` are the only commands with no install to resolve, so `bunx` is correct for
them **and only while basalt is not installed here** — once it is, they run through the local bin
like everything else. `init` always runs from the local bin: install `basalt-ui` first. See the note below.

```bash
./node_modules/.bin/basalt-ui init   # FIRST STEP, after `bun add basalt-ui`: scaffold .claude/rules/ + .claude/skills/, managed AGENTS.md block, DESIGN.md seed, toolchain seeds
basalt-ui --version         # one bare line, exit 0 — which CLI is actually running (also -v / version)
basalt-ui sync              # reconcile managed files (.claude/rules/, .claude/skills/, AGENTS.md block) + delete the ones this version retired
basalt-ui sync --check      # CI freshness gate — exits non-zero if any managed file drifted or a retired one is still present
basalt-ui doctor            # integration health — SKIPPED is a third outcome and exits non-zero
bunx basalt-ui tokens:css   # emit the --basalt-* stylesheet (no React, no Mantine, no bundler) — bunx ONLY if basalt is not installed
bunx basalt-ui fonts:css    # emit the shipped --basalt-font-* stacks — same exception
```

Every subcommand rejects a flag it does not accept, exiting 1 and naming it; an unknown command says
so above the usage block. Neither is ever ignored — `doctor --json` used to run doctor and exit 0.

**One resolver (C2, 1.29.0): `BASALT_CWD` → cwd, and a declared `basalt.roots` — nothing inferred.**
`doctor`, `sync` and `lint` all resolve their project the same way; there is no ascend/descend
guess. Two candidates is ambiguous and reported, never guessed. `sync` on a `tokens-only` consumer
prints `n/a` and exits 0.

**Run the local bin, not `bunx`.** `bunx` does not re-resolve a cached package, so it can execute
the version you just upgraded away from — one consumer filed a P0 against a 1.20.0 cache while
believing it was on 1.22.0. `init` and `sync` render every seeded script, CI step and hook with the
resolved local bin for this reason (`BASALT_BIN` overrides it). `basalt-ui --version` is the
one-second check.

The editor hook is `.basalt/hook.mjs` (`basalt-ui lint --hook`), placed and registered in
`.claude/settings.json` by `init` and `sync`, so the agent's off-law edits are caught as it writes.

**The escape hatch is `theme-allow <rule-id> — <reason>`**, scoped to that one `basalt/*` plugin rule
and to that one node/line. It must START its comment (after `//`, `/*`, `<!--`, a block gutter `*`,
or whitespace), and is honoured on the reported line and on a comment-only line directly above it.
Whole-file scope is `theme-allow-file <id>… — <why>`. A bare `theme-allow` waives nothing, and a
word in the id slot that names no rule waives nothing. The kinds of the retired 2.x text guard
(`check-theme`, deleted in 3.0) still parse, as dead waivers.

> **Framework-internal only** — `bun scripts/check-coverage.ts` (a script, not a CLI subcommand
> as of C2/1.29.0) is a self-consistency gate for the basalt-ui repo itself (asserts SURFACES ↔
> rule files ↔ skill files ↔ package.json exports). Not a consumer command.

## Machine-readable surface map

See `llms.txt` in the package root (`node_modules/basalt-ui/llms.txt`; a shipped file, not an export)
for the full surface map: one entry per published subpath with import specifier, description, layer,
and optional peer packages.

## Upgrading across minors

`CHANGELOG.md` lists every release; `MIGRATING.md` lists what **broke** — removed and renamed
exports per minor, with the replacement. 3.x is the current line; 2.x stays on npm as published and
receives no further releases, so a consumer on 2.x stays on its pin until it migrates. A minor bump
can still require code changes. Read `MIGRATING.md` before jumping more than one minor.
