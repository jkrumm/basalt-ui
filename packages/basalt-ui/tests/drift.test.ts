/**
 * Doc-drift meta-tests, merged into one file (C2 consolidation) — each `describe` below is a
 * former standalone test file (`agents-sync`, `llms-sync`, `gen-llms-check`, `jsdoc-specifiers`,
 * `lefthook-preset`), moved here verbatim with its own assertions unchanged. One place for "does
 * a committed doc/config still match its generator or its SSOT", rather than five.
 *
 * Run: bun test packages/basalt-ui/tests/drift.test.ts
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'bun:test'

import { generateLlmsTxt, outPath } from '../scripts/gen-llms'
import { SURFACES } from '../src/surfaces'
import type { SurfaceSpec } from '../src/surfaces'

const PKG_ROOT = join(import.meta.dir, '..')

// ── agents-sync — AGENTS.md "Subpath ownership" table must match the SURFACES SSOT ───────────────

describe('agents-sync', () => {
  const AGENTS_PATH = join(PKG_ROOT, 'AGENTS.md')

  type Row = { subpath: string; layer: string; purpose: string }

  function parseSubpathTable(md: string): Row[] {
    const lines = md.split('\n')
    const start = lines.findIndex((l) => l.startsWith('## Subpath ownership'))
    if (start === -1) throw new Error('AGENTS.md: missing "## Subpath ownership" section')

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

// ── llms-sync — committed llms.txt matches gen-llms.ts output ────────────────────────────────────

describe('llms-sync', () => {
  it('committed llms.txt matches gen-llms.ts output', () => {
    const committed = readFileSync(outPath, 'utf8')
    const generated = generateLlmsTxt()
    expect(generated).toBe(committed)
  })
})

// ── gen-llms --check drift gate — exercises the --check flag itself, not just the diff ───────────

describe('gen-llms --check drift gate', () => {
  const SCRIPT_PATH = join(PKG_ROOT, 'scripts/gen-llms.ts')

  it('exits 0 when the committed llms.txt is in sync', () => {
    const result = Bun.spawnSync(['bun', SCRIPT_PATH, '--check'])
    expect(result.exitCode).toBe(0)
  })

  it('exits non-zero and reports drift when llms.txt is mutated, then restores byte-exact', () => {
    const original = readFileSync(outPath, 'utf8')
    try {
      writeFileSync(outPath, `${original}\nSTALE DRIFT MARKER\n`, 'utf8')

      const result = Bun.spawnSync(['bun', SCRIPT_PATH, '--check'])
      const stderr = result.stderr.toString()

      expect(result.exitCode).not.toBe(0)
      expect(stderr).toContain('out of sync')
    } finally {
      writeFileSync(outPath, original, 'utf8')
    }

    // Restoration must be byte-exact — re-run --check against the restored file to prove it.
    expect(readFileSync(outPath, 'utf8')).toBe(original)
    const restoredCheck = Bun.spawnSync(['bun', SCRIPT_PATH, '--check'])
    expect(restoredCheck.exitCode).toBe(0)
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
    return [...glob.scanSync({ cwd: srcRoot })].map((rel) => join(srcRoot, rel))
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

  it('runs check-theme on EVERY commit — it scans basalt.roots, not the staged files', () => {
    // A glob would gate the guard on which extensions a commit happens to touch. It reads none of
    // them, so the only correct answer is "no glob".
    expect(globOf('check-theme')).toBeUndefined()
  })

  it('runs check-theme through an overridable BASALT_BIN, never a bare bunx fetch', () => {
    // `run:` is the one thing a consumer CANNOT override (an extends target wins on a colliding
    // key), so the seam has to be inside the command: `env:` merges, and the default refuses to
    // silently install a second copy of basalt from npm.
    expect(preset).toContain('run: ${BASALT_BIN:-bunx --no-install basalt-ui} check-theme')
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

// ── sync-self — this repo's /.claude/rules byte-match the shipped agent/rules ─────────────────────

describe('sync-self', () => {
  const REPO_ROOT = join(PKG_ROOT, '..', '..')
  const RULES_SRC = join(PKG_ROOT, 'agent/rules')
  const RULES_DEST = join(REPO_ROOT, '.claude/rules')

  // `make sync-self` (`scripts/sync-self.ts`) is a PLAIN copy, not `basalt-ui sync`'s three-way
  // reconciliation — this repo is not a consumer of itself, so a stale `/.claude/rules/basalt-*.md`
  // has one honest fix (re-run `make sync-self`), never a "locally edited, keep it" branch.
  it('every shipped rule has a byte-identical copy in /.claude/rules', () => {
    const names = readdirSync(RULES_SRC).filter((name) => name.endsWith('.md'))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const shipped = readFileSync(join(RULES_SRC, name), 'utf8')
      const installed = readFileSync(join(RULES_DEST, name), 'utf8')
      expect([name, installed]).toEqual([name, shipped])
    }
  })
})
