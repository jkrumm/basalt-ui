/**
 * The 2.0 upgrade path: `doctor`'s `tsconfig-base` / `retired-lint-rules` / `dropped-subpaths`
 * checks, `sync` carrying a 1.41-shaped install forward, and the seeds compiling against `dist`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BASALT_CONFIG_KEYS } from './config'
import type { BasaltConfig } from './config'
import { SURFACES } from '../surfaces'
import { doctor } from './doctor'
import {
  appWiringCheck,
  shellDeclarationFindings,
  startWiringWarnings,
  droppedSubpathsCheck as droppedSubpathsCheckOn,
  exactPeersCheck,
  migratingSince,
  oxlintFloorCheck,
  retiredLintRulesCheck,
  seedTsconfigExtends,
  staleEmittedSheets,
  SUBPATH_REQUIRED_PEERS,
  subpathPeersCheck as subpathPeersCheckOn,
  tsconfigBaseCheck,
  unknownConfigKeysCheck,
} from './doctor-upgrade'
import type { Check } from './doctor-upgrade'
import {
  init,
  MANIFEST_PATH,
  mergeOxlintExtends,
  normalizeForLedger,
  scannableFiles,
  sha256,
  sync,
} from './index'
import { parseJsonc } from './source-text'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const PKG_VERSION = (
  JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as { version: string }
).version

let dir: string

/** The failure or skip text of a check, or null when it passed. */
const text = (check: Check): string | null =>
  check === null ? null : 'fail' in check ? check.fail : check.skip

function write(rel: string, content: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), content, 'utf8')
}

function read(rel: string): string {
  return readFileSync(join(dir, rel), 'utf8')
}

function capture(fn: () => number): { code: number; log: string } {
  const { log: origLog, error: origError } = console
  let log = ''
  console.log = (...args: unknown[]) => void (log += `${args.join(' ')}\n`)
  console.error = (...args: unknown[]) => void (log += `${args.join(' ')}\n`)
  try {
    return { code: fn(), log }
  } finally {
    console.log = origLog
    console.error = origError
  }
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-upgrade-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const subpathPeersCheck = (
  cwd: string,
  cfg: Parameters<typeof scannableFiles>[1],
  install: Parameters<typeof subpathPeersCheckOn>[2],
) => subpathPeersCheckOn(cwd, scannableFiles(cwd, cfg), install)
const droppedSubpathsCheck = (
  cwd: string,
  cfg: Parameters<typeof scannableFiles>[1],
  install: Parameters<typeof droppedSubpathsCheckOn>[2],
) => droppedSubpathsCheckOn(cwd, scannableFiles(cwd, cfg), install)

describe('doctor — tsconfig-base', () => {
  it('passes when tsconfig.json extends the react-app or base preset', () => {
    write('tsconfig.json', '{ "extends": "basalt-ui/configs/tsconfig.react-app.json" }')
    expect(text(tsconfigBaseCheck(dir))).toBeNull()
    write('tsconfig.json', '{ "extends": ["./x.json", "basalt-ui/configs/tsconfig.base.json"] }')
    expect(text(tsconfigBaseCheck(dir))).toBeNull()
  })

  it('follows a solution-style tsconfig into the app config it references', () => {
    write('tsconfig.json', '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }')
    write('tsconfig.app.json', '// comment\n{ "extends": "./tsconfig.local", }')
    write(
      'tsconfig.local.json',
      '{ "extends": "./node_modules/basalt-ui/configs/tsconfig.base.json" }',
    )
    expect(text(tsconfigBaseCheck(dir))).toBeNull()
  })

  it('fails with the exact extends value to set', () => {
    write('tsconfig.json', '{ "compilerOptions": { "strict": true } }')
    const problem = text(tsconfigBaseCheck(dir))
    expect(problem).toContain('"extends": "basalt-ui/configs/tsconfig.react-app.json"')
    expect(problem).toContain('exactOptionalPropertyTypes')
  })

  it('fails on a missing tsconfig.json', () => {
    expect(text(tsconfigBaseCheck(dir))).toContain('tsconfig.json missing')
  })
})

describe('doctor — retired-lint-rules', () => {
  const install = (): { dir: string; version: string; how: 'cwd' } => ({
    dir: join(dir, 'node_modules/basalt-ui'),
    version: PKG_VERSION,
    how: 'cwd',
  })

  function plugin(): void {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', type: 'module' }),
    )
    write(
      'node_modules/basalt-ui/configs/oxlint-plugin.js',
      [
        'export const RETIRED_RULE_IDS = new Set([',
        "  'visx-boundary', // gone with the visx layer",
        '])',
        'export default {',
        "  meta: { name: 'basalt' },",
        '  rules: {',
        "    'card-inset': {},",
        '  },',
        '}',
      ].join('\n'),
    )
  }

  it('names every retired or unregistered basalt/<id>, in rules and overrides, with its fix', () => {
    plugin()
    write(
      '.oxlintrc.json',
      JSON.stringify({
        rules: { 'basalt/visx-boundary': 'error', 'basalt/card-inset': 'error' },
        overrides: [{ files: ['*.tsx'], rules: { 'basalt/page-bar-budget': 'warn' } }],
      }),
    )
    const problem = text(retiredLintRulesCheck(dir, install()))
    expect(problem).toContain('basalt/visx-boundary')
    expect(problem).toContain(
      'basalt/page-bar-budget (the PageBarActions/SectionActions tuple types',
    )
    expect(problem).not.toContain('basalt/card-inset')
    expect(problem).toContain('Fix: delete each entry')
  })

  it('follows a local extends and passes a clean config', () => {
    plugin()
    write('.oxlintrc.json', '{ "extends": ["./base.json"] }')
    write('base.json', '{ "rules": { "basalt/provider-above-router": "error" } }')
    expect(text(retiredLintRulesCheck(dir, install()))).toContain('basalt/provider-above-router')
    write('base.json', '{ "rules": { "basalt/card-inset": "error" } }')
    expect(text(retiredLintRulesCheck(dir, install()))).toBeNull()
  })

  it('reads the real shipped plugin: a visx-era id is retired, a live id is not', () => {
    write(
      '.oxlintrc.json',
      '{ "rules": { "basalt/visx-boundary": "error", "basalt/card-inset": "error" } }',
    )
    const problem = text(
      retiredLintRulesCheck(dir, { dir: PKG_ROOT, version: PKG_VERSION, how: 'cwd' }),
    )
    expect(problem).toContain('basalt/visx-boundary')
    expect(problem).not.toContain('basalt/card-inset')
  })
})

describe('doctor — config-keys', () => {
  it('BASALT_CONFIG_KEYS is exactly the keys of BasaltConfig', () => {
    const all = Object.fromEntries(BASALT_CONFIG_KEYS.map((k) => [k, true])) as Record<
      keyof BasaltConfig,
      true
    >
    expect(Object.keys(all)).toHaveLength(BASALT_CONFIG_KEYS.length)
    // Compile-time half: a key missing from the type or the list fails typecheck here.
    const _exhaustive: Record<keyof BasaltConfig, true> = all
    expect(_exhaustive).toBe(all)
  })

  it('flags the 2.0-deleted key by name and passes every declared key', () => {
    write('package.json', JSON.stringify({ basalt: { roots: ['src'], rawRadius: false } }))
    expect(text(unknownConfigKeysCheck(dir))).toBeNull()
    write(
      'package.json',
      JSON.stringify({ basalt: { roots: ['src'], chartMissingAriaLabel: 'warn', typo: 1 } }),
    )
    const problem = text(unknownConfigKeysCheck(dir))
    expect(problem).toContain('basalt.chartMissingAriaLabel (its guard kind is gone')
    expect(problem).toContain('basalt.typo (not a basalt key)')
    expect(problem).not.toContain('basalt.roots')
  })

  it('passes with no basalt block or no package.json', () => {
    expect(text(unknownConfigKeysCheck(dir))).toBeNull()
    write('package.json', '{}')
    expect(text(unknownConfigKeysCheck(dir))).toBeNull()
  })
})

describe('doctor — exact-peers', () => {
  const install = (): { dir: string; version: null; how: 'cwd' } => ({
    dir: join(dir, 'node_modules/basalt-ui'),
    version: null,
    how: 'cwd',
  })

  it('names a mismatched exact peer with its fix; ranges, matches and absent peers pass', () => {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({
        peerDependencies: {
          motion: '14.1.0',
          remend: '1.4.0',
          shiki: '^4.5.0',
          'd3-scale': '4.0.2',
        },
      }),
    )
    write('node_modules/motion/package.json', '{"version":"14.0.0"}')
    write('node_modules/remend/package.json', '{"version":"1.4.0"}')
    write('node_modules/shiki/package.json', '{"version":"4.9.0"}')
    const problem = text(exactPeersCheck(dir, install()))
    expect(problem).toContain('motion@14.0.0 (basalt-ui pins 14.1.0): `bun add motion@14.1.0`')
    expect(problem).not.toContain('remend')
    expect(problem).not.toContain('shiki')
    expect(problem).not.toContain('d3-scale')
    write('node_modules/motion/package.json', '{"version":"14.1.0"}')
    expect(exactPeersCheck(dir, install())).toBeNull()
  })

  it('skips when basalt-ui does not resolve', () => {
    expect(text(exactPeersCheck(dir, { dir: null, version: null, how: null }))).toContain(
      'exact-peers',
    )
  })
})

