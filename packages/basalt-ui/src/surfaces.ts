/**
 * SURFACES registry — the one hard source for the enforcement seam.
 * Mantine-free, dependency-free. Imports only ./guard/types.
 *
 * SURFACES: the discriminated doctrine|tooling registry for all basalt subpaths and advisory surfaces.
 * RULE_NAMES: derived projection — the deduped set of doctrine rule names (PROJECTION 1).
 */
import type { GuardKind } from './guard/types'

// ── Scalar types ──────────────────────────────────────────────────────────────────────────────────

/** The 12 on-disk rule names (agent/rules/basalt-{name}.md — the set-equality target).
 *
 * @example
 * const r: RuleName = 'tokens' // ok
 * // const bad: RuleName = 'overlays' // tsc error — not in the union
 */
export type RuleName =
  | 'tokens'
  | 'charts'
  | 'mantine'
  | 'router'
  | 'query'
  | 'state'
  | 'forms'
  | 'notifications'
  | 'commands'
  | 'data'
  | 'agent'
  | 'content'

/** The 3 shipped skill names (agent/skills/basalt-{name}/SKILL.md, placed into a consumer's
 * .claude/skills/ by `basalt-ui init`/`sync` — the same managed path the rules take).
 *
 * @example
 * const s: SkillName = 'basalt-app'
 */
export type SkillName = 'basalt-app' | 'basalt-design' | 'basalt-charts'

/** Logical layer — the glob PREFIX is supplied per projection target, never stored here.
 *
 * @example
 * const l: Layer = 'headless'
 */
export type Layer = 'mantine-coupled' | 'headless' | 'app-global' | 'non-js-asset'

/**
 * A single import ban. `{ctx}` in the message is filled per target so shipped/repo wording
 * is one source.
 *
 * @example
 * const ban: ForbiddenImport = { spec: 'antd', match: 'path', message: 'Use Mantine.', shippedOnly: true }
 */
export type ForbiddenImport = {
  /** Exact module specifier ('antd') OR a glob group ('@visx/*'). */
  readonly spec: string
  /** 'path' → exact-name ban; 'group' → pattern ban. Mirrors oxlint paths vs patterns. */
  readonly match: 'path' | 'group'
  /** Message; may contain a `{ctx}` placeholder (the boundary name for this glob). */
  readonly message: string
  /** Ban holds ONLY in the shipped consumer preset (e.g. antd) — never repo-local. */
  readonly shippedOnly?: true
  /** Ban holds ONLY in the repo-local config. (Reserved; nothing repo-only-banned today.) */
  readonly repoOnly?: true
}

/**
 * Per-target rule override not derivable from layer (no-console:off, no-underscore-dangle:off).
 *
 * @example
 * const o: RuleOverride = { rule: 'no-console', level: 'off', target: 'repo' }
 */
export type RuleOverride = {
  readonly rule: string
  readonly level: 'off' | 'warn' | 'error'
  readonly target?: 'shipped' | 'repo'
}

// ── SurfaceSpec — discriminated doctrine | tooling ────────────────────────────────────────────────

type BaseSurface = {
  readonly layer: Layer
  readonly forbiddenImports: readonly ForbiddenImport[]
  readonly ruleOverrides?: readonly RuleOverride[]
  /**
   * Human-readable description of this surface — single source for llms.txt and info output.
   * Optional on tooling surfaces (they have no llms.txt row).
   */
  readonly description?: string
  /**
   * Glob sets for this surface's oxlint boundary — emitted when non-empty forbiddenImports present.
   * `shipped` → globs in the consumer preset; `repo` → globs in the repo-local config.
   */
  readonly globs?: {
    readonly shipped: readonly string[]
    readonly repo: readonly string[]
  }
}

/**
 * A doctrine surface owes the full triad (rule + skill[] + guardKinds[]).
 * A bad rule/skill/kind name is a tsc error (literal-union).
 *
 * @example
 * const s: DoctrineSpec = { kind: 'doctrine', layer: 'headless', rule: 'tokens',
 *   skill: ['basalt-design'], guardKinds: ['raw-hex'], forbiddenImports: [] }
 */
