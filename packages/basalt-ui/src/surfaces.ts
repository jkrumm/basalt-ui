/**
 * SURFACES registry — the one hard source for the enforcement seam.
 * Mantine-free, dependency-free.
 *
 * SURFACES: the discriminated doctrine|tooling registry for all basalt subpaths and advisory surfaces.
 * RULE_NAMES: derived projection — the deduped set of doctrine rule names (PROJECTION 1).
 */
// ── Scalar types ──────────────────────────────────────────────────────────────────────────────────

/** The 6 on-disk rule names (agent/rules/basalt-{name}.md — the set-equality target).
 *
 * One rule file per DOCTRINE, not per subpath: `state` also owns the router bridge's placement law
 * (the two were one argument split across two files), and `batteries` owns every adapter surface
 * whose doctrine is "use the shipped thing" — forms, commands, table, content, agent and the
 * app-global layer. Thirteen files carried 4,177 lines, 55% of it with no guard
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
  'shadow-basalt-export',
  'hand-rolled-shell',
  'raw-scroll-container',
  'hand-rolled-filter',
  'control-outside-home',
  'bound-control-outside-home',
  'control-size-literal',
  'in-body-page-title',
  'responsive-twin',
  'search-literal-link',
  'use-search-from-literal',
  'query-fn-unwrap',
  'forms-field-key',
  'chart-engine-boundary',
  'chart-host-single',
  'token-layer-boundary',
  'agent-no-raw-usechat',
  'ai-sdk-major',
  'no-import-meta-env',
  'raw-breakpoint',
  'no-dev-helper',
  'route-view-transition',
  'status-fill-as-text',
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
export type Layer = 'mantine-coupled' | 'headless' | 'app-global' | 'non-js-asset' | 'build-tooling'

/**
 * A single import ban. `{ctx}` in the message is filled per target so shipped/repo wording
 * is one source.
 *
 * @example
 * const ban: ForbiddenImport = { spec: 'antd', match: 'path', message: 'Compose the shipped parts.', shippedOnly: true }
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
 * A doctrine surface owes the triad (rule + skill[] + pluginRules[]).
 * A bad rule/skill/kind name is a tsc error (literal-union).
 *
 * @example
 * const s: DoctrineSpec = { kind: 'doctrine', layer: 'headless', rule: 'tokens',
 *   skill: ['basalt-design'], pluginRules: ['no-raw-font-size'],
 *   forbiddenImports: [] }
 */
