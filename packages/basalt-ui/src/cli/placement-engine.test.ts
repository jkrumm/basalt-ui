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
 *  - the managed block lives in AGENTS.md and is migrated out of a legacy CLAUDE.md (block-only
 *    file deleted, consumer prose kept, hand-edits preserved, idempotent)
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

import { init, MANIFEST_PATH, normalizeForLedger, sha256, sync } from './index.ts'

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

  it('migrates a block-only CLAUDE.md: the file is deleted, the block lands in AGENTS.md, --check goes red then green', () => {
    legacyInstall()
    const before = snapshotDir()
    expect(silenced(() => sync({ check: true }, dir))).toBe(1)
    expect(snapshotDir()).toEqual(before)

    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    expect(log).toContain('moved the basalt block from CLAUDE.md to AGENTS.md')
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)
    expect(read('AGENTS.md').match(/<!-- basalt:begin/g)?.length).toBe(1)
    expect(Object.keys(manifestFiles())).toContain('AGENTS.md')
    expect(Object.keys(manifestFiles())).not.toContain('CLAUDE.md')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('deletes a CLAUDE.md that is only the block plus an `@AGENTS.md` import', () => {
    legacyInstall((block) => `@AGENTS.md\n\n${block}\n`)
    silenced(() => sync({}, dir))
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)
    expect(read('AGENTS.md')).toContain('<!-- basalt:begin')
  })

  it('keeps the consumer prose when CLAUDE.md has more than the block', () => {
    legacyInstall(
      (block) => `# my app\n\nMy own instructions.\n\n${block}\n\n## Below\n\nMore of mine.\n`,
    )
    silenced(() => sync({}, dir))
    const claude = read('CLAUDE.md')
    expect(claude).toBe('# my app\n\nMy own instructions.\n\n## Below\n\nMore of mine.\n')
    expect(claude).not.toContain('basalt:')
    expect(read('AGENTS.md')).toContain('<!-- basalt:begin')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('splices into an existing AGENTS.md without touching its content', () => {
    legacyInstall()
    write('AGENTS.md', '# agents\n\nMine.\n')
    silenced(() => sync({}, dir))
    expect(read('AGENTS.md').startsWith('# agents\n\nMine.\n')).toBe(true)
    expect(read('AGENTS.md')).toContain('<!-- basalt:begin')
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)
  })

  it('a second sync after the migration is a byte-level no-op', () => {
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

  it('preserves a hand-edited legacy block like any drifted unit: skipped and reported, --force restores', () => {
    const pristine = legacyInstall()
    const edited = pristine.replace('React 19', 'React 18 (pinned by our team)')
    expect(edited).not.toBe(pristine)
    write('CLAUDE.md', `${edited}\n`)

    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    expect(log).toContain('locally edited')
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)
    expect(read('AGENTS.md')).toContain('React 18 (pinned by our team)')
    expect(silenced(() => sync({ check: true }, dir))).toBe(1)

    silenced(() => sync({ force: true }, dir))
    expect(read('AGENTS.md')).toContain('React 19')
    expect(read('AGENTS.md')).not.toContain('pinned by our team')
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('drops a legacy CLAUDE.md block that equals the AGENTS.md one (normalized: version token only differs)', () => {
    legacyInstall((block) => `# mine\n\n${block}\n`)
    silenced(() => init(dir)) // writes the block into AGENTS.md (and migrates)
    const agents = read('AGENTS.md')
    const block = agents.slice(
      agents.indexOf('<!-- basalt:begin'),
      agents.indexOf('<!-- basalt:end -->') + 19,
    )
    write('CLAUDE.md', `# mine\n\n${block.replace(/basalt:begin \S+/, 'basalt:begin 0.1.0')}\n`)
    expect(silenced(() => sync({ check: true }, dir))).toBe(1)
    silenced(() => sync({}, dir))
    expect(read('CLAUDE.md')).toBe('# mine\n')
    expect(read('AGENTS.md')).toBe(agents)
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('a CLAUDE.md symlinked to AGENTS.md is one file: no-op, the block is not cut', () => {
    silenced(() => init(dir))
    rmSync(join(dir, 'CLAUDE.md'), { force: true })
    symlinkSync('AGENTS.md', join(dir, 'CLAUDE.md'))
    const before = snapshotDir()
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
    expect(silenced(() => sync({}, dir))).toBe(0)
    expect(snapshotDir()).toEqual(before)
    expect(read('AGENTS.md')).toContain('<!-- basalt:begin')
  })

  it('a stale CLAUDE.md manifest key with CLAUDE.md already deleted reconciles without throwing', () => {
    silenced(() => init(dir))
    const manifest = JSON.parse(read(MANIFEST_PATH)) as { files: Record<string, string> }
    manifest.files['CLAUDE.md'] = manifest.files['AGENTS.md']!
    delete manifest.files['AGENTS.md']
    write(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
    expect(silenced(() => sync({}, dir))).toBe(0)
    expect(Object.keys(manifestFiles())).toContain('AGENTS.md')
    expect(Object.keys(manifestFiles())).not.toContain('CLAUDE.md')
  })

  describe.each([
    ['duplicate begin markers', (b: string) => `${b}\n\n${b}\n`, /duplicate/],
    [
      'an unterminated block',
      (b: string) => `${b.replace('<!-- basalt:end -->', '')}\n`,
      /no matching/,
    ],
  ])('%s in CLAUDE.md', (_name, wrap, problem) => {
    it('fails loudly in sync and sync --check, naming the file; both files stay byte-identical', () => {
      legacyInstall(wrap)
      write('AGENTS.md', '# agents\n')
      const before = snapshotDir()
      for (const opts of [{}, { check: true }]) {
        const { code, log } = capture(() => sync(opts, dir))
        expect(code).toBe(1)
        expect(log).toContain('CLAUDE.md:')
        expect(log).toMatch(problem)
      }
      expect(capture(() => init(dir)).code).toBe(1)
      expect(snapshotDir()).toEqual(before)
    })
  })

  it('differing blocks in CLAUDE.md and AGENTS.md are a conflict: reported, nothing discarded, --check red', () => {
    const pristine = legacyInstall((block) => `# mine\n\n${block}\n`)
    write('AGENTS.md', `# agents\n\n${pristine.replace('React 19', 'React 18 (pinned)')}\n`)
    const before = snapshotDir()
    for (const opts of [{}, { check: true }]) {
      const { code, log } = capture(() => sync(opts, dir))
      expect(code).toBe(1)
      expect(log).toContain('each carry a basalt block and they differ')
    }
    expect(snapshotDir()).toEqual(before)
  })

  it('init migrates a legacy install the same way', () => {
    legacyInstall((block) => `# mine\n\n${block}\n`)
    silenced(() => init(dir))
    expect(read('CLAUDE.md')).toBe('# mine\n')
    expect(read('AGENTS.md').match(/<!-- basalt:begin/g)?.length).toBe(1)
    expect(Object.keys(manifestFiles())).not.toContain('CLAUDE.md')
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
