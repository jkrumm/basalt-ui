/**
 * SURFACES registry — the one hard source for the enforcement seam.
 * Mantine-free, dependency-free. Imports only ./guard/types.
 *
 * SURFACES: the discriminated doctrine|tooling registry for all basalt subpaths and advisory surfaces.
 * RULE_NAMES: derived projection — the deduped set of doctrine rule names (PROJECTION 1).
 */
import type { GuardKind } from './guard/types'

// ── Scalar types ──────────────────────────────────────────────────────────────────────────────────

/** The 11 on-disk rule names (agent/rules/basalt-{name}.md — the set-equality target).
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

/** The 3 plugin skill names (plugins/basalt/skills/basalt-{name}/).
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
   * REPLACE-not-inherit-and-add. When true, this surface's forbiddenImports are the COMPLETE ban
   * set for its glob — the generator MUST NOT inherit-and-add the parent (src/**) bans. Charts sets
   * this so the @visx/* ban from src/** does NOT leak into the charts override (which would re-ban
   * visx). The projection emits the full list.
   */
  readonly replaceBans?: true
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

const MANTINE_BANS = [
  v('@mantine/core', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
  v('@mantine/hooks', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
  vg('@mantine/*', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
] as const

// ── SURFACES ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The one hard source for the enforcement seam. Keys split into two kinds:
 * - JS-subpath keys (., ./charts, ./tokens, ./theme-lab, ./vite, ./guard, ./query, ./router-tanstack, ./forms, ./notifications, ./commands, ./data, ./agent, ./state) — real package.json exports.
 * - #-prefixed synthetic keys (#app) — the synthetic global app-wide ban layer. The #-prefix
 *   guarantees it is never mistaken for an export path.
 *
 * @example
 * import { SURFACES } from 'basalt-ui/src/surfaces'
 * const doctrines = Object.values(SURFACES).filter((s): s is DoctrineSpec => s.kind === 'doctrine')
 */
export const SURFACES = {
  // ── JS-subpath surfaces ──────────────────────────────────────────────────────────────────────
  '.': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'mantine',
    skill: ['basalt-app', 'basalt-design'],
    guardKinds: [],
    description:
      'BasaltProvider, createBasaltTheme, BasaltShell + sidebar/mobile-nav/breadcrumbs, NavCountBadge',
    forbiddenImports: [], // the no-charts/tokens-reexport invariant is comment-only today; Phase-4 plugin
  },
  './charts': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'charts',
    skill: ['basalt-charts'],
    guardKinds: ['raw-hex', 'raw-color-fn', 'raw-visx-axis'],
    description: 'visx chart primitives, sparklines, hooks, and token re-exports (Mantine-free)',
    globs: {
      shipped: ['**/charts/**'],
      repo: ['packages/basalt-ui/src/charts/**'],
    },
    replaceBans: true, // @visx/* MUST NOT inherit from src/** (the re-allow). Full list emitted.
    forbiddenImports: [
      ...MANTINE_BANS,
      v('@visx/tooltip', 'Use ChartTooltip + TooltipHeader/Row/Body from {ctx}.'),
      // LOAD-BEARING ABSENCE: no @visx/* group ban here — charts uniquely permits @visx/*.
    ],
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
    forbiddenImports: [
      ...MANTINE_BANS,
      vg('@visx/*', 'Direct @visx/* imports are only allowed inside the charts boundary ({ctx}).'),
    ], // shipped tokens override is MISSING today → this projection EMITS it (closes D2)
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
    forbiddenImports: [],
  }, // 6th JS subpath
  './query': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'query',
    skill: ['basalt-app'],
    guardKinds: [],
    description: 'createBasaltQueryClient, transport-agnostic unwrap, lazy BasaltQueryDevtools',
    optionalPeers: ['@tanstack/react-query', '@tanstack/react-query-devtools'],
    forbiddenImports: [],
  },
  './router-tanstack': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'router',
    skill: ['basalt-app'],
    guardKinds: [],
    description: 'TanStack Router bridge: useBasaltNav (active route) + useRouterBreadcrumbs',
    optionalPeers: ['@tanstack/react-router'],
    forbiddenImports: [],
  },
  './forms': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'forms',
    skill: ['basalt-design'],
    guardKinds: [],
    description:
      'Mantine form adapter: createForm, field, FormErrorSummary, useFormDraft (Standard Schema)',
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
      'Mantine notifications: notify helpers, typed registry, persisted history, NotificationBell',
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
      'TanStack Table + Virtual kinds: BasaltDataTable, BasaltVirtualList (Mantine-rendered)',
    optionalPeers: ['@tanstack/react-table', '@tanstack/react-virtual'],
    forbiddenImports: [],
  },
  './agent': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'agent',
    skill: ['basalt-app'],
    guardKinds: [],
    description:
      'Headless streaming-chat layer: useAgentStream, edenTransport, PartList (Mantine-free)',
    optionalPeers: ['react-markdown', 'remark-gfm', 'use-stick-to-bottom'],
    globs: {
      shipped: ['**/agent/**'],
      repo: ['packages/basalt-ui/src/agent/**'],
    },
    forbiddenImports: [
      ...MANTINE_BANS,
      vg('@visx/*', 'Direct @visx/* imports are only allowed inside the charts boundary ({ctx}).'),
    ],
  },
  './state': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'state',
    skill: ['basalt-design'],
    guardKinds: ['localstorage-theme'],
    description: 'createPersistedState — versioned localStorage state primitive (Mantine-free)',
    optionalPeers: [],
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
      shipped: ['src/**', 'app/**'],
      repo: ['packages/basalt-ui/src/**', 'apps/playground/src/**'],
    },
    ruleOverrides: [{ rule: 'no-console', level: 'off', target: 'repo' }], // cli/bin/scripts, repo-local only
    forbiddenImports: [
      v('antd', 'Use Mantine — antd is not part of the basalt-ui stack.', { shippedOnly: true }),
      v('@visx/tooltip', 'Use ChartTooltip + TooltipHeader/Row/Body from {ctx}.'),
      vg('@visx/*', 'Direct @visx/* imports are only allowed inside the charts boundary ({ctx}).'),
    ],
  },
} as const satisfies Record<string, SurfaceSpec>

// ── PROJECTION 1 — RULE_NAMES ─────────────────────────────────────────────────────────────────────

/**
 * Derived, deduped set of doctrine rule names. Projection 1 of SURFACES.
 * → ['mantine', 'charts', 'tokens', 'query', 'router', 'forms', 'notifications', 'commands', 'data', 'agent', 'state'] (order is insertion order of Set)
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
