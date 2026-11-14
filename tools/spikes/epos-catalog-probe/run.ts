/**
 * Spike P6 (docs/v3/concepts/ai-mdx.md section 7). Stages the epos `show` files into `.scratch/`
 * (a read-only copy: nothing is written under the epos checkout, nothing of it is committed),
 * ports the catalog onto `defineCatalog`, runs epos's own `schema.contract.test.ts` byte for byte
 * and the measurements in `port/probe.tsx`, and prints the engine's line counts.
 *
 *   EPOS=<epos checkout> bun run.ts
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HERE = import.meta.dir
const ROOT = resolve(HERE, '../../..')
const SRC = join(ROOT, 'packages/basalt-ui/src')
const EPOS = process.env.EPOS
if (!EPOS) throw new Error('set EPOS to the epos checkout (read-only)')
const SHOW = join(EPOS, 'ui/src/components/show')
const SCRATCH = join(HERE, '.scratch')
const OUT = join(SCRATCH, 'ui/src/components/show')

const sha = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex')
const epos = spawnSync('git', ['-C', EPOS, 'status', '--porcelain'], { encoding: 'utf8' }).stdout
const before = createHash('sha256').update(epos).digest('hex')

rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const file of ['fixtures.ts', 'vegaSpec.ts', 'vegaPolicy.json', 'schema.contract.test.ts'])
  cpSync(join(SHOW, file), join(OUT, file))
cpSync(join(SHOW, 'schema.ts'), join(OUT, 'schema.orig.ts'))
const contract = join(SCRATCH, 'sandbox/agent/plugins/show')
mkdirSync(contract, { recursive: true })
cpSync(join(EPOS, 'sandbox/agent/plugins/show/schema.json'), join(contract, 'schema.json'))
for (const file of ['catalog.tsx', 'schema.ts']) cpSync(join(HERE, 'port', file), join(OUT, file))
// named probe.test.tsx only in the scratch, so `bun test` at the repo root does not collect it
cpSync(join(HERE, 'port/probe.tsx'), join(OUT, 'probe.test.tsx'))
writeFileSync(
  join(OUT, 'basalt.ts'),
  `export { defineBlock, defineCatalog } from '${join(SRC, 'ai/catalog/define')}'\nexport { expectCatalog } from '${join(SRC, 'testing/expect-catalog')}'\n`,
)
// epos runs vitest; the shim lets the same, unchanged test file run on bun
mkdirSync(join(SCRATCH, 'node_modules/vitest'), { recursive: true })
writeFileSync(
  join(SCRATCH, 'node_modules/vitest/package.json'),
  '{"name":"vitest","main":"index.js"}',
)
writeFileSync(join(SCRATCH, 'node_modules/vitest/index.js'), "export * from 'bun:test'\n")

const unchanged =
  sha(join(SHOW, 'schema.contract.test.ts')) === sha(join(OUT, 'schema.contract.test.ts'))
const test = spawnSync(
  'bun',
  ['test', 'src/components/show/schema.contract.test.ts', 'src/components/show/probe.test.tsx'],
  {
    cwd: join(SCRATCH, 'ui'),
    encoding: 'utf8',
  },
)
process.stdout.write(`${test.stdout}${test.stderr}`)

const count = (file: string): { raw: number; code: number } => {
  const lines = readFileSync(join(SRC, 'ai/catalog', file), 'utf8').split('\n')
  const code = lines.filter((l, i) => {
    const t = l.trim()
    return (
      t !== '' &&
      !t.startsWith('//') &&
      !t.startsWith('*') &&
      !t.startsWith('/**') &&
      !t.startsWith('*/') &&
      i >= 0
    )
  })
  return { raw: lines.length, code: code.length }
}
const engine = Object.fromEntries(
  ['define.ts', 'validate.ts', 'block.tsx'].map((f) => [f, count(f)]),
)
const total = Object.values(engine).reduce(
  (a, c) => ({ raw: a.raw + c.raw, code: a.code + c.code }),
  { raw: 0, code: 0 },
)
const port = Object.fromEntries(
  ['catalog.tsx', 'schema.ts'].map((f) => [
    f,
    readFileSync(join(HERE, 'port', f), 'utf8').split('\n').length,
  ]),
)
const after = createHash('sha256')
  .update(spawnSync('git', ['-C', EPOS, 'status', '--porcelain'], { encoding: 'utf8' }).stdout)
  .digest('hex')
const metrics = existsSync(join(SCRATCH, 'metrics.json'))
  ? JSON.parse(readFileSync(join(SCRATCH, 'metrics.json'), 'utf8'))
  : null
console.log(
  JSON.stringify(
    {
      contractTestUnchanged: unchanged,
      testExit: test.status,
      engine,
      total,
      port,
      eposStatusIdentical: before === after,
      metrics,
    },
    null,
    2,
  ),
)
process.exit(test.status === 0 && before === after && unchanged ? 0 : 1)
