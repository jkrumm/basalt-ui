/**
 * The consolidation plan's numeric ceilings (`.claude/maturation/consolidation-plan.md`, "Budgets
 * are numbers"), enforced as one gate rather than seven scattered opinions: public symbols, published
 * subpaths, shipped rule lines, spec prose, playground routes, the CLI's own line count, and the
 * provider-only first-paint bytes.
 *
 * Every number is printed with its budget, in the order above, before any exit — so a failing run
 * (or `--report`) always shows the full picture rather than stopping at the first breach. The
 * default exits 1 on any breach and is the gate: root `pre` runs it as `bun run check-budgets`, so
 * it must pass. `--report` prints the same table and exits 0 unconditionally, for watching progress
 * without gating. The ceilings are LANDED values, each with its 2.0 TARGET beside it (`TARGETS` /
 * `CEILINGS` below); a wave that closes the gap lowers its ceiling to the target in the same commit.
 *
 * Usage: bun packages/basalt-ui/scripts/check-budgets.ts [--report]
 *
 * Importable without running: `runBudgets` and `isOwnGraphId` are the tested seam
 * (`check-budgets.test.ts`); the CLI half runs only under `import.meta.main`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

import {
  CHART_SUBPATH,
  consumerViolations,
  duplicateSymbols,
  peerClassViolations,
} from './surface-gates'
import type { Manifest, Surface } from './surface-gates'

const PKG_ROOT = join(import.meta.dir, '..')
const REPO_ROOT = join(PKG_ROOT, '..', '..')

/**
 * The docs/V2-SPEC.md § 1 budget table in one block: `TARGETS` are the spec's 2.0 numbers,
 * `CEILINGS` what the gate enforces today. They differ only where a wave owns the deferral, and that
 * wave deletes its override (so the ceiling falls to the target) in the commit that lands the work.
 */
const TARGETS = {
  /** Non-chart value symbols; 140 total = 92 + § 9's chart allowance. */
  nonChartSymbols: 92,
  chartSymbols: 48,
  barrelTypes: 60,
  subpaths: 15,
  ruleLines: 450,
} as const
const CEILINGS = {
  ...TARGETS,
  chartSymbols: 14, // landed (W5): the rung, nine kinds, `ChartCard`, `chartCursor`, `chartCurve` (argo friction row 27); +`foldBands` (linewatch band/throughput strip tests, ledger row 80)
  nonChartSymbols: 108, // W37: `PageSummary` (argo components/upstream/page-summary.tsx, SPEC § 6.9; UPSTREAM Waves 24-26); 2.19 (W35): `StatusDot`, `StatusVerdict` (argo warden/agents status chips; status is a dot plus a word, D28); 2.18 (W34): `Meter` (argo reading card, warden dispatch budget, usage cache hit; rb course + ingest; linewatch link vs ceiling; ledger rows 143–145, 152, 158), `BarList` (argo top projects, weatherorb factor bars; rows 146, 160); 2.14: `date`/`time`/`dateTime`/`duration` (rb + linewatch format.ts, argo walking-pad; consumer-05); `bytes`/`compact`/`delta`/`defineFormat` (linewatch + rb format.ts, argo sparkline; maturation-v2 consumer-05); 2.13: `basaltRouterOptions` (weatherorb `getRouter()`, maturation-v2 provider-01); 2.6: `externalField` (argo timer-card.tsx, row 39); was 93 for `toAgentError` (row 18)
  barrelTypes: 70, // W37: `PageSummaryProps`; 2.19 (W35): `MeterSegment`, `MeterZone`, `MeterTick` (argo types its zone/segment helpers off them, UPSTREAM § basalt friction); 2.19 (W35): `StatusDotProps`, `StatusVerdictProps` (the two status primitives); `StatStripCell`, `StatStripRow` (argo strip prototypes: garmin-health, agents, warden stat-strip.tsx; rows 147, 156); 2.18 (W34): `MeterProps`, `BarListProps` (the two W34 primitives; segment/item shapes stay inline)
  ruleLines: 272, // landed (W9): the shipped rules, 450 is the spec target; -5 (W31): +1 (ViewTabs law), -6 (one `paths:` glob per rule)
} as const

type Budget = {
  readonly label: string
  /** `null` = could not be measured here (only ever tolerated under `--report`). */
  readonly value: number | null
  readonly ceiling: number
  /**
   * Why `value` is `null`, printed in place of the number: `skipped` when an input is absent
   * (no `dist/`), `failed` when measuring it threw (a bundler error).
   */
  readonly unmeasured?: { readonly kind: 'skipped' | 'failed'; readonly reason: string }
  /** Violation lines printed under the row (the gate-style rows, whose `value` is their count). */
  readonly detail?: readonly string[]
}

