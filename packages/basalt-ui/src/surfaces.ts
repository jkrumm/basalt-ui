/**
 * SURFACES registry — the one hard source for the enforcement seam.
 * Mantine-free, dependency-free. Imports only ./guard/types.
 *
 * SURFACES: the discriminated doctrine|tooling registry for all basalt subpaths and advisory surfaces.
 * RULE_NAMES: derived projection — the deduped set of doctrine rule names (PROJECTION 1).
 */
import type { GuardKind } from './guard/types'

// ── Scalar types ──────────────────────────────────────────────────────────────────────────────────

/** The 6 on-disk rule names (agent/rules/basalt-{name}.md — the set-equality target).
 *
 * One rule file per DOCTRINE, not per subpath: `state` also owns the router bridge's placement law
 * (the two were one argument split across two files), and `batteries` owns every adapter surface
 * whose doctrine is "use the shipped thing" — query, forms, notifications, commands, data, content,
 * agent and the app-global layer. Thirteen files carried 4,177 lines, 55% of it with no guard
 * behind it and the identity paragraph restated six times (`docs/CONTROLS-SPEC.md` §7).
 *
 * @example
 * const r: RuleName = 'tokens' // ok
 * // const bad: RuleName = 'overlays' // tsc error — not in the union
 */
export type RuleName = 'tokens' | 'charts' | 'mantine' | 'state' | 'controls' | 'batteries'

/**
 * Every rule the shipped oxlint JS plugin registers (`configs/oxlint-plugin.js` → `rules`), as one
 * literal union AND one runtime list — the type and the list are the same declaration, so they
 * cannot drift from each other. What they CAN drift from is the plugin itself, which this module
 * must not import (it is a standalone `.js` loaded through `jsPlugins` out of a consumer's
 * node_modules, and `surfaces.ts` is dependency-free by contract). `oxlint-plugin.test.ts` closes
 * that gap: it asserts this list is EXACTLY the plugin's own rule keys, and `check-coverage`
 * asserts every id here maps to exactly one surface.
 *
 * @example
 * const id: PluginRuleId = 'hand-rolled-filter' // ok
 * // const bad: PluginRuleId = 'hand-rolled-filters' // tsc error
 */
export const PLUGIN_RULE_ID_LIST = [
  'no-raw-font-size',
  'raw-size-literal',
  'card-inset',
  'chart-in-raw-surface',
  'hand-rolled-plot',
  'chart-legend-literal',
  'shadow-basalt-export',
  'hand-rolled-shell',
  'raw-scroll-container',
  'hand-rolled-filter',
  'control-outside-home',
  'control-size-literal',
  'page-bar-budget',
  'in-body-page-title',
  'responsive-twin',
  'search-literal-link',
  'use-search-from-literal',
  'visx-boundary',
  'visx-tooltip',
  'token-layer-boundary',
  'agent-resume-guard',
  'agent-no-raw-usechat',
  'ai-sdk-major',
] as const

/** One registered oxlint plugin rule id — the literal union of {@link PLUGIN_RULE_ID_LIST}. */
export type PluginRuleId = (typeof PLUGIN_RULE_ID_LIST)[number]

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
  /**
   * Optional peer package names this surface depends on (e.g. '@tanstack/react-query').
   * Single source of truth — read by gen-llms.ts and cli/index.ts; versions resolved from package.json.
   *
   * Lives on the base, not the doctrine triad: an optional peer is a PACKAGING fact, so a tooling
   * surface can carry one too (`./vite` → `vite-plugin-pwa`).
   */
  readonly optionalPeers?: readonly string[]
}

/**
 * A doctrine surface owes the full triad (rule + skill[] + guardKinds[]).
 * A bad rule/skill/kind name is a tsc error (literal-union).
 *
 * @example
 * const s: DoctrineSpec = { kind: 'doctrine', layer: 'headless', rule: 'tokens',
 *   skill: ['basalt-design'], guardKinds: ['raw-hex'], pluginRules: ['no-raw-font-size'],
 *   forbiddenImports: [] }
 */
