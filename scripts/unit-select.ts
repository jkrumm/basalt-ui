#!/usr/bin/env bun
/**
 * Which unit tests a branch has to run locally ('make test-fast', the unit step of 'make check-fast').
 *
 * The unit suite is ~590 files; CI runs all of it on every pull request head, and 'make merge-guard' refuses a head
 * without that green run. So the local step only has to answer "did what this branch touched break the tests that
 * reach it", and it answers with two sets:
 *
 *   - the files 'bun test --changed=<merge base>' picks: bun's own module graph, the tests that import (directly or
 *     through any chain) a file the branch changed. That is the field-standard tool and needs no name heuristic;
 *   - the always-on set, for what an import graph cannot see: a test that READS files (docs, templates, the whole
 *     package parsed with ts-morph) or spawns a tool imports none of them. Every test outside 'apps/' and outside a
 *     'packages/basalt-ui/src/<folder>/' (the root 'tests/', 'scripts/', 'packages/basalt-ui/scripts' and
 *     'packages/basalt-ui/tests', 'tools/', the files directly in 'src/') is always on, so is every test of 'apps/' once the
 *     package changed (they import it by name, which resolves to dist, never to the changed src), and so is any test whose
 *     text names a changed file by its file name ('styles.css', 'dim-floor.tsx') or the folder it sits in.
 *
 * The always-on set leaves out ONE kind of test: the slow ones (SLOW below, 8 s to 90 s each, ~240 s of the ~330 s the set
 * costs on the mini) whose duty is covered elsewhere in `make check-fast` (a script gate it runs) or reached by the graph
 * when the code they test changes (the CLI, the migration tools). They still run when --changed selects them or when their
 * text names a changed file or its last two folders ('fixtures/hook', 'src/cli'): the fixtures they read and the bins
 * they spawn are not imports.
 *
 * A change the graph cannot place (a dependency bump, the compiler config, the test preload, the unit scripts)
 * selects the whole suite. A test that covers code the branch did not touch fails in CI, not here: that is the price
 * of the speed and the reason CI keeps the full suite.
 *
 * Usage: 'bun scripts/unit-select.ts [--base <ref>]' prints the always-on files one per line on stdout, or 'all',
 * and the reasons on stderr. 'scripts/unit-test.ts --changed' is the caller.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PACKAGE = 'packages/basalt-ui/'
const SRC = PACKAGE + 'src/'

/** A change to any of these reaches every test: the whole suite runs. */
const EVERYTHING: readonly RegExp[] = [
  /(^|\/)package\.json$/,
  /^bun\.lock$/,
  /(^|\/)bunfig\.toml$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /^tests\/setup\//,
  /^scripts\/unit-(test|select|order|parallelism)\.ts$/,
]

/**
 * Always-on tests that are left to the graph: each costs 8 s or more alone (timings 2026-11-18, mini under load), and its
 * real-tree duty is run by a script gate of 'make check-fast' (gen-docs --check, check-agent-doc-drift, gen-oxlint --check)
 * or follows an import of the code it tests (the CLI, the migration tools, commitlint's config), or a path its text names.
 */
const SLOW: readonly RegExp[] = [
  /^tests\/oxlint-preset-smoke\.test\.ts$/,
  /^packages\/basalt-ui\/tests\/cli\//,
  /^packages\/basalt-ui\/scripts\/(gen-docs|gen-ui|check-agent-doc-drift|release-migrating)\.test\.ts$/,
  /^tools\/migrate-v3\/bench\//,
  /^commitlint\.config\.test\.ts$/,
]

/** File names shorter than this are too common to name a test's subject. */
const MIN_NAME = 6

export interface UnitSelection {
  /** 'all': run the whole suite. 'changed': the always-on files run whole, the rest through 'bun test --changed'. */
  mode: 'all' | 'changed'
  /** test files that run whole in 'changed' mode, repo-relative, sorted */
  always: string[]
  /** one line per decision, for the lead to read */
  reasons: string[]
}

/** Tests whose subject an import graph cannot reach: everything but 'apps/', the folders of 'src/' and the SLOW ones. */
export function isAlwaysOn(test: string): boolean {
  if (test.startsWith('apps/') || SLOW.some((re) => re.test(test))) return false
  if (test.startsWith(SRC)) return !test.slice(SRC.length).includes('/')
  return true
}