/** Every regular file under `dir` whose name matches `pattern`, recursing into subdirectories. */
function walkFiles(dir: string, pattern: RegExp): string[] {
  const glob = new Bun.Glob('**/*')
  const out: string[] = []
  for (const rel of glob.scanSync({ cwd: dir, onlyFiles: true })) {
    if (pattern.test(rel)) out.push(join(dir, rel))
  }
  return out
}

function lineCount(path: string): number {
  const text = readFileSync(path, 'utf8')
  return text.length === 0 ? 0 : text.split('\n').length
}

function totalLines(paths: readonly string[]): number {
  return paths.reduce((sum, path) => sum + lineCount(path), 0)
}

// ── 1. Public symbols (scripts/export-surface.json) ───────────────────────────────────────────

function readSurface(): Surface {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'scripts/export-surface.json'), 'utf8')) as Surface
}

/** Value exports of every subpath except `./charts`, which is budgeted apart. */
function nonChartSymbols(surface: Surface): number {
  return Object.entries(surface)
    .filter(([subpath]) => subpath !== CHART_SUBPATH)
    .reduce((sum, [, names]) => sum + names.length, 0)
}

// ── 2. Published subpaths (package.json exports) ───────────────────────────────────────────────

function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as Manifest
}

function publishedSubpaths(manifest: Manifest): number {
  return Object.keys(manifest.exports ?? {}).length
}

/**
 * Non-chart barrel type exports: names in `export type { … }` / `export { type X }` clauses of each
 * non-chart subpath's source entry. Counted from source so it needs no build; `null` when an entry
 * is missing (a half-moved tree cannot vouch for the number).
 */
function barrelTypeExports(manifest: Manifest): { value: number | null; reason?: string } {
  let total = 0
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const js = typeof target === 'object' && target !== null ? target.import : undefined
    if (js === undefined || subpath === CHART_SUBPATH) continue
    const base = join(PKG_ROOT, 'src', js.replace(/^\.\/dist\//, '').replace(/\.js$/, ''))
    const entry = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(existsSync)
    if (entry === undefined) return { value: null, reason: `no source entry for ${subpath}` }
    const source = readFileSync(entry, 'utf8')
    for (const m of source.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
      total += (m[1] ?? '').split(',').filter((name) => name.trim() !== '').length
    }
    for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
      total += (m[1] ?? '').split(',').filter((name) => /^\s*type\s/.test(name)).length
    }
  }
  return { value: total }
}

// ── 3. Shipped rule lines (agent/rules/*.md) ────────────────────────────────────────────────────

function agentRuleLines(): number {
  const dir = join(PKG_ROOT, 'agent/rules')
  return totalLines(walkFiles(dir, /\.md$/))
}

// ── 4. Spec prose (docs/*.md, non-archive, excluding the ledger) ───────────────────────────────

/**
 * The APPEND-ONLY files under `docs/`, excluded from the prose budget because they are records
 * rather than doctrine.
 *
 * `MATURATION-LEDGER.md` is the only entry, and excluding it is a correction, not a concession:
 * the budget's job is to bound how much DOCTRINE the repo asks a reader to hold, and a ledger row
 * is the opposite of that — it is a finding, its evidence and its verdict, written down so the next
 * wave does not re-derive it. Counting it meant every wave that recorded its own outcome pushed the
 * SPECS closer to a ceiling they had not moved toward, and the only ways to stay green were to
 * delete history or raise the number. The 2026-09-09 chrome wave hit exactly that: +21 ledger lines
 * put a 2647/2650 budget at 2668 while no spec had grown at all.
 *
 * The ceiling below was lowered by the ledger's size at the moment of the split, so the remaining
 * specs are held to the same real bound they were before — the gate did not get looser.
 */
const APPEND_ONLY_DOCS = new Set(['MATURATION-LEDGER.md'])

function docsProseLines(): number {
  const glob = new Bun.Glob('*.md')
  const paths = [...glob.scanSync({ cwd: join(REPO_ROOT, 'docs'), onlyFiles: true })]
    .filter((rel) => !APPEND_ONLY_DOCS.has(rel))
    .map((rel) => join(REPO_ROOT, 'docs', rel))
  return totalLines(paths)
}

// ── 5. Playground route files (apps/playground/src/routes/**) ──────────────────────────────────

function playgroundRouteFiles(): number {
  const dir = join(REPO_ROOT, 'apps/playground/src/routes')
  return walkFiles(dir, /\.tsx?$/).length
}

// ── 6. CLI non-test lines (src/cli/**) ──────────────────────────────────────────────────────────

function cliNonTestLines(): number {
  const dir = join(PKG_ROOT, 'src/cli')
  const paths = walkFiles(dir, /\.tsx?$/).filter((path) => !/\.test\.tsx?$/.test(path))
  return totalLines(paths)
}

