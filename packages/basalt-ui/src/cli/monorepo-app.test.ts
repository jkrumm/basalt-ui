/**
 * Monorepo awareness: `resolveAppDir` picks the app package once, `sync`/`init` seed the router
 * files there (never at the install root), and `doctor` checks the app from either directory.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, spyOn } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import { doctor } from './doctor'
import { init, packageRoot, resolveAppDir, sync } from './index'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-monorepo-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, content: string): void {
  const abs = join(dir, rel)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function pkg(rel: string, body: Record<string, unknown>): void {
  write(`${rel}package.json`, JSON.stringify(body))
}

/** Root + `apps/<name>` workspace packages; each listed app depends on basalt-ui with an entry. */
function monorepo(apps: string[], rootExtra: Record<string, unknown> = {}): void {
  pkg('', {
    name: 'root',
    workspaces: ['apps/*'],
    devDependencies: { 'basalt-ui': '*' },
    ...rootExtra,
  })
  for (const app of apps) {
    pkg(`apps/${app}/`, { name: app, dependencies: { 'basalt-ui': '*' } })
    write(`apps/${app}/src/main.tsx`, '// entry\n')
  }
  write(
    'node_modules/basalt-ui/package.json',
    JSON.stringify({ name: 'basalt-ui', version: '1.0.0' }),
  )
}

function quiet<T>(fn: () => T): T {
  const log = spyOn(console, 'log').mockImplementation(() => {})
  const err = spyOn(console, 'error').mockImplementation(() => {})
  try {
    return fn()
  } finally {
    log.mockRestore()
    err.mockRestore()
  }
}

describe('resolveAppDir', () => {
  it('auto-detects the one workspace package that depends on basalt-ui and has a Vite entry', () => {
    monorepo(['web'])
    pkg('apps/lib/', { name: 'lib' })
    expect(resolveAppDir(dir)).toEqual({ dir: join(dir, 'apps/web'), rel: 'apps/web' })
  })

  it('basalt.app wins over detection', () => {
    monorepo(['web', 'admin'], { basalt: { app: 'apps/admin' } })
    expect(resolveAppDir(dir)).toEqual({ dir: join(dir, 'apps/admin'), rel: 'apps/admin' })
  })

  it('two candidates is an error that names basalt.app', () => {
    monorepo(['web', 'admin'])
    const result = resolveAppDir(dir)
    expect(result).toHaveProperty('error')
    expect('error' in result && result.error).toContain('basalt.app')
  })

  it('a basalt.app outside the root or without a package.json is an error', () => {
    monorepo(['web'], { basalt: { app: '../elsewhere' } })
    expect(resolveAppDir(dir)).toHaveProperty('error')
  })

  it('a single-package app resolves to itself', () => {
    pkg('', { name: 'solo', dependencies: { 'basalt-ui': '*' } })
    write('src/main.tsx', '// entry\n')
    expect(resolveAppDir(dir)).toEqual({ dir, rel: '' })
  })
})

