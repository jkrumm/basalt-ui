/**
 * The unit suite as several consecutive `bun test` processes (`make test`, the last step of `bun run pre`).
 *
 * One `bun test` over all ~800 files holds 6 GiB resident at its peak (measured 2026-11-14): the happy-dom
 * globals and every file's module graph stay in one heap, and a handful of files that parse the whole
 * package with ts-morph add 1.4 to 2.3 GiB each on top. Here the ts-morph files run alone, one process each, and
 * the rest run in chunks of CHUNK files, so no process carries the suite. Same files, same bunfig and preload,
 * same assertions. The processes run one after another by default (the point is the peak); on the factory's step
 * host, which grants a step its cores and memory (FACTORY_STEP_CORES, FACTORY_STEP_MEM_MIB), they run in parallel
 * up to what the grant holds and while the sum of their estimated peaks stays under 2 GiB, the step's peak budget
 * (scripts/unit-parallelism.ts; UNIT_PEAK_MIB overrides).
 *
 * A failed run stops: no further process starts and the running ones end (a slot minute spent on a run that already
 * failed is lost either way), and the files of the failed process are remembered in node_modules/.cache, so the next
 * run starts with them, a fix is proven in seconds before the rest runs, and a green run clears the memory. The
 * passing run is unchanged: every file runs in the same processes.
 *
 * 'bun scripts/unit-test.ts --changed [--base <ref>]' (`make test-fast`, the unit step of `make check-fast`) runs the
 * files the branch's changes reach instead of the suite: the always-on files of scripts/unit-select.ts whole, every
 * other file through `bun test --changed=<merge base>`, bun's module graph. CI and `make check` run the whole suite.
 *
 * The file list is bun's own rule (`*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*`, no dot directories, no
 * node_modules) minus the bunfig's `pathIgnorePatterns`, so a new test file is picked up without a list to edit.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { failedFirst, parseFailedFiles } from './unit-order'
import { parallelism, peakBudgetMib, pickNext } from './unit-parallelism'
import { changedSince, selectUnit } from './unit-select'

/**
 * Files whose own process peaked above 700 MiB, each with that peak in MiB rounded up (measured alone, 2026-11-21; gen-llms, gen-llms-assert and
 * tests/agent-doc-drift re-measured 2026-11-22 after the shared llms program; two of them in one chunk stacked to 2.4 GiB). The cost lets a parallel run keep the sum of what runs under its budget
 * (scripts/unit-parallelism.ts). A rename fails loudly rather than going unnoticed.
 */
const HEAVY_MIB: Record<string, number> = {
  'packages/basalt-ui/scripts/check-agent-doc-drift.test.ts': 1100,
  'packages/basalt-ui/scripts/gen-docs.test.ts': 900,
  'packages/basalt-ui/scripts/gen-llms-assert.test.ts': 1050,
  'packages/basalt-ui/scripts/gen-llms.test.ts': 1400,
  'packages/basalt-ui/scripts/gen-ui.test.ts': 1450,
  'packages/basalt-ui/scripts/migrating-imports.test.ts': 750,
  'packages/basalt-ui/src/page/define-overlays.test.tsx': 900,
  'tests/agent-doc-drift.test.ts': 1100,
}
const HEAVY = Object.keys(HEAVY_MIB)

/** A chunk of 40 files peaked at 870 MiB at most (measured 2026-11-21, the playground matrix chunk). */
const CHUNK_MIB = 900

const CHUNK = 40

/**
 * Per-test timeout (bun's default is 5000 ms). The step host is 1.7x slower than the mini and runs several processes
 * at once; there ~8 tests (the real-tree docs, the virtual body, the README type-check) took 5.0 to 8.3 s. A hung
 * test still fails, 25 s later.
 */
const TEST_TIMEOUT_MS = 30_000

const root = new URL('..', import.meta.url).pathname
process.chdir(root)

const bunfig = Bun.TOML.parse(readFileSync('bunfig.toml', 'utf8')) as {
  test?: { pathIgnorePatterns?: string[] }
}
const ignored = (bunfig.test?.pathIgnorePatterns ?? []).map((pattern) => new Bun.Glob(pattern))

const all: string[] = []
for await (const file of new Bun.Glob(
  '**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}',
).scan('.')) {
  if (file.split('/').includes('node_modules')) continue
  if (ignored.some((glob) => glob.match(file))) continue
  all.push(file)
}
all.sort()

for (const file of HEAVY) {
  if (!existsSync(file) || !all.includes(file))
    throw new Error(`unit-test.ts: HEAVY lists ${file}, which is not a unit test file`)
}

/** --changed: the always-on files run whole, the others through `bun test --changed`; otherwise every file runs whole. */
const changedFlag = process.argv.indexOf('--changed')
const baseFlag = process.argv.indexOf('--base')
const base = baseFlag > -1 ? (process.argv[baseFlag + 1] ?? 'origin/master') : 'origin/master'
let mergeBase: string | null = null
let always: ReadonlySet<string> = new Set(all)
if (changedFlag > -1) {
  const since = changedSince(base)
  const selection = since
    ? selectUnit({ changed: since.changed, tests: all, read: (test) => readFileSync(test, 'utf8') })
    : { mode: 'all' as const, always: [], reasons: [`no merge base with ${base}: the whole suite`] }
  console.log(selection.reasons.map((reason) => `unit-select: ${reason}`).join('\n'))
  if (since && selection.mode === 'changed') {
    mergeBase = since.mergeBase
    always = new Set(selection.always)
    console.log(
      `unit-select: ${always.size} of ${all.length} files run whole, the rest through bun test --changed (CI runs the full suite)`,
    )
  }
}