export type DoctrineSpec = BaseSurface & {
  readonly kind: 'doctrine'
  readonly rule: RuleName
  /** A LIST (skill↔surface is many-to-one — basalt-design covers tokens AND mantine AND state). */
  readonly skill: readonly SkillName[]
  /**
   * The oxlint plugin rules this surface's doctrine is enforced by. Required (`[]` is legal, and
   * says "no AST rule guards this"), because the ABSENCE of the field is what let the generated
   * coverage headers claim a rule was "backed by" a guard while the plugin rule doing the real work
   * went unnamed (D8).
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
// ── SURFACES ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The one hard source for the enforcement seam. Keys split into two kinds:
 * - JS-subpath keys (., ./charts, ./tokens, ./controls, ./table, ./format, ./content, ./vite, plus the v3 subpaths ./router, ./data, ./page, ./cards, ./ai, ./ui/*, ./core/*, ./shell, ./lint, ./stylelint, ./testing, ./theme-script) — real package.json exports (the 15-subpath map of docs/V2-SPEC.md §1, with ./styles.css, ./configs/* and the v3 CSS entries as the non-JS assets).
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
    // The chrome half of the plugin: the shell, the card idiom, the page title and the scroll
    // doctrine. `hand-rolled-shell` sits here rather than on a shell-shaped surface because
    // the shell (`AppShell`, from `./shell`) IS the framework's promise (docs/CONTROLS-SPEC.md §6 wave 6).
    pluginRules: [
      'hand-rolled-shell',
      // The size-class axis's one JSX escape hatch (docs/CONTROLS-SPEC.md §6) is reserved
      // for BasaltShell/AppSidebar/MobileNav/AppBrand (`SHELL_HOME_NAMES`, configs/oxlint-plugin.js)
      // — the same shell promise `hand-rolled-shell` polices, one axis over.
      'raw-breakpoint',
      'card-inset',
      'in-body-page-title',
      'raw-scroll-container',
      'shadow-basalt-export',
      // Route transitions are `createBasaltRouter`'s `defaultViewTransition`; a React
      // `<ViewTransition>` around `<Outlet>` is inert and fights it.
      'route-view-transition',
      // Dev-only `import()`s need a literal NODE_ENV gate to fold out of production (repo-local).
      'no-dev-helper',
      // `import.meta.env` is a Vite-ism that fails outside a Vite build (SSR/server code, Node
      // scripts, tests) — process.env.NODE_ENV works everywhere basalt code runs. Repo-local,
      // scoped to all of src/**, one surface required by coverage (C2 consolidation).
      'no-import-meta-env',
      // Rows of the deleted 2.x runtime's surfaces, kept on the one remaining doctrine surface until
      // the plugin retires them (`search-literal-link`, `use-search-from-literal`, `forms-field-key`,
      // `agent-no-raw-usechat`, `ai-sdk-major`).
      'search-literal-link',
      'use-search-from-literal',
      'forms-field-key',
      'agent-no-raw-usechat',
      'ai-sdk-major',
    ],
    // agent/rules/basalt-mantine.md — stated, not guarded. This law has no AST form to catch, because
    // `cssVariablesResolver` is now `Omit`ted from the accepted prop type and a hand-built
    // `createTheme` is a consumer's own call to make. (`duplicate-notifications-mount`, the
    // other 1.28.0 mount-order rule, retired — `BasaltNotifications` no longer exists.)
    advisoryLaws: [
      "no second cssVariablesResolver — don't hand-build createTheme or re-add the resolver basalt already installs",
    ],
    description:
      'The state seams (`persisted`, `notify`, `createChannel`, `externalField`, `useNow`, `createFormat`, `useFormat`). Reaches no subpath-required peer.',
    optionalPeers: [
      'remark-gfm',
      'rehype-sanitize',
      'remend',
      'shiki',
      'beautiful-mermaid',
      '@tanstack/react-router-devtools',
    ],
    forbiddenImports: [], // the no-charts/tokens-reexport invariant is comment-only today; Phase-4 plugin
  },
  './charts': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'charts',
    skill: ['basalt-charts'],
    pluginRules: ['chart-in-raw-surface', 'chart-engine-boundary', 'chart-host-single'],
    description:
      'CartesianChart (the TanStack Charts rung), the Lines, Bars, Sparkline, Heatmap and BandStrip kinds, ChartCard, the shared chartCursor and the geometry seam: useChartFocus (focus, dim the rest, one bound readout) and chartLabels (server-equal label width and placement) (Mantine-free; @tanstack/charts + d3-scale peers)',
    optionalPeers: ['@tanstack/charts', 'd3-scale'],
    globs: {
      shipped: ['**/charts/**'],
      repo: ['packages/basalt-ui/src/charts/**'],
    },
    // The engine boundary (@visx/* banned, @tanstack/charts allowlisted) is enforced by the
    // `basalt/chart-engine-boundary` oxlint plugin rule, `@tanstack/charts/react` by the
    // repo-local `basalt/chart-host-single`, and the Mantine-free boundary by `basalt/token-layer-boundary` (repo-local only — see
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
    // The type-scale rules live with the tokens, not with `.`: both police a value that left the
    // `--vx-*` system, which is this surface's whole subject. `token-layer-boundary` is the
    // repo-local-only rule that keeps the layer upstream of Mantine (see below).
    pluginRules: [
      'no-raw-font-size',
      'raw-size-literal',
      'status-fill-as-text',
      'token-layer-boundary',
    ],
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
  './vite': {
    kind: 'tooling',
    layer: 'build-tooling',
    description:
      'basalt(opts) — v3 plugin: peer and seed build gates, eject aliases, `.basalt/sources.css`, theme script, theme-color and manifest; basaltViteConfig(opts) — 2.x Vite preset',
    optionalPeers: ['vite-plugin-pwa'],
    forbiddenImports: [],
  },
  './table': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-design'],
    pluginRules: [],
    description:
      '`DataTable` over `useDataTable`, the `col` kind columns, the parts `DataTable` composes (`TableToolbar`, `DataTableBody`, `TablePager`, `BulkBar`) and `tableCodec`, on TanStack Table v9 and `ui/*` primitives',
    optionalPeers: ['@tanstack/react-table', '@base-ui/react'],
    forbiddenImports: [],
  },
  './content': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'batteries',
    skill: ['basalt-design'],
    pluginRules: [],
    description:
      'Markdown (react-markdown + remark-gfm + rehype-sanitize + remend, all required peers, every import static so server, client and hydrate render the same tree; `contentTrust` is REQUIRED and independent of `streaming`, which is a rendering mode only — render agent or model output with `contentTrust="untrusted"`: no `<img>` (alt text; `images="same-origin"` admits relative srcs), links limited to same-origin, https:, mailto: and tel:, and no `sanitize` or `rehypePlugins`; `contentTrust="trusted"` takes `sanitize` ({ allowTags, allowAttrs } additions over a fixed policy that runs last) and `rehypePlugins`; a missing or unknown `contentTrust` renders as untrusted) — the content surface',
    optionalPeers: [
      'shiki',
      '@shikijs/langs',
      '@shikijs/themes',
      'beautiful-mermaid',
      'react-markdown',
      'remark-gfm',
      'rehype-sanitize',
      'remend',
    ],
    forbiddenImports: [],
  },
  './controls': {
    kind: 'doctrine',
    layer: 'mantine-coupled',
    rule: 'controls',
    skill: ['basalt-design'],
    // The text lane of law C1 — the plugin's `control-outside-home` seen through a host-tag nesting
    // count, since a regex scan has no AST. Same law, same wave, same promotion.
    // The control tier itself (laws C1/C3/C5/C9), every rule at `error`. The action budgets are
    // types (`PageBarActions` / `SectionActions`, `controls/actions.tsx`).
    pluginRules: [
      'hand-rolled-filter',
      'control-outside-home',
      'bound-control-outside-home',
      'control-size-literal',
      'responsive-twin',
    ],
    // docs/CONTROLS-SPEC.md §6 "Honest coverage" — verbatim, because a generated header claiming
    // otherwise is D8 again.
    advisoryLaws: [
      'C1 as a cross-file law (a control placed in one file, its home declared in another)',
      'hand-rolled section headings (argo writes `<Text fw={600} size="sm">` + children, which no AST heuristic matches without false positives)',
      'C11 — a table/list stating its count when it is not a DataTable',
      'C12 — one shape for refresh/sync (RefreshButton); only the alias table sees a renamed copy',
    ],
    description:
      'The control tier (docs/v3/concepts/controls-url-state.md). Exports: `FilterSet` (a list of `spec(...)`s as one nowrap row of pills, a measured +N fold and the mobile Filters (n) sheet), `ViewTabs` bound to a control handle, `ControlView`, `ControlHome`, `filterSlot`, `spec`, and the v3 forms `FormField`/`FormRow`/`FormFooter`/`useFormDraft`/`toSubmitErrors`. The home picks the presentation (pill, row, inline), never a prop. Every control owns its own desktop/mobile swap in CSS and resolves with no Mantine installed.',
    optionalPeers: [],
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/controls/**'],
    },
    forbiddenImports: [],
  },

  // ── v3 skeleton (additive stubs; each row is filled by its owning v3 Issue) ──────────────────
  './router': {
    kind: 'tooling',
    layer: 'headless',
    description: 'v3 router bridge — nav, controls and search-state defaults on TanStack Router',
    globs: { shipped: [], repo: ['packages/basalt-ui/src/router/**'] },
    forbiddenImports: [],
  },
  './data': {
    kind: 'tooling',
    layer: 'headless',
    description:
      'v3 data layer — query client, unwrap, optimistic and live queries on TanStack Query',
    globs: { shipped: [], repo: ['packages/basalt-ui/src/data/**'] },
    forbiddenImports: [],
  },
  './page': {
    kind: 'tooling',
    layer: 'headless',
    description: 'v3 page composites — Page, PageBar, Section, QueryState, overlays',
    globs: { shipped: [], repo: ['packages/basalt-ui/src/page/**'] },
    forbiddenImports: [],
  },
  './cards': {
    kind: 'tooling',
    layer: 'headless',
    description: 'v3 card composites — StatCard, StatGroup, BarList, EventList',
    globs: { shipped: [], repo: ['packages/basalt-ui/src/cards/**'] },
    forbiddenImports: [],
  },
  './ai': {
    kind: 'tooling',
    layer: 'headless',
    description: 'v3 AI-chat part views — partView, defineBlock, defineCatalog',
    optionalPeers: ['react-markdown', 'remark-gfm', 'rehype-sanitize', 'remend'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/ai/**'] },
    forbiddenImports: [],
  },
  './ui/*': {
    kind: 'tooling',
    layer: 'headless',
    description: 'v3 primitives — one module per primitive on Base UI, wildcard entry',
    optionalPeers: ['@base-ui/react'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/ui/**'] },
    forbiddenImports: [],
  },
  './core/*': {
    kind: 'tooling',
    layer: 'headless',
    description:
      'v3 core modules (cn, format, messages, phase, ports) — the paths an ejected primitive imports; wildcard entry',
    globs: { shipped: [], repo: ['packages/basalt-ui/src/core/**'] },
    forbiddenImports: [],
  },
  './shell': {
    kind: 'tooling',
    layer: 'mantine-coupled',
    description:
      'App shell — AppShell, the CSS-grid frame: header, rail, one scrollport, aside and phone tab bar from one defineNav',
    forbiddenImports: [],
  },
  './lint': {
    kind: 'tooling',
    layer: 'build-tooling',
    description: 'v3 oxlint plugin — tooling, no app bundle',
    forbiddenImports: [],
  },
  './stylelint': {
    kind: 'tooling',
    layer: 'build-tooling',
    description: 'v3 stylelint preset — tooling, no app bundle',
    forbiddenImports: [],
  },
  './testing': {
    kind: 'tooling',
    layer: 'build-tooling',
    description: 'v3 test harness — renderApp, settled, quality; tooling, no app bundle',
    forbiddenImports: [],
  },
  './theme-script': {
    kind: 'tooling',
    layer: 'build-tooling',
    description: 'v3 pre-paint color-scheme script, frozen per major',
    forbiddenImports: [],
  },

  // ── Non-JS published assets (ToolingSpec; not JS subpaths — check-coverage exempts these) ─────
  './tokens.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description: 'v3 token layer — CSS custom properties, frozen per major',
    forbiddenImports: [],
  },
  './typography.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description: 'v3 type scale, frozen per major',
    forbiddenImports: [],
  },
  './prose.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description: 'v3 prose styles, frozen per major',
    forbiddenImports: [],
  },
  './fonts.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description: 'v3 font faces, frozen per major',
    forbiddenImports: [],
  },
  './table.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'v3 table tier sheet — plain CSS in @layer basalt.table (container-query tiers, card projection); an app that imports ./table imports it',
    forbiddenImports: [],
  },
  './tailwind.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description: 'v3 Tailwind 4 theme bridge, frozen per major',
    optionalPeers: ['tailwindcss'],
    forbiddenImports: [],
  },
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
      'Raw toolchain presets for consumer extends: oxlint.json (or the guards-only oxlint-basalt.json), oxfmt.json, tsconfig.*.json, lefthook.yml, check.yml',
    forbiddenImports: [],
  },

  // ── #-prefixed synthetic surfaces (advisory rules + global ban layer; NOT export keys) ────────
  '#app': {
    // synthetic global app-wide ban layer — the src/**+app/** glob
    kind: 'doctrine',
    layer: 'app-global',
    rule: 'batteries',
    skill: ['basalt-app'],
    // query-fn-unwrap: reassigned here from the now-dropped `./query` surface (C1 consolidation —
    // createBasaltQueryClient/unwrap/BasaltQueryDevtools are root barrel exports now, but their
    // doctrine stays `batteries` — "use the shipped thing" — not `mantine`). `query-dual-import`
    // was retired alongside it — its premise (a raw `@tanstack/react-query` import beside
    // `basalt-ui/query`) is unreachable now that the `./query` subpath is gone.
    pluginRules: ['query-fn-unwrap'],
    globs: {
      // Shipped is a catch-all (not just src/**+app/**) so consumer code under components/, lib/,
      // features/, etc. is also covered. The chart-engine and Mantine-free charts/tokens
      // boundaries used to live here too and need last-writer-wins EMIT_ORDER games against the
      // narrower ./tokens/./charts overrides — they're now enforced by `basalt/chart-engine-boundary` and
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
      v('antd', 'antd is not part of the basalt-ui stack; compose the shipped basalt-ui parts.', {
        shippedOnly: true,
      }),
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

// ── PROJECTION 1c — AGENT_NAMES ───────────────────────────────────────────────────────────────────

/** The shipped subagents (`agent/reviewer/<name>.md`), installed at `.claude/agents/`. */
export const AGENT_NAMES = ['basalt-design-reviewer'] as const

// ── Token-layer-boundary-via-plugin membership ────────────────────────────────────────────────────

/**
 * Headless SURFACES keys whose framework-free guarantee is enforced by the `basalt/token-layer-
 * boundary` oxlint plugin rule (`configs/oxlint-plugin.js`): the rule fires on `charts`/`tokens`
 * path segments only, so ONLY these two surfaces qualify.
 *
 * `basalt/token-layer-boundary` is registered ONLY in the repo-local `.oxlintrc.json`, never the
 * shipped consumer preset: it is a basalt-internal invariant (`./charts` and `./tokens` resolve and
 * render with no UI framework installed, real and CI-tested by `scripts/pack-test.sh` and
 * `scripts/check-dist-layering.mjs`), not a consumer contract. The "fails loudly if enforcement is
 * removed" guarantee lives in basalt's own CI (`tests/surfaces-coverage.test.ts`, via
 * `hasTokenLayerBoundaryRegistered` against `.oxlintrc.json`).
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