// ── 7. Provider-only first paint (scripts/fixtures/provider-only.ts, gzip) ─────────────────────

/**
 * Gzip bytes of basalt's OWN code in an app that imports only `BasaltProvider` + `createBasaltTheme`
 * — the floor every consumer pays on first paint. weatherorb's `/map` bar broke when 1.30.2 → 1.32.1
 * grew it ~1 KB unnoticed (the theme lab's store rode into production behind an unfoldable
 * `isDev()` gate); this is the number that would have said so.
 *
 * Bundled by the SAME bundler consumers run (Vite, i.e. Rolldown), in production mode, against the
 * BUILT `dist` — esbuild without code splitting inlines `dev-dock`'s lazy `import('./theme-lab')` and
 * wraps shared modules in lazy-init closures that defeat tree-shaking, so it over-reports. Peers are
 * external (not basalt's bytes); CSS is excluded; the count is the entry chunk plus every chunk it
 * statically imports — what loads before first paint, not what loads later.
 */
const PROVIDER_ONLY_DIST = join(PKG_ROOT, 'dist/index.js')

/**
 * Whether a module id belongs to basalt's own graph rather than a peer: relative or absolute paths
 * (POSIX, or a Windows drive letter / UNC path once `\` is normalized to `/`) and Vite's `\u0000`
 * virtual ids. Everything else is a bare specifier, i.e. a peer, and stays external.
 */
export function isOwnGraphId(id: string): boolean {
  const normalized = id.replaceAll('\\', '/')
  return /^(?:\.{1,2}\/|\/|[A-Za-z]:\/)/.test(normalized) || id.startsWith('\u0000')
}

/**
 * Dev-only surface, matched on `/`-normalized path segments: the dock and the theme lab (a file or
 * directory, optionally hashed — `dev-dock-AbC123.js`) and any `*-devtools` package. A bare
 * `devtools-utils.js` or `xdevtools-helper.js` is not dev-only. Narrower than the oxlint plugin's
 * specifier regex on purpose: that one reads import specifiers, this one also reads emitted names.
 */
const DEV_ONLY =
  /(?:^|\/)(?:(?:dev-dock|theme-lab)(?:-[\w-]+)?(?:\.[cm]?[jt]sx?|\/)|[^/]*-devtools(?:\/|$))/

type BundleChunk = {
  fileName: string
  code: string
  isEntry: boolean
  moduleIds: readonly string[]
  imports: readonly string[]
  dynamicImports: readonly string[]
}

/**
 * Every emitted chunk, loaded or not, whose name, modules or imports reach dev-only code. A
 * production build must emit none: a module-scope `lazy(() => import('../dev-dock'))` keeps the
 * chunk graph alive even when its JSX use is dev-gated, and the PWA service worker then precaches
 * it (obsidian: 34 KB, never requested). Exported for the unit test.
 */
export function devOnlyChunks(
  chunks: readonly Pick<BundleChunk, 'fileName' | 'moduleIds' | 'imports' | 'dynamicImports'>[],
): string[] {
  return chunks
    .filter((c) =>
      [c.fileName, ...c.moduleIds, ...c.imports, ...c.dynamicImports].some((id) =>
        DEV_ONLY.test(id.replaceAll('\\', '/')),
      ),
    )
    .map((c) => c.fileName)
}

/**
 * Feature runtimes a define-free provider must not ship — Spotlight, modals and hotkeys enter the
 * graph only through `defineNav` / `defineCommands` / `defineOverlays`. Matched on a module id's
 * `node_modules/<pkg>/` segment (any package-manager layout), so a chunk is flagged by what it
 * contains, not by its name. Exported for the unit test.
 */
const FEATURE_RUNTIME =
  /(?:^|\/)node_modules\/(?:@mantine\/(?:spotlight|modals)|@tanstack\/(?:react-)?hotkeys)\//

export function featureRuntimeChunks(
  chunks: readonly Pick<BundleChunk, 'fileName' | 'moduleIds'>[],
): string[] {
  return chunks
    .filter((c) => c.moduleIds.some((id) => FEATURE_RUNTIME.test(id.replaceAll('\\', '/'))))
    .map((c) => c.fileName)
}

/** Gzip bytes of every emitted chunk, dynamic ones included — a bundle-graph bar follows `import()`. */
function allChunksGzip(chunks: ReadonlyMap<string, BundleChunk>): number {
  let bytes = 0
  for (const chunk of chunks.values()) bytes += gzipSync(chunk.code).length
  return bytes
}

