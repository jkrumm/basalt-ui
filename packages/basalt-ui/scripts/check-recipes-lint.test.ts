import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dirname, 'check-recipes-lint.ts')
const dirs: string[] = []

function run(...paths: string[]): { code: number; stdout: string } {
  const result = Bun.spawnSync(['bun', SCRIPT, ...paths], { stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, stdout: result.stdout.toString() }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('check-recipes-lint', () => {
  test('the shipped recipe files lint clean under the app preset', () => {
    expect(run().code).toBe(0)
  })

  test('a raw <button> in a recipe file fails the step', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-recipes-lint-'))
    dirs.push(dir)
    const file = join(dir, 'seed.tsx')
    writeFileSync(file, 'export const Seed = () => <button type="button">x</button>\n')
    const { code, stdout } = run(file)
    expect(code).toBe(1)
    expect(stdout).toContain('primitive-bypass')
  })
})
