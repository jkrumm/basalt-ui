/**
 * Spike 626 (docs/v3/concepts/controls-url-state.md section 9, S1 and S8). Throwaway harness, no
 * tests. Run: `bun run.ts` in this folder (after `bun install`).
 *
 *   S1  file routes + codegen: the branded validator, `types.input`, `search.middlewares`.
 *   S8  number/boolean/range codecs and `toWindow`; `retain` on a layout route across 6 children;
 *       a full-default `multi`; masking history; the codec matrix under both parse configs.
 *
 * Prints ONE JSON object on stdout and exits 0 whenever the harness ran (0 = the harness ran, not
 * "hypothesis held"). Progress goes to stderr. The router-version delta runs the same cases in a
 * scratch copy in the OS temp dir installed against argo's locked router and is never a verdict
 * input.
 */
import './src/setup'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCases } from './src/cases'
import type { CaseResults } from './src/cases'

const ROOT = import.meta.dirname
const LOCKED_ROUTER = '1.170.38' // argo's locked @tanstack/react-router (apps/dashboard bun.lock)
const log = (message: string): void => void process.stderr.write(`${message}\n`)

// ------------------------------------------------------------------------------------ verdict

type Criteria = Record<string, boolean>

function cells(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value)
}

function s1Criteria(r: CaseResults): Criteria {
  const codegen = r.s1.fileRouteCodegen
  const json = r.s8.retainTraps.json
  return {
    'file-route app type-checks, @ts-expect-error negatives included':
      codegen.tsc.exit === 0 && codegen.tsc.errors === 0 && codegen.tsc.negatives > 0,
    'codegen output equals the committed route tree': codegen.treeMatchesCommitted,
    'tree augments FileRoutesByPath': codegen.treeAugmentsFileRoutesByPath,
    'brand survives codegen on every route that declares a validator': codegen.brandsSurvive,
    'search.middlewares reach the route options': codegen.middlewaresMounted,
    'a write from a route that does not run the store is refused': r.s1.brandRefusal.pass,
    'file-route app parses (SSR render reads values under a file route)':
      r.s1.ssrRender.ok &&
      Boolean(r.s1.ssrRender.usesValuesUnderFileRoute) &&
      Boolean(r.s1.ssrRender.controlWithoutParamsLacksValues),
    'middleware strip runs (defaults stripped, validated search complete)':
      json.strippedDefaults && json.validatedComplete,
    'middleware retain runs (explicit default beats retained, clear unsets)':
      json.explicitDefaultBeatsRetained &&
      json.clearUnsets &&
      r.s8.retainChildrenKept.json.kept > 0,
  }
}

function s8Criteria(r: CaseResults): Criteria {
  const configs = ['json', 'stringOnly'] as const
  const allConfigs = (check: (config: (typeof configs)[number]) => boolean) =>
    configs.every((config) => check(config))
  return {
    'every codec round-trips under both parse configs': cells(r.roundTrip).every((codec) =>
      cells(codec).every((cell) => (cell as { ok: boolean }).ok),
    ),
    '6 of 6 children keep retained keys (both configs)': allConfigs(
      (c) => r.s8.retainChildrenKept[c].kept === r.s8.retainChildrenKept[c].of,
    ),
    'leaving the layout drops them (6 of 6, both configs)': allConfigs(
      (c) => r.s8.retainChildrenKept[c].leavingDrops === r.s8.retainChildrenKept[c].of,
    ),
    'a full-default multi omits its param and an empty selection stays distinct': allConfigs(
      (c) => r.s8.multiFullDefault[c].emptyDistinctFromFull,
    ),
    'replace adds 0 history entries, push 1, also for a stripped default': Object.values(
      r.s8.historyEntries,
    ).every((h) => h.pass),
    'masking history: router reads real search, address bar hides it, reload restores': allConfigs(
      (c) => r.s8.maskingHistory[c].pass,
    ),
    'toWindow yields preset or from/to': allConfigs((c) => r.s8.toWindow[c].pass),
  }
}

const verdictOf = (criteria: Criteria): 'PASS' | 'REFUTED' =>
  Object.values(criteria).every(Boolean) ? 'PASS' : 'REFUTED'

// ----------------------------------------------------------------------- router version delta

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    return
  }
  out.set(prefix, JSON.stringify(value))
}

function diff(pinned: CaseResults, locked: CaseResults) {
  const a = new Map<string, string>()
  const b = new Map<string, string>()
  flatten({ ...pinned, versions: undefined }, '', a)
  flatten({ ...locked, versions: undefined }, '', b)
  const differences: { path: string; pinned: string | null; locked: string | null }[] = []
  for (const path of [...new Set([...a.keys(), ...b.keys()])].toSorted()) {
    if (a.get(path) !== b.get(path)) {
      differences.push({ path, pinned: a.get(path) ?? null, locked: b.get(path) ?? null })
    }
  }
  return differences
}

function routerVersionDelta(pinned: CaseResults) {
  const dir = mkdtempSync(join(tmpdir(), 'controls-codegen-locked-'))
  try {
    log(`delta: scratch copy in ${dir}, router ${LOCKED_ROUTER}`)
    cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true })
    for (const file of ['cases-main.ts', 'tsconfig.json']) cpSync(join(ROOT, file), join(dir, file))
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    pkg.dependencies['@tanstack/react-router'] = LOCKED_ROUTER
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
    mkdirSync(join(dir, 'node_modules'), { recursive: true })

    const install = spawnSync('bun', ['install'], { cwd: dir, encoding: 'utf8' })
    if (install.status !== 0) {
      return {
        status: 'unavailable',
        reason: `bun install exit ${install.status}`,
        locked: LOCKED_ROUTER,
      }
    }
    const run = spawnSync('bun', ['cases-main.ts'], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    })
    if (run.status !== 0) {
      return {
        status: 'unavailable',
        reason: `cases exit ${run.status}: ${run.stderr.split('\n').slice(0, 3).join(' | ')}`,
        locked: LOCKED_ROUTER,
      }
    }
    const locked = JSON.parse(run.stdout) as CaseResults
    const differences = diff(pinned, locked)
    return {
      status: 'ran',
      pinned: { reactRouter: pinned.versions.reactRouter, routerCore: pinned.versions.routerCore },
      locked: { reactRouter: locked.versions.reactRouter, routerCore: locked.versions.routerCore },
      tscExit: {
        pinned: pinned.s1.fileRouteCodegen.tsc.exit,
        locked: locked.s1.fileRouteCodegen.tsc.exit,
      },
      verdictInput: false,
      identical: differences.length === 0,
      differences,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// --------------------------------------------------------------------------------------- main

log('cases: router 1.170.46 (pinned)')
const results = await runCases()
const s1 = s1Criteria(results)
const s8 = s8Criteria(results)
const failed = (criteria: Criteria): string[] =>
  Object.entries(criteria)
    .filter(([, ok]) => !ok)
    .map(([name]) => name)

const output = {
  spike: 626,
  harness: { bun: process.versions.bun, node: process.versions.node },
  versions: results.versions,
  s1: results.s1,
  s8: results.s8,
  roundTrip: results.roundTrip,
  routerVersionDelta: routerVersionDelta(results),
  verdict: {
    s1: verdictOf(s1),
    s8: verdictOf(s8),
    verdict: verdictOf({ ...s1, ...s8 }),
    failed: [...failed(s1), ...failed(s8)],
    criteria: { s1, s8 },
  },
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
