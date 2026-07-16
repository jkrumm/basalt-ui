/**
 * Locks down a bug class that has now shipped twice: a JSDoc `@example` (or any comment block)
 * referencing a `basalt-ui/…` import specifier that isn't actually a published subpath — a
 * phantom example a consumer would copy-paste and get a resolve error for. Scans every comment
 * block in `src/**​/*.{ts,tsx}` for `from 'basalt-ui…'` specifiers and asserts each one maps to a
 * real `package.json` `exports` key.
 *
 * Run: bun test packages/basalt-ui/tests/jsdoc-specifiers.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const pkgRoot = join(import.meta.dir, '..')
const srcRoot = join(pkgRoot, 'src')

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
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
  }
  return Object.keys(pkg.exports ?? {})
}

describe('jsdoc-specifiers', () => {
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
        violations.push({ file: file.slice(pkgRoot.length + 1), specifier })
      }
    }
  }

  it('every basalt-ui import specifier mentioned in a comment is a real published subpath', () => {
    expect(violations).toEqual([])
  })
})