describe('sync / init in a monorepo', () => {
  it('seeds the router files in the app, never at the root, and the manifest stays at the root', () => {
    monorepo(['web'])
    quiet(() => init(dir))
    expect(existsSync(join(dir, '.basalt/manifest.json'))).toBe(true)
    expect(existsSync(join(dir, 'apps/web/src/routes/__root.tsx'))).toBe(true)
    expect(existsSync(join(dir, 'apps/web/src/lib/nav.tsx'))).toBe(true)
    expect(existsSync(join(dir, 'src/main.tsx'))).toBe(false)
    expect(existsSync(join(dir, 'src/routes/__root.tsx'))).toBe(false)
    expect(quiet(() => sync({}, dir))).toBe(0)
    expect(existsSync(join(dir, 'src'))).toBe(false)
  })

  it('places the design skill, its references and the reviewer at the root a monorepo-root session discovers', () => {
    // Claude Code reads `.claude/skills` and `.claude/agents` from the session's project root
    // (docs/waves/design-parity/SPEC.md § 9.4), so a session at the repo root — not in `apps/web` —
    // must find all of them there, and none of them inside the app package.
    monorepo(['web'])
    // A scratch package that ships a reference: the real tree may carry none yet.
    const pkgRoot = join(dir, '..', `${basename(dir)}-pkg`)
    for (const d of ['agent', 'configs'])
      cpSync(join(packageRoot(), d), join(pkgRoot, d), { recursive: true })
    cpSync(join(packageRoot(), 'package.json'), join(pkgRoot, 'package.json'))
    mkdirSync(join(pkgRoot, 'agent/skills/basalt-design/references'), { recursive: true })
    writeFileSync(join(pkgRoot, 'agent/skills/basalt-design/references/x.md'), 'x\n')
    onTestFinished(() => rmSync(pkgRoot, { recursive: true, force: true }))
    quiet(() => init(dir, { pkgRoot }))
    const shipped = join(pkgRoot, 'agent/skills/basalt-design')
    const files = readdirSync(shipped, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name).slice(shipped.length + 1))
    expect(files).toContain('SKILL.md')
    expect(files).toContain('references/x.md')
    for (const rel of files) {
      expect(existsSync(join(dir, '.claude/skills/basalt-design', rel))).toBe(true)
      expect(existsSync(join(dir, 'apps/web/.claude/skills/basalt-design', rel))).toBe(false)
    }
    expect(existsSync(join(dir, '.claude/agents/basalt-design-reviewer.md'))).toBe(true)
    expect(existsSync(join(dir, 'apps/web/.claude'))).toBe(false)
  })

  const MANAGED = [
    '.basalt',
    '.claude',
    'AGENTS.md',
    'DESIGN.md',
    '.oxlintrc.json',
    '.oxfmtrc.json',
    'src/routes/__root.tsx',
  ]

  function installBasalt(rel: string, version: string): void {
    write(
      `${rel}node_modules/basalt-ui/package.json`,
      JSON.stringify({ name: 'basalt-ui', version }),
    )
  }

  function syncOut(
    cwd: string,
    opts: Parameters<typeof sync>[0] = {},
  ): { code: number; log: string } {
    const lines: string[] = []
    const log = spyOn(console, 'log').mockImplementation((...a) => void lines.push(a.join(' ')))
    const err = spyOn(console, 'error').mockImplementation((...a) => void lines.push(a.join(' ')))
    try {
      return { code: sync(opts, cwd), log: lines.join('\n') }
    } finally {
      log.mockRestore()
      err.mockRestore()
    }
  }

  function installed(): void {
    monorepo(['web'])
    quiet(() => init(dir))
  }

  it('syncs the root install from the app package, writing nothing into the app', () => {
    installed()
    const { code, log } = syncOut(join(dir, 'apps/web'))
    expect(code).toBe(0)
    expect(log).toContain('syncing there')
    // The router seed is the one managed file that belongs in the app (see the first test).
    for (const f of MANAGED.slice(0, 6)) expect(existsSync(join(dir, 'apps/web', f))).toBe(false)
    for (const f of MANAGED.slice(0, 6)) expect(existsSync(join(dir, f))).toBe(true)
    expect(existsSync(join(dir, 'src/routes/__root.tsx'))).toBe(false)
  })

  it('refuses from a dependent package that is not the app (doctor would not accept it either)', () => {
    installed()
    pkg('packages/lib/', { name: 'lib', dependencies: { 'basalt-ui': '*' } })
    expect(syncOut(join(dir, 'packages/lib'), { check: true }).code).toBe(1)
  })

  it('refuses from a package that does not depend on basalt-ui', () => {
    installed()
    pkg('packages/other/', { name: 'other' })
    expect(syncOut(join(dir, 'packages/other')).code).toBe(1)
  })

  it('refuses when the package resolves a different basalt-ui than the root', () => {
    installed()
    installBasalt('apps/web/', '9.9.9')
    expect(syncOut(join(dir, 'apps/web')).code).toBe(1)
  })

  it('refuses when no ancestor carries a manifest', () => {
    monorepo(['web'])
    expect(syncOut(join(dir, 'apps/web')).code).toBe(1)
  })

  it('refuses on a malformed package.json', () => {
    installed()
    write('apps/web/package.json', '{ not json')
    expect(syncOut(join(dir, 'apps/web')).code).toBe(1)
  })

  it('a package with its own manifest syncs itself', () => {
    installed()
    write('apps/web/.basalt/manifest.json', JSON.stringify({ version: 1, files: {} }))
    expect(syncOut(join(dir, 'apps/web')).log).not.toContain('syncing there')
  })

  it('BASALT_CWD relocation skips the redirect', () => {
    installed()
    process.env['BASALT_CWD'] = join(dir, 'apps/web')
    try {
      expect(syncOut(dir).log).not.toContain('syncing there')
    } finally {
      delete process.env['BASALT_CWD']
    }
  })

  it('detects a Start app by the app package, not the root, and seeds nothing router-shaped', () => {
    monorepo(['web'])
    pkg('apps/web/', {
      name: 'web',
      dependencies: { 'basalt-ui': '*', '@tanstack/react-start': '*' },
    })
    quiet(() => init(dir))
    // main.tsx pre-exists in the fixture; init must leave it byte-identical and write no other seed.
    expect(readFileSync(join(dir, 'apps/web/src/main.tsx'), 'utf8')).toBe('// entry\n')
    expect(existsSync(join(dir, 'apps/web/src/routes'))).toBe(false)
    expect(existsSync(join(dir, 'apps/web/src/lib/nav.tsx'))).toBe(false)
  })

  it('refuses on an ambiguous app instead of guessing', () => {
    monorepo(['web', 'admin'])
    expect(quiet(() => init(dir))).toBe(1)
    expect(existsSync(join(dir, '.basalt/manifest.json'))).toBe(false)
  })
})

