## basalt-ui — Agent Quick Reference

React 19 + Mantine v9 framework: `BasaltProvider` + `createBasaltTheme`, app shell, visx chart
system with a three-tier `--vx-*` CSS-variable token system, and TanStack adapter batteries.
Toolchain: Bun runtime, oxlint + oxfmt, conventional commits (empty scope), `master` branch.

## Subpath ownership

| Subpath                     | Layer           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt-ui`                 | mantine-coupled | BasaltProvider, createBasaltTheme, BasaltShell + sidebar/mobile-nav/breadcrumbs, NavCountBadge, ThemeToggle, ThreadWorkspace + thread-chat components, dashboard composites (DeltaBadge, StatCard, EmptyState, SettingsSection/SettingsRow/DangerZone)                                                                                                                                                                                                                                                                                                                                                              |
| `basalt-ui/charts`          | headless        | visx chart primitives, sparklines, hooks, and token re-exports (Mantine-free)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `basalt-ui/tokens`          | headless        | VX token refs, buildPaletteCss, defineSeries, seriesTokens, groupTokens, alpha (Mantine-free)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `basalt-ui/theme-lab`       | mantine-coupled | ThemeLabControls, applyOverrides, COLOR_GROUPS for live theme inspection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `basalt-ui/vite`            | mantine-coupled | basaltViteConfig(opts) — Vite preset for basalt-ui consumer apps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `basalt-ui/guard`           | headless        | checkSource, GUARD_RULES, Finding types — the headless theme-guard core                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `basalt-ui/query`           | headless        | createBasaltQueryClient, transport-agnostic unwrap, lazy BasaltQueryDevtools                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `basalt-ui/router-tanstack` | headless        | TanStack Router bridge: useBasaltNav (active route) + useRouterBreadcrumbs + createSearchParamStore (single-select URL-state store) + createMultiSearchParamStore (multi-select URL-state store)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `basalt-ui/forms`           | mantine-coupled | Mantine form adapter: useBasaltForm, field, FormErrorSummary, useFormDraft (Standard Schema)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `basalt-ui/notifications`   | mantine-coupled | Mantine notifications: notify helpers, typed registry, persisted history, NotificationBell, NotificationCenter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `basalt-ui/commands`        | mantine-coupled | typed command bus + overlay controller, toSpotlightActions, ShortcutsHelp, BasaltOverlays                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `basalt-ui/data`            | mantine-coupled | Convenience barrel pulling both TanStack Table + Virtual peer groups: BasaltDataTable, BasaltVirtualList (Mantine-rendered) — prefer ./data/table or ./data/virtual for per-feature opt-in                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `basalt-ui/data/table`      | mantine-coupled | BasaltDataTable: a sortable data table over TanStack Table, rendered with Mantine (Mantine-rendered)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `basalt-ui/data/virtual`    | mantine-coupled | BasaltVirtualList: a windowed virtual list over TanStack Virtual, rendered with Mantine (Mantine-rendered)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `basalt-ui/agent`           | headless        | Headless streaming-chat layer: useAgentStream, aiSdkTransport (recommended default) + edenTransport, PartList, plus the multi-thread createThreadsStore + useAgentThreadRuns + outcome-resolver seam (Mantine-free)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `basalt-ui/content`         | mantine-coupled | Prose (article/chat typography), CodeBlock (shiki, optional peer), Callout, TableOfContents, ReadingProgress, Markdown (react-markdown + remark-gfm, optional peers, streaming-aware), MermaidDiagram (beautiful-mermaid, optional peer), mdxComponents/createMdxComponents, ArticleLayout (docs-page frame), ArticleCard/ArticleGrid (overview cards), Article model (sortArticles/filterArticles/formatArticleDate), ArticleFilterBar (category/tags filter UI), toArticleActions (Spotlight projector, @mantine/spotlight type-only), GuideLink/GuideDrawer (contextual-help drawer) — the content/prose surface |
| `basalt-ui/state`           | headless        | createPersistedState (versioned localStorage) + useOnlineStatus — Mantine-free state primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `basalt-ui/connectivity`    | mantine-coupled | ConnectivityProvider (aggregates browser online/offline, React Query onlineManager, SSE, and health-check pings into one status), useConnectivity, and ConnectivityIndicator — auto-mounted by BasaltProvider                                                                                                                                                                                                                                                                                                                                                                                                       |

## Hard rules

**Mantine-free boundary**: `basalt-ui/charts`, `basalt-ui/tokens`, `basalt-ui/guard`,
`basalt-ui/query`, `basalt-ui/router-tanstack`, `basalt-ui/agent`, and `basalt-ui/state` must
import zero `@mantine/*`. `@visx/*` is permitted only inside `src/charts/**`. `@visx/*`
(`basalt/visx-boundary`) is enforced by an oxlint plugin rule in both the repo and the shipped
consumer preset.

The Mantine-free boundary protects two things: **layering** (keeps the token layer upstream of
Mantine — `cssVariablesResolver` reads `--vx-*` tokens to bind Mantine's surfaces to them, so an
`@mantine/*` import here would cycle back through the theme layer or let a chart bypass `--vx-*`
and fork chrome/charts apart) and **packaging** (each of these seven dist entries resolves with
**no `@mantine/*` installed** — `scripts/check-dist-layering.mjs` walks the built dist graph of all
seven and fails if any reaches `@mantine/*`; `scripts/pack-test.sh`'s "charts/tokens-only
(no-Mantine) resolution + render" step additionally scratch-installs the tarball with only
`react`/`react-dom` and SSR-renders `basalt-ui/charts` + `basalt-ui/tokens` live). The LAYER is
Mantine-free — the FRAMEWORK is not: `.` requires Mantine (`@mantine/core`/`@mantine/hooks` are
required, non-optional peers); these seven subpaths don't.

Enforcement is repo-local ONLY for the Mantine-free side, not in the shipped preset:
`./charts`/`./tokens` via the `basalt/token-layer-boundary` plugin rule, `guard`/`query`/
`router-tanstack`/`agent`/`state` via a plain `no-restricted-imports` ban.

**No raw hex or raw color functions**: route every color through `VX.*` tokens or the Mantine
theme. Never write `#rrggbb`, `rgb(…)`, or `hsl(…)` in component or style code. Use
`alpha(token, a)` for opacity (`color-mix` under the hood) — never `rgba()`.

**Motion discipline**: import animation from `motion/react`, never the raw `framer-motion`
package (enforced by oxlint `no-restricted-imports`). Route transition timing through the shared
`MOTION_DURATION` / `MOTION_SPRING` / `MOTION_EASE_STANDARD` tokens — never a hardcoded
duration/spring/ease literal in a `transition={{...}}` prop (enforced by `basalt-ui check-theme`).

## Key commands

```bash
bunx basalt-ui init              # FIRST STEP: scaffold .claude/rules/ + .claude/skills/, managed CLAUDE.md block, DESIGN.md seed, toolchain seeds
bunx basalt-ui check-theme       # fail on off-palette colors in consumer source
bunx basalt-ui sync              # reconcile managed files (.claude/rules/, .claude/skills/, CLAUDE.md block)
bunx basalt-ui sync --check      # CI freshness gate — exits non-zero if any managed file drifted
bunx basalt-ui doctor            # check consumer repo basalt integration health
bunx basalt-ui info              # print published surface map
bunx basalt-ui info --json       # stable JSON surface map
bunx basalt-ui guard-hook        # PreToolUse theme-guard adapter: reads a Write/Edit payload on stdin, denies off-palette writes
```

Register `guard-hook` in `.claude/settings.json` under `hooks.PreToolUse` with matcher
`Write|Edit|MultiEdit` and command `bunx basalt-ui guard-hook` so the agent can't write off-palette
colors without a `theme-allow` comment.

> **Framework-internal only** — `bunx basalt-ui check-coverage` is a self-consistency gate for the
> basalt-ui repo itself (asserts SURFACES ↔ rule files ↔ skill files ↔ package.json exports). It
> is not a consumer command and will skip assertion 3 outside the framework repo.

## Machine-readable surface map

See `basalt-ui/llms.txt` (importable via the package specifier) for the full surface map: one
entry per published subpath with import specifier, description, layer, and optional peer packages.
