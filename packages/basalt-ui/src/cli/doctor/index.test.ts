import { afterEach, describe, expect, it } from 'bun:test'

import type { Profile } from '../manifest'
import { cleanupTrees, commitTree, HEALTHY, makeTree } from './fixture.test'
import { buildContext, doctor, runChecks } from './index'

afterEach(cleanupTrees)

const PROFILES: Profile[] = ['tokens', 'bridge', 'parts', 'app']

/** `doctor` with both console streams captured. */
async function capture(dir: string, flags: string[] = []): Promise<{ code: number; log: string }> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: await doctor(dir, flags, HEALTHY), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

describe('doctor on a healthy tree', () => {
  it.each(PROFILES)('profile %s passes all twelve checks', async (profile) => {
    const dir = makeTree(profile)
    commitTree(dir)
    const results = await runChecks(buildContext(dir, HEALTHY))
    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(results.filter((r) => r.status !== 'pass')).toEqual([])
  })

  it('exits 0, prints where docs/ and llms.txt resolve, and the closing line', async () => {
    const dir = makeTree('app')
    commitTree(dir)
    const { code, log } = await capture(dir)
    expect(code).toBe(0)
    expect(log).toContain('docs/ resolves at')
    expect(log).toContain('All 12 checks passed.')
  })
})

describe('doctor reports what it could not check', () => {
  it('a missing manifest fails check 1 and SKIPS every check that needs it, exiting 1', async () => {
    const dir = makeTree('app', { '.basalt/manifest.json': null })
    const { code, log } = await capture(dir)
    expect(code).toBe(1)
    expect(log).toContain('✖ 1 manifest')
    expect(log).toContain('⚠ SKIPPED 4 preset')
    expect(log).not.toContain('All 12 checks passed.')
  })

  it('a v2 manifest with no profile fails and names the migrate verb', async () => {
    const dir = makeTree('app', { '.basalt/manifest.json': '{"version":2,"managed":{}}' })
    const { code, log } = await capture(dir)
    expect(code).toBe(1)
    expect(log).toContain('basalt-ui migrate --from')
  })

  it('a check that throws is SKIPPED, never a pass', async () => {
    const dir = makeTree('app', { '.basalt/hook.mjs': null })
    const results = await runChecks(buildContext(dir, { ...HEALTHY, pkgRoot: '/nonexistent' }), [4])
    expect(results[0]?.status).toBe('skipped')
  })
})

describe('doctor --from', () => {
  it('only points at MIGRATING.md and still runs the checks', async () => {
    const dir = makeTree('tokens')
    commitTree(dir)
    const { code, log } = await capture(dir, ['--from', '2.20.0'])
    expect(log).toContain('MIGRATING.md')
    expect(code).toBe(0)
  })
})
