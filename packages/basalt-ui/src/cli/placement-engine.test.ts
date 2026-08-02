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
 *  - --check performs zero writes (filesystem is byte-identical afterwards)
 *  - exit codes: 0 clean / 1 drift
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { init, sync } from './index.ts'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SHIPPED_RULE = readFileSync(resolve(PKG_ROOT, 'agent/rules/basalt-tokens.md'), 'utf8')
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

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

/** Byte-level snapshot of every file under the fixture dir — the zero-writes/idempotency oracle. */
function snapshotDir(root: string = dir): Map<string, string> {
  const out = new Map<string, string>()
  function walk(d: string): void {
    for (const name of readdirSync(d)) {
      const abs = resolve(d, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else out.set(relative(root, abs), readFileSync(abs, 'utf8'))
    }
  }
  walk(root)
  return out
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
    expect(read('.claude/rules/basalt-tokens.md')).toBe(SHIPPED_RULE)
    expect(read('.claude/skills/basalt-design/SKILL.md')).toBe(SHIPPED_SKILL)
    expect(existsSync(join(dir, '.claude/skills/basalt-app/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, '.claude/skills/basalt-charts/SKILL.md'))).toBe(true)
    // Seeds are references, not copies — the toolchain auto-updates through node_modules.
    expect(read('.oxlintrc.json')).toContain('./node_modules/basalt-ui/configs/oxlint.json')
    expect(read('lefthook.yml')).toContain('node_modules/basalt-ui/configs/lefthook.yml')
  })

  it('sync is idempotent: the second run is a byte-level no-op and the manifest is stable', () => {
    silenced(() => init(dir))
    expect(silenced(() => sync({}, dir))).toBe(0)
    const before = snapshotDir()
    expect(silenced(() => sync({}, dir))).toBe(0)
    expect(snapshotDir()).toEqual(before)
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('a locally-edited managed file is never clobbered: skipped by sync, --check exits 1', () => {
    silenced(() => init(dir))
    write('.claude/rules/basalt-tokens.md', '# my local law\n')
    expect(silenced(() => sync({}, dir))).toBe(0)
    expect(read('.claude/rules/basalt-tokens.md')).toBe('# my local law\n')
    expect(silenced(() => sync({ check: true }, dir))).toBe(1)
  })

  it('--force overwrites a drifted managed file but never touches a seed', () => {
    silenced(() => init(dir))
    write('.claude/rules/basalt-tokens.md', '# my local law\n')
    write('.claude/skills/basalt-design/SKILL.md', '# my local skill\n')
    write('DESIGN.md', '# my design\n')
    write('lefthook.yml', 'pre-commit:\n  commands: {}\n')
    silenced(() => sync({ force: true }, dir))
    expect(read('.claude/rules/basalt-tokens.md')).toBe(SHIPPED_RULE)
    expect(read('.claude/skills/basalt-design/SKILL.md')).toBe(SHIPPED_SKILL)
    expect(read('DESIGN.md')).toBe('# my design\n')
    expect(read('lefthook.yml')).toBe('pre-commit:\n  commands: {}\n')
  })

  it('a seed is recreated only when missing; an edited seed never drifts --check', () => {
    silenced(() => init(dir))
    rmSync(join(dir, 'DESIGN.md'))
    silenced(() => sync({}, dir))
    expect(existsSync(join(dir, 'DESIGN.md'))).toBe(true)
    write('DESIGN.md', '# my design\n')
    silenced(() => sync({}, dir))
    expect(read('DESIGN.md')).toBe('# my design\n')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('a pre-existing consumer file at a managed dest is kept by init, then treated as drift', () => {
    write('.claude/rules/basalt-tokens.md', '# predates basalt\n')
    silenced(() => init(dir))
    expect(read('.claude/rules/basalt-tokens.md')).toBe('# predates basalt\n')
    expect(silenced(() => sync({ check: true }, dir))).toBe(1)
    silenced(() => sync({ force: true }, dir))
    expect(read('.claude/rules/basalt-tokens.md')).toBe(SHIPPED_RULE)
  })
})

describe('block splicing (managed with markers)', () => {
  it('appends the block when markers are absent, preserving existing host content', () => {
    write('CLAUDE.md', '# fixture app\n\nMy own instructions.\n')
    silenced(() => init(dir))
    const host = read('CLAUDE.md')
    expect(host.startsWith('# fixture app\n\nMy own instructions.')).toBe(true)
    expect(host).toContain('<!-- basalt:begin')
    expect(host).toContain('<!-- basalt:end -->')
  })

  it('replaces only the marked region on sync, preserving content before and after', () => {
    silenced(() => init(dir))
    // A stale region from an older basalt-ui, embedded in consumer-owned host content.
    write(
      'CLAUDE.md',
      '# above\n\n<!-- basalt:begin 0.9.9 -->\nstale body\n<!-- basalt:end -->\n\n# below\n',
    )
    silenced(() => sync({ force: true }, dir))
    const after = read('CLAUDE.md')
    expect(after.startsWith('# above\n')).toBe(true)
    expect(after.trimEnd().endsWith('# below')).toBe(true)
    expect(after).not.toContain('stale body')
    expect(after.match(/<!-- basalt:begin/g)?.length).toBe(1)
  })

  it('errors loudly on duplicate begin markers instead of silently picking one', () => {
    silenced(() => init(dir))
    const block = read('CLAUDE.md')
    write('CLAUDE.md', `${block}\n\n${block}`)
    expect(() => silenced(() => sync({}, dir))).toThrow(/duplicate/)
    expect(() => silenced(() => sync({ check: true }, dir))).toThrow(/duplicate/)
  })
})

describe('--check performs zero writes', () => {
  it('leaves the filesystem byte-identical on a clean tree AND on a drifted tree', () => {
    silenced(() => init(dir))
    const clean = snapshotDir()
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
    expect(snapshotDir()).toEqual(clean)

    write('.claude/rules/basalt-tokens.md', '# my local law\n')
    rmSync(join(dir, 'DESIGN.md'))
    const drifted = snapshotDir()
    expect(silenced(() => sync({ check: true }, dir))).toBe(1)
    expect(snapshotDir()).toEqual(drifted)
  })
})

// A real consumer's repo root (an API + collector) had its dashboard package in `web/`, one level
// below the repo `.git`. `init`/`sync` used to seed lefthook.yml, .github/workflows/check.yml, and
// src/query-client.ts relative to the PACKAGE dir regardless — none of which anything reads from
// there, and re-created on every sync even after the consumer relocated them by hand.
describe('repo-root-shaped seeds (lefthook.yml / check.yml / query-client.ts)', () => {
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

  it('package lives in a subdirectory of the repo: sync ALSO skips both tooling seeds and notes it, exits 0', () => {
    mkdirSync(join(dir, '.git'))
    const webDir = join(dir, 'web')
    mkdirSync(webDir, { recursive: true })
    writeFileSync(join(webDir, 'package.json'), JSON.stringify({ name: 'web' }))
    silenced(() => init(webDir))

    const { code, log } = capture(() => sync({}, webDir))

    expect(code).toBe(0)
    expect(existsSync(join(webDir, 'lefthook.yml'))).toBe(false)
    expect(existsSync(join(webDir, '.github/workflows/check.yml'))).toBe(false)
    expect(log).toContain('lefthook.yml')
  })

  it('an existing query-client.ts elsewhere under src/ suppresses the seed and names the found file', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-query': '^5.101.0' } }),
    )
    write('src/lib/query-client.ts', 'export const queryClient = 1\n')

    const { code, log } = capture(() => init(dir))

    expect(code).toBe(0)
    expect(existsSync(join(dir, 'src/query-client.ts'))).toBe(false)
    expect(read('src/lib/query-client.ts')).toBe('export const queryClient = 1\n')
    expect(log).toContain('src/lib/query-client.ts')
  })

  it('an existing query-client.ts elsewhere under src/ keeps suppressing the seed on sync', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-query': '^5.101.0' } }),
    )
    silenced(() => init(dir))
    expect(existsSync(join(dir, 'src/query-client.ts'))).toBe(true)
    rmSync(join(dir, 'src/query-client.ts'))
    write('src/lib/query-client.ts', 'export const queryClient = 1\n')

    const { code, log } = capture(() => sync({}, dir))

    expect(code).toBe(0)
    expect(existsSync(join(dir, 'src/query-client.ts'))).toBe(false)
    expect(log).toContain('src/lib/query-client.ts')
  })
})
