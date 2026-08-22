/**
 * Round-4 regression suite: the toolchain reported green while enforcing nothing.
 *
 * Five consumers hit one bug in five shapes — `doctor` counting checks it could not run as passes,
 * `init` scaffolding a guard that scans zero files, seeded configs whose `extends` resolved to
 * nothing, and `tokens:css` output basalt's own guard rejected. Every test below pins one of those
 * false-greens shut. The unit under test is always "does the tool TELL you", not "does it work".
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  sync,
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
  // The shipped preset itself — `doctor`'s oxlint-preset check resolves the `extends` target now,
  // so an install without it is (correctly) a failure.
  write(join(at, 'node_modules/basalt-ui/configs/oxlint.json'), '{}')
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
    ambiguousWorkspace()
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('2 packages below it carry one')
    expect(log).toContain('BASALT_CWD')
    expect(code).toBe(1)
  })
})

/** A root with no basalt config and two workspace packages that each carry one. */
function ambiguousWorkspace(): void {
  write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
  write('apps/a/package.json', JSON.stringify({ name: 'a', basalt: { roots: ['src'] } }))
  write('apps/a/src/app.tsx', 'export const A = () => null\n')
  write('apps/b/package.json', JSON.stringify({ name: 'b', basalt: { roots: ['src'] } }))
  write('apps/b/src/app.tsx', 'export const B = () => null\n')
}

describe('doctor — an ambiguous project is terminal, exactly as it is for check-theme', () => {
  it('short-circuits instead of running every check against the wrong root', () => {
    ambiguousWorkspace()
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('2 packages below it carry one')
    expect(log).toContain('BASALT_CWD')
    expect(code).toBe(1)
    // The bug this pins shut: falling back to the invocation cwd ran the remaining checks against
    // a root that has no config, burying the real error under failures caused by looking there.
    expect(log).not.toContain('would scan 0 files')
    expect(log).not.toContain('.oxlintrc.json missing')
    expect(log).not.toContain('manifest.json missing')
  })

  it('agrees with check-theme on the same tree', () => {
    ambiguousWorkspace()
    expect(capture(() => doctor(dir)).code).toBe(capture(() => checkTheme(dir)).code)
  })

  it('still runs normally once BASALT_CWD picks a package', () => {
    ambiguousWorkspace()
    const { code, log } = capture(() => doctor(join(dir, 'apps/a')))
    expect(log).not.toContain('packages below it carry one')
    expect(code).toBe(1) // no install / no manifest there — but the checks RAN
    expect(log).toContain('guard-scan')
  })
})

describe('doctor — no check may vanish from the report', () => {
  it('SKIPS the spacing-scale check when there is no manifest, rather than printing nothing', () => {
    // A Mantine app that never ran `init`: framework profile, no manifest to compare against.
    write(
      'package.json',
      JSON.stringify({
        name: 'app',
        dependencies: { '@mantine/core': '^9.0.0' },
        basalt: { roots: ['src'] },
      }),
    )
    write('src/app.tsx', 'export const App = () => null\n')
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    installBasalt()
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('spacing scale')
    expect(log).toContain('SKIPPED')
    expect(code).toBe(1)
  })

  it('calls the spacing check n/a — not silent — for a tokens-only consumer', () => {
    write('package.json', JSON.stringify({ name: 'site', basalt: { profile: 'tokens-only' } }))
    installBasalt()
    const { log } = capture(() => doctor(dir))
    expect(log).toContain('spacing scale: n/a')
  })
})

describe('--tokens-only and --framework are alternatives, not a precedence question', () => {
  it('check-theme rejects both together', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    const { code, log } = capture(() => checkTheme(dir, ['--tokens-only', '--framework']))
    expect(code).toBe(1)
    expect(log).toContain('alternatives')
  })

  it('doctor rejects both together', () => {
    healthyFixture()
    const { code, log } = capture(() => doctor(dir, ['--tokens-only', '--framework']))
    expect(code).toBe(1)
    expect(log).toContain('alternatives')
  })
})

