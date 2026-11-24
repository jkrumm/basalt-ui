/**
 * The `basalt.sibling` key (docs/v3/concepts/migration-release.md 6.1): a second install in a repo
 * whose root install stays root-owned. The fixture (test/fixtures/sibling/repo) is a root with
 * `basalt.app: apps/x` and a declared sibling `apps/x-v3`; every case copies it, adds a `.git`
 * marker and runs the real `init`, `sync` and `doctor`.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { doctor } from '../doctor'
import type { DoctorOptions } from '../doctor'
import { packageRoot, readFrameworkVersion } from '../index'
import { init } from '../init'
import { parseManifest } from '../manifest'
import { sync } from './index'

const FIXTURE = fileURLToPath(new URL('../../../test/fixtures/sibling/repo/', import.meta.url))
const OXFMT = fileURLToPath(new URL('../../../../../node_modules/.bin/oxfmt', import.meta.url))

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A copy of the fixture repo; each app gets its own `node_modules/basalt-ui` and the oxfmt bin. */
function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-sibling-'))
  scratch.push(dir)
  cpSync(FIXTURE, dir, { recursive: true })
  mkdirSync(join(dir, '.git'))
  for (const app of ['apps/x', 'apps/x-v3']) install(dir, app)
  return dir
}

const PEERS: Record<string, string> = {
  react: '19.3.0',
  'react-dom': '19.3.0',
  tailwindcss: '4.3.5',
  '@base-ui/react': '1.9.0',
  '@tanstack/react-router': '1.170.0',
  '@tanstack/react-query': '5.104.0',
  '@tailwindcss/vite': '4.3.5',
  '@tanstack/router-plugin': '1.168.40',
}

/** The doctor options a healthy tree needs: a lint runner that fires, oxlint at the pin, no base ref. */
const HEALTHY: DoctorOptions = {
  runLint: () => ['basalt/colour-literal'],
  installedOxlint: '1.93.0',
  baseRef: 'HEAD',
}

function install(dir: string, app: string): void {
  const modules = join(dir, app, 'node_modules')
  mkdirSync(join(modules, 'basalt-ui'), { recursive: true })
  mkdirSync(join(modules, '.bin'), { recursive: true })
  const manifest = { name: 'basalt-ui', version: readFrameworkVersion(packageRoot()) }
  writeFileSync(join(modules, 'basalt-ui/package.json'), JSON.stringify(manifest))
  symlinkSync(OXFMT, join(modules, '.bin/oxfmt'))
  for (const [name, version] of Object.entries(PEERS)) {
    mkdirSync(join(modules, name), { recursive: true })
    writeFileSync(join(modules, name, 'package.json'), JSON.stringify({ name, version }))
  }
}

/** A copy of `apps/x-v3` as another declared sibling. */
function addSibling(dir: string, name: string): void {
  cpSync(join(dir, 'apps/x-v3'), join(dir, 'apps', name), {
    recursive: true,
    filter: (src) =>
      !/node_modules|\.basalt|\.claude|AGENTS\.md|tokens\.css|\.oxlintrc|\.oxfmtrc|\.stylelintrc/.test(
        src,
      ),
  })
  install(dir, `apps/${name}`)
}

/** Turns the `.git` marker into a repo with one commit, the base ref the budget ratchet reads. */
function commit(dir: string): void {
  rmSync(join(dir, '.git'), { recursive: true, force: true })
  const git = (...args: string[]): void => {
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: dir,
      stdio: 'ignore',
    })
  }
  git('init', '-q')
  git('add', '-A', '-f')
  git('commit', '-q', '-m', 'base')
}

function edit(dir: string, path: string, change: (json: Record<string, unknown>) => void): void {
  const file = join(dir, path)
  const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  change(json)
  writeFileSync(file, JSON.stringify(json))
}

type Out = { code: number; log: string }

async function capture(run: () => number | Promise<number>): Promise<Out> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  console.log = console.error = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  try {
    return { code: await run(), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const rootSync = (dir: string, check = true): Promise<Out> => capture(() => sync({ check }, dir))
const appInit = (dir: string, app: string): Promise<Out> =>
  capture(() =>
    init(['--profile', 'app'], join(dir, app), { run: () => true, doctor: async () => 0 }),
  )

/** Every file under `dir` (no `.git`, no `node_modules`) as relative path -> bytes. */
function snapshot(dir: string, root = dir, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) snapshot(abs, root, out)
    else out.set(abs.slice(root.length + 1), readFileSync(abs, 'utf8'))
  }
  return out
}