/** Gzip bytes of the entry chunk plus every chunk it statically imports (the first-paint set). */
function firstPaintGzip(chunks: ReadonlyMap<string, BundleChunk>, entry: BundleChunk): number {
  const loaded = new Set<string>()
  let bytes = 0
  const visit = (name: string): void => {
    const chunk = chunks.get(name)
    if (chunk === undefined || loaded.has(name)) return
    loaded.add(name)
    bytes += gzipSync(chunk.code).length
    chunk.imports.forEach(visit)
  }
  visit(entry.fileName)
  return bytes
}

/**
 * Peer-bundled builds (the embedded fixture) keep only the React runtime external, so the peers'
 * own bytes and chunks are counted the way a consumer's bundle-graph bar counts them.
 */
const REACT_RUNTIME = /^react(?:-dom)?(?:\/|$)/

type BundleOpts = { fixture: string; bundlePeers: boolean }

/** The production bundle of a fixture: every emitted chunk and its entry. */
async function buildProviderOnlyBundle(
  distEntry: string,
  { fixture, bundlePeers }: BundleOpts = { fixture: 'provider-only.ts', bundlePeers: false },
): Promise<{ chunks: Map<string, BundleChunk>; entry: BundleChunk }> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PKG_ROOT,
    define: { 'process.env.NODE_ENV': '"production"' },
    resolve: {
      alias: [
        { find: /^basalt-ui$/, replacement: distEntry },
        {
          find: /^basalt-ui\/commands$/,
          replacement: join(dirname(distEntry), 'commands/index.js'),
        },
      ],
    },
    build: {
      write: false,
      minify: true,
      lib: { entry: join(PKG_ROOT, 'scripts/fixtures', fixture), formats: ['es'] },
      rolldownOptions: {
        external: (id) =>
          bundlePeers ? REACT_RUNTIME.test(id) : id !== 'basalt-ui' && !isOwnGraphId(id),
      },
    },
  })
  // `build()` also types a watcher return (`build.watch`), which has no `output`; narrow it away.
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) {
    throw new Error('check-budgets: provider-only fixture build returned no output')
  }
  const chunks = new Map(
    bundle.output.flatMap((o) => (o.type === 'chunk' ? [[o.fileName, o] as const] : [])),
  )
  const entry = [...chunks.values()].find((c) => c.isEntry)
  if (entry === undefined) throw new Error('check-budgets: provider-only fixture emitted no entry')
  return { chunks, entry }
}