describe('doctor — dropped-subpaths', () => {
  const installAt = { dir: '', version: null, how: 'cwd' as const }
  const installIn = (): typeof installAt => ({
    ...installAt,
    dir: join(dir, 'node_modules/basalt-ui'),
  })
  const check = (): Check =>
    droppedSubpathsCheck(
      dir,
      { roots: ['src'] },
      { ...installAt, dir: join(dir, 'node_modules/basalt-ui') },
    )

  function exportsMap(): void {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({
        name: 'basalt-ui',
        exports: { '.': {}, './state': {}, './styles.css': '', './configs/*': '' },
      }),
    )
  }

  it('flags every import form with its line, ignores live subpaths', () => {
    exportsMap()
    write(
      'src/app.tsx',
      [
        "import { a } from 'basalt-ui'",
        "import { q } from 'basalt-ui/query'",
        "import 'basalt-ui/styles.css'",
        "import { s } from 'basalt-ui/state'",
        "import type { T } from 'basalt-ui/data'",
        "export { x } from 'basalt-ui/notifications'",
        'const m = await import("basalt-ui/connectivity")',
        "const r = require('basalt-ui/agent-chat')",
        'import {',
        '  A,',
        "} from 'basalt-ui/forms'",
      ].join('\n'),
    )
    const problem = text(check())
    for (const [line, sub] of [
      [2, 'query'],
      [5, 'data'],
      [6, 'notifications'],
      [7, 'connectivity'],
      [8, 'agent-chat'],
      [11, 'forms'],
    ]) {
      expect(problem).toContain(`src/app.tsx:${line} imports basalt-ui/${sub}`)
    }
    expect(problem).not.toContain('basalt-ui/state')
    expect(problem).not.toContain('basalt-ui/styles.css')
    expect(problem).toContain('MIGRATING.md § 2.0')
  })

  it('flags CSS @import forms of a dropped subpath and names the tokens:css fix', () => {
    exportsMap()
    write(
      'src/app.css',
      [
        "@import 'basalt-ui/tokens.css';",
        '@import "basalt-ui/tokens.css";',
        "@import url('basalt-ui/tokens.css');",
        '@import url(basalt-ui/tokens.css);',
        "@import 'basalt-ui/styles.css';",
        "/* @import 'basalt-ui/query'; */",
      ].join('\n'),
    )
    write('src/main.ts', "import 'basalt-ui/tokens.css'\n")
    const problem = text(check())
    for (const line of [1, 2, 3, 4]) {
      expect(problem).toContain(`src/app.css:${line} imports basalt-ui/tokens.css`)
    }
    expect(problem).toContain('src/main.ts:1 imports basalt-ui/tokens.css')
    expect(problem).not.toContain('src/app.css:5')
    expect(problem).not.toContain('src/app.css:6')
    expect(problem).toContain('basalt-ui tokens:css --out')
  })

  it('flags router-tanstack even when the resolved install is a stale 1.x that exports it', () => {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', exports: { '.': {}, './router-tanstack': {} } }),
    )
    write('src/nav.ts', "import { defineNav } from 'basalt-ui/router-tanstack'\n")
    const problem = text(check())
    expect(problem).toContain('src/nav.ts:1 imports basalt-ui/router-tanstack')
    expect(problem).toContain('`basalt-ui/state`')
  })

  it('scans the cwd source when the cwd lives under a .claude/worktrees dot-directory', () => {
    const wt = join(dir, '.claude/worktrees/x')
    mkdirSync(join(wt, 'src'), { recursive: true })
    writeFileSync(join(wt, 'src/nav.ts'), "import { a } from 'basalt-ui/router-tanstack'\n")
    writeFileSync(join(wt, 'src/app.css'), "@import 'basalt-ui/tokens.css';\n")
    exportsMap()
    const problem = text(
      droppedSubpathsCheck(
        wt,
        { roots: ['src'] },
        { ...installAt, dir: join(dir, 'node_modules/basalt-ui') },
      ),
    )
    expect(problem).toContain('src/nav.ts:1 imports basalt-ui/router-tanstack')
    expect(problem).toContain('src/app.css:1 imports basalt-ui/tokens.css')
  })

  it('does not fire on a CSS @import that sits inside a declaration value', () => {
    exportsMap()
    write('src/a.css', '.a::before { content: "@import \'basalt-ui/tokens.css\'"; }\n')
    write('src/b.css', "a { color: red; } @import 'basalt-ui/tokens.css';\n")
    const problem = text(check())
    expect(problem).not.toContain('src/a.css')
    expect(problem).toContain('src/b.css:1')
  })

  it('names each dropped subpath fix once, however many files import it', () => {
    exportsMap()
    write('src/a.ts', "import 'basalt-ui/tokens.css'\nimport 'basalt-ui/router-tanstack'\n")
    write('src/b.ts', "import 'basalt-ui/tokens.css'\nimport 'basalt-ui/router-tanstack'\n")
    const problem = text(check()) ?? ''
    expect(problem.split('basalt-ui/tokens.css: commit').length).toBe(2)
    expect(problem.split('basalt-ui/router-tanstack: nav').length).toBe(2)
  })

  it('ignores a ; inside a quoted CSS string before an @import-looking text', () => {
    exportsMap()
    write('src/a.css', '.a::before { content: "x; @import \'basalt-ui/tokens.css\'"; }\n')
    expect(check()).toBeNull()
  })

  it('treats Object.prototype names as ordinary subpaths', () => {
    exportsMap()
    write('src/a.ts', "import 'basalt-ui/constructor'\n")
    expect(text(check())).toContain('src/a.ts:1 imports basalt-ui/constructor')
    expect(text(check())).not.toContain('basalt-ui/constructor:')
  })

  it('does not fire on a commented-out import or a string that merely contains one', () => {
    exportsMap()
    write(
      'src/app.tsx',
      [
        "// import { q } from 'basalt-ui/query'",
        "/* import { q } from 'basalt-ui/query' */",
        '/*',
        " * import { q } from 'basalt-ui/query'",
        ' */',
        'const doc = "import { q } from \'basalt-ui/query\'"',
        'const tpl = `',
        "  see basalt-ui/query for 'basalt-ui/query'",
        '`',
        "const url = 'http://x' // import 'basalt-ui/query'",
      ].join('\n'),
    )
    expect(check()).toBeNull()
  })

  it('ignores imports that only appear inside strings or as a method call, and scans .mjs/.cts', () => {
    exportsMap()
    write(
      'src/app.tsx',
      [
        'const a = "require(\'basalt-ui/query\')"',
        'const t = `',
        "import { q } from 'basalt-ui/query'",
        '`',
        "obj.require('basalt-ui/data')",
        "obj.import('basalt-ui/data')",
      ].join('\n'),
    )
    expect(check()).toBeNull()
    write('src/a.mjs', "import { q } from 'basalt-ui/query'\n")
    write('src/b.cts', "const q = require('basalt-ui/data')\n")
    const problem = text(check())
    expect(problem).toContain('src/a.mjs:1 imports basalt-ui/query')
    expect(problem).toContain('src/b.cts:1 imports basalt-ui/data')
  })

  it('reuses the scan: skips test files, honours exempt and include, and a missing root is empty', () => {
    exportsMap()
    const bad = "import { q } from 'basalt-ui/query'\n"
    write('src/app.test.ts', bad)
    write('src/types.d.ts', bad)
    write('src/exempt.ts', bad)
    expect(
      droppedSubpathsCheck(dir, { roots: ['src', 'nope'], exempt: ['src/exempt.ts'] }, installIn()),
    ).toBeNull()
    write('scripts/tool.ts', bad)
    const problem = text(
      droppedSubpathsCheck(
        dir,
        { roots: ['src'], exempt: ['src/exempt.ts'], include: ['scripts/tool.ts'] },
        installIn(),
      ),
    )
    expect(problem).toContain('scripts/tool.ts:1')
    expect(problem).not.toContain('src/')
  })

  it('scans ${…} interpolations inside a template literal but not its text', () => {
    exportsMap()
    write(
      'src/app.tsx',
      [
        'const t = `see ${require("basalt-ui/query")} and',
        "import x from 'basalt-ui/data'",
        '`',
      ].join('\n'),
    )
    const problem = text(check())
    expect(problem).toContain('src/app.tsx:1 imports basalt-ui/query')
    expect(problem).not.toContain('basalt-ui/data')
  })

  it('SKIPS both upgrade checks when basalt-ui does not resolve', () => {
    const none = { dir: null, version: null, how: null }
    expect(droppedSubpathsCheck(dir, { roots: ['src'] }, none)).toHaveProperty('skip')
    expect(retiredLintRulesCheck(dir, none)).toHaveProperty('skip')
  })

  it('SKIPS (never passes) when the installed exports map cannot be read', () => {
    write('src/app.tsx', "import { q } from 'basalt-ui/query'\n")
    expect(text(check())).toContain('cannot run')
    expect(check()).toHaveProperty('skip')
    write('node_modules/basalt-ui/package.json', '{ not json')
    expect(check()).toHaveProperty('skip')
  })
})