const added = (before: Map<string, string>, after: Map<string, string>): string[] =>
  [...after.keys()].filter((path) => !before.has(path)).toSorted()
const changed = (before: Map<string, string>, after: Map<string, string>): string[] =>
  [...before.keys()].filter((path) => after.get(path) !== before.get(path)).toSorted()

describe('the resolver', () => {
  it('root sync --check exits 1 with neither key declared and 0 with both', async () => {
    const bare = repo()
    edit(bare, 'package.json', (json) => delete json['basalt'])
    edit(bare, 'apps/x-v3/package.json', (json) => delete json['basalt'])
    const refused = await rootSync(bare)
    expect(refused.code).toBe(1)
    expect(refused.log).toContain('cannot tell which is the app')

    const declared = repo()
    expect((await rootSync(declared, false)).code).toBe(0)
    expect((await rootSync(declared)).code).toBe(0)
  })

  it('refuses a sibling without `basalt.app` too only when the manifest does not cover the root app', async () => {
    const dir = repo()
    edit(dir, 'package.json', (json) => delete json['basalt'])
    await rootSync(dir, false)
    expect((await rootSync(dir)).code).toBe(0)
    edit(dir, 'apps/x-v3/package.json', (json) => delete json['basalt'])
    expect((await rootSync(dir)).code).toBe(1)
  })

  it('still refuses an undeclared third install with the existing message', async () => {
    const dir = repo()
    mkdirSync(join(dir, 'apps/z/src'), { recursive: true })
    writeFileSync(
      join(dir, 'apps/z/package.json'),
      JSON.stringify({ name: 'z', dependencies: { 'basalt-ui': '*' } }),
    )
    writeFileSync(join(dir, 'apps/z/src/main.tsx'), '// z\n')
    const result = await rootSync(dir)
    expect(result.code).toBe(1)
    expect(result.log).toContain('workspace packages depend on basalt-ui and have a Vite entry')
    expect(result.log).toContain('apps/z')
    expect(result.log).not.toContain('apps/x-v3')
  })
})

