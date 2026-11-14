/**
 * CLI discipline invariants 1-8 (docs/v3/concepts/skills-agent-layer.md section 6, "CLI discipline").
 * Each was paid for by a defect: a skipped check read as passed, a bunx shim, a zero-file scan.
 * A test the skeleton cannot pass yet is `it.failing` with a `flips in: <key>` comment; the owner
 * removes `.failing` in its own change, and the runner turns red if it forgets once the test passes.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanupRepos, cli, filesUnder, makeRepo, PKG_ROOT, read, snapshot, write } from './support'

afterEach(cleanupRepos)

describe('CLI discipline', () => {
  it('inv 1: an unknown flag exits 1 and names it, `--help` mutates nothing, `lint --hook` fails with 2', async () => {
    const dir = makeRepo()
    const before = snapshot(dir)
    for (const verb of ['sync', 'init', 'doctor', 'lint']) {
      const help = await cli([verb, '--help'], dir)
      expect(help.code).toBe(0)
    }
    expect(snapshot(dir)).toEqual(before)

    const bad = await cli(['doctor', '--bogus'], dir)
    expect(bad.code).toBe(1)
    expect(bad.log).toContain('--bogus')

    // The hook shim maps every failure to exit 2 so a broken hook never reads as a pass.
    const hook = await cli(['lint', '--hook', 'post-edit', '--bogus'], dir)
    expect(hook.code).toBe(2)
    expect(hook.log).toContain('--bogus')
  })

  // Already held by the 2.x doctor; v3-sk-3a-doctor must keep it.
  it('inv 2: a check that cannot run is SKIPPED, exits non-zero and never prints a pass', async () => {
    const dir = makeRepo({
      '.basalt/manifest.json': JSON.stringify({ version: 2, profile: 'app', managed: {} }),
    })
    const { code, log } = await cli(['doctor'], dir)
    expect(log).not.toContain('All checks passed')
    expect(log).toMatch(/SKIPPED/)
    expect(code).not.toBe(0)
  })

  it('inv 3: BASALT_CWD, else cwd, resolves the project for sync', async () => {
    const dir = makeRepo({ src: '' })
    const elsewhere = makeRepo()
    const { log } = await cli(['sync', '--check'], elsewhere, { BASALT_CWD: dir })
    expect(log).toContain(`BASALT_CWD relocated from ${elsewhere} to ${dir}`)
  })

  it('inv 3b: BASALT_CWD resolves the project for doctor and lint alike', async () => {
    const dir = makeRepo({ src: '' })
    const elsewhere = makeRepo()
    for (const argv of [['doctor'], ['lint', '--stats']]) {
      const { log } = await cli(argv, elsewhere, { BASALT_CWD: dir })
      expect(log).toContain(`BASALT_CWD relocated from ${elsewhere} to ${dir}`)
    }
  })

  it('inv 4: a scan over zero files fails instead of passing, and says how many it scanned', async () => {
    const empty = makeRepo({
      'package.json': JSON.stringify({ name: 'x', basalt: { roots: ['src'] } }),
    })
    const none = await cli(['lint', '--stats'], empty)
    expect(none.code).toBe(1)
    expect(none.log).toMatch(/scanned 0 files|0 files/)

    const some = makeRepo({
      'package.json': JSON.stringify({ name: 'x', basalt: { roots: ['src'] } }),
      'src/a.tsx': 'export const a = 1\n',
    })
    const ok = await cli(['lint', '--stats'], some)
    expect(ok.log).toMatch(/scanned 1 file/)
  })

  it('inv 5: the profile is declared, never inferred', async () => {
    const dir = makeRepo({ 'src/a.tsx': "import { Button } from 'basalt-ui/ui'\n" })
    const before = snapshot(dir)
    const bare = await cli(['init', '--no-install'], dir)
    expect(bare.code).toBe(1)
    expect(bare.log).toContain('--profile')
    expect(snapshot(dir)).toEqual(before)

    const declared = await cli(['init', '--no-install', '--profile', 'tokens'], dir)
    expect(declared.code).toBe(0)
    expect(JSON.parse(read(dir, '.basalt/manifest.json')).profile).toBe('tokens')
  })

  it('inv 6: every rendered command runs the local bin, never bunx or npx', async () => {
    const dir = makeRepo()
    await cli(['init', '--no-install', '--profile', 'app'], dir)
    expect(existsSync(join(dir, '.basalt/hook.mjs'))).toBe(true)
    const rendered = filesUnder(dir).filter((f) => !f.includes('/.git/') && !f.endsWith('.png'))
    for (const file of rendered) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/\b(bunx|npx|pnpm dlx)\s+(--\S+\s+)*basalt-ui/)
    }
    expect(read(dir, '.basalt/hook.mjs')).toContain('node_modules/.bin/basalt-ui')
  })

  it('inv 7: the bin is named like the package, and the rendered shim resolves that name', async () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      name: string
      bin: Record<string, string>
    }
    expect(Object.keys(pkg.bin)).toEqual([pkg.name])
    const dir = makeRepo()
    await cli(['init', '--no-install', '--profile', 'app'], dir)
    const shim = read(dir, '.basalt/hook.mjs')
    expect(shim).toContain(`.bin/${pkg.name}`)
    expect(shim).not.toMatch(/\.bin\/basalt['"\s`]/)
  })

  it('inv 8: sync never creates an install: it refuses, names init, and writes nothing', async () => {
    const dir = makeRepo()
    write(dir, 'AGENTS.md', '# host\n')
    const before = snapshot(dir)
    for (const argv of [['sync'], ['sync', '--check']]) {
      const { code, log } = await cli(argv, dir)
      expect(code).toBe(1)
      expect(log).toContain('basalt-ui init --profile')
    }
    expect(snapshot(dir)).toEqual(before)
  })
})