describe('doctor — checks that cannot run are SKIPPED, not green', () => {
  it('retired-lint-rules skips on a plugin that cannot be loaded or registers nothing', () => {
    write('.oxlintrc.json', '{ "rules": { "basalt/card-inset": "error" } }')
    const install = { dir: join(dir, 'node_modules/basalt-ui'), version: null, how: 'cwd' as const }
    write('node_modules/basalt-ui/configs/oxlint-plugin.js', 'export default { rules: ')
    expect(retiredLintRulesCheck(dir, install)).toHaveProperty('skip')
    write('node_modules/basalt-ui/package.json', JSON.stringify({ type: 'module' }))
    write('node_modules/basalt-ui/configs/oxlint-plugin.js', 'export default { rules: {} }')
    expect(retiredLintRulesCheck(dir, install)).toHaveProperty('skip')
  })

  it('tsconfig-base skips on a bare extends that does not resolve', () => {
    write('tsconfig.json', '{ "extends": "@org/tsconfig" }')
    expect(tsconfigBaseCheck(dir)).toHaveProperty('skip')
  })

  it('tsconfig-base follows a bare extends that resolves through node_modules', () => {
    write('tsconfig.json', '{ "extends": "@org/other" }')
    write('node_modules/@org/other/package.json', JSON.stringify({ name: '@org/other' }))
    write(
      'node_modules/@org/other/tsconfig.json',
      '{ "extends": "basalt-ui/configs/tsconfig.base.json" }',
    )
    expect(tsconfigBaseCheck(dir)).toBeNull()
  })

  it('tsconfig-base skips, rather than failing with an extends fix, on a file it cannot parse', () => {
    write('tsconfig.json', '{ "extends": "./broken.json" }')
    write('broken.json', '{ nope')
    expect(text(tsconfigBaseCheck(dir))).toContain('could not parse')
    expect(tsconfigBaseCheck(dir)).toHaveProperty('skip')
  })

  it('a tsconfig.json that is a directory reads as absent: doctor fails it, init does not throw', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    mkdirSync(join(dir, 'tsconfig.json'))
    expect(tsconfigBaseCheck(dir)).toHaveProperty('fail')
    expect(capture(() => init(dir)).code).toBe(0)
  })

  it('retired-lint-rules tolerates null overrides and does not judge node_modules extends', () => {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', type: 'module' }),
    )
    write(
      'node_modules/basalt-ui/configs/oxlint-plugin.js',
      "export const RETIRED_RULE_IDS = new Set(['visx-boundary'])\nexport default { rules: { 'card-inset': {} } }\n",
    )
    write(
      '.oxlintrc.json',
      '{ "extends": ["./node_modules/pkg/old.json"], "overrides": [null], "rules": { "basalt/card-inset": "error" } }',
    )
    write('node_modules/pkg/old.json', '{ "rules": { "basalt/visx-boundary": "error" } }')
    const install = { dir: join(dir, 'node_modules/basalt-ui'), version: null, how: 'cwd' as const }
    expect(retiredLintRulesCheck(dir, install)).toBeNull()
  })

  it('tsconfig-base survives an extends cycle', () => {
    write('tsconfig.json', '{ "extends": "./a.json" }')
    write('a.json', '{ "extends": "./tsconfig.json" }')
    expect(tsconfigBaseCheck(dir)).toHaveProperty('fail')
  })

  it('doctor prints SKIPPED and exits 1 when a check cannot run', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export {}\n')
    write('tsconfig.json', '{ "extends": "basalt-ui/configs/tsconfig.react-app.json" }')
    write(
      '.oxlintrc.json',
      '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"], "rules": { "basalt/card-inset": "error" } }',
    )
    write('node_modules/basalt-ui/configs/oxlint.json', '{}')
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: PKG_VERSION }),
    )
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: PKG_VERSION }))
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    expect(log).toContain('SKIPPED retired-lint-rules')
    expect(log).not.toContain('All checks passed')
  })
})

describe('doctor — output', () => {
  it('prints the three new checks, each failure with a Fix: line', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write('src/app.tsx', "import { q } from 'basalt-ui/query'\n")
    write('tsconfig.json', '{}')
    write('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
    write('node_modules/basalt-ui/configs/oxlint.json', '{}')
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: PKG_VERSION, exports: { '.': {} } }),
    )
    write(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, basaltVersion: PKG_VERSION }))
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    for (const id of ['tsconfig-base', 'dropped-subpaths']) expect(log).toContain(`✖ ${id}:`)
    const failures = log.split('\n').filter((l) => l.includes('✖'))
    expect(failures.length).toBeGreaterThan(0)
    for (const line of failures) expect(line).toMatch(/Fix:|[Rr]un `|Add "extends"|Repoint/)
  })
})

describe('sync — carries a 1.41 install to the installed release', () => {
  // Strictly below the installed release, so the version assertions cannot pass vacuously.
  const [major = 0, minor = 0] = PKG_VERSION.split('.').map(Number)
  const OLD = minor > 0 ? `${major}.${minor - 1}.0` : `${major - 1}.99.0`
  const old = (dest: string): string => `# ${dest} as shipped at ${OLD}\n`

  it('updates untouched files, reports the edited one, rewrites the block, moves basaltVersion', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    const manifest = JSON.parse(read(MANIFEST_PATH)) as {
      basaltVersion: string
      files: Record<string, string>
    }
    const tracked = Object.keys(manifest.files).filter((d) => /^\.claude\/(rules|skills)\//.test(d))
    expect(tracked.filter((d) => d.startsWith('.claude/rules/'))).toHaveLength(6)
    // Every file under the shipped agent/skills tree is placed: each skill's SKILL.md and its references.
    const shipped = readdirSync(join(PKG_ROOT, 'agent/skills'), {
      recursive: true,
      encoding: 'utf8',
    })
      .filter((f) => f.endsWith('.md'))
      .map((f) => `.claude/skills/${f}`)
    expect(shipped.filter((f) => f.endsWith('/SKILL.md'))).toHaveLength(3)
    expect(shipped).toContain('.claude/skills/basalt-design/references/catalogue.md')
    expect(tracked.filter((d) => d.startsWith('.claude/skills/')).toSorted()).toEqual(
      shipped.toSorted(),
    )

    // Rewind to 1.41: old bytes on disk, ledger holding the hash of those bytes.
    for (const dest of tracked) {
      write(dest, old(dest))
      manifest.files[dest] = sha256(normalizeForLedger(old(dest)))
    }
    const edited = tracked[0] as string
    write(edited, `${old(edited)}my own rule\n`)
    const oldBlock = `<!-- basalt:begin ${OLD} -->\n## Basalt ${OLD}\n<!-- basalt:end -->`
    write('AGENTS.md', `# App\n\n${oldBlock}\n\nMine.\n`)
    manifest.files['AGENTS.md'] = sha256(normalizeForLedger(oldBlock))
    manifest.basaltVersion = OLD
    write(MANIFEST_PATH, JSON.stringify(manifest))

    const check = capture(() => sync({ check: true }, dir))
    expect(check.code).toBe(1)
    expect(OLD).not.toBe(PKG_VERSION)

    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    for (const dest of tracked.filter((d) => d !== edited)) expect(read(dest)).not.toContain(OLD)
    expect(read(edited)).toBe(`${old(edited)}my own rule\n`)
    expect(log).toContain(edited)
    const agents = read('AGENTS.md')
    expect(agents).toContain(`<!-- basalt:begin ${PKG_VERSION} -->`)
    expect(agents).not.toContain(`## Basalt ${OLD}`)
    expect(agents).toContain('# App')
    expect(agents).toContain('Mine.')
    expect((JSON.parse(read(MANIFEST_PATH)) as { basaltVersion: string }).basaltVersion).toBe(
      PKG_VERSION,
    )

    // The edited rule stays drifted until the consumer reconciles it; --force is that reconciliation.
    expect(capture(() => sync({ check: true }, dir)).code).toBe(1)
    capture(() => sync({ force: true }, dir))
    expect(capture(() => sync({ check: true }, dir)).code).toBe(0)
  })
})

