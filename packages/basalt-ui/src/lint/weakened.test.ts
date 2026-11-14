/**
 * The weakened-guard checks over fixture configs, one per bypass. Check 1 runs the real oxlint
 * against a stand-in preset (native `no-console`), so a dropped extends, an ignore pattern, an
 * `.oxlintignore` and a per-glob override are proven by behaviour. An emptied `jsPlugins` cannot
 * be reproduced without the plugin build, so it runs through an injected runner.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkWeakenedConfig, DEFAULT_OFFENDER, SEEDED_FILE, oxlintRunner } from './weakened'
import type { Offender, WeakenedResult } from './weakened'

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/lint/weakened/', import.meta.url))
const BIN = resolve(fileURLToPath(new URL('../../../../node_modules/.bin', import.meta.url)))
const OFFENDER: Offender = {
  content: 'console.log(1)\n',
  fired: (id) => id === 'eslint/no-console',
}
const PIN = '1.93.0'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function fixture(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-weakened-'))
  dirs.push(dir)
  cpSync(join(FIXTURES, name), dir, { recursive: true })
  return dir
}

const run = (dir: string, extra: Partial<Parameters<typeof checkWeakenedConfig>[0]> = {}) =>
  checkWeakenedConfig({
    dir,
    roots: ['src'],
    offender: OFFENDER,
    oxlintPin: PIN,
    installedOxlint: PIN,
    baseRef: null,
    runLint: oxlintRunner(join(BIN, 'oxlint')),
    ...extra,
  })

const status = (results: WeakenedResult[], check: number) => results[check - 1]?.status

describe('checkWeakenedConfig', () => {
  it('a healthy config passes checks 1-4 and skips 5 without a base ref', async () => {
    const results = await run(fixture('healthy'))
    expect(results.map((r) => r.status)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
      'skipped',
    ])
  })

  it('a dropped extends fails checks 1 and 2', async () => {
    const results = await run(fixture('dropped-extends'))
    expect(status(results, 1)).toBe('failed')
    expect(status(results, 2)).toBe('failed')
    expect(results[1]?.name).toBe('extends')
  })

  it('a widened ignorePatterns fails the seeded offender', async () => {
    const results = await run(fixture('ignore-patterns'))
    expect(status(results, 1)).toBe('failed')
    expect(status(results, 2)).toBe('passed')
  })

  it('an .oxlintignore fails the seeded offender', async () => {
    expect(status(await run(fixture('oxlintignore')), 1)).toBe('failed')
  })

  it('a per-glob override turning the rule off fails the seeded offender', async () => {
    expect(status(await run(fixture('override-off')), 1)).toBe('failed')
  })

  it('an emptied jsPlugins fails when the plugin rule stops firing', async () => {
    const dir = fixture('emptied-js-plugins')
    const results = await run(dir, { runLint: () => [] })
    expect(status(results, 1)).toBe('failed')
    expect(results[0]?.name).toBe('seeded-offender')
  })

  it('a managed id in an override fails check 3', async () => {
    const results = await run(fixture('managed-rule'))
    expect(status(results, 3)).toBe('failed')
    expect(results[2]?.detail).toContain('basalt/primitive-bypass')
  })

  it('a wrong oxlint pin fails check 4', async () => {
    const results = await run(fixture('healthy'), { installedOxlint: '1.83.0' })
    expect(status(results, 4)).toBe('failed')
    expect(results[3]?.name).toBe('oxlint-pin')
  })

  it('an unreadable oxlint version is skipped, not passed', async () => {
    expect(status(await run(fixture('healthy'), { installedOxlint: null }), 4)).toBe('skipped')
  })

  it('removes the seeded offender when runLint throws', async () => {
    const dir = fixture('healthy')
    let seen = ''
    const results = await run(dir, {
      runLint: (file) => {
        seen = file
        expect(existsSync(file)).toBe(true)
        throw new Error('boom')
      },
    })
    expect(seen.endsWith(SEEDED_FILE)).toBe(true)
    expect(existsSync(seen)).toBe(false)
    expect(status(results, 1)).toBe('failed')
  })

  it('seeds every declared root', async () => {
    const dir = fixture('healthy')
    mkdirSync(join(dir, 'other'))
    const seeded: string[] = []
    await run(dir, {
      roots: ['src', 'other'],
      runLint: (file) => {
        seeded.push(file)
        return ['eslint/no-console']
      },
    })
    expect(seeded).toHaveLength(2)
  })

  it('a missing oxlint install reads as an unknown version, skipped', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'basalt-weakened-'))
    dirs.push(dir)
    writeFileSync(join(dir, '.oxlintrc.json'), '{}')
    const results = await checkWeakenedConfig({ dir, roots: [], oxlintPin: PIN, baseRef: null })
    expect(status(results, 4)).toBe('skipped')
  })

  it('the default offender is a colour literal', () => {
    expect(DEFAULT_OFFENDER.content).toContain('#')
  })

  it('the default runner reports oxlint codes as ids', async () => {
    const dir = fixture('healthy')
    const file = join(dir, 'src', 'x.ts')
    writeFileSync(file, 'console.log(1)\n')
    expect(await oxlintRunner(join(BIN, 'oxlint'))(file, dir)).toContain('eslint/no-console')
  })
})

const budget = (ejects: number, waivers: number) =>
  `${JSON.stringify({ ejects, adopted: 0, waivers, escapes: 3, profileFloor: 'app', raises: [] }, null, 2)}\n`

function repo(base: [number, number] | null, current: [number, number]): string {
  const dir = fixture('healthy')
  const git = (...args: string[]) => {
    const r = Bun.spawnSync(['git', '-C', dir, ...args], { stderr: 'pipe' })
    if (r.exitCode !== 0) throw new Error(r.stderr.toString())
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@example.com')
  git('config', 'user.name', 't')
  mkdirSync(join(dir, '.basalt'))
  if (base) writeFileSync(join(dir, '.basalt/budget.json'), budget(...base))
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  writeFileSync(join(dir, '.basalt/budget.json'), budget(...current))
  return dir
}

describe('budget ratchet (check 5)', () => {
  it('passes when the ceilings did not rise', async () => {
    const results = await run(repo([3, 5], [3, 4]), { baseRef: 'main' })
    expect(status(results, 5)).toBe('passed')
  })

  it('fails when a ceiling was raised against the base ref', async () => {
    const results = await run(repo([3, 5], [3, 6]), { baseRef: 'main' })
    expect(status(results, 5)).toBe('failed')
    expect(results[4]?.detail).toContain('waivers 6 > 5')
  })

  it('fails when escapes were raised', async () => {
    const dir = repo([3, 0], [3, 0])
    writeFileSync(
      join(dir, '.basalt/budget.json'),
      budget(3, 0).replace('"escapes": 3', '"escapes": 30'),
    )
    const results = await run(dir, { baseRef: 'main' })
    expect(status(results, 5)).toBe('failed')
    expect(results[4]?.detail).toContain('escapes 30 > 3')
  })

  it('fails when ejects were raised', async () => {
    expect(status(await run(repo([3, 0], [4, 0]), { baseRef: 'main' }), 5)).toBe('failed')
  })

  it('passes on the first landing, when the base holds no copy', async () => {
    expect(status(await run(repo(null, [3, 9]), { baseRef: 'main' }), 5)).toBe('passed')
  })

  it('skips when the base ref does not resolve', async () => {
    expect(status(await run(repo([3, 0], [3, 0]), { baseRef: 'origin/nope' }), 5)).toBe('skipped')
  })
})
