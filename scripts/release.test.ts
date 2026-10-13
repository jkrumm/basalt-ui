/**
 * `release.sh`'s major gate, sourced through `RELEASE_SH_LIB=1` so nothing is dispatched: the one
 * sanctioned 2.0.0 passes once; every other major dies.
 */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

const script = join(import.meta.dirname, 'release.sh')
const BEFORE = '1.40.2\n1.41.0'
const AFTER = '1.41.0\n2.0.0'

function gate(bump: string, version: string, registry: string): boolean {
  return Bun.spawnSync(
    [
      'bash',
      '-c',
      `RELEASE_SH_LIB=1 source "${script}"; version_gate "${bump}" "${version}" "${registry}"`,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  ).success
}

describe('version_gate', () => {
  it('lets non-majors through', () => {
    expect(gate('minor', '1.42.0', BEFORE)).toBe(true)
    expect(gate('patch', '2.0.1', AFTER)).toBe(true)
  })

  it('allows 2.0.0 exactly once, while the registry has no 2.x', () => {
    expect(gate('major', '2.0.0', BEFORE)).toBe(true)
    expect(gate('major', '2.0.0', AFTER)).toBe(false) // a second 2.0.0
  })

  it.each([
    ['3.0.0', BEFORE],
    ['3.0.0', AFTER],
    ['2.1.0', BEFORE], // a "major" that is not 2.0.0
  ])('refuses major → %s', (version, registry) => {
    expect(gate('major', version, registry)).toBe(false)
  })
})

describe('a direct run ignores a stray RELEASE_SH_LIB', () => {
  it('still parses its mode argument (usage error, exit 2) instead of silently returning', () => {
    const result = Bun.spawnSync(['bash', script, 'bogus'], {
      env: { ...process.env, RELEASE_SH_LIB: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(result.exitCode).toBe(2)
  })
})