describe('init seeds compile against dist', () => {
  const dist = join(PKG_ROOT, 'dist/index.d.ts')
  const tsc = join(PKG_ROOT, 'node_modules/.bin/tsc')
  let scratch: string

  beforeEach(() => {
    // Inside the package so `basalt-ui` self-resolves to dist and TanStack/React resolve upward.
    scratch = mkdtempSync(join(PKG_ROOT, '.seed-check-'))
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it.skipIf(!existsSync(dist) || !existsSync(tsc))(
    'nav.tsx, __root.tsx and main.tsx type-check',
    () => {
      writeFileSync(
        join(scratch, 'package.json'),
        JSON.stringify({
          name: 'seed-fixture',
          dependencies: { '@tanstack/react-router': '*', '@tanstack/react-query': '*' },
        }),
      )
      capture(() => init(scratch))
      mkdirSync(join(scratch, 'src'), { recursive: true })
      writeFileSync(join(scratch, 'src/env.d.ts'), "declare module '*.css'\n")
      writeFileSync(
        join(scratch, 'src/routeTree.gen.ts'),
        [
          "import { createRoute } from '@tanstack/react-router'",
          "import { Route as rootRoute } from './routes/__root'",
          "const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })",
          'export const routeTree = rootRoute.addChildren([indexRoute])',
          '',
        ].join('\n'),
      )
      writeFileSync(
        join(scratch, 'tsconfig.json'),
        JSON.stringify({
          extends: '../configs/tsconfig.react-app.json',
          // The scratch dir has its own package.json, so `basalt-ui` cannot self-resolve: point it at dist.
          compilerOptions: { paths: { 'basalt-ui': ['../dist/index.d.ts'] } },
          include: ['src'],
        }),
      )
      const run = Bun.spawnSync([tsc, '--noEmit', '-p', join(scratch, 'tsconfig.json')], {
        cwd: scratch,
      })
      expect(run.stdout.toString() + run.stderr.toString()).toBe('')
      expect(run.exitCode).toBe(0)
    },
  )
})

describe('init — a stock Vite react-ts app ends up doctor-green on tsconfig-base', () => {
  const STOCK_ROOT =
    '{\n  "files": [],\n  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]\n}\n'
  const STOCK_APP =
    '{\n  // Vite template\n  "compilerOptions": { "target": "ES2022", /* kept */ "jsx": "react-jsx" },\n  "include": ["src"]\n}\n'

  it('inserts extends textually into the config that covers src, keeping its comments', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('tsconfig.json', STOCK_ROOT)
    write('tsconfig.app.json', STOCK_APP)
    write('tsconfig.node.json', '{ "include": ["vite.config.ts"] }')
    expect(text(tsconfigBaseCheck(dir))).toContain('does not extend')
    capture(() => init(dir))
    expect(tsconfigBaseCheck(dir)).toBeNull()
    expect(read('tsconfig.app.json')).toContain(
      '"extends": "basalt-ui/configs/tsconfig.react-app.json",',
    )
    expect(read('tsconfig.app.json')).toContain('// Vite template')
    expect(read('tsconfig.app.json')).toContain('/* kept */')
    expect(read('tsconfig.json')).toBe(STOCK_ROOT)
    expect(read('tsconfig.node.json')).not.toContain('extends')
  })

  it('edits a leading-comment tsconfig, never creates one, and is idempotent', () => {
    expect(seedTsconfigExtends(dir)).toBeNull()
    expect(existsSync(join(dir, 'tsconfig.json'))).toBe(false)
    write('tsconfig.json', '// { not me\n{ "include": ["src"] }\n')
    expect(seedTsconfigExtends(dir)).toContain('added')
    expect(tsconfigBaseCheck(dir)).toBeNull()
    expect(seedTsconfigExtends(dir)).toBeNull()
  })

  it('handles a BOM: doctor reads it, and init twice leaves exactly one extends', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('tsconfig.json', '﻿{ "include": ["src"] }\n')
    expect(text(tsconfigBaseCheck(dir))).toContain('does not extend')
    capture(() => init(dir))
    capture(() => init(dir))
    const tsconfig = read('tsconfig.json')
    expect(tsconfig.match(/"extends"/g)).toHaveLength(1)
    expect(tsconfig.startsWith('﻿{')).toBe(true)
    expect(tsconfigBaseCheck(dir)).toBeNull()
  })

  it('adds no trailing comma to an empty object, and matches include spellings like ./src and src/**', () => {
    write('tsconfig.json', '{}')
    seedTsconfigExtends(dir)
    expect(parseJsonc(read('tsconfig.json'))).toEqual({
      extends: 'basalt-ui/configs/tsconfig.react-app.json',
    })
    write('tsconfig.json', '{ "references": [null, { "path": "./app.json" }] }')
    write('app.json', '{ "include": ["./src/**/*"] }')
    seedTsconfigExtends(dir)
    expect(read('app.json')).toContain('"extends"')
    expect(read('tsconfig.json')).not.toContain('"extends"')
  })

  it('never writes extends into a solution-style root; it prints the fix when no reference covers src', () => {
    const root = '{ "files": [], "references": [{ "path": "./tsconfig.node.json" }] }\n'
    write('tsconfig.json', root)
    write('tsconfig.node.json', '{ "include": ["vite.config.ts"] }')
    const line = seedTsconfigExtends(dir)
    expect(line).toContain('solution-style')
    expect(line).toContain('"extends": "basalt-ui/configs/tsconfig.react-app.json"')
    expect(read('tsconfig.json')).toBe(root)
    expect(read('tsconfig.node.json')).not.toContain('extends')
  })

  it('treats a referenced config that covers src through `files` as covering', () => {
    write('tsconfig.json', '{ "files": [], "references": [{ "path": "./app.json" }] }')
    write('app.json', '{ "files": ["src/main.tsx"] }')
    expect(seedTsconfigExtends(dir)).toContain('added')
    expect(read('app.json')).toContain('"extends"')
  })

  it('leaves a tokens-only consumer alone', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { profile: 'tokens-only' } }))
    write('tsconfig.json', '{ "include": ["src"] }')
    capture(() => init(dir))
    expect(read('tsconfig.json')).not.toContain('extends')
  })

  it('leaves a config that extends something else alone and prints the fix', () => {
    const own = '{ "extends": "./base.json", "include": ["src"] }\n'
    write('tsconfig.json', own)
    write('base.json', '{}')
    const line = seedTsconfigExtends(dir)
    expect(line).toContain('already extends something else')
    expect(line).toContain('"extends": "basalt-ui/configs/tsconfig.react-app.json"')
    expect(read('tsconfig.json')).toBe(own)
  })
})

describe('init — the src/main.tsx seed', () => {
  const PEERS = { dependencies: { '@tanstack/react-router': '*', '@tanstack/react-query': '*' } }

  it('is written with both router peers, mounts the provider and declares Register', () => {
    write('package.json', JSON.stringify({ name: 'fixture', ...PEERS }))
    capture(() => init(dir))
    const main = read('src/main.tsx')
    expect(main).toContain('<BasaltProvider router={router} />')
    expect(main).toContain('interface Register')
    expect(main).toContain("import 'basalt-ui/styles.css'")
    expect(main).not.toContain('@mantine')
  })

  it('is kept when present, and the kept notice says exactly what to change', () => {
    write('package.json', JSON.stringify({ name: 'fixture', ...PEERS }))
    write('src/main.tsx', '// mine\n')
    const { log } = capture(() => init(dir))
    expect(read('src/main.tsx')).toBe('// mine\n')
    expect(log).toContain(
      'src/main.tsx — change it to match node_modules/basalt-ui/agent/templates/main.tpl',
    )
    expect(log).toContain('createBasaltRouter({ routeTree })')
    expect(log).toContain('<BasaltProvider router={router} />')
  })

  it('is written even when package.json declares no TanStack dependency (they are required peers)', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    expect(existsSync(join(dir, 'src/main.tsx'))).toBe(true)
  })
})

