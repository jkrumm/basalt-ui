/**
 * `release.sh`'s pure rules, sourced (not run) so nothing is dispatched: the
 * version gate (stable non-major 2.x only).
 */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

const script = join(import.meta.dirname, 'release.sh')

type Run = { exitCode: number; stdout: string; stderr: string }

/** Runs `body` after sourcing release.sh; values arrive as positional args, never interpolated. */
function run(body: string, ...args: string[]): Run {
  const result = Bun.spawnSync(
    ['bash', '-c', `source "$1"; shift; ${body}`, '_', script, ...args],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString(),
  }
}

const gate = (bump: string, version: string): Run => run('version_gate "$@"', bump, version)

describe('version_gate', () => {
  it.each<[string, string]>([
    ['minor', '2.8.0'],
    ['patch', '2.7.4'],
    ['minor', '2.10.0'],
    ['patch', '2.7.10'],
  ])('allows %s → %s', (bump, version) => {
    expect(gate(bump, version).exitCode).toBe(0)
  })

  it.each<[string, string]>([
    ['major', '3.0.0'],
    ['major', '2.0.0'], // a second 2.0.0
    ['major', '2.8.0'], // a major bump is refused whatever version it computes
  ])('refuses %s → %s with the remedy', (bump, version) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('no majors')
    expect(result.stderr).toContain('MIGRATING.md')
  })

  it.each<[string, string]>([
    ['patch', '1.41.1'],
    ['minor', '1.42.0'],
    ['minor', '2.8.0-rc.1'],
    ['patch', '2.7.4+build.5'],
  ])('refuses %s → %s as not a stable 2.x', (bump, version) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('only stable 2.x')
    expect(result.stderr).not.toContain('MIGRATING.md')
  })
})

describe('version_gate — fails closed', () => {
  it.each<[string, string, string]>([
    ['', '2.0.0', 'unparsed bump'],
    ['unknown', '2.0.0', 'unparsed bump'],
    ['major', '', 'no computed version'],
  ])('refuses bump %p version %p', (bump, version, reason) => {
    const result = gate(bump, version)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(reason)
  })
})

describe('sourcing and direct runs', () => {
  it('sourcing leaves errexit, nounset and pipefail off', () => {
    const result = run('[[ $- != *e* && $- != *u* ]] && ! shopt -oq pipefail && echo clean')
    expect(result.stdout).toBe('clean')
  })

  it('a direct run still parses its mode argument (usage error, exit 2)', () => {
    const result = Bun.spawnSync(['bash', script, 'bogus'], { stdout: 'pipe', stderr: 'pipe' })
    expect(result.exitCode).toBe(2)
  })
})
