/**
 * Placement invariants 12-16 (docs/v3/concepts/skills-agent-layer.md section 6, "Placement").
 * Dropped on purpose and not pinned here: 9 three-way prune, 10 normalised hash, 11 template format
 * idempotency. `sync` never creates an install, so each test starts from a repo whose
 * `.basalt/manifest.json` is already declared (what `init --profile` writes, owned by v3-sk-3).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanupRepos, cli, filesUnder, makeRepo, PKG_ROOT, read, write } from './support'

afterEach(cleanupRepos)

const BEGIN = '<!-- basalt:begin'
const END = '<!-- basalt:end -->'

const manifest = (roots: Record<string, string> = { src: 'app' }): string =>
  JSON.stringify({ profile: 'app', version: '3.0.0', roots, managed: {} })

/** A repo with a declared install, the way `init --profile app` leaves it. */
function installed(files: Record<string, string> = {}, roots?: Record<string, string>): string {
  return makeRepo({ '.basalt/manifest.json': manifest(roots), ...files })
}

describe('placement', () => {
  it('inv 12: the block splices into AGENTS.md: absent appends, duplicate markers are an error', async () => {
    const dir = installed({ 'AGENTS.md': '# host\n\nkeep me\n' })
    expect((await cli(['sync'], dir)).code).toBe(0)
    const first = read(dir, 'AGENTS.md')
    expect(first.startsWith('# host\n\nkeep me\n')).toBe(true)
    expect(first.split(BEGIN)).toHaveLength(2)

    const again = await cli(['sync'], dir)
    expect(again.code).toBe(0)
    expect(read(dir, 'AGENTS.md')).toBe(first)

    write(dir, 'AGENTS.md', `${first}\n${first.slice(first.indexOf(BEGIN))}`)
    for (const argv of [['sync'], ['sync', '--check']]) {
      const { code, log } = await cli(argv, dir)
      expect(code).toBe(1)
      expect(log).toMatch(/duplicate/i)
    }
  })

  it('inv 13: the block goes to AGENTS.md, never CLAUDE.md, and a bare CLAUDE.md is left alone', async () => {
    const dir = installed({ 'CLAUDE.md': '# mine\n' })
    await cli(['sync'], dir)
    expect(read(dir, 'AGENTS.md')).toContain(BEGIN)
    expect(read(dir, 'AGENTS.md')).toContain(END)
    expect(read(dir, 'CLAUDE.md')).toBe('# mine\n')
    await cli(['sync'], dir)
    expect(read(dir, 'CLAUDE.md')).toBe('# mine\n')
  })

  it('inv 14: skills and rules land at the install (git) root, not the app dir', async () => {
    const dir = installed(
      { 'apps/web/package.json': JSON.stringify({ name: 'web' }) },
      { 'apps/web/src': 'app' },
    )
    const app = join(dir, 'apps/web')
    const { code } = await cli(['sync'], app)
    expect(code).toBe(0)
    expect(existsSync(join(dir, '.claude/skills/basalt-design/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, '.claude/rules'))).toBe(true)
    expect(existsSync(join(app, '.claude'))).toBe(false)
    expect(existsSync(join(app, 'AGENTS.md'))).toBe(false)
    expect(read(dir, 'AGENTS.md')).toContain(BEGIN)
  })

  // flips in: v3-sk-5-rules (the v3 AGENTS block template names where skills and rules live)
  it.failing('inv 14b: the block names the skills and rules it points at', async () => {
    const dir = installed()
    await cli(['sync'], dir)
    const block = read(dir, 'AGENTS.md')
    expect(block).toContain('.claude/skills/basalt-design')
    expect(block).toContain('.claude/rules')
  })

  it('inv 15: rule `paths:` come from the declared roots, and a changed root shows as drift', async () => {
    const dir = installed({}, { 'apps/web/src': 'app' })
    await cli(['sync'], dir)
    const rules = filesUnder(join(dir, '.claude/rules')).map((f) => readFileSync(f, 'utf8'))
    const scoped = rules.filter((r) => /^paths:/m.test(r))
    expect(scoped.length).toBeGreaterThan(0)
    for (const rule of scoped) expect(rule).toContain('apps/web/src')
    expect((await cli(['sync', '--check'], dir)).code).toBe(0)

    write(dir, '.basalt/manifest.json', manifest({ src: 'app' }))
    expect((await cli(['sync', '--check'], dir)).code).toBe(1)
  })

  it('inv 16: tarball parity: every source the engine places is shipped and covered by `files`', async () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      files: string[]
      bin: Record<string, string>
    }
    const covered = (path: string): boolean =>
      pkg.files.some(
        (entry) => path === entry || path.startsWith(entry.endsWith('/') ? entry : `${entry}/`),
      )
    const dir = installed()
    await cli(['sync'], dir)
    const placed = filesUnder(join(dir, '.claude')).length
    expect(placed).toBeGreaterThan(0)
    const sources = [
      'agent/rules',
      'agent/skills',
      'agent/agents',
      'agent/templates/AGENTS-block.md.tpl',
      ...Object.values(pkg.bin).map((p) => p.replace(/^\.\//, '')),
    ]
    for (const path of sources) {
      expect(existsSync(join(PKG_ROOT, path))).toBe(true)
      expect(covered(path)).toBe(true)
    }
  })

  // flips in: v3-sk-5-rules (the shipped tree is the v3 tree and every file of it ships)
  it.failing('inv 16b: the v3 tree ships: five rules, two skills, the reviewer pair', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      files: string[]
    }
    const covered = (path: string): boolean =>
      pkg.files.some(
        (entry) => path === entry || path.startsWith(entry.endsWith('/') ? entry : `${entry}/`),
      )
    const v3 = [
      ...['basalt-tokens', 'basalt-ui', 'basalt-page', 'basalt-state', 'basalt-charts'].map(
        (n) => `agent/rules/${n}.md`,
      ),
      'agent/skills/basalt-design/SKILL.md',
      'agent/skills/basalt-app/SKILL.md',
      'agent/reviewer/rubric.md',
      'agent/reviewer/basalt-design-reviewer.md',
    ]
    for (const path of v3) {
      expect(existsSync(join(PKG_ROOT, path))).toBe(true)
      expect(covered(path)).toBe(true)
    }
  })
})