describe('doctor — app-wiring', () => {
  const STOCK_MAIN =
    "import { createRoot } from 'react-dom/client'\nimport App from './App.tsx'\ncreateRoot(document.getElementById('root')!).render(<App />)\n"

  it('is red on a stock create-vite entry until main.tsx is the seed, then green', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('index.html', '<div id="root"></div><script type="module" src="/src/main.tsx"></script>')
    write('src/main.tsx', STOCK_MAIN)
    write('vite.config.ts', 'export default { plugins: [react()] }\n')
    capture(() => init(dir))
    const red = capture(() => doctor(dir))
    expect(red.code).toBe(1)
    expect(red.log).toContain(
      '✖ app-wiring: src/main.tsx does not use BasaltProvider or createBasaltRouter',
    )
    expect(red.log).toContain('agent/templates/main.tpl')
    expect(text(appWiringCheck(dir))).toContain('does not use BasaltProvider or createBasaltRouter')
    write('src/main.tsx', readFileSync(join(PKG_ROOT, 'agent/templates/main.tpl'), 'utf8'))
    expect(text(appWiringCheck(dir))).toContain('no vite.config calls the TanStack router plugin')
    expect(text(appWiringCheck(dir))).toContain('@tanstack/router-plugin/vite')
    write(
      'vite.config.ts',
      "import { tanstackRouter } from '@tanstack/router-plugin/vite'\nexport default { plugins: [tanstackRouter()] }\n",
    )
    expect(appWiringCheck(dir)).toBeNull()
  })

  it('accepts a code-routed app (router in a lazily imported module); fails an entry importing an ungenerated tree', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('index.html', '<script type="module" src="/src/main.tsx"></script>')
    write('vite.config.ts', 'export default { plugins: [react()] }\n')
    write(
      'src/main.tsx',
      "import { BasaltProvider } from 'basalt-ui'\nconst R = lazy(() => import('./router'))\n<BasaltProvider />\n",
    )
    write('src/router.tsx', 'export const router = createBasaltRouter({ routeTree })\n')
    expect(appWiringCheck(dir)).toBeNull()
    write(
      'src/main.tsx',
      "import { BasaltProvider, createBasaltRouter } from 'basalt-ui'\nimport { routeTree } from './routeTree.gen'\ncreateBasaltRouter({ routeTree })\n<BasaltProvider />\n",
    )
    const problem = text(appWiringCheck(dir))
    expect(problem).toContain('imports a generated route tree')
    expect(problem).toContain('or define the tree in code')
  })

  it('an entry that only imports createBasaltRouter does not count as creating the router', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('index.html', '<script type="module" src="/src/main.tsx"></script>')
    write(
      'src/main.tsx',
      "import { BasaltProvider, createBasaltRouter } from 'basalt-ui'\n<BasaltProvider />\n",
    )
    expect(text(appWiringCheck(dir))).toContain('does not use createBasaltRouter')
  })

  it('a Start app is wired by <BasaltProvider> in its root route or a pathless layout, not by src/main.tsx', () => {
    write(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    expect(text(appWiringCheck(dir))).toContain('src/routes/__root.tsx does not exist')
    write('src/routes/__root.tsx', 'export const Route = { component: () => <html /> }\n')
    expect(text(appWiringCheck(dir))).toContain('renders <BasaltProvider>')
    write(
      'src/routes/__root.tsx',
      'export const Route = createRootRoute({ component: () => <BasaltProvider><Outlet /></BasaltProvider> })\n',
    )
    expect(text(appWiringCheck(dir))).toContain('createRootRouteWithContext<BasaltRouterContext>')
    write(
      'src/routes/__root.tsx',
      'const c = createRootRouteWithContext<BasaltRouterContext>()\nexport const R = () => <BasaltProvider><Outlet /></BasaltProvider>\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
  })

  it('reaches the Start check from devDependencies alone, and wants an embedded provider', () => {
    write(
      'package.json',
      JSON.stringify({ name: 'fixture', devDependencies: { '@tanstack/react-start': '*' } }),
    )
    const CTX = 'const c = createRootRouteWithContext<BasaltRouterContext>()\n'
    write('src/routes/__root.tsx', '// <BasaltProvider><Outlet /></BasaltProvider>\nexport {}\n')
    expect(text(appWiringCheck(dir))).toContain('renders <BasaltProvider>')
    write(
      'src/routes/__root.tsx',
      'export const R = () => <BasaltProvider router={router} telemetry={(e) => e}><X /></BasaltProvider>\n',
    )
    expect(text(appWiringCheck(dir))).toContain('mounts a second router')
    write(
      'src/routes/__root.tsx',
      CTX + 'export const R = () => <BasaltProvider>{x}</BasaltProvider>\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
    // ANY tag with router= fails, even beside an embedded one.
    write(
      'src/routes/__root.tsx',
      'const A = () => <BasaltProvider>{x}</BasaltProvider>\nconst B = () => <BasaltProvider router={r} />\n',
    )
    expect(text(appWiringCheck(dir))).toContain('mounts a second router')
    // `>` and `router=` inside a string attribute neither end the tag nor count as the prop.
    write(
      'src/routes/__root.tsx',
      CTX +
        'const A = () => <BasaltProvider className="a > b router=x" nonce="router=y">{x}</BasaltProvider>\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
    // A provider that only appears inside a string is no provider.
    write('src/routes/__root.tsx', 'const doc = "<BasaltProvider>{x}</BasaltProvider>"\n')
    expect(text(appWiringCheck(dir))).toContain('renders <BasaltProvider>')
    // Wide whitespace before the spread is still a spread.
    write(
      'src/routes/__root.tsx',
      'const A = () => <BasaltProvider {   \n\n   ...props}>{x}</BasaltProvider>\n',
    )
    expect(startWiringWarnings(dir).join()).toContain('spread')
    // A spread could carry router=: not a failure, a warning.
    write(
      'src/routes/__root.tsx',
      CTX + 'const A = () => <BasaltProvider {...props}>{x}</BasaltProvider>\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
    expect(startWiringWarnings(dir).join()).toContain('spread')
  })

  describe('Start provider one import hop away', () => {
    const ROOT = 'export const Route = createRootRouteWithContext<BasaltRouterContext>()({})\n'
    const APP =
      "import { Providers } from '../app/providers'\nconst A = () => <Providers><Outlet /></Providers>\n"
    const PROVIDERS =
      'export const Providers = (p) => <BasaltProvider>{p.children}</BasaltProvider>\n'
    const start = () => {
      write(
        'package.json',
        JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
      )
      write('src/routes/__root.tsx', ROOT)
      write('src/routes/_app.tsx', APP)
    }

    it('passes a provider one relative hop away', () => {
      start()
      write('src/app/providers.tsx', PROVIDERS)
      expect(appWiringCheck(dir)).toBeNull()
    })

    it('follows a tsconfig paths alias', () => {
      start()
      write('src/routes/_app.tsx', APP.replace('../app/providers', '~/app/providers'))
      write(
        'tsconfig.json',
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "~/*": ["./src/*"] } } }',
      )
      write('src/app/providers.tsx', PROVIDERS)
      expect(appWiringCheck(dir)).toBeNull()
    })

    it('fails two hops away, naming the hop limit', () => {
      start()
      write(
        'src/app/providers.tsx',
        "import { Inner } from './inner'\nexport const Providers = () => <Inner />\n",
      )
      write('src/app/inner.tsx', PROVIDERS)
      const msg = text(appWiringCheck(dir))
      expect(msg).toContain('src/app/inner.tsx is two imports away')
      expect(msg).toContain('one import hop')
    })

    it('fails a hop module that passes router=, naming it', () => {
      start()
      write('src/app/providers.tsx', '<BasaltProvider router={r} />\n')
      expect(text(appWiringCheck(dir))).toContain('src/app/providers.tsx passes router=')
    })

    it('counts a hop provider beside another as two tags', () => {
      start()
      write('src/app/providers.tsx', PROVIDERS)
      write('src/routes/__root.tsx', ROOT + PROVIDERS)
      expect(text(appWiringCheck(dir))).toContain('2 <BasaltProvider> tags')
    })

    it('ignores a hop module that is imported but not rendered', () => {
      start()
      write(
        'src/routes/_app.tsx',
        "import { Providers } from '../app/providers'\nconst A = () => <Outlet />\n",
      )
      write('src/app/providers.tsx', PROVIDERS)
      const msg = text(appWiringCheck(dir))
      expect(msg).toContain('neither src/routes/__root.tsx nor a pathless layout')
      expect(msg).not.toContain('two imports away')
    })

    it('fails a second provider two hops beyond a provider-holding hop module', () => {
      start()
      write(
        'src/app/providers.tsx',
        "import { Inner } from './inner'\nexport const Providers = () => <BasaltProvider><Inner /></BasaltProvider>\n",
      )
      write('src/app/inner.tsx', PROVIDERS)
      const msg = text(appWiringCheck(dir))
      expect(msg).toContain('src/app/inner.tsx')
      expect(msg).toContain('two imports away')
    })

    it('treats a malformed tsconfig paths shape as no alias, never a crash', () => {
      start()
      write('src/routes/_app.tsx', APP.replace('../app/providers', '~/app/providers'))
      write('src/app/providers.tsx', PROVIDERS)
      for (const tsconfig of [
        '{ "compilerOptions": { "baseUrl": 5, "paths": { "~/*": "./src/*" } } }',
        '{ "compilerOptions": { "paths": [] } }',
        '{ "compilerOptions": null }',
        '[]',
      ]) {
        write('tsconfig.json', tsconfig)
        expect(text(appWiringCheck(dir))).toContain('pathless layout')
      }
    })

    it('counts the same wrapper once per render edge: root and a layout both rendering it fail', () => {
      start()
      write('src/app/providers.tsx', PROVIDERS)
      write('src/routes/__root.tsx', ROOT + APP)
      const msg = text(appWiringCheck(dir))
      expect(msg).toContain('src/app/providers.tsx render 2 <BasaltProvider> tags')
      expect(msg).toContain('Fix: keep one')
    })

    it('ignores an import statement inside a comment', () => {
      start()
      write(
        'src/routes/_app.tsx',
        "// import { Providers } from '../app/providers'\nconst A = () => <Providers><Outlet /></Providers>\n",
      )
      write('src/app/providers.tsx', PROVIDERS)
      expect(text(appWiringCheck(dir))).toContain('pathless layout')
    })

    it('resolves a specifier written with a .js extension', () => {
      start()
      write('src/routes/_app.tsx', APP.replace('../app/providers', '../app/providers.js'))
      write('src/app/providers.tsx', PROVIDERS)
      expect(appWiringCheck(dir)).toBeNull()
    })
  })

  describe('Start provider in a pathless layout', () => {
    const ROOT = 'export const Route = createRootRouteWithContext<BasaltRouterContext>()({})\n'
    const LAYOUT =
      'export const Route = { component: () => <BasaltProvider><Outlet /></BasaltProvider> }\n'
    const start = () => {
      write(
        'package.json',
        JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
      )
      write('src/routes/__root.tsx', ROOT)
    }

    it('accepts _app.tsx and _app/route.tsx', () => {
      start()
      write('src/routes/_app.tsx', LAYOUT)
      expect(appWiringCheck(dir)).toBeNull()
      rmSync(join(dir, 'src/routes/_app.tsx'))
      write('src/routes/_app/route.tsx', LAYOUT)
      expect(appWiringCheck(dir)).toBeNull()
    })

    it('rejects a provider in a non-layout route, or nowhere', () => {
      start()
      expect(text(appWiringCheck(dir))).toContain('pathless layout')
      write('src/routes/map.tsx', LAYOUT)
      expect(text(appWiringCheck(dir))).toContain('pathless layout')
      write('src/routes/_app.map.tsx', LAYOUT)
      expect(text(appWiringCheck(dir))).toContain('pathless layout')
    })

    it('counts a nested layout, not a double-underscore file', () => {
      start()
      write('src/routes/dashboard/_app.tsx', LAYOUT)
      expect(appWiringCheck(dir)).toBeNull()
      rmSync(join(dir, 'src/routes/dashboard/_app.tsx'))
      write('src/routes/__other.tsx', LAYOUT)
      expect(text(appWiringCheck(dir))).toContain('pathless layout')
    })

    it('rejects router= in _app/route.tsx and a second provider beside the root', () => {
      start()
      write('src/routes/_app/route.tsx', '<BasaltProvider router={r}><Outlet /></BasaltProvider>\n')
      expect(text(appWiringCheck(dir))).toContain('src/routes/_app/route.tsx passes router=')
      write('src/routes/_app/route.tsx', LAYOUT)
      write('src/routes/__root.tsx', ROOT + LAYOUT)
      const both = text(appWiringCheck(dir))
      expect(both).toContain(
        'src/routes/__root.tsx and src/routes/_app/route.tsx render 2 <BasaltProvider> tags',
      )
    })

    it('names a missing root route when the provider sits in a layout', () => {
      write(
        'package.json',
        JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
      )
      write('src/routes/_app.tsx', LAYOUT)
      expect(text(appWiringCheck(dir))).toContain(
        'src/routes/__root.tsx does not exist, so the provider in src/routes/_app.tsx',
      )
    })

    it('keeps the router= rejection and spread warning for the layout file', () => {
      start()
      write('src/routes/_app.tsx', '<BasaltProvider router={r}><Outlet /></BasaltProvider>\n')
      expect(text(appWiringCheck(dir))).toContain('src/routes/_app.tsx passes router=')
      write('src/routes/_app.tsx', '<BasaltProvider {...p}><Outlet /></BasaltProvider>\n')
      expect(appWiringCheck(dir)).toBeNull()
      expect(startWiringWarnings(dir).join()).toContain('src/routes/_app.tsx')
    })
  })

  it('fails a Start root route exported from an untyped createRootRoute', () => {
    write(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    expect(startWiringWarnings(dir)).toEqual([])
    write(
      'src/routes/__root.tsx',
      'export const Route = createRootRoute({ component: () => <BasaltProvider><Outlet /></BasaltProvider> })\n',
    )
    expect(text(appWiringCheck(dir))).toContain('createRootRouteWithContext<BasaltRouterContext>()')
    // A dead createRootRouteWithContext call beside an untyped exported Route still fails.
    write(
      'src/routes/__root.tsx',
      'const unused = createRootRouteWithContext<BasaltRouterContext>()\nexport const Route = createRootRoute({ component: () => <BasaltProvider><Outlet /></BasaltProvider> })\n',
    )
    expect(text(appWiringCheck(dir))).toContain('createRootRoute()')
    // A re-export, wrapper or missing Route export is skipped, never failed.
    write(
      'src/routes/__root.tsx',
      "export { Route } from './elsewhere'\nconst x = () => <BasaltProvider><Outlet /></BasaltProvider>\n",
    )
    expect(appWiringCheck(dir)).toBeNull()
    write(
      'src/routes/__root.tsx',
      'type Ctx = { queryClient: () => QueryClient }\nexport const Route = createRootRouteWithContext<Ctx>()({ component: () => <BasaltProvider><Outlet /></BasaltProvider> })\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
    write(
      'src/routes/__root.tsx',
      'export const Route = createRootRouteWithContext<{ queryClient: () => QueryClient }>()({ component: () => <BasaltProvider><Outlet /></BasaltProvider> })\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
    // An annotated export is still read; a wrapper around createRootRoute is not judged.
    write(
      'src/routes/__root.tsx',
      'export const Route: AnyRoute = createRootRoute({ component: () => <BasaltProvider><Outlet /></BasaltProvider> })\n',
    )
    expect(text(appWiringCheck(dir))).toContain('createRootRoute()')
    write(
      'src/routes/__root.tsx',
      'export const Route = withWrap(createRootRoute({ component: () => <BasaltProvider><Outlet /></BasaltProvider> }))\n',
    )
    expect(appWiringCheck(dir)).toBeNull()
  })

  it('fails two <BasaltProvider> tags in one file, naming it', () => {
    write(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    write(
      'src/routes/__root.tsx',
      'const A = () => <BasaltProvider>{x}</BasaltProvider>\nconst B = () => <BasaltProvider>{y}</BasaltProvider>\n',
    )
    const problem = text(appWiringCheck(dir))
    expect(problem).toContain('src/routes/__root.tsx render 2 <BasaltProvider> tags')
  })

  it('shell: false warns only when the entry-reachable code renders <BasaltShell', () => {
    write('src/main.tsx', "import { App } from './app'\nrender(<App />)\n")
    write(
      'src/app.tsx',
      "// <BasaltShell />\nconst s = '<BasaltShell>'\nexport const App = () => <div />\n",
    )
    expect(shellDeclarationFindings(dir, { shell: false })).toEqual({ fail: null, warnings: [] })
    write('src/app.tsx', 'export const App = () => <BasaltShell nav={NAV}><X /></BasaltShell>\n')
    expect(shellDeclarationFindings(dir, { shell: false }).warnings.join()).toContain(
      'declared basalt.shell: false but the app renders BasaltShell',
    )
    // Not declared: the shell is the default and nothing is judged.
    expect(shellDeclarationFindings(dir, {})).toEqual({ fail: null, warnings: [] })
    expect(shellDeclarationFindings(dir, { shell: true }).warnings).toEqual([])
  })

  it('a non-boolean shell fails the doctor finding', () => {
    expect(shellDeclarationFindings(dir, { shell: 'no' as unknown as boolean }).fail).toContain(
      'basalt.shell must be a boolean',
    )
  })

  it('follows the entry named by index.html and accepts an existing routeTree.gen', () => {
    write('index.html', '<script type="module" src="/app/boot.tsx"></script>')
    write('app/boot.tsx', 'createBasaltRouter(); <BasaltProvider router={r} />')
    write('src/routeTree.gen.ts', 'export {}\n')
    expect(appWiringCheck(dir)).toBeNull()
    rmSync(join(dir, 'app/boot.tsx'))
    expect(text(appWiringCheck(dir))).toContain('app/boot.tsx does not exist')
  })

  it('follows the entry imports to a router module, and stays red when none creates it', () => {
    write('src/routeTree.gen.ts', 'export {}\n')
    write(
      'src/main.tsx',
      "import { router } from './lib/router'\n<BasaltProvider router={router} />\n",
    )
    write('src/lib/router.ts', 'export const router = createBasaltRouter({ routeTree })\n')
    expect(appWiringCheck(dir)).toBeNull()
    rmSync(join(dir, 'src/lib/router.ts'))
    write('src/lib/router/index.tsx', 'export const router = createBasaltRouter({ routeTree })\n')
    expect(appWiringCheck(dir)).toBeNull()
    write('src/lib/router/index.tsx', '// createBasaltRouter\nexport const router = {}\n')
    expect(text(appWiringCheck(dir))).toContain('does not use createBasaltRouter')
  })

  const ENTRY =
    "import { routeTree } from './routeTree.gen'\ncreateBasaltRouter({ routeTree }); <BasaltProvider router={router} />\n"

  describe('router plugin detection', () => {
    const vite = (body: string): void => write('vite.config.ts', body)
    beforeEach(() => write('src/main.tsx', ENTRY))

    it('is red for a comment-only or string-only mention and for an import nothing calls', () => {
      vite(
        "// import { tanstackRouter } from '@tanstack/router-plugin/vite'\n// plugins: [tanstackRouter()]\nexport default { plugins: [] }\n",
      )
      expect(text(appWiringCheck(dir))).toContain('no vite.config calls the TanStack router plugin')
      vite("export default { note: 'router-plugin tanstackRouter(', plugins: [] }\n")
      expect(appWiringCheck(dir)).toHaveProperty('fail')
      vite(
        "import { tanstackRouter } from '@tanstack/router-plugin/vite'\nexport default { plugins: [] }\n",
      )
      expect(appWiringCheck(dir)).toHaveProperty('fail')
      vite('export default { plugins: [tanstackRouter()] }\n') // called but never imported
      expect(appWiringCheck(dir)).toHaveProperty('fail')
    })

    it.each([
      [
        "import { tanstackRouter } from '@tanstack/router-plugin/vite'\nexport default { plugins: [tanstackRouter({ target: 'react' })] }",
      ],
      [
        "import { tanstackRouter as tsr } from '@tanstack/router-plugin/vite'\nexport default { plugins: [tsr()] }",
      ],
      [
        "import TanStackRouterVite from '@tanstack/router-plugin/vite'\nexport default { plugins: [TanStackRouterVite()] }",
      ],
      [
        "import * as router from '@tanstack/router-plugin/vite'\nexport default { plugins: [router.tanstackRouter()] }",
      ],
    ])('is green when the imported binding is called in plugins: %#', (config) => {
      vite(`${config}\n`)
      expect(appWiringCheck(dir)).toBeNull()
    })
  })

  it('looks for routeTree.gen beside the entry, not only in src/', () => {
    write('index.html', '<script type="module" src="/app/main.tsx"></script>')
    write('app/main.tsx', ENTRY)
    expect(appWiringCheck(dir)).toHaveProperty('fail')
    write('app/routeTree.gen.ts', 'export {}\n')
    expect(appWiringCheck(dir)).toBeNull()
  })

  it('reads the entry from the right <script>: either attribute order, no remote or commented ones', () => {
    write(
      'index.html',
      [
        '<!-- <script type="module" src="/old.tsx"></script> -->',
        '<script type="module" src="https://cdn.example.com/x.js"></script>',
        '<script src="//cdn.example.com/y.js" type="module"></script>',
        '<script defer src="/legacy.js"></script>',
        '<script src="/app/boot.tsx" type="module"></script>',
      ].join('\n'),
    )
    write('app/boot.tsx', ENTRY)
    write('src/routeTree.gen.ts', 'export {}\n')
    expect(appWiringCheck(dir)).toBeNull()
  })

  it('names which piece is missing and ignores mentions in comments and strings', () => {
    write(
      'src/main.tsx',
      "// BasaltProvider createBasaltRouter\nconst s = 'BasaltProvider'\ncreateBasaltRouter()\n",
    )
    const problem = text(appWiringCheck(dir))
    expect(problem).toContain('does not use BasaltProvider.')
    expect(problem).not.toContain('createBasaltRouter.')
  })

  it('is n/a for a tokens-only consumer', () => {
    write('package.json', JSON.stringify({ name: 'site', basalt: { profile: 'tokens-only' } }))
    expect(capture(() => doctor(dir)).log).toContain(
      'tsconfig-base / retired-lint-rules / oxlint-floor / app-wiring / exact-peers / subpath-peers / config-keys: n/a',
    )
  })
})

describe('doctor — dropped-subpaths for a tokens-only consumer', () => {
  const tokensOnly = (): void => {
    write(
      'package.json',
      JSON.stringify({
        name: 'site',
        dependencies: { 'basalt-ui': '*' },
        basalt: { profile: 'tokens-only' },
      }),
    )
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: PKG_VERSION, exports: { '.': {} } }),
    )
  }

  it('fails on a removed tokens.css CSS import, naming the file and the replacement', () => {
    tokensOnly()
    write('src/styles/global.css', "@import 'basalt-ui/tokens.css';\n")
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    expect(log).toContain('dropped-subpaths: src/styles/global.css:1 imports basalt-ui/tokens.css')
    expect(log).toContain('basalt-ui tokens:css')
    expect(log).toContain('/ app-wiring /')
    expect(existsSync(join(dir, 'src/main.tsx'))).toBe(false)
    expect(log).not.toMatch(/\.[jt]sx?:\d/)
  })

  it('fails on a JS import of a dropped subpath too, naming file and line', () => {
    tokensOnly()
    write('src/app.ts', "const x = 1\nimport { q } from 'basalt-ui/query'\n")
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(1)
    expect(log).toContain('dropped-subpaths: src/app.ts:2 imports basalt-ui/query')
  })

  it('still passes a clean tokens-only consumer', () => {
    tokensOnly()
    write('src/styles/global.css', "@import './tokens.css';\n")
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('✓ dropped-subpaths')
  })
})

describe('init — merging a create-vite .oxlintrc.json', () => {
  const OXLINT = join(PKG_ROOT, '../../node_modules/.bin/oxlint')

  it.skipIf(!existsSync(OXLINT))('extends the preset and really enables a jsx-a11y rule', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    write('node_modules/basalt-ui', '')
    rmSync(join(dir, 'node_modules/basalt-ui'))
    symlinkSync(PKG_ROOT, join(dir, 'node_modules/basalt-ui'))
    write(
      '.oxlintrc.json',
      JSON.stringify({ plugins: ['react', 'typescript', 'oxc'], rules: {} }, null, 2),
    )
    write('src/t.jsx', 'export const A = () => <img src="x" />\n')
    const { log } = capture(() => init(dir))
    expect(log).toContain('oxlint — spliced')
    const cfg = JSON.parse(read('.oxlintrc.json')) as { extends: string[]; plugins: string[] }
    expect(cfg.extends[0]).toContain('basalt-ui/configs/oxlint.json')
    // A child `plugins` list unions with the preset's: it must not switch the preset's plugins off.
    const run = Bun.spawnSync([OXLINT, '-c', '.oxlintrc.json', 'src/t.jsx'], { cwd: dir })
    expect(run.stdout.toString()).toContain('jsx-a11y')
  })
})

