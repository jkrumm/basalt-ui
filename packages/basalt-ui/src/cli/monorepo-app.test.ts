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
import { init, packageRoot, resolveAppDir } from './index'

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
})
