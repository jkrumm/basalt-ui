# Basalt UI 1.0 — Blueprint

> Status: proposal, pending approval. Synthesized from a multi-agent research + design pass over
> argo, basalt-ui, dotfiles, and external precedents (2026-06-10).

## Vision

basalt-ui pivots from a Tailwind v4 CSS theme (v0.4.2, zero external consumers) into an
**extremely opinionated framework for Mantine-based React apps**, extracted from argo — the
greenfield POC of the design system. Any consumer app instantly gets:

1. **Look & feel** — Blueprint palette, three-tier CSS-var token system, Mantine theme reskin,
   app shell (sidebar/mobile nav/breadcrumbs/page actions), visx chart system, theme-lab.
2. **Toolchain** — oxlint/oxfmt/tsconfig presets, the theme guard, lefthook + CI templates,
   a Vite preset encoding the non-obvious Mantine/React dedupe fixes.
3. **Agentic setup** — Claude Code plugin (skills) + synced `.claude/rules`, consolidating the
   doctrine that today lives in four cross-referencing places.

Argo then refactors onto basalt-ui and shrinks dramatically; argo keeps only domain data
(series colors, nav config, global actions) and API-side concerns.

**Why this is low-risk:** basalt-ui v0.4.2 has zero external consumers (verified — playground/
fpp/modelpick don't depend on it), so the Mantine pivot ships as a clean breaking 1.0.0 under
the same npm name, keeping the semantic-release + provenance pipeline and basalt-ui.com identity.
Argo's promotion seam was deliberately maintained (DESIGN.md "Promotion path"): the generic law,
palette tiers, createTheme, resolver, guard, and shell components are already separated from
argo's domain data.

## Repo layout

```
basalt-ui/  (repo = npm package + playground + marketing + Claude plugin marketplace)
├── .claude-plugin/marketplace.json     # repo doubles as its own plugin marketplace
├── plugins/basalt/
│   ├── .claude-plugin/plugin.json      # version lockstep with npm via semantic-release exec
│   └── skills/
│       ├── basalt-design/SKILL.md      # /basalt:design — doctrine + DESIGN.md deference + theme-lab loop
│       ├── basalt-charts/SKILL.md      # /basalt:charts — dataviz successor (kinds, series registration)
│       └── basalt-app/SKILL.md         # /basalt:app — guided scaffold (wraps `basalt init`)
├── docs/
│   ├── DESIGN-CORE.md                  # the generic law (universal sections of argo/DESIGN.md)
│   └── MANTINE-THEMING.md              # moved verbatim from argo/docs/
├── packages/basalt-ui/                 # the only published package, name `basalt-ui`, v1.0.0
│   ├── src/
│   │   ├── index.ts                    # BasaltProvider, createBasaltTheme, cssVariablesResolver,
│   │   │                               # BasaltShell, AppSidebar, MobileNav, AppBreadcrumbs,
│   │   │                               # PageHeaderProvider/PageActions/PageActionsOutlet,
│   │   │                               # NavCountBadge, SidebarSection/SidebarItem types
│   │   ├── theme/                      # theme.ts (ramp10, bpDark, baseTheme), resolver.ts   [Mantine OK]
│   │   ├── provider/                   # BasaltProvider (MantineProvider + palette <style> + Vx bridge)
│   │   ├── shell/                      # argo app-shell/* + __root.tsx composition + CSS modules [Mantine OK]
│   │   ├── tokens/                     # BP palette, p(), SEMANTIC/STATUS/NEUTRAL/SURFACE, VX core,
│   │   │                               # buildPaletteCss, defineSeries/seriesTokens/groupTokens, alpha
│   │   │                               #                                                  [NO @mantine — lint-enforced]
│   │   ├── charts/                     # primitives/kinds/sparklines/hooks/hover-context from
│   │   │                               # argo packages/charts                              [NO @mantine — lint-enforced]
│   │   ├── theme-lab/                  # ThemeLabControls + applyOverrides (COLOR_GROUPS parameterized)
│   │   ├── vite.ts                     # basaltViteConfig({port, host, apiTarget?, basaltSrc?})
│   │   ├── cli/                        # init / sync / check-theme implementations
│   │   └── styles.css                  # @layer basalt; iOS input safety net; font stack
│   ├── agent/
│   │   ├── rules/                      # basalt-{tokens,charts,mantine,router,query,state}.md
│   │   └── templates/                  # DESIGN.md.tpl, CLAUDE-block.md.tpl, settings.stanza.json
│   ├── configs/                        # oxlint.json, tsconfig.{base,react-app,node}.json,
│   │                                   # oxfmt.json + lefthook.yml + check.yml (templates)
│   ├── bin/basalt.mjs                  # ONE bin: `basalt init|sync|check-theme`
│   └── dist/                           # unbundled ESM + copied .module.css + d.ts(+maps)
├── apps/playground/                    # workspace:* consumer — the everyday iteration surface
└── apps/marketing/                     # basalt-ui.com, content-frozen until post-migration
```

## Package architecture decisions

| Topic | Decision |
|-|-|
| Identity | Pivot in place, same `basalt-ui` npm name, breaking 1.0.0 (`feat!:`). Drop `./css`/`./starlight` Tailwind exports. |
| Exports | `.` (Mantine-coupled: provider/theme/shell) · `./charts` · `./tokens` (both Mantine-free) · `./vite` · `./theme-lab` · `./styles.css` · `./configs/*` (raw files — extends needs real paths). No separate `./shell`/`./theme` subpaths (always used together). |
| Layering | Charts/tokens stay Mantine-free via oxlint `no-restricted-imports` overrides — both in basalt-ui's own repo config and in the shipped consumer config (`**/charts/**` bans `@mantine/*`). Same mechanism argo uses today. |
| Build | Dist-first: tsup unbundled transpile (`bundle: false`, CSS-modules copied verbatim) + `tsc --emitDeclarationOnly --declarationMap`; `src/` ships in the tarball so go-to-definition lands in real source. Fix `import.meta.env.DEV` → `process.env.NODE_ENV !== 'production'`. |
| CSS | Native CSS only — no postcss-preset-mantine, zero consumer PostCSS config (argo's proven precedent). PALETTE_CSS is runtime-generated (embeds consumer series) and injected by `BasaltProvider` (`injectPalette={false}` escape hatch for SSR/head injection). |
| Dependencies | deps: 8 `@visx/*` pinned **exact** at `4.0.0-alpha.11`. peers: react/react-dom `^19`, `@mantine/core` + `@mantine/hooks` `^9.3`; `@mantine/dates` optional peer. NO zustand, NO @tanstack/*, NO @tabler/icons (icons passed as ReactNode). `sideEffects: ['*.css']`. |
| Bin | One `basalt` bin with subcommands: `check-theme` (the guard), `init`, `sync`. |
| Publish | Keep semantic-release + monorepo plugin + npm provenance + the isolated-basalt-ui lefthook commit guard. Swap Biome → oxlint/oxfmt repo-wide. |

## Token & theme system

Three tiers lift from argo near-verbatim: palette data (`BP`, `p()`, SEMANTIC/STATUS/NEUTRAL/
SURFACE) → CSS-var emission → `VX.*` var refs. The **`--vx-*` prefix is kept** (recommended):
it makes argo's migration provable by byte-identical PALETTE_CSS diff and reads as
"visualization", not "argo". Rename to `--bui-*` stays possible later as one atomic major.

**Consumer series extensibility** (the one real design task — argo's SERIES/ACTIVITY/USAGE maps
are domain data and leave the framework):

```ts
// framework primitives
buildPaletteCss(opts?: { series?: Record<string, ColorPair>; groups?: ...; derived?: ... })
seriesTokens(<const map>)   // → { hrv: 'var(--vx-hrv)', ... }  exact-keyed, stale keys fail tsc
groupTokens('activity', map)

// sugar — one call returning both
defineSeries(map) // → { css, tokens }
```

`VX.series` is deleted from the framework; argo rebuilds it app-side in one guard-exempt file
(`apps/dashboard/src/lib/series.ts`).

**Theme surface:** `createBasaltTheme(overrides?: MantineThemeOverride)` =
`mergeThemeOverrides(baseTheme, overrides)` with argo's theme.ts verbatim (ramp10 accent reskin,
bpDark, owned spacing/radius scales, fontWeights, input `size: 'md'` set, autoContrast).
`cssVariablesResolver` exported and pre-wired in `BasaltProvider`, with hex fallbacks generated
from palette data (kills the documented hand-duplication drift).

## App shell

```tsx
<BasaltShell
  brand={{ name, logo?, logoSrc?, version? }}
  sections={SidebarSection[]}        // types lift unchanged from argo
  globalActions={<.../>}             // slot — argo passes Hermes/timer/refresh widgets
  sidebarFooterExtra={...} settingsMenuItems={...}
  storageKey="basalt-ui"             // collapse persisted via @mantine/hooks useLocalStorage
>
```

Badge/active/navigate wiring stays consumer-side (argo's `__root.tsx` pattern, ~30 lines,
documented); ship `NavCountBadge` for the count-badge pattern. No zustand dependency, no router
adapter — the shell stays router-agnostic.

## Toolchain presets

| Artifact | Mechanism |
|-|-|
| `configs/tsconfig.{base,react-app,node}.json` | Native `"extends": "basalt-ui/configs/tsconfig.base.json"`. react-app variant folds back the strictness argo's dashboard drifted from (noPropertyAccessFromIndexSignature, exactOptionalPropertyTypes). |
| `configs/oxlint.json` | Consumer `"extends": ["./node_modules/basalt-ui/configs/oxlint.json"]` — plugins/categories/rules + bans (antd, react-router(-dom), @visx/tooltip, **new:** direct `@visx/*` outside basalt-ui/charts, `@mantine/*` under `**/charts/**`). Verify extends resolution semantics on oxlint ≥1.60 before publish. |
| `basalt check-theme` | check-theme.mjs port reading a `"basalt"` package.json key `{ roots?, exempt?, spacingSteps?, forbiddenAccents? }`. Consumer lint = `oxlint . && basalt check-theme`. |
| oxfmt / lefthook / check.yml | No extends mechanism — templates written by `basalt init`, drift-managed by `sync`. |
| `basalt-ui/vite` | `basaltViteConfig({port, host, apiTarget?, basaltSrc?})` → resolve.dedupe (react + @mantine/*), optimizeDeps.include for all Mantine subpackages, strictPort/allowedHosts, /api prefix-strip proxy, `__APP_VERSION__` define, and the BASALT_SRC local-dev alias. Plugins (router → react-compiler → react → PWA) stay app-side. |

## Agentic layer

**Doctrine consolidation** — the chart/design law currently lives in four cross-referencing
places (argo DESIGN.md → argo design-tokens.md → dotfiles visx-charts.md → dataviz skill).
basalt-ui becomes the single owner:

- `docs/DESIGN-CORE.md` — the universal law (from argo DESIGN.md's documented seam).
- Consumer repos keep a **thin** DESIGN.md instantiation ("extends basalt-ui core; deltas only"):
  identity confirmation, series dictionary, app deviations.
- New precedence: consumer DESIGN.md (deltas) > DESIGN-CORE > shipped basalt-* rules > skills.

**Six shipped rules** (`agent/rules/`, copied into consumer `.claude/rules/` by init/sync,
whole-file managed with `source: basalt-ui@<version>` header + parameterized `paths:`):

| Rule | Replaces | Enforcement |
|-|-|-|
| basalt-tokens.md | argo design-tokens.md | `basalt check-theme` |
| basalt-charts.md | dotfiles visx-charts.md + charts CLAUDE.md | oxlint @visx/* ban |
| basalt-mantine.md | dashboard mantine.md | partially by-construction (createBasaltTheme defaults) |
| basalt-router.md | dashboard tanstack-router.md (opinion layer over upstream-synced facts) | advisory |
| basalt-query.md | dashboard tanstack-query.md (same) | advisory |
| basalt-state.md | dashboard state.md + forms.md | localStorage-theme-read regex in guard; rest advisory |

Stays argo-only: observability.md + all apps/api rules. Stays dotfiles-global: workflow rules +
upstream-synced react/tanstack/elysia (update-agent-rules pipeline unchanged; basalt-* rules are
explicitly out of its scope).

**Distribution — two mandatory paired channels** (plugins verifiably cannot ship CLAUDE.md or
rules as project context; postinstall is dead under bun):

1. **Plugin + repo-as-marketplace**: `.claude-plugin/marketplace.json`, plugin version in
   lockstep with npm via semantic-release exec. Consumers auto-install via an
   `extraKnownMarketplaces`/`enabledPlugins` stanza in `.claude/settings.json`. Three skills:
   `/basalt:design`, `/basalt:charts`, `/basalt:app`.
2. **`basalt init` / `basalt sync`**: scaffolds `.claude/rules/basalt-*.md`, an `.oxlintrc.json`
   extends-stub,
   a managed `<!-- basalt:begin/end -->` block in CLAUDE.md (stack facts, DESIGN.md-is-law
   pointer, frontend-design restraint override), thin DESIGN.md, toolchain templates, and
   `.basalt/manifest.json` (sha256 per managed file). `sync` does three-way comparison:
   unchanged → overwrite; locally edited → diff + skip unless `--force`; missing → recreate.
   `sync --check` can run in CI as a freshness gate.

**Cleanup once live** (same window, or doctrine re-forks): argo deletes design-tokens.md +
5 dashboard rules + check-theme.mjs + charts CLAUDE.md and shrinks DESIGN.md; dotfiles deletes
visx-charts.md + the dataviz skill and rewrites the stale basalt-ui sections in global CLAUDE.md.

## Iteration DX — "symlink basalt-ui and argo auto-adjusts?"

**Yes in spirit, but not via `bun link`** (symlink bugs, package.json mutation, stale Vite
prebundle). The mechanism, already proven by argo's own `@argo/charts` wiring:

- **Daily iteration** happens in `apps/playground` (workspace:* — instant HMR, exact types,
  zero linking). This replaces ~90% of would-be cross-repo sessions.
- **Cross-repo integration mode**: `bun dev:basalt` in argo = `BASALT_LOCAL=1 bun dev` →
  the vite preset aliases `'basalt-ui'` to the sibling repo's `src/` (+ `server.fs.allow`).
  Out-of-node_modules code is treated as source: full HMR on TSX and .module.css edits, no build
  step. Because `resolve.alias` is part of Vite's prebundle cache key, toggling the flag
  auto-invalidates the cache — the entire stale-prebundle failure class disappears.
  `resolve.dedupe` for react + @mantine/* is mandatory (dual-instance guard).
- Argo pins basalt-ui **exact** (`"basalt-ui": "1.0.0"`) — every upgrade is a deliberate
  one-line bump. Editor types come from the installed version during local mode (accepted skew;
  API-shape work belongs in the playground).

## Argo migration plan

Five stages, each = one basalt-ui release + one consuming argo commit, **argo deployable after
every stage**. Gates: **A** = /check (lint+guard+typecheck) every stage; **B** = mechanical
PALETTE_CSS string diff + computed `--mantine-color-*` snapshot (S2/S3 — byte-identical proof,
no screenshots needed); **C** = chrome-devtools screenshot pass, 6 routes × both schemes
(S3/S4 only).

| Stage | basalt-ui ships | argo commit | Gates |
|-|-|-|-|
| S0 repo pivot | CLAUDE.md rewrite, Biome→oxlint/oxfmt, package skeleton + dist build, apps/playground folded in | — (untouched) | — |
| S1 toolchain | tsconfig presets, oxlint base, `basalt check-theme` | extend configs, delete check-theme.mjs, fix dashboard tsconfig strictness drift (expect new type errors — fix in same commit) | A |
| S2 charts | src/charts + src/tokens, defineSeries/buildPaletteCss, import.meta.env fix | new lib/series.ts; swap `@argo/charts`→`basalt-ui/charts`, `VX.series.*`→`SERIES.*` (mechanical — offload to sideclaw implement); delete packages/charts | A+B |
| S3 theme | createBasaltTheme + resolver + BasaltProvider (absorbs VxBridge) | theme.ts → ~5 lines, delete charts-bridge.tsx, rewire main.tsx | A+B+C |
| — | **merge feat/argo-voice** (hard prerequisite for S4 — it rewrites exactly the files S4 extracts) | | |
| S4 shell | BasaltShell + sidebar/mobile-nav/breadcrumbs/page-header + CSS modules (voice-branch versions are source of truth) | __root.tsx keeps sections/badges/crumbs, renders `<BasaltShell>`; store.ts drops sidebarCollapsed | A+C (incl. mobile viewport) |
| S5 agentic + vite | plugin + marketplace + init/sync | `basalt init` (monorepo globs), delete superseded rules, adopt basaltViteConfig, BASALT_LOCAL smoke session | A + hot-loop proof |

S0–S2 can start immediately (they touch zero voice-branch files). Post-migration argo:
`theme.ts` ~5 lines, `charts-bridge.tsx` deleted, `packages/charts` deleted, `__root.tsx` keeps
only domain wiring, `lib/series.ts` is the single guard-exempt palette file.

## Key risks

- **oxlint `extends` semantics unverified** on the pinned version — verify first; worst case the
  lint layer degrades to a scaffold-copied template (init/sync handles that anyway).
- **visx 4.0.0-alpha.11 exact-pinned under a stable 1.0** — stable visx 4 becomes a coordinated
  minor; alpha regressions are frozen until then.
- **tsup unbundled + CSS-module copy is new infra** — the `bun pm pack` + scratch-app pack-test
  is mandatory and stays in CI (the playground only exercises source, not dist).
- **Shell CSS modules target Mantine internals** (`:global(.mantine-NavLink-body)`) — a Mantine
  minor can break the icon rail; peer range + playground visual checks are the guard.
- **React Compiler doesn't process node_modules dist** — shell/charts lose auto-memoization they
  had as argo source; hand-memoize hot chart kinds (Bars) during the port.
- **The two agentic channels are a pair** — plugin without `basalt init` = skills without
  doctrine. README + basalt-app skill must hard-state this.
- **Doctrine re-forks if argo/dotfiles cleanup is deferred** — deletion lands in the same window
  as the rules shipping.
- **Design hardening must NOT ride along** — freeze argo's current interim scales as 1.0
  defaults so parity gates stay byte-identical; harden deliberately in 1.1.

## Open decisions

1. **`--vx-*` prefix**: keep (recommended — provable byte-parity, zero churn) vs rename to
   `--bui-*` now (after 1.0 it's a breaking change).
2. **Design-value freeze**: ship 1.0 with argo's interim scales (spacing 10/12/16/20/32, radius
   2/4/8/16/32, inherited type ladder) and harden in 1.1 (recommended) vs do the 4px-grid +
   type-ladder pass before 1.0 (delays S3, breaks parity gates).
3. **Plugin scope**: enable machine-wide in ~/.claude/settings.json so /basalt:design replaces
   /dataviz everywhere (recommended) vs per-consumer-repo only.
4. **Tailwind surface**: 1.0 drops `./css`/`./starlight`; marketing site pins 0.4.2 until rebuilt
   post-migration (recommended) vs keeping CSS exports one more major as deprecated.
5. **feat/argo-voice ETA**: S4 blocks on the merge — is iPhone validation expected within days,
   or should voice ship behind its existing toggles to unblock?
6. **`basalt sync --check` in CI**: argo-only at first (recommended) vs all consumers vs manual.
