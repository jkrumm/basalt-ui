/**
 * SURFACES registry — the one hard source for the enforcement seam.
 * Dependency-free.
 *
 * SURFACES: the discriminated doctrine|tooling registry for all basalt subpaths and advisory surfaces.
 * RULE_NAMES: derived projection — the deduped set of doctrine rule names (PROJECTION 1).
 */
// ── Scalar types ──────────────────────────────────────────────────────────────────────────────────

/** The 5 on-disk rule names (agent/rules/basalt-{name}.md); `tests/surfaces.test.ts` holds the set equal.
 *
 * One rule file per DOCTRINE, not per subpath: `state` owns the router bridge and the field handles,
 * `page` owns every part a page composes (frames, controls, tables, forms, content and AI), and `ui`
 * owns the import boundary and the primitives, the app-global ban layer included.
 *
 * @example
 * const r: RuleName = 'tokens' // ok
 * // const bad: RuleName = 'overlays' // tsc error — not in the union
 */
export type RuleName = 'tokens' | 'charts' | 'ui' | 'state' | 'page'

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
export type Layer = 'ui' | 'headless' | 'app-global' | 'non-js-asset' | 'build-tooling'

/**
 * A single import ban.
 *
 * @example
 * const ban: ForbiddenImport = { spec: 'antd', match: 'path', message: 'Compose the shipped parts.', shippedOnly: true }
 */
