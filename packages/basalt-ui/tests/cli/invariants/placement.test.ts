/**
 * Placement invariants 12-16 (docs/v3/concepts/skills-agent-layer.md section 6, "Placement").
 * Dropped on purpose and not pinned here: 9 three-way prune, 10 normalised hash, 11 template format
 * idempotency. Every test installs through the v3 shape, `init --profile <p> --no-install`.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanupRepos, cli, filesUnder, makeRepo, PKG_ROOT, read, write } from './support'

afterEach(cleanupRepos)

const BEGIN = '<!-- basalt:begin'
const END = '<!-- basalt:end -->'

async function installed(files: Record<string, string> = {}): Promise<string> {
  const dir = makeRepo(files)
  const { code } = await cli(['init', '--no-install', '--profile', 'app'], dir)
  expect(code).toBe(0)
  return dir
}

describe('placement', () => {
  // flips in: v3-sk-2-sync (block splice on the v3 render)
  it.failing(
    'inv 12: the block splices into AGENTS.md: absent appends, duplicate markers are an error',
    async () => {
      const dir = makeRepo({ 'AGENTS.md': '# host\n\nkeep me\n' })
      await cli(['init', '--no-install', '--profile', 'app'], dir)
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
    },
  )

  // flips in: v3-sk-2-sync (the block lives in AGENTS.md only)
  it.failing(
    'inv 13: the block goes to AGENTS.md, never CLAUDE.md, and a bare CLAUDE.md is left alone',
    async () => {
      const dir = await installed({ 'CLAUDE.md': '# mine\n' })
      expect(read(dir, 'AGENTS.md')).toContain(BEGIN)
      expect(read(dir, 'AGENTS.md')).toContain(END)
      expect(read(dir, 'CLAUDE.md')).toBe('# mine\n')
      await cli(['sync'], dir)
      expect(read(dir, 'CLAUDE.md')).toBe('# mine\n')
    },
  )

  // flips in: v3-sk-2-sync (placement at the git/workspace root, row 135)
  it.failing(
    'inv 14: skills and rules land at the git root, not the app dir, and the block names them',
    async () => {
      const dir = makeRepo({ 'apps/web/package.json': JSON.stringify({ name: 'web' }) })
      const app = join(dir, 'apps/web')
      const { code } = await cli(['init', '--no-install', '--profile', 'app'], app)
      expect(code).toBe(0)
      expect(existsSync(join(dir, '.claude/skills/basalt-design/SKILL.md'))).toBe(true)
      expect(existsSync(join(dir, '.claude/rules'))).toBe(true)
      expect(existsSync(join(app, '.claude'))).toBe(false)
      const block = read(dir, 'AGENTS.md')
      expect(block).toContain('.claude/skills/basalt-design')
      expect(block).toContain('.claude/rules')
    },
  )

  // flips in: v3-sk-2-sync (`paths:` rendered from the declared roots)
  it.failing(
    'inv 15: rule `paths:` come from the declared roots, and a changed root shows as drift',
    async () => {
      const dir = makeRepo({
        'package.json': JSON.stringify({
          name: 'fixture',
          devDependencies: { 'basalt-ui': '^3.0.0' },
          basalt: { roots: ['apps/web/src'] },
        }),
      })
      await cli(['init', '--no-install', '--profile', 'app'], dir)
      const rules = filesUnder(join(dir, '.claude/rules')).map((f) => readFileSync(f, 'utf8'))
      const scoped = rules.filter((r) => /^paths:/m.test(r))
      expect(scoped.length).toBeGreaterThan(0)
      for (const rule of scoped) expect(rule).toContain('apps/web/src')

      write(
        dir,
        'package.json',
        JSON.stringify({
          name: 'fixture',
          devDependencies: { 'basalt-ui': '^3.0.0' },
          basalt: { roots: ['src'] },
        }),
      )
      expect((await cli(['sync', '--check'], dir)).code).toBe(1)
    },
  )

  // flips in: v3-sk-2-sync (the shipped tree is the v3 tree and every file of it ships)
  it.failing(
    'inv 16: tarball parity: every file the CLI places exists and is covered by `files`',
    () => {
      const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
        files: string[]
        bin: Record<string, string>
      }
      const covered = (path: string): boolean =>
        pkg.files.some(
          (entry) => path === entry || path.startsWith(entry.endsWith('/') ? entry : `${entry}/`),
        )
      const placed = [
        ...['basalt-tokens', 'basalt-ui', 'basalt-page', 'basalt-state', 'basalt-charts'].map(
          (n) => `agent/rules/${n}.md`,
        ),
        'agent/skills/basalt-design/SKILL.md',
        'agent/skills/basalt-app/SKILL.md',
        'agent/reviewer/rubric.md',
        'agent/reviewer/basalt-design-reviewer.md',
        ...Object.values(pkg.bin).map((p) => p.replace(/^\.\//, '')),
      ]
      for (const path of placed) {
        expect(existsSync(join(PKG_ROOT, path))).toBe(true)
        expect(covered(path)).toBe(true)
      }
    },
  )
})
