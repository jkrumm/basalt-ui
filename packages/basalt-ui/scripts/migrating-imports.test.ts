/**
 * Every import MIGRATING.md and the raw-breakpoint guard messages TELL a consumer to write must
 * resolve against the published subpath it names.
 *
 * 1.31.0 and 1.32.0 documented `CONTAINER_CLASSES` / `SIZE_CLASSES` as `basalt-ui/tokens` exports
 * while the barrel only imported them, and six consumers hand-mirrored the table instead (consumer
 * loop r2, B1). The export-surface snapshot could not catch it — it pins what IS exported, not what
 * the docs promise — so this test reads the promises:
 *
 * - every `import { … } from 'basalt-ui[/sub]'` in a fenced ts/tsx block (including one written in
 *   a code comment);
 * - every prose claim of the form `` `Symbol[.member]` (`basalt-ui/sub` `` and every
 *   `SYMBOL, basalt-ui/sub` recipe in `configs/oxlint-plugin.js` / `src/guard/index.ts`.
 *
 * Resolution goes through the TypeScript checker over the src barrels each `package.json#exports`
 * `types` path mirrors (dist/X.d.ts ⇄ src/X.ts[x]) — no build needed, and type-only exports count.
 *
 * Cut-off: prose claims are checked from `## 1.30.0` up (Unreleased and the surface table
 * included), and never in a table row's FIRST cell — the "was" column of a removal/rename table.
 * Older sections are removal lists (1.28.0's `field`, 1.29.0's `createMultiSearchParamStore`, …):
 * they name the API of THEIR release, which is what a migration note is for. A new removal bullet
 * says "`X` — removed from `basalt-ui/sub`" rather than "`X` (`basalt-ui/sub`)". Fenced imports are
 * checked in every section: a code sample has no such excuse.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const PKG = join(import.meta.dir, '..')
const OLDEST_CHECKED_PROSE_SECTION = '## 1.30.0'

type Claim = { symbol: string; subpath: string; where: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function subpathEntries(): Map<string, string> {
  const pkg: unknown = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))
  const exportsMap = isRecord(pkg) ? pkg.exports : undefined
  if (!isRecord(exportsMap)) throw new Error('package.json#exports is missing or not an object')
  const entries = new Map<string, string>()
  for (const [key, value] of Object.entries(exportsMap)) {
    if (typeof value === 'string') continue
    if (!isRecord(value))
      throw new Error(`package.json#exports["${key}"] is neither a string nor an object`)
    if (value.types === undefined) continue
    if (typeof value.types !== 'string')
      throw new Error(`package.json#exports["${key}"].types is not a string`)
    const stem = value.types.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, '')
    const file = [`${stem}.ts`, `${stem}.tsx`].map((f) => join(PKG, f)).find((f) => existsSync(f))
    if (!file) throw new Error(`no src entry for ${key} (${value.types})`)
    entries.set(key === '.' ? 'basalt-ui' : `basalt-ui/${key.slice(2)}`, file)
  }
  return entries
}

function exportedNames(entries: Map<string, string>): Map<string, Set<string>> {
  const config = ts.getParsedCommandLineOfConfigFile(
    join(PKG, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      },
    },
  )
  if (!config) throw new Error('tsconfig.json did not parse')
  const program = ts.createProgram([...entries.values()], config.options)
  const checker = program.getTypeChecker()
  const names = new Map<string, Set<string>>()
  for (const [specifier, file] of entries) {
    const source = program.getSourceFile(file)
    const moduleSymbol = source && checker.getSymbolAtLocation(source)
    if (!moduleSymbol) throw new Error(`${specifier}: ${file} has no module symbol`)
    names.set(specifier, new Set(checker.getExportsOfModule(moduleSymbol).map((s) => s.name)))
  }
  return names
}

const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](basalt-ui(?:\/[a-z/-]+)?)['"]/g
const PROSE_CLAIM = /`([A-Za-z_$][\w$]*)(?:\.[\w$.]+)?(?:<[^`]*>)?` \(`(basalt-ui(?:\/[a-z/-]+)?)`/g
const RECIPE_CLAIM = /(?<![\w/-])([A-Za-z_$][\w$]*)`?, `?(basalt-ui\/[a-z/-]+)/g

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function migratingClaims(): Claim[] {
  const text = readFileSync(join(PKG, 'MIGRATING.md'), 'utf8')
  const claims: Claim[] = []

  for (const block of text.matchAll(/^[ \t]*```(?:ts|tsx|typescript)\n([\s\S]*?)^[ \t]*```/gm)) {
    const offset = (block.index ?? 0) + block[0].indexOf('\n') + 1
    for (const imp of block[1].matchAll(IMPORT)) {
      const where = `MIGRATING.md:${lineOf(text, offset + (imp.index ?? 0))}`
      for (const raw of imp[1].split(',')) {
        const symbol = raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
        if (symbol) claims.push({ symbol, subpath: imp[2], where })
      }
    }
  }

  const cutoff = text.indexOf(OLDEST_CHECKED_PROSE_SECTION)
  if (cutoff === -1)
    throw new Error(`MIGRATING.md lost its ${OLDEST_CHECKED_PROSE_SECTION} section`)
  const nextSection = text.indexOf('\n## ', cutoff + 1)
  const checkedProse = text.slice(0, nextSection === -1 ? text.length : nextSection)
  for (const m of checkedProse.matchAll(PROSE_CLAIM)) {
    const lineStart = checkedProse.lastIndexOf('\n', m.index ?? 0) + 1
    const beforeClaim = checkedProse.slice(lineStart, m.index)
    if (/^\s*\|[^|]*$/.test(beforeClaim)) continue
    claims.push({
      symbol: m[1],
      subpath: m[2],
      where: `MIGRATING.md:${lineOf(text, m.index ?? 0)}`,
    })
  }
  return claims
}

function guardMessageClaims(): Claim[] {
  return ['configs/oxlint-plugin.js', 'src/guard/index.ts'].flatMap((rel) => {
    const text = readFileSync(join(PKG, rel), 'utf8')
    return [...text.matchAll(RECIPE_CLAIM)].map((m) => ({
      symbol: m[1],
      subpath: m[2],
      where: `${rel}:${lineOf(text, m.index ?? 0)}`,
    }))
  })
}

describe('documented imports resolve', () => {
  const names = exportedNames(subpathEntries())
  const claims = [...migratingClaims(), ...guardMessageClaims()]

  test('the extractors find the claims they exist for', () => {
    expect(claims).toContainEqual(
      expect.objectContaining({ symbol: 'CONTAINER_CLASSES', subpath: 'basalt-ui/tokens' }),
    )
    expect(claims.filter((c) => c.where.startsWith('configs/')).length).toBeGreaterThan(0)
  })

  test('every claimed symbol is exported by the subpath it names', () => {
    const broken = claims
      .filter((c) => !names.get(c.subpath)?.has(c.symbol))
      .map((c) =>
        names.has(c.subpath)
          ? `${c.where}: ${c.symbol} is not exported by ${c.subpath}`
          : `${c.where}: ${c.subpath} is not a published subpath`,
      )
    expect(broken).toEqual([])
  })
})
