/**
 * The `tokens` install, packed and frozen: "no React, no Tailwind, 0 peers" and "a static page
 * reads the same atoms" are claims until a real tarball is installed in an empty directory.
 * Contract: docs/v3/concepts/static-framework-free.md section 8 (P5, P6) and section 10 (DPO S1/S4).
 *
 * Lives under tests/layout because it packs (`bun pm pack` runs the build) and installs from the
 * registry, and drives Chrome for the no-bundler page; the fast unit loop runs none of that.
 *
 * Two claims are not true of the 2.x package yet, and are recorded as `todo` instead of passing a
 * weaker test: (1) the 2.x runtime peers (Mantine, React, ...) are still required until
 * `v3-teardown-peers`, so a bare install of the real tarball also resolves them; (2) `init` has no
 * `--profile` flag until `v3-sk-3-init-doctor`. For (1) the exact-set assertion runs against a
 * projection of the real tarball whose only edit is marking those 2.x peers optional, which is what
 * the teardown does; `dependencies`, the fonts and the dist graph are the real ones. Each `todo`
 * names what lifts it, and the real-tarball test replaces the projection once that is empty.
 *
 * Chrome only. Firefox and Safari are NOT run: they are unverified here (row U of the concept).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  DESKTOP_1440,
  initLayoutSuite,
  openDocument,
} from '../harness'
import { PACKAGE_DIR } from './pages'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip
afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

/** Measured on the four entry sheets at 3.0.0 (tokens + typography + prose + fonts): 17705 bytes. */
const CSS_BYTES_MEASURED = 17_705
const CSS_BYTES_CEILING = Math.ceil(CSS_BYTES_MEASURED * 1.05)

const ENTRIES = ['tokens.css', 'typography.css', 'prose.css', 'fonts.css'] as const
const FONTS = [
  '@fontsource-variable/hubot-sans',
  '@fontsource-variable/jetbrains-mono',
  '@fontsource-variable/nunito-sans',
] as const
/** What a `tokens` install resolves and nothing else: `basalt-ui`, its three dependencies, the fonts. */
const EXPECTED_PACKAGES = [
  ...FONTS,
  'basalt-ui',
  'class-variance-authority',
  'clsx',
  'eventsource-parser',
].toSorted()

interface Run {
  readonly code: number
  readonly out: string
}

function run(cmd: string[], cwd: string): Run {
  const result = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, out: `${result.stdout}${result.stderr}` }
}

function must(cmd: string[], cwd: string): Run {
  const result = run(cmd, cwd)
  if (result.code !== 0) throw new Error(`${cmd.join(' ')} failed (${result.code}):\n${result.out}`)
  return result
}

const scratch: string[] = []
const mkTmp = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `basalt-${label}-`))
  scratch.push(dir)
  return dir
}
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

/** Packs the working tree. `bun pm pack` runs `prepack` (the build), so the tarball is never stale. */
function pack(): string {
  const dir = mkTmp('pack')
  must(['bun', 'pm', 'pack', '--destination', dir], PACKAGE_DIR)
  const tgz = readdirSync(dir).find((f) => f.endsWith('.tgz'))
  if (!tgz) throw new Error('bun pm pack wrote no tarball')
  return join(dir, tgz)
}

