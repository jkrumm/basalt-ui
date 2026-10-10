/**
 * The consolidation plan's numeric ceilings (`.claude/maturation/consolidation-plan.md`, "Budgets
 * are numbers"), enforced as one gate rather than seven scattered opinions: public symbols, published
 * subpaths, shipped rule lines, spec prose, playground routes, the CLI's own line count, and the
 * provider-only first-paint bytes.
 *
 * Every number is printed with its budget, in the order above, before any exit — so a `--report`
 * run (or a failing default run) always shows the full picture rather than stopping at the first
 * breach. `--report` prints and exits 0 unconditionally; the default exits 1 on any breach, for
 * wiring into a CI gate once every consolidation wave has landed.
 *
 * Several budgets are EXPECTED red until sibling waves land (C3 shrinks playground routes, C4
 * shrinks docs and the shipped rules, this wave's own CLI split did not complete) — `--report` is
 * how the orchestrator watches progress without a red gate blocking unrelated work in the interim.
 *
 * Usage: bun packages/basalt-ui/scripts/check-budgets.ts [--report]
 *
 * Importable without running: `runBudgets` and `isOwnGraphId` are the tested seam
 * (`check-budgets.test.ts`); the CLI half runs only under `import.meta.main`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

const PKG_ROOT = join(import.meta.dir, '..')
const REPO_ROOT = join(PKG_ROOT, '..', '..')

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

// ── 1. Public symbols (scripts/export-surface.json) ────────────────────────────────────────────

function publicSymbols(): number {
  const surface = JSON.parse(
    readFileSync(join(PKG_ROOT, 'scripts/export-surface.json'), 'utf8'),
  ) as Record<string, readonly string[]>
  return Object.values(surface).reduce((sum, names) => sum + names.length, 0)
}

// ── 2. Published subpaths (package.json exports) ───────────────────────────────────────────────

function publishedSubpaths(): number {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
  }
  return Object.keys(pkg.exports ?? {}).length
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

async function providerOnlyGzip(distEntry: string): Promise<number> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PKG_ROOT,
    define: { 'process.env.NODE_ENV': '"production"' },
    resolve: { alias: [{ find: /^basalt-ui$/, replacement: distEntry }] },
    build: {
      write: false,
      minify: true,
      lib: { entry: join(PKG_ROOT, 'scripts/fixtures/provider-only.ts'), formats: ['es'] },
      rolldownOptions: {
        external: (id) => id !== 'basalt-ui' && !isOwnGraphId(id),
      },
    },
  })
  // `build()` also types a watcher return (`build.watch`), which has no `output`; narrow it away.
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) {
    throw new Error('check-budgets: provider-only fixture build returned no output')
  }
  const { output } = bundle
  const chunks = new Map(
    output.flatMap((o) => (o.type === 'chunk' ? [[o.fileName, o] as const] : [])),
  )
  const entry = [...chunks.values()].find((c) => c.isEntry)
  if (entry === undefined) throw new Error('check-budgets: provider-only fixture emitted no entry')
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

const PROVIDER_ONLY_LABEL = 'provider-only first paint (gzip B, dist)'
// Landed 18706 locally / 18722 in CI (1.33.0: lab store + every isDev()/DEV-const gate folded;
// 1.30.2 19393, 1.32.1 20379). The ~1% margin absorbs the zlib/runtime difference between machines
// (16 B measured) — it is a regression gate for KB-scale growth, not a byte-exact snapshot. Raise it
// deliberately, in the commit that spends it, never to make a red gate green.
// 18900 → 19000: the AA anchor/error vars and the badge/outline ink mix in the resolver (18904 locally).
const PROVIDER_ONLY_CEILING = 19000

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
async function providerOnlyRow(distEntry: string): Promise<Budget> {
  const row = { label: PROVIDER_ONLY_LABEL, ceiling: PROVIDER_ONLY_CEILING }
  if (!existsSync(distEntry)) {
    return {
      ...row,
      value: null,
      unmeasured: { kind: 'skipped', reason: 'dist/ missing, run `bun run build`' },
    }
  }
  try {
    return { ...row, value: await providerOnlyGzip(distEntry) }
  } catch (error) {
    return { ...row, value: null, unmeasured: { kind: 'failed', reason: summarizeError(error) } }
  }
}

async function budgets(providerOnlyDist: string): Promise<Budget[]> {
  return [
    {
      label: 'public symbols (export-surface.json)',
      value: publicSymbols(),
      ceiling: 400,
    },
    { label: 'published subpaths (package.json exports)', value: publishedSubpaths(), ceiling: 24 },
    { label: 'shipped rule lines (agent/rules/*.md)', value: agentRuleLines(), ceiling: 750 },
    { label: 'spec prose (docs/*.md, non-archive)', value: docsProseLines(), ceiling: 2480 },
    {
      label: 'playground route files (apps/playground/src/routes/**)',
      value: playgroundRouteFiles(),
      ceiling: 15,
    },
    // 4000 -> 4120: the AGENTS.md block move + CLAUDE.md migration (`migrateBlockToAgentsMd`).
    { label: 'CLI non-test lines (src/cli/**)', value: cliNonTestLines(), ceiling: 4120 },
    await providerOnlyRow(providerOnlyDist),
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
