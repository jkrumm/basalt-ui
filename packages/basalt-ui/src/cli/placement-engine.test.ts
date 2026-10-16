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
import {
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
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  classify,
  init,
  MANIFEST_PATH,
  normalizeForLedger,
  renderRulePaths,
  sha256,
  sync,
} from './index.ts'

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
    expect(read('.claude/rules/basalt-tokens.md')).toBe(shippedRule())
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
    expect(read('.claude/rules/basalt-tokens.md')).toBe(shippedRule())
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
    expect(read('.claude/rules/basalt-tokens.md')).toBe(shippedRule())
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

  it('replaces only the marked region on sync, preserving content before and after', () => {
    silenced(() => init(dir))
    // A stale region from an older basalt-ui, embedded in consumer-owned host content.
    write(
      'AGENTS.md',
      '# above\n\n<!-- basalt:begin 0.9.9 -->\nstale body\n<!-- basalt:end -->\n\n# below\n',
    )
    silenced(() => sync({ force: true }, dir))
    const after = read('AGENTS.md')
    expect(after.startsWith('# above\n')).toBe(true)
    expect(after.trimEnd().endsWith('# below')).toBe(true)
    expect(after).not.toContain('stale body')
    expect(after.match(/<!-- basalt:begin/g)?.length).toBe(1)
  })

  it('errors loudly on duplicate begin markers instead of silently picking one', () => {
    silenced(() => init(dir))
    const block = read('AGENTS.md')
    write('AGENTS.md', `${block}\n\n${block}`)
    expect(() => silenced(() => sync({}, dir))).toThrow(/duplicate/)
    expect(() => silenced(() => sync({ check: true }, dir))).toThrow(/duplicate/)
  })
})

function manifestFiles(): Record<string, string> {
  return (JSON.parse(read(MANIFEST_PATH)) as { files: Record<string, string> }).files
}

/**
 * An install as a pre-move basalt-ui left it: the block in CLAUDE.md (wrapped by `claudeMd`), no
 * AGENTS.md, and the ledger entry under the old `CLAUDE.md` key. Returns the pristine block.
 */
function legacyInstall(claudeMd: (block: string) => string = (block) => `${block}\n`): string {
  silenced(() => init(dir))
  const block = read('AGENTS.md').trimEnd()
  rmSync(join(dir, 'AGENTS.md'))
  write('CLAUDE.md', claudeMd(block))
  const manifest = JSON.parse(read(MANIFEST_PATH)) as { files: Record<string, string> }
  manifest.files['CLAUDE.md'] = manifest.files['AGENTS.md']!
  delete manifest.files['AGENTS.md']
  write(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  return block
}

describe('the managed block lives in AGENTS.md', () => {
  it('a fresh init writes the block into AGENTS.md and creates no CLAUDE.md', () => {
    silenced(() => init(dir))
    expect(read('AGENTS.md')).toContain('<!-- basalt:begin')
    expect(read('AGENTS.md')).toContain('<!-- basalt:end -->')
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)
    expect(Object.keys(manifestFiles())).toContain('AGENTS.md')
    expect(Object.keys(manifestFiles())).not.toContain('CLAUDE.md')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('a second sync is a byte-level no-op', () => {
    legacyInstall((block) => `# my app\n\n${block}\n`)
    silenced(() => sync({}, dir))
    const migrated = snapshotDir()
    expect(silenced(() => sync({}, dir))).toBe(0)
    expect(snapshotDir()).toEqual(migrated)
  })

  it('refreshes a pristine block from an older version without --force', () => {
    const older = legacyInstall().replace(/basalt:begin \S+/, 'basalt:begin 0.9.0')
    write('CLAUDE.md', `${older.replace('Framework-owned', 'Framework-owned (older wording)')}\n`)
    // The ledger recorded exactly what the older CLI wrote.
    const manifest = JSON.parse(read(MANIFEST_PATH)) as { files: Record<string, string> }
    manifest.files['CLAUDE.md'] = sha256(normalizeForLedger(read('CLAUDE.md').trim()))
    write(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

    const { log } = capture(() => sync({}, dir))
    expect(log).not.toContain('locally edited')
    expect(read('AGENTS.md')).not.toContain('older wording')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('a CLAUDE.md symlinked to AGENTS.md is one file: no-op, the block is not cut', () => {
    write('src/app.tsx', 'export {}\n') // a real app has src before init; its seeds must not create it
    silenced(() => init(dir))
    rmSync(join(dir, 'CLAUDE.md'), { force: true })
    symlinkSync('AGENTS.md', join(dir, 'CLAUDE.md'))
    const before = snapshotDir()
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
    expect(silenced(() => sync({}, dir))).toBe(0)
    expect(snapshotDir()).toEqual(before)
    expect(read('AGENTS.md')).toContain('<!-- basalt:begin')
  })

  it('leaves a CLAUDE.md without a block entirely alone', () => {
    silenced(() => init(dir))
    write('CLAUDE.md', '# mine\n')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
    silenced(() => sync({}, dir))
    expect(read('CLAUDE.md')).toBe('# mine\n')
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
})

describe('classify — the format-only branch', () => {
  const desired = '# rule\nbody\n'
  const formatted = '# rule  \n\n\nbody\n'

  it('treats a formatter-only difference as unchanged with no manifest entry', () => {
    expect(classify({ current: formatted, desired }, undefined)).toBe('unchanged')
  })

  it('treats it as unchanged even when the manifest entry is some other hash', () => {
    expect(classify({ current: formatted, desired }, sha256('older rendering'))).toBe('unchanged')
  })

  it('still reports a real content edit as drifted', () => {
    expect(classify({ current: '# rule\nedited\n', desired }, undefined)).toBe('drifted')
  })
})
