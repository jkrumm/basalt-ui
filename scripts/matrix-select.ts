#!/usr/bin/env bun
/**
 * Which quality-matrix cells a branch has to run locally (`make quality-matrix-fast`, the matrix step of `make check-fast`).
 *
 * The sampled matrix is 394 cells (53 routes and 144 pages, two cells each) and about 30 minutes on a loaded host, of which
 * the 93 scenario pages are most. A scenario page reads nothing outside its own folder, so a branch that only adds or edits
 * scenarios has to run only those pages. CI runs every cell, sharded eight ways, on every head, and `make merge-guard`
 * refuses a head without that green run.
 *
 *   - no changed file is a matrix input (QUALITY_INPUTS)          -> skip
 *   - every changed input is scenario-scoped                       -> the routes of those scenarios
 *   - anything else (the package source, the matrix, a manifest,
 *     the playground shell, a rewritten registry line)             -> all
 *
 * Scenario-scoped: a file under `apps/playground/src/scenarios/expr/<id>/` (route `/scenarios/expr-<id>`, registered in
 * scenario-info.ts), and an ADDITIVE diff (no removed or changed line) of the registry, the scenario info or the demo
 * series: a new entry cannot move a page that does not use it.
 *
 * Usage: `bun scripts/matrix-select.ts [--base <ref>]` prints `skip`, `all` or `routes <comma list>` on stdout and the
 * reason on stderr. The changed set is the merge base with `<ref>` (default `origin/master`) through the working tree,
 * untracked files included. No merge base: `all`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

/** Paths whose change can reach a matrix page. */
export const QUALITY_INPUTS: readonly string[] = [
  'packages/basalt-ui/src',
  'packages/basalt-ui/tests/quality',
  'packages/basalt-ui/tests/support',
  'packages/basalt-ui/package.json',
  'apps/playground',
  'package.json',
  'bun.lock',
]

const SCENARIOS = 'apps/playground/src/scenarios'
const INFO = `${SCENARIOS}/scenario-info.ts`
/** Files a new scenario adds lines to; an additive diff of one is scenario-scoped. */
const ADDITIVE: readonly string[] = [
  INFO,
  `${SCENARIOS}/registry.tsx`,
  'apps/playground/src/demo/series.ts',
]

export type Selection =
  | { mode: 'skip'; reason: string }
  | { mode: 'all'; reason: string }
  | { mode: 'routes'; routes: string[]; reason: string }

export interface SelectInput {
  /** repo-relative paths changed on the branch (committed, staged, unstaged, untracked) */
  changed: readonly string[]
  /** the unified=0 diff of a changed file against the merge base; read only for the ADDITIVE files */
  diffOf: (file: string) => string
  /** every registered scenario id (`expr-n87`) in the working tree */
  ids: ReadonlySet<string>
}

const isInput = (file: string): boolean =>
  QUALITY_INPUTS.some((input) => file === input || file.startsWith(`${input}/`))

/** No `-` line in the diff: nothing was removed or rewritten. */
function additiveOnly(diff: string): boolean {
  return !diff.split('\n').some((line) => line.startsWith('-') && !line.startsWith('---'))
}

/** The ids a diff adds to scenario-info.ts (`+    id: 'expr-n87',`). */
function addedIds(diff: string): string[] {
  return [...diff.matchAll(/^\+\s*id:\s*'([\w-]+)'/gm)].map((m) => m[1] as string)
}

export function selectMatrix({ changed, diffOf, ids }: SelectInput): Selection {
  const inputs = changed.filter(isInput)
  if (inputs.length === 0) return { mode: 'skip', reason: 'no UI input changed' }
  const routes = new Set<string>()
  for (const file of inputs) {
    const scenario = /^apps\/playground\/src\/scenarios\/expr\/([\w-]+)\//.exec(file)?.[1]
    if (scenario !== undefined) {
      const id = `expr-${scenario}`
      if (!ids.has(id))
        return { mode: 'all', reason: `${file}: ${id} is not a registered scenario` }
      routes.add(`/scenarios/${id}`)
      continue
    }
    if (!ADDITIVE.includes(file)) return { mode: 'all', reason: `shared input changed: ${file}` }
    const diff = diffOf(file)
    if (!additiveOnly(diff))
      return { mode: 'all', reason: `${file}: a line was changed or removed` }
    if (file === INFO) for (const id of addedIds(diff)) routes.add(`/scenarios/${id}`)
  }
  if (routes.size === 0) return { mode: 'all', reason: 'no scenario route could be named' }
  const list = [...routes].toSorted()
  return { mode: 'routes', routes: list, reason: `only scenarios changed: ${list.length} routes` }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────

function git(args: string[]): string | null {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  return r.status === 0 ? r.stdout : null
}

if (import.meta.main) {
  const flag = process.argv.indexOf('--base')
  const base = flag > -1 ? (process.argv[flag + 1] ?? 'origin/master') : 'origin/master'
  const root = git(['rev-parse', '--show-toplevel'])?.trim()
  if (!root) {
    console.error('matrix-select: not a git checkout')
    process.exit(2)
  }
  process.chdir(root)
  const mergeBase = git(['merge-base', base, 'HEAD'])?.trim()
  let selection: Selection
  if (!mergeBase) {
    selection = { mode: 'all', reason: `no merge base with ${base}` }
  } else {
    const changed = new Set<string>()
    for (const args of [
      ['diff', '--name-only', mergeBase],
      ['ls-files', '--others', '--exclude-standard'],
    ]) {
      for (const line of (git(args) ?? '').split('\n')) if (line) changed.add(line)
    }
    const ids = new Set(
      [...readFileSync(INFO, 'utf8').matchAll(/\bid:\s*'([\w-]+)'/g)].map((m) => m[1] as string),
    )
    selection = selectMatrix({
      changed: [...changed],
      ids,
      // an untracked additive file has no diff against the base: its whole text is new
      diffOf: (file) =>
        git(['diff', '--unified=0', mergeBase, '--', file]) ??
        (existsSync(file) ? readFileSync(file, 'utf8') : ''),
    })
  }
  console.error(`matrix-select: ${selection.mode} (${selection.reason}); CI runs every cell`)
  if (selection.mode === 'routes') {
    for (const route of selection.routes) console.error(`  ${route}`)
    console.log(`routes ${selection.routes.join(',')}`)
  } else console.log(selection.mode)
}
