/**
 * The 2.0 upgrade path: `doctor`'s `tsconfig-base` / `retired-lint-rules` / `dropped-subpaths`
 * checks, `sync` carrying a 1.41-shaped install forward, and the seeds compiling against `dist`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { doctor } from './doctor'
import {
  appWiringCheck,
  droppedSubpathsCheck,
  retiredLintRulesCheck,
  seedTsconfigExtends,
  tsconfigBaseCheck,
} from './doctor-upgrade'
import type { Check } from './doctor-upgrade'
import {
  init,
  MANIFEST_PATH,
  mergeOxlintExtends,
  normalizeForLedger,
  parseJsonc,
  sha256,
  sync,
} from './index'

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
    expect(tracked.filter((d) => d.startsWith('.claude/skills/'))).toHaveLength(3)

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

  it('follows the entry named by index.html and accepts an existing routeTree.gen', () => {
    write('index.html', '<script type="module" src="/app/boot.tsx"></script>')
    write('app/boot.tsx', 'createBasaltRouter(); <BasaltProvider router={r} />')
    write('src/routeTree.gen.ts', 'export {}\n')
    expect(appWiringCheck(dir)).toBeNull()
    rmSync(join(dir, 'app/boot.tsx'))
    expect(text(appWiringCheck(dir))).toContain('app/boot.tsx does not exist')
  })

  const ENTRY = 'createBasaltRouter(); <BasaltProvider router={router} />\n'

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
    expect(capture(() => doctor(dir)).log).toContain('app-wiring: n/a')
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
