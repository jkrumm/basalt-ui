#!/usr/bin/env bun
/**
 * Which layout tests a branch has to run locally (`make layout-fast`, the browser step of `make check-fast`).
 *
 * The layout suite is 127 files and ~2300 tests, each opening its own Chrome context: 17 minutes on a loaded
 * host, and about half of the host's test-slot minutes. CI runs all of it, sharded four ways, on every pull
 * request head, and `make merge-guard` refuses a head without that green run. So the local step only has to
 * answer "did the files this branch touched break THEIR layout tests", and this script picks those:
 *
 *   - a changed `*.layout.test.ts` runs itself;
 *   - a changed fixture runs the tests named for it (`fixture/ui-choice-fixture.tsx` -> `ui-choice`), and the
 *     tests named for any `src/` module the fixture imports directly;
 *   - a changed `src/` file runs the tests whose name carries the file's name or its folder's
 *     (`src/charts/Meter.tsx` -> `meter-*`, `charts-*`);
 *   - a change the name cannot place (the theme, the tokens, the provider, the harness, a dependency bump) runs
 *     the SMOKE set, a few small files that fail on a broken page, a broken token layer or a broken harness;
 *   - a change no page can see (docs, scripts, unit tests, the CLI, the linter) runs nothing.
 *
 * The match is by NAME, and a name is a heuristic: it can miss a test that guards a component indirectly. That
 * is the price of the speed, and the reason CI keeps the full suite. Every pick prints its reason on stderr.
 *
 * Usage: `bun scripts/layout-select.ts [--base <ref>]` prints the selected test files, one per line, on stdout
 * (nothing when no layout input changed). The changed set is the merge base with `<ref>` (default
 * `origin/master`) through the working tree, untracked files included.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PKG = 'packages/basalt-ui'
const LAYOUT = `${PKG}/tests/layout`
const SRC = `${PKG}/src`

/** Small, fast files that fail on a broken page, token layer or harness; run when a change cannot be placed. */
export const SMOKE: readonly string[] = [
  'shell-invariants',
  'nested-radius',
  'hit-floor',
  'hit-overlap',
  'card-chrome',
  'badge-chrome',
]

/** `src/` folders no page renders: the CLI, the linter and the guard registry. (`testing` is NOT one: the layout suite imports it.) */
const INVISIBLE_DIRS: ReadonlySet<string> = new Set(['cli', 'commands', 'lint', 'guard'])

/** Folders and files whose change reaches every page: a name cannot place them, so they run the smoke set. */
const SHARED: ReadonlySet<string> = new Set([
  'theme',
  'theme-lab',
  'tokens',
  'css',
  'core',
  'common',
  'provider',
  'format',
  'state',
  'router',
  'router-tanstack',
  'vite',
  'styles',
  'index',
  'surfaces',
  'register',
  'telemetry',
  'query-client',
  'unwrap',
  'dev-dock',
])

/** Config whose change reaches every page: a dependency bump, the compiler, the test config. */
const CONFIG: ReadonlySet<string> = new Set([
  'package.json',
  'bun.lock',
  'bunfig.toml',
  'tsconfig.base.json',
  'tsconfig.json',
  `${PKG}/package.json`,
  `${PKG}/tsconfig.json`,
])

export interface Selection {
  /** test files, repo-relative, sorted; empty when no layout input changed */
  files: string[]
  /** one line per decision, for the lead to read */
  reasons: string[]
}