export type DoctrineSpec = BaseSurface & {
  readonly kind: 'doctrine'
  readonly rule: RuleName
  /** A LIST (skill↔surface is many-to-one — basalt-design covers tokens AND mantine AND state). */
  readonly skill: readonly SkillName[]
  /** Required, but [] is legal for advisory surfaces (router/query: rule only, no guard). */
  readonly guardKinds: readonly GuardKind[]
  /**
   * Optional peer package names this surface depends on (e.g. '@tanstack/react-query').
   * Single source of truth — read by gen-llms.ts and cli/index.ts; versions resolved from package.json.
   */
  readonly optionalPeers?: readonly string[]
}

/**
 * A tooling surface owes NO triad — these fields are statically ABSENT (cannot be set).
 *
 * @example
 * const t: ToolingSpec = { kind: 'tooling', layer: 'headless', forbiddenImports: [] }
 * // @ts-expect-error — tooling cannot carry `rule`
 * const bad: ToolingSpec = { kind: 'tooling', layer: 'headless', forbiddenImports: [], rule: 'tokens' }
 */
export type ToolingSpec = BaseSurface & {
  readonly kind: 'tooling'
  readonly rule?: never
  readonly skill?: never
  readonly guardKinds?: never
}

/** The discriminated union — the SURFACES registry value type. */
export type SurfaceSpec = DoctrineSpec | ToolingSpec

// ── Shared helpers (single-sourced authoring) ─────────────────────────────────────────────────────

const v = (spec: string, message: string, extra?: Partial<ForbiddenImport>): ForbiddenImport => ({
  spec,
  match: 'path',
  message,
  ...extra,
})
const vg = (spec: string, message: string, extra?: Partial<ForbiddenImport>): ForbiddenImport => ({
  spec,
  match: 'group',
  message,
  ...extra,
})

