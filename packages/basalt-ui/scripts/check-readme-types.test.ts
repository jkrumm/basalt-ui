import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractBlocks } from './check-readme-types'

const SCRIPT = join(import.meta.dirname, 'check-readme-types.ts')
const dirs: string[] = []

function run(...args: string[]): { code: number; stderr: string } {
  const result = Bun.spawnSync(['bun', SCRIPT, ...args], { stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, stderr: result.stderr.toString() }
}

function readme(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-readme-types-'))
  dirs.push(dir)
  const file = join(dir, 'README.md')
  writeFileSync(file, text)
  return file
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('extractBlocks', () => {
  test('takes ts and tsx fences, with the line of their first code line', () => {
    const blocks = extractBlocks(
      '# T\n\n```tsx\nconst a = 1\n```\n\n```bash\nls\n```\n\n```ts\nb\n```\n',
    )
    expect(blocks).toEqual([
      { line: 4, lang: 'tsx', code: 'const a = 1' },
      { line: 12, lang: 'ts', code: 'b' },
    ])
  })

  test('a skip marker with a reason drops the block under it', () => {
    const md = '<!-- readme-check: skip init writes it -->\n```tsx\nx\n```\n'
    expect(extractBlocks(md)).toEqual([])
  })

  test('a skip with no reason is an error', () => {
    expect(() => extractBlocks('<!-- readme-check: skip -->\n```ts\nx\n```\n')).toThrow('reason')
  })
})

describe('check-readme-types', () => {
  test('the package README type-checks', () => {
    expect(run().code).toBe(0)
  })

  test('a block that does not type-check fails and names its README line', () => {
    const file = readme("# T\n\n```ts\nexport const mode: 'client' | 'server' = 'edge'\n```\n")
    const { code, stderr } = run(file)
    expect(code).toBe(1)
    expect(stderr).toContain('README line 4')
  })

  test('a block that type-checks passes', () => {
    expect(
      run(readme("```ts\nexport const mode: 'client' | 'server' = 'client'\n```\n")).code,
    ).toBe(0)
  })
})
