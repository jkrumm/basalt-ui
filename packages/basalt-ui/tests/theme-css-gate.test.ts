/**
 * Runs `scripts/check-theme-css.ts` (the consolidated CSS-scan gates — shadow-surface coverage,
 * border coverage, ctl-tier var coverage, layout-rhythm regressions) as a subprocess and asserts
 * exit 0, so `bun test` still covers all four sections without re-implementing their scans inline.
 * See that script for what each section checks and why it moved out of `src/theme/*.test.ts` (C2).
 *
 * Run: bun test packages/basalt-ui/tests/theme-css-gate.test.ts
 */
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'

const PKG_ROOT = resolve(import.meta.dir, '..')
const SCRIPT_PATH = resolve(PKG_ROOT, 'scripts/check-theme-css.ts')

describe('check-theme-css', () => {
  it('exits 0 against the live source tree', () => {
    const result = Bun.spawnSync(['bun', SCRIPT_PATH], { cwd: PKG_ROOT })
    if (result.exitCode !== 0) {
      console.error(result.stdout.toString())
      console.error(result.stderr.toString())
    }
    expect(result.exitCode).toBe(0)
  })
})