/** `EventList` / `event_list` / `event-list.tsx` -> ['event', 'list']; a trailing plural `s` is dropped. */
export function words(name: string): string[] {
  return name
    .replace(/\.[a-z]+$/i, '')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

/** Whether `key` appears in `testName` as a run of whole words (`event-list` in `event-list-w44`, not `ui-event`). */
export function carries(testName: string, key: string[]): boolean {
  const own = words(testName)
  if (key.length === 0) return false
  for (let at = 0; at + key.length <= own.length; at++) {
    if (key.every((w, i) => own[at + i] === w)) return true
  }
  return false
}

/** The name a test goes by: its path without folder or `.layout.test.ts`. */
function testName(file: string): string {
  return (file.split('/').pop() ?? file).replace(/\.layout\.test\.ts$/, '')
}

/** `scripts/x.test.ts`-style unit tests, type guards and stories sit beside src files and render nothing. */
function isUnitTest(file: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.endsWith('.type-guard.ts')
}

/** Direct (non-barrel) `src/` imports of a fixture file, as repo-relative module paths without extension. */
export function fixtureImports(fixtureFile: string, source: string): string[] {
  const out: string[] = []
  const dir = fixtureFile.split('/').slice(0, -1).join('/')
  for (const m of source.matchAll(/from\s+['"](\.[^'"]*)['"]/g)) {
    const target = resolve('/', dir, m[1] as string).slice(1)
    if (!target.startsWith(`${SRC}/`)) continue
    if (target.endsWith('/index') || target === SRC) continue
    out.push(target)
  }
  return out
}

export interface SelectInput {
  /** repo-relative paths changed on the branch (committed, staged, unstaged, untracked) */
  changed: readonly string[]
  /** every layout test file, repo-relative */
  tests: readonly string[]
  /** fixture file (repo-relative) -> its source text; only the `*-fixture.tsx` files are read */
  fixtureSources?: ReadonlyMap<string, string>
}

export function selectLayout({ changed, tests, fixtureSources }: SelectInput): Selection {
  const picked = new Map<string, string>()
  let smoke = ''
  const pick = (file: string, why: string) => {
    if (!picked.has(file)) picked.set(file, why)
  }
  const byWords = (key: string[], why: string): number => {
    let n = 0
    for (const t of tests) {
      if (carries(testName(t), key)) {
        pick(t, why)
        n++
      }
    }
    return n
  }

  // src module (without extension) -> fixture stems that import it directly
  const importedBy = new Map<string, string[]>()
  for (const [file, source] of fixtureSources ?? []) {
    const stem = (file.split('/').pop() ?? '').replace(/-fixture\.tsx$/, '')
    for (const mod of fixtureImports(file, source)) {
      importedBy.set(mod, [...(importedBy.get(mod) ?? []), stem])
    }
  }

  for (const file of changed) {
    if (file.startsWith(`${LAYOUT}/`)) {
      if (file.endsWith('.layout.test.ts')) {
        if (tests.includes(file)) pick(file, `changed: ${file}`)
        continue
      }
      const base = file.split('/').pop() ?? ''
      const stem = base.replace(/(-fixture)?\.(tsx?|css|jsx?)$/, '')
      if (
        file.includes('/fixture/') &&
        stem !== base &&
        byWords(words(stem), `fixture ${base}`) > 0
      )
        continue
      smoke ||= `harness or shared fixture changed: ${file}`
      continue
    }
    if (CONFIG.has(file)) {
      smoke ||= `config changed: ${file}`
      continue
    }
    if (!file.startsWith(`${SRC}/`)) continue
    if (isUnitTest(file)) continue
    const rest = file.slice(SRC.length + 1).split('/')
    const top = (rest[0] ?? '').replace(/\.[a-z]+$/, '')
    if (INVISIBLE_DIRS.has(top)) continue
    const stem = (rest.at(-1) ?? '').replace(/\.[a-z]+$/, '')
    const importers = importedBy.get(file.replace(/\.[a-z]+$/, '')) ?? []
    let n = 0
    for (const s of importers) n += byWords(words(s), `${file} is imported by fixture ${s}-fixture`)
    // the file's own name, then its folders below `src/` (`ui` and the shared folders are too broad to name a test)
    n += byWords(words(stem), `${file} by name`)
    for (const dir of rest.slice(0, -1)) {
      if (dir === 'ui' || SHARED.has(dir)) continue
      n += byWords(words(dir), `${file} by folder ${dir}`)
    }
    if (n === 0) smoke ||= `no layout test is named for ${file}`
  }

  if (smoke)
    for (const s of SMOKE) for (const t of tests) if (testName(t) === s) pick(t, `smoke: ${smoke}`)
  const files = [...picked.keys()].toSorted()
  return { files, reasons: files.map((f) => `${f}  <- ${picked.get(f)}`) }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────

function git(args: string[]): string | null {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

function listTests(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...listTests(path))
    } else if (entry.name.endsWith('.layout.test.ts')) out.push(path)
  }
  return out.toSorted()
}

if (import.meta.main) {
  const flag = process.argv.indexOf('--base')
  const base = flag > -1 ? (process.argv[flag + 1] ?? 'origin/master') : 'origin/master'
  const root = git(['rev-parse', '--show-toplevel'])
  if (!root) {
    console.error('layout-select: not a git checkout')
    process.exit(2)
  }
  process.chdir(root)
  const mergeBase = git(['merge-base', base, 'HEAD'])
  if (!mergeBase) {
    // No base to diff against: run everything rather than guess. The caller treats the list as authoritative.
    console.error(`layout-select: no merge base with ${base}; selecting every layout test`)
    console.log(listTests(LAYOUT).join('\n'))
    process.exit(0)
  }
  const changed = new Set<string>()
  for (const args of [
    ['diff', '--name-only', mergeBase],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    for (const line of (git(args) ?? '').split('\n')) if (line) changed.add(line)
  }
  const tests = listTests(LAYOUT)
  const fixtureSources = new Map<string, string>()
  const fixtureDir = `${LAYOUT}/fixture`
  if (existsSync(fixtureDir)) {
    for (const f of readdirSync(fixtureDir)) {
      if (f.endsWith('-fixture.tsx'))
        fixtureSources.set(`${fixtureDir}/${f}`, readFileSync(`${fixtureDir}/${f}`, 'utf8'))
    }
  }
  const { files, reasons } = selectLayout({ changed: [...changed], tests, fixtureSources })
  console.error(
    files.length === 0
      ? `layout-select: ${changed.size} changed files, none reaches a layout test; CI runs the full suite`
      : `layout-select: ${files.length} of ${tests.length} layout files; CI runs the full suite\n${reasons.map((r) => `  ${r}`).join('\n')}`,
  )
  if (files.length > 0) console.log(files.join('\n'))
}