describe('init — tokens-only and the kept .oxlintrc.json', () => {
  it('writes no router seeds for a tokens-only consumer', () => {
    write('package.json', JSON.stringify({ name: 'site', basalt: { profile: 'tokens-only' } }))
    capture(() => init(dir))
    for (const dest of ['src/main.tsx', 'src/routes/__root.tsx', 'src/lib/nav.tsx']) {
      expect(existsSync(join(dir, dest))).toBe(false)
    }
  })

  it('states the kept-config cost from the merge result', () => {
    write('package.json', JSON.stringify({ name: 'app' }))
    write('.oxlintrc.json', JSON.stringify({ rules: {} }))
    expect(capture(() => init(dir)).log).toContain(
      '.oxlintrc.json — now extends the shipped preset',
    )
    rmSync(join(dir, '.oxlintrc.json'))
    write('.oxlintrc.json', '// why\n{ "rules": {} }\n')
    const commented = capture(() => init(dir)).log
    expect(commented).toContain('is NOT active: init could not splice the extends in')
    expect(commented).not.toContain('see the oxlint line below')
    expect(capture(() => init(dir, { noMergeLint: true })).log).toContain(
      'init ran with --no-merge-lint',
    )
  })

  it("keeps the config's own plugins through the rewrite", () => {
    write(
      '.oxlintrc.json',
      JSON.stringify({ plugins: ['react', 'typescript', 'oxc'], rules: { a: 'off' } }),
    )
    expect(mergeOxlintExtends(dir, './node_modules/basalt-ui/configs/oxlint.json')).toBe('added')
    const cfg = JSON.parse(read('.oxlintrc.json')) as Record<string, unknown>
    expect(cfg['plugins']).toEqual(['react', 'typescript', 'oxc'])
    expect(cfg['rules']).toEqual({ a: 'off' })
  })
})

