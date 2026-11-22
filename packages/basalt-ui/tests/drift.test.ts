/**
 * Doc-drift meta-tests, merged into one file (C2 consolidation) — each `describe` below is a
 * former standalone test file (`agents-sync`, `llms-sync`, `gen-llms-check`, `jsdoc-specifiers`,
 * `lefthook-preset`), moved here verbatim with its own assertions unchanged, plus
 * `release-migrating` which was written into it. One place for "does
 * a committed doc/config still match its generator or its SSOT", rather than five.
 *
 * Run: bun test packages/basalt-ui/tests/drift.test.ts
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'bun:test'

import { drift } from '../scripts/sync-self'
import { SURFACES } from '../src/surfaces'
import type { SurfaceSpec } from '../src/surfaces'

const PKG_ROOT = join(import.meta.dir, '..')

// ── agents-sync — docs/agents/subpaths.md "Subpath ownership" table must match the SURFACES SSOT ───────────────

describe('agents-sync', () => {
  const AGENTS_PATH = join(PKG_ROOT, '../../docs/agents/subpaths.md')

  type Row = { subpath: string; layer: string; purpose: string }

  function parseSubpathTable(md: string): Row[] {
    const lines = md.split('\n')
    const start = lines.findIndex((l) => l.startsWith('## Subpath ownership'))
    if (start === -1)
      throw new Error('docs/agents/subpaths.md: missing "## Subpath ownership" section')

    const rows: Row[] = []
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (line.startsWith('## ')) break
      if (!line.trimStart().startsWith('|')) continue
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
      if (cells.length !== 3) continue
      const [subpath, layer, purpose] = cells
      if (subpath === undefined || layer === undefined || purpose === undefined) continue
      if (subpath === 'Subpath') continue // header row
      if (/^-+$/.test(subpath)) continue // separator row
      rows.push({ subpath: subpath.replace(/`/g, ''), layer, purpose })
    }
    return rows
  }

  function expectedRows(): Row[] {
    const out: Row[] = []
    for (const [key, spec] of Object.entries(SURFACES) as [string, SurfaceSpec][]) {
      if (key.startsWith('#')) continue
      if (spec.layer === 'non-js-asset') continue
      const subpath = key === '.' ? 'basalt-ui' : `basalt-ui${key.slice(1)}`
      out.push({ subpath, layer: spec.layer, purpose: spec.description ?? subpath })
    }
    return out
  }

  const parsed = parseSubpathTable(readFileSync(AGENTS_PATH, 'utf8'))
  const expected = expectedRows()

  it('lists exactly the JS subpaths from SURFACES (no missing, no extra)', () => {
    expect(parsed.map((r) => r.subpath).toSorted()).toEqual(
      expected.map((r) => r.subpath).toSorted(),
    )
  })

  it('matches the SURFACES layer + description for every subpath', () => {
    const byPath = new Map(parsed.map((r) => [r.subpath, r]))
    for (const e of expected) {
      const row = byPath.get(e.subpath)
      expect(row).toBeDefined()
      expect(row?.layer).toBe(e.layer)
      expect(row?.purpose).toBe(e.purpose)
    }
  })
})

// ── jsdoc-specifiers — every basalt-ui import specifier mentioned in a comment is real ────────────

describe('jsdoc-specifiers', () => {
  const srcRoot = join(PKG_ROOT, 'src')

  const SPECIFIER_RE = /from\s+'(basalt-ui[^']*)'/g
  const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g
  const LINE_COMMENT_RE = /\/\/.*$/gm

  function extractCommentText(source: string): string {
    const blocks = source.match(BLOCK_COMMENT_RE) ?? []
    const lines = source.match(LINE_COMMENT_RE) ?? []
    return [...blocks, ...lines].join('\n')
  }

  /** Maps a bare-package or subpath specifier to the key it must appear under in `exports`. */
  function toExportsKey(specifier: string): string {
    if (specifier === 'basalt-ui') return '.'
    return `.${specifier.slice('basalt-ui'.length)}`
  }

  /** True if `key` resolves via a literal exports entry or a wildcard entry (e.g. `./configs/*`). */
  function isPublished(key: string, exportKeys: readonly string[]): boolean {
    if (exportKeys.includes(key)) return true
    return exportKeys.some((exportKey) => {
      if (!exportKey.endsWith('/*')) return false
      const prefix = exportKey.slice(0, -1) // keep trailing '/'
      return key.startsWith(prefix)
    })
  }

  function findSourceFiles(): string[] {
    const glob = new Bun.Glob('**/*.{ts,tsx}')
    // Tests are not shipped JSDoc, and some name dropped subpaths on purpose (doctor's fixtures).
    return [...glob.scanSync({ cwd: srcRoot })]
      .filter((rel) => !/\.test\.tsx?$/.test(rel))
      .map((rel) => join(srcRoot, rel))
  }

  function packageExportKeys(): string[] {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      exports?: Record<string, unknown>
    }
    return Object.keys(pkg.exports ?? {})
  }

  const exportKeys = packageExportKeys()
  const files = findSourceFiles()

  // Sanity check: this walk must actually find files, or every downstream assertion is vacuous.
  it('found source files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const violations: { file: string; specifier: string }[] = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const commentText = extractCommentText(source)
    for (const match of commentText.matchAll(SPECIFIER_RE)) {
      const specifier = match[1]
      if (specifier === undefined) continue
      const key = toExportsKey(specifier)
      if (!isPublished(key, exportKeys)) {
        violations.push({ file: file.slice(PKG_ROOT.length + 1), specifier })
      }
    }
  }

  it('every basalt-ui import specifier mentioned in a comment is a real published subpath', () => {
    expect(violations).toEqual([])
  })
})