export type ForbiddenImport = {
  /** Exact module specifier ('antd') OR a glob group ('@visx/*'). */
  readonly spec: string
  /** 'path' → exact-name ban; 'group' → pattern ban. Mirrors oxlint paths vs patterns. */
  readonly match: 'path' | 'group'
  /** The finding's message. */
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
 * A doctrine surface owes the triad (rule + skill[]).
 * A bad rule/skill/kind name is a tsc error (literal-union).
 *
 * @example
 * const s: DoctrineSpec = { kind: 'doctrine', layer: 'headless', rule: 'tokens',
 *   skill: ['basalt-design'],
 *   forbiddenImports: [] }
 */
export type DoctrineSpec = BaseSurface & {
  readonly kind: 'doctrine'
  readonly rule: RuleName
  /** A LIST (skill↔surface is many-to-one — basalt-design covers tokens AND ui AND state). */
  readonly skill: readonly SkillName[]
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
 * - JS-subpath keys (., ./charts, ./tokens, ./controls, ./table, ./content, ./vite, ./router, ./data, ./form, ./page, ./cards, ./motion, ./ai, ./ui/*, ./core/*, ./shell, ./lint, ./stylelint, ./testing, ./theme-script, ./static, ./astro) — real package.json exports; `./core/*` stands for the explicit eject paths (`scripts/export-keys.ts`), and the CSS, Astro and config entries are the non-JS assets.
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
    layer: 'ui',
    rule: 'ui',
    skill: ['basalt-app', 'basalt-design'],
    // agent/rules/basalt-ui.md — stated, not guarded. This law has no AST form to catch, because
    // `cssVariablesResolver` is now `Omit`ted from the accepted prop type and a hand-built
    // `createTheme` is a consumer's own call to make. (`duplicate-notifications-mount`, the
    // other 1.28.0 mount-order rule, retired — `BasaltNotifications` no longer exists.)
    advisoryLaws: [
      "no second cssVariablesResolver — don't hand-build createTheme or re-add the resolver basalt already installs",
    ],
    description:
      'The app root and the state seams: `BasaltProvider`, `IntlScope`, `setScheme`, `setAppearance`, `persisted`, `notify`, `externalField`, `useNow`, `createFormat`, `useFormat`, and the port types every subpath names (`NavTarget`, `LinkComponent`, `IconComponent`, `FieldLike`, `DetailHost`, `DragLike`). Reaches no peer beyond react.',
    forbiddenImports: [], // the no-charts/tokens-reexport invariant is comment-only today; Phase-4 plugin
  },
  './charts': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'charts',
    skill: ['basalt-charts'],
    description:
      'CartesianChart (the TanStack Charts rung), the Lines, Bars, Sparkline, Heatmap, BandStrip and IntervalTrack kinds, ChartCard, the shared chartCursor and the geometry seam: useChartFocus (focus, dim the rest, one bound readout) and chartLabels (server-equal label width and placement) (no React UI library; @tanstack/charts + d3-scale peers)',
    optionalPeers: ['@tanstack/charts', 'd3-scale'],
    globs: {
      shipped: ['**/charts/**'],
      repo: ['packages/basalt-ui/src/charts/**'],
    },
    forbiddenImports: [],
    ruleOverrides: [{ rule: 'no-underscore-dangle', level: 'off', target: 'repo' }],
  },
  './tokens': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'tokens',
    skill: ['basalt-design', 'basalt-charts'],
    description:
      'BASALT token refs, buildPaletteCss, defineSeries, seriesTokens, groupTokens, alpha, the motion scale (MOTION_DURATION, MOTION_EASE_STANDARD, MOTION_EASE_ENTER, MOTION_EASE_EXIT, MOTION_SPRING, MOTION_STAGGER, staggerDelay)',
    globs: {
      shipped: ['**/tokens/**'],
      repo: ['packages/basalt-ui/src/tokens/**'],
    },
    // The UI-free layering is held on the built graph by `scripts/check-dist-layering.mjs`.
    forbiddenImports: [],
  },
  './vite': {
    kind: 'tooling',
    layer: 'build-tooling',
    description:
      'basalt(opts) — v3 plugin: peer and seed build gates, eject aliases, `.basalt/sources.css`, theme script, theme-color and manifest',
    optionalPeers: ['vite', 'vite-plugin-pwa'],
    forbiddenImports: [],
  },
  './table': {
    kind: 'doctrine',
    layer: 'ui',
    rule: 'page',
    skill: ['basalt-design'],
    description:
      '`DataTable` over `useDataTable`, the `col` kind columns, the parts `DataTable` composes (`TableToolbar`, `DataTableBody`, `TablePager`, `BulkBar`) and `tableCodec`, on TanStack Table v9 and `ui/*` primitives',
    optionalPeers: ['@tanstack/react-table', '@base-ui/react'],
    forbiddenImports: [],
  },
  './content': {
    kind: 'doctrine',
    layer: 'ui',
    rule: 'page',
    skill: ['basalt-design'],
    description:
      'Markdown (react-markdown + remark-gfm + rehype-sanitize + remend, all required peers, every import static so server, client and hydrate render the same tree; `contentTrust` is REQUIRED and independent of `streaming`, which is a rendering mode only — render agent or model output with `contentTrust="untrusted"`: no `<img>` (alt text; `images="same-origin"` admits relative srcs), links limited to same-origin, https:, mailto: and tel:, and no `sanitize` or `rehypePlugins`; `contentTrust="trusted"` takes `sanitize` ({ allowTags, allowAttrs } additions over a fixed policy that runs last) and `rehypePlugins`; a missing or unknown `contentTrust` renders as untrusted) — the content surface',
    optionalPeers: [
      '@base-ui/react',
      'shiki',
      '@shikijs/langs',
      '@shikijs/themes',
      'pele',
      'react-markdown',
      'remark-gfm',
      'rehype-sanitize',
      'remend',
    ],
    forbiddenImports: [],
  },
  './controls': {
    kind: 'doctrine',
    layer: 'ui',
    rule: 'page',
    skill: ['basalt-design'],
    // docs/CONTROLS-SPEC.md §6 "Honest coverage" — verbatim, because a generated header claiming
    // otherwise is D8 again.
    advisoryLaws: [
      'C1 as a cross-file law (a control placed in one file, its home declared in another)',
      'hand-rolled section headings (argo writes `<Text fw={600} size="sm">` + children, which no AST heuristic matches without false positives)',
      'C11 — a table/list stating its count when it is not a DataTable',
      'C12 — one shape for refresh/sync (RefreshButton); only the alias table sees a renamed copy',
    ],
    description:
      'The control tier (docs/v3/concepts/controls-url-state.md). Exports: `FilterSet` (a list of `spec(...)`s as one nowrap row of pills, a measured +N fold and the mobile Filters (n) sheet), `ViewTabs` bound to a control handle, `ControlView`, `ControlHome`, `filterSlot`, `spec`, and the v3 forms `FormField`/`FormRow`/`FormFooter`/`useFormDraft`/`toSubmitErrors`. The home picks the presentation (pill, row, inline), never a prop. Every control owns its own desktop/mobile swap in CSS and resolves with only its own peers.',
    optionalPeers: ['@base-ui/react'],
    globs: {
      shipped: [],
      repo: ['packages/basalt-ui/src/controls/**'],
    },
    forbiddenImports: [],
  },

  // ── v3 subpaths ──────────────────────────────────────────────────────────────────────────────
  './router': {
    kind: 'doctrine',
    layer: 'headless',
    rule: 'state',
    skill: ['basalt-app'],
    description:
      'v3 router bridge — defineNav, field handles, navTarget, routerDefaults and the re-exported BasaltProvider on TanStack Router',
    optionalPeers: ['@tanstack/react-router'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/router/**'] },
    forbiddenImports: [],
  },
  './data': {
    kind: 'tooling',
    layer: 'headless',
    description:
      'v3 data layer — query client, unwrap, optimistic and live queries on TanStack Query',
    optionalPeers: ['@tanstack/react-query'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/data/**'] },
    forbiddenImports: [],
  },
  './form': {
    kind: 'tooling',
    layer: 'ui',
    description:
      "basalt's form parts bound to TanStack Form through createFormHook: useAppForm (FormField on every AppField, Form and Footer inside AppForm, blur-then-change revalidation by default), withForm",
    optionalPeers: ['@base-ui/react', '@tanstack/react-form'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/form/**'] },
    forbiddenImports: [],
  },
  './page': {
    kind: 'doctrine',
    layer: 'ui',
    rule: 'page',
    skill: ['basalt-design'],
    description:
      'v3 page composites — Page, PageBar, PageAside, Section, SplitPage, InnerNav, QueryState, overlays, and the article parts (Prose, Callout, Toc, ArticleLayout)',
    optionalPeers: ['@base-ui/react'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/page/**'] },
    forbiddenImports: [],
  },
  './cards': {
    kind: 'tooling',
    layer: 'ui',
    description:
      'v3 card composites — StatCard, StatGroup, BarList, EventList, RowList, RelationshipCard, StepRail, ChainView, Board, FlowCanvas, FlowChecklist, useFlow',
    optionalPeers: ['@base-ui/react'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/cards/**'] },
    forbiddenImports: [],
  },
  './motion': {
    kind: 'tooling',
    layer: 'ui',
    description:
      'v3 motion presets — useMotionPreset and motionPreset (overlay, item, card) on motion/react, collapsed under reduced motion',
    optionalPeers: ['motion'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/motion/**'] },
    forbiddenImports: [],
  },
  './ai': {
    kind: 'tooling',
    layer: 'ui',
    description: 'v3 AI-chat part views — partView, defineBlock, defineCatalog',
    optionalPeers: [
      '@base-ui/react',
      'shiki',
      '@shikijs/langs',
      '@shikijs/themes',
      'pele',
      'react-markdown',
      'remark-gfm',
      'rehype-sanitize',
      'remend',
    ],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/ai/**'] },
    forbiddenImports: [],
  },
  './ui/*': {
    kind: 'tooling',
    layer: 'ui',
    description:
      'v3 primitives — one module per primitive on Base UI, wildcard entry; a guard, a test helper and the slot table do not resolve',
    optionalPeers: [
      '@base-ui/react',
      '@atlaskit/pragmatic-drag-and-drop',
      '@tanstack/react-virtual',
      'react-day-picker',
      'react-resizable-panels',
    ],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/ui/**'] },
    forbiddenImports: [],
  },
  './core/*': {
    kind: 'tooling',
    layer: 'ui',
    description:
      'The modules an ejected primitive imports (cn, format, messages, phase, ports, list, …), each listed in the exports map and held to the seeds by a test; every other core module is unpublished, and no public type lives here',
    globs: { shipped: [], repo: ['packages/basalt-ui/src/core/**'] },
    forbiddenImports: [],
  },
  './shell': {
    kind: 'tooling',
    layer: 'ui',
    description:
      'App shell — AppShell, the CSS-grid frame: header, rail, one scrollport, aside and phone tab bar from one defineNav; defineCommands chords run on TanStack Hotkeys',
    optionalPeers: [
      '@base-ui/react',
      '@tanstack/react-router',
      '@tanstack/react-hotkeys',
      '@atlaskit/pragmatic-drag-and-drop',
    ],
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
    optionalPeers: ['@axe-core/playwright'],
    forbiddenImports: [],
  },
  './theme-script': {
    kind: 'tooling',
    layer: 'build-tooling',
    description: 'v3 pre-paint color-scheme script, frozen per major',
    forbiddenImports: [],
  },
  './static': {
    kind: 'tooling',
    layer: 'ui',
    description:
      'Content-site parts that render to static HTML with no client JavaScript: no provider, context, hook or router, every label a prop (Prose, SiteArticle, SitePager, SiteCallout, SiteCodeBlock, SiteTabs, SiteTab, SiteForm, SiteField, SiteSubmit, SiteDataTable, SiteHeader (links and menus), SiteFooter, ThemeSwitch, siteMdxComponents) and the landing blocks (SiteHero, SiteBento, SiteFeature, SiteComparison, SiteQuestionList, SiteCallToAction); the site profile',
    optionalPeers: ['react'],
    globs: { shipped: [], repo: ['packages/basalt-ui/src/static/**'] },
    forbiddenImports: [],
  },
  './astro': {
    kind: 'tooling',
    layer: 'build-tooling',
    description:
      'basaltAstro() Astro integration — Tailwind 4, static.css on every page, the three faces through the Astro Fonts API and the head scripts; the site profile',
    optionalPeers: ['@astrojs/react', '@tailwindcss/vite', 'astro', 'tailwindcss'],
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
  './static.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'v3 site sheet — tailwind.css without the font faces, plus prose.css and the @source lines of the static parts; one import for a content site',
    optionalPeers: ['tailwindcss'],
    forbiddenImports: [],
  },
  './starlight.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      "v3 Starlight bridge — Starlight's --sl-* theme variables read from the --basalt-* tokens; list it in Starlight's customCss",
    forbiddenImports: [],
  },
  './astro/BasaltFonts.astro': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      "The head component for basalt's faces on Astro: the body face preloaded; needs basaltAstro() from ./astro",
    forbiddenImports: [],
  },
  './astro/mdx/Chart.astro': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'The Chart MDX tag for Astro: a lines or bars chart card from plain data, hydrated by `load` (client:only by default); the site profile',
    optionalPeers: ['@tanstack/charts', 'd3-scale'],
    forbiddenImports: [],
  },
  './astro/mdx/DataTable.astro': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'The DataTable MDX tag for Astro: a static table from plain data, or a sortable DataTable island with `interactive`; the site profile',
    optionalPeers: ['@tanstack/react-table', '@base-ui/react'],
    forbiddenImports: [],
  },
  './fonts.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description: 'v3 font faces, frozen per major',
    forbiddenImports: [],
  },
  './archify.css': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      "v3 archify diagram theme — one [data-preset='basalt'] block mapping archify's variables to the --basalt-* tokens; opt-in, needs tokens.css",
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
      'Mandatory CSS import — @layer basalt base styles, iOS input safety net, font stack',
    forbiddenImports: [],
  },
  './configs/*': {
    kind: 'tooling',
    layer: 'non-js-asset',
    description:
      'Raw toolchain presets for consumer extends: oxlint-{app,parts,bridge}.json, oxfmt.json, tsconfig.*.json, lefthook.yml, check.yml',
    forbiddenImports: [],
  },

  // ── #-prefixed synthetic surfaces (advisory rules + global ban layer; NOT export keys) ────────
  '#app': {
    // synthetic global app-wide ban layer — the src/**+app/** glob
    kind: 'doctrine',
    layer: 'app-global',
    rule: 'ui',
    skill: ['basalt-app'],
    globs: {
      shipped: ['**/*.{ts,tsx}'],
      // Repo is packages/basalt-ui/src/** ONLY: apps/playground lints through its own nested
      // `.oxlintrc.json` (the v3 app preset), which oxlint resolves instead of this config.
      repo: ['packages/basalt-ui/src/**'],
    },
    ruleOverrides: [{ rule: 'no-console', level: 'off', target: 'repo' }], // cli/bin/scripts, repo-local only
    forbiddenImports: [
      v('antd', 'antd is not part of the basalt-ui stack; compose the shipped basalt-ui parts.', {
        shippedOnly: true,
      }),
      v('framer-motion', "Import from 'motion/react', not the raw framer-motion package."),
      // The chart engine boundary inside basalt's own source: charts draw through the engine's
      // subpaths, and its DOM host (`@tanstack/charts/react`) is imported by `charts/host.tsx` alone
      // (the generator lifts the second ban for that one file: `CHART_HOST_FILE`).
      {
        spec: '@visx/*',
        match: 'group',
        message: '@visx/* is not part of basalt-ui; draw charts through the engine subpaths.',
      },
      v(
        '@tanstack/charts/react',
        'Only src/charts/host.tsx imports the engine host; render charts through it.',
        { repoOnly: true },
      ),
      {
        spec: '@tanstack/charts/react/*',
        match: 'group',
        message: 'Only src/charts/host.tsx imports the engine host; render charts through it.',
        repoOnly: true,
      },
    ],
  },
} as const satisfies Record<string, SurfaceSpec>

// ── PROJECTION 1 — RULE_NAMES ─────────────────────────────────────────────────────────────────────

/**
 * Derived, deduped set of doctrine rule names. Projection 1 of SURFACES.
 * → ['ui', 'charts', 'tokens', 'page', 'state'] (order is insertion order of Set)
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