describe('check-theme — the markup scan reaches the app shell', () => {
  it('scans index.html and public/*.webmanifest beside a root, not just inside it', () => {
    // The exact argo shape: roots point at `apps/dashboard/src`, the raw hex lives one level up in
    // index.html and in public/site.webmanifest. Widening the extension filter alone missed both.
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['apps/web/src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write('apps/web/index.html', '<meta name="theme-color" content="#EDEFF2" />\n')
    write('apps/web/public/site.webmanifest', '{ "theme_color": "#242424" }\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('apps/web/index.html')
    expect(log).toContain('apps/web/public/site.webmanifest')
    expect(code).toBe(1)
  })

  it('leaves a sibling docs/ full of throwaway HTML alone', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('docs/poc.html', '<div style="color: #ff0000">x</div>\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).not.toContain('docs/poc.html')
    expect(code).toBe(0)
  })

  it('never blanket-scans .json, but scans one named in basalt.include', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('src/fixtures/data.json', '{ "note": "#ff0000 in a test fixture" }\n')
    expect(capture(() => checkTheme(dir)).code).toBe(0)

    write(
      'package.json',
      JSON.stringify({ name: 'app', basalt: { roots: ['src'], include: ['app/manifest.json'] } }),
    )
    write('app/manifest.json', '{ "theme_color": "#EDEFF2" }\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('app/manifest.json')
    expect(log).not.toContain('data.json')
    expect(code).toBe(1)
  })
})

describe('check-theme — tokens-only profile', () => {
  function mantineFreeApp(): void {
    write(
      'package.json',
      JSON.stringify({ name: 'site', basalt: { roots: ['src'], profile: 'tokens-only' } }),
    )
    write('src/form.tsx', "export const F = () => <input />\nexport const C = '#ff0000'\n")
  }

  it('drops the Mantine-coupled kinds while the color kinds keep firing', () => {
    mantineFreeApp()
    const { log } = capture(() => checkTheme(dir))
    expect(log).toContain('tokens-only profile')
    expect(log).not.toContain('raw-form-control')
    expect(log).toContain('raw-hex')
  })

  it('--framework forces the full kind set back on', () => {
    mantineFreeApp()
    const { log } = capture(() => checkTheme(dir, ['--framework']))
    expect(log).not.toContain('tokens-only profile')
    expect(log).toContain('raw-form-control')
  })

  it('is never INFERRED — an undeclared Mantine-free repo keeps every kind live', () => {
    // Silencing 17 kinds off the mere absence of @mantine/core is this round's own failure mode:
    // a repo holding Mantine in a workspace package would switch off half its guard silently.
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/form.tsx', 'export const F = () => <input />\n')
    const { log } = capture(() => checkTheme(dir))
    expect(log).not.toContain('tokens-only profile')
    expect(log).toContain('raw-form-control')
  })

  it('doctor infers the shape and tells the consumer to declare it', () => {
    write('package.json', JSON.stringify({ name: 'site' }))
    installBasalt()
    const { log } = capture(() => doctor(dir))
    expect(log).toContain('profile: tokens-only')
    expect(log).toContain('"profile": "tokens-only"')
  })
})

describe('tokens:css — a committable artifact', () => {
  // Restated verbatim on purpose: the guard compares line 1 byte-for-byte, so a reword is a
  // contract change. It is command-NEUTRAL — it used to name `tokens:css`, which told anyone
  // reading a fonts:css file to overwrite it with the palette sheet.
  const GENERATED_FIRST_LINE =
    '/* @generated basalt-ui — do not edit; regenerate with the command on the next line */'

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

  it('emits no trailing-zero alpha — the last thing keeping the sheet out of a linter', () => {
    // prettier rewrites `rgba(28, 25, 23, 0.10)` → `0.1`, so the two light shadow tokens failed
    // `format/prettier` while `--fix` put the file straight into `tokens:css --check` drift. The
    // consumer's eslint-ignore entry for it survived two releases.
    const css = emit([])
    expect(css).not.toMatch(/rgba\([^)]*\d\.\d*0\)/)
    expect(css).toContain('rgba(28, 25, 23, 0.1)')
    expect(normalizeColorFunctions('a: rgba(1, 2, 3, 0.10); b: rgba(1, 2, 3, 1.0);')).toBe(
      'a: rgba(1, 2, 3, 0.1); b: rgba(1, 2, 3, 1);',
    )
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

describe('the @generated marker, end to end — emit, then scan', () => {
  /** A tokens-only consumer whose only CSS is the sheet `tokens:css` writes into its own src/. */
  function siteWithEmittedTokens(flags: string[] = []): void {
    write(
      'package.json',
      JSON.stringify({ name: 'site', basalt: { roots: ['src'], profile: 'tokens-only' } }),
    )
    write('src/app.tsx', 'export const App = () => null\n')
    expect(tokensCss([...flags, '--out', 'src/tokens.css'], dir)).toBe(0)
  }

  it('the sheet tokens:css just wrote scans to zero findings — 116 was the round-4 bug', () => {
    siteWithEmittedTokens(['--only', 'core'])
    // Sanity: it really is full of the raw hex the guard would otherwise report.
    expect(read('src/tokens.css').match(/#[0-9a-f]{6}/gi)?.length ?? 0).toBeGreaterThan(50)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).not.toContain('src/tokens.css')
    expect(code).toBe(0)
  })

  it('holds for every emission shape, not just the default', () => {
    for (const flags of [
      [],
      ['--only', 'all'],
      ['--selector-class', 'dark'],
      ['--default-scheme', 'light'],
    ]) {
      rmSync(join(dir, 'src'), { recursive: true, force: true })
      siteWithEmittedTokens(flags)
      expect(capture(() => checkTheme(dir)).code).toBe(0)
    }
  })

  it('a HAND-FORGED marker on ordinary source suppresses nothing', () => {
    siteWithEmittedTokens(['--only', 'core'])
    const header = read('src/tokens.css').split('\n').slice(0, 2).join('\n')
    // Exactly what an agent (or anyone) could do: copy the two header lines onto a real file.
    write('src/forged.css', `${header}\n.btn { color: #ff0000; }\n`)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('src/forged.css')
    expect(log).toContain('raw-hex')
    expect(code).toBe(1)
  })

  it('a STRIPPED marker makes the emitted sheet ordinary source again', () => {
    siteWithEmittedTokens(['--only', 'core'])
    const stripped = read('src/tokens.css').split('\n').slice(2).join('\n')
    write('src/tokens.css', stripped)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('src/tokens.css')
    expect(code).toBe(1)
  })

  it('appending a real rule to the emitted sheet un-exempts it', () => {
    siteWithEmittedTokens(['--only', 'core'])
    write('src/tokens.css', `${read('src/tokens.css')}.btn { color: #ff0000; }\n`)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('src/tokens.css')
    expect(code).toBe(1)
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

  it('emits a stylesheet check-theme accepts end to end', () => {
    write('package.json', JSON.stringify({ name: 'site', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    expect(fontsCss(['--out', 'src/fonts.css'], dir)).toBe(0)
    expect(capture(() => checkTheme(dir)).code).toBe(0)
  })

  // The header used to hard-code `regenerate with \`bunx basalt-ui tokens:css\`` on every emitted
  // file — following it on a fonts sheet overwrote the typefaces with the palette.
  it('never tells the reader to regenerate a fonts sheet with tokens:css', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(fontsCss(['--out', 'fonts.css'], dir)).toBe(0)
    const [marker, provenance] = read('fonts.css').split('\n')
    expect(marker).not.toContain('tokens:css')
    expect(provenance).toContain('`basalt-ui fonts:css')
  })

  it('has the same --check drift gate as tokens:css', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    fontsCss(['--out', 'fonts.css'], dir)
    expect(capture(() => fontsCss(['--out', 'fonts.css', '--check'], dir)).code).toBe(0)
    write('fonts.css', ':root {}\n')
    expect(capture(() => fontsCss(['--out', 'fonts.css', '--check'], dir)).code).toBe(1)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Round 5: the same false-green class, one layer in — inside the checks that
// were added to prevent it.
// ──────────────────────────────────────────────────────────────────────────────

describe('doctor — the oxlint-preset check resolves the path, not just the string', () => {
  it('hard-fails when the extends entry names a path that does not exist', () => {
    healthyFixture()
    // Exactly the state a monorepo consumer upgrades into: a well-shaped root-relative entry, and
    // basalt installed beside the package that depends on it. `bunx oxlint .` dies with NotFound
    // here, and 1.20.0's own check printed ✓ in the same tree.
    rmSync(join(dir, 'node_modules/basalt-ui/configs/oxlint.json'))
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    expect(log).toContain('does not exist')
    expect(log).toContain('NotFound')
    expect(log).not.toContain('✓ .oxlintrc.json extends')
  })

  it('names the RESOLVED install path as the remedy when the entry points somewhere else', () => {
    write(
      'package.json',
      JSON.stringify({
        name: 'root',
        workspaces: ['packages/*'],
        basalt: { roots: ['packages/web/src'] },
      }),
    )
    write('packages/web/package.json', JSON.stringify({ name: 'web' }))
    write('packages/web/src/app.tsx', 'export const App = () => null\n')
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }))
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    installBasalt('packages/web')
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    expect(log).toContain('packages/web/node_modules/basalt-ui/configs/oxlint.json')
  })

  it('passes — and quotes the entry — when the target really is there', () => {
    healthyFixture()
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('extends the shipped basalt-ui oxlint preset')
  })
})

describe('doctor — the lefthook extends target, the seam that fails SILENTLY', () => {
  it('hard-fails on a missing target: lefthook merges it to zero commands and exits 0', () => {
    healthyFixture()
    write('lefthook.yml', 'extends:\n  - node_modules/basalt-ui/configs/lefthook.yml\n')
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    expect(log).toContain('ZERO commands')
  })

  it('passes when the target resolves', () => {
    healthyFixture()
    write('node_modules/basalt-ui/configs/lefthook.yml', 'pre-commit:\n  commands: {}\n')
    write('lefthook.yml', 'extends:\n  - node_modules/basalt-ui/configs/lefthook.yml\n')
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('extends the shipped lefthook preset')
  })

  it('passes a repo that spells the gate out instead of extending — the check is the GATE', () => {
    // linewatch's root lefthook.yml runs all three jobs with `root: 'web/'`, because `extends`
    // merges commands WITHOUT their working directory: the preset's `bunx oxlint` would run at the
    // repo root where there is no .oxlintrc.json. Testing for the extends STRING warned at a
    // correctly-wired repo and prescribed a change that would have broken it.
    healthyFixture()
    write(
      'lefthook.yml',
      "pre-commit:\n  commands:\n    theme-guard:\n      root: 'web/'\n" +
        '      run: bunx basalt-ui check-theme\n',
    )
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('a pre-commit command runs check-theme directly — the gate exists')
  })

  it('is advisory, never confident, when neither the text nor `lefthook dump` settles it', () => {
    // A check that is confidently wrong is worse than one that admits its limit: an `include:` or a
    // remote config carries commands this reader never sees.
    healthyFixture()
    write('lefthook.yml', 'pre-commit:\n  commands:\n    mine:\n      run: echo hi\n')
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('cannot tell a missing gate from one wired through an `include:`')
  })

  it('is not applicable when the repo runs no lefthook at all', () => {
    healthyFixture()
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('lefthook-preset: n/a')
  })
})

describe('sync — basalt.roots is drift, and sync is the drift command', () => {
  it('backfills the inferred roots when the key was never written', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('src/app.tsx', 'export const App = () => null\n')
    capture(() => init(dir))
    // Undo init's write to reproduce a repo scaffolded before roots existed, then upgrade.
    write('package.json', JSON.stringify({ name: 'fixture' }))
    const { log } = capture(() => sync({}, dir))
    expect(log).toContain('"roots": ["src"]')
    expect((readPkg()['basalt'] as { roots: string[] }).roots).toEqual(['src'])
  })

  it('never overwrites a declared roots — it names what the declaration does not cover', () => {
    write(
      'package.json',
      JSON.stringify({
        name: 'root',
        workspaces: ['packages/*'],
        basalt: { roots: ['packages/web/src'] },
      }),
    )
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }))
    write(
      'packages/web/package.json',
      JSON.stringify({ name: 'web', dependencies: { 'basalt-ui': '*' } }),
    )
    write('packages/web/src/app.tsx', 'export const App = () => null\n')
    write(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { 'basalt-ui': '*' } }),
    )
    write('packages/api/src/server.ts', 'export const server = null\n')
    const { log } = capture(() => sync({}, dir))
    expect((readPkg()['basalt'] as { roots: string[] }).roots).toEqual(['packages/web/src'])
    expect(log).toContain('keeping your "basalt.roots"')
    expect(log).toContain('packages/api/src')
  })

  it('--check writes nothing, but still says the key is missing', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }))
    write('src/app.tsx', 'export const App = () => null\n')
    const { log } = capture(() => sync({ check: true }, dir))
    expect(readPkg()['basalt']).toBeUndefined()
    expect(log).toContain('"basalt.roots" is not set')
  })

  it('reports a lefthook extends target that no longer resolves', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('lefthook.yml', 'extends:\n  - node_modules/basalt-ui/configs/lefthook.yml\n')
    const { log } = capture(() => sync({}, dir))
    expect(log).toContain('ZERO commands')
  })
})

