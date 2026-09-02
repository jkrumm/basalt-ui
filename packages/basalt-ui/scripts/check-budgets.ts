/**
 * The consolidation plan's numeric ceilings (`.claude/maturation/consolidation-plan.md`, "Budgets
 * are numbers"), enforced as one gate rather than six scattered opinions: public symbols, published
 * subpaths, shipped rule lines, spec prose, playground routes, and the CLI's own line count.
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
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PKG_ROOT = join(import.meta.dir, '..')
const REPO_ROOT = join(PKG_ROOT, '..', '..')

type Budget = {
  readonly label: string
  readonly value: number
  readonly ceiling: number
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

// ── 4. Spec prose (docs/*.md, non-archive) ──────────────────────────────────────────────────────

function docsProseLines(): number {
  const glob = new Bun.Glob('*.md')
  const paths = [...glob.scanSync({ cwd: join(REPO_ROOT, 'docs'), onlyFiles: true })].map((rel) =>
    join(REPO_ROOT, 'docs', rel),
  )
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

function budgets(): Budget[] {
  return [
    { label: 'public symbols (export-surface.json)', value: publicSymbols(), ceiling: 400 },
    { label: 'published subpaths (package.json exports)', value: publishedSubpaths(), ceiling: 24 },
    { label: 'shipped rule lines (agent/rules/*.md)', value: agentRuleLines(), ceiling: 750 },
    { label: 'spec prose (docs/*.md, non-archive)', value: docsProseLines(), ceiling: 2650 },
    {
      label: 'playground route files (apps/playground/src/routes/**)',
      value: playgroundRouteFiles(),
      ceiling: 15,
    },
    { label: 'CLI non-test lines (src/cli/**)', value: cliNonTestLines(), ceiling: 4000 },
  ]
}

function main(): void {
  const reportOnly = process.argv.includes('--report')
  const rows = budgets()
  const breaches = rows.filter((b) => b.value > b.ceiling)

  const width = Math.max(...rows.map((b) => b.label.length))
  for (const b of rows) {
    const mark = b.value > b.ceiling ? '✖' : '✓'
    console.log(`${mark} ${b.label.padEnd(width)}  ${b.value} / ${b.ceiling}`)
  }

  if (breaches.length === 0) {
    console.log(`\n✓ check-budgets: all ${rows.length} budgets within ceiling.`)
    return
  }

  console.log(
    `\n${reportOnly ? '⚠' : '✖'} check-budgets: ${breaches.length} of ${rows.length} budget${
      rows.length === 1 ? '' : 's'
    } over ceiling${reportOnly ? ' (--report: not failing the build)' : ''}.`,
  )
  if (!reportOnly) process.exit(1)
}

main()