const PROVIDER_ONLY_LABEL = 'provider-only first paint (gzip B, dist)'
// Landed 18706 locally / 18722 in CI (1.33.0: lab store + every isDev()/DEV-const gate folded;
// 1.30.2 19393, 1.32.1 20379). The ~1% margin absorbs the zlib/runtime difference between machines
// (16 B measured) — it is a regression gate for KB-scale growth, not a byte-exact snapshot. Raise it
// deliberately, in the commit that spends it, never to make a red gate green.
// 18900 → 19000: the AA anchor/error vars and the badge/outline ink mix in the resolver (18904 locally).
// 19000 → 20800: `BasaltProvider` now wires the whole tree (router, query, modals, telemetry, hotkeys,
// Spotlight actions, § 2); 20655 landed. Peers stay external, so these are basalt's own bytes.
// 20800 → 20880: #255 (embedded-children provider mode, `spotlight={false}`, `useRouter` import) added
// ~140 B (20796 locally, 20830 in CI). No honest saving: the new error strings must name both modes
// (tested) and Spotlight is statically mounted by default, so lazying it would change first paint.
// 20880 → 20340: the dock's lazy import() is dead code in production (20136 locally, was 20796);
// ~1% over local clears CI's measured +34 B with room.
// 20340 → 19940: the 32 camelCase `--vx-*` aliases leave the injected CSS (19744 locally, was 20136).
// 19940 → 19000: Spotlight and modals leave the entry (provider slots): 18810 locally, was 19755.
// 19000 → 19200: the provider owns the `route.error` emit now (it was in `createBasaltRouter`, outside
// this entry) plus the mutation-key hash: 19034 locally, was 18923.
// 19200 → 19202 (W33 CI): the light Badge default, ink Tabs underline and the badge glyph rule in the theme + palette CSS.
// 19202 → 19281 (W33 CI, review round): the subtle ink label/hover moved from the resolver into Button/ActionIcon `vars`, plus `tabsVars`.
// 19281 → 19305 (W33 CI, chrome-vars move): +24 B.
// 19305 → 19308 (W33 CI, all five W33 PRs merged): +3 B.
// 19308 → 19473 (2.18): +165 B, status text derived per surface — contrastRatio + bounded tone walk in derive (a no-op at the default config).
// 19473 → 19577 (2.18, review round): +104 B, the lightLevel/darkLevel RangeError and the exhaustive text-surface record.
// 19577 → 19607 (2.18, CI Linux measurement): +30 B over the macOS build.
// 19607 → 19599 (2.18, review round 2, CI Linux measurement): −8 B, the solver moved to its own module.
// 19599 → 19732 (2.18, light/outline Button+ActionIcon ink vars, CI Linux measurement): +133 B.
// 19732 → 19782 (W35, the theme owns the card inset, CI Linux measurement): +50 B.
// 19782 → 19921 (W35, on-scale Button padding and the neutral error state, CI Linux measurement): +139 B.
// 19921 → 20012 (W36, Button section inset vars, CI Linux measurement): +91 B.
const PROVIDER_ONLY_CEILING = 20012
// Embedded `<BasaltProvider spotlight={false}>`, no defines, peers bundled, every chunk counted: 54735 B landed, ~1% margin.
// 55300 → 55391 (W32): +91 B for the Wave 32 scales — the dense control tier rule in the palette CSS, the row line-height and `lineHeights` ratios, the expanded gutter, and the card/radius/type retunes.
// 55391 → 55404 (W32 CI): the gate is CI's Linux build, which gzips 13 B larger than the macOS build the lead measured.
// 55404 → 55482 (W33 CI): +78 B, the same Badge/Tabs/subtle-Button chrome changes.
// 55482 → 55569 (W33 CI, review round): +87 B, the same move.
// 55569 → 55599 (W33 CI, chrome-vars move): +30 B.
// 55599 → 55601 (W33 CI, all five W33 PRs merged): +2 B.
// 55601 → 55776 (2.18): +175 B, the same status-text derivation (walk is a no-op at the default config).
// 55776 → 55859 (2.18, review round): +83 B, the same move.
// 55859 → 55878 (2.18, CI Linux measurement): +19 B over the macOS build.
// 55878 → 55902 (2.18, review round 2, CI Linux measurement): +24 B, the level clamp and the solver extraction.
// 55902 → 56033 (2.18, light/outline Button+ActionIcon ink vars, CI Linux measurement): +131 B.
// 56033 → 56097 (W35, the theme owns the card inset, CI Linux measurement): +64 B.
// 56097 → 56238 (W35, on-scale Button padding and the neutral error state, CI Linux measurement): +141 B.
// 56238 → 56319 (W36, Button section inset vars, CI Linux measurement): +81 B.
const EMBEDDED_CEILING = 56319
// `createBasaltTheme()` alone, peers bundled, every chunk counted: 14420 locally. The theme reaching
// no component it configures is what keeps this near Mantine's core; ~1% over landed.
// 14570 → 14571 (W32): +1 B, the `lineHeights` ratios.
// 14571 → 14580 (W32 CI): the same Linux-vs-macOS gzip difference, 9 B. Raise gzip ceilings from CI's numbers.
// 14580 → 14653 (W33 CI): +73 B, the same chrome changes.
// 14653 → 14719 (W33 CI, review round): +66 B, the same move.
// 14719 → 14768 (W33 CI, chrome-vars move): +49 B.
// 14768 → 14771 (W33 CI, all five W33 PRs merged): +3 B.
// 14771 → 14953 (2.18): +182 B, the same status-text derivation (walk is a no-op at the default config).
// 14953 → 15036 (2.18, review round): +83 B, the same move.
// 15036 → 15047 (2.18, CI Linux measurement): +11 B over the macOS build.
// 15047 → 15057 (2.18, review round 2, CI Linux measurement): +10 B, the same move.
// 15057 → 15183 (2.18, light/outline Button+ActionIcon ink vars, CI Linux measurement): +126 B.
// 15183 → 15235 (W35, the theme owns the card inset, CI Linux measurement): +52 B.
// 15235 → 15374 (W35, on-scale Button padding and the neutral error state, CI Linux measurement): +139 B.
// 15374 → 15451 (W36, Button section inset vars, CI Linux measurement): +77 B.
const THEME_ONLY_CEILING = 15451
const THEME_ONLY_LABEL = 'createBasaltTheme only, peers bundled, all chunks (gzip B, dist)'
const EMBEDDED_LABEL = 'embedded provider, no defines, peers bundled, all chunks (gzip B, dist)'
const FEATURE_CHUNKS_LABEL =
  'spotlight/modals/hotkeys modules in a define-free provider build (+ ShortcutsHelp)'
const DEV_CHUNKS_LABEL =
  'dev-only chunks in a production consumer build (dock, theme lab, devtools)'

/** An ANSI color sequence. Built from a char code: a control char in a regex literal is banned. */
const ANSI_SGR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

/**
 * One readable line for an error, ANSI stripped. A Rolldown failure is a multi-line colored frame
 * whose first line is only a header (`Build failed with 1 error:`), so a header ending in `:` takes
 * the next line too (`[PARSE_ERROR] Unexpected token`).
 */
function summarizeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const lines = text
    .replaceAll(ANSI_SGR, '')
    .split('\n')
    .map((l) => l.trim())
  const [head, next] = lines.filter((line) => line !== '')
  if (head === undefined) return 'unknown error'
  return head.endsWith(':') && next !== undefined ? `${head} ${next}` : head
}

/**
 * The provider-only row, never a throw: a missing `dist/` is `skipped`, a bundler failure is
 * `failed` with its first line — both print in order after the other budgets and both fail the
 * gate (an unmeasured number cannot vouch for the ceiling).
 */
async function providerOnlyRows(distEntry: string): Promise<Budget[]> {
  const sizeRow = { label: PROVIDER_ONLY_LABEL, ceiling: PROVIDER_ONLY_CEILING }
  const devRow = { label: DEV_CHUNKS_LABEL, ceiling: 0 }
  const embeddedRow = { label: EMBEDDED_LABEL, ceiling: EMBEDDED_CEILING }
  const featureRow = { label: FEATURE_CHUNKS_LABEL, ceiling: 0 }
  const unmeasured = (
    rows: readonly Budget[],
    kind: 'skipped' | 'failed',
    reason: string,
  ): Budget[] => rows.map((row) => ({ ...row, value: null, unmeasured: { kind, reason } }))
  const baseRows: Budget[] = [sizeRow, devRow]
  const themeOnlyRow = { label: THEME_ONLY_LABEL, ceiling: THEME_ONLY_CEILING }
  const embeddedRows: Budget[] = [embeddedRow, themeOnlyRow, featureRow]
  if (!existsSync(distEntry)) {
    return unmeasured(
      [...baseRows, ...embeddedRows],
      'skipped',
      'dist/ missing, run `bun run build`',
    )
  }
  // Two tries: a failure building the peer-bundled fixtures must not mark the older rows failed.
  const base = await (async (): Promise<Budget[]> => {
    try {
      const { chunks, entry } = await buildProviderOnlyBundle(distEntry)
      return [
        { ...sizeRow, value: firstPaintGzip(chunks, entry) },
        gateRow(DEV_CHUNKS_LABEL, devOnlyChunks([...chunks.values()])),
      ]
    } catch (error) {
      return unmeasured(baseRows, 'failed', summarizeError(error))
    }
  })()
  const embeddedResult = await (async (): Promise<Budget[]> => {
    try {
      const embedded = await buildProviderOnlyBundle(distEntry, {
        fixture: 'provider-embedded.tsx',
        bundlePeers: true,
      })
      // `ShortcutsHelp` is the `./commands` export a define-free app can read; gate it with the same zero row.
      const shortcuts = await buildProviderOnlyBundle(distEntry, {
        fixture: 'provider-shortcuts-help.tsx',
        bundlePeers: true,
      })
      const themeOnly = await buildProviderOnlyBundle(distEntry, {
        fixture: 'provider-theme-only.tsx',
        bundlePeers: true,
      })
      return [
        { ...embeddedRow, value: allChunksGzip(embedded.chunks) },
        { ...themeOnlyRow, value: allChunksGzip(themeOnly.chunks) },
        gateRow(FEATURE_CHUNKS_LABEL, [
          ...featureRuntimeChunks([...embedded.chunks.values()]),
          ...featureRuntimeChunks([...shortcuts.chunks.values()]).map(
            (name) => `shortcuts-help: ${name}`,
          ),
        ]),
      ]
    } catch (error) {
      return unmeasured(embeddedRows, 'failed', summarizeError(error))
    }
  })()
  return [...base, ...embeddedResult]
}

/** A gate-shaped row: `value` is the violation count, the ceiling is zero. */
function gateRow(label: string, violations: readonly string[]): Budget {
  return { label, value: violations.length, ceiling: 0, detail: violations }
}

/** The peer-class row needs the built dist: absent dist is `skipped`, which fails closed. */
function peerClassRow(manifest: Manifest): Budget {
  const label = 'peer classes (dist graph + .d.ts vs package.json)'
  if (!existsSync(join(PKG_ROOT, 'dist/index.js'))) {
    return {
      label,
      value: null,
      ceiling: 0,
      unmeasured: { kind: 'skipped', reason: 'dist/ missing, run `bun run build`' },
    }
  }
  return gateRow(label, peerClassViolations(PKG_ROOT, manifest))
}