// Mantine-free ban for headless surfaces the `basalt/token-layer-boundary` plugin rule does NOT
// cover (it only enforces charts/tokens path segments, and is registered repo-local only — see
// oxlint-plugin.js). `./charts` and `./tokens` no longer use this: their Mantine-free boundary is
// enforced by that plugin rule instead (and their @visx/* boundary by `basalt/visx-boundary`), so
// duplicating the ban here would be redundant no-restricted-imports config.
const MANTINE_BANS = [
  v('@mantine/core', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
  v('@mantine/hooks', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
  vg('@mantine/*', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
] as const

// ── SURFACES ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The one hard source for the enforcement seam. Keys split into two kinds:
 * - JS-subpath keys (., ./charts, ./tokens, ./theme-lab, ./vite, ./guard, ./query, ./router-tanstack, ./forms, ./notifications, ./commands, ./data, ./data/table, ./data/virtual, ./agent, ./state, ./connectivity) — real package.json exports.
 * - #-prefixed synthetic keys (#app) — the synthetic global app-wide ban layer. The #-prefix
 *   guarantees it is never mistaken for an export path.
 *
 * @example
 * import { SURFACES } from './surfaces' // internal module — not a published subpath
 * const doctrines = Object.values(SURFACES).filter((s): s is DoctrineSpec => s.kind === 'doctrine')
 */
export const SURFACES = {
  // ── JS-subpath surfaces ──────────────────────────────────────────────────────────────────────
  '.': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'mantine',
    skill: ['basalt-app', 'basalt-design'],
    guardKinds: ['raw-motion-value', 'card-with-border', 'raw-form-control', 'sub-16-input-font'],
    description:
      'BasaltProvider, createBasaltTheme, BasaltShell + sidebar/mobile-nav/breadcrumbs, NavCountBadge, ThemeToggle, ThreadWorkspace + thread-chat components, dashboard composites (DeltaBadge, StatCard, EmptyState, SettingsSection/SettingsRow/DangerZone)',
    optionalPeers: ['react-markdown', 'remark-gfm', 'shiki', 'beautiful-mermaid'],
    forbiddenImports: [], // the no-charts/tokens-reexport invariant is comment-only today; Phase-4 plugin
  },
  './charts': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'charts',
    skill: ['basalt-charts'],
    guardKinds: ['raw-hex', 'raw-color-fn', 'raw-visx-axis', 'unframed-chart'],
    description: 'visx chart primitives, sparklines, hooks, and token re-exports (Mantine-free)',
    globs: {
      shipped: ['**/charts/**'],
      repo: ['packages/basalt-ui/src/charts/**'],
    },
    // The @visx/*-only-in-charts boundary is enforced by the `basalt/visx-boundary` oxlint plugin
    // rule, and the Mantine-free boundary by `basalt/token-layer-boundary` (repo-local only — see
    // that rule's file-header comment for why) — both configs/oxlint-plugin.js, not
    // no-restricted-imports.
    forbiddenImports: [],
    ruleOverrides: [{ rule: 'no-underscore-dangle', level: 'off', target: 'repo' }],
  },
  './tokens': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'tokens',
    skill: ['basalt-design', 'basalt-charts'],
    guardKinds: ['raw-hex', 'raw-color-fn', 'off-identity-accent', 'off-system-surface-var'],
    description:
      'VX token refs, buildPaletteCss, defineSeries, seriesTokens, groupTokens, alpha (Mantine-free)',
    globs: {
      shipped: ['**/tokens/**'],
      repo: ['packages/basalt-ui/src/tokens/**'],
    },
    // Mantine-free boundary enforced by `basalt/token-layer-boundary`, repo-local only (see
    // ./charts above and that rule's file-header comment for why).
    forbiddenImports: [],
  },
  './theme-lab': {
    kind: 'tooling',
    layer: 'mantine-coupled',
    description: 'ThemeLabControls, applyOverrides, COLOR_GROUPS for live theme inspection',
    forbiddenImports: [],
  },
  './vite': {
    kind: 'tooling',
    layer: 'mantine-coupled',
    description: 'basaltViteConfig(opts) — Vite preset for basalt-ui consumer apps',
    forbiddenImports: [],
  },
  './guard': {
    kind: 'tooling',
    layer: 'headless',
    description: 'checkSource, GUARD_RULES, Finding types — the headless theme-guard core',
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/guard/**'],
    },
    // @visx/* ban dropped — `basalt/visx-boundary` now bans it universally outside charts.
    forbiddenImports: [...MANTINE_BANS],
  }, // 6th JS subpath
  './query': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'query',
    skill: ['basalt-app'],
    guardKinds: [],
    description: 'createBasaltQueryClient, transport-agnostic unwrap, lazy BasaltQueryDevtools',
    optionalPeers: ['@tanstack/react-query-devtools'],
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/query/**'],
    },
    // @visx/* ban dropped — `basalt/visx-boundary` now bans it universally outside charts.
    forbiddenImports: [...MANTINE_BANS],
  },
  './router-tanstack': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'router',
    skill: ['basalt-app'],
    guardKinds: [],
    description:
      'TanStack Router bridge: useBasaltNav (active route) + useRouterBreadcrumbs + createSearchParamStore (single-select URL-state store) + createMultiSearchParamStore (multi-select URL-state store)',
    optionalPeers: ['@tanstack/react-router'],
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/router-tanstack/**'],
    },
    // @visx/* ban dropped — `basalt/visx-boundary` now bans it universally outside charts.
    forbiddenImports: [...MANTINE_BANS],
  },
  './forms': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'forms',
    skill: ['basalt-design'],
    guardKinds: [],
    description:
      'Mantine form adapter: useBasaltForm, field, FormErrorSummary, useFormDraft (Standard Schema)',
    optionalPeers: ['@mantine/form'],
    forbiddenImports: [],
  },
  './notifications': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'notifications',
    skill: ['basalt-app'],
    guardKinds: [],
    description:
      'Mantine notifications: notify helpers, typed registry, persisted history, NotificationBell, NotificationCenter',
    optionalPeers: ['@mantine/notifications'],
    forbiddenImports: [],
  },
  './commands': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'commands',
    skill: ['basalt-app'],
    guardKinds: [],
    description:
      'typed command bus + overlay controller, toSpotlightActions, ShortcutsHelp, BasaltOverlays',
    optionalPeers: ['@mantine/spotlight', '@mantine/modals', '@tanstack/react-hotkeys'],
    forbiddenImports: [],
  },
  './data': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'data',
    skill: ['basalt-design'],
    guardKinds: [],
    description:
      'Convenience barrel pulling both TanStack Table + Virtual peer groups: BasaltDataTable, BasaltVirtualList (Mantine-rendered) — prefer ./data/table or ./data/virtual for per-feature opt-in',
    optionalPeers: ['@tanstack/react-table', '@tanstack/react-virtual'],
    forbiddenImports: [],
  },
  './data/table': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'data',
    skill: ['basalt-design'],
    guardKinds: [],
    description:
      'BasaltDataTable: a sortable data table over TanStack Table, rendered with Mantine (Mantine-rendered)',
    optionalPeers: ['@tanstack/react-table'],
    forbiddenImports: [],
  },
  './data/virtual': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'data',
    skill: ['basalt-design'],
    guardKinds: [],
    description:
      'BasaltVirtualList: a windowed virtual list over TanStack Virtual, rendered with Mantine (Mantine-rendered)',
    optionalPeers: ['@tanstack/react-virtual'],
    forbiddenImports: [],
  },
  './agent': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'agent',
    skill: ['basalt-app'],
    guardKinds: [],
    description:
      'Headless streaming-chat layer: useAgentStream, aiSdkTransport (recommended default) + edenTransport, PartList, plus the multi-thread createThreadsStore + useAgentThreadRuns + outcome-resolver seam (Mantine-free)',
    optionalPeers: ['ai', 'use-stick-to-bottom'],
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/agent/**'],
    },
    // @visx/* ban dropped — `basalt/visx-boundary` now bans it universally outside charts.
    forbiddenImports: [...MANTINE_BANS],
  },
  './content': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'content',
    skill: ['basalt-design'],
    guardKinds: [],
    description:
      'Prose (article/chat typography), CodeBlock (shiki, optional peer), Callout, TableOfContents, ReadingProgress, Markdown (react-markdown + remark-gfm, optional peers, streaming-aware), MermaidDiagram (beautiful-mermaid, optional peer), mdxComponents/createMdxComponents, ArticleLayout (docs-page frame), ArticleCard/ArticleGrid (overview cards), Article model (sortArticles/filterArticles/formatArticleDate), ArticleFilterBar (category/tags filter UI), toArticleActions (Spotlight projector, @mantine/spotlight type-only), GuideLink/GuideDrawer (contextual-help drawer) — the content/prose surface',
    optionalPeers: [
      'shiki',
      '@shikijs/langs',
      '@shikijs/themes',
      'beautiful-mermaid',
      'react-markdown',
      'remark-gfm',
      '@mantine/spotlight',
    ],
    forbiddenImports: [],
  },
  './state': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'state',
    skill: ['basalt-design'],
    guardKinds: ['localstorage-theme'],
    description:
      'createPersistedState (versioned localStorage) + useOnlineStatus — Mantine-free state primitives',
    optionalPeers: [],
    // Consumers import basalt-ui/state from node_modules (lint-ignored), so there is nothing to
    // enforce consumer-side, and a shipped **/state* glob would wrongly hit consumers' own
    // Mantine-using state files. Enforce only basalt's own src/state.ts.
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/state.ts'],
    },
    // @visx/* ban dropped — `basalt/visx-boundary` now bans it universally outside charts.
    forbiddenImports: [...MANTINE_BANS],
  },

  './connectivity': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'mantine',
    skill: ['basalt-app'],
    guardKinds: [],
    description:
      'ConnectivityProvider (aggregates browser online/offline, React Query onlineManager, SSE, and health-check pings into one status), useConnectivity, and ConnectivityIndicator — auto-mounted by BasaltProvider',
    optionalPeers: [],
    forbiddenImports: [],
  },

  // ── Non-JS published assets (ToolingSpec; not JS subpaths — check-coverage exempts these) ─────
  './styles.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'Mandatory CSS import (after the Mantine styles.layer.css bundles) — @layer basalt base styles, iOS input safety net, font stack',
    forbiddenImports: [],
  },
  './configs/*': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'Raw toolchain presets for consumer extends: oxlint.json, oxfmt.json, tsconfig.*.json, lefthook.yml, check.yml',
    forbiddenImports: [],
  },
  './llms.txt': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'Machine-readable surface map — one entry per published subpath with import specifier, description, layer, and optional peers',
    forbiddenImports: [],
  },

  // ── #-prefixed synthetic surfaces (advisory rules + global ban layer; NOT export keys) ────────
  '#app': {
    // synthetic global app-wide ban layer — the src/**+app/** glob
    kind: 'doctrine',
    layer: 'app-global',
    rule: 'mantine',
    skill: ['basalt-app'],
    guardKinds: [],
    globs: {
      // Shipped is a catch-all (not just src/**+app/**) so consumer code under components/, lib/,
      // features/, etc. is also covered. The @visx/*-only-in-charts and Mantine-free charts/tokens
      // boundaries used to live here too and need last-writer-wins EMIT_ORDER games against the
      // narrower ./tokens/./charts overrides — they're now enforced by `basalt/visx-boundary` and
      // `basalt/token-layer-boundary` (plugin rules, immune to that class of clobbering) instead,
      // so the bans left below (antd, framer-motion) are plain global bans with no narrower
      // override to out-order.
      shipped: ['**/*.{ts,tsx}'],
      // Repo is packages/basalt-ui/src/** ONLY. apps/playground is deliberately absent: it
      // dogfoods the shipped consumer preset through its own apps/playground/.oxlintrc.json
      // (`extends: ["./node_modules/basalt-ui/configs/oxlint.json"]`, resolved via the workspace
      // symlink), which oxlint honours as a nested config — the nearest config REPLACES this one
      // for that subtree, so listing playground here would be dead glob. That indirection is the
      // point: the playground sees exactly what a real consumer sees, including NOT receiving
      // `basalt/token-layer-boundary` (repo-local by design — see TOKEN_LAYER_BOUNDARY_SURFACES).
      repo: ['packages/basalt-ui/src/**'],
    },
    ruleOverrides: [{ rule: 'no-console', level: 'off', target: 'repo' }], // cli/bin/scripts, repo-local only
    forbiddenImports: [
      v('antd', 'Use Mantine — antd is not part of the basalt-ui stack.', { shippedOnly: true }),
      v('framer-motion', "Import from 'motion/react', not the raw framer-motion package."),
    ],
  },
} as const satisfies Record<string, SurfaceSpec>

