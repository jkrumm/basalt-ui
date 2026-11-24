/**
 * The weakened-guard checks over fixture configs, one per bypass. Check 1 runs the real oxlint
 * against a stand-in preset (native `no-console`), so a dropped extends, an ignore pattern, an
 * `.oxlintignore` and a per-glob override are proven by behaviour. An emptied `jsPlugins` cannot
 * be reproduced without the plugin build, so it runs through an injected runner.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
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

/** A healthy install with one source file added under its `src` root. */
function withFile(source: string, name = 'screen.tsx'): string {
  const dir = fixture('healthy')
  writeFileSync(join(dir, 'src', name), source)
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
  it('a healthy config passes all five checks; outside a git repo the ratchet passes and names `git init`', async () => {
    const results = await run(fixture('healthy'))
    expect(results.map((r) => r.status)).toEqual(['passed', 'passed', 'passed', 'passed', 'passed'])
    expect(results[4]?.detail).toContain('git init')
    expect(results[4]?.detail).not.toContain('fetch')
  })

  it('passes the ratchet on a repo with no remote and names the refs it tried', async () => {
    const dir = fixture('healthy')
    Bun.spawnSync(['git', '-C', dir, 'init', '-q'])
    const results = await run(dir, { triedRefs: ['origin/HEAD', 'origin/main'] })
    expect(status(results, 5)).toBe('passed')
    expect(results[4]?.detail).toContain('tried origin/HEAD, origin/main')
  })

  it('skips, never passes, when git fails inside a directory that has a .git entry', async () => {
    const dir = fixture('healthy')
    mkdirSync(join(dir, '.git'))
    const results = await run(dir)
    expect(status(results, 5)).toBe('skipped')
    expect(results[4]?.detail).not.toContain('git init')
  })

  it('skips the ratchet when a remote exists but no base ref resolves (a shallow checkout)', async () => {
    const dir = fixture('healthy')
    Bun.spawnSync(['git', '-C', dir, 'init', '-q'])
    Bun.spawnSync(['git', '-C', dir, 'remote', 'add', 'origin', 'https://example.invalid/x.git'])
    const results = await run(dir)
    expect(status(results, 5)).toBe('skipped')
    expect(results[4]?.detail).toContain('tried origin/HEAD, origin/main, origin/master')
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

  describe('a guard switched off for a subtree (check 1 seeds every directory)', () => {
    /** A healthy install with `src/features/screen.tsx`, so the subtree is a directory with a source file. */
    function withFeatures(): string {
      const dir = fixture('healthy')
      mkdirSync(join(dir, 'src/features'), { recursive: true })
      writeFileSync(join(dir, 'src/features/screen.tsx'), 'export const a = 1\n')
      return dir
    }

    it('passes a healthy tree with a subdirectory', async () => {
      expect(status(await run(withFeatures()), 1)).toBe('passed')
    })

    it('ignorePatterns on a subdirectory fails, naming the directory and the config', async () => {
      const dir = withFeatures()
      writeFileSync(
        join(dir, '.oxlintrc.json'),
        JSON.stringify({
          extends: ['./.oxlintrc.basalt.json'],
          ignorePatterns: ['src/features/**'],
        }),
      )
      const results = await run(dir)
      expect(status(results, 1)).toBe('failed')
      expect(results[0]?.detail).toContain('src/features: the guard is off here')
      expect(results[0]?.detail).toContain('ignorePatterns')
    })

    it('a nested .oxlintrc.json without the preset fails checks 1 and 3', async () => {
      const dir = withFeatures()
      writeFileSync(join(dir, 'src/features/.oxlintrc.json'), '{}')
      const results = await run(dir)
      expect(status(results, 1)).toBe('failed')
      expect(results[0]?.detail).toContain('src/features/.oxlintrc.json')
      expect(status(results, 3)).toBe('failed')
      expect(results[2]?.detail).toContain('src/features/.oxlintrc.json')
    })

    it('a nested .oxlintrc.json that extends the preset passes check 3', async () => {
      const dir = withFeatures()
      writeFileSync(
        join(dir, 'src/features/.oxlintrc.json'),
        JSON.stringify({ extends: ['../../.oxlintrc.basalt.json'] }),
      )
      expect(status(await run(dir), 3)).toBe('passed')
    })

    it('a declared root that is a file fails with a named reason instead of crashing', async () => {
      const dir = withFeatures()
      const results = await run(dir, { roots: ['src/features/screen.tsx'] })
      expect(status(results, 1)).toBe('failed')
      expect(results[0]?.detail).toContain('must be a directory')
    })
  })

  describe('the default runner', () => {
    it('resolves the project binary, not a bare oxlint on PATH', async () => {
      const dir = fixture('healthy')
      mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
      symlinkSync(join(BIN, 'oxlint'), join(dir, 'node_modules/.bin/oxlint'))
      const path = process.env['PATH']
      process.env['PATH'] = (path ?? '')
        .split(':')
        .filter((p) => !p.includes('node_modules/.bin'))
        .join(':')
      try {
        const results = await checkWeakenedConfig({
          dir,
          roots: ['src'],
          offender: OFFENDER,
          oxlintPin: PIN,
          installedOxlint: PIN,
          baseRef: null,
        })
        expect(status(results, 1)).toBe('passed')
      } finally {
        process.env['PATH'] = path
      }
    })

    it('uses no Bun global', async () => {
      const source = await Bun.file(new URL('./weakened.ts', import.meta.url)).text()
      expect(source).not.toMatch(/\bBun\./)
    })
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

  it('a nested config that extends the preset and switches a managed rule off fails check 3', async () => {
    const dir = fixture('healthy')
    mkdirSync(join(dir, 'src', 'x'))
    writeFileSync(
      join(dir, 'src', 'x', '.oxlintrc.json'),
      JSON.stringify({
        extends: ['../../.oxlintrc.basalt.json'],
        rules: { 'basalt/primitive-bypass': 'off' },
      }),
    )
    const results = await run(dir)
    expect(status(results, 3)).toBe('failed')
    expect(results[2]?.detail).toContain('basalt/primitive-bypass in src/x/.oxlintrc.json rules')
  })

  it.each([
    ['off', 'no-use-before-define'],
    ['warn', 'no-use-before-define'],
    ['off', 'eslint/no-use-before-define'],
  ])('a core rule the preset runs, set %s as %s, fails check 3 (W18)', async (level, id) => {
    const dir = fixture('healthy')
    writeFileSync(
      join(dir, '.oxlintrc.json'),
      JSON.stringify({ extends: ['./.oxlintrc.basalt.json'], rules: { [id]: level } }),
    )
    const results = await run(dir)
    expect(status(results, 3)).toBe('failed')
    expect(results[2]?.detail).toContain(`managed ids set by hand: ${id} in rules`)
  })

  it('a core rule the preset does not run stays the app’s own (check 3 passes)', async () => {
    const dir = fixture('healthy')
    writeFileSync(
      join(dir, '.oxlintrc.json'),
      JSON.stringify({ extends: ['./.oxlintrc.basalt.json'], rules: { 'no-console': 'error' } }),
    )
    expect(status(await run(dir), 3)).toBe('passed')
  })

  describe('a file-level blanket disable under a declared root (check 3)', () => {
    it('fails on a bare oxlint-disable, naming file and line', async () => {
      const results = await run(withFile('export const a = 1\n/* oxlint-disable */\n'))
      expect(status(results, 3)).toBe('failed')
      expect(results[2]?.detail).toContain('src/screen.tsx:2 (every rule)')
      expect(results[2]?.detail).toContain('manifest.deepRender')
    })

    it('fails on a bare directive that carries a reason', async () => {
      const results = await run(withFile('/* oxlint-disable -- legacy screen */\n'))
      expect(status(results, 3)).toBe('failed')
      expect(results[2]?.detail).toContain('src/screen.tsx:1')
    })

    it('finds an eslint-disable the same way', async () => {
      const results = await run(withFile('/* eslint-disable */\n', 'chart.ts'))
      expect(status(results, 3)).toBe('failed')
      expect(results[2]?.detail).toContain('src/chart.ts:1 (every rule)')
    })

    it('fails on a directive naming waiver-needs-reason', async () => {
      const results = await run(withFile('/* oxlint-disable basalt/waiver-needs-reason -- x */\n'))
      expect(results[2]?.detail).toContain('(waiver-needs-reason)')
    })

    it('passes a directive naming only other rules', async () => {
      const results = await run(withFile('/* oxlint-disable basalt/color-literal -- canvas */\n'))
      expect(status(results, 3)).toBe('passed')
    })

    it("leaves the router plugin's generated route tree alone", async () => {
      const results = await run(withFile('/* eslint-disable */\n', 'routeTree.gen.ts'))
      expect(status(results, 3)).toBe('passed')
    })

    it('leaves the tree a vite config names with generatedRouteTree alone', async () => {
      const dir = withFile('/* eslint-disable */\n', 'tree.ts')
      writeFileSync(
        join(dir, 'vite.config.ts'),
        "export default { plugins: [tanstackRouter({ generatedRouteTree: './src/tree.ts' })] }\n",
      )
      expect(status(await run(dir), 3)).toBe('passed')
    })

    it('leaves a path the oxlint config ignores alone, and still fails its neighbour', async () => {
      const dir = withFile('/* eslint-disable */\n', 'generated.ts')
      writeFileSync(join(dir, 'src', 'screen.tsx'), '/* eslint-disable */\n')
      const path = join(dir, '.oxlintrc.json')
      const config = JSON.parse(readFileSync(path, 'utf8')) as object
      writeFileSync(path, JSON.stringify({ ...config, ignorePatterns: ['src/generated.ts'] }))
      const detail = (await run(dir))[2]?.detail
      expect(detail).toContain('src/screen.tsx:1')
      expect(detail).not.toContain('generated.ts')
    })

    it('reads a trailing-slash directory pattern at any depth', async () => {
      const dir = withFile('export {}\n')
      mkdirSync(join(dir, 'src', 'generated'))
      writeFileSync(join(dir, 'src', 'generated', 'api.ts'), '/* eslint-disable */\n')
      writeFileSync(join(dir, '.oxlintignore'), 'generated/\n')
      expect(status(await run(dir), 3)).toBe('passed')
    })

    it('names the ignore route for a generated file in the remedy', async () => {
      const results = await run(withFile('/* eslint-disable */\n'))
      expect(results[2]?.detail).toContain('ignorePatterns')
    })

    it('does not read a file outside the declared roots', async () => {
      const dir = withFile('export {}\n')
      writeFileSync(join(dir, 'outside.ts'), '/* oxlint-disable */\n')
      expect(status(await run(dir), 3)).toBe('passed')
    })
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

  it('the default offender is a color literal', () => {
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

  it('passes waivers above the base ref and names the growth: the record follows the count', async () => {
    const results = await run(repo([3, 5], [3, 6]), { baseRef: 'main' })
    expect(status(results, 5)).toBe('passed')
    expect(results[4]?.detail).toContain('waivers grew 5 -> 6 since main')
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

  it('passes a raise recorded by a new row naming the consumer, and fails a hand edit or a blank consumer', async () => {
    const row = (consumer: string) =>
      `"raises": [{ "field": "ejects", "from": 3, "to": 4, "consumer": "${consumer}" }]`
    const withRaises = (dir: string, raises: string) => {
      const path = join(dir, '.basalt/budget.json')
      writeFileSync(path, readFileSync(path, 'utf8').replace(/"raises": \[\]/, raises))
      return dir
    }
    const ok = withRaises(repo([3, 5], [4, 5]), row('probe consumer'))
    expect(status(await run(ok, { baseRef: 'main' }), 5)).toBe('passed')
    const blank = withRaises(repo([3, 5], [4, 5]), row(' '))
    const failed = await run(blank, { baseRef: 'main' })
    expect(status(failed, 5)).toBe('failed')
    expect(failed[4]?.detail).toContain('basalt-ui eject <name> --reason')
    const wrong = withRaises(repo([3, 5], [4, 5]), row('x').replace('"to": 4', '"to": 3'))
    expect(status(await run(wrong, { baseRef: 'main' }), 5)).toBe('failed')
  })

  it('passes on the first landing, when the base holds no copy', async () => {
    expect(status(await run(repo(null, [3, 9]), { baseRef: 'main' }), 5)).toBe('passed')
  })

  it('skips when the base ref does not resolve', async () => {
    expect(status(await run(repo([3, 0], [3, 0]), { baseRef: 'origin/nope' }), 5)).toBe('skipped')
  })
})

describe('a .stylelintignore under a declared root (check 3)', () => {
  const sheet = (dir: string) => {
    mkdirSync(join(dir, 'src', 'features'), { recursive: true })
    writeFileSync(join(dir, 'src', 'features', 'f.module.css'), '.a {}\n')
  }

  it('fails when it names a stylesheet, and names the file', async () => {
    const dir = fixture('healthy')
    sheet(dir)
    writeFileSync(join(dir, '.stylelintignore'), 'src/features/\n')
    const results = await run(dir)
    expect(status(results, 3)).toBe('failed')
    expect(results[2]?.detail).toContain('.stylelintignore')
    expect(results[2]?.detail).toContain('src/features/f.module.css')
  })

  it('passes when it names nothing under a root', async () => {
    const dir = fixture('healthy')
    sheet(dir)
    writeFileSync(join(dir, '.stylelintignore'), '# built\ndist/\n')
    expect(status(await run(dir), 3)).toBe('passed')
  })
})