// ── shipped lefthook preset — the reach of the consumer's pre-commit gate ─────────────────────────

describe('shipped lefthook preset', () => {
  const preset = readFileSync(join(PKG_ROOT, 'configs', 'lefthook.yml'), 'utf8')

  /** The `glob:` line belonging to a named command, or `undefined` when it declares none. */
  function globOf(command: string): string | undefined {
    const block = new RegExp(`^ {4}${command}:\\n((?: {6}.*\\n|\\n)*)`, 'm').exec(preset)?.[1]
    expect(block).toBeDefined()
    return /^ {6}glob: '(.+)'$/m.exec(block ?? '')?.[1]
  }

  /** Extensions inside a `*.{a,b,c}` glob. */
  function extensionsOf(command: string): string[] {
    const glob = globOf(command)
    expect(glob).toBeDefined()
    return (/\{(.+)\}/.exec(glob ?? '')?.[1] ?? '').split(',')
  }

  const dir = mkdtempSync(resolve(tmpdir(), 'basalt-lefthook-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  /**
   * Deliberately unformatted probe content, PER LANGUAGE. One shared JS-shaped literal does not
   * work: `const  a  =  1` is already canonical YAML (a plain scalar), so oxfmt reports no diff for
   * probe.yml, `oxfmtHandles('yml')` answers false, and the coverage assertion below is skipped for
   * a type oxfmt genuinely formats — the silent under-coverage this file exists to catch.
   */
  const PROBES: Record<string, string> = {
    ts: 'const  a  =  1\n',
    tsx: 'const  a  =  1\n',
    js: 'const  a  =  1\n',
    jsx: 'const  a  =  1\n',
    css: '.a {\n  color: red   ;\n}\n',
    json: '{"a":   1,  "b": 2}\n',
    md: '#  Title\n\n\n\ntext\n',
    yml: 'a:      1\nb:\n    - x\n',
    yaml: 'a:      1\nb:\n    - x\n',
  }

  /**
   * Which of the PROBES extensions oxfmt actually handles, decided by ONE `oxfmt --check` invocation
   * over all probe files rather than one spawn per extension — spawning `bunx oxfmt` nine times sat
   * on the boundary of Bun's 5000ms default test timeout by construction and flaked the gate. A
   * single invocation still proves the same thing per extension (a handled file reports a diff and
   * carries its own filename in the output; an unhandled one is silently skipped), so batching does
   * not weaken the assertion.
   */
  function oxfmtHandledExtensions(): Set<string> {
    const files = Object.entries(PROBES).map(([extension, content]) => {
      const file = join(dir, `probe.${extension}`)
      writeFileSync(file, content)
      return file
    })
    const out = Bun.spawnSync(['bunx', 'oxfmt', '--check', ...files], { cwd: dir })
    const output = `${out.stdout}${out.stderr}`
    return new Set(Object.keys(PROBES).filter((extension) => output.includes(`probe.${extension}`)))
  }

  /** Extensions the preset formats. Everything else oxfmt handles is deliberately the consumer's. */
  const SOURCE_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'css']

  it('spells the monorepo recipe out, because `extends` does not carry a working directory', () => {
    expect(preset).toContain('MONOREPO RECIPE')
    for (const command of ['oxlint', 'oxfmt']) {
      expect(preset).toContain(`${command}: { root: 'apps/web/' }`)
    }
  })

  it('carries no command of the retired 2.x theme guard', () => {
    expect(preset).not.toContain('check-theme')
  })

  it('formats every SOURCE file type oxfmt handles, and nothing else', () => {
    const covered = extensionsOf('oxfmt')
    expect(covered).toContain('css')
    const handled = oxfmtHandledExtensions()
    for (const extension of SOURCE_EXTENSIONS) {
      if (handled.has(extension)) expect(covered).toContain(extension)
    }
    // The other half of the contract: a document type oxfmt handles is still NOT the preset's
    // business, because the consumer cannot narrow this glob when it disagrees with their house
    // style. Regressing this re-breaks every repo whose markdown basalt does not own.
    for (const extension of Object.keys(PROBES)) {
      if (!SOURCE_EXTENSIONS.includes(extension)) expect(covered).not.toContain(extension)
    }
  })

  it('does not fail a commit whose staged files are all ignored', () => {
    // oxfmt exits 2 on "Expected at least one target file. All matched files may have been
    // excluded by ignore rules" — a docs-only commit in any repo carrying a .prettierignore.
    expect(preset).toContain('--no-error-on-unmatched-pattern')
  })

  it('keeps oxlint on JS only — it has nothing to say about CSS', () => {
    expect(extensionsOf('oxlint')).toEqual(['ts', 'tsx', 'js', 'jsx'])
  })
})

// ── sync-self — this repo's /.claude/ links every shipped rule, skill and agent ───────────────────

describe('sync-self', () => {
  // `make sync-self` (`scripts/sync-self.ts`) links each entry to its shipped source, so the dogfood copy IS the
  // shipped text: a regular file there (a copy that can go stale), a link elsewhere or a missing link fails, and so
  // does an orphan, a `basalt-*` entry with no shipped source (a retired doctrine still read as live). A
  // `basalt-v3-` name is a sibling install's placement (apps/marketing's sync), owned by that install's ledger and
  // gitignored here, so it is no orphan of this repo's own sync.
  it('every shipped rule, skill and subagent is linked into /.claude, and nothing else is (make sync-self)', () => {
    expect(drift()).toEqual([])
  })

  it('each link reads the shipped bytes', () => {
    const REPO_ROOT = join(PKG_ROOT, '..', '..')
    const pairs = [
      ['agent/rules', '.claude/rules'],
      ['agent/reviewer', '.claude/agents'],
    ] as const
    let read = 0
    for (const [src, dest] of pairs)
      for (const name of readdirSync(join(PKG_ROOT, src)).filter(
        (n) => n.startsWith('basalt-') && n.endsWith('.md'),
      )) {
        expect([name, readFileSync(join(REPO_ROOT, dest, name), 'utf8')]).toEqual([
          name,
          readFileSync(join(PKG_ROOT, src, name), 'utf8'),
        ])
        read++
      }
    for (const skill of readdirSync(join(PKG_ROOT, 'agent/skills'))) {
      const installed = join(REPO_ROOT, '.claude/skills', skill, 'SKILL.md')
      expect([skill, existsSync(installed)]).toEqual([skill, true])
      read++
    }
    expect(read).toBeGreaterThan(5)
  })
})