/** The groups that run through `--changed`; every other group runs its files whole. */
const viaChanged = new Set<string[]>()
const ordered: string[][] = []
function partition(files: string[], changed: boolean): void {
  const heavy = HEAVY.filter((file) => files.includes(file))
  const rest = files.filter((file) => !HEAVY.includes(file))
  const groups: string[][] = heavy.map((file) => [file])
  const chunks = Math.ceil(rest.length / CHUNK)
  const size = Math.ceil(rest.length / Math.max(chunks, 1))
  for (let i = 0; i < rest.length; i += size) groups.push(rest.slice(i, i + size))
  if (changed) for (const group of groups) viaChanged.add(group)
  ordered.push(...groups)
}
partition(
  all.filter((file) => always.has(file)),
  false,
)
partition(
  all.filter((file) => !always.has(file)),
  true,
)

// a --changed run has its own memory: its green run must not clear what a whole-suite run remembers
const MEMORY = `node_modules/.cache/unit-test-failed${mergeBase ? '-changed' : ''}.json`
const groups = failedFirst(
  ordered,
  parseFailedFiles(existsSync(MEMORY) ? readFileSync(MEMORY, 'utf8') : ''),
)

console.log(`unit-test: ${all.length} files in ${groups.length} bun test processes`)

const width = Math.min(parallelism(process.env), groups.length)
const budgetMib = peakBudgetMib(process.env)
console.log(
  `unit-test: ${width === 1 ? 'one process at a time' : `${width} processes at a time, their estimated cost under ${budgetMib} MiB`}`,
)

/** A group's estimated peak: its heavy file alone, else the largest measured chunk. */
function costMib(group: string[]): number {
  const [only] = group
  return group.length === 1 && only !== undefined && only in HEAVY_MIB
    ? (HEAVY_MIB[only] as number)
    : CHUNK_MIB
}

const running = new Set<ReturnType<typeof Bun.spawn>>()
const killed = new Set<ReturnType<typeof Bun.spawn>>()
const failedFiles: string[] = []
let stopped = false

/** The first failure ends the run: the processes still running are killed, none starts. */
function stop(): void {
  stopped = true
  for (const proc of running) {
    killed.add(proc)
    proc.kill()
  }
}

/** One process; in parallel its output is held and printed whole when it ends, so two runs never interleave. */
async function run(index: number, group: string[]): Promise<boolean> {
  const label = `process ${index + 1}/${groups.length} (${group.length} files)`
  const serial = width === 1
  if (serial) console.log(`\nunit-test: ${label}`)
  const started = Date.now()
  const proc = Bun.spawn(
    [
      process.execPath,
      'test',
      '--timeout',
      String(TEST_TIMEOUT_MS),
      ...(mergeBase && viaChanged.has(group) ? [`--changed=${mergeBase}`] : []),
      ...group.map((file) => `./${file}`),
    ],
    serial ? { stdio: ['inherit', 'inherit', 'inherit'] } : { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  running.add(proc)
  if (serial) {
    const code = await proc.exited
    running.delete(proc)
    return code === 0
  }
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout as ReadableStream).text(),
    new Response(proc.stderr as ReadableStream).text(),
    proc.exited,
  ])
  running.delete(proc)
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  // A process killed because another failed is not a failure of its own: say so and remember nothing of it.
  if (killed.has(proc)) {
    console.log(`\nunit-test: ${label} stopped after ${seconds}s, another process failed`)
    return true
  }
  console.log(`\nunit-test: ${label}, exit ${code}, ${seconds}s\n${out}${err}`)
  return code === 0
}

let failed = 0
// The groups not started yet, in order; one starts when a slot of the width is free and its cost fits the budget.
const pending = groups.map((group, index) => ({ group, index, cost: costMib(group) }))
let runningMib = 0
let runningCount = 0
await new Promise<void>((done) => {
  function fill(): void {
    while (!stopped && runningCount < width) {
      const at = pickNext({
        pending: pending.map((entry) => entry.cost),
        runningMib,
        budgetMib,
        running: runningCount,
      })
      if (at === null) break
      const [entry] = pending.splice(at, 1)
      if (!entry) break
      runningMib += entry.cost
      runningCount++
      void run(entry.index, entry.group).then((ok) => {
        runningMib -= entry.cost
        runningCount--
        if (!ok) {
          failed++
          failedFiles.push(...entry.group)
          stop()
        }
        fill()
      })
    }
    if (runningCount === 0) done()
  }
  fill()
})

if (failed > 0) {
  mkdirSync('node_modules/.cache', { recursive: true })
  writeFileSync(MEMORY, JSON.stringify(failedFiles))
  console.error(
    `\nunit-test: ${failed} of ${groups.length} processes failed; the run stopped there, and the next one starts with these files`,
  )
  process.exit(1)
}
rmSync(MEMORY, { force: true })