export type DoctrineSpec = BaseSurface & {
  readonly kind: 'doctrine'
  readonly rule: RuleName
  /** A LIST (skill↔surface is many-to-one — basalt-design covers tokens AND mantine AND state). */
  readonly skill: readonly SkillName[]
  /** Required, but [] is legal for advisory surfaces (the batteries: rule only, no guard). */
  readonly guardKinds: readonly GuardKind[]
  /**
   * The oxlint plugin rules this surface's doctrine is enforced by — the AST half of the same seam
   * `guardKinds` covers with text scans. Required (`[]` is legal, and says "no AST rule guards
   * this"), because the ABSENCE of the field is what let the generated coverage headers claim a
   * rule was "backed by" a guard kind while the plugin rule doing the real work went unnamed (D8).
   *
   * Every id in {@link PLUGIN_RULE_ID_LIST} maps to EXACTLY ONE surface — asserted by
   * `check-coverage` and by `oxlint-plugin.test.ts`, so a new plugin rule cannot ship without a
   * home, and one rule cannot be counted as coverage for two surfaces.
   */
  readonly pluginRules: readonly PluginRuleId[]
  /**
   * Laws this surface states but nothing enforces — printed under `not guarded:` in the generated
   * `<!-- basalt:coverage -->` header. The honest half of the block: claiming coverage that does
   * not exist is D8, and the only way a reader can tell is if the doc says so itself.
   */
  readonly advisoryLaws?: readonly string[]
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
  readonly pluginRules?: never
  readonly advisoryLaws?: never
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
    guardKinds: [
      'raw-motion-value',
      'card-with-border',
      'raw-form-control',
      'sub-16-input-font',
      'mantine-shade-index',
      // The text lane of the kinds whose remedy IS a Mantine primitive or a Mantine-owned prop:
      // C8's page title (same id as the plugin rule, so one annotation waives both lanes), the
      // spacing props, and the layout primitives an inline `display`/raw element replaces.
      'in-body-page-title',
      'raw-spacing',
      'inline-spacing',
      'inline-display',
      'raw-html-layout',
      'hidden-inline-style',
    ],
    // The chrome half of the plugin: the shell, the card idiom, the page title and the scroll
    // doctrine. `hand-rolled-shell` sits here rather than on a shell-shaped surface because
    // `BasaltShell` IS the root barrel's promise (docs/CONTROLS-SPEC.md §6 wave 6).
    pluginRules: [
      'hand-rolled-shell',
      'card-inset',
      'in-body-page-title',
      'raw-scroll-container',
      'page-bar-budget',
      'shadow-basalt-export',
    ],
    description:
      'BasaltProvider, createBasaltTheme, BasaltShell + sidebar/mobile-nav/breadcrumbs, PageBar, NavCountBadge, ThemeToggle, ThreadWorkspace + thread-chat components, WidgetHeader, dashboard composites (DeltaBadge, StatCard with threshold tone, EmptyState, QueryState/LoadingState/ErrorState, SettingsSection/SettingsRow/DangerZone)',
    optionalPeers: [
      'react-markdown',
      'remark-gfm',
      'rehype-sanitize',
      'remend',
      'shiki',
      'beautiful-mermaid',
    ],
    forbiddenImports: [], // the no-charts/tokens-reexport invariant is comment-only today; Phase-4 plugin
  },
  './charts': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'charts',
    skill: ['basalt-charts'],
    guardKinds: [
      'raw-hex',
      'raw-color-fn',
      'raw-visx-axis',
      'unframed-chart',
      'chart-missing-aria-label',
    ],
    pluginRules: [
      'hand-rolled-plot',
      'chart-legend-literal',
      'chart-in-raw-surface',
      'visx-boundary',
      'visx-tooltip',
    ],
    description:
      'CartesianChart + visx chart primitives, kinds, sparklines, hooks, and token re-exports (Mantine-free)',
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
    guardKinds: [
      'raw-hex',
      'raw-color-fn',
      'off-identity-accent',
      'off-system-surface-var',
      // The rest of the value lane: every kind whose remedy is a `--vx-*` token or a theme knob,
      // in TSX and in kebab CSS alike.
      'raw-font-family',
      'raw-radius',
      'raw-surface',
      'inline-font-size',
      'css-raw-surface',
      'surface-shadow-override',
      // Not a token kind — the kind that judges the ANNOTATION rather than the code. It lands here
      // because `agent/rules/basalt-tokens.md` is where the `theme-allow` grammar is documented
      // (said once, on purpose), so this is the header that must name its enforcement.
      'theme-allow-unscoped',
    ],
    // The type-scale rules live with the tokens, not with `.`: both police a value that left the
    // `--vx-*` system, which is this surface's whole subject. `token-layer-boundary` is the
    // repo-local-only rule that keeps the layer upstream of Mantine (see below).
    pluginRules: ['no-raw-font-size', 'raw-size-literal', 'token-layer-boundary'],
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
    description:
      'ThemeLabControls, applyOverrides, COLOR_GROUPS — a low-level inspector for the non-derived structural tokens; identity/color tuning lives in DeriveControls',
    forbiddenImports: [],
  },
  './vite': {
    kind: 'tooling',
    layer: 'mantine-coupled',
    description:
      'basaltViteConfig(opts) — Vite preset for basalt-ui consumer apps; basaltAppPlugin(opts) — PWA head, manifest, and icon metadata derived from the token palette',
    optionalPeers: ['vite-plugin-pwa'],
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
    rule: 'batteries',
    skill: ['basalt-app'],
    guardKinds: [],
    pluginRules: [],
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
    rule: 'state',
    skill: ['basalt-app'],
    guardKinds: [],
    // Law C10 — a nav link's `search` and a reader's `from` are both this bridge's contract.
    pluginRules: ['search-literal-link', 'use-search-from-literal'],
    description:
      'TanStack Router bridge: defineNav/navGroup/navTarget (one typed nav definition) + useNav (sections + mobileNav, spread onto BasaltShell) + useBasaltNav (active route) + useRouterBreadcrumbs + createSearchStore (typed URL > localStorage > fallback store over field.enum/multi/range/number/boolean/string; deprecated createSearchParamStore/createMultiSearchParamStore wrappers until 1.29.0)',
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
    rule: 'batteries',
    skill: ['basalt-design'],
    guardKinds: [],
    pluginRules: [],
    description:
      'Mantine form adapter: useBasaltForm, field, FormErrorSummary, useFormDraft (Standard Schema)',
    optionalPeers: ['@mantine/form'],
    forbiddenImports: [],
  },
  './notifications': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-app'],
    guardKinds: [],
    pluginRules: [],
    description:
      'Mantine notifications: notify helpers, typed registry, persisted history, NotificationBell, NotificationCenter',
    optionalPeers: ['@mantine/notifications'],
    forbiddenImports: [],
  },
  './commands': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-app'],
    guardKinds: [],
    pluginRules: [],
    description:
      'typed command bus + overlay controller, toSpotlightActions, ShortcutsHelp, BasaltOverlays',
    optionalPeers: ['@mantine/spotlight', '@mantine/modals', '@tanstack/react-hotkeys'],
    forbiddenImports: [],
  },
  './data': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-design'],
    guardKinds: [],
    pluginRules: [],
    description:
      'Convenience barrel pulling both TanStack Table + Virtual peer groups: BasaltDataTable, BasaltVirtualList (Mantine-rendered) — prefer ./data/table or ./data/virtual for per-feature opt-in',
    optionalPeers: ['@tanstack/react-table', '@tanstack/react-virtual'],
    forbiddenImports: [],
  },
  './data/table': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-design'],
    guardKinds: [],
    pluginRules: [],
    description:
      'BasaltDataTable: a sortable data table over TanStack Table, rendered with Mantine (Mantine-rendered)',
    optionalPeers: ['@tanstack/react-table'],
    forbiddenImports: [],
  },
  './data/virtual': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-design'],
    guardKinds: [],
    pluginRules: [],
    description:
      'BasaltVirtualList: a windowed virtual list over TanStack Virtual, rendered with Mantine (Mantine-rendered)',
    optionalPeers: ['@tanstack/react-virtual'],
    forbiddenImports: [],
  },
  './agent': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'batteries',
    skill: ['basalt-app'],
    guardKinds: [],
    // The three agent-chat correctness rules — they honour `basalt-agent-allow`, not `theme-allow`.
    pluginRules: ['agent-resume-guard', 'agent-no-raw-usechat', 'ai-sdk-major'],
    description:
      'Headless streaming-chat layer: useAgentStream, aiSdkTransport (recommended default) + edenTransport, isResumable/ResumableAgentTransport (stream-resumption seam), PartList, coalesceParts, the ForeignPart/definePartRenderers/narrowAgentPart open part-registry seam, plus the multi-thread createThreadsStore + useAgentThreadRuns + outcome-resolver seam (Mantine-free)',
    optionalPeers: ['ai', 'use-stick-to-bottom'],
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/agent/**'],
    },
    // @visx/* ban dropped — `basalt/visx-boundary` now bans it universally outside charts.
    forbiddenImports: [...MANTINE_BANS],
  },
  './agent-chat': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-app'],
    guardKinds: [],
    pluginRules: [],
    description:
      'Mantine-styled thread-chat components over basalt-ui/agent: ThreadWorkspace, ThreadFeed (variant/renderRow), ThreadFeedRow (inline-expanding Slack row, lazily mounted + kept mounted), ThreadOutcomeCard, ThreadDetailPanel, Composer, ThreadTranscript (open part-renderer registry via its renderers/fallbackRenderer props, per-message MessageAffordances, groupConsecutive, and an optional virtualize/height windowing mode whose VirtualizeOptions carry overscan/estimateSize/initialScroll — a virtualized transcript opens scrolled to the newest message unless initialScroll is "start"), threadPartRenderers, ToolChip (Mantine-coupled). motion is required, not optional — ThreadFeed/ThreadDetailPanel import motion/react eagerly, so this subpath fails to resolve without it installed even though peerDependenciesMeta marks it optional (npm has no per-subpath optionality). remend is genuinely optional here — ThreadTranscript reaches it only through the lazy dynamic import() inside content/markdown.tsx, and @tanstack/react-virtual the same way through the lazy import() behind ThreadTranscript virtualize (absent peer degrades to an unwindowed, height-bound pane).',
    optionalPeers: [
      'ai',
      'motion',
      'remend',
      'use-stick-to-bottom',
      'react-markdown',
      'remark-gfm',
      'shiki',
      '@shikijs/langs',
      '@shikijs/themes',
      'beautiful-mermaid',
      '@tanstack/react-virtual',
    ],
    forbiddenImports: [],
  },
  './content': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-design'],
    guardKinds: [],
    pluginRules: [],
    description:
      'Prose (article/chat typography), CodeBlock (shiki, optional peer), Callout, TableOfContents, ReadingProgress, Markdown (react-markdown + remark-gfm, optional peers; `streaming` is a rendering mode ONLY — `contentTrust` is the independent security input, and any surface rendering agent/model output must pin `contentTrust="untrusted"`, the sole input to the image-origin allowlist; a `fenceRenderers` registry — settledOnly/FenceRenderer/FenceRenderers/FenceRenderContext; `sanitizeSchema`, an additions-only SanitizeSchemaExtension merged over BASALT_SANITIZE_SCHEMA via mergeSanitizeSchema; the remend streaming-repair pass is now a lazy optional peer), MermaidDiagram (beautiful-mermaid, optional peer), mdxComponents/createMdxComponents, ArticleLayout (docs-page frame), ArticleCard/ArticleGrid (overview cards), Article model (sortArticles/filterArticles/formatArticleDate), FilterSet/ViewTabs/MultiSelectFilter re-exported from ./controls (they replaced the controlled ArticleFilterBar), toArticleActions (Spotlight projector, @mantine/spotlight type-only), GuideLink/GuideDrawer (contextual-help drawer) — the content/prose surface',
    optionalPeers: [
      'shiki',
      '@shikijs/langs',
      '@shikijs/themes',
      'beautiful-mermaid',
      'react-markdown',
      'remark-gfm',
      'rehype-sanitize',
      'remend',
      '@mantine/spotlight',
    ],
    forbiddenImports: [],
  },
  './controls': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'controls',
    skill: ['basalt-design'],
    // The text lane of law C1 — the plugin's `control-outside-home` seen through a 12-line host-tag
    // window, since a regex scan has no ancestry. Same law, same wave, same promotion.
    guardKinds: ['raw-selection-control'],
    // The control tier itself (laws C1/C3/C5/C9). `hand-rolled-filter`, `control-size-literal` and
    // `responsive-twin` all ship `error`; `control-outside-home` is the one grace entry left in
    // `PLUGIN_RULE_GRACE`, re-dated to 1.28.0 against the wave-7 measurement (see its `why`).
    // The budget rules live on `.` with `PageBar` itself.
    pluginRules: [
      'hand-rolled-filter',
      'control-outside-home',
      'control-size-literal',
      'responsive-twin',
    ],
    // docs/CONTROLS-SPEC.md §6 "Honest coverage" — verbatim, because a generated header claiming
    // otherwise is D8 again.
    advisoryLaws: [
      'C1 as a cross-file law (a control placed in one file, its home declared in another)',
      'hand-rolled section headings (argo writes `<Text fw={600} size="sm">` + children, which no AST heuristic matches without false positives)',
      'C11 — a table/list stating its count when it is not a BasaltDataTable',
      'C12 — one shape for refresh/sync (SyncButton); only the alias table sees a renamed copy',
    ],
    description:
      'The control tier (docs/CONTROLS-SPEC.md §3): FilterSet (nowrap row + measured +N fold + the mobile Filters (n) sheet), RangeFilter/CompareFilter/SelectFilter/MultiSelectFilter/NumberFilter/SearchFilter/ToggleFilter (each bound to a FieldHandle — no value/onChange/size, law C2/C5; NumberFilter is the field.number lane, a radio list over `options` or a stepper without), ViewTabs, and the action/sync family (ActionGroup, OverflowMenu, SyncButton, BarAction/GlobalAction). Every control owns its own desktop/mobile swap in CSS (C9) and renders size="ctl" internally. Resolves and renders with NO @mantine/dates installed — the custom date picker is injected through RangeFilter.customPicker from ./controls-dates.',
    optionalPeers: [],
    forbiddenImports: [],
  },
  './controls-dates': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'controls',
    skill: ['basalt-design'],
    guardKinds: [],
    pluginRules: [],
    description:
      "DateRangePicker — the @mantine/dates implementation of RangeFilter's customPicker seam. Its own subpath because @mantine/dates is an optional peer and basaltViteConfig pre-bundles the whole @mantine scope, so a consumer without the peer (linewatch) must never resolve it: nothing under src/controls may import it, statically or lazily (docs/CONTROLS-SPEC.md §3).",
    optionalPeers: ['@mantine/dates'],
    forbiddenImports: [],
  },
  './state': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'state',
    skill: ['basalt-design'],
    guardKinds: ['localstorage-theme'],
    pluginRules: [],
    description:
      'createPersistedState (versioned localStorage) + the store field vocabulary (field.enum/multi/range/number/boolean/string, FieldHandle, lanes) + createLocalStore, the router-free store — Mantine-free state primitives',
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
    pluginRules: [],
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
  './tokens.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'Prebuilt --vx-* token stylesheet — the default buildPaletteCss() output as a plain file, for a consumer that has a bundler to resolve the subpath but no React and no Mantine; with no bundler, emit a file you own via `basalt-ui tokens:css`',
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
    rule: 'batteries',
    skill: ['basalt-app'],
    guardKinds: [],
    pluginRules: [],
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
 * → ['mantine', 'charts', 'tokens', 'batteries', 'state', 'controls'] (order is insertion order of Set)
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