describe('init — build order', () => {
  const build = (script?: string): string | undefined => {
    write(
      'package.json',
      JSON.stringify({ name: 'fixture', scripts: script ? { build: script } : {} }),
    )
    const { log } = capture(() => init(dir))
    lastLog = log
    return (JSON.parse(read('package.json')) as { scripts: { build?: string } }).scripts.build
  }
  let lastLog = ''

  it('reorders the stock create-vite build so vite generates routeTree.gen.ts before tsc', () => {
    expect(build('tsc -b && vite build')).toBe('vite build && tsc -b')
    expect(lastLog).toContain('rewrote "build" to `vite build && tsc -b`')
  })

  it('leaves any other tsc-running build alone and prints one line of advice', () => {
    expect(build('tsc -p tsconfig.app.json && vite build --mode x')).toBe(
      'tsc -p tsconfig.app.json && vite build --mode x',
    )
    expect(lastLog).toContain('left as is: run `vite build` before `tsc`')
  })

  it('says nothing for a build that already starts with vite, has no tsc, or is absent', () => {
    for (const script of ['vite build && tsc -b', 'vite build', undefined]) {
      expect(build(script)).toBe(script)
      expect(lastLog).not.toContain('"build"')
    }
  })
})

describe('only-export-components and the TanStack Route export', () => {
  const RULE = 'react/only-export-components'
  const PRESET = './node_modules/basalt-ui/configs/oxlint.json'
  const rulesAfterMerge = (rules: unknown): Record<string, unknown> => {
    write('.oxlintrc.json', JSON.stringify({ plugins: ['react'], rules }))
    expect(mergeOxlintExtends(dir, PRESET)).toBe('added')
    return (JSON.parse(read('.oxlintrc.json')) as { rules: Record<string, unknown> }).rules
  }

  it('ships the rule with allowExportNames: ["Route"]', () => {
    const preset = parseJsonc(readFileSync(join(PKG_ROOT, 'configs/oxlint.json'), 'utf8')) ?? {}
    expect((preset['rules'] as Record<string, unknown>)[RULE]).toEqual([
      'warn',
      { allowExportNames: ['Route'] },
    ])
  })

  it("adds Route to a consumer's own rule without changing its level or options", () => {
    expect(rulesAfterMerge({ [RULE]: 'error' })[RULE]).toEqual([
      'error',
      { allowExportNames: ['Route'] },
    ])
    expect(
      rulesAfterMerge({
        [RULE]: ['warn', { allowConstantExport: true, allowExportNames: ['meta'] }],
      })[RULE],
    ).toEqual(['warn', { allowConstantExport: true, allowExportNames: ['meta', 'Route'] }])
    expect(rulesAfterMerge({ [RULE]: ['off'] })[RULE]).toEqual([
      'off',
      { allowExportNames: ['Route'] },
    ])
  })

  it('does not introduce the rule into a config that never set it', () => {
    expect(RULE in rulesAfterMerge({ 'no-debugger': 'error' })).toBe(false)
  })

  const OXLINT = join(PKG_ROOT, '../../node_modules/.bin/oxlint')
  it.skipIf(!existsSync(OXLINT))(
    'really lets a route file export Route (shipped and merged)',
    () => {
      mkdirSync(join(dir, 'node_modules'), { recursive: true })
      symlinkSync(PKG_ROOT, join(dir, 'node_modules/basalt-ui'))
      write('src/routes/index.jsx', 'export const Route = {}\nexport const Page = () => <div />\n')
      write('src/other.jsx', 'export const helper = 1\nexport const Page = () => <div />\n')
      write(
        '.oxlintrc.json',
        JSON.stringify({
          plugins: ['react'],
          rules: { [RULE]: ['warn', { allowConstantExport: true }] },
        }),
      )
      capture(() => init(dir))
      const run = (file: string): string =>
        Bun.spawnSync([OXLINT, '-c', '.oxlintrc.json', file], { cwd: dir }).stdout.toString()
      expect(run('src/routes/index.jsx')).not.toContain('only-export-components')
      expect(run('src/other.jsx')).not.toContain('only-export-components') // allowConstantExport: helper = 1
      write('src/fn.jsx', 'export function helper() {}\nexport const Page = () => <div />\n')
      expect(run('src/fn.jsx')).toContain('only-export-components')
    },
  )
})

describe('seeded route files lint clean', () => {
  const OXLINT = join(PKG_ROOT, '../../node_modules/.bin/oxlint')

  it.skipIf(!existsSync(OXLINT))(
    'src/routes/__root.tsx and a skill-style route have 0 warnings',
    () => {
      write('package.json', JSON.stringify({ name: 'fixture' }))
      mkdirSync(join(dir, 'node_modules'), { recursive: true })
      symlinkSync(PKG_ROOT, join(dir, 'node_modules/basalt-ui'))
      write(
        '.oxlintrc.json',
        JSON.stringify({ plugins: ['react'], rules: { 'react/only-export-components': 'warn' } }),
      )
      capture(() => init(dir))
      const skill = readFileSync(join(PKG_ROOT, 'agent/skills/basalt-app/SKILL.md'), 'utf8')
      const route =
        /\/\/ src\/routes\/dashboard\.tsx[^\n]*\n([\s\S]*?)\n\/\/ src\/lib\/nav\.tsx/.exec(
          skill,
        )?.[1] ?? ''
      expect(route).toContain('export function Dashboard')
      write(
        'src/routes/dashboard.tsx',
        `import { createFileRoute } from '@tanstack/react-router'\n${route}\n`,
      )
      for (const file of ['src/routes/__root.tsx', 'src/routes/dashboard.tsx']) {
        const out = Bun.spawnSync([OXLINT, '-c', '.oxlintrc.json', file], {
          cwd: dir,
        }).stdout.toString()
        expect(out).not.toContain('only-export-components')
      }
    },
  )
})

