## basalt-ui — Agent Quick Reference

React 19 + Mantine v9 framework: `BasaltProvider` + `createBasaltTheme`, app shell, visx chart
system with a three-tier `--vx-*` CSS-variable token system, and TanStack adapter batteries.
Toolchain: Bun runtime, oxlint + oxfmt, conventional commits (empty scope), `master` branch.

## Subpath ownership

| Subpath                     | Layer           | Purpose                                                                                         |
| --------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `basalt-ui`                 | mantine-coupled | BasaltProvider, createBasaltTheme, BasaltShell + sidebar/mobile-nav/breadcrumbs, NavCountBadge  |
| `basalt-ui/charts`          | headless        | visx chart primitives, sparklines, hooks, and token re-exports (Mantine-free)                   |
| `basalt-ui/tokens`          | headless        | VX token refs, buildPaletteCss, defineSeries, seriesTokens, groupTokens, alpha (Mantine-free)   |
| `basalt-ui/theme-lab`       | mantine-coupled | ThemeLabControls, applyOverrides, COLOR_GROUPS for live theme inspection                        |
| `basalt-ui/vite`            | mantine-coupled | basaltViteConfig(opts) — Vite preset for basalt-ui consumer apps                                |
| `basalt-ui/guard`           | headless        | checkSource, GUARD_RULES, Finding types — the headless theme-guard core                         |
| `basalt-ui/query`           | headless        | createBasaltQueryClient, transport-agnostic unwrap, lazy BasaltQueryDevtools                    |
| `basalt-ui/router-tanstack` | headless        | TanStack Router bridge: useBasaltNav (active route) + useRouterBreadcrumbs                      |
| `basalt-ui/forms`           | mantine-coupled | Mantine form adapter: useBasaltForm, field, FormErrorSummary, useFormDraft (Standard Schema)    |
| `basalt-ui/notifications`   | mantine-coupled | Mantine notifications: notify helpers, typed registry, persisted history, NotificationBell      |
| `basalt-ui/commands`        | mantine-coupled | typed command bus + overlay controller, toSpotlightActions, ShortcutsHelp, BasaltOverlays       |
| `basalt-ui/data`            | mantine-coupled | TanStack Table + Virtual kinds: BasaltDataTable, BasaltVirtualList (Mantine-rendered)           |
| `basalt-ui/agent`           | headless        | Headless streaming-chat layer: useAgentStream, edenTransport, PartList (Mantine-free)           |
| `basalt-ui/state`           | headless        | createPersistedState (versioned localStorage) + useOnlineStatus — Mantine-free state primitives |

## Hard rules

**Mantine-free boundary**: `basalt-ui/charts`, `basalt-ui/tokens`, `basalt-ui/guard`,
`basalt-ui/query`, `basalt-ui/router-tanstack`, `basalt-ui/agent`, and `basalt-ui/state` must
import zero `@mantine/*`. `@visx/*` is permitted only inside `src/charts/**`. Both rules are
enforced by oxlint `no-restricted-imports` (repo-local and in the shipped consumer preset).

**No raw hex or raw color functions**: route every color through `VX.*` tokens or the Mantine
theme. Never write `#rrggbb`, `rgb(…)`, or `hsl(…)` in component or style code. Use
`alpha(token, a)` for opacity (`color-mix` under the hood) — never `rgba()`.

## Key commands

```bash
bunx basalt init              # FIRST STEP: scaffold .claude/rules/basalt-*.md, managed CLAUDE.md block, DESIGN.md seed, oxfmt/lefthook/CI templates
bunx basalt check-theme       # fail on off-palette colors in consumer source
bunx basalt sync              # reconcile managed files (.claude/rules/, CLAUDE.md block)
bunx basalt sync --check      # CI freshness gate — exits non-zero if any managed file drifted
bunx basalt doctor            # check consumer repo basalt integration health
bunx basalt info              # print published surface map
bunx basalt info --json       # stable JSON surface map
bunx basalt guard-hook        # PreToolUse theme-guard adapter: reads a Write/Edit payload on stdin, denies off-palette writes
```

Register `guard-hook` in `.claude/settings.json` under `hooks.PreToolUse` with matcher
`Write|Edit|MultiEdit` and command `bunx basalt guard-hook` so the agent can't write off-palette
colors without a `theme-allow` comment.

> **Framework-internal only** — `bunx basalt check-coverage` is a self-consistency gate for the
> basalt-ui repo itself (asserts SURFACES ↔ plugin.json ↔ rule files ↔ package.json exports). It
> is not a consumer command and will skip assertion 3 outside the framework repo.

## Machine-readable surface map

See `basalt-ui/llms.txt` (importable via the package specifier) for the full surface map: one
entry per published subpath with import specifier, description, layer, and optional peer packages.