async function budgets(providerOnlyDist: string): Promise<Budget[]> {
  const surface = readSurface()
  const manifest = readManifest()
  const types = barrelTypeExports(manifest)
  const consumers = JSON.parse(
    readFileSync(join(PKG_ROOT, 'scripts/consumers.json'), 'utf8'),
  ) as Record<string, string>
  return [
    // docs/V2-SPEC.md § 1: 140 public value symbols = 92 non-chart + § 9's chart allowance of 48.
    {
      label: 'public value symbols, non-chart (export-surface.json)',
      value: nonChartSymbols(surface),
      ceiling: CEILINGS.nonChartSymbols,
    },
    {
      label: 'public value symbols, ./charts (export-surface.json)',
      value: surface[CHART_SUBPATH]?.length ?? 0,
      ceiling: CEILINGS.chartSymbols,
    },
    {
      label: 'barrel type exports, non-chart (src entries)',
      value: types.value,
      ceiling: CEILINGS.barrelTypes,
      ...(types.reason === undefined
        ? {}
        : { unmeasured: { kind: 'skipped' as const, reason: types.reason } }),
    },
    {
      label: 'published subpaths (package.json exports)',
      value: publishedSubpaths(manifest),
      ceiling: CEILINGS.subpaths,
    },
    {
      label: 'shipped rule lines (agent/rules/*.md)',
      value: agentRuleLines(),
      ceiling: CEILINGS.ruleLines,
    },
    gateRow(
      'symbols under more than one subpath (one import path per symbol)',
      duplicateSymbols(surface),
    ),
    gateRow(
      'public symbols without a named consumer (scripts/consumers.json)',
      consumerViolations(surface, consumers),
    ),
    peerClassRow(manifest),
    // 2480 -> 3166 (W1, V2-SPEC landed beside the live 1.x specs) -> 2663 (W4 archived CHARTS-SPEC) -> 2650 (W5 folded the kind law into the code) -> 2432 (W11 archived the argo learnings, closed STATUS).
    // Each wave that archives a 1.x spec lowers it by that spec's lines; a wave that must grow the
    // spec raises it deliberately, in the commit that spends the lines.
    { label: 'spec prose (docs/*.md, non-archive)', value: docsProseLines(), ceiling: 2432 },
    {
      label: 'playground route files (apps/playground/src/routes/**)',
      value: playgroundRouteFiles(),
      ceiling: 15,
    },
    // 4000 -> 4250: the AGENTS.md block move + the doctor checks (the CLAUDE.md migration was removed in 2.0).
    // 4250 -> 4350: doctor's `exact-peers` and `config-keys` (argo friction rows 1-3).
    // 4350 -> 4450: `resolveAppDir` + the app-dir seeds/doctor check (argo friction rows 4-5).
    // 4450 -> 4525: the import-graph `app-wiring` follow + the Makefile-aware CI gate (argo friction rows 11-12).
    // 4525 -> 4589: doctor's `oxlint-floor` and the CSS + dropped-list scan in `dropped-subpaths` (argo friction rows 61, 63, 66).
    // 4589 -> 4628: the Start-app seed skip in `init`/`sync` and doctor's Start `app-wiring` (argo friction rows 62, 67).
    // 4628 -> 4674: Start `app-wiring` rejects a `router=` provider, plus the `queryClient` heuristic warning (rows 62, 67).
    // 4674 -> 4710: any-tag `router=` + spread detection in Start `app-wiring`, and `sync`'s stale-seed warning (rows 62, 67).
    // 4710 -> 4726: literal-aware provider tags, sticky spread match, and the split stale-seed warning (rows 62, 67).
    // 4726 -> 4859: #261's `router-wiring` module and `source-text` helper (rows 71, 72, 74) — comments restored rather than condensed.
    // 4859 -> 4890: `installRootAbove` (cli/install-root.ts) — one predicate for doctor and sync, with the same-install check (row 77, review of #267).
    // 4890 -> 4955: the declared `basalt.shell: false` — config key, seed skip, shared seed-retire notice and the doctor finding (ledger row 82, linewatch W2).
    // 4955 -> 5020: `app-wiring` accepts one provider in the root or a pathless layout, fails an untyped `createRootRoute` and a missing root (ledger rows 113, 115, weatherorb W37).
    // 5020 -> 5165: `app-wiring` follows one import hop (relative or tsconfig `paths`) to a provider wrapper; `sync` judges a Start seed by content (ledger rows 121-123, weatherorb W39); the hop resolver and provider-tag reader are leaf modules.
    // 5165 -> 7073 (W31): `basalt-ui shot` +1691 (cli/shot/: capture with per-state crops, contact sheets, the in-page measurer and theme scale incl. basalt's own `--vx-*` steps, the board, out-dir safety, the launcher; SPEC § 9.5); the reviewer install and rule `paths:` from `basalt.roots` +75 (rows 135-136); doctor's stale-board notice and optional Playwright line +142 (cli/board-freshness.ts).
    // 7073 -> 7098 (W32): `shot` reports a full-round radius as "full" — the raw radius reading, `radiusReading` and its two call sites in cli/shot/ (+25).
    // 7098 -> 7100 (W32): `radiusReading`'s zero-size and percentage branches (+2).
    // 7100 -> 7124 (W33): `shot` hovers a declared `data-shot-at` point and probes for a rendered readout only (+24).
    // 7124 -> 7132 (W33 review): `data-shot-at` parsed by one anchored pattern within [0, 1] (+8).
    // 7132 -> 7478 (fix/shot-real-data): `shot` on a real, signed-in app (+346). Owner-requested (2026-10-17), consumer: argo. cli/shot/real-data.ts +165 (`@env`/`@file` resolution, header and `--api` validation, the read-only proxy with its depth-only log, status classes and timeout, the origin-guarded absent-only seed script), capture.ts +89 (one `visit` that loads, auto-anchors and checks the data; per-visit problem scoping with `collect`/`flagProblems`; `--wait`), index.ts +46 (six flags and their rules, proxy wiring), serve.ts +25 (Host/Origin/Fetch-Metadata guard), help.ts +20 (flags, `multiple` in the option type, the real-app example).
    // 7478 -> 7512 (W36): `managedFiles` walks `agent/skills/<name>/` so a skill's `references/**` are managed files too; injectable `pkgRoot` on init/sync/renderContext; upward empty-dir prune (+34).
    // 7478 -> 8006 (w36 reviewer-detector): `basalt-ui shot detect` (cli/shot/detect.ts: the LLM-free [measured] rules, oxlint JSON, severity and score, history trend), the `absent` anchor status (capture.ts), the help text and `--lint` flag (+528).
    // 8006 -> 8050 (w36 review round 1): detect's atomic history/detect.json write with `.bak` recovery and clean I/O errors, `craft-1/scale-missing`, P0/P1-only exit (+44).
    // 8084 -> 8087 (W36 palette-guard): `check-theme` routes the series module to `series-palette` through one helper (+3).
    // 8087 -> 8091 (w36 button-section-inset): `shot` measure skips text inside a disabled control, WCAG 1.4.3 (cli/shot/measure.ts +4).
    // 8091 -> 8416 (w37 harness): shot hides chrome and frames tall anchors, reveals in-page with a short step timeout and reports `absent`, warns and detects a route with no data-shot-states; `init` seeds a stock Vite main.tsx and its peers (+325: 8416 - 8091).
    {
      label: 'CLI non-test lines (src/cli/**)',
      value: cliNonTestLines(),
      ceiling: 8416,
    },
    ...(await providerOnlyRows(providerOnlyDist)),
  ]
}