describe('init --profile app in a declared sibling', () => {
  it('writes the app-scoped install and, at the root, only basalt-v3-* rules and skills', async () => {
    const dir = repo()
    const before = snapshot(dir)
    const result = await appInit(dir, 'apps/x-v3')
    expect(result.code).toBe(0)

    const after = snapshot(dir)
    for (const file of ['.basalt/manifest.json', '.oxlintrc.json', 'AGENTS.md']) {
      expect(existsSync(join(dir, 'apps/x-v3', file))).toBe(true)
    }
    const roots = added(before, after).filter((path) => !path.startsWith('apps/'))
    expect(roots.length).toBeGreaterThan(0)
    expect(
      roots.every((path) =>
        /^\.claude\/(rules\/basalt-v3-[\w-]+\.md|skills\/basalt-v3-[\w-]+\/.+)$/.test(path),
      ),
    ).toBe(true)
    expect(changed(before, after).filter((path) => !path.startsWith('apps/x-v3/'))).toEqual([])
    expect(existsSync(join(dir, '.oxlintrc.json'))).toBe(false)
    expect(existsSync(join(dir, '.claude/settings.json'))).toBe(false)
    expect(existsSync(join(dir, 'apps/x-v3/.basalt/hook.mjs'))).toBe(false)

    const skipped = result.log.split('\n').filter((line) => line.startsWith('skipped '))
    expect(skipped).toHaveLength(2)
    expect(skipped.join('\n')).toContain('lefthook.yml')
    expect(skipped.join('\n')).toContain('check.yml')
    console.log(
      `sibling init: ${roots.length} repo-root files written, ${skipped.length} placement skips`,
    )
  })

  it('renders the rules for the app and renames the skills and their references', async () => {
    const dir = repo()
    await appInit(dir, 'apps/x-v3')
    const rules = readdirSync(join(dir, '.claude/rules'))
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      const text = readFileSync(join(dir, '.claude/rules', rule), 'utf8')
      if (/^paths:/m.test(text)) expect(text).toContain("'apps/x-v3/")
    }
    const skill = readFileSync(join(dir, '.claude/skills/basalt-v3-design/SKILL.md'), 'utf8')
    expect(skill).toMatch(/^name: basalt-v3-design$/m)
    const agents = readFileSync(join(dir, 'apps/x-v3/AGENTS.md'), 'utf8')
    expect(agents).toContain('/basalt-v3-design')
    expect(agents).toContain('basalt-design-reviewer')
    const parsed = parseManifest(readFileSync(join(dir, 'apps/x-v3/.basalt/manifest.json'), 'utf8'))
    expect('manifest' in parsed && parsed.manifest.sibling).toBe('basalt-v3-')
  })

  it('leaves the root green and every basalt-v3-* file alone, and the app bin green', async () => {
    const dir = repo()
    await rootSync(dir, false)
    await appInit(dir, 'apps/x-v3')
    const placed = snapshot(dir)

    expect((await rootSync(dir)).code).toBe(0)
    expect((await rootSync(dir, false)).code).toBe(0)
    expect(snapshot(dir)).toEqual(placed)

    const app = join(dir, 'apps/x-v3')
    expect((await capture(() => sync({ check: true }, app))).code).toBe(0)
    commit(dir)
    const health = await capture(() => doctor(app, [], HEALTHY))
    expect(health.log.split('\n').filter((line) => /^(✖|⚠)/.test(line))).toEqual([])
    expect(health.code).toBe(0)
  })

  it('is idempotent', async () => {
    const dir = repo()
    await appInit(dir, 'apps/x-v3')
    const first = snapshot(dir)
    expect((await appInit(dir, 'apps/x-v3')).code).toBe(0)
    expect(snapshot(dir)).toEqual(first)
  })

  it('claims the dirname prefix on a fresh clone, where no root sync has placed a basalt-v3-* file', async () => {
    const dir = repo()
    await appInit(dir, 'apps/x-v3')
    rmSync(join(dir, '.claude'), { recursive: true, force: true })
    addSibling(dir, 'y-v3')
    expect((await appInit(dir, 'apps/y-v3')).code).toBe(0)
    const parsed = parseManifest(readFileSync(join(dir, 'apps/y-v3/.basalt/manifest.json'), 'utf8'))
    expect('manifest' in parsed && parsed.manifest.sibling).toBe('basalt-v3-y-v3-')
  })

  it('gives a second sibling basalt-v3-<dirname>-* names and overwrites neither app', async () => {
    const dir = repo()
    await rootSync(dir, false)
    await appInit(dir, 'apps/x-v3')
    const first = snapshot(dir)
    addSibling(dir, 'y-v3')
    expect((await appInit(dir, 'apps/y-v3')).code).toBe(0)
    const second = snapshot(dir)

    expect(changed(first, second)).toEqual([])
    const fresh = added(first, second).filter((path) => path.startsWith('.claude/'))
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.every((path) => /basalt-v3-y-v3-/.test(path))).toBe(true)
    const yRule = readdirSync(join(dir, '.claude/rules')).find((n) =>
      n.startsWith('basalt-v3-y-v3-'),
    )
    expect(readFileSync(join(dir, '.claude/rules', yRule ?? ''), 'utf8')).not.toContain(
      "'apps/x-v3/",
    )

    const root = await rootSync(dir)
    expect(root.log).toBe('✓ basalt-ui sync --check: all managed files current.\n')
    expect((await capture(() => sync({ check: true }, join(dir, 'apps/x-v3')))).code).toBe(0)
    expect((await capture(() => sync({ check: true }, join(dir, 'apps/y-v3')))).code).toBe(0)
  })
})

describe('sibling: the session note', () => {
  it('prints it when a sibling sync rewrites a repo-root agent file', async () => {
    const dir = repo()
    await appInit(dir, 'apps/x-v3')
    const rules = join(dir, '.claude/rules')
    const first = readdirSync(rules).find((name) => name.startsWith('basalt-'))
    expect(first).toBeDefined()
    rmSync(join(rules, first ?? ''))
    const app = join(dir, 'apps/x-v3')
    const healed = await capture(() => sync({}, app))
    expect(healed.code).toBe(0)
    expect(healed.log).toContain('Agent sessions:')
    expect((await capture(() => sync({}, app))).log).not.toContain('Agent sessions:')
  })
})
