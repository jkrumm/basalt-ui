import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dirname, 'check-playground-lint.ts')
const dirs: string[] = []

/** A project dir whose `src` holds `files`, run through the script. */
function run(files: Record<string, string>): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'check-playground-lint-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'src'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, 'src', name), text)
  const result = Bun.spawnSync(['bun', SCRIPT, dir], { stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, stdout: result.stdout.toString() }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('check-playground-lint', () => {
  test('a shipped token passes', () => {
    expect(run({ 'a.tsx': "export const c = 'var(--basalt-warn)'\n" }).code).toBe(0)
  })

  test('an unknown --basalt-* name fails with the nearest token', () => {
    const { code, stdout } = run({ 'a.tsx': "export const c = 'var(--basalt-warning)'\n" })
    expect(code).toBe(1)
    expect(stdout).toContain('--basalt-warning is not a token. Did you mean --basalt-warn?')
  })

  test('a hex color in a stylesheet fails the stylelint preset', () => {
    const { code, stdout } = run({ 'a.css': '.x { color: #fff; }\n' })
    expect(code).toBe(1)
    expect(stdout).toContain('stylelint/color-no-hex')
  })
})