export type RunBudgetsOptions = {
  /** `--report`: print everything, exit 0 regardless. */
  reportOnly: boolean
  /** The built root entry the provider-only fixture bundles. Defaults to this package's `dist`. */
  providerOnlyDist?: string
  log?: (line: string) => void
}

/** Print every budget row, then the verdict; returns the exit code instead of exiting. */
export async function runBudgets({
  reportOnly,
  providerOnlyDist = PROVIDER_ONLY_DIST,
  log = console.log,
}: RunBudgetsOptions): Promise<0 | 1> {
  const rows = await budgets(providerOnlyDist)
  // An unmeasured row is a breach of the gate (it cannot vouch for the number) but not of the
  // report: `--report` prints it as skipped/failed and still exits 0.
  const breaches = rows.filter((b) => b.value === null || b.value > b.ceiling)

  const width = Math.max(...rows.map((b) => b.label.length))
  for (const b of rows) {
    if (b.value === null) {
      const { kind, reason } = b.unmeasured ?? { kind: 'skipped', reason: 'not measured' }
      const mark = kind === 'failed' ? '✖' : '-'
      log(`${mark} ${b.label.padEnd(width)}  ${kind}: ${reason} / ${b.ceiling}`)
      continue
    }
    const mark = b.value > b.ceiling ? '✖' : '✓'
    log(`${mark} ${b.label.padEnd(width)}  ${b.value} / ${b.ceiling}`)
    for (const line of b.detail ?? []) log(`    ${line}`)
  }

  if (breaches.length === 0) {
    log(`\n✓ check-budgets: all ${rows.length} budgets within ceiling.`)
    return 0
  }

  log(
    `\n${reportOnly ? '⚠' : '✖'} check-budgets: ${breaches.length} of ${rows.length} budget${
      rows.length === 1 ? '' : 's'
    } over ceiling or unmeasured${reportOnly ? ' (--report: not failing the build)' : ''}.`,
  )
  return reportOnly ? 0 : 1
}

if (import.meta.main) {
  process.exit(await runBudgets({ reportOnly: process.argv.includes('--report') }))
}
