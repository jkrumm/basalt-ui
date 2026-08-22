/**
 * Round-4 regression suite: the toolchain reported green while enforcing nothing.
 *
 * Five consumers hit one bug in five shapes — `doctor` counting checks it could not run as passes,
 * `init` scaffolding a guard that scans zero files, seeded configs whose `extends` resolved to
 * nothing, and `tokens:css` output basalt's own guard rejected. Every test below pins one of those
 * false-greens shut. The unit under test is always "does the tool TELL you", not "does it work".
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPaletteCss } from '../tokens'
import {
  checkTheme,
  doctor,
  fontsCss,
  init,
  MANIFEST_PATH,
  normalizeColorFunctions,
  tokensCss,
} from './index.ts'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CLI_VERSION = (
  JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as { version: string }
).version

let dir: string

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function read(relPath: string): string {
  return readFileSync(join(dir, relPath), 'utf8')
}

function readPkg(relPath = 'package.json'): Record<string, unknown> {
  return JSON.parse(read(relPath)) as Record<string, unknown>
}

/** Captures both streams — doctor/init/check-theme pick one or the other by outcome. */
function capture(fn: () => number): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  const sink = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: fn(), log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

/** The install `doctor` should find — same version as the running CLI, so version checks pass. */
function installBasalt(at = ''): void {
  write(
    join(at, 'node_modules/basalt-ui/package.json'),
    JSON.stringify({ name: 'basalt-ui', version: CLI_VERSION }),
  )
}

/** A repo where every framework-profile doctor check passes. */
function healthyFixture(): void {
  write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
  write('src/app.tsx', 'export const App = () => null\n')
  write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
  write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }))
  installBasalt()
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-wiring-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('doctor — a check that cannot run is not a check that passed', () => {
  it('is green on a fully-wired repo', () => {
    healthyFixture()
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('All checks passed.')
    expect(code).toBe(0)
  })

  it('reports SKIPPED and exits non-zero when basalt-ui does not resolve, instead of dropping the checks', () => {
    healthyFixture()
    rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('SKIPPED')
    expect(log).toContain('does not resolve')
    expect(log).not.toContain('All checks passed.')
    expect(code).toBe(1)
  })

  it('finds an install that lives beside a workspace package rather than at the root', () => {
    healthyFixture()
    rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
    write(
      'package.json',
      JSON.stringify({ name: 'root', workspaces: ['packages/*'], basalt: { roots: ['src'] } }),
    )
    write('packages/lib/package.json', JSON.stringify({ name: 'lib' }))
    installBasalt('packages/lib')
    const { log } = capture(() => doctor(dir))
    expect(log).toContain('packages/lib/node_modules/basalt-ui')
    expect(log).not.toContain('SKIPPED')
  })

  it('hard-fails when check-theme would scan zero files — the two commands may not disagree', () => {
    healthyFixture()
    rmSync(join(dir, 'src'), { recursive: true, force: true })
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('guard-scan: check-theme would scan 0 files')
    expect(code).toBe(1)
  })

  it('hard-fails when .oxlintrc.json does not extend the shipped preset', () => {
    healthyFixture()
    write('.oxlintrc.json', '{ "rules": {} }')
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('does NOT extend the shipped preset')
    expect(log).toContain('--merge-lint')
    expect(code).toBe(1)
  })

  it('hard-fails when .oxlintrc.json is missing entirely', () => {
    healthyFixture()
    rmSync(join(dir, '.oxlintrc.json'), { force: true })
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('.oxlintrc.json missing')
    expect(code).toBe(1)
  })

  it('relocates to the single workspace package carrying the basalt config', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write('apps/web/package.json', JSON.stringify({ name: 'web', basalt: { roots: ['src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write(
      'apps/web/.oxlintrc.json',
      '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }',
    )
    write(
      join('apps/web', MANIFEST_PATH),
      JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }),
    )
    installBasalt('apps/web')
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('reporting on ./apps/web')
    expect(code).toBe(0)
  })
})

describe('doctor — tokens-only profile', () => {
  function tokensOnlyFixture(): void {
    write('package.json', JSON.stringify({ name: 'static-site' }))
    installBasalt()
  }

  it('does not tell a Mantine-free consumer to run init, and passes on a matching version', () => {
    tokensOnlyFixture()
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('profile: tokens-only')
    expect(log).not.toContain('run `basalt-ui init` to scaffold')
    expect(log).toContain('matches the installed basalt-ui')
    expect(code).toBe(0)
  })

  it('still reaches the CLI-vs-installed version check that the manifest failure used to shadow', () => {
    write('package.json', JSON.stringify({ name: 'static-site' }))
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: '0.4.2' }),
    )
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('0.4.2')
    expect(code).toBe(0) // a stale bunx fetch is a warning, not a hard failure
  })

  it('--framework forces the full profile on the same repo', () => {
    tokensOnlyFixture()
    const { code, log } = capture(() => doctor(dir, ['--framework']))
    expect(log).toContain(`${MANIFEST_PATH} missing`)
    expect(code).toBe(1)
  })

  it('--tokens-only forces the token profile on a Mantine repo', () => {
    healthyFixture()
    const { log } = capture(() => doctor(dir, ['--tokens-only']))
    expect(log).toContain('profile: tokens-only')
    expect(log).toContain('n/a')
  })
})