interface Manifest {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

function manifestOf(tgz: string): Manifest {
  const dir = mkTmp('manifest')
  must(['tar', '-xzf', tgz, '-C', dir, 'package/package.json'], dir)
  return JSON.parse(readFileSync(join(dir, 'package/package.json'), 'utf8')) as Manifest
}

/** The real tarball with every non-font peer marked optional: the state `v3-teardown-peers` ships. */
function project(tgz: string, manifest: Manifest, legacy: string[]): string {
  const dir = mkTmp('projection')
  must(['tar', '-xzf', tgz, '-C', dir], dir)
  const file = join(dir, 'package/package.json')
  const next = JSON.parse(readFileSync(file, 'utf8')) as Manifest
  next.peerDependenciesMeta = { ...manifest.peerDependenciesMeta }
  for (const name of legacy) next.peerDependenciesMeta[name] = { optional: true }
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  const out = join(mkTmp('projected-tgz'), 'basalt-ui-projected.tgz')
  must(['tar', '-czf', out, '-C', dir, 'package'], dir)
  return out
}

interface Install {
  readonly dir: string
  readonly output: string
}

/** `bun add` the tarball, then throw node_modules away and reinstall from the lockfile, frozen. */
function frozenInstall(tgz: string): Install {
  const dir = mkTmp('install')
  writeFileSync(
    join(dir, 'package.json'),
    '{ "name": "tokens-consumer", "private": true, "type": "module" }\n',
  )
  const added = must(['bun', 'add', tgz], dir)
  rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
  const frozen = must(['bun', 'install', '--frozen-lockfile'], dir)
  return { dir, output: `${added.out}\n${frozen.out}` }
}

function topLevelPackages(dir: string): string[] {
  const root = join(dir, 'node_modules')
  const names: string[] = []
  for (const entry of readdirSync(root)) {
    if (entry.startsWith('.')) continue
    if (entry.startsWith('@')) {
      for (const inner of readdirSync(join(root, entry))) names.push(`${entry}/${inner}`)
    } else names.push(entry)
  }
  return names.toSorted()
}

/** Every file the entry sheets reach through `@import` and `url()`; bare specifiers resolve from node_modules. */
function cssGraph(dir: string): string[] {
  const seen = new Set<string>()
  const queue = ENTRIES.map((entry) => join(dir, 'node_modules/basalt-ui/dist/css', entry))
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (extname(file) !== '.css') continue
    const css = readFileSync(file, 'utf8')
    for (const m of css.matchAll(/(?:@import\s+(?:url\()?|url\()\s*['"]?([^'")\s]+)/g)) {
      const ref = m[1] ?? ''
      if (ref.startsWith('data:') || ref.startsWith('#')) continue
      queue.push(
        ref.startsWith('.') || ref.startsWith('/')
          ? resolve(dirname(file), ref)
          : join(dir, 'node_modules', ref),
      )
    }
  }
  return [...seen].toSorted()
}

const tarball = ready ? pack() : ''
const manifest = ready ? manifestOf(tarball) : {}
const legacyRequired = Object.keys(manifest.peerDependencies ?? {}).filter(
  (name) =>
    !(FONTS as readonly string[]).includes(name) &&
    manifest.peerDependenciesMeta?.[name]?.optional !== true,
)
const subject = ready
  ? legacyRequired.length > 0
    ? project(tarball, manifest, legacyRequired)
    : tarball
  : ''
const install = ready ? frozenInstall(subject) : { dir: '', output: '' }
const installed = ready ? topLevelPackages(install.dir) : []
const sheet = (name: string): string => join(install.dir, 'node_modules/basalt-ui/dist/css', name)

// `init --profile tokens` runs LAST and mutates the install; everything above has already been read.
const initRun = ready
  ? (() => {
      const before = JSON.parse(readFileSync(join(install.dir, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const result = run(
        [
          'node',
          join(install.dir, 'node_modules/basalt-ui/bin/basalt-ui.mjs'),
          'init',
          '--profile',
          'tokens',
        ],
        install.dir,
      )
      const after = JSON.parse(
        readFileSync(join(install.dir, 'package.json'), 'utf8'),
      ) as typeof before
      const names = (p: typeof before): string[] => [
        ...Object.keys(p.dependencies ?? {}),
        ...Object.keys(p.devDependencies ?? {}),
      ]
      const known = new Set(names(before))
      return {
        result,
        added: names(after)
          .filter((n) => !known.has(n))
          .toSorted(),
      }
    })()
  : { result: { code: 0, out: '' }, added: [] as string[] }
const initHasProfiles = !/unrecognized flag '--profile'/.test(initRun.result.out)

layout('tokens install (packed tarball, frozen)', () => {
  test('dependencies are exactly clsx, class-variance-authority and eventsource-parser', () => {
    expect(Object.keys(manifest.dependencies ?? {}).toSorted()).toEqual([
      'class-variance-authority',
      'clsx',
      'eventsource-parser',
    ])
  })

  test('the fonts are required peers of the tokens install', () => {
    for (const font of FONTS) {
      expect(manifest.peerDependencies?.[font]).toBeDefined()
      expect(manifest.peerDependenciesMeta?.[font]?.optional).not.toBe(true)
    }
  })

  test(
    legacyRequired.length > 0
      ? 'a bare frozen install resolves exactly basalt-ui, clsx, cva, eventsource-parser and the three fonts (tarball with the 2.x peers marked optional)'
      : 'a bare frozen install resolves exactly basalt-ui, clsx, cva, eventsource-parser and the three fonts',
    () => {
      expect(installed).toEqual(EXPECTED_PACKAGES)
    },
  )

  const real = legacyRequired.length > 0 ? test.todo : test
  real(
    `the REAL tarball declares no required peer but the fonts (blocked until v3-teardown-peers drops: ${legacyRequired.join(', ')})`,
    () => {
      expect(legacyRequired).toEqual([])
    },
  )

  test('the frozen install prints no peer warning', () => {
    const peerLines = install.output
      .split('\n')
      .filter((line) => /peer/i.test(line) && /warn/i.test(line))
    expect(peerLines).toEqual([])
  })

  test('zero JS files in the CSS graph', () => {
    const files = cssGraph(install.dir)
    expect(files.length).toBeGreaterThan(ENTRIES.length)
    for (const file of files) {
      expect(existsSync(file)).toBe(true)
      expect(['.css', '.woff2', '.woff']).toContain(extname(file))
    }
  })

  test(`CSS bytes stay under ${CSS_BYTES_CEILING} (measured ${CSS_BYTES_MEASURED} + 5%)`, () => {
    const total = ENTRIES.reduce((sum, name) => sum + statSync(sheet(name)).size, 0)
    expect(total).toBeLessThanOrEqual(CSS_BYTES_CEILING)
  })

  test('the installed sheets are the source sheets', () => {
    for (const name of ENTRIES) {
      expect(readFileSync(sheet(name), 'utf8')).toBe(
        readFileSync(join(PACKAGE_DIR, 'src/css', name), 'utf8'),
      )
    }
  })

  test('a no-bundler page importing the four entries and the boot script paints, with no module script', async () => {
    const themeScriptFile = join(install.dir, 'node_modules/basalt-ui/dist/css/theme-script.js')
    const { themeScript } = (await import(themeScriptFile)) as { themeScript: () => string }
    const sheets = ENTRIES.map(
      (name) => `<style>${readFileSync(sheet(name), 'utf8')}</style>`,
    ).join('')
    const page = await openDocument(
      `<!doctype html><html lang="en" data-density="dense"><head><meta charset="utf-8" />${sheets}<script>${themeScript()}</script></head>` +
        '<body><div class="canvas" style="background:var(--vx-canvas);color:var(--vx-ink)"><article class="vx-prose"><h2>Tokens only</h2><p>Plain CSS.</p></article></div></body></html>',
      DESKTOP_1440,
    )
    expect(await page.raw.evaluate(() => document.scripts.length)).toBe(1)
    expect(
      await page.raw.evaluate(() => document.querySelectorAll('script[type=module]').length),
    ).toBe(0)
    await page.raw.emulateMedia({ colorScheme: 'light' })
    const light = await page.raw.evaluate(() => ({
      canvas: getComputedStyle(document.querySelector('.canvas') as Element).backgroundColor,
      token: getComputedStyle(document.documentElement).getPropertyValue('--vx-canvas').trim(),
      h2: parseFloat(getComputedStyle(document.querySelector('.vx-prose h2') as Element).fontSize),
    }))
    expect(light.token).not.toBe('')
    expect(light.canvas).not.toBe('rgba(0, 0, 0, 0)')
    expect(light.h2).toBeGreaterThan(0)
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    await page.raw.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    )
    await page.raw.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
    )
    const dark = await page.raw.evaluate(
      () => getComputedStyle(document.querySelector('.canvas') as Element).backgroundColor,
    )
    expect(dark).not.toBe(light.canvas)
  })

  const initTest = initHasProfiles ? test : test.todo
  initTest(
    `init --profile tokens adds only the optional peers it writes: stylelint and postcss-html${
      initHasProfiles ? '' : ' (blocked until v3-sk-3-init-doctor ships the --profile flag)'
    }`,
    () => {
      expect(initRun.result.code).toBe(0)
      expect(initRun.added).toEqual(['postcss-html', 'stylelint'])
    },
  )
})