describe('init — the seeded lefthook.yml pins the guard to the local bin', () => {
  it('renders a BASALT_BIN env override, the one key an extends target cannot eat', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('src/app.tsx', 'export const App = () => null\n')
    installBasalt()
    capture(() => init(dir))
    const seeded = read('lefthook.yml')
    expect(seeded).toContain('BASALT_BIN: node_modules/.bin/basalt-ui')
    expect(seeded).toContain('extends:')
  })
})

// ── sync must never silently behave as init ───────────────────────────────────────────────────
//
// Found independently in argo and rb. Run from `apps/dashboard` — the package that actually
// depends on basalt-ui — `sync` printed `0 updated, 20 recreated`, wrote a second `basalt` key into
// that package.json, and scaffolded a complete competing install (`.basalt/`, `.oxlintrc.json`,
// `.oxfmtrc.json`, `DESIGN.md`, 13 rules, 3 skills, and in rb's case a `src/routes/__root.tsx`
// into an app that hand-writes its router) beside the real one at the repo root. Nothing warned.
// Both consumers reverted it by hand. `check-theme` and `doctor` already relocate; `sync` — the one
// command that WRITES — did not.

/** A workspace whose basalt install lives at the ROOT, with an app package below it. */
function installAtRoot(): void {
  write(
    'package.json',
    JSON.stringify({
      name: 'root',
      workspaces: ['apps/*'],
      basalt: { roots: ['apps/dashboard/src'] },
    }),
  )
  write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }))
  write(
    'apps/dashboard/package.json',
    JSON.stringify({ name: 'dashboard', dependencies: { 'basalt-ui': '*' } }),
  )
  write('apps/dashboard/src/app.tsx', 'export const App = () => null\n')
}