describe('init — describing the repo it is actually in', () => {
  it('writes basalt.roots from the bun workspaces layout', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*', 'packages/*'] }))
    write(
      'apps/web/package.json',
      JSON.stringify({ name: 'web', dependencies: { 'basalt-ui': '^1' } }),
    )
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write('packages/api/package.json', JSON.stringify({ name: 'api' }))
    write('packages/api/src/server.ts', 'export const serve = () => null\n')

    const { log } = capture(() => init(dir))
    // Only the basalt-consuming package is a design-guard root — a backend `src/` is not.
    expect((readPkg()['basalt'] as { roots: string[] }).roots).toEqual(['apps/web/src'])
    expect(log).toContain('"roots"')
    expect(read('.github/workflows/check.yml')).toContain("'apps/web/src/**'")
  })

  it("writes basalt.roots ['src'] for a single-package repo", () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('src/app.tsx', 'export const App = () => null\n')
    init(dir)
    expect((readPkg()['basalt'] as { roots: string[] }).roots).toEqual(['src'])
  })

  it('says so loudly when it cannot infer roots, instead of seeding one that matches nothing', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    const { log } = capture(() => init(dir))
    expect(log).toContain('could not infer "basalt.roots"')
    expect(readPkg()['basalt']).toBeUndefined()
  })

  it('never overwrites a roots the consumer already set', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['custom'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    init(dir)
    expect((readPkg()['basalt'] as { roots: string[] }).roots).toEqual(['custom'])
  })

  it('adds a lint:basalt script wiring oxlint and the guard together', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('src/app.tsx', 'export const App = () => null\n')
    init(dir)
    const scripts = readPkg()['scripts'] as Record<string, string>
    expect(scripts['lint:basalt']).toContain('oxlint .')
    expect(scripts['lint:basalt']).toContain('check-theme')
  })

  it('leaves an existing lint:basalt script alone', () => {
    write('package.json', JSON.stringify({ name: 'app', scripts: { 'lint:basalt': 'mine' } }))
    init(dir)
    expect((readPkg()['scripts'] as Record<string, string>)['lint:basalt']).toBe('mine')
  })

  it('names every kept file AND what keeping it costs', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('.oxlintrc.json', '{ "rules": {} }')
    const { log } = capture(() => init(dir))
    expect(log).toContain('Kept (already present')
    expect(log).toContain('.oxlintrc.json')
    expect(log).toContain('is NOT active')
    // The aggregate count stays, but it is no longer the only thing said.
    expect(log).toMatch(/\d+ written, \d+ kept/)
  })

  it('warns that adoption on an existing app is a lint-debt event, with the plugin count', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    const { log } = capture(() => init(dir))
    expect(log).toContain('Lint debt')
    expect(log).toContain('jsx-a11y')
    expect(log).toContain('lefthook install')
  })

  it('--merge-lint splices the shipped preset into an .oxlintrc.json init would otherwise keep', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('.oxlintrc.json', JSON.stringify({ rules: { 'no-debugger': 'error' } }, null, 2))
    const { log } = capture(() => init(dir, { mergeLint: true }))
    const cfg = JSON.parse(read('.oxlintrc.json')) as { extends: string[]; rules: unknown }
    expect(cfg.extends[0]).toContain('basalt-ui/configs/oxlint.json')
    expect(cfg.rules).toEqual({ 'no-debugger': 'error' })
    expect(log).toContain('--merge-lint')
  })

  it('--merge-lint is idempotent', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    const { log } = capture(() => init(dir, { mergeLint: true }))
    expect(log).toContain('already extends')
  })
})

describe('init — seeds resolve basalt where it actually installed', () => {
  it('renders the extends paths and the CI bin from a workspace-level install, not the root', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['packages/*'] }))
    write('packages/lib/package.json', JSON.stringify({ name: 'lib' }))
    write('packages/lib/src/index.ts', 'export const x = 1\n')
    installBasalt('packages/lib')

    capture(() => init(dir))

    expect(read('.oxlintrc.json')).toContain(
      './packages/lib/node_modules/basalt-ui/configs/oxlint.json',
    )
    expect(read('lefthook.yml')).toContain(
      'packages/lib/node_modules/basalt-ui/configs/lefthook.yml',
    )
    // The CI step runs the LOCAL bin — bunx would silently fetch a different copy from npm.
    expect(read('.github/workflows/check.yml')).toContain(
      'packages/lib/node_modules/.bin/basalt-ui check-theme',
    )
    expect(read('.github/workflows/check.yml')).not.toContain('{{BASALT_BIN}}')
  })

  it('warns loudly when basalt-ui resolves nowhere, rather than seeding a silent dead path', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('src/app.tsx', 'export const App = () => null\n')
    const { log } = capture(() => init(dir))
    expect(log).toContain('does not resolve from')
  })
})

describe('check-theme — finds the config a root-invoked hook cannot see', () => {
  it('relocates to the one workspace package carrying a basalt config', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write('apps/web/package.json', JSON.stringify({ name: 'web', basalt: { roots: ['src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('running in ./apps/web')
    expect(log).toContain('no off-palette colors')
    expect(code).toBe(0)
  })

  it('reports ambiguity rather than guessing when two packages carry a config', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write('apps/a/package.json', JSON.stringify({ name: 'a', basalt: { roots: ['src'] } }))
    write('apps/b/package.json', JSON.stringify({ name: 'b', basalt: { roots: ['src'] } }))
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('2 workspace packages carry one')
    expect(log).toContain('BASALT_CWD')
    expect(code).toBe(1)
  })
})

describe('tokens:css — a committable artifact', () => {
  const GENERATED_FIRST_LINE =
    '/* @generated basalt-ui tokens — do not edit; regenerate with `bunx basalt-ui tokens:css` */'

  function emit(flags: string[], out = 'out.css'): string {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(tokensCss([...flags, '--out', out], dir)).toBe(0)
    return read(out)
  }

  it('opens with the exact @generated marker the theme guard skips on', () => {
    const css = emit([])
    expect(css.split('\n')[0]).toBe(GENERATED_FIRST_LINE)
    expect(css.split('\n')[1]).toContain(`basalt-ui ${CLI_VERSION}`)
  })

  it('ends with a trailing newline and normalizes rgba() argument spacing', () => {
    const css = emit([])
    expect(css.endsWith('}\n')).toBe(true)
    expect(css).not.toMatch(/rgba\(\d+,\d/)
    expect(css).toContain('rgba(255, 255, 255, 0.6)')
  })

  it('changes no token VALUE — the body is buildPaletteCss modulo the formatting', () => {
    const body = emit([]).split('\n').slice(2).join('\n')
    expect(body).toBe(`${normalizeColorFunctions(buildPaletteCss())}\n`)
  })

  it('--selector-class emits a class selector instead of an attribute one', () => {
    const css = emit(['--selector-class', 'dark', '--default-scheme', 'light'])
    expect(css).toContain(':root.dark {')
    expect(css).toContain(':root,\n:root.light {')
    expect(css).not.toContain('data-basalt-scheme-class')
  })

  it('rejects --selector-class together with --selector-attribute', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    const { code } = capture(() =>
      tokensCss(
        ['--selector-class', 'dark', '--selector-attribute', 'data-x', '--out', 'o.css'],
        dir,
      ),
    )
    expect(code).toBe(1)
  })

  it('rejects a --selector-class that is not a plain class name', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(tokensCss(['--selector-class', "dark'] { x", '--out', 'o.css'], dir)).toBe(1)
  })

  it('--check passes on an up-to-date file and fails on drift', () => {
    emit(['--only', 'core'])
    expect(
      capture(() => tokensCss(['--only', 'core', '--out', 'out.css', '--check'], dir)).code,
    ).toBe(0)
    write('out.css', 'nope\n')
    const { code, log } = capture(() =>
      tokensCss(['--only', 'core', '--out', 'out.css', '--check'], dir),
    )
    expect(code).toBe(1)
    expect(log).toContain('differs from what')
  })

  it('--check fails when the file has never been generated', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    const { code, log } = capture(() => tokensCss(['--out', 'missing.css', '--check'], dir))
    expect(code).toBe(1)
    expect(log).toContain('does not exist')
  })

  it('--check without --out is an error, not a silent stdout dump', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(capture(() => tokensCss(['--check'], dir)).code).toBe(1)
  })
})

describe('fonts:css — the typeface half of the token layer', () => {
  it('emits the shipped --basalt-font-* stacks under the generated header', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(fontsCss(['--out', 'fonts.css'], dir)).toBe(0)
    const css = read('fonts.css')
    expect(css.split('\n')[0]).toContain('@generated basalt-ui')
    expect(css).toContain('--basalt-font-sans:')
    expect(css).toContain('--basalt-font-head:')
    expect(css).toContain('--basalt-font-mono:')
    expect(css).toContain('Nunito Sans Variable')
    expect(css.endsWith('}\n')).toBe(true)
  })

  it('has the same --check drift gate as tokens:css', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    fontsCss(['--out', 'fonts.css'], dir)
    expect(capture(() => fontsCss(['--out', 'fonts.css', '--check'], dir)).code).toBe(0)
    write('fonts.css', ':root {}\n')
    expect(capture(() => fontsCss(['--out', 'fonts.css', '--check'], dir)).code).toBe(1)
  })
})
