/**
 * The 2.0 upgrade path: `doctor`'s `tsconfig-base` / `retired-lint-rules` / `dropped-subpaths`
 * checks, `sync` carrying a 1.41-shaped install forward, and the seeds compiling against `dist`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { doctor } from './doctor'
import {
  droppedSubpathsProblem,
  retiredLintRulesProblem,
  tsconfigBaseProblem,
} from './doctor-upgrade'
import { init, MANIFEST_PATH, normalizeForLedger, sha256, sync } from './index'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const PKG_VERSION = (
  JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as { version: string }
).version

let dir: string

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
    expect(tsconfigBaseProblem(dir)).toBeNull()
    write('tsconfig.json', '{ "extends": ["./x.json", "basalt-ui/configs/tsconfig.base.json"] }')
    expect(tsconfigBaseProblem(dir)).toBeNull()
  })

  it('follows a solution-style tsconfig into the app config it references', () => {
    write('tsconfig.json', '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }')
    write('tsconfig.app.json', '// comment\n{ "extends": "./tsconfig.local", }')
    write(
      'tsconfig.local.json',
      '{ "extends": "./node_modules/basalt-ui/configs/tsconfig.base.json" }',
    )
    expect(tsconfigBaseProblem(dir)).toBeNull()
  })

  it('fails with the exact extends value to set', () => {
    write('tsconfig.json', '{ "compilerOptions": { "strict": true } }')
    const problem = tsconfigBaseProblem(dir)
    expect(problem).toContain('"extends": "basalt-ui/configs/tsconfig.react-app.json"')
    expect(problem).toContain('exactOptionalPropertyTypes')
  })

  it('fails on a missing tsconfig.json', () => {
    expect(tsconfigBaseProblem(dir)).toContain('tsconfig.json missing')
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
      'node_modules/basalt-ui/configs/oxlint-plugin.js',
      [
        'export const RETIRED_RULE_IDS = new Set([',
        "  'visx-boundary', // gone with the visx layer",
        '])',
        'export default {',
        "  meta: { name: 'basalt' },",
        '  rules: {',
        "    'card-inset': cardInset,",
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
    const problem = retiredLintRulesProblem(dir, install())
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
    expect(retiredLintRulesProblem(dir, install())).toContain('basalt/provider-above-router')
    write('base.json', '{ "rules": { "basalt/card-inset": "error" } }')
    expect(retiredLintRulesProblem(dir, install())).toBeNull()
  })

  it('reads the real shipped plugin: a visx-era id is retired, a live id is not', () => {
    write(
      '.oxlintrc.json',
      '{ "rules": { "basalt/visx-boundary": "error", "basalt/card-inset": "error" } }',
    )
    const problem = retiredLintRulesProblem(dir, {
      dir: PKG_ROOT,
      version: PKG_VERSION,
      how: 'cwd',
    })
    expect(problem).toContain('basalt/visx-boundary')
    expect(problem).not.toContain('basalt/card-inset')
  })
})

describe('doctor — dropped-subpaths', () => {
  it('fails with file:line for an import the installed exports map lacks', () => {
    write(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({
        name: 'basalt-ui',
        exports: { '.': {}, './state': {}, './styles.css': '', './configs/*': '' },
      }),
    )
    write(
      'src/app.tsx',
      [
        "import { a } from 'basalt-ui'",
        "import { q } from 'basalt-ui/query'",
        "import 'basalt-ui/styles.css'",
        "import { s } from 'basalt-ui/state'",
        'const m = await import("basalt-ui/connectivity")',
      ].join('\n'),
    )
    const problem = droppedSubpathsProblem(
      dir,
      { roots: ['src'] },
      { dir: join(dir, 'node_modules/basalt-ui'), version: null, how: 'cwd' },
    )
    expect(problem).toContain('src/app.tsx:2 imports basalt-ui/query')
    expect(problem).toContain('src/app.tsx:5 imports basalt-ui/connectivity')
    expect(problem).not.toContain('basalt-ui/state')
    expect(problem).toContain('MIGRATING.md § 2.0')
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
    for (const line of failures) expect(line).toMatch(/Fix:|[Rr]un `|Add "extends"|Repoint|set /)
  })
})

describe('sync — carries a 1.41 install to the installed release', () => {
  const OLD = '1.41.0'
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