describe('sync — a scaffold is init’s decision, never a drift refresh’s', () => {
  it('refuses from a workspace sub-package and points at the install it found above', () => {
    installAtRoot()
    const { code, log } = capture(() => sync({}, join(dir, 'apps/dashboard')))
    expect(code).toBe(1)
    expect(log).toContain('refusing to scaffold')
    expect(log).toContain("This repo's install is at ../..")
  })

  it('writes NOTHING when it refuses — not the files, and not the second basalt key', () => {
    installAtRoot()
    capture(() => sync({}, join(dir, 'apps/dashboard')))
    // The `basalt.roots` backfill is half the damage: a second config site means check-theme
    // silently scans a different tree depending on which directory it was invoked from.
    expect(JSON.parse(read('apps/dashboard/package.json'))['basalt']).toBeUndefined()
    expect(readdirSync(join(dir, 'apps/dashboard')).toSorted()).toEqual(['package.json', 'src'])
  })

  it('refuses in a repo that was never a consumer, and names init as the command that is', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(1)
    expect(log).toContain('No manifest exists at any ancestor either')
    expect(log).toContain('basalt-ui init')
  })

  it('relocates to the single workspace package carrying the install, exactly as doctor does', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write('apps/web/package.json', JSON.stringify({ name: 'web', basalt: { roots: ['src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write(join('apps/web', MANIFEST_PATH), JSON.stringify({ version: 1, files: {} }))
    const { code, log } = capture(() => sync({ check: true }, dir))
    expect(log).toContain('running in ./apps/web, where it lives')
    // --check on an unsynced package is legitimately stale; what matters is WHERE it looked.
    expect(code).toBe(1)
  })

  it('short-circuits on an ambiguous workspace instead of picking one to scaffold', () => {
    ambiguousWorkspace()
    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(1)
    expect(log).toContain('2 packages below it carry one')
    expect(log).toContain('BASALT_CWD')
  })

  it('says created, not recreated, for a file the ledger never recorded', () => {
    // `0 updated, 20 recreated` described a scaffold as a refresh. "Recreated" means the ledger
    // placed it once and it went missing; a file basalt never wrote here is CREATED.
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }))
    const { log } = capture(() => sync({}, dir))
    expect(log).toMatch(/0 updated, \d+ created, 0 recreated/)
  })

  it('says recreated for a managed file the ledger recorded and someone deleted', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    capture(() => init(dir))
    const placed = '.claude/rules/basalt-tokens.md'
    rmSync(join(dir, placed))
    const { log } = capture(() => sync({}, dir))
    expect(log).toContain('1 recreated')
  })
})

