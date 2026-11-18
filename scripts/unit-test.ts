/**
 * The unit suite as several consecutive `bun test` processes (`make test`, the last step of `bun run pre`).
 *
 * One `bun test` over all ~800 files holds 6 GiB resident at its peak (measured 2026-11-14): the happy-dom
 * globals and every file's module graph stay in one heap, and a handful of files that parse the whole
 * package with ts-morph add 1.4 to 2.3 GiB each on top. Here the ts-morph files run alone, one process each, and
 * the rest run in chunks of CHUNK files, so no process carries the suite. Same files, same bunfig and preload,
 * same assertions. The processes run one after another by default (the point is the peak); on the factory's step
 * host, which grants a step its cores and memory (FACTORY_STEP_CORES, FACTORY_STEP_MEM_MIB), they run in parallel
 * up to what the grant holds (scripts/unit-parallelism.ts).
 *
 * A failed run stops: no further process starts and the running ones end (a slot minute spent on a run that already
 * failed is lost either way), and the files of the failed process are remembered in node_modules/.cache, so the next
 * run starts with them, a fix is proven in seconds before the rest runs, and a green run clears the memory. The
 * passing run is unchanged: every file runs in the same processes.
 *
 * The file list is bun's own rule (`*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*`, no dot directories, no
 * node_modules) minus the bunfig's `pathIgnorePatterns`, so a new test file is picked up without a list to edit.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { failedFirst, parseFailedFiles } from './unit-order'
import { parallelism } from './unit-parallelism'

/**
 * Files whose own process peaked above 800 MiB (measured alone, 2026-11-17); two of them in one chunk stacked to
 * 2.4 GiB. A rename fails loudly rather than going unnoticed.
 */
const HEAVY = [
  'packages/basalt-ui/scripts/check-agent-doc-drift.test.ts',
  'packages/basalt-ui/scripts/gen-docs.test.ts',
  'packages/basalt-ui/scripts/gen-llms-assert.test.ts',
  'packages/basalt-ui/scripts/gen-llms.test.ts',
  'packages/basalt-ui/scripts/gen-ui.test.ts',
  'packages/basalt-ui/scripts/migrating-imports.test.ts',
  'packages/basalt-ui/src/page/define-overlays.test.tsx',
  'tests/agent-doc-drift.test.ts',
]

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

const rest = all.filter((file) => !HEAVY.includes(file))
const ordered: string[][] = HEAVY.map((file) => [file])
const chunks = Math.ceil(rest.length / CHUNK)
const size = Math.ceil(rest.length / chunks)
for (let i = 0; i < rest.length; i += size) ordered.push(rest.slice(i, i + size))

const MEMORY = 'node_modules/.cache/unit-test-failed.json'
const groups = failedFirst(
  ordered,
  parseFailedFiles(existsSync(MEMORY) ? readFileSync(MEMORY, 'utf8') : ''),
)

console.log(`unit-test: ${all.length} files in ${groups.length} bun test processes`)

const width = Math.min(parallelism(process.env), groups.length)
console.log(`unit-test: ${width === 1 ? 'one process at a time' : `${width} processes at a time`}`)

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
let next = 0
await Promise.all(
  Array.from({ length: width }, async () => {
    while (next < groups.length && !stopped) {
      const index = next++
      const group = groups[index] as string[]
      if (await run(index, group)) continue
      failed++
      failedFiles.push(...group)
      stop()
    }
  }),
)

if (failed > 0) {
  mkdirSync('node_modules/.cache', { recursive: true })
  writeFileSync(MEMORY, JSON.stringify(failedFiles))
  console.error(
    `\nunit-test: ${failed} of ${groups.length} processes failed; the run stopped there, and the next one starts with these files`,
  )
  process.exit(1)
}
rmSync(MEMORY, { force: true })
