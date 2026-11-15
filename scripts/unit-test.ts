/**
 * The unit suite as several consecutive `bun test` processes (`make test`, the last step of `bun run pre`).
 *
 * One `bun test` over all ~800 files holds 6 GiB resident at its peak (measured 2026-11-14): the happy-dom
 * globals and every file's module graph stay in one heap, and a handful of files that parse the whole
 * package with ts-morph add 1.4 to 2.3 GiB each on top. Here the ts-morph files run alone, one process each, and
 * the rest run in chunks of CHUNK files, so no process carries the suite. Same files, same bunfig and preload,
 * same assertions; the chunks run one after another, never in parallel (the point is the peak).
 *
 * The file list is bun's own rule (`*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*`, no dot directories, no
 * node_modules) minus the bunfig's `pathIgnorePatterns`, so a new test file is picked up without a list to edit.
 */
import { existsSync, readFileSync } from 'node:fs'

/** Files whose own process peaked above 1.3 GiB (measured alone). A rename fails loudly rather than going unnoticed. */
const HEAVY = [
  'packages/basalt-ui/scripts/check-agent-doc-drift.test.ts',
  'packages/basalt-ui/scripts/gen-llms-assert.test.ts',
  'packages/basalt-ui/scripts/gen-llms.test.ts',
  'tests/agent-doc-drift.test.ts',
]

const CHUNK = 40

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

let failed = 0
for (const [index, group] of groups.entries()) {
  console.log(`\nunit-test: process ${index + 1}/${groups.length} (${group.length} files)`)
  const proc = Bun.spawn([process.execPath, 'test', ...group.map((file) => `./${file}`)], {
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  if ((await proc.exited) !== 0) failed++
}

if (failed > 0) {
  console.error(`\nunit-test: ${failed} of ${groups.length} processes failed`)
  process.exit(1)
}