// ── doctor's exit status, pinned per outcome ──────────────────────────────────────────────────
//
// argo reported two hard failures exiting 0. It does not reproduce (see the report), but the gap
// that let 1.20.0 ship a SKIPPED-exits-0 bug was that the tests asserted printed TEXT and never the
// status. These assert the status for every outcome, including the combinations.

describe('doctor — exit status per outcome, not per printed string', () => {
  it('pass-only exits 0 and is the only state that may print "All checks passed"', () => {
    healthyFixture()
    const { code, log } = capture(() => doctor(dir))
    expect([code, log.includes('All checks passed')]).toEqual([0, true])
  })

  it('warn-only exits 0 — a warning is a schedule, not a build break', () => {
    healthyFixture()
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: '0.4.2' }),
    )
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('warning(s)')
    expect(log).not.toContain('hard failure')
    expect(log).not.toContain('All checks passed')
    expect(code).toBe(0)
  })

  it('one hard failure exits 1', () => {
    healthyFixture()
    rmSync(join(dir, '.oxlintrc.json'))
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('1 hard failure(s)')
    expect(code).toBe(1)
  })

  it('TWO hard failures exit 1 — the shape argo reported as exiting 0', () => {
    // argo's exact pair: no manifest and no .oxlintrc.json, in a Mantine repo (so the profile
    // stays `framework` and both checks are real rather than n/a).
    healthyFixture()
    write(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        dependencies: { '@mantine/core': '^9.3.0' },
        basalt: { roots: ['src'] },
      }),
    )
    rmSync(join(dir, '.oxlintrc.json'))
    rmSync(join(dir, MANIFEST_PATH))
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('2 hard failure(s)')
    expect(code).toBe(1)
  })

  it('a SKIPPED check exits 1 on its own, with no failure and no warning', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }))
    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('SKIPPED')
    expect(code).toBe(1)
  })

  it('an ambiguous project exits 1 before any check runs', () => {
    ambiguousWorkspace()
    expect(capture(() => doctor(dir)).code).toBe(1)
  })

  it('contradictory profile flags exit 1', () => {
    healthyFixture()
    expect(capture(() => doctor(dir, ['--tokens-only', '--framework'])).code).toBe(1)
  })
})

