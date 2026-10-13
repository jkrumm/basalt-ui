/**
 * `release.sh`'s pure rules, sourced (not run) so nothing is dispatched: the
 * version gate (1.x frozen, the one sanctioned 2.0.0, then 2.x non-majors) and the registry reads.
 */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

const script = join(import.meta.dirname, 'release.sh')

type Run = { exitCode: number; stdout: string; stderr: string }

/** Runs `body` after sourcing release.sh; values arrive as positional args, never interpolated. */
function run(body: string, ...args: string[]): Run {
  return runWith({}, body, ...args)
}

function runWith(env: Record<string, string>, body: string, ...args: string[]): Run {
  const result = Bun.spawnSync(
    ['bash', '-c', `source "$1"; shift; ${body}`, '_', script, ...args],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, REGISTRY_RETRY_SLEEP: '0', REGISTRY_READ_TIMEOUT: '0', ...env },
    },
  )
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString(),
  }
}

const gate = (bump: string, version: string, registry: string): Run =>
  run('version_gate "$@"', bump, version, registry)

const BEFORE = '1.40.2\n1.41.0'
const AFTER = '1.41.0\n2.0.0'

describe('version_gate — before any 2.x is published', () => {
  it.each<[string, string, string]>([
    ['empty registry', '', '2.0.0'], // nothing published at all
    ['2.0.0-rc.1 is not a 2.x final', '1.41.0\n2.0.0-rc.1', '2.0.0'],
    ['build metadata is not a 2.x final', '1.41.0\n2.0.0+build.5', '2.0.0'],
    ['plain registry', BEFORE, '2.0.0'],
  ])('allows 2.0.0 — %s', (_name, registry, version) => {
    expect(gate('major', version, registry).exitCode).toBe(0)
  })

  it.each<[string, string, string, string]>([
    ['patch', '1.41.1', 'frozen at v1.41.0', BEFORE],
    ['minor', '1.42.0', 'frozen at v1.41.0', BEFORE],
    ['major', '3.0.0', 'only 2.0.0 is releasable', BEFORE],
    ['minor', '2.1.0', 'only 2.0.0 is releasable', BEFORE],
  ])('refuses %s → %s', (bump, version, reason, registry) => {
    const result = gate(bump, version, registry)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(reason)
  })
})

describe('version_gate — once a 2.x is published', () => {
  it.each<[string, string]>([
    ['minor', '2.1.0'],
    ['patch', '2.0.1'],
  ])('allows %s → %s', (bump, version) => {
    expect(gate(bump, version, AFTER).exitCode).toBe(0)
  })

  it.each<[string, string, string]>([
    ['major', '2.0.0', 'a 2.x is published'], // a second 2.0.0
    ['major', '3.0.0', 'a 2.x is published'],
    ['patch', '1.41.1', 'frozen at v1.41.0'],
    ['minor', '1.42.0', 'frozen at v1.41.0'],
  ])('refuses %s → %s', (bump, version, reason) => {
    const result = gate(bump, version, AFTER)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(reason)
  })
})

describe('versions_from_json', () => {
  const parse = (json: string): Run => run('versions_from_json <<<"$1"', json)

  it('reads an array, and the bare string npm prints for a single version', () => {
    expect(parse('["1.40.2","1.41.0"]').stdout).toBe('1.40.2\n1.41.0')
    expect(parse('"1.41.0"').stdout).toBe('1.41.0')
  })

  it.each(['{"versions":["2.0.0"]}', '[1,2]', '[]', 'not json', ''])('fails on %p', (json) => {
    expect(parse(json).exitCode).not.toBe(0)
  })
})

describe('version_gate — fails closed', () => {
  it.each<[string, string, string]>([
    ['', '2.0.0', 'unparsed bump'],
    ['unknown', '2.0.0', 'unparsed bump'],
    ['major', '', 'no computed version'],
  ])('refuses bump %p version %p', (bump, version, reason) => {
    const result = gate(bump, version, BEFORE)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(reason)
  })
})

describe('registry_versions', () => {
  it('retries a transient failure and then returns the versions', () => {
    // The stub runs in a command substitution, so its attempt counter lives in a file.
    const flaky = [
      'count=$(mktemp)',
      'npm() { echo x >>"$count"; if [ "$(wc -l <"$count")" -lt 2 ]; then echo ETIMEDOUT >&2; return 1; fi; echo \'["1.41.0","2.0.0"]\'; }',
      'registry_versions',
    ].join('; ')
    const result = runWith({ REGISTRY_READ_TIMEOUT: '5' }, flaky)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('1.41.0\n2.0.0')
  })

  it('exits 1 and surfaces the last npm error when the registry stays unreadable', () => {
    const result = run('npm() { echo "ECONNRESET" >&2; return 1; }; registry_versions')
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('registry read failed: ECONNRESET')
  })

  it('fails when npm answers with an object', () => {
    expect(run('npm() { echo "{}"; }; registry_versions').exitCode).toBe(1)
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