describe('doctor in a monorepo', () => {
  it('checks the app from the root and from inside the app package', () => {
    monorepo(['web'])
    write('apps/web/tsconfig.json', '{ "extends": "basalt-ui/configs/tsconfig.react-app.json" }')
    quiet(() => init(dir))
    const errors: string[] = []
    const spy = spyOn(console, 'error').mockImplementation((m: string) => void errors.push(m))
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      doctor(dir)
      doctor(join(dir, 'apps/web'))
    } finally {
      spy.mockRestore()
      log.mockRestore()
    }
    const out = errors.join('\n')
    expect(out).not.toContain('tsconfig-base: tsconfig.json missing')
    expect(out).not.toContain('.basalt/manifest.json missing')
  })

  it('warns about a router seed an earlier sync wrote at the root', () => {
    monorepo(['web'])
    quiet(() => init(dir))
    write('src/main.tsx', '// stray\n')
    const manifestPath = join(dir, '.basalt/manifest.json')
    const manifest = JSON.parse(require('node:fs').readFileSync(manifestPath, 'utf8'))
    manifest.files['src/main.tsx'] = 'x'
    writeFileSync(manifestPath, JSON.stringify(manifest))
    const logs: string[] = []
    const errs: string[] = []
    const log = spyOn(console, 'log').mockImplementation((m: string) => void logs.push(m))
    const err = spyOn(console, 'error').mockImplementation((m: string) => void errs.push(m))
    try {
      doctor(dir)
    } finally {
      log.mockRestore()
      err.mockRestore()
    }
    expect([...logs, ...errs].join('\n')).toContain('src/main.tsx was seeded at the install root')
  })
})

// Row 178: below the repo root, `sync` compares the shipped lefthook.yml / check.yml with the repo
// root's own files instead of printing two unconditional skips — read-only, it never writes there.
describe('sync — repo-root templates for a package below the repo root', () => {
  let web: string

  beforeEach(() => {
    mkdirSync(join(dir, '.git'))
    web = join(dir, 'web')
    mkdirSync(web, { recursive: true })
    writeFileSync(join(web, 'package.json'), JSON.stringify({ name: 'web' }))
    quiet(() => init(web))
  })

  function syncLog(): string {
    const lines: string[] = []
    const log = spyOn(console, 'log').mockImplementation((m: unknown) => void lines.push(String(m)))
    const err = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(sync({}, web)).toBe(0)
      return lines.join('\n')
    } finally {
      log.mockRestore()
      err.mockRestore()
    }
  }

  it('reports both as absent and writes nothing at the root', () => {
    const log = syncLog()
    expect(log).toContain('lefthook.yml at the repo root: absent')
    expect(log).toContain('check.yml at the repo root: absent')
    expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false)
  })

  it('reports in sync once the root files carry the re-rooted preset and the shipped steps', () => {
    // The same package placed at a repo root renders the shipped check.yml this one is judged against.
    const flat = mkdtempSync(resolve(tmpdir(), 'basalt-flat-'))
    onTestFinished(() => rmSync(flat, { recursive: true, force: true }))
    writeFileSync(join(flat, 'package.json'), JSON.stringify({ name: 'web' }))
    quiet(() => init(flat))
    write(
      '.github/workflows/check.yml',
      readFileSync(join(flat, '.github/workflows/check.yml'), 'utf8'),
    )
    const root = "root: 'web/'"
    write(
      'lefthook.yml',
      `extends:\n  - node_modules/basalt-ui/configs/lefthook.yml\npre-commit:\n  commands:\n    oxlint:\n      ${root}\n    oxfmt:\n      ${root}\n    check-theme:\n      ${root}\n`,
    )
    const log = syncLog()
    expect(log).toContain('lefthook.yml at the repo root: in sync')
    expect(log).toContain('check.yml at the repo root: in sync')
  })

  it('reports drifted when the root files lack the preset or a shipped step, and leaves them alone', () => {
    write('lefthook.yml', 'extends:\n  - somewhere/else.yml\n')
    write('.github/workflows/check.yml', 'name: mine\n')
    const log = syncLog()
    expect(log).toContain('lefthook.yml at the repo root: drifted')
    expect(log).toContain('check.yml at the repo root: drifted')
    expect(readFileSync(join(dir, 'lefthook.yml'), 'utf8')).toBe(
      'extends:\n  - somewhere/else.yml\n',
    )
  })
})
