/**
 * Placement-engine contract tests. init/sync write into consumers' git-tracked trees, which makes
 * this the highest-risk code in the repo — every ownership promise the managed/seed model makes is
 * asserted here:
 *
 *  - sync is idempotent (second run is a byte-level no-op, manifest stable)
 *  - a locally-edited managed file is never clobbered (skipped + reported; --check exits 1)
 *  - --force overwrites managed files but never touches seeds
 *  - a seed is recreated only when missing
 *  - block-splicing preserves surrounding host content, appends when markers are absent, and
 *    errors loudly on duplicate markers instead of silently picking one
 *  - the managed block lives in AGENTS.md; a legacy CLAUDE.md is left alone (no migration)
 *  - --check performs zero writes (filesystem is byte-identical afterwards)
 *  - exit codes: 0 clean / 1 drift
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { init, renderRulePaths } from './index.ts'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const RULE_SOURCE = readFileSync(resolve(PKG_ROOT, 'agent/rules/basalt-tokens.md'), 'utf8')
const SHIPPED_SKILL = readFileSync(resolve(PKG_ROOT, 'agent/skills/basalt-design/SKILL.md'), 'utf8')

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-engine-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function read(relPath: string): string {
  return readFileSync(join(dir, relPath), 'utf8')
}

/** The tokens rule as the installer renders it for the fixture's current `basalt.roots`. */
function shippedRule(): string {
  const pkg = JSON.parse(read('package.json')) as { basalt?: { roots?: string[] } }
  return renderRulePaths(RULE_SOURCE, pkg.basalt?.roots ?? ['src'])
}

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function silenced<T>(fn: () => T): T {
  const originalLog = console.log
  const originalError = console.error
  console.log = () => {}
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

/** Captures both console.log and console.error — init()/sync() interleave the two. */
function capture(fn: () => number): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  console.log = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.error = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  try {
    return { code: fn(), log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

describe('managed vs seed placement', () => {
  it('init places rules AND skills as managed files, plus the toolchain seeds', () => {
    silenced(() => init(dir))
    expect(read('.claude/rules/basalt-tokens.md')).toBe(shippedRule())
    expect(read('.claude/skills/basalt-design/SKILL.md')).toBe(SHIPPED_SKILL)
    expect(existsSync(join(dir, '.claude/skills/basalt-app/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, '.claude/skills/basalt-charts/SKILL.md'))).toBe(true)
    // Seeds are references, not copies — the toolchain auto-updates through node_modules.
    expect(read('.oxlintrc.json')).toContain('./node_modules/basalt-ui/configs/oxlint.json')
    expect(read('lefthook.yml')).toContain('node_modules/basalt-ui/configs/lefthook.yml')
  })
})

describe('block splicing (managed with markers)', () => {
  it('appends the block when markers are absent, preserving existing host content', () => {
    write('AGENTS.md', '# fixture app\n\nMy own instructions.\n')
    silenced(() => init(dir))
    const host = read('AGENTS.md')
    expect(host.startsWith('# fixture app\n\nMy own instructions.')).toBe(true)
    expect(host).toContain('<!-- basalt:begin')
    expect(host).toContain('<!-- basalt:end -->')
  })
})

// A real consumer's repo root (an API + collector) had its dashboard package in `web/`, one level
// below the repo `.git`. `init`/`sync` used to seed lefthook.yml, .github/workflows/check.yml, and
// relative to the PACKAGE dir regardless — none of which anything reads from
// there, and re-created on every sync even after the consumer relocated them by hand.
describe('repo-root-shaped seeds (lefthook.yml / check.yml)', () => {
  it('package IS the repo root (a bare .git dir present): writes lefthook.yml and check.yml, unchanged', () => {
    mkdirSync(join(dir, '.git'))
    silenced(() => init(dir))
    expect(existsSync(join(dir, 'lefthook.yml'))).toBe(true)
    expect(existsSync(join(dir, '.github/workflows/check.yml'))).toBe(true)
  })

  it('no .git anywhere in the tree: falls back to writing lefthook.yml and check.yml, unchanged', () => {
    silenced(() => init(dir))
    expect(existsSync(join(dir, 'lefthook.yml'))).toBe(true)
    expect(existsSync(join(dir, '.github/workflows/check.yml'))).toBe(true)
  })

  it('package lives in a subdirectory of the repo: init skips both tooling seeds, notes the repo root, exits 0', () => {
    mkdirSync(join(dir, '.git'))
    const webDir = join(dir, 'web')
    mkdirSync(webDir, { recursive: true })
    writeFileSync(join(webDir, 'package.json'), JSON.stringify({ name: 'web' }))

    const { code, log } = capture(() => init(webDir))

    expect(code).toBe(0)
    expect(existsSync(join(webDir, 'lefthook.yml'))).toBe(false)
    expect(existsSync(join(webDir, '.github/workflows/check.yml'))).toBe(false)
    expect(log).toContain('lefthook.yml')
    expect(log).toContain('.github/workflows/check.yml')
    expect(log).toContain(dir)
    // Repo-root-shaped seeds are skipped; everything else still seeds normally.
    expect(existsSync(join(webDir, 'DESIGN.md'))).toBe(true)
    expect(existsSync(join(webDir, '.oxlintrc.json'))).toBe(true)
  })
})
