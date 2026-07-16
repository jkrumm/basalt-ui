/**
 * Exercises gen-llms.ts's `--check` DRIFT path directly (llms-sync.test.ts only checks that the
 * committed file matches the generator output — it never proves the `--check` flag actually
 * fails when the two diverge). Spawns the real script as a subprocess against the real committed
 * `llms.txt`, temporarily corrupting it and restoring it byte-exact in a `finally` block.
 *
 * Run: bun test packages/basalt-ui/tests/gen-llms-check.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { outPath } from '../scripts/gen-llms'

const SCRIPT_PATH = join(import.meta.dir, '..', 'scripts/gen-llms.ts')

describe('gen-llms --check drift gate', () => {
  it('exits 0 when the committed llms.txt is in sync', () => {
    const result = Bun.spawnSync(['bun', SCRIPT_PATH, '--check'])
    expect(result.exitCode).toBe(0)
  })

  it('exits non-zero and reports drift when llms.txt is mutated, then restores byte-exact', () => {
    const original = readFileSync(outPath, 'utf8')
    try {
      writeFileSync(outPath, `${original}\nSTALE DRIFT MARKER\n`, 'utf8')

      const result = Bun.spawnSync(['bun', SCRIPT_PATH, '--check'])
      const stderr = result.stderr.toString()

      expect(result.exitCode).not.toBe(0)
      expect(stderr).toContain('out of sync')
    } finally {
      writeFileSync(outPath, original, 'utf8')
    }

    // Restoration must be byte-exact — re-run --check against the restored file to prove it.
    expect(readFileSync(outPath, 'utf8')).toBe(original)
    const restoredCheck = Bun.spawnSync(['bun', SCRIPT_PATH, '--check'])
    expect(restoredCheck.exitCode).toBe(0)
  })
})