// ── PROJECTION 1 — RULE_NAMES ─────────────────────────────────────────────────────────────────────

/**
 * Derived, deduped set of doctrine rule names. Projection 1 of SURFACES.
 * → ['mantine', 'charts', 'tokens', 'query', 'router', 'forms', 'notifications', 'commands', 'data', 'agent', 'content', 'state'] (order is insertion order of Set)
 *
 * @example
 * RULE_NAMES.includes('tokens') // true
 */
export const RULE_NAMES = [
  ...new Set(
    (Object.values(SURFACES) as readonly SurfaceSpec[])
      .filter((s): s is DoctrineSpec => s.kind === 'doctrine')
      .map((s) => s.rule),
  ),
] as const satisfies readonly RuleName[]

// ── PROJECTION 1b — SKILL_NAMES ───────────────────────────────────────────────────────────────────

/**
 * Derived, deduped set of doctrine skill names. Same projection shape as RULE_NAMES — the CLI's
 * managed-file manifest and check-coverage both consume it, so a skill referenced by any doctrine
 * surface is guaranteed a `agent/skills/{name}/SKILL.md` placement path.
 *
 * @example
 * SKILL_NAMES.includes('basalt-design') // true
 */
export const SKILL_NAMES = [
  ...new Set(
    (Object.values(SURFACES) as readonly SurfaceSpec[])
      .filter((s): s is DoctrineSpec => s.kind === 'doctrine')
      .flatMap((s) => [...s.skill]),
  ),
] as const satisfies readonly SkillName[]