// ── the project resolver, for a repo that declares no workspaces ───────────────────────────────
//
// linewatch keeps its whole basalt consumer in `web/` and declares no `workspaces` field anywhere.
// Measured at its repo root, all three project-scoped commands got that wrong in a different way:
// `check-theme` printed `✓ no off-palette colors` having scanned ZERO files, `doctor` inferred
// `tokens-only` for a full Mantine consumer, and `sync` refused while naming `basalt-ui init` as
// the remedy — the one command that WOULD have written a competing install at the root. The
// workspace-declaration path already handled image-share's `apps/admin`; nothing handled this.

/** linewatch's shape: no `workspaces` field, the whole consumer one directory down. */
function undeclaredChild(child = 'web'): void {
  write('package.json', JSON.stringify({ name: 'root' }))
  write(`${child}/package.json`, JSON.stringify({ name: child, basalt: { roots: ['src'] } }))
  write(`${child}/src/app.tsx`, "export const c = '#ff0000'\n")
  write(join(child, MANIFEST_PATH), JSON.stringify({ version: 1, files: {} }))
}

describe('resolveProjectDir — a repo that declares no workspaces still has a layout', () => {
  it('sync relocates into the undeclared child instead of refusing with init as the advice', () => {
    undeclaredChild()
    const { log } = capture(() => sync({ check: true }, dir))
    expect(log).toContain('running in ./web, where it lives')
    expect(log).not.toContain('basalt-ui init')
  })

  it('sync writes NOTHING at the root it was invoked from', () => {
    undeclaredChild()
    capture(() => sync({}, dir))
    expect(readdirSync(dir).toSorted()).toEqual(['package.json', 'web'])
    expect(readPkg()['basalt']).toBeUndefined()
  })

  it('check-theme scans the child rather than reporting green over zero files', () => {
    undeclaredChild()
    const { code, log } = capture(() => checkTheme(dir, []))
    expect(log).toContain('running in ./web, where it lives')
    expect(log).not.toContain('no off-palette colors')
    expect(code).toBe(1)
  })

  it('doctor reports on the child, so it cannot infer tokens-only from the empty root', () => {
    undeclaredChild()
    const { log } = capture(() => doctor(dir, []))
    expect(log).toContain(join(dir, 'web'))
    expect(log).not.toContain('profile: tokens-only')
  })

  it('two undeclared children are ambiguous, named, and never guessed between', () => {
    undeclaredChild('web')
    undeclaredChild('admin')
    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(1)
    expect(log).toContain('2 packages below it carry one')
    expect(log).toContain('./admin')
    expect(log).toContain('./web')
    expect(readdirSync(dir)).not.toContain('DESIGN.md')
  })

  it('a declared workspaces field still wins — the layout scan is a fallback, not a union', () => {
    // `stray/` carries a basalt key but is not a workspace package. Treating both as candidates
    // would turn a working single-candidate repo into an ambiguity error on upgrade.
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write('apps/web/package.json', JSON.stringify({ name: 'web', basalt: { roots: ['src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write(join('apps/web', MANIFEST_PATH), JSON.stringify({ version: 1, files: {} }))
    write('stray/package.json', JSON.stringify({ name: 'stray', basalt: { roots: ['src'] } }))
    const { log } = capture(() => sync({ check: true }, dir))
    expect(log).toContain('running in ./apps/web, where it lives')
  })
})

// ── sync honours the profile doctor already reads ──────────────────────────────────────────────
//
// rollhook is tokens-only in both apps and declares it. `sync` told it to run `basalt-ui init` —
// the exact advice `doctor`, in the same directory at the same version, exists to prevent — and
// exited 1, which also put `sync --check` out of reach of the one CI drift gate every other
// consumer runs.

describe('sync — tokens-only is a pass, not a refusal', () => {
  function tokensOnly(): void {
    write(
      'package.json',
      JSON.stringify({ name: 'marketing', basalt: { roots: ['src'], profile: 'tokens-only' } }),
    )
    write('src/app.ts', 'export const c = 1\n')
  }

  it('reports n/a and exits 0, mirroring doctor’s manifest row', () => {
    tokensOnly()
    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    expect(log).toContain('n/a — a tokens-only consumer has no scaffold to reconcile')
    expect(log).not.toContain('basalt-ui init')
  })

  it('is wirable into CI: --check exits 0 instead of failing on a scaffold it must not have', () => {
    tokensOnly()
    expect(capture(() => sync({ check: true, flags: [] }, dir)).code).toBe(0)
  })

  it('writes nothing — no manifest, no DESIGN.md, no basalt.roots backfill', () => {
    tokensOnly()
    capture(() => sync({}, dir))
    expect(readdirSync(dir).toSorted()).toEqual(['package.json', 'src'])
  })

  it('--framework forces the full profile back on', () => {
    tokensOnly()
    const { code, log } = capture(() => sync({ flags: ['--framework'] }, dir))
    expect(code).toBe(1)
    expect(log).toContain('refusing to scaffold')
  })

  it('contradictory profile flags exit 1, exactly as they do for check-theme and doctor', () => {
    tokensOnly()
    expect(capture(() => sync({ flags: ['--tokens-only', '--framework'] }, dir)).code).toBe(1)
  })
})

// ── no shipped artifact carries a version number that goes stale ───────────────────────────────
//
// `DESIGN.md` is a seed: written once at init, then consumer-owned and never reconciled. Its
// opener stamped `{{BASALT_VERSION}}`, so across the seven consumers the same line read 1.0.0,
// 1.9.0, 1.21.0 and 1.22.0 under an identical 1.22.0 install — reported three rounds running as
// four separate doc bugs. It was one bug: a version number in a file nothing ever rewrites.

describe('DESIGN.md carries no version, and sync heals the ones already written', () => {
  function seeded(): void {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    capture(() => init(dir))
  }

  it('a fresh scaffold stamps no version at all', () => {
    seeded()
    expect(read('DESIGN.md')).not.toMatch(/Managed by basalt-ui \(\d+\.\d+\.\d+\)/)
    expect(read('DESIGN.md')).toContain('run `basalt-ui doctor` for the version')
  })

  it('sync rewrites a stale opener in place and leaves the rest of the file alone', () => {
    seeded()
    const consumerOwned = '\n## Series\n\nOurs: hrv, rhr.\n'
    write('DESIGN.md', `# app — Design\n\n> Managed by basalt-ui (1.9.0). Thin.\n${consumerOwned}`)
    capture(() => sync({}, dir))
    expect(read('DESIGN.md')).toContain(
      '> Managed by basalt-ui — run `basalt-ui doctor` for the version. Thin.',
    )
    expect(read('DESIGN.md')).toContain(consumerOwned)
  })

  it('--check writes nothing, including the heal', () => {
    seeded()
    const stale = '# app — Design\n\n> Managed by basalt-ui (1.9.0). Thin.\n'
    write('DESIGN.md', stale)
    capture(() => sync({ check: true }, dir))
    expect(read('DESIGN.md')).toBe(stale)
  })

  it('leaves an opener the consumer already rewrote by hand untouched', () => {
    seeded()
    const owned = '# app — Design\n\n> Our own words entirely.\n'
    write('DESIGN.md', owned)
    capture(() => sync({}, dir))
    expect(read('DESIGN.md')).toBe(owned)
  })
})

// ── The ascend direction ──────────────────────────────────────────────────────
// Round 9, basalt-ui-obsidian: from `apps/demo` — a package with no `basalt` key of its own —
// `check-theme` invented `roots: ["src"]`, scanned 22 of the repo's 44 guarded files, printed
// `✓ no off-palette colors`, and reported the invention back as `basalt.roots (src)`. Its
// `--audit-allows` then reported `0 live` for a repo carrying one live waiver: a clean slate from
// the one command whose entire job is to deny one. `doctor`, standing in the same directory,
// already resolved the parent. The descend direction announced itself; only ascend was silent.
describe('check-theme / doctor — ascend to the parent config instead of fabricating one', () => {
  /** Repo root owns the config and names TWO roots; neither package declares anything. */
  function twoRootRepo(): void {
    write('.git/HEAD', 'ref: refs/heads/master\n')
    write(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        workspaces: ['packages/*', 'apps/*'],
        basalt: { roots: ['packages/lib/src', 'apps/demo/src'] },
      }),
    )
    write('packages/lib/package.json', JSON.stringify({ name: 'lib' }))
    write('apps/demo/package.json', JSON.stringify({ name: 'demo' }))
    write('apps/demo/src/App.tsx', 'export const App = () => null\n')
  }

  it('scans the WHOLE declared surface from a package that declares nothing, and says so', () => {
    twoRootRepo()
    // The violation sits in the sibling root — the half the fabricated `src` default never read.
    write('packages/lib/src/Card.tsx', `export const C = () => <div style={{ borderRadius: 8 }} />`)

    const { code, log } = capture(() => checkTheme(join(dir, 'apps/demo')))
    expect(log).toContain('running in ../.., where it lives')
    expect(code).toBe(1)
    expect(log).toContain('raw-surface')
  })

  it('--audit-allows reports the repo’s real waiver count, not zero', () => {
    twoRootRepo()
    write(
      'packages/lib/src/Card.tsx',
      'export const C = () => <div style={{ borderRadius: 8 }} /> // theme-allow: legacy widget\n',
    )

    const { code, log } = capture(() => checkTheme(join(dir, 'apps/demo'), ['--audit-allows']))
    expect(code).toBe(0)
    expect(log).toContain('1 live, 0 dead')
    expect(log).toContain('basalt.roots (packages/lib/src, apps/demo/src)')
  })

  it('doctor and check-theme now answer with the SAME project dir', () => {
    twoRootRepo()
    write('packages/lib/src/Card.tsx', 'export const C = () => null\n')
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }))
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    installBasalt()

    const { log } = capture(() => doctor(join(dir, 'apps/demo')))
    expect(log).toContain('reporting on ../.., where it lives')
    expect(log).toContain(`basalt-ui doctor — ${dir}`)
  })

  it('never ascends out of the repo — no .git above cwd means no ancestor to read', () => {
    // No `.git` anywhere: the walk has no bound, so it refuses to walk at all and the built-in
    // defaults apply exactly as they did before. A standalone consumer is untouched by this.
    write('package.json', JSON.stringify({ name: 'root', basalt: { roots: ['packages/lib/src'] } }))
    write('packages/lib/package.json', JSON.stringify({ name: 'lib' }))
    write('packages/lib/src/App.tsx', 'export const App = () => null\n')

    const { code, log } = capture(() => checkTheme(join(dir, 'packages/lib')))
    expect(log).not.toContain('where it lives')
    expect(code).toBe(0)
  })

  it('BASALT_CWD still wins over the ascend', () => {
    twoRootRepo()
    write('packages/lib/src/Card.tsx', 'export const C = () => null\n')
    write('apps/demo/package.json', JSON.stringify({ name: 'demo', basalt: { roots: ['src'] } }))
    process.env['BASALT_CWD'] = join(dir, 'apps/demo')
    try {
      const { code, log } = capture(() => checkTheme(dir, ['--audit-allows']))
      expect(code).toBe(0)
      expect(log).toContain('basalt.roots (src)')
    } finally {
      delete process.env['BASALT_CWD']
    }
  })
})