export interface SelectInput {
  /** repo-relative paths changed on the branch (committed, staged, unstaged, untracked) */
  changed: readonly string[]
  /** every unit test file, repo-relative */
  tests: readonly string[]
  /** reads a test's text; called only for tests outside the always-on set, and only when a changed file needs it */
  read: (test: string) => string
}

const isTest = (file: string): boolean => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)

export function selectUnit({ changed, tests, read }: SelectInput): UnitSelection {
  const trigger = changed.find((file) => EVERYTHING.some((re) => re.test(file)))
  if (trigger) return { mode: 'all', always: [], reasons: ['whole suite: ' + trigger + ' changed'] }

  const why = new Map<string, string>()
  for (const test of tests) if (isAlwaysOn(test)) why.set(test, '')

  // what a test's text can name: a changed file's name ('styles.css') or its folder ('test/fixtures/hook'): the last
  // two folders, never one folder alone ('src' would name every test)
  const names = new Map<string, string>()
  for (const file of changed) {
    if (isTest(file)) continue
    const parts = file.split('/')
    const name = parts.at(-1) ?? file
    if (name.length >= MIN_NAME && !name.startsWith('index.') && !names.has(name))
      names.set(name, file)
    const folder = parts.slice(-3, -1).join('/')
    if (folder.includes('/') && !names.has(folder)) names.set(folder, file)
  }
  if (names.size > 0) {
    for (const test of tests) {
      if (why.has(test)) continue
      const text = read(test)
      for (const [name, file] of names) {
        if (!text.includes(name)) continue
        why.set(test, 'names ' + file)
        break
      }
    }
  }
  // 'apps/' tests import the package by name ('basalt-ui/charts'), which resolves to the gitignored dist, not to the src
  // files a branch changed: the graph never reaches them, so a package change runs them all (13 small files)
  const packageChanged = changed.some((file) => file.startsWith(PACKAGE) && !isTest(file))
  if (packageChanged) {
    for (const test of tests) {
      if (test.startsWith('apps/') && !why.has(test))
        why.set(test, 'imports the package through dist')
    }
  }
  const files = [...why.keys()].toSorted()
  const named = files.filter((f) => why.get(f))
  return {
    mode: 'changed',
    always: files,
    reasons: [
      files.length -
        named.length +
        ' always-on files (outside apps/, the src/ folders and the slow ones)',
      ...named.map((f) => f + '  <- ' + why.get(f)),
    ],
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────

function git(args: string[]): string | null {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

/** The merge base with 'base' and the paths changed since it, working tree and untracked files included. */
export function changedSince(base: string): { mergeBase: string; changed: string[] } | null {
  const mergeBase = git(['merge-base', base, 'HEAD'])
  if (!mergeBase) return null
  const changed = new Set<string>()
  for (const args of [
    ['diff', '--name-only', mergeBase],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    for (const line of (git(args) ?? '').split('\n')) if (line) changed.add(line)
  }
  return { mergeBase, changed: [...changed] }
}

if (import.meta.main) {
  const flag = process.argv.indexOf('--base')
  const base = flag > -1 ? (process.argv[flag + 1] ?? 'origin/master') : 'origin/master'
  const root = git(['rev-parse', '--show-toplevel'])
  if (!root) {
    console.error('unit-select: not a git checkout')
    process.exit(2)
  }
  process.chdir(root)
  const since = changedSince(base)
  const tests = (git(['ls-files', '*.test.*', '*.spec.*']) ?? '')
    .split('\n')
    .filter((f) => f && !f.includes('/tests/layout/') && !f.includes('/test/fixtures/'))
  const selection: UnitSelection = since
    ? selectUnit({ changed: since.changed, tests, read: (t) => readFileSync(t, 'utf8') })
    : { mode: 'all', always: [], reasons: ['no merge base with ' + base] }
  console.error(selection.reasons.map((r) => 'unit-select: ' + r).join('\n'))
  console.log(selection.mode === 'all' ? 'all' : selection.always.join('\n'))
}