// ── Token-layer-boundary-via-plugin membership ────────────────────────────────────────────────────

/**
 * Headless SURFACES keys whose Mantine-free guarantee is enforced by the `basalt/token-layer-
 * boundary` oxlint plugin rule (`configs/oxlint-plugin.js`) instead of a `forbiddenImports`
 * no-restricted-imports ban — the rule fires on `charts`/`tokens` path segments only, so ONLY
 * these two surfaces qualify (every other headless surface still carries its Mantine ban in
 * `forbiddenImports`).
 *
 * `basalt/token-layer-boundary` is registered ONLY in the repo-local `.oxlintrc.json`, never the
 * shipped consumer preset. It protects two things: layering — `tokens` is pure data that
 * `cssVariablesResolver` (Mantine-coupled) reads to bind Mantine's surfaces to the same `--vx-*`
 * vars `charts` reads, so an `@mantine/*` import in either would cycle back through the theme
 * layer or let a chart bypass `--vx-*` and fork chrome/charts apart — and packaging: `./charts`
 * and `./tokens` resolve and render with NO `@mantine/*` installed, real and CI-tested
 * (`scripts/pack-test.sh`'s "charts/tokens-only (no-Mantine) resolution + render" step,
 * `scripts/check-dist-layering.mjs`'s dist-graph walk). The LAYER is Mantine-free — the FRAMEWORK
 * is not (`.` requires Mantine as a non-optional peer; these two subpaths don't). Both are a
 * basalt-internal invariant, not a consumer contract (a consumer's own `charts/`/`tokens/`-named
 * directories carry no such obligation), which is why it stays repo-local. Because
 * of that, `checkCoverage()`'s assertion 7 treats membership here as a pure EXEMPTION from the
 * forbiddenImports requirement — it does NOT (and, being a shipped CLI subcommand that must run
 * from inside a consumer's node_modules, CANNOT) verify the rule's live registration itself. That
 * "fails loudly if enforcement is removed" guarantee lives in basalt's own CI instead
 * (`tests/surfaces-coverage.test.ts`, via `hasTokenLayerBoundaryRegistered` against
 * `.oxlintrc.json`).
 */
export const TOKEN_LAYER_BOUNDARY_SURFACES: ReadonlySet<string> = new Set(['./charts', './tokens'])

/**
 * True when a parsed oxlint config's `rules` object registers `basalt/token-layer-boundary` as
 * `'error'` — the live signal (not just a hardcoded assumption) that `TOKEN_LAYER_BOUNDARY_SURFACES`
 * are actually enforced. Pure — callers read + JSON.parse the config file themselves (surfaces.ts
 * stays dependency-free, no fs access here). Consumed only by basalt's own CI
 * (`tests/surfaces-coverage.test.ts`) against the repo-local `.oxlintrc.json` — NOT by
 * `checkCoverage()`, which cannot read that repo-local file from an installed package (see
 * `TOKEN_LAYER_BOUNDARY_SURFACES`'s doc comment).
 *
 * @example
 * hasTokenLayerBoundaryRegistered({ 'basalt/token-layer-boundary': 'error' }) // true
 * hasTokenLayerBoundaryRegistered({}) // false
 */
export function hasTokenLayerBoundaryRegistered(
  rules: Record<string, unknown> | undefined,
): boolean {
  return rules?.['basalt/token-layer-boundary'] === 'error'
}
