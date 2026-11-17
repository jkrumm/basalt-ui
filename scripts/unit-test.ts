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
 * The file list is bun's own rule (`*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*`, no dot directories, no
 * node_modules) minus the bunfig's `pathIgnorePatterns`, so a new test file is picked up without a list to edit.
 */
import { existsSync, readFileSync } from 'node:fs'

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
const groups: string[][] = HEAVY.map((file) => [file])
const chunks = Math.ceil(rest.length / CHUNK)
const size = Math.ceil(rest.length / chunks)
for (let i = 0; i < rest.length; i += size) groups.push(rest.slice(i, i + size))

console.log(`unit-test: ${all.length} files in ${groups.length} bun test processes`)

const width = Math.min(parallelism(process.env), groups.length)
console.log(`unit-test: ${width === 1 ? 'one process at a time' : `${width} processes at a time`}`)

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
  if (serial) return (await proc.exited) === 0
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`\nunit-test: ${label}, exit ${code}, ${seconds}s\n${out}${err}`)
  return code === 0
}

let failed = 0
let next = 0
await Promise.all(
  Array.from({ length: width }, async () => {
    while (next < groups.length) {
      const index = next++
      if (!(await run(index, groups[index] as string[]))) failed++
    }
  }),
)

if (failed > 0) {
  console.error(`\nunit-test: ${failed} of ${groups.length} processes failed`)
  process.exit(1)
}
