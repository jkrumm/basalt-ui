import { describe, expect, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWaivers } from './index.ts'
import { transformWaivers } from './transform.ts'
import type { Lane } from './idmap.ts'

const FIXTURES = join(import.meta.dir, 'fixtures')
const CASES: readonly (readonly [string, Lane])[] = [
  ['ts', 'ts'],
  ['file-level', 'ts'],
  ['file-level-refused', 'ts'],
  ['css', 'css'],
]
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8')

describe('fixtures', () => {
  test.each(CASES)('%s matches its expected output', (name, lane) => {
    expect(transformWaivers(read(`${name}.in.txt`), { lane }).text).toBe(read(`${name}.out.txt`))
  })

  test.each(CASES)('%s: a second run over its own output is a no-op', (name, lane) => {
    const first = transformWaivers(read(`${name}.in.txt`), { lane })
    const second = transformWaivers(first.text, { lane })
    expect(second.text).toBe(first.text)
    expect(second.rewritten).toHaveLength(0)
  })
})

describe('rules', () => {
  test('a raw-breakpoint waiver maps to the v3 id and keeps its reason', () => {
    const r = transformWaivers('// theme-allow raw-breakpoint -- reason here\nconst q = 1\n', {
      lane: 'ts',
    })
    expect(r.text).toBe(
      '// oxlint-disable-next-line basalt/viewport-keyed -- reason here\nconst q = 1\n',
    )
  })

  test('a waiver without a reason is worklisted and its source is unchanged', () => {
    const src = '// theme-allow raw-hex\nconst c = "#fff"\n'
    const r = transformWaivers(src, { lane: 'ts' })
    expect(r.text).toBe(src)
    expect(r.worklist).toHaveLength(1)
    expect(r.worklist[0]?.reason).toContain('no reason')
  })

  test('a retired id is worklisted, never rewritten', () => {
    const src = '// theme-allow unframed-chart — legend\nconst c = 1\n'
    const r = transformWaivers(src, { lane: 'ts' })
    expect(r.text).toBe(src)
    expect(r.worklist[0]?.reason).toContain('retired')
  })
})

describe('run', () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), 'waivers-'))
    for (const repo of ['one', 'two']) {
      mkdirSync(join(root, repo, 'src'), { recursive: true })
      cpSync(join(FIXTURES, 'ts.in.txt'), join(root, repo, 'src', 'a.tsx'))
    }
    mkdirSync(join(root, 'one', 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(root, 'one', 'node_modules', 'x', 'a.ts'), '// theme-allow raw-hex — x\n')
    return root
  }

  test('a dry run changes nothing and reports per-repo counts and a total', () => {
    const root = setup()
    const before = readFileSync(join(root, 'one/src/a.tsx'), 'utf8')
    const report = runWaivers({ dirs: [join(root, 'one'), join(root, 'two')], write: false })
    expect(readFileSync(join(root, 'one/src/a.tsx'), 'utf8')).toBe(before)
    expect(report.dryRun).toBe(true)
    expect(report.repos.one?.sites).toBe(10)
    expect(report.repos.one?.rewritten).toBe(7)
    expect(report.total.sites).toBe(20)
    expect(report.total.worklist).toBe(6)
  })

  test('a second --write run produces no diff', () => {
    const root = setup()
    const dirs = [join(root, 'one'), join(root, 'two')]
    runWaivers({ dirs, write: true })
    const once = readFileSync(join(root, 'one/src/a.tsx'), 'utf8')
    const again = runWaivers({ dirs, write: true })
    expect(readFileSync(join(root, 'one/src/a.tsx'), 'utf8')).toBe(once)
    expect(again.total.rewritten).toBe(0)
  })
})