describe('doctor — subpath-peers', () => {
  const install = (): { dir: string; version: null; how: 'cwd' } => ({
    dir: join(dir, 'node_modules/basalt-ui'),
    version: null,
    how: 'cwd',
  })
  const run = (): Check => subpathPeersCheck(dir, { roots: ['src'] }, install())

  it('fails with a bun add fix when an imported subpath lacks its peers', () => {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ peerDependencies: { shiki: '^4.5.0', 'react-markdown': '^10.1.0' } }),
    )
    write('node_modules/react-markdown/package.json', '{"version":"10.1.0"}')
    write('src/a.tsx', "import { Markdown } from 'basalt-ui/content'\n")
    const problem = text(run())
    expect(problem).toContain('shiki for basalt-ui/content (src/a.tsx)')
    expect(problem).toContain('@shikijs/langs')
    expect(problem).not.toContain('react-markdown for')
    expect(problem).toContain('`bun add shiki@^4.5.0 @shikijs/langs @shikijs/themes`')
  })

  it('passes once the peers resolve, and ignores subpaths the app does not import', () => {
    write('node_modules/basalt-ui/package.json', '{}')
    write('src/a.tsx', "import { Markdown } from 'basalt-ui/content'\nimport 'basalt-ui/state'\n")
    expect(text(run())).toContain('shiki')
    for (const peer of SUBPATH_REQUIRED_PEERS['content'] ?? []) {
      write(`node_modules/${peer}/package.json`, '{"version":"1.0.0"}')
    }
    expect(run()).toBeNull()
  })

  it('reads the app package in a monorepo: peers installed only for apps/web pass, a missing one fails', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write(
      'apps/web/package.json',
      JSON.stringify({ name: 'web', dependencies: { 'basalt-ui': '*' } }),
    )
    write('apps/web/src/main.tsx', "import { CartesianChart } from 'basalt-ui/charts'\n")
    write('node_modules/basalt-ui/package.json', '{}')
    for (const peer of SUBPATH_REQUIRED_PEERS['charts'] ?? []) {
      write(`apps/web/node_modules/${peer}/package.json`, '{"version":"1.0.0"}')
    }
    const failed = (): string =>
      capture(() => doctor(dir))
        .log.split('\n')
        .find((l) => l.includes('✖ subpath-peers')) ?? ''
    expect(failed()).toBe('')
    rmSync(join(dir, 'apps/web/node_modules/d3-scale'), { recursive: true })
    expect(failed()).toContain('d3-scale for basalt-ui/charts (src/main.tsx)')
  })

  it('dropped-subpaths scans the app package in a monorepo', () => {
    write('package.json', JSON.stringify({ name: 'root', workspaces: ['apps/*'] }))
    write(
      'apps/web/package.json',
      JSON.stringify({ name: 'web', dependencies: { 'basalt-ui': '*' } }),
    )
    write('apps/web/src/main.tsx', "import { q } from 'basalt-ui/query'\n")
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: PKG_VERSION, exports: { '.': {} } }),
    )
    const dropped = (): string =>
      capture(() => doctor(dir))
        .log.split('\n')
        .find((l) => l.includes('✖ dropped-subpaths')) ?? ''
    expect(dropped()).toContain('src/main.tsx:1 imports basalt-ui/query')
    write('apps/web/src/main.tsx', "import 'basalt-ui'\n")
    expect(dropped()).toBe('')
  })

  it('skips when basalt-ui does not resolve', () => {
    const skipped = subpathPeersCheck(
      dir,
      { roots: ['src'] },
      { dir: null, version: null, how: null },
    )
    expect(text(skipped)).toContain('subpath-peers')
  })

  it('names only peers that are optional in package.json and listed on the same surface', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      peerDependencies: Record<string, string>
    }
    const peersOf = (sub: string): readonly string[] => {
      const surface = Object.entries(SURFACES).find(([key]) => key === `./${sub}`)?.[1]
      return surface !== undefined && 'optionalPeers' in surface
        ? (surface.optionalPeers ?? [])
        : []
    }
    for (const [sub, peers] of Object.entries(SUBPATH_REQUIRED_PEERS)) {
      for (const peer of peers) {
        expect(pkg.peerDependencies[peer]).toBeDefined()
        expect(peersOf(sub)).toContain(peer)
      }
    }
  })
})

describe('doctor — oxlint-floor', () => {
  const withOxlint = (version: string): void => {
    write('.oxlintrc.json', '{}')
    write('node_modules/oxlint/package.json', JSON.stringify({ name: 'oxlint', version }))
  }

  it('fails below the floor, naming the floor and the install command', () => {
    withOxlint('1.76.0')
    const problem = text(oxlintFloorCheck(dir))
    expect(problem).toContain('oxlint 1.76.0')
    expect(problem).toContain('>= 1.79.0')
    expect(problem).toContain('bun add -D oxlint@^1.79.0')
  })

  it('passes at and above the floor, including a higher minor with a lower patch', () => {
    for (const v of ['1.79.0', '1.87.2', '2.0.0']) {
      withOxlint(v)
      expect(oxlintFloorCheck(dir)).toBeNull()
    }
    withOxlint('1.100.0')
    expect(oxlintFloorCheck(dir)).toBeNull()
  })

  it('treats a prerelease of the floor as below it, and an unparseable version as absent', () => {
    withOxlint('1.79.0-beta.1')
    expect(text(oxlintFloorCheck(dir))).toContain('oxlint 1.79.0-beta.1')
    withOxlint('nightly')
    expect(oxlintFloorCheck(dir)).toBeNull()
    write('node_modules/oxlint/package.json', JSON.stringify({ version: 179 }))
    expect(oxlintFloorCheck(dir)).toBeNull()
  })

  it('ignores build metadata: 1.78.0+build.1 is below the floor, 1.79.0+build.1 is not', () => {
    withOxlint('1.78.0+build.1')
    expect(text(oxlintFloorCheck(dir))).toContain('oxlint 1.78.0+build.1')
    withOxlint('1.79.0+build.1')
    expect(oxlintFloorCheck(dir)).toBeNull()
  })

  it('passes when .oxlintrc.json exists but no oxlint is installed', () => {
    write('.oxlintrc.json', '{}')
    expect(oxlintFloorCheck(dir)).toBeNull()
  })

  it('judges the nearest oxlint: an old one below a newer ancestor fails', () => {
    write('node_modules/oxlint/package.json', JSON.stringify({ version: '1.90.0' }))
    write('app/.oxlintrc.json', '{}')
    write('app/node_modules/oxlint/package.json', JSON.stringify({ version: '1.70.0' }))
    expect(text(oxlintFloorCheck(join(dir, 'app')))).toContain('oxlint 1.70.0')
  })

  it('passes an old oxlint when there is no .oxlintrc.json', () => {
    write('node_modules/oxlint/package.json', JSON.stringify({ version: '1.60.0' }))
    expect(oxlintFloorCheck(dir)).toBeNull()
  })

  it('passes when no oxlint is installed or no .oxlintrc.json exists', () => {
    expect(oxlintFloorCheck(dir)).toBeNull()
    write('node_modules/oxlint/package.json', JSON.stringify({ version: '1.60.0' }))
    expect(oxlintFloorCheck(dir)).toBeNull()
  })
})

describe('migratingSince (doctor --from)', () => {
  const md = [
    '# Migrating',
    '## Unreleased — next',
    '- `basalt/new-rule` is `error`.',
    '## 2.10.0',
    '- `basalt/old-rule` is `error`.',
    '## 2.9.0 — wave',
    'Prose that names nothing.',
    '- `--vx-status-bad` moved.',
    '- `basalt/card-inset` is now `error`.',
    '```ts',
    '// basalt/in-fence error',
    '```',
    '### Visible without code change',
    'Badge casing changed.',
    '### Other',
    'Not shown.',
    '## 2.8.0',
    '- `basalt/too-old` is `error`.',
  ].join('\n')

  it('keeps only versions after `from` up to the install, newest first', () => {
    const out = migratingSince(md, '2.8.0', '2.10.0').join('\n')
    expect(out).toContain('## 2.10.0')
    expect(out).toContain('## 2.9.0 — wave')
    expect(out).not.toContain('too-old')
    expect(out).not.toContain('new-rule')
    expect(out.indexOf('2.10.0')).toBeLessThan(out.indexOf('2.9.0'))
  })

  it('filters to rule ids, tokens, error/promoted lines and the visible subsection', () => {
    const out = migratingSince(md, '2.8.0', '2.10.0')
    expect(out).toContain('- `--vx-status-bad` moved.')
    expect(out).toContain('Badge casing changed.')
    expect(out.join('\n')).not.toMatch(/Prose that names nothing|Not shown|in-fence/)
  })

  it('stops at the installed version', () => {
    const out = migratingSince(md, '2.8.0', '2.9.0').join('\n')
    expect(out).toContain('## 2.9.0')
    expect(out).not.toContain('2.10.0')
  })

  it('compares numerically, not lexically', () => {
    expect(migratingSince(md, '2.9.0', '2.10.0').join('\n')).toContain('## 2.10.0')
  })
})

describe('staleEmittedSheets', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'basalt-sheets-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  const sheet = (version: string): string =>
    '/* @generated basalt-ui — do not edit; regenerate with the command on the next line */\n' +
    `/* basalt-ui ${version} — \`basalt-ui tokens:css --out src/tokens.css\` */\n:root {}\n`

  it('names the recorded invocation for a sheet from another version', () => {
    writeFileSync(join(dir, 'tokens.css'), sheet('2.27.0'))
    const out = staleEmittedSheets(dir, ['tokens.css'], '2.28.0')
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('Fix: `basalt-ui tokens:css --out src/tokens.css`')
  })

  it('is silent for a current sheet, a hand-written one, and no install', () => {
    writeFileSync(join(dir, 'tokens.css'), sheet('2.28.0'))
    writeFileSync(join(dir, 'app.css'), ':root {}\n')
    expect(staleEmittedSheets(dir, ['tokens.css', 'app.css'], '2.28.0')).toEqual([])
    expect(staleEmittedSheets(dir, ['tokens.css'], null)).toEqual([])
  })
})
