/**
 * The recipe channel's drift gate (skills-agent-layer 3.16, 15.9): `docs/recipes/<name>.md` must
 * equal the `// #region recipe:<name>` of its compiled playground file, inside the recipe budget.
 * Runs the real check over the real tree (zero recipes is clean) and over on-disk fixtures, each
 * of which fails for exactly one stated reason.
 *
 * Run: bun test packages/basalt-ui/tests/recipes.drift.test.ts
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'

import {
  checkRecipes,
  MAX_PROSE_LINES,
  MAX_RECIPE_LINES,
  MAX_RECIPES,
  REAL_ROOTS,
  writeRecipes,
} from '../scripts/gen-recipes'

const SCRIPT = join(import.meta.dir, '..', 'scripts', 'gen-recipes.ts')
const FIXTURES = join(import.meta.dir, 'fixtures', 'recipes')
const SOURCE = 'apps/playground/src/recipes/sample.ts'
const REGION = ['export const greet = (name: string): string => `hello ${name}`']

const roots = (repoRoot: string) => ({ repoRoot, docsDir: join(repoRoot, 'docs', 'recipes') })
const fixture = (name: string) => join(FIXTURES, name)

function runCli(args: string[]): { code: number; out: string } {
  const r = Bun.spawnSync(['bun', SCRIPT, ...args], { stdout: 'pipe', stderr: 'pipe' })
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() }
}

const temps: string[] = []
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
})

/** A scratch tree with one valid recipe whose doc is built by the caller. */
function scratch(opts: { frontmatter?: string[]; prose?: number; fence?: string[] }): string {
  const root = mkdtempSync(join(tmpdir(), 'recipes-'))
  temps.push(root)
  mkdirSync(join(root, 'docs', 'recipes'), { recursive: true })
  mkdirSync(join(root, 'apps', 'playground', 'src', 'recipes'), { recursive: true })
  writeFileSync(
    join(root, SOURCE),
    ['// #region recipe:sample', ...REGION, '// #endregion', ''].join('\n'),
  )
  const frontmatter = opts.frontmatter ?? [
    'name: sample',
    'use-when: a greeting helper',
    `file: ${SOURCE}`,
  ]
  const prose = Array.from({ length: opts.prose ?? 1 }, (_, i) => `Prose line ${i + 1}.`)
  const doc = [
    '---',
    ...frontmatter,
    '---',
    '',
    ...prose,
    '',
    '```ts',
    ...(opts.fence ?? REGION),
    '```',
  ]
  writeFileSync(join(root, 'docs', 'recipes', 'sample.md'), doc.join('\n') + '\n')
  return root
}

const reasons = (root: string): string[] => checkRecipes(roots(root)).map((p) => p.reason)

describe('recipes drift — real tree', () => {
  test('the committed tree is clean (zero recipes passes)', () => {
    expect(checkRecipes(REAL_ROOTS)).toEqual([])
  })

  test('the CLI exits 0 on the real tree', () => {
    expect(runCli(['--check']).code).toBe(0)
  })
})

describe('recipes drift — fixtures', () => {
  test('ok: exits 0', () => {
    expect(runCli(['--check', '--root', fixture('ok')]).code).toBe(0)
  })

  test('drift: exits 1 naming the file and the differing fence', () => {
    const r = runCli(['--check', '--root', fixture('drift')])
    expect(r.code).toBe(1)
    expect(r.out).toContain('docs/recipes/sample.md')
    expect(r.out).toContain('code fence differs from region recipe:sample')
  })

  test('long: exits 1 naming the file and the prose count', () => {
    const r = runCli(['--check', '--root', fixture('long')])
    expect(r.code).toBe(1)
    expect(r.out).toContain('docs/recipes/sample.md')
    expect(r.out).toContain('16 prose lines')
  })

  test('orphan: exits 1 naming the region file and the missing doc', () => {
    const r = runCli(['--check', '--root', fixture('orphan')])
    expect(r.code).toBe(1)
    expect(r.out).toContain(SOURCE)
    expect(r.out).toContain('region recipe:sample has no doc')
  })
})

describe('recipes drift — rules', () => {
  test('prose at exactly 15 lines passes, 16 fails', () => {
    expect(reasons(scratch({ prose: MAX_PROSE_LINES }))).toEqual([])
    expect(reasons(scratch({ prose: MAX_PROSE_LINES + 1 }))).toEqual([
      `${MAX_PROSE_LINES + 1} prose lines, the limit is ${MAX_PROSE_LINES}`,
    ])
  })

  test('a doc over 60 lines fails', () => {
    const fence = Array.from({ length: MAX_RECIPE_LINES }, (_, i) => `const v${i} = ${i}`)
    const root = scratch({ fence })
    writeFileSync(
      join(root, SOURCE),
      ['// #region recipe:sample', ...fence, '// #endregion', ''].join('\n'),
    )
    expect(reasons(root).join('\n')).toContain(`the limit is ${MAX_RECIPE_LINES}`)
  })

  test.each(['name', 'use-when', 'file'])('a missing %s frontmatter key fails', (key) => {
    const all = ['name: sample', 'use-when: a greeting helper', `file: ${SOURCE}`]
    const root = scratch({ frontmatter: all.filter((l) => !l.startsWith(`${key}:`)) })
    expect(reasons(root)).toContain(`frontmatter key missing: ${key}`)
  })

  test('"use when" is accepted as the key spelling', () => {
    const root = scratch({
      frontmatter: ['name: sample', 'use when: a greeting helper', `file: ${SOURCE}`],
    })
    expect(reasons(root)).toEqual([])
  })

  test('a renamed region fails as missing or renamed, and its new name as an orphan', () => {
    const root = scratch({})
    writeFileSync(
      join(root, SOURCE),
      ['// #region recipe:renamed', ...REGION, '// #endregion', ''].join('\n'),
    )
    const found = reasons(root)
    expect(found).toContain(`region recipe:sample missing or renamed in ${SOURCE}`)
    expect(found.some((r) => r.startsWith('region recipe:renamed has no doc'))).toBe(true)
  })

  test('a doc pointing at a missing file fails', () => {
    const root = scratch({ frontmatter: ['name: sample', 'use-when: x', 'file: apps/nope.ts'] })
    expect(reasons(root)).toContain('file apps/nope.ts does not exist')
  })

  test('more than 32 recipes fails', () => {
    const root = scratch({})
    const doc = readFileSync(join(root, 'docs', 'recipes', 'sample.md'), 'utf8')
    for (let i = 0; i < MAX_RECIPES; i++) {
      writeFileSync(join(root, 'docs', 'recipes', `extra-${i}.md`), doc)
    }
    expect(reasons(root)).toContain(`${MAX_RECIPES + 1} recipes, the budget is ${MAX_RECIPES}`)
  })

  test('the default mode rewrites a drifted fence and a second run changes nothing', () => {
    const root = join(mkdtempSync(join(tmpdir(), 'recipes-')), 'drift')
    temps.push(root)
    cpSync(fixture('drift'), root, { recursive: true })
    expect(writeRecipes(roots(root))).toEqual(['docs/recipes/sample.md'])
    expect(checkRecipes(roots(root))).toEqual([])
    expect(writeRecipes(roots(root))).toEqual([])
  })
})