// ── The icons check, reachable wherever doctor runs ───────────────────────────
// Round 9, rb and argo: the root run — the ONLY invocation that can exit 0 on a monorepo layout —
// omitted the icons check entirely, with no `⊘ SKIPPED` line. It read `cwd/public` and `cwd`'s
// vite config, and in a monorepo both live in the app package. A check that vanishes without a
// word is indistinguishable from one that passed.
describe('doctor — the icons check is reachable from the root, or says why not', () => {
  /** A monorepo whose app package owns the vite config, the public/ tree and nothing else. */
  function appPackageRepo(viteConfig: string): void {
    write('.git/HEAD', 'ref: refs/heads/master\n')
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['apps/web/src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write('apps/web/vite.config.ts', viteConfig)
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: CLI_VERSION }))
    installBasalt()
  }

  it('reads the app package’s `icons` array from a ROOT-invoked run', () => {
    appPackageRepo("export default basaltAppPlugin({ icons: [{ src: '/favicon.svg' }] })\n")
    write('apps/web/public/favicon.svg', '<svg/>')

    const { log } = capture(() => doctor(dir))
    expect(log).toContain("apps/web/public/ has all 1 icon file(s) basaltAppPlugin's `icons`")
  })

  it('reports a missing icon from the root too — it is not just reachable, it judges', () => {
    appPackageRepo("export default basaltAppPlugin({ icons: [{ src: '/favicon.svg' }] })\n")
    write('apps/web/public/.keep', '')

    const { log } = capture(() => doctor(dir))
    expect(log).toContain('basaltAppPlugin declares icon(s) that are not in ./apps/web/public/')
  })

  it('SKIPS loudly when the plugin is configured but has no public/ beside it', () => {
    appPackageRepo("export default basaltAppPlugin({ icons: [{ src: '/favicon.svg' }] })\n")

    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('⊘ SKIPPED — app icons — ./apps/web configures basaltAppPlugin')
    expect(code).toBe(1)
  })

  it('states the absence rather than omitting the line when nothing uses the plugin', () => {
    write('.git/HEAD', 'ref: refs/heads/master\n')
    healthyFixture()

    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('no `basaltAppPlugin(` under this project')
    expect(code).toBe(0)
  })

  it('`icons: false` is nothing to check, from the root as from the package', () => {
    appPackageRepo('export default basaltAppPlugin({ icons: false })\n')

    const { code, log } = capture(() => doctor(dir))
    expect(log).toContain('basaltAppPlugin is configured with no icons')
    expect(code).toBe(0)
  })
})
